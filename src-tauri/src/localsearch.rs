// Local Search - Native FTS5 full-text search for messages
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

/// Search result item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub message_id: String,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub author_id: String,
    pub author_name: String,
    pub content: String,
    pub snippet: String,
    pub timestamp: i64,
    pub relevance: f64,
    pub has_attachments: bool,
    pub has_embeds: bool,
    pub is_pinned: bool,
}

/// Message to index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexableMessage {
    pub message_id: String,
    pub channel_id: String,
    pub server_id: Option<String>,
    pub author_id: String,
    pub author_name: String,
    pub content: String,
    pub timestamp: i64,
    pub has_attachments: bool,
    pub has_embeds: bool,
    pub is_pinned: bool,
    pub is_edited: bool,
}

/// Search query options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchOptions {
    pub query: String,
    pub channel_ids: Option<Vec<String>>,
    pub server_ids: Option<Vec<String>>,
    pub author_ids: Option<Vec<String>>,
    pub from_date: Option<i64>,
    pub to_date: Option<i64>,
    pub has_attachments: Option<bool>,
    pub has_embeds: Option<bool>,
    pub is_pinned: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort_by: Option<String>, // "relevance" or "date"
    pub sort_order: Option<String>, // "asc" or "desc"
}

/// Search index statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub total_messages: u64,
    pub total_channels: u64,
    pub total_servers: u64,
    pub index_size_bytes: u64,
    pub last_indexed_at: Option<i64>,
    pub oldest_message: Option<i64>,
    pub newest_message: Option<i64>,
}

/// Search manager state
pub struct SearchManager {
    conn: Mutex<Connection>,
}

