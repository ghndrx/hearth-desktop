//! Native File Indexer - SQLite FTS5 full-text search for shared files and messages
//!
//! Provides persistent file index storage using SQLite with FTS5 virtual tables
//! for instant full-text search across file names, content previews, tags, and uploaders.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFile {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: u64,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub uploader_name: String,
    pub content_preview: Option<String>,
    pub indexed_at: u64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIndexedFile {
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: u64,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub uploader_name: String,
    pub content_preview: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIndexStats {
    pub total_count: usize,
    pub total_size: u64,
    pub type_breakdown: Vec<TypeCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeCount {
    pub file_type: String,
    pub count: usize,
}

pub struct FileIndexerManager {
    db: Mutex<rusqlite::Connection>,
}

impl FileIndexerManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("fileindexer.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        Self::create_tables(&conn)?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }

    fn create_tables(conn: &rusqlite::Connection) -> Result<(), String> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS indexed_files (
                id TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                channel_id TEXT NOT NULL,
                server_id TEXT,
                uploader_name TEXT NOT NULL,
                content_preview TEXT,
                indexed_at INTEGER NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]'
            );
            CREATE INDEX IF NOT EXISTS idx_files_channel ON indexed_files(channel_id);
            CREATE INDEX IF NOT EXISTS idx_files_type ON indexed_files(file_type);
            CREATE INDEX IF NOT EXISTS idx_files_indexed ON indexed_files(indexed_at DESC);",
        )
        .map_err(|e| e.to_string())?;

        // Create FTS5 virtual table if it doesn't exist.
        // FTS5 tables don't support IF NOT EXISTS, so we check manually.
        let fts_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='indexed_files_fts'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if !fts_exists {
            conn.execute_batch(
                "CREATE VIRTUAL TABLE indexed_files_fts USING fts5(
                    id UNINDEXED,
                    file_name,
                    content_preview,
                    tags,
                    uploader_name
                );",
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn row_to_indexed_file(row: &rusqlite::Row) -> rusqlite::Result<IndexedFile> {
    let tags_str: String = row.get(10)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(IndexedFile {
        id: row.get(0)?,
        file_name: row.get(1)?,
        file_path: row.get(2)?,
        file_type: row.get(3)?,
        file_size: row.get(4)?,
        channel_id: row.get(5)?,
        server_id: row.get(6)?,
        uploader_name: row.get(7)?,
        content_preview: row.get(8)?,
        indexed_at: row.get(9)?,
        tags,
    })
}

#[tauri::command]
pub fn file_index_add(
    app: AppHandle,
    state: State<'_, FileIndexerManager>,
    data: CreateIndexedFile,
) -> Result<IndexedFile, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let tags = data.tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&tags).map_err(|e| e.to_string())?;
    let indexed_at = now_ms();

    // Truncate content_preview to 500 chars
    let content_preview = data.content_preview.map(|c| {
        if c.len() > 500 {
            c[..500].to_string()
        } else {
            c
        }
    });

    db.execute(
        "INSERT INTO indexed_files (id, file_name, file_path, file_type, file_size, channel_id, server_id, uploader_name, content_preview, indexed_at, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            id,
            data.file_name,
            data.file_path,
            data.file_type,
            data.file_size,
            data.channel_id,
            data.server_id,
            data.uploader_name,
            content_preview,
            indexed_at,
            tags_json,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Insert into FTS5 table
    db.execute(
        "INSERT INTO indexed_files_fts (id, file_name, content_preview, tags, uploader_name)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            id,
            data.file_name,
            content_preview,
            tags_json,
            data.uploader_name,
        ],
    )
    .map_err(|e| e.to_string())?;

    let file = IndexedFile {
        id,
        file_name: data.file_name,
        file_path: data.file_path,
        file_type: data.file_type,
        file_size: data.file_size,
        channel_id: data.channel_id,
        server_id: data.server_id,
        uploader_name: data.uploader_name,
        content_preview,
        indexed_at,
        tags,
    };

    let _ = app.emit("file-index:added", &file);
    Ok(file)
}

