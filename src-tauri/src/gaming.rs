use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sysinfo::{Process, ProcessExt, System, SystemExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub id: String,
    pub name: String,
    pub executable: String,
    pub window_title: Option<String>,
    pub platform: GamePlatform,
    pub pid: u32,
    pub start_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GamePlatform {
    Steam,
    Epic,
    Origin,
    BattleNet,
    Riot,
    Standalone,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEntry {
    pub id: String,
    pub name: String,
    pub executables: Vec<String>,
    pub platform: GamePlatform,
}

pub struct GameDetector {
    system: System,
    known_games: HashMap<String, GameEntry>,
}

impl GameDetector {
    pub fn new() -> Self {
        let mut detector = Self {
            system: System::new_all(),
            known_games: HashMap::new(),
        };
        detector.load_known_games();
        detector
    }

    fn load_known_games(&mut self) {
        let games = vec![
            GameEntry {
                id: "league_of_legends".to_string(),
                name: "League of Legends".to_string(),
                executables: vec![
                    "LeagueClient.exe".to_string(),
                    "League of Legends.exe".to_string(),
                    "LeagueClientUx.exe".to_string(),
                    "LeagueClient".to_string(),
                ],
                platform: GamePlatform::Riot,
            },
            GameEntry {
                id: "valorant".to_string(),
                name: "VALORANT".to_string(),
                executables: vec![
                    "VALORANT.exe".to_string(),
                    "VALORANT-Win64-Shipping.exe".to_string(),
                    "RiotClientServices.exe".to_string(),
                ],
                platform: GamePlatform::Riot,
            },
            GameEntry {
                id: "cs2".to_string(),
                name: "Counter-Strike 2".to_string(),
                executables: vec![
                    "cs2.exe".to_string(),
                    "cs2".to_string(),
                ],
                platform: GamePlatform::Steam,
            },
            GameEntry {
                id: "minecraft".to_string(),
                name: "Minecraft".to_string(),
                executables: vec![
                    "Minecraft.exe".to_string(),
                    "java.exe".to_string(),
                    "javaw.exe".to_string(),
                    "minecraft".to_string(),
                    "java".to_string(),
                ],
                platform: GamePlatform::Standalone,
            },
            GameEntry {
                id: "fortnite".to_string(),
                name: "Fortnite".to_string(),
                executables: vec![
                    "FortniteClient-Win64-Shipping.exe".to_string(),
                    "FortniteClient-Linux-Shipping".to_string(),
                ],
                platform: GamePlatform::Epic,
            },
            GameEntry {
                id: "apex_legends".to_string(),
                name: "Apex Legends".to_string(),
                executables: vec![
                    "r5apex.exe".to_string(),
                    "r5apex".to_string(),
                ],
                platform: GamePlatform::Origin,
            },
            GameEntry {
                id: "overwatch2".to_string(),
                name: "Overwatch 2".to_string(),
                executables: vec![
                    "Overwatch.exe".to_string(),
                    "Overwatch".to_string(),
                ],
                platform: GamePlatform::BattleNet,
            },
            GameEntry {
                id: "rocket_league".to_string(),
                name: "Rocket League".to_string(),
                executables: vec![
                    "RocketLeague.exe".to_string(),
                    "RocketLeague".to_string(),
                ],
                platform: GamePlatform::Steam,
            },
            GameEntry {
                id: "world_of_warcraft".to_string(),
                name: "World of Warcraft".to_string(),
                executables: vec![
                    "Wow.exe".to_string(),
                    "WowClassic.exe".to_string(),
                    "Wow".to_string(),
                ],
                platform: GamePlatform::BattleNet,
            },
            GameEntry {
                id: "discord".to_string(),
                name: "Discord".to_string(),
                executables: vec![
                    "Discord.exe".to_string(),
                    "Discord".to_string(),
                ],
                platform: GamePlatform::Standalone,
            },
        ];

        for game in games {
            for executable in &game.executables {
                self.known_games.insert(executable.to_lowercase(), game.clone());
            }
        }
    }

    pub fn scan_for_games(&mut self) -> Vec<DetectedGame> {
        self.system.refresh_processes();
        let mut detected_games = Vec::new();

        for (pid, process) in self.system.processes() {
            let process_name = process.name().to_lowercase();

            if let Some(game_entry) = self.known_games.get(&process_name) {
                // Special handling for Java-based games like Minecraft
                if process_name == "java.exe" || process_name == "javaw.exe" || process_name == "java" {
                    // Check if this is actually Minecraft by looking at command line args
                    let cmd_line = process.cmd().join(" ");
                    if !cmd_line.to_lowercase().contains("minecraft") {
                        continue;
                    }
                }

                let detected_game = DetectedGame {
                    id: game_entry.id.clone(),
                    name: game_entry.name.clone(),
                    executable: process.name().to_string(),
                    window_title: None, // Could be enhanced to get window title
                    platform: game_entry.platform.clone(),
                    pid: pid.as_u32(),
                    start_time: Some(process.start_time()),
                };

                detected_games.push(detected_game);
            }
        }

        detected_games
    }

    pub fn get_current_game(&mut self) -> Option<DetectedGame> {
        let games = self.scan_for_games();

        // Return the most recently started game that's not Discord
        games
            .into_iter()
            .filter(|game| game.id != "discord")
            .max_by_key(|game| game.start_time.unwrap_or(0))
    }
}

/// Tauri command to get all currently running games
#[tauri::command]
pub async fn get_running_games() -> Result<Vec<DetectedGame>, String> {
    let mut detector = GameDetector::new();
    Ok(detector.scan_for_games())
}

/// Tauri command to get the current/primary game being played
#[tauri::command]
pub async fn detect_running_game() -> Result<Option<DetectedGame>, String> {
    let mut detector = GameDetector::new();
    Ok(detector.get_current_game())
}

/// Tauri command to get the list of supported games
#[tauri::command]
pub async fn get_supported_games() -> Result<Vec<GameEntry>, String> {
    let detector = GameDetector::new();
    let unique_games: Vec<GameEntry> = detector
        .known_games
        .values()
        .map(|game| game.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    Ok(unique_games)
}

impl std::hash::Hash for GameEntry {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}

impl PartialEq for GameEntry {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for GameEntry {}