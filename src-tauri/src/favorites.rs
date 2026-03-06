//! Favorite Channels - Pin frequently used channels for quick access
//!
//! Provides persistent favorite channel storage using SQLite so users
//! can star channels and have them appear in a dedicated sidebar section.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteChannel {
    pub id: String,
    pub channel_id: String,
    pub channel_name: String,
    pub server_id: Option<String>,
    pub server_name: Option<String>,
    pub channel_type: String,
    pub position: i32,
    pub added_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddFavorite {
    pub channel_id: String,
    pub channel_name: String,
    pub server_id: Option<String>,
    pub server_name: Option<String>,
    pub channel_type: Option<String>,
}

pub struct FavoriteChannelsManager {
    db: Mutex<rusqlite::Connection>,
}

impl FavoriteChannelsManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("favorites.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS favorite_channels (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL UNIQUE,
                channel_name TEXT NOT NULL,
                server_id TEXT,
                server_name TEXT,
                channel_type TEXT NOT NULL DEFAULT 'text',
                position INTEGER NOT NULL DEFAULT 0,
                added_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_favorites_channel ON favorite_channels(channel_id);
            CREATE INDEX IF NOT EXISTS idx_favorites_position ON favorite_channels(position);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn favorites_add(
    app: AppHandle,
    state: State<'_, FavoriteChannelsManager>,
    input: AddFavorite,
) -> Result<FavoriteChannel, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Get next position
    let max_pos: i32 = db
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM favorite_channels",
            [],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    let channel_type = input.channel_type.unwrap_or_else(|| "text".to_string());

    db.execute(
        "INSERT OR REPLACE INTO favorite_channels (id, channel_id, channel_name, server_id, server_name, channel_type, position, added_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            input.channel_id,
            input.channel_name,
            input.server_id,
            input.server_name,
            channel_type,
            max_pos + 1,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    let fav = FavoriteChannel {
        id,
        channel_id: input.channel_id,
        channel_name: input.channel_name,
        server_id: input.server_id,
        server_name: input.server_name,
        channel_type,
        position: max_pos + 1,
        added_at: now,
    };

    let _ = app.emit("favorites:added", &fav);
    Ok(fav)
}

#[tauri::command]
pub fn favorites_remove(
    app: AppHandle,
    state: State<'_, FavoriteChannelsManager>,
    channel_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let deleted = db
        .execute(
            "DELETE FROM favorite_channels WHERE channel_id = ?1",
            rusqlite::params![channel_id],
        )
        .map_err(|e| e.to_string())?;

    if deleted > 0 {
        let _ = app.emit("favorites:removed", &channel_id);
    }
    Ok(deleted > 0)
}

#[tauri::command]
pub fn favorites_list(
    state: State<'_, FavoriteChannelsManager>,
) -> Result<Vec<FavoriteChannel>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, channel_id, channel_name, server_id, server_name, channel_type, position, added_at
             FROM favorite_channels ORDER BY position ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(FavoriteChannel {
                id: row.get(0)?,
                channel_id: row.get(1)?,
                channel_name: row.get(2)?,
                server_id: row.get(3)?,
                server_name: row.get(4)?,
                channel_type: row.get(5)?,
                position: row.get(6)?,
                added_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut favorites = Vec::new();
    for row in rows {
        favorites.push(row.map_err(|e| e.to_string())?);
    }
    Ok(favorites)
}

#[tauri::command]
pub fn favorites_is_favorited(
    state: State<'_, FavoriteChannelsManager>,
    channel_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM favorite_channels WHERE channel_id = ?1",
            rusqlite::params![channel_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command]
pub fn favorites_toggle(
    app: AppHandle,
    state: State<'_, FavoriteChannelsManager>,
    input: AddFavorite,
) -> Result<bool, String> {
    let is_fav = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let count: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM favorite_channels WHERE channel_id = ?1",
                rusqlite::params![input.channel_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        count > 0
    };

    if is_fav {
        favorites_remove(app, state, input.channel_id)?;
        Ok(false)
    } else {
        favorites_add(app, state, input)?;
        Ok(true)
    }
}

#[tauri::command]
pub fn favorites_reorder(
    app: AppHandle,
    state: State<'_, FavoriteChannelsManager>,
    channel_ids: Vec<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    for (i, channel_id) in channel_ids.iter().enumerate() {
        db.execute(
            "UPDATE favorite_channels SET position = ?1 WHERE channel_id = ?2",
            rusqlite::params![i as i32, channel_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let _ = app.emit("favorites:reordered", &channel_ids);
    Ok(())
}

#[tauri::command]
pub fn favorites_clear(
    app: AppHandle,
    state: State<'_, FavoriteChannelsManager>,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count = db
        .execute("DELETE FROM favorite_channels", [])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("favorites:cleared", count);
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_favorite_channel_serialization() {
        let fav = FavoriteChannel {
            id: "test-1".to_string(),
            channel_id: "ch-123".to_string(),
            channel_name: "general".to_string(),
            server_id: Some("srv-1".to_string()),
            server_name: Some("My Server".to_string()),
            channel_type: "text".to_string(),
            position: 0,
            added_at: 1700000000000,
        };

        let json = serde_json::to_string(&fav).unwrap();
        assert!(json.contains("general"));
        assert!(json.contains("ch-123"));

        let deserialized: FavoriteChannel = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.channel_id, "ch-123");
    }
}
