use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub user_id: String,
    pub content: String,
    pub message_type: String, // 'text', 'system', 'file'
    pub reply_to: Option<String>,
    pub edited_at: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageReaction {
    pub id: String,
    pub message_id: String,
    pub user_id: String,
    pub emoji: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageAttachment {
    pub id: String,
    pub message_id: String,
    pub filename: String,
    pub url: String,
    pub size: i64,
    pub mime_type: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectMessage {
    pub id: String,
    pub participants: String, // JSON array of user IDs
    pub last_message_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Channel {
    pub id: String,
    pub server_id: String,
    pub name: String,
    pub topic: Option<String>,
    pub channel_type: String, // 'text' | 'voice'
    pub position: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub owner_id: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        // Initial schema migration
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: r#"
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    channel_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    message_type TEXT NOT NULL DEFAULT 'text',
                    reply_to TEXT,
                    edited_at TEXT,
                    deleted_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS message_reactions (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    emoji TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                    UNIQUE(message_id, user_id, emoji)
                );

                CREATE TABLE IF NOT EXISTS message_attachments (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    url TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    mime_type TEXT NOT NULL,
                    width INTEGER,
                    height INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS direct_messages (
                    id TEXT PRIMARY KEY,
                    participants TEXT NOT NULL, -- JSON array of user IDs
                    last_message_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                -- Indexes for performance
                CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages (channel_id);
                CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id);
                CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
                CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions (message_id);
                CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments (message_id);
                CREATE INDEX IF NOT EXISTS idx_direct_messages_participants ON direct_messages (participants);
            "#,
            kind: MigrationKind::Up,
        },
        // Migration 2: Add servers and channels tables
        Migration {
            version: 2,
            description: "add_servers_and_channels_tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT,
                    owner_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS channels (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    topic TEXT,
                    channel_type TEXT NOT NULL DEFAULT 'text',
                    position INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels (server_id);
                CREATE INDEX IF NOT EXISTS idx_channels_position ON channels (server_id, position);
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[tauri::command]
pub async fn db_get_messages(
    app: tauri::AppHandle,
    channel_id: String,
    limit: Option<i32>,
    before: Option<String>,
) -> Result<Vec<Message>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let limit = limit.unwrap_or(50);
    let sql = if let Some(before_id) = before {
        r#"
            SELECT id, channel_id, user_id, content, message_type, reply_to,
                   edited_at, deleted_at, created_at, updated_at
            FROM messages
            WHERE channel_id = ? AND id < ? AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ?
        "#
    } else {
        r#"
            SELECT id, channel_id, user_id, content, message_type, reply_to,
                   edited_at, deleted_at, created_at, updated_at
            FROM messages
            WHERE channel_id = ? AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ?
        "#
    };

    let result = if let Some(before_id) = before {
        db.select(sql)
            .bind(&channel_id)?
            .bind(&before_id)?
            .bind(limit)?
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    } else {
        db.select(sql)
            .bind(&channel_id)?
            .bind(limit)?
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    };

    Ok(result)
}

#[tauri::command]
pub async fn db_save_message(
    app: tauri::AppHandle,
    message: Message,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            INSERT OR REPLACE INTO messages
            (id, channel_id, user_id, content, message_type, reply_to, edited_at, deleted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&message.id)?
    .bind(&message.channel_id)?
    .bind(&message.user_id)?
    .bind(&message.content)?
    .bind(&message.message_type)?
    .bind(&message.reply_to)?
    .bind(&message.edited_at)?
    .bind(&message.deleted_at)?
    .bind(&message.created_at)?
    .bind(&message.updated_at)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to save message: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_update_message(
    app: tauri::AppHandle,
    message_id: String,
    content: String,
    updated_at: String,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            UPDATE messages
            SET content = ?, updated_at = ?, edited_at = ?
            WHERE id = ?
        "#,
    )
    .bind(&content)?
    .bind(&updated_at)?
    .bind(&updated_at)?
    .bind(&message_id)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to update message: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_delete_message(
    app: tauri::AppHandle,
    message_id: String,
    deleted_at: String,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            UPDATE messages
            SET deleted_at = ?
            WHERE id = ?
        "#,
    )
    .bind(&deleted_at)?
    .bind(&message_id)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to delete message: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_search_messages(
    app: tauri::AppHandle,
    query: String,
    channel_id: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<Message>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let limit = limit.unwrap_or(50);
    let sql = if let Some(channel_id) = channel_id {
        r#"
            SELECT id, channel_id, user_id, content, message_type, reply_to,
                   edited_at, deleted_at, created_at, updated_at
            FROM messages
            WHERE channel_id = ? AND content LIKE ? AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ?
        "#
    } else {
        r#"
            SELECT id, channel_id, user_id, content, message_type, reply_to,
                   edited_at, deleted_at, created_at, updated_at
            FROM messages
            WHERE content LIKE ? AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ?
        "#
    };

    let search_query = format!("%{}%", query);
    let result = if let Some(channel_id) = channel_id {
        db.select(sql)
            .bind(&channel_id)?
            .bind(&search_query)?
            .bind(limit)?
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    } else {
        db.select(sql)
            .bind(&search_query)?
            .bind(limit)?
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    };

    Ok(result)
}

#[tauri::command]
pub async fn db_get_direct_messages(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<Vec<DirectMessage>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let result = db
        .select(
            r#"
                SELECT id, participants, last_message_id, created_at, updated_at
                FROM direct_messages
                WHERE participants LIKE ?
                ORDER BY updated_at DESC
            "#,
        )
        .bind(format!("%{}%", user_id))?
        .fetch()
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    Ok(result)
}

// ============ Channel Commands ============

#[tauri::command]
pub async fn db_get_channels(
    app: tauri::AppHandle,
    server_id: Option<String>,
) -> Result<Vec<Channel>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let sql = if let Some(server_id) = server_id {
        r#"
            SELECT id, server_id, name, topic, channel_type, position, created_at, updated_at
            FROM channels
            WHERE server_id = ?
            ORDER BY position ASC
        "#
    } else {
        r#"
            SELECT id, server_id, name, topic, channel_type, position, created_at, updated_at
            FROM channels
            ORDER BY server_id, position ASC
        "#
    };

    let result = if let Some(server_id) = server_id {
        db.select(sql)
            .bind(&server_id)?
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    } else {
        db.select(sql)
            .fetch()
            .await
            .map_err(|e| format!("Database query failed: {}", e))?
    };

    Ok(result)
}

#[tauri::command]
pub async fn db_get_channel(
    app: tauri::AppHandle,
    channel_id: String,
) -> Result<Option<Channel>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let result = db
        .select(
            r#"
                SELECT id, server_id, name, topic, channel_type, position, created_at, updated_at
                FROM channels
                WHERE id = ?
            "#,
        )
        .bind(&channel_id)?
        .fetch()
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    Ok(result.into_iter().next())
}

#[tauri::command]
pub async fn db_save_channel(
    app: tauri::AppHandle,
    channel: Channel,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            INSERT OR REPLACE INTO channels
            (id, server_id, name, topic, channel_type, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&channel.id)?
    .bind(&channel.server_id)?
    .bind(&channel.name)?
    .bind(&channel.topic)?
    .bind(&channel.channel_type)?
    .bind(&channel.position)?
    .bind(&channel.created_at)?
    .bind(&channel.updated_at)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to save channel: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_update_channel(
    app: tauri::AppHandle,
    channel_id: String,
    name: Option<String>,
    topic: Option<String>,
    position: Option<i32>,
    updated_at: String,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    // Build dynamic update query
    let mut updates = Vec::new();

    if name.is_some() {
        updates.push("name = ?");
    }
    if topic.is_some() {
        updates.push("topic = ?");
    }
    if position.is_some() {
        updates.push("position = ?");
    }
    updates.push("updated_at = ?");

    let sql = format!("UPDATE channels SET {} WHERE id = ?", updates.join(", "));

    let mut query = db.execute(&sql);
    if let Some(ref n) = name {
        query = query.bind(n)?;
    }
    if let Some(ref t) = topic {
        query = query.bind(t)?;
    }
    if let Some(p) = position {
        query = query.bind(p)?;
    }
    query = query.bind(&updated_at)?.bind(&channel_id)?.fetch()
        .await
        .map_err(|e| format!("Failed to update channel: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_delete_channel(
    app: tauri::AppHandle,
    channel_id: String,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            DELETE FROM channels WHERE id = ?
        "#,
    )
    .bind(&channel_id)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to delete channel: {}", e))?;

    Ok(())
}

// ============ Server Commands ============

#[tauri::command]
pub async fn db_get_servers(app: tauri::AppHandle) -> Result<Vec<Server>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let result = db
        .select(
            r#"
                SELECT id, name, icon, owner_id, created_at, updated_at
                FROM servers
                ORDER BY name ASC
            "#,
        )
        .fetch()
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn db_get_server(
    app: tauri::AppHandle,
    server_id: String,
) -> Result<Option<Server>, String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    let result = db
        .select(
            r#"
                SELECT id, name, icon, owner_id, created_at, updated_at
                FROM servers
                WHERE id = ?
            "#,
        )
        .bind(&server_id)?
        .fetch()
        .await
        .map_err(|e| format!("Database query failed: {}", e))?;

    Ok(result.into_iter().next())
}

#[tauri::command]
pub async fn db_save_server(
    app: tauri::AppHandle,
    server: Server,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            INSERT OR REPLACE INTO servers
            (id, name, icon, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&server.id)?
    .bind(&server.name)?
    .bind(&server.icon)?
    .bind(&server.owner_id)?
    .bind(&server.created_at)?
    .bind(&server.updated_at)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to save server: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_delete_server(
    app: tauri::AppHandle,
    server_id: String,
) -> Result<(), String> {
    let db = app
        .db()
        .map_err(|e| format!("Failed to get database: {}", e))?;

    db.execute(
        r#"
            DELETE FROM servers WHERE id = ?
        "#,
    )
    .bind(&server_id)?
    .fetch()
    .await
    .map_err(|e| format!("Failed to delete server: {}", e))?;

    Ok(())
}