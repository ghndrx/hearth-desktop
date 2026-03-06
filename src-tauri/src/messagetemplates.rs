//! Message Templates - Reusable message templates with variable substitution
//!
//! Provides:
//! - Create, update, delete message templates
//! - Variable substitution (e.g., {{name}}, {{date}}, {{channel}})
//! - Category-based organization (greeting, announcement, response, custom)
//! - Usage tracking (use_count, last_used)
//! - Search by name/content
//! - Import/export templates

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TemplateCategory {
    Greeting,
    Announcement,
    Response,
    Custom,
}

impl TemplateCategory {
    fn as_str(&self) -> &'static str {
        match self {
            TemplateCategory::Greeting => "greeting",
            TemplateCategory::Announcement => "announcement",
            TemplateCategory::Response => "response",
            TemplateCategory::Custom => "custom",
        }
    }

    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "greeting" => TemplateCategory::Greeting,
            "announcement" => TemplateCategory::Announcement,
            "response" => TemplateCategory::Response,
            _ => TemplateCategory::Custom,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageTemplate {
    pub id: String,
    pub name: String,
    pub content: String,
    pub category: TemplateCategory,
    pub variables: Vec<String>,
    pub use_count: u32,
    pub last_used: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct MessageTemplateManager {
    db: Mutex<rusqlite::Connection>,
}

impl MessageTemplateManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("message_templates.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS message_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'custom',
                variables TEXT NOT NULL DEFAULT '[]',
                use_count INTEGER NOT NULL DEFAULT 0,
                last_used TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);
            CREATE INDEX IF NOT EXISTS idx_templates_use_count ON message_templates(use_count DESC);
            CREATE INDEX IF NOT EXISTS idx_templates_name ON message_templates(name);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }
}

fn row_to_template(row: &rusqlite::Row) -> rusqlite::Result<MessageTemplate> {
    let category_str: String = row.get(3)?;
    let variables_str: String = row.get(4)?;
    let variables: Vec<String> = serde_json::from_str(&variables_str).unwrap_or_default();

    Ok(MessageTemplate {
        id: row.get(0)?,
        name: row.get(1)?,
        content: row.get(2)?,
        category: TemplateCategory::from_str(&category_str),
        variables,
        use_count: row.get(5)?,
        last_used: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

const SELECT_COLS: &str =
    "id, name, content, category, variables, use_count, last_used, created_at, updated_at";

#[tauri::command]
pub fn template_create(
    app: AppHandle,
    state: State<'_, MessageTemplateManager>,
    name: String,
    content: String,
    category: Option<String>,
    variables: Option<Vec<String>>,
) -> Result<MessageTemplate, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let cat = category
        .map(|c| TemplateCategory::from_str(&c))
        .unwrap_or(TemplateCategory::Custom);
    let vars = variables.unwrap_or_default();
    let vars_json = serde_json::to_string(&vars).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO message_templates (id, name, content, category, variables, use_count, last_used, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, ?7)",
        rusqlite::params![id, name, content, cat.as_str(), vars_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    let template = MessageTemplate {
        id,
        name,
        content,
        category: cat,
        variables: vars,
        use_count: 0,
        last_used: None,
        created_at: now.clone(),
        updated_at: now,
    };

    let _ = app.emit("template:created", &template);
    Ok(template)
}

#[tauri::command]
pub fn template_update(
    app: AppHandle,
    state: State<'_, MessageTemplateManager>,
    id: String,
    name: Option<String>,
    content: Option<String>,
    category: Option<String>,
    variables: Option<Vec<String>>,
) -> Result<MessageTemplate, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Fetch current template
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates WHERE id = ?1",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let mut template = stmt
        .query_row(rusqlite::params![id], row_to_template)
        .map_err(|e| format!("Template not found: {}", e))?;

    if let Some(n) = name {
        template.name = n;
    }
    if let Some(c) = content {
        template.content = c;
    }
    if let Some(cat) = category {
        template.category = TemplateCategory::from_str(&cat);
    }
    if let Some(v) = variables {
        template.variables = v;
    }
    template.updated_at = now;

    let vars_json = serde_json::to_string(&template.variables).map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE message_templates SET name = ?1, content = ?2, category = ?3, variables = ?4, updated_at = ?5 WHERE id = ?6",
        rusqlite::params![
            template.name,
            template.content,
            template.category.as_str(),
            vars_json,
            template.updated_at,
            template.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    let _ = app.emit("template:updated", &template);
    Ok(template)
}

#[tauri::command]
pub fn template_delete(
    app: AppHandle,
    state: State<'_, MessageTemplateManager>,
    id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "DELETE FROM message_templates WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected > 0 {
        let _ = app.emit("template:deleted", &id);
    }
    Ok(affected > 0)
}

#[tauri::command]
pub fn template_get_all(
    state: State<'_, MessageTemplateManager>,
) -> Result<Vec<MessageTemplate>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates ORDER BY updated_at DESC",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], row_to_template)
        .map_err(|e| e.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|e| e.to_string())?);
    }
    Ok(templates)
}

