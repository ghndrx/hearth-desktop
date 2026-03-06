//! Daily Journal - Persistent daily journal entries with mood tracking
//!
//! Stores journal entries as JSON files organized by date. Each entry
//! includes text content, mood rating, and tags. Entries persist across
//! sessions via the Tauri app data directory.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub date: String, // YYYY-MM-DD
    pub content: String,
    pub mood: Option<u8>, // 1-5
    pub tags: Vec<String>,
    pub updated_at: u64, // unix timestamp ms
    pub word_count: u32,
}

impl JournalEntry {
    pub fn new(date: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        Self {
            date,
            content: String::new(),
            mood: None,
            tags: Vec::new(),
            updated_at: now,
            word_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalStats {
    pub total_entries: u32,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub total_words: u32,
    pub mood_average: Option<f64>,
    pub entries_this_month: u32,
}

pub struct JournalManager {
    cache: Mutex<HashMap<String, JournalEntry>>,
}

impl JournalManager {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for JournalManager {
    fn default() -> Self {
        Self::new()
    }
}

fn journal_dir(app_handle: &AppHandle) -> std::path::PathBuf {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    let dir = app_data.join("journal");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn entry_path(app_handle: &AppHandle, date: &str) -> std::path::PathBuf {
    journal_dir(app_handle).join(format!("{}.json", date))
}

#[tauri::command]
pub fn journal_get_entry(
    date: String,
    app_handle: AppHandle,
    manager: State<'_, JournalManager>,
) -> JournalEntry {
    // Check cache first
    {
        let cache = manager.cache.lock().unwrap();
        if let Some(entry) = cache.get(&date) {
            return entry.clone();
        }
    }

    // Load from disk
    let path = entry_path(&app_handle, &date);
    let entry = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<JournalEntry>(&s).ok())
            .unwrap_or_else(|| JournalEntry::new(date.clone()))
    } else {
        JournalEntry::new(date.clone())
    };

    // Cache it
    let mut cache = manager.cache.lock().unwrap();
    cache.insert(date, entry.clone());
    entry
}

#[tauri::command]
pub fn journal_save_entry(
    entry: JournalEntry,
    app_handle: AppHandle,
    manager: State<'_, JournalManager>,
) -> Result<(), String> {
    let mut entry = entry;
    entry.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    entry.word_count = entry
        .content
        .split_whitespace()
        .count() as u32;

    let path = entry_path(&app_handle, &entry.date);
    let json = serde_json::to_string_pretty(&entry).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;

    // Update cache
    let mut cache = manager.cache.lock().unwrap();
    cache.insert(entry.date.clone(), entry);
    Ok(())
}

#[tauri::command]
pub fn journal_delete_entry(
    date: String,
    app_handle: AppHandle,
    manager: State<'_, JournalManager>,
) -> Result<(), String> {
    let path = entry_path(&app_handle, &date);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    let mut cache = manager.cache.lock().unwrap();
    cache.remove(&date);
    Ok(())
}

#[tauri::command]
pub fn journal_get_stats(app_handle: AppHandle) -> JournalStats {
    let dir = journal_dir(&app_handle);
    let mut entries: Vec<JournalEntry> = Vec::new();

    if let Ok(read_dir) = std::fs::read_dir(&dir) {
        for entry in read_dir.flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Ok(journal_entry) = serde_json::from_str::<JournalEntry>(&content) {
                        if !journal_entry.content.is_empty() {
                            entries.push(journal_entry);
                        }
                    }
                }
            }
        }
    }

    entries.sort_by(|a, b| a.date.cmp(&b.date));

    let total_entries = entries.len() as u32;
    let total_words: u32 = entries.iter().map(|e| e.word_count).sum();

    let moods: Vec<f64> = entries
        .iter()
        .filter_map(|e| e.mood.map(|m| m as f64))
        .collect();
    let mood_average = if moods.is_empty() {
        None
    } else {
        Some(moods.iter().sum::<f64>() / moods.len() as f64)
    };

    // Calculate streaks
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let this_month = &today[..7];
    let entries_this_month = entries
        .iter()
        .filter(|e| e.date.starts_with(this_month))
        .count() as u32;

    let dates: std::collections::HashSet<String> =
        entries.iter().map(|e| e.date.clone()).collect();

    let mut current_streak = 0u32;
    let mut longest_streak = 0u32;
    let mut streak = 0u32;

    // Walk backwards from today to find current streak
    let mut check_date = chrono::Local::now().date_naive();
    loop {
        let date_str = check_date.format("%Y-%m-%d").to_string();
        if dates.contains(&date_str) {
            current_streak += 1;
            check_date -= chrono::Duration::days(1);
        } else {
            break;
        }
    }

    // Calculate longest streak from all entries
    if !entries.is_empty() {
        streak = 1;
        longest_streak = 1;
        for i in 1..entries.len() {
            if let (Ok(prev), Ok(curr)) = (
                chrono::NaiveDate::parse_from_str(&entries[i - 1].date, "%Y-%m-%d"),
                chrono::NaiveDate::parse_from_str(&entries[i].date, "%Y-%m-%d"),
            ) {
                if (curr - prev).num_days() == 1 {
                    streak += 1;
                    longest_streak = longest_streak.max(streak);
                } else {
                    streak = 1;
                }
            }
        }
    }

    JournalStats {
        total_entries,
        current_streak,
        longest_streak,
        total_words,
        mood_average,
        entries_this_month,
    }
}

#[tauri::command]
pub fn journal_list_dates(app_handle: AppHandle) -> Vec<String> {
    let dir = journal_dir(&app_handle);
    let mut dates: Vec<String> = Vec::new();

    if let Ok(read_dir) = std::fs::read_dir(&dir) {
        for entry in read_dir.flatten() {
            if let Some(name) = entry.path().file_stem().and_then(|n| n.to_str()) {
                // Validate it looks like a date
                if name.len() == 10 && name.chars().nth(4) == Some('-') {
                    // Only include non-empty entries
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        if let Ok(journal_entry) = serde_json::from_str::<JournalEntry>(&content) {
                            if !journal_entry.content.is_empty() {
                                dates.push(name.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    dates.sort();
    dates.reverse();
    dates
}
