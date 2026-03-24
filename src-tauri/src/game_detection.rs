use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use sysinfo::{System, Pid, ProcessExt, SystemExt};
use rusqlite::{Connection, Result as SqlResult};
use reqwest::Client;
use once_cell::sync::Lazy;

// Global state for the detection system
static GAME_DETECTOR: Lazy<Arc<Mutex<GameDetector>>> = Lazy::new(|| {
    Arc::new(Mutex::new(GameDetector::new()))
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub app_id: String,
    pub name: String,
    pub process_name: String,
    pub is_running: bool,
    pub last_detected: u64,
    pub total_playtime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInfo {
    pub app_id: String,
    pub name: String,
    pub icon_url: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAppResponse {
    #[serde(flatten)]
    pub apps: HashMap<String, SteamAppData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAppData {
    pub success: bool,
    pub data: Option<SteamGameData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGameData {
    pub name: String,
    pub header_image: Option<String>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub release_date: Option<SteamReleaseDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamReleaseDate {
    pub date: String,
}

// Known Steam game mappings (process name -> app_id)
fn get_known_games() -> HashMap<String, &'static str> {
    let mut games = HashMap::new();

    // Top 20 Steam games
    games.insert("cs2.exe".to_string(), "730");  // Counter-Strike 2
    games.insert("dota2.exe".to_string(), "570"); // Dota 2
    games.insert("tf2.exe".to_string(), "440");   // Team Fortress 2
    games.insert("pubg.exe".to_string(), "578080"); // PUBG
    games.insert("rust.exe".to_string(), "252490"); // Rust
    games.insert("rust_x86_64.exe".to_string(), "252490"); // Rust Linux
    games.insert("pathofexile.exe".to_string(), "238960"); // Path of Exile
    games.insert("rocketleague.exe".to_string(), "252950"); // Rocket League
    games.insert("apexlegends.exe".to_string(), "1172470"); // Apex Legends
    games.insert("eldenring.exe".to_string(), "1245620"); // Elden Ring
    games.insert("gta5.exe".to_string(), "271590"); // GTA V
    games.insert("warframe.exe".to_string(), "230410"); // Warframe
    games.insert("lostark.exe".to_string(), "1599340"); // Lost Ark
    games.insert("destiny2.exe".to_string(), "1085660"); // Destiny 2
    games.insert("fortnite.exe".to_string(), "386360"); // Fortnite
    games.insert("overwatch2.exe".to_string(), "2357570"); // Overwatch 2
    games.insert("eu4.exe".to_string(), "236850"); // Europa Universalis IV
    games.insert("ck3.exe".to_string(), "1158310"); // Crusader Kings III
    // Note: Valorant is not on Steam, it's from Riot/Epic

    games
}

pub struct GameDetector {
    is_running: bool,
    http_client: Client,
    db_path: String,
}

impl GameDetector {
    pub fn new() -> Self {
        let db_path = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("hearth-desktop")
            .join("games.db")
            .to_string_lossy()
            .to_string();

        Self {
            is_running: false,
            http_client: Client::new(),
            db_path,
        }
    }

    pub fn init_database(&self) -> SqlResult<()> {
        // Ensure the directory exists
        if let Some(parent) = std::path::Path::new(&self.db_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS detected_games (
                id INTEGER PRIMARY KEY,
                app_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                process_name TEXT NOT NULL,
                last_detected INTEGER,
                total_playtime_seconds INTEGER DEFAULT 0,
                is_running BOOLEAN DEFAULT FALSE
            )
            "#,
            [],
        )?;

        Ok(())
    }

    pub fn scan_running_games(&self) -> Vec<DetectedGame> {
        let mut system = System::new_all();
        system.refresh_processes();

        let known_games = get_known_games();
        let mut detected = Vec::new();

        for (pid, process) in system.processes() {
            let process_name = process.name();

            if let Some(&app_id) = known_games.get(process_name) {
                // Check if this game is already in our database
                if let Ok(mut game) = self.get_or_create_game(app_id, process_name) {
                    game.is_running = true;
                    game.last_detected = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();

                    // Update the database
                    let _ = self.update_game_status(&game);
                    detected.push(game);
                }
            }
        }

        // Mark games not found as not running
        let _ = self.mark_all_games_not_running();
        for game in &detected {
            let _ = self.update_game_status(game);
        }

        detected
    }

    fn get_or_create_game(&self, app_id: &str, process_name: &str) -> SqlResult<DetectedGame> {
        let conn = Connection::open(&self.db_path)?;

        // Try to get existing game
        if let Ok(game) = conn.query_row(
            "SELECT app_id, name, process_name, last_detected, total_playtime_seconds, is_running FROM detected_games WHERE app_id = ?1",
            [app_id],
            |row| {
                Ok(DetectedGame {
                    app_id: row.get(0)?,
                    name: row.get(1)?,
                    process_name: row.get(2)?,
                    last_detected: row.get::<_, i64>(3)? as u64,
                    total_playtime_seconds: row.get::<_, i64>(4)? as u64,
                    is_running: row.get(5)?,
                })
            },
        ) {
            return Ok(game);
        }

        // Create new game entry - we'll update the name later with Steam API data
        let game = DetectedGame {
            app_id: app_id.to_string(),
            name: format!("Game {}", app_id), // Placeholder name
            process_name: process_name.to_string(),
            last_detected: 0,
            total_playtime_seconds: 0,
            is_running: false,
        };

        conn.execute(
            "INSERT OR REPLACE INTO detected_games (app_id, name, process_name, last_detected, total_playtime_seconds, is_running) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            [
                &game.app_id,
                &game.name,
                &game.process_name,
                &(game.last_detected as i64).to_string(),
                &(game.total_playtime_seconds as i64).to_string(),
                &game.is_running.to_string(),
            ],
        )?;

        Ok(game)
    }

    async fn get_steam_game_info(&self, app_id: &str) -> Result<GameInfo, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("https://store.steampowered.com/api/appdetails?appids={}&cc=US&l=en", app_id);

        let response = self.http_client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await?;

        let steam_response: SteamAppResponse = response.json().await?;

        if let Some(app_data) = steam_response.apps.get(app_id) {
            if app_data.success && app_data.data.is_some() {
                let data = app_data.data.as_ref().unwrap();

                return Ok(GameInfo {
                    app_id: app_id.to_string(),
                    name: data.name.clone(),
                    icon_url: data.header_image.clone(),
                    developer: data.developers.as_ref().and_then(|devs| devs.first().cloned()),
                    publisher: data.publishers.as_ref().and_then(|pubs| pubs.first().cloned()),
                    release_date: data.release_date.as_ref().map(|rd| rd.date.clone()),
                });
            }
        }

        Err(format!("Failed to get game info for app_id: {}", app_id).into())
    }

    fn update_game_status(&self, game: &DetectedGame) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            "UPDATE detected_games SET last_detected = ?1, is_running = ?2 WHERE app_id = ?3",
            [
                &(game.last_detected as i64).to_string(),
                &game.is_running.to_string(),
                &game.app_id,
            ],
        )?;

        Ok(())
    }

    fn mark_all_games_not_running(&self) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            "UPDATE detected_games SET is_running = FALSE",
            [],
        )?;

        Ok(())
    }

    pub async fn update_game_metadata(&self, app_id: &str) {
        if let Ok(game_info) = self.get_steam_game_info(app_id).await {
            let _ = self.update_game_name(&game_info.app_id, &game_info.name);
        }
    }

    fn update_game_name(&self, app_id: &str, name: &str) -> SqlResult<()> {
        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            "UPDATE detected_games SET name = ?1 WHERE app_id = ?2",
            [name, app_id],
        )?;

        Ok(())
    }

    pub fn get_all_games(&self) -> SqlResult<Vec<DetectedGame>> {
        let conn = Connection::open(&self.db_path)?;

        let mut stmt = conn.prepare("SELECT app_id, name, process_name, last_detected, total_playtime_seconds, is_running FROM detected_games ORDER BY last_detected DESC")?;

        let games = stmt.query_map([], |row| {
            Ok(DetectedGame {
                app_id: row.get(0)?,
                name: row.get(1)?,
                process_name: row.get(2)?,
                last_detected: row.get::<_, i64>(3)? as u64,
                total_playtime_seconds: row.get::<_, i64>(4)? as u64,
                is_running: row.get(5)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

        Ok(games)
    }

    pub async fn start_detection(&mut self, app_handle: AppHandle) -> Result<(), String> {
        if self.is_running {
            return Ok(()); // Already running
        }

        self.init_database().map_err(|e| format!("Database init error: {}", e))?;
        self.is_running = true;

        // Clone for the background task
        let db_path = self.db_path.clone();
        let http_client = self.http_client.clone();

        // Background detection loop
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(5));

            loop {
                interval.tick().await;

                // Check if we should still be running
                {
                    let detector = GAME_DETECTOR.lock().unwrap();
                    if !detector.is_running {
                        break;
                    }
                }

                // Scan for running games
                let detector = GAME_DETECTOR.lock().unwrap();
                let detected_games = detector.scan_running_games();
                drop(detector); // Release lock early

                // Update metadata for newly detected games (in background)
                for game in &detected_games {
                    let detector = GAME_DETECTOR.lock().unwrap();
                    let app_id = game.app_id.clone();
                    drop(detector);

                    // Don't block the main loop for API calls
                    tokio::spawn(async move {
                        let detector = GAME_DETECTOR.lock().unwrap();
                        detector.update_game_metadata(&app_id).await;
                    });
                }

                // Emit event to frontend
                let _ = app_handle.emit("games-detected", &detected_games);
            }
        });

        Ok(())
    }

    pub fn stop_detection(&mut self) {
        self.is_running = false;
    }
}

// Tauri commands
#[tauri::command]
pub fn get_running_games() -> Result<Vec<DetectedGame>, String> {
    let detector = GAME_DETECTOR.lock().map_err(|e| format!("Lock error: {}", e))?;
    let games = detector.scan_running_games();
    Ok(games)
}

#[tauri::command]
pub fn get_game_library() -> Result<Vec<DetectedGame>, String> {
    let detector = GAME_DETECTOR.lock().map_err(|e| format!("Lock error: {}", e))?;
    detector.get_all_games().map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn start_detection(app_handle: AppHandle) -> Result<(), String> {
    let mut detector = GAME_DETECTOR.lock().map_err(|e| format!("Lock error: {}", e))?;
    detector.start_detection(app_handle).await
}

#[tauri::command]
pub fn stop_detection() -> Result<(), String> {
    let mut detector = GAME_DETECTOR.lock().map_err(|e| format!("Lock error: {}", e))?;
    detector.stop_detection();
    Ok(())
}

#[tauri::command]
pub async fn launch_game(app_id: String) -> Result<(), String> {
    // Launch game via Steam URL
    let steam_url = format!("steam://run/{}", app_id);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", &steam_url])
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&steam_url)
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&steam_url)
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    Ok(())
}