#[tauri::command]
pub fn template_get_by_category(
    state: State<'_, MessageTemplateManager>,
    category: String,
) -> Result<Vec<MessageTemplate>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let cat = TemplateCategory::from_str(&category);

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates WHERE category = ?1 ORDER BY updated_at DESC",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![cat.as_str()], row_to_template)
        .map_err(|e| e.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|e| e.to_string())?);
    }
    Ok(templates)
}

#[tauri::command]
pub fn template_search(
    state: State<'_, MessageTemplateManager>,
    query: String,
) -> Result<Vec<MessageTemplate>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates WHERE name LIKE ?1 OR content LIKE ?1 ORDER BY use_count DESC, updated_at DESC LIMIT 50",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![pattern], row_to_template)
        .map_err(|e| e.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|e| e.to_string())?);
    }
    Ok(templates)
}

#[tauri::command]
pub fn template_apply(
    state: State<'_, MessageTemplateManager>,
    id: String,
    variables_map: HashMap<String, String>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let content: String = db
        .query_row(
            "SELECT content FROM message_templates WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Template not found: {}", e))?;

    let mut result = content;
    for (key, value) in &variables_map {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }
    Ok(result)
}

#[tauri::command]
pub fn template_record_use(
    app: AppHandle,
    state: State<'_, MessageTemplateManager>,
    id: String,
) -> Result<MessageTemplate, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    db.execute(
        "UPDATE message_templates SET use_count = use_count + 1, last_used = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates WHERE id = ?1",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let template = stmt
        .query_row(rusqlite::params![id], row_to_template)
        .map_err(|e| format!("Template not found: {}", e))?;

    let _ = app.emit("template:used", &template);
    Ok(template)
}

#[tauri::command]
pub fn template_get_frequent(
    state: State<'_, MessageTemplateManager>,
    limit: Option<usize>,
) -> Result<Vec<MessageTemplate>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(10);

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates WHERE use_count > 0 ORDER BY use_count DESC LIMIT ?1",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![limit], row_to_template)
        .map_err(|e| e.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|e| e.to_string())?);
    }
    Ok(templates)
}

#[tauri::command]
pub fn template_export(
    state: State<'_, MessageTemplateManager>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM message_templates ORDER BY name ASC",
            SELECT_COLS
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], row_to_template)
        .map_err(|e| e.to_string())?;

    let mut templates = Vec::new();
    for row in rows {
        templates.push(row.map_err(|e| e.to_string())?);
    }

    serde_json::to_string_pretty(&templates).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn template_import(
    app: AppHandle,
    state: State<'_, MessageTemplateManager>,
    json_data: String,
) -> Result<usize, String> {
    let templates: Vec<MessageTemplate> =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid JSON: {}", e))?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let mut count = 0;

    for t in &templates {
        let new_id = uuid::Uuid::new_v4().to_string();
        let vars_json = serde_json::to_string(&t.variables).map_err(|e| e.to_string())?;

        db.execute(
            "INSERT INTO message_templates (id, name, content, category, variables, use_count, last_used, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, ?7)",
            rusqlite::params![
                new_id,
                t.name,
                t.content,
                t.category.as_str(),
                vars_json,
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    let _ = app.emit("template:imported", count);
    Ok(count)
}
