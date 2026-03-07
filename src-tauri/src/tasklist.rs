//! Task List - simple persistent to-do list widget
//!
//! Supports creating, completing, editing, reordering, and deleting tasks
//! with priority levels and optional due dates.

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: u32,
    pub title: String,
    pub completed: bool,
    pub priority: TaskPriority,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListStats {
    pub tasks: Vec<Task>,
    pub total: u32,
    pub completed: u32,
    pub pending: u32,
}

pub struct TaskListManager {
    tasks: Mutex<Vec<Task>>,
    next_id: Mutex<u32>,
}

impl Default for TaskListManager {
    fn default() -> Self {
        Self {
            tasks: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        }
    }
}

fn build_stats(tasks: &[Task]) -> TaskListStats {
    let completed = tasks.iter().filter(|t| t.completed).count() as u32;
    TaskListStats {
        tasks: tasks.to_vec(),
        total: tasks.len() as u32,
        completed,
        pending: tasks.len() as u32 - completed,
    }
}

#[tauri::command]
pub fn tasklist_get(manager: tauri::State<'_, TaskListManager>) -> Result<TaskListStats, String> {
    let tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_add(
    title: String,
    priority: Option<String>,
    due_date: Option<String>,
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    let mut next_id = manager.next_id.lock().map_err(|e| e.to_string())?;

    let prio = match priority.as_deref() {
        Some("high") => TaskPriority::High,
        Some("low") => TaskPriority::Low,
        _ => TaskPriority::Medium,
    };

    let task = Task {
        id: *next_id,
        title: title.trim().to_string(),
        completed: false,
        priority: prio,
        created_at: Local::now().to_rfc3339(),
        completed_at: None,
        due_date,
    };
    *next_id += 1;
    tasks.push(task);

    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_toggle(
    id: u32,
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    if let Some(task) = tasks.iter_mut().find(|t| t.id == id) {
        task.completed = !task.completed;
        task.completed_at = if task.completed {
            Some(Local::now().to_rfc3339())
        } else {
            None
        };
    }
    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_update(
    id: u32,
    title: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    if let Some(task) = tasks.iter_mut().find(|t| t.id == id) {
        if let Some(t) = title {
            task.title = t.trim().to_string();
        }
        if let Some(p) = priority {
            task.priority = match p.as_str() {
                "high" => TaskPriority::High,
                "low" => TaskPriority::Low,
                _ => TaskPriority::Medium,
            };
        }
        if due_date.is_some() {
            task.due_date = due_date;
        }
    }
    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_remove(
    id: u32,
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    tasks.retain(|t| t.id != id);
    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_clear_completed(
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    tasks.retain(|t| !t.completed);
    Ok(build_stats(&tasks))
}

#[tauri::command]
pub fn tasklist_reorder(
    ids: Vec<u32>,
    manager: tauri::State<'_, TaskListManager>,
) -> Result<TaskListStats, String> {
    let mut tasks = manager.tasks.lock().map_err(|e| e.to_string())?;
    let mut reordered: Vec<Task> = Vec::with_capacity(tasks.len());
    for id in &ids {
        if let Some(pos) = tasks.iter().position(|t| t.id == *id) {
            reordered.push(tasks.remove(pos));
        }
    }
    // Append any remaining tasks not in the ids list
    reordered.append(&mut tasks);
    *tasks = reordered;
    Ok(build_stats(&tasks))
}
