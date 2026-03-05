//! Kanban Task Board for Hearth Desktop
//!
//! Provides a personal task management board with:
//! - Multiple columns (e.g., To Do, In Progress, Done)
//! - Draggable task cards with title, description, priority, color
//! - Persistent state via Tauri managed state
//! - Card ordering and cross-column moves

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Priority levels for tasks
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent,
}

/// A single task card
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanCard {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: TaskPriority,
    pub color: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// A column in the board
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanColumn {
    pub id: String,
    pub title: String,
    pub cards: Vec<KanbanCard>,
    pub color: Option<String>,
}

/// The full board state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanBoardState {
    pub columns: Vec<KanbanColumn>,
}

impl Default for KanbanBoardState {
    fn default() -> Self {
        Self {
            columns: vec![
                KanbanColumn {
                    id: "todo".to_string(),
                    title: "To Do".to_string(),
                    cards: Vec::new(),
                    color: Some("#5865f2".to_string()),
                },
                KanbanColumn {
                    id: "in-progress".to_string(),
                    title: "In Progress".to_string(),
                    cards: Vec::new(),
                    color: Some("#f59e0b".to_string()),
                },
                KanbanColumn {
                    id: "done".to_string(),
                    title: "Done".to_string(),
                    cards: Vec::new(),
                    color: Some("#22c55e".to_string()),
                },
            ],
        }
    }
}

/// Managed state wrapper
pub struct KanbanManager {
    state: Mutex<KanbanBoardState>,
}

impl Default for KanbanManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(KanbanBoardState::default()),
        }
    }
}

#[tauri::command]
pub fn kanban_get_board(state: State<'_, KanbanManager>) -> Result<KanbanBoardState, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
pub fn kanban_add_card(
    state: State<'_, KanbanManager>,
    column_id: String,
    title: String,
    description: Option<String>,
    priority: Option<TaskPriority>,
    color: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<KanbanCard, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let column = s
        .columns
        .iter_mut()
        .find(|c| c.id == column_id)
        .ok_or_else(|| "Column not found".to_string())?;

    let now = Utc::now().to_rfc3339();
    let card = KanbanCard {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        description: description.unwrap_or_default(),
        priority: priority.unwrap_or(TaskPriority::Medium),
        color,
        tags: tags.unwrap_or_default(),
        created_at: now.clone(),
        updated_at: now,
    };

    let result = card.clone();
    column.cards.push(card);
    Ok(result)
}

#[tauri::command]
pub fn kanban_update_card(
    state: State<'_, KanbanManager>,
    card_id: String,
    title: Option<String>,
    description: Option<String>,
    priority: Option<TaskPriority>,
    color: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<KanbanCard, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;

    for column in s.columns.iter_mut() {
        if let Some(card) = column.cards.iter_mut().find(|c| c.id == card_id) {
            if let Some(t) = title {
                card.title = t;
            }
            if let Some(d) = description {
                card.description = d;
            }
            if let Some(p) = priority {
                card.priority = p;
            }
            if let Some(c) = color {
                card.color = Some(c);
            }
            if let Some(t) = tags {
                card.tags = t;
            }
            card.updated_at = Utc::now().to_rfc3339();
            return Ok(card.clone());
        }
    }

    Err("Card not found".to_string())
}

#[tauri::command]
pub fn kanban_delete_card(
    state: State<'_, KanbanManager>,
    card_id: String,
) -> Result<(), String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    for column in s.columns.iter_mut() {
        column.cards.retain(|c| c.id != card_id);
    }
    Ok(())
}

#[tauri::command]
pub fn kanban_move_card(
    state: State<'_, KanbanManager>,
    card_id: String,
    target_column_id: String,
    target_index: usize,
) -> Result<KanbanBoardState, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;

    // Find and remove the card from its current column
    let mut card: Option<KanbanCard> = None;
    for column in s.columns.iter_mut() {
        if let Some(pos) = column.cards.iter().position(|c| c.id == card_id) {
            card = Some(column.cards.remove(pos));
            break;
        }
    }

    let mut card = card.ok_or_else(|| "Card not found".to_string())?;
    card.updated_at = Utc::now().to_rfc3339();

    // Insert into target column at the specified index
    let target = s
        .columns
        .iter_mut()
        .find(|c| c.id == target_column_id)
        .ok_or_else(|| "Target column not found".to_string())?;

    let idx = target_index.min(target.cards.len());
    target.cards.insert(idx, card);

    Ok(s.clone())
}

#[tauri::command]
pub fn kanban_add_column(
    state: State<'_, KanbanManager>,
    title: String,
    color: Option<String>,
) -> Result<KanbanColumn, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;

    let column = KanbanColumn {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        cards: Vec::new(),
        color,
    };

    let result = column.clone();
    s.columns.push(column);
    Ok(result)
}

#[tauri::command]
pub fn kanban_delete_column(
    state: State<'_, KanbanManager>,
    column_id: String,
) -> Result<(), String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    if s.columns.len() <= 1 {
        return Err("Cannot delete the last column".to_string());
    }
    s.columns.retain(|c| c.id != column_id);
    Ok(())
}

#[tauri::command]
pub fn kanban_rename_column(
    state: State<'_, KanbanManager>,
    column_id: String,
    title: String,
) -> Result<KanbanColumn, String> {
    let mut s = state.state.lock().map_err(|e| e.to_string())?;
    let column = s
        .columns
        .iter_mut()
        .find(|c| c.id == column_id)
        .ok_or_else(|| "Column not found".to_string())?;
    column.title = title;
    Ok(column.clone())
}

#[tauri::command]
pub fn kanban_get_stats(
    state: State<'_, KanbanManager>,
) -> Result<serde_json::Value, String> {
    let s = state.state.lock().map_err(|e| e.to_string())?;

    let total_cards: usize = s.columns.iter().map(|c| c.cards.len()).sum();
    let columns_count = s.columns.len();

    let per_column: Vec<serde_json::Value> = s
        .columns
        .iter()
        .map(|c| {
            serde_json::json!({
                "id": c.id,
                "title": c.title,
                "count": c.cards.len(),
            })
        })
        .collect();

    Ok(serde_json::json!({
        "totalCards": total_cards,
        "columnsCount": columns_count,
        "perColumn": per_column,
    }))
}
