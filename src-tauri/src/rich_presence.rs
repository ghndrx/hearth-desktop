use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use once_cell::sync::Lazy;

static PRESENCE_MANAGER: Lazy<Arc<Mutex<RichPresenceManager>>> = Lazy::new(|| {
    Arc::new(Mutex::new(RichPresenceManager::new()))
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartyInfo {
    pub party_id: String,
    pub party_size: u32,
    pub party_max: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePresenceState {
    pub game_id: String,
    pub game_name: String,
    pub state: String,
    pub details: String,
    pub timestamp: u64,
    pub party_info: Option<PartyInfo>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendPresence {
    pub friend_id: String,
    pub presence: Option<GamePresenceState>,
    pub is_online: bool,
}

pub struct RichPresenceManager {
    current_presence: Option<GamePresenceState>,
    friend_presences: HashMap<String, FriendPresence>,
    broadcasting_enabled: bool,
}

impl RichPresenceManager {
    pub fn new() -> Self {
        Self {
            current_presence: None,
            friend_presences: HashMap::new(),
            broadcasting_enabled: false,
        }
    }

    pub fn update_presence(&mut self, state: GamePresenceState) -> GamePresenceState {
        let mut state = state;
        if state.timestamp == 0 {
            state.timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
        }
        self.current_presence = Some(state.clone());
        state
    }

    pub fn clear_presence(&mut self) {
        self.current_presence = None;
    }

    pub fn get_current_presence(&self) -> Option<GamePresenceState> {
        self.current_presence.clone()
    }

    pub fn get_friend_presence(&self, friend_id: &str) -> FriendPresence {
        self.friend_presences
            .get(friend_id)
            .cloned()
            .unwrap_or(FriendPresence {
                friend_id: friend_id.to_string(),
                presence: None,
                is_online: false,
            })
    }

    pub fn update_friend_presence(&mut self, friend_id: String, presence: Option<GamePresenceState>, is_online: bool) {
        self.friend_presences.insert(friend_id.clone(), FriendPresence {
            friend_id,
            presence,
            is_online,
        });
    }

    pub fn get_all_friend_presences(&self) -> Vec<FriendPresence> {
        self.friend_presences.values().cloned().collect()
    }

    pub fn set_broadcasting(&mut self, enabled: bool) {
        self.broadcasting_enabled = enabled;
    }

    pub fn is_broadcasting(&self) -> bool {
        self.broadcasting_enabled
    }
}

// Tauri commands

#[tauri::command]
pub fn update_presence(app_handle: AppHandle, state: GamePresenceState) -> Result<GamePresenceState, String> {
    let mut manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    let updated = manager.update_presence(state);
    let broadcasting = manager.is_broadcasting();
    drop(manager);

    if broadcasting {
        let _ = app_handle.emit("presence-updated", &updated);
    }

    Ok(updated)
}

#[tauri::command]
pub fn clear_presence(app_handle: AppHandle) -> Result<(), String> {
    let mut manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.clear_presence();
    let broadcasting = manager.is_broadcasting();
    drop(manager);

    if broadcasting {
        let _ = app_handle.emit("presence-updated", Option::<GamePresenceState>::None);
    }

    Ok(())
}

#[tauri::command]
pub fn get_current_presence() -> Result<Option<GamePresenceState>, String> {
    let manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.get_current_presence())
}

#[tauri::command]
pub fn get_friend_presence(friend_id: String) -> Result<FriendPresence, String> {
    let manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.get_friend_presence(&friend_id))
}

#[tauri::command]
pub fn join_game(app_handle: AppHandle, game_id: String, party_id: Option<String>) -> Result<(), String> {
    let _ = app_handle.emit("game-joined", serde_json::json!({
        "game_id": game_id,
        "party_id": party_id,
    }));
    Ok(())
}

#[tauri::command]
pub fn spectate_game(app_handle: AppHandle, game_id: String) -> Result<(), String> {
    let _ = app_handle.emit("game-spectated", serde_json::json!({
        "game_id": game_id,
    }));
    Ok(())
}

#[tauri::command]
pub fn set_presence_broadcasting(enabled: bool) -> Result<(), String> {
    let mut manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.set_broadcasting(enabled);
    Ok(())
}

#[tauri::command]
pub fn get_all_friend_presences() -> Result<Vec<FriendPresence>, String> {
    let manager = PRESENCE_MANAGER.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.get_all_friend_presences())
}

// For use by other Rust modules (e.g., game_detection can auto-update presence)
pub fn update_presence_from_detection(game_id: &str, game_name: &str) {
    if let Ok(mut manager) = PRESENCE_MANAGER.lock() {
        if manager.is_broadcasting() {
            manager.update_presence(GamePresenceState {
                game_id: game_id.to_string(),
                game_name: game_name.to_string(),
                state: "Playing".to_string(),
                details: String::new(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                party_info: None,
                metadata: None,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_presence() {
        let mut manager = RichPresenceManager::new();
        let state = GamePresenceState {
            game_id: "730".to_string(),
            game_name: "Counter-Strike 2".to_string(),
            state: "Playing".to_string(),
            details: "Competitive - Dust2".to_string(),
            timestamp: 0,
            party_info: None,
            metadata: None,
        };

        let updated = manager.update_presence(state);
        assert!(updated.timestamp > 0);
        assert_eq!(updated.game_name, "Counter-Strike 2");

        let current = manager.get_current_presence();
        assert!(current.is_some());
        assert_eq!(current.unwrap().game_id, "730");
    }

    #[test]
    fn test_clear_presence() {
        let mut manager = RichPresenceManager::new();
        let state = GamePresenceState {
            game_id: "730".to_string(),
            game_name: "CS2".to_string(),
            state: "Playing".to_string(),
            details: String::new(),
            timestamp: 1000,
            party_info: None,
            metadata: None,
        };

        manager.update_presence(state);
        assert!(manager.get_current_presence().is_some());

        manager.clear_presence();
        assert!(manager.get_current_presence().is_none());
    }

    #[test]
    fn test_friend_presence() {
        let mut manager = RichPresenceManager::new();

        // Unknown friend returns default
        let friend = manager.get_friend_presence("user123");
        assert_eq!(friend.friend_id, "user123");
        assert!(friend.presence.is_none());
        assert!(!friend.is_online);

        // Update friend presence
        let game_state = GamePresenceState {
            game_id: "570".to_string(),
            game_name: "Dota 2".to_string(),
            state: "In Game".to_string(),
            details: "Ranked Match".to_string(),
            timestamp: 1000,
            party_info: Some(PartyInfo {
                party_id: "party_abc".to_string(),
                party_size: 3,
                party_max: 5,
            }),
            metadata: None,
        };

        manager.update_friend_presence("user123".to_string(), Some(game_state), true);

        let friend = manager.get_friend_presence("user123");
        assert!(friend.is_online);
        assert!(friend.presence.is_some());
        let presence = friend.presence.unwrap();
        assert_eq!(presence.game_name, "Dota 2");
        assert!(presence.party_info.is_some());
        assert_eq!(presence.party_info.unwrap().party_size, 3);
    }

    #[test]
    fn test_broadcasting_toggle() {
        let mut manager = RichPresenceManager::new();
        assert!(!manager.is_broadcasting());

        manager.set_broadcasting(true);
        assert!(manager.is_broadcasting());

        manager.set_broadcasting(false);
        assert!(!manager.is_broadcasting());
    }

    #[test]
    fn test_get_all_friend_presences() {
        let mut manager = RichPresenceManager::new();

        manager.update_friend_presence("user1".to_string(), None, true);
        manager.update_friend_presence("user2".to_string(), None, false);

        let all = manager.get_all_friend_presences();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_presence_with_metadata() {
        let mut manager = RichPresenceManager::new();
        let mut metadata = HashMap::new();
        metadata.insert("map".to_string(), "de_dust2".to_string());
        metadata.insert("mode".to_string(), "competitive".to_string());

        let state = GamePresenceState {
            game_id: "730".to_string(),
            game_name: "CS2".to_string(),
            state: "Playing".to_string(),
            details: "Competitive".to_string(),
            timestamp: 1000,
            party_info: None,
            metadata: Some(metadata),
        };

        let updated = manager.update_presence(state);
        let meta = updated.metadata.unwrap();
        assert_eq!(meta.get("map").unwrap(), "de_dust2");
        assert_eq!(meta.get("mode").unwrap(), "competitive");
    }
}
