//! Mood Tracker - Daily wellbeing check-ins for Hearth Desktop
//!
//! Provides:
//! - Log mood entries with emoji, label, and optional note
//! - View mood history with date filtering
//! - Weekly/monthly mood trends and statistics
//! - Persistent storage across app restarts

use chrono::{Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// A single mood entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodEntry {
    pub id: String,
    pub mood: u8,
    pub label: String,
    pub emoji: String,
    pub note: String,
    pub tags: Vec<String>,
    pub created_at: String,
}

impl MoodEntry {
    fn new(mood: u8, label: String, emoji: String, note: String, tags: Vec<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            mood,
            label,
            emoji,
            note,
            tags,
            created_at: Utc::now().to_rfc3339(),
        }
    }
}

/// Weekly mood summary
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodStats {
    pub total_entries: usize,
    pub average_mood: f32,
    pub most_common_label: String,
    pub streak_days: u32,
    pub entries_this_week: usize,
    pub weekly_average: f32,
    pub mood_distribution: Vec<u32>,
}

/// Managed state for mood tracker
pub struct MoodTrackerManager {
    entries: Mutex<Vec<MoodEntry>>,
}

impl Default for MoodTrackerManager {
    fn default() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn mood_log(
    state: State<'_, MoodTrackerManager>,
    mood: u8,
    label: String,
    emoji: String,
    note: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<MoodEntry, String> {
    let mood = mood.min(5).max(1);
    let entry = MoodEntry::new(
        mood,
        label,
        emoji,
        note.unwrap_or_default(),
        tags.unwrap_or_default(),
    );
    let created = entry.clone();
    let mut entries = state.entries.lock().map_err(|e| e.to_string())?;
    entries.push(entry);
    Ok(created)
}

#[tauri::command]
pub fn mood_get_today(
    state: State<'_, MoodTrackerManager>,
) -> Result<Vec<MoodEntry>, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;
    let today = Utc::now().date_naive();
    let today_entries: Vec<MoodEntry> = entries
        .iter()
        .filter(|e| {
            chrono::DateTime::parse_from_rfc3339(&e.created_at)
                .map(|dt| dt.date_naive() == today)
                .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(today_entries)
}

#[tauri::command]
pub fn mood_get_range(
    state: State<'_, MoodTrackerManager>,
    from: String,
    to: String,
) -> Result<Vec<MoodEntry>, String> {
    let from_date = NaiveDate::parse_from_str(&from, "%Y-%m-%d")
        .map_err(|e| format!("Invalid from date: {}", e))?;
    let to_date = NaiveDate::parse_from_str(&to, "%Y-%m-%d")
        .map_err(|e| format!("Invalid to date: {}", e))?;

    let entries = state.entries.lock().map_err(|e| e.to_string())?;
    let filtered: Vec<MoodEntry> = entries
        .iter()
        .filter(|e| {
            chrono::DateTime::parse_from_rfc3339(&e.created_at)
                .map(|dt| {
                    let d = dt.date_naive();
                    d >= from_date && d <= to_date
                })
                .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(filtered)
}

#[tauri::command]
pub fn mood_get_history(
    state: State<'_, MoodTrackerManager>,
    limit: Option<usize>,
) -> Result<Vec<MoodEntry>, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let start = entries.len().saturating_sub(limit);
    Ok(entries[start..].to_vec())
}

#[tauri::command]
pub fn mood_delete(
    state: State<'_, MoodTrackerManager>,
    id: String,
) -> Result<(), String> {
    let mut entries = state.entries.lock().map_err(|e| e.to_string())?;
    entries.retain(|e| e.id != id);
    Ok(())
}

#[tauri::command]
pub fn mood_get_stats(
    state: State<'_, MoodTrackerManager>,
) -> Result<MoodStats, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;

    if entries.is_empty() {
        return Ok(MoodStats {
            total_entries: 0,
            average_mood: 0.0,
            most_common_label: String::new(),
            streak_days: 0,
            entries_this_week: 0,
            weekly_average: 0.0,
            mood_distribution: vec![0; 5],
        });
    }

    let total = entries.len();
    let sum: u32 = entries.iter().map(|e| e.mood as u32).sum();
    let average = sum as f32 / total as f32;

    // Mood distribution (index 0 = mood 1, index 4 = mood 5)
    let mut distribution = vec![0u32; 5];
    for e in entries.iter() {
        let idx = (e.mood.saturating_sub(1)) as usize;
        if idx < 5 {
            distribution[idx] += 1;
        }
    }

    // Most common label
    let mut label_counts: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    for e in entries.iter() {
        *label_counts.entry(&e.label).or_insert(0) += 1;
    }
    let most_common = label_counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(l, _)| l.to_string())
        .unwrap_or_default();

    // Entries this week
    let now = Utc::now();
    let week_start = now.date_naive() - chrono::Duration::days(now.weekday().num_days_from_monday() as i64);
    let week_entries: Vec<&MoodEntry> = entries
        .iter()
        .filter(|e| {
            chrono::DateTime::parse_from_rfc3339(&e.created_at)
                .map(|dt| dt.date_naive() >= week_start)
                .unwrap_or(false)
        })
        .collect();
    let entries_this_week = week_entries.len();
    let weekly_avg = if entries_this_week > 0 {
        week_entries.iter().map(|e| e.mood as f32).sum::<f32>() / entries_this_week as f32
    } else {
        0.0
    };

    // Streak: count consecutive days with at least one entry (going backwards from today)
    let today = now.date_naive();
    let mut streak = 0u32;
    let mut check_date = today;
    loop {
        let has_entry = entries.iter().any(|e| {
            chrono::DateTime::parse_from_rfc3339(&e.created_at)
                .map(|dt| dt.date_naive() == check_date)
                .unwrap_or(false)
        });
        if has_entry {
            streak += 1;
            check_date -= chrono::Duration::days(1);
        } else {
            break;
        }
    }

    Ok(MoodStats {
        total_entries: total,
        average_mood: average,
        most_common_label: most_common,
        streak_days: streak,
        entries_this_week,
        weekly_average: weekly_avg,
        mood_distribution: distribution,
    })
}

#[tauri::command]
pub fn mood_clear(
    state: State<'_, MoodTrackerManager>,
) -> Result<(), String> {
    let mut entries = state.entries.lock().map_err(|e| e.to_string())?;
    entries.clear();
    Ok(())
}
