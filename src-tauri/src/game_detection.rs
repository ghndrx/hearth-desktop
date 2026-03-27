use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use sysinfo::{System, ProcessExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub name: String,
    pub process_name: String,
    pub pid: u32,
    pub category: GameCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameCategory {
    FPS,
    MOBA,
    MMO,
    Strategy,
    Racing,
    Sports,
    Indie,
    AAA,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDetectionResult {
    pub detected_games: Vec<DetectedGame>,
    pub is_gaming: bool,
    pub total_games_running: usize,
}

pub struct GameDetectionEngine {
    known_games: HashSet<(String, GameCategory)>,
    system: System,
}

impl GameDetectionEngine {
    pub fn new() -> Self {
        let mut known_games = HashSet::new();

        // Popular FPS games
        known_games.insert(("csgo.exe".to_string(), GameCategory::FPS));
        known_games.insert(("cs2.exe".to_string(), GameCategory::FPS));
        known_games.insert(("valorant.exe".to_string(), GameCategory::FPS));
        known_games.insert(("overwatch.exe".to_string(), GameCategory::FPS));
        known_games.insert(("apex.exe".to_string(), GameCategory::FPS));
        known_games.insert(("destiny2.exe".to_string(), GameCategory::FPS));
        known_games.insert(("r6.exe".to_string(), GameCategory::FPS));
        known_games.insert(("cod.exe".to_string(), GameCategory::FPS));

        // MOBA games
        known_games.insert(("league of legends.exe".to_string(), GameCategory::MOBA));
        known_games.insert(("dota2.exe".to_string(), GameCategory::MOBA));
        known_games.insert(("heroesofthestorm.exe".to_string(), GameCategory::MOBA));

        // MMO games
        known_games.insert(("wow.exe".to_string(), GameCategory::MMO));
        known_games.insert(("ffxiv.exe".to_string(), GameCategory::MMO));
        known_games.insert(("guildwars2.exe".to_string(), GameCategory::MMO));
        known_games.insert(("elderscrollsonline.exe".to_string(), GameCategory::MMO));

        // Strategy games
        known_games.insert(("starcraft2.exe".to_string(), GameCategory::Strategy));
        known_games.insert(("age of empires.exe".to_string(), GameCategory::Strategy));
        known_games.insert(("civilization.exe".to_string(), GameCategory::Strategy));

        // Racing games
        known_games.insert(("forza.exe".to_string(), GameCategory::Racing));
        known_games.insert(("gran turismo.exe".to_string(), GameCategory::Racing));
        known_games.insert(("dirt.exe".to_string(), GameCategory::Racing));

        // Sports games
        known_games.insert(("fifa.exe".to_string(), GameCategory::Sports));
        known_games.insert(("nba2k.exe".to_string(), GameCategory::Sports));
        known_games.insert(("madden.exe".to_string(), GameCategory::Sports));

        // AAA games
        known_games.insert(("cyberpunk2077.exe".to_string(), GameCategory::AAA));
        known_games.insert(("witcher3.exe".to_string(), GameCategory::AAA));
        known_games.insert(("gta5.exe".to_string(), GameCategory::AAA));
        known_games.insert(("rdr2.exe".to_string(), GameCategory::AAA));
        known_games.insert(("assassinscreed.exe".to_string(), GameCategory::AAA));

        // Cross-platform games (add common Linux and macOS process names)
        known_games.insert(("steam".to_string(), GameCategory::Unknown));
        known_games.insert(("steamwebhelper".to_string(), GameCategory::Unknown));
        known_games.insert(("minecraft".to_string(), GameCategory::Indie));
        known_games.insert(("terraria".to_string(), GameCategory::Indie));
        known_games.insert(("factorio".to_string(), GameCategory::Indie));
        known_games.insert(("stardewvalley".to_string(), GameCategory::Indie));

        Self {
            known_games,
            system: System::new_all(),
        }
    }

    pub fn scan_for_games(&mut self) -> GameDetectionResult {
        // Refresh system information
        self.system.refresh_processes();

        let mut detected_games = Vec::new();

        for (pid, process) in self.system.processes() {
            let process_name = process.name().to_lowercase();

            // Check if this process matches any known games
            for (game_process, category) in &self.known_games {
                if process_name.contains(&game_process.to_lowercase()) {
                    // Extract a cleaner game name from the process name
                    let game_name = self.extract_game_name(&process_name, game_process);

                    detected_games.push(DetectedGame {
                        name: game_name,
                        process_name: process_name.clone(),
                        pid: pid.as_u32(),
                        category: category.clone(),
                    });
                    break; // Don't check other patterns for this process
                }
            }

            // Check for common game-related process patterns
            if self.is_likely_game_process(&process_name) &&
               !self.is_known_non_game(&process_name) {
                detected_games.push(DetectedGame {
                    name: self.extract_game_name(&process_name, &process_name),
                    process_name: process_name.clone(),
                    pid: pid.as_u32(),
                    category: GameCategory::Unknown,
                });
            }
        }

        // Remove duplicates based on process name
        detected_games.dedup_by(|a, b| a.process_name == b.process_name);

        let total_games_running = detected_games.len();
        let is_gaming = total_games_running > 0;

        GameDetectionResult {
            detected_games,
            is_gaming,
            total_games_running,
        }
    }

    fn extract_game_name(&self, process_name: &str, game_process: &str) -> String {
        // Remove common suffixes and clean up the name
        let clean_name = process_name
            .replace(".exe", "")
            .replace("-", " ")
            .replace("_", " ")
            .replace("launcher", "")
            .replace("client", "");

        // Capitalize first letters
        clean_name
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
                }
            })
            .collect::<Vec<String>>()
            .join(" ")
    }

    fn is_likely_game_process(&self, process_name: &str) -> bool {
        let game_indicators = [
            "game", "play", "unity", "unreal", "engine", "launcher",
            "client", "battle", "origin", "epic", "gog", "uplay",
            "rockstar", "blizzard", "riot", "valve"
        ];

        game_indicators.iter().any(|&indicator| process_name.contains(indicator))
    }

    fn is_known_non_game(&self, process_name: &str) -> bool {
        let non_game_processes = [
            "chrome", "firefox", "safari", "edge", "browser",
            "explorer", "finder", "system", "kernel", "service",
            "daemon", "helper", "updater", "installer", "antivirus",
            "backup", "sync", "cloud", "driver", "audio", "video",
            "network", "security", "windows", "microsoft", "apple",
            "google", "adobe", "nvidia", "amd", "intel"
        ];

        non_game_processes.iter().any(|&non_game| process_name.contains(non_game))
    }
}

impl Default for GameDetectionEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_detection_engine_creation() {
        let engine = GameDetectionEngine::new();
        assert!(!engine.known_games.is_empty());
    }

    #[test]
    fn test_extract_game_name() {
        let engine = GameDetectionEngine::new();
        assert_eq!(
            engine.extract_game_name("counter_strike.exe", "counter_strike.exe"),
            "Counter Strike"
        );
        assert_eq!(
            engine.extract_game_name("league-of-legends.exe", "league-of-legends.exe"),
            "League Of Legends"
        );
    }

    #[test]
    fn test_is_likely_game_process() {
        let engine = GameDetectionEngine::new();
        assert!(engine.is_likely_game_process("mygame.exe"));
        assert!(engine.is_likely_game_process("unity_player.exe"));
        assert!(engine.is_likely_game_process("epic_launcher.exe"));
        assert!(!engine.is_likely_game_process("notepad.exe"));
    }

    #[test]
    fn test_is_known_non_game() {
        let engine = GameDetectionEngine::new();
        assert!(engine.is_known_non_game("chrome.exe"));
        assert!(engine.is_known_non_game("windows_explorer.exe"));
        assert!(!engine.is_known_non_game("mygame.exe"));
    }
}