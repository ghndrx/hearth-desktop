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

/// Gaming platform identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GamePlatform {
    Steam,
    EpicGames,
    BattleNet,
}

impl std::fmt::Display for GamePlatform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GamePlatform::Steam => write!(f, "Steam"),
            GamePlatform::EpicGames => write!(f, "Epic Games Store"),
            GamePlatform::BattleNet => write!(f, "Battle.net"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub app_id: String,
    pub name: String,
    pub process_name: String,
    pub is_running: bool,
    pub last_detected: u64,
    pub total_playtime_seconds: u64,
    #[serde(default)]
    pub platform: GamePlatform,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInfo {
    pub app_id: String,
    pub name: String,
    pub icon_url: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    #[serde(default)]
    pub platform: GamePlatform,
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

/// Game entry with platform info: (process_name, app_id, platform)
type GameEntry = (&'static str, &'static str, GamePlatform);

/// Get all known games with their platform information
fn get_known_games() -> Vec<GameEntry> {
    vec![
        // Steam games
        ("cs2.exe", "730", GamePlatform::Steam),                     // Counter-Strike 2
        ("dota2.exe", "570", GamePlatform::Steam),                    // Dota 2
        ("tf2.exe", "440", GamePlatform::Steam),                      // Team Fortress 2
        ("pubg.exe", "578080", GamePlatform::Steam),                  // PUBG
        ("rust.exe", "252490", GamePlatform::Steam),                 // Rust
        ("rust_x86_64.exe", "252490", GamePlatform::Steam),           // Rust Linux
        ("pathofexile.exe", "238960", GamePlatform::Steam),          // Path of Exile
        ("rocketleague.exe", "252950", GamePlatform::Steam),          // Rocket League
        ("apexlegends.exe", "1172470", GamePlatform::Steam),          // Apex Legends
        ("eldenring.exe", "1245620", GamePlatform::Steam),           // Elden Ring
        ("gta5.exe", "271590", GamePlatform::Steam),                  // GTA V
        ("warframe.exe", "230410", GamePlatform::Steam),              // Warframe
        ("lostark.exe", "1599340", GamePlatform::Steam),              // Lost Ark
        ("destiny2.exe", "1085660", GamePlatform::Steam),             // Destiny 2
        ("eu4.exe", "236850", GamePlatform::Steam),                   // Europa Universalis IV
        ("ck3.exe", "1158310", GamePlatform::Steam),                  // Crusader Kings III
        ("hades.exe", "1147560", GamePlatform::Steam),                // Hades
        ("sekiro.exe", "814380", GamePlatform::Steam),                // Sekiro
        ("skyrimse.exe", "489830", GamePlatform::Steam),              // Skyrim Special Edition
        ("cyberpunk.exe", "1091500", GamePlatform::Steam),            // Cyberpunk 2077
        
        // Epic Games Store games
        ("Fortnite.exe", "epic_fortnite", GamePlatform::EpicGames),   // Fortnite
        ("RocketLeague.exe", "epic_rocketleague", GamePlatform::EpicGames), // Rocket League (Epic version)
        ("epicgameslauncher.exe", "epic_launcher", GamePlatform::EpicGames), // Epic Games Launcher
        ("EGS.exe", "epic_egs", GamePlatform::EpicGames),             // Epic Games Store (alt)
        ("FallGuys_client.exe", "epic_fallguys", GamePlatform::EpicGames), // Fall Guys
        ("协调.exe", "epic_fortnite", GamePlatform::EpicGames),       // Fortnite (Chinese)
        ("valorant.exe", "epic_valorant", GamePlatform::EpicGames),   // Valorant
        ("VALORANT.exe", "epic_valorant", GamePlatform::EpicGames),   // Valorant (alt casing)
        ("League of Legends.exe", "epic_lol", GamePlatform::EpicGames), // League of Legends
        ("EpicWebHelper.exe", "epic_web", GamePlatform::EpicGames),   // Epic Web Helper
        
        // Battle.net games
        ("Battle.net.exe", "battlenet_launcher", GamePlatform::BattleNet), // Battle.net Launcher
        ("Wow.exe", "battlenet_wow", GamePlatform::BattleNet),              // World of Warcraft
        ("WowClassic.exe", "battlenet_wow_classic", GamePlatform::BattleNet), // WoW Classic
        ("Overwatch2.exe", "battlenet_overwatch2", GamePlatform::BattleNet), // Overwatch 2
        ("Diablo IV.exe", "battlenet_diablo4", GamePlatform::BattleNet),    // Diablo IV
        ("Diablo II Resurrected.exe", "battlenet_diablo2r", GamePlatform::BattleNet), // Diablo II Resurrected
        ("Diablo III.exe", "battlenet_diablo3", GamePlatform::BattleNet),   // Diablo III
        ("Heroes of the Storm.exe", "battlenet_hotS", GamePlatform::BattleNet), // Heroes of the Storm
        ("Hearthstone.exe", "battlenet_hs", GamePlatform::BattleNet),        // Hearthstone
        ("StarCraft II.exe", "battlenet_sc2", GamePlatform::BattleNet),      // StarCraft II
        ("StarCraft Remastered.exe", "battlenet_sc", GamePlatform::BattleNet), // StarCraft Remastered
        ("Destiny 2.exe", "battlenet_destiny2", GamePlatform::BattleNet),     // Destiny 2 (Battlenet)
        ("Call of Duty Modern Warfare II.exe", "battlenet_cod_mw2", GamePlatform::BattleNet), // Call of Duty MW II
        ("Call of Duty Warzone.exe", "battlenet_cod_wz", GamePlatform::BattleNet), // Call of Duty Warzone
        ("Arcade.exe", "battlenet_arcade", GamePlatform::BattleNet),         // Blizzard Arcade
    ]
}

/// Build a hashmap of process_name -> (app_id, platform) for fast lookup
fn build_game_lookup() -> HashMap<String, (String, GamePlatform)> {
    let mut lookup = HashMap::new();
    for (process_name, app_id, platform) in get_known_games() {
        lookup.insert(process_name.to_lowercase(), (app_id.to_string(), platform));
    }
    lookup
}

/// Get Epic Games Store game name by app_id
fn get_epic_game_name(app_id: &str) -> Option<&'static str> {
    match app_id {
        "epic_fortnite" => Some("Fortnite"),
        "epic_rocketleague" => Some("Rocket League"),
        "epic_launcher" => Some("Epic Games Launcher"),
        "epic_egs" => Some("Epic Games Store"),
        "epic_fallguys" => Some("Fall Guys"),
        "epic_valorant" => Some("Valorant"),
        "epic_lol" => Some("League of Legends"),
        "epic_web" => Some("Epic Web Helper"),
        _ => None,
    }
}

/// Get Battle.net game name by app_id
fn get_battlenet_game_name(app_id: &str) -> Option<&'static str> {
    match app_id {
        "battlenet_launcher" => Some("Battle.net Launcher"),
        "battlenet_wow" => Some("World of Warcraft"),
        "battlenet_wow_classic" => Some("World of Warcraft Classic"),
        "battlenet_overwatch2" => Some("Overwatch 2"),
        "battlenet_diablo4" => Some("Diablo IV"),
        "battlenet_diablo2r" => Some("Diablo II: Resurrected"),
        "battlenet_diablo3" => Some("Diablo III"),
        "battlenet_hotS" => Some("Heroes of the Storm"),
        "battlenet_hs" => Some("Hearthstone"),
        "battlenet_sc2" => Some("StarCraft II"),
        "battlenet_sc" => Some("StarCraft Remastered"),
        "battlenet_destiny2" => Some("Destiny 2"),
        "battlenet_cod_mw2" => Some("Call of Duty: Modern Warfare II"),
        "battlenet_cod_wz" => Some("Call of Duty: Warzone"),
        "battlenet_arcade" => Some("Blizzard Arcade"),
        _ => None,
    }
}