#[tauri::command]
pub fn file_index_remove(
    app: AppHandle,
    state: State<'_, FileIndexerManager>,
    id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "DELETE FROM indexed_files WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

    if affected > 0 {
        db.execute(
            "DELETE FROM indexed_files_fts WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
        let _ = app.emit("file-index:removed", &id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn file_index_search(
    state: State<'_, FileIndexerManager>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<IndexedFile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    // Use FTS5 MATCH for full-text search, joining back to main table for full data
    let mut stmt = db
        .prepare(
            "SELECT f.id, f.file_name, f.file_path, f.file_type, f.file_size,
                    f.channel_id, f.server_id, f.uploader_name, f.content_preview,
                    f.indexed_at, f.tags
             FROM indexed_files_fts fts
             JOIN indexed_files f ON f.id = fts.id
             WHERE indexed_files_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![query, limit], |row| {
            row_to_indexed_file(row)
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for row in rows {
        files.push(row.map_err(|e| e.to_string())?);
    }
    Ok(files)
}

#[tauri::command]
pub fn file_index_get_recent(
    state: State<'_, FileIndexerManager>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<IndexedFile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT id, file_name, file_path, file_type, file_size,
                    channel_id, server_id, uploader_name, content_preview,
                    indexed_at, tags
             FROM indexed_files ORDER BY indexed_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            row_to_indexed_file(row)
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for row in rows {
        files.push(row.map_err(|e| e.to_string())?);
    }
    Ok(files)
}

#[tauri::command]
pub fn file_index_get_by_channel(
    state: State<'_, FileIndexerManager>,
    channel_id: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<IndexedFile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT id, file_name, file_path, file_type, file_size,
                    channel_id, server_id, uploader_name, content_preview,
                    indexed_at, tags
             FROM indexed_files
             WHERE channel_id = ?1
             ORDER BY indexed_at DESC LIMIT ?2 OFFSET ?3",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![channel_id, limit, offset], |row| {
            row_to_indexed_file(row)
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for row in rows {
        files.push(row.map_err(|e| e.to_string())?);
    }
    Ok(files)
}

#[tauri::command]
pub fn file_index_get_by_type(
    state: State<'_, FileIndexerManager>,
    file_type: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<IndexedFile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT id, file_name, file_path, file_type, file_size,
                    channel_id, server_id, uploader_name, content_preview,
                    indexed_at, tags
             FROM indexed_files
             WHERE file_type = ?1
             ORDER BY indexed_at DESC LIMIT ?2 OFFSET ?3",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![file_type, limit, offset], |row| {
            row_to_indexed_file(row)
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for row in rows {
        files.push(row.map_err(|e| e.to_string())?);
    }
    Ok(files)
}

#[tauri::command]
pub fn file_index_get_stats(
    state: State<'_, FileIndexerManager>,
) -> Result<FileIndexStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let total_count: i64 = db
        .query_row("SELECT COUNT(*) FROM indexed_files", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_size: i64 = db
        .query_row(
            "SELECT COALESCE(SUM(file_size), 0) FROM indexed_files",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT file_type, COUNT(*) as cnt FROM indexed_files GROUP BY file_type ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TypeCount {
                file_type: row.get(0)?,
                count: row.get::<_, i64>(1)? as usize,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut type_breakdown = Vec::new();
    for row in rows {
        type_breakdown.push(row.map_err(|e| e.to_string())?);
    }

    Ok(FileIndexStats {
        total_count: total_count as usize,
        total_size: total_size as u64,
        type_breakdown,
    })
}

#[tauri::command]
pub fn file_index_clear(
    app: AppHandle,
    state: State<'_, FileIndexerManager>,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM indexed_files", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    db.execute("DELETE FROM indexed_files", [])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM indexed_files_fts", [])
        .map_err(|e| e.to_string())?;

    let _ = app.emit("file-index:cleared", count);
    Ok(count as usize)
}

#[tauri::command]
pub fn file_index_rebuild(
    app: AppHandle,
    state: State<'_, FileIndexerManager>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute_batch(
        "DROP TABLE IF EXISTS indexed_files_fts;
         DROP TABLE IF EXISTS indexed_files;",
    )
    .map_err(|e| e.to_string())?;

    FileIndexerManager::create_tables(&db)?;

    let _ = app.emit("file-index:rebuilt", ());
    Ok(())
}