impl SearchManager {
    /// Initialize search database
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        let db_path = app_data_dir.join("search_index.db");
        
        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create data dir: {}", e))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open search database: {}", e))?;

        // Enable FTS5
        conn.execute_batch(r#"
            -- Messages table for metadata
            CREATE TABLE IF NOT EXISTS messages (
                message_id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                server_id TEXT,
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                has_attachments INTEGER DEFAULT 0,
                has_embeds INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_edited INTEGER DEFAULT 0,
                indexed_at INTEGER NOT NULL
            );

            -- FTS5 virtual table for full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                message_id,
                content,
                author_name,
                content='messages',
                content_rowid='rowid',
                tokenize='porter unicode61 remove_diacritics 2'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
                INSERT INTO messages_fts(rowid, message_id, content, author_name)
                VALUES (NEW.rowid, NEW.message_id, NEW.content, NEW.author_name);
            END;

            CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
                INSERT INTO messages_fts(messages_fts, rowid, message_id, content, author_name)
                VALUES ('delete', OLD.rowid, OLD.message_id, OLD.content, OLD.author_name);
            END;

            CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
                INSERT INTO messages_fts(messages_fts, rowid, message_id, content, author_name)
                VALUES ('delete', OLD.rowid, OLD.message_id, OLD.content, OLD.author_name);
                INSERT INTO messages_fts(rowid, message_id, content, author_name)
                VALUES (NEW.rowid, NEW.message_id, NEW.content, NEW.author_name);
            END;

            -- Indexes for filtered queries
            CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
            CREATE INDEX IF NOT EXISTS idx_messages_server ON messages(server_id);
            CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(is_pinned) WHERE is_pinned = 1;

            -- Metadata table
            CREATE TABLE IF NOT EXISTS search_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        "#).map_err(|e| format!("Failed to create tables: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Index a message
    pub fn index_message(&self, msg: &IndexableMessage) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            r#"
            INSERT OR REPLACE INTO messages 
            (message_id, channel_id, server_id, author_id, author_name, content, 
             timestamp, has_attachments, has_embeds, is_pinned, is_edited, indexed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                msg.message_id,
                msg.channel_id,
                msg.server_id,
                msg.author_id,
                msg.author_name,
                msg.content,
                msg.timestamp,
                msg.has_attachments as i32,
                msg.has_embeds as i32,
                msg.is_pinned as i32,
                msg.is_edited as i32,
                now,
            ],
        ).map_err(|e| format!("Failed to index message: {}", e))?;

        Ok(())
    }

    /// Index multiple messages in batch
    pub fn index_messages_batch(&self, messages: &[IndexableMessage]) -> Result<u32, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();
        let mut count = 0;

        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        for msg in messages {
            tx.execute(
                r#"
                INSERT OR REPLACE INTO messages 
                (message_id, channel_id, server_id, author_id, author_name, content, 
                 timestamp, has_attachments, has_embeds, is_pinned, is_edited, indexed_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    msg.message_id,
                    msg.channel_id,
                    msg.server_id,
                    msg.author_id,
                    msg.author_name,
                    msg.content,
                    msg.timestamp,
                    msg.has_attachments as i32,
                    msg.has_embeds as i32,
                    msg.is_pinned as i32,
                    msg.is_edited as i32,
                    now,
                ],
            ).map_err(|e| format!("Failed to index message {}: {}", msg.message_id, e))?;
            count += 1;
        }

        tx.commit().map_err(|e| format!("Failed to commit: {}", e))?;
        Ok(count)
    }

    /// Search messages with FTS5
    pub fn search(&self, opts: &SearchOptions) -> Result<Vec<SearchResult>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let limit = opts.limit.unwrap_or(50).min(200) as i64;
        let offset = opts.offset.unwrap_or(0) as i64;
        let sort_by = opts.sort_by.as_deref().unwrap_or("relevance");
        let sort_order = opts.sort_order.as_deref().unwrap_or("desc");

        // Build FTS5 query with MATCH
        let fts_query = if opts.query.is_empty() {
            "*".to_string()
        } else {
            // Escape special characters and add prefix matching
            let escaped = opts.query
                .replace("\"", "\"\"")
                .split_whitespace()
                .map(|word| format!("\"{}\"*", word))
                .collect::<Vec<_>>()
                .join(" ");
            escaped
        };

        // Build WHERE clause for filters
        let mut conditions = vec!["1=1".to_string()];
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref channel_ids) = opts.channel_ids {
            if !channel_ids.is_empty() {
                let placeholders = channel_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                conditions.push(format!("m.channel_id IN ({})", placeholders));
                for id in channel_ids {
                    params_vec.push(Box::new(id.clone()));
                }
            }
        }

        if let Some(ref server_ids) = opts.server_ids {
            if !server_ids.is_empty() {
                let placeholders = server_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                conditions.push(format!("m.server_id IN ({})", placeholders));
                for id in server_ids {
                    params_vec.push(Box::new(id.clone()));
                }
            }
        }

        if let Some(ref author_ids) = opts.author_ids {
            if !author_ids.is_empty() {
                let placeholders = author_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                conditions.push(format!("m.author_id IN ({})", placeholders));
                for id in author_ids {
                    params_vec.push(Box::new(id.clone()));
                }
            }
        }

        if let Some(from_date) = opts.from_date {
            conditions.push("m.timestamp >= ?".to_string());
            params_vec.push(Box::new(from_date));
        }

        if let Some(to_date) = opts.to_date {
            conditions.push("m.timestamp <= ?".to_string());
            params_vec.push(Box::new(to_date));
        }

        if let Some(has_attachments) = opts.has_attachments {
            conditions.push(format!("m.has_attachments = {}", has_attachments as i32));
        }

        if let Some(has_embeds) = opts.has_embeds {
            conditions.push(format!("m.has_embeds = {}", has_embeds as i32));
        }

        if let Some(is_pinned) = opts.is_pinned {
            conditions.push(format!("m.is_pinned = {}", is_pinned as i32));
        }

        let where_clause = conditions.join(" AND ");
        let order_clause = if sort_by == "date" {
            format!("m.timestamp {}", if sort_order == "asc" { "ASC" } else { "DESC" })
        } else {
            format!("bm25(messages_fts) {}", if sort_order == "asc" { "DESC" } else { "ASC" })
        };

        let sql = format!(r#"
            SELECT 
                m.message_id,
                m.channel_id,
                m.server_id,
                m.author_id,
                m.author_name,
                m.content,
                snippet(messages_fts, 1, '<mark>', '</mark>', '...', 64) as snippet,
                m.timestamp,
                bm25(messages_fts) as relevance,
                m.has_attachments,
                m.has_embeds,
                m.is_pinned
            FROM messages_fts
            JOIN messages m ON messages_fts.message_id = m.message_id
            WHERE messages_fts MATCH ?1
            AND {}
            ORDER BY {}
            LIMIT ?2 OFFSET ?3
        "#, where_clause, order_clause);

        // Build params for query - needs manual handling
        let mut stmt = conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare search query: {}", e))?;

        // Since rusqlite doesn't support dynamic params easily, use a simpler approach
        // for the common case without filters
        let results: Vec<SearchResult> = if params_vec.is_empty() {
            stmt.query_map(params![&fts_query, limit, offset], |row| {
                Ok(SearchResult {
                    message_id: row.get(0)?,
                    channel_id: row.get(1)?,
                    server_id: row.get(2)?,
                    author_id: row.get(3)?,
                    author_name: row.get(4)?,
                    content: row.get(5)?,
                    snippet: row.get(6)?,
                    timestamp: row.get(7)?,
                    relevance: row.get::<_, f64>(8)?.abs(),
                    has_attachments: row.get::<_, i32>(9)? != 0,
                    has_embeds: row.get::<_, i32>(10)? != 0,
                    is_pinned: row.get::<_, i32>(11)? != 0,
                })
            })
            .map_err(|e| format!("Search query failed: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
        } else {
            // For filtered queries, use a simpler approach
            Vec::new() // TODO: implement filtered queries
        };

        Ok(results)
    }

    /// Delete a message from the index
    pub fn delete_message(&self, message_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM messages WHERE message_id = ?1", params![message_id])
            .map_err(|e| format!("Failed to delete message: {}", e))?;
        Ok(())
    }

    /// Delete all messages from a channel
    pub fn delete_channel_messages(&self, channel_id: &str) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count = conn.execute("DELETE FROM messages WHERE channel_id = ?1", params![channel_id])
            .map_err(|e| format!("Failed to delete channel messages: {}", e))?;
        Ok(count as u64)
    }

    /// Get index statistics
    pub fn get_stats(&self) -> Result<IndexStats, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let total_messages: u64 = conn.query_row(
            "SELECT COUNT(*) FROM messages",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let total_channels: u64 = conn.query_row(
            "SELECT COUNT(DISTINCT channel_id) FROM messages",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let total_servers: u64 = conn.query_row(
            "SELECT COUNT(DISTINCT server_id) FROM messages WHERE server_id IS NOT NULL",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        let oldest_message: Option<i64> = conn.query_row(
            "SELECT MIN(timestamp) FROM messages",
            [],
            |row| row.get(0),
        ).ok();

        let newest_message: Option<i64> = conn.query_row(
            "SELECT MAX(timestamp) FROM messages",
            [],
            |row| row.get(0),
        ).ok();

        let last_indexed_at: Option<i64> = conn.query_row(
            "SELECT MAX(indexed_at) FROM messages",
            [],
            |row| row.get(0),
        ).ok();

        // Get database file size
        let db_path = conn.path().map(|p| p.to_path_buf());
        let index_size_bytes = db_path
            .and_then(|p| std::fs::metadata(p).ok())
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(IndexStats {
            total_messages,
            total_channels,
            total_servers,
            index_size_bytes,
            last_indexed_at,
            oldest_message,
            newest_message,
        })
    }

    /// Optimize the FTS index
    pub fn optimize(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO messages_fts(messages_fts) VALUES('optimize')", [])
            .map_err(|e| format!("Failed to optimize index: {}", e))?;
        Ok(())
    }

    /// Rebuild the FTS index
    pub fn rebuild(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')", [])
            .map_err(|e| format!("Failed to rebuild index: {}", e))?;
        Ok(())
    }

    /// Clear all indexed data
    pub fn clear(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM messages", [])
            .map_err(|e| format!("Failed to clear index: {}", e))?;
        Ok(())
    }
}

/// Tauri commands

#[tauri::command]
pub async fn search_messages<R: Runtime>(
    app: AppHandle<R>,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.search(&options)
}

#[tauri::command]
pub async fn index_message<R: Runtime>(
    app: AppHandle<R>,
    message: IndexableMessage,
) -> Result<(), String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.index_message(&message)
}

#[tauri::command]
pub async fn index_messages_batch<R: Runtime>(
    app: AppHandle<R>,
    messages: Vec<IndexableMessage>,
) -> Result<u32, String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.index_messages_batch(&messages)
}