pub struct GameDetector {
    is_running: bool,
    http_client: Client,
    db_path: String,
    game_lookup: HashMap<String, (String, GamePlatform)>,
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
            game_lookup: build_game_lookup(),
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
                is_running BOOLEAN DEFAULT FALSE,
                platform TEXT DEFAULT 'Steam'
            )
            "#,
            [],
        )?;

        // Add platform column if it doesn't exist (migration)
        let result = conn.execute(
            "ALTER TABLE detected_games ADD COLUMN platform TEXT DEFAULT 'Steam'",
            [],
        );
        if result.is_err() {
            // Column might already exist, which is fine
        }

        Ok(())
    }

    pub fn scan_running_games(&self) -> Vec<DetectedGame> {
        let mut system = System::new_all();
        system.refresh_processes();

        let mut detected = Vec::new();

        for (pid, process) in system.processes() {
            let process_name_lower = process.name().to_lowercase();

            if let Some((app_id, platform)) = self.game_lookup.get(process_name_lower.as_str()) {
                // Check if this game is already in our database
                if let Ok(mut game) = self.get_or_create_game(app_id, process.name(), platform) {
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

    fn get_or_create_game(&self, app_id: &str, process_name: &str, platform: &GamePlatform) -> SqlResult<DetectedGame> {
        let conn = Connection::open(&self.db_path)?;
        let platform_str = platform.to_string();

        // Try to get existing game
        if let Ok(game) = conn.query_row(
            "SELECT app_id, name, process_name, last_detected, total_playtime_seconds, is_running, platform FROM detected_games WHERE app_id = ?1",
            [app_id],
            |row| {
                Ok(DetectedGame {
                    app_id: row.get(0)?,
                    name: row.get(1)?,
                    process_name: row.get(2)?,
                    last_detected: row.get::<_, i64>(3)? as u64,
                    total_playtime_seconds: row.get::<_, i64>(4)? as u64,
                    is_running: row.get(5)?,
                    platform: match row.get::<_, String>(6)?.as_str() {
                        "Epic Games Store" => GamePlatform::EpicGames,
                        "Battle.net" => GamePlatform::BattleNet,
                        _ => GamePlatform::Steam,
                    },
                })
            },
        ) {
            return Ok(game);
        }

        // Create new game entry - we'll update the name later with platform-specific API data
        let game = DetectedGame {
            app_id: app_id.to_string(),
            name: format!("Game {}", app_id), // Placeholder name
            process_name: process_name.to_string(),
            last_detected: 0,
            total_playtime_seconds: 0,
            is_running: false,
            platform: platform.clone(),
        };

        conn.execute(
            "INSERT OR REPLACE INTO detected_games (app_id, name, process_name, last_detected, total_playtime_seconds, is_running, platform) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            [
                &game.app_id,
                &game.name,
                &game.process_name,
                &(game.last_detected as i64).to_string(),
                &(game.total_playtime_seconds as i64).to_string(),
                &game.is_running.to_string(),
                &platform_str,
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

    pub async fn update_game_metadata(&self, app_id: &str, platform: &GamePlatform) {
        match platform {
            GamePlatform::Steam => {
                if let Ok(game_info) = self.get_steam_game_info(app_id).await {
                    let _ = self.update_game_name(&game_info.app_id, &game_info.name);
                }
            },
            GamePlatform::EpicGames => {
                // Epic Games Store metadata - use bundled data for known games
                if let Some(name) = get_epic_game_name(app_id) {
                    let _ = self.update_game_name(app_id, name);
                }
            },
            GamePlatform::BattleNet => {
                // Battle.net metadata - use bundled data for known games
                if let Some(name) = get_battlenet_game_name(app_id) {
                    let _ = self.update_game_name(app_id, name);
                }
            },
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

        let mut stmt = conn.prepare("SELECT app_id, name, process_name, last_detected, total_playtime_seconds, is_running, platform FROM detected_games ORDER BY last_detected DESC")?;

        let games = stmt.query_map([], |row| {
            Ok(DetectedGame {
                app_id: row.get(0)?,
                name: row.get(1)?,
                process_name: row.get(2)?,
                last_detected: row.get::<_, i64>(3)? as u64,
                total_playtime_seconds: row.get::<_, i64>(4)? as u64,
                is_running: row.get(5)?,
                platform: match row.get::<_, String>(6)?.as_str() {
                    "Epic Games Store" => GamePlatform::EpicGames,
                    "Battle.net" => GamePlatform::BattleNet,
                    _ => GamePlatform::Steam,
                },
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
                    let platform = game.platform.clone();
                    drop(detector);

                    // Don't block the main loop for API calls
                    tokio::spawn(async move {
                        let detector = GAME_DETECTOR.lock().unwrap();
                        detector.update_game_metadata(&app_id, &platform).await;
                    });

                    // If game is running and broadcasting is enabled, update presence
                    if game.is_running {
                        let app_id = game.app_id.clone();
                        let game_name = game.name.clone();
                        let platform = game.platform.clone();
                        
                        // Convert to rich_presence GamePlatform
                        let rp_platform = match platform {
                            GamePlatform::Steam => Some(super::rich_presence::GamePlatform::Steam),
                            GamePlatform::EpicGames => Some(super::rich_presence::GamePlatform::EpicGames),
                            GamePlatform::BattleNet => Some(super::rich_presence::GamePlatform::BattleNet),
                        };
                        
                        super::rich_presence::update_presence_from_detection(&app_id, &game_name, rp_platform);
                    }
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
    // Detect platform from app_id prefix
    let (platform, game_id) = if app_id.starts_with("epic_") {
        (GamePlatform::EpicGames, app_id.trim_start_matches("epic_").to_string())
    } else if app_id.starts_with("battlenet_") {
        (GamePlatform::BattleNet, app_id.trim_start_matches("battlenet_").to_string())
    } else {
        (GamePlatform::Steam, app_id)
    };

    match platform {
        GamePlatform::Steam => {
            let steam_url = format!("steam://run/{}", game_id);
            launch_via_url(&steam_url)?;
        },
        GamePlatform::EpicGames => {
            // Epic Games Store uses com.epicgames.launcher://apps/<game_id>?action=launch&silent=true
            let epic_url = format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", game_id);
            launch_via_url(&epic_url)?;
        },
        GamePlatform::BattleNet => {
            // Battle.net uses battlenet://<game_id> protocol
            let battle_url = format!("battlenet://{}", game_id);
            launch_via_url(&battle_url)?;
        },
    }

    Ok(())
}

fn launch_via_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", url])
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    Ok(())
}