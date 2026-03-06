//! Message Bookmarks - Personal saved messages across all channels
//!
//! Provides persistent bookmark storage using SQLite so users can
//! save messages they want to revisit later, with notes and tags.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub message_id: String,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub author_name: String,
    pub author_avatar: Option<String>,
    pub content: String,
    pub note: Option<String>,
    pub tags: Vec<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBookmark {
    pub message_id: String,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub author_name: String,
    pub author_avatar: Option<String>,
    pub content: String,
    pub note: Option<String>,
    pub tags: Option<Vec<String>>,
}

pub struct BookmarkManager {
    db: Mutex<rusqlite::Connection>,
}

impl BookmarkManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("bookmarks.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                server_id TEXT,
                author_name TEXT NOT NULL,
                author_avatar TEXT,
                content TEXT NOT NULL,
                note TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_bookmarks_message ON bookmarks(message_id);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_channel ON bookmarks(channel_id);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);",
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
pub fn bookmark_add(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
    data: CreateBookmark,
) -> Result<Bookmark, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let tags = data.tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;
    let created_at = now_ms();

    db.execute(
        "INSERT INTO bookmarks (id, message_id, channel_id, server_id, author_name, author_avatar, content, note, tags, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            data.message_id,
            data.channel_id,
            data.server_id,
            data.author_name,
            data.author_avatar,
            data.content,
            data.note,
            tags_json,
            created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    let bookmark = Bookmark {
        id,
        message_id: data.message_id,
        channel_id: data.channel_id,
        server_id: data.server_id,
        author_name: data.author_name,
        author_avatar: data.author_avatar,
        content: data.content,
        note: data.note,
        tags,
        created_at,
    };

    let _ = app.emit("bookmark:added", &bookmark);
    Ok(bookmark)
}

#[tauri::command]
pub fn bookmark_remove(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
    id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute("DELETE FROM bookmarks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    if affected > 0 {
        let _ = app.emit("bookmark:removed", &id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn bookmark_remove_by_message(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
    message_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "DELETE FROM bookmarks WHERE message_id = ?1",
            rusqlite::params![message_id],
        )
        .map_err(|e| e.to_string())?;
    if affected > 0 {
        let _ = app.emit("bookmark:removed", &message_id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn bookmark_get_all(
    state: State<'_, BookmarkManager>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<Bookmark>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT id, message_id, channel_id, server_id, author_name, author_avatar, content, note, tags, created_at
             FROM bookmarks ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            let tags_str: String = row.get(8)?;
            let tags: Vec<String> =
                serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Bookmark {
                id: row.get(0)?,
                message_id: row.get(1)?,
                channel_id: row.get(2)?,
                server_id: row.get(3)?,
                author_name: row.get(4)?,
                author_avatar: row.get(5)?,
                content: row.get(6)?,
                note: row.get(7)?,
                tags,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut bookmarks = Vec::new();
    for row in rows {
        bookmarks.push(row.map_err(|e| e.to_string())?);
    }
    Ok(bookmarks)
}

#[tauri::command]
pub fn bookmark_search(
    state: State<'_, BookmarkManager>,
    query: String,
) -> Result<Vec<Bookmark>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);

    let mut stmt = db
        .prepare(
            "SELECT id, message_id, channel_id, server_id, author_name, author_avatar, content, note, tags, created_at
             FROM bookmarks
             WHERE content LIKE ?1 OR note LIKE ?1 OR author_name LIKE ?1 OR tags LIKE ?1
             ORDER BY created_at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![pattern], |row| {
            let tags_str: String = row.get(8)?;
            let tags: Vec<String> =
                serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Bookmark {
                id: row.get(0)?,
                message_id: row.get(1)?,
                channel_id: row.get(2)?,
                server_id: row.get(3)?,
                author_name: row.get(4)?,
                author_avatar: row.get(5)?,
                content: row.get(6)?,
                note: row.get(7)?,
                tags,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut bookmarks = Vec::new();
    for row in rows {
        bookmarks.push(row.map_err(|e| e.to_string())?);
    }
    Ok(bookmarks)
}

#[tauri::command]
pub fn bookmark_update_note(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
    id: String,
    note: Option<String>,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "UPDATE bookmarks SET note = ?1 WHERE id = ?2",
            rusqlite::params![note, id],
        )
        .map_err(|e| e.to_string())?;
    if affected > 0 {
        let _ = app.emit("bookmark:updated", &id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn bookmark_update_tags(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
    id: String,
    tags: Vec<String>,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "UPDATE bookmarks SET tags = ?1 WHERE id = ?2",
            rusqlite::params![tags_json, id],
        )
        .map_err(|e| e.to_string())?;
    if affected > 0 {
        let _ = app.emit("bookmark:updated", &id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn bookmark_is_bookmarked(
    state: State<'_, BookmarkManager>,
    message_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM bookmarks WHERE message_id = ?1",
            rusqlite::params![message_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command]
pub fn bookmark_get_count(state: State<'_, BookmarkManager>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM bookmarks", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count as usize)
}

#[tauri::command]
pub fn bookmark_clear_all(
    app: AppHandle,
    state: State<'_, BookmarkManager>,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM bookmarks", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM bookmarks", [])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("bookmark:cleared", count);
    Ok(count as usize)
}