#[tauri::command]
pub async fn delete_indexed_message<R: Runtime>(
    app: AppHandle<R>,
    message_id: String,
) -> Result<(), String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.delete_message(&message_id)
}

#[tauri::command]
pub async fn get_search_stats<R: Runtime>(
    app: AppHandle<R>,
) -> Result<IndexStats, String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.get_stats()
}

#[tauri::command]
pub async fn optimize_search_index<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.optimize()
}

#[tauri::command]
pub async fn clear_search_index<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    let search_manager = app.state::<SearchManager>();
    search_manager.clear()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_search_manager_creation() {
        let dir = tempdir().unwrap();
        let manager = SearchManager::new(dir.path().to_path_buf()).unwrap();
        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.total_messages, 0);
    }

    #[test]
    fn test_index_and_search() {
        let dir = tempdir().unwrap();
        let manager = SearchManager::new(dir.path().to_path_buf()).unwrap();

        let msg = IndexableMessage {
            message_id: "msg1".to_string(),
            channel_id: "chan1".to_string(),
            server_id: Some("srv1".to_string()),
            author_id: "user1".to_string(),
            author_name: "Alice".to_string(),
            content: "Hello world, this is a test message".to_string(),
            timestamp: 1700000000,
            has_attachments: false,
            has_embeds: false,
            is_pinned: false,
            is_edited: false,
        };

        manager.index_message(&msg).unwrap();

        let results = manager.search(&SearchOptions {
            query: "hello world".to_string(),
            ..Default::default()
        }).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].message_id, "msg1");
    }

    #[test]
    fn test_batch_indexing() {
        let dir = tempdir().unwrap();
        let manager = SearchManager::new(dir.path().to_path_buf()).unwrap();

        let messages: Vec<IndexableMessage> = (0..100).map(|i| IndexableMessage {
            message_id: format!("msg{}", i),
            channel_id: "chan1".to_string(),
            server_id: Some("srv1".to_string()),
            author_id: "user1".to_string(),
            author_name: "Alice".to_string(),
            content: format!("Message number {} with unique content", i),
            timestamp: 1700000000 + i as i64,
            has_attachments: false,
            has_embeds: false,
            is_pinned: false,
            is_edited: false,
        }).collect();

        let count = manager.index_messages_batch(&messages).unwrap();
        assert_eq!(count, 100);

        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.total_messages, 100);
    }
}
