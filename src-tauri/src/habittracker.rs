//! Habit Tracker - Daily habit tracking with streaks, stats, and categories
//!
//! Provides persistent habit storage and completion tracking using SQLite,
//! with streak calculations, weekly/monthly statistics, and color-coded categories.

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub color: String,
    pub frequency: String, // "daily", "weekly", "weekdays", "weekends"
    pub created_at: String,
    pub updated_at: String,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitCompletion {
    pub id: String,
    pub habit_id: String,
    pub date: String, // YYYY-MM-DD
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitStats {
    pub habit_id: String,
    pub habit_name: String,
    pub habit_color: String,
    pub habit_category: String,
    pub total_completions: u32,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub completion_rate_7d: f64,
    pub completion_rate_30d: f64,
    pub completions_this_week: u32,
    pub completions_this_month: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfo {
    pub habit_id: String,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub last_completed: Option<String>,
}

pub struct HabitTrackerManager {
    db: Mutex<rusqlite::Connection>,
}

impl HabitTrackerManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("habittracker.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'General',
                color TEXT NOT NULL DEFAULT '#cba6f7',
                frequency TEXT NOT NULL DEFAULT 'daily',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS habit_completions (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                date TEXT NOT NULL,
                completed_at TEXT NOT NULL,
                FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_completion_unique
                ON habit_completions(habit_id, date);
            CREATE INDEX IF NOT EXISTS idx_completions_habit
                ON habit_completions(habit_id);
            CREATE INDEX IF NOT EXISTS idx_completions_date
                ON habit_completions(date DESC);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }
}

fn today_str() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Calculate current and longest streak for a habit from its sorted completion dates.
fn calculate_streaks(dates: &[String]) -> (u32, u32) {
    if dates.is_empty() {
        return (0, 0);
    }

    let today = chrono::Utc::now().date_naive();
    let mut parsed: Vec<chrono::NaiveDate> = dates
        .iter()
        .filter_map(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .collect();
    parsed.sort();
    parsed.dedup();

    if parsed.is_empty() {
        return (0, 0);
    }

    // Longest streak
    let mut longest = 1u32;
    let mut current_run = 1u32;
    for i in 1..parsed.len() {
        if parsed[i] == parsed[i - 1] + chrono::Duration::days(1) {
            current_run += 1;
            if current_run > longest {
                longest = current_run;
            }
        } else {
            current_run = 1;
        }
    }

    // Current streak: count backwards from today (or yesterday if today not completed)
    let last = *parsed.last().unwrap();
    let start_from = if last == today {
        today
    } else if last == today - chrono::Duration::days(1) {
        last
    } else {
        return (0, longest);
    };

    let mut current_streak = 0u32;
    let mut check_date = start_from;
    // Walk backwards through sorted dates
    let date_set: std::collections::HashSet<chrono::NaiveDate> = parsed.into_iter().collect();
    while date_set.contains(&check_date) {
        current_streak += 1;
        check_date -= chrono::Duration::days(1);
    }

    (current_streak, longest.max(current_streak))
}

#[tauri::command]
pub fn habit_create(
    state: State<'_, HabitTrackerManager>,
    name: String,
    description: Option<String>,
    category: Option<String>,
    color: Option<String>,
    frequency: Option<String>,
) -> Result<Habit, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_rfc3339();

    let habit = Habit {
        id: id.clone(),
        name,
        description: description.unwrap_or_default(),
        category: category.unwrap_or_else(|| "General".to_string()),
        color: color.unwrap_or_else(|| "#cba6f7".to_string()),
        frequency: frequency.unwrap_or_else(|| "daily".to_string()),
        created_at: now.clone(),
        updated_at: now,
        archived: false,
    };

    db.execute(
        "INSERT INTO habits (id, name, description, category, color, frequency, created_at, updated_at, archived)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            habit.id,
            habit.name,
            habit.description,
            habit.category,
            habit.color,
            habit.frequency,
            habit.created_at,
            habit.updated_at,
            habit.archived as i32,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(habit)
}

#[tauri::command]
pub fn habit_update(
    state: State<'_, HabitTrackerManager>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    color: Option<String>,
    frequency: Option<String>,
) -> Result<Habit, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = now_rfc3339();

    // Fetch current habit
    let mut stmt = db
        .prepare("SELECT id, name, description, category, color, frequency, created_at, updated_at, archived FROM habits WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut habit = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                color: row.get(4)?,
                frequency: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                archived: row.get::<_, i32>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(v) = name {
        habit.name = v;
    }
    if let Some(v) = description {
        habit.description = v;
    }
    if let Some(v) = category {
        habit.category = v;
    }
    if let Some(v) = color {
        habit.color = v;
    }
    if let Some(v) = frequency {
        habit.frequency = v;
    }
    habit.updated_at = now;

    db.execute(
        "UPDATE habits SET name = ?1, description = ?2, category = ?3, color = ?4, frequency = ?5, updated_at = ?6 WHERE id = ?7",
        rusqlite::params![
            habit.name,
            habit.description,
            habit.category,
            habit.color,
            habit.frequency,
            habit.updated_at,
            habit.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(habit)
}

#[tauri::command]
pub fn habit_delete(
    state: State<'_, HabitTrackerManager>,
    id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Delete completions first
    db.execute(
        "DELETE FROM habit_completions WHERE habit_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    let affected = db
        .execute("DELETE FROM habits WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(affected > 0)
}

#[tauri::command]
pub fn habit_get_all(
    state: State<'_, HabitTrackerManager>,
) -> Result<Vec<Habit>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, name, description, category, color, frequency, created_at, updated_at, archived
             FROM habits WHERE archived = 0 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Habit {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                color: row.get(4)?,
                frequency: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                archived: row.get::<_, i32>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut habits = Vec::new();
    for row in rows {
        habits.push(row.map_err(|e| e.to_string())?);
    }
    Ok(habits)
}

#[tauri::command]
pub fn habit_complete(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
    date: Option<String>,
) -> Result<HabitCompletion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let date = date.unwrap_or_else(today_str);
    let id = uuid::Uuid::new_v4().to_string();
    let completed_at = now_rfc3339();

    db.execute(
        "INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, habit_id, date, completed_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(HabitCompletion {
        id,
        habit_id,
        date,
        completed_at,
    })
}

#[tauri::command]
pub fn habit_uncomplete(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
    date: Option<String>,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let date = date.unwrap_or_else(today_str);
    let affected = db
        .execute(
            "DELETE FROM habit_completions WHERE habit_id = ?1 AND date = ?2",
            rusqlite::params![habit_id, date],
        )
        .map_err(|e| e.to_string())?;
    Ok(affected > 0)
}

#[tauri::command]
pub fn habit_get_completions(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<HabitCompletion>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, habit_id, date, completed_at FROM habit_completions
             WHERE habit_id = ?1 AND date >= ?2 AND date <= ?3
             ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![habit_id, start_date, end_date], |row| {
            Ok(HabitCompletion {
                id: row.get(0)?,
                habit_id: row.get(1)?,
                date: row.get(2)?,
                completed_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut completions = Vec::new();
    for row in rows {
        completions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(completions)
}

fn get_all_dates_for_habit(
    db: &rusqlite::Connection,
    habit_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare("SELECT date FROM habit_completions WHERE habit_id = ?1 ORDER BY date ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![habit_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut dates = Vec::new();
    for row in rows {
        dates.push(row.map_err(|e| e.to_string())?);
    }
    Ok(dates)
}

fn count_completions_since(
    db: &rusqlite::Connection,
    habit_id: &str,
    since: &str,
) -> Result<u32, String> {
    let count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ?1 AND date >= ?2",
            rusqlite::params![habit_id, since],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count as u32)
}

#[tauri::command]
pub fn habit_get_stats(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
) -> Result<HabitStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Fetch habit info
    let (habit_name, habit_color, habit_category): (String, String, String) = db
        .query_row(
            "SELECT name, color, category FROM habits WHERE id = ?1",
            rusqlite::params![habit_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let dates = get_all_dates_for_habit(&db, &habit_id)?;
    let total_completions = dates.len() as u32;
    let (current_streak, longest_streak) = calculate_streaks(&dates);

    let today = chrono::Utc::now().date_naive();
    let seven_days_ago = (today - chrono::Duration::days(6)).format("%Y-%m-%d").to_string();
    let thirty_days_ago = (today - chrono::Duration::days(29)).format("%Y-%m-%d").to_string();
    let week_start = (today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64))
        .format("%Y-%m-%d")
        .to_string();
    let month_start = today.format("%Y-%m-01").to_string();

    let completions_7d = count_completions_since(&db, &habit_id, &seven_days_ago)?;
    let completions_30d = count_completions_since(&db, &habit_id, &thirty_days_ago)?;
    let completions_this_week = count_completions_since(&db, &habit_id, &week_start)?;
    let completions_this_month = count_completions_since(&db, &habit_id, &month_start)?;

    let completion_rate_7d = completions_7d as f64 / 7.0;
    let completion_rate_30d = completions_30d as f64 / 30.0;

    Ok(HabitStats {
        habit_id,
        habit_name,
        habit_color,
        habit_category,
        total_completions,
        current_streak,
        longest_streak,
        completion_rate_7d,
        completion_rate_30d,
        completions_this_week,
        completions_this_month,
    })
}

#[tauri::command]
pub fn habit_get_all_stats(
    state: State<'_, HabitTrackerManager>,
) -> Result<Vec<HabitStats>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT id, name, color, category FROM habits WHERE archived = 0 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let habits: Vec<(String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let today = chrono::Utc::now().date_naive();
    let seven_days_ago = (today - chrono::Duration::days(6)).format("%Y-%m-%d").to_string();
    let thirty_days_ago = (today - chrono::Duration::days(29)).format("%Y-%m-%d").to_string();
    let week_start = (today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64))
        .format("%Y-%m-%d")
        .to_string();
    let month_start = today.format("%Y-%m-01").to_string();

    let mut all_stats = Vec::new();
    for (habit_id, habit_name, habit_color, habit_category) in habits {
        let dates = get_all_dates_for_habit(&db, &habit_id)?;
        let total_completions = dates.len() as u32;
        let (current_streak, longest_streak) = calculate_streaks(&dates);

        let completions_7d = count_completions_since(&db, &habit_id, &seven_days_ago)?;
        let completions_30d = count_completions_since(&db, &habit_id, &thirty_days_ago)?;
        let completions_this_week = count_completions_since(&db, &habit_id, &week_start)?;
        let completions_this_month = count_completions_since(&db, &habit_id, &month_start)?;

        all_stats.push(HabitStats {
            habit_id,
            habit_name,
            habit_color,
            habit_category,
            total_completions,
            current_streak,
            longest_streak,
            completion_rate_7d: completions_7d as f64 / 7.0,
            completion_rate_30d: completions_30d as f64 / 30.0,
            completions_this_week,
            completions_this_month,
        });
    }

    Ok(all_stats)
}

#[tauri::command]
pub fn habit_get_streak(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
) -> Result<StreakInfo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let dates = get_all_dates_for_habit(&db, &habit_id)?;
    let (current_streak, longest_streak) = calculate_streaks(&dates);
    let last_completed = dates.last().cloned();

    Ok(StreakInfo {
        habit_id,
        current_streak,
        longest_streak,
        last_completed,
    })
}

#[tauri::command]
pub fn habit_reset(
    state: State<'_, HabitTrackerManager>,
    habit_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute(
            "DELETE FROM habit_completions WHERE habit_id = ?1",
            rusqlite::params![habit_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(affected > 0)
}
