use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub line_number: usize,
    pub content: String,
    pub level: String,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogTailResult {
    pub path: String,
    pub lines: Vec<LogLine>,
    pub total_lines: usize,
    pub file_size_bytes: u64,
}

struct WatchedFile {
    last_offset: u64,
    line_count: usize,
}

pub struct LogTailManager {
    watched: Mutex<HashMap<String, WatchedFile>>,
}

impl Default for LogTailManager {
    fn default() -> Self {
        Self {
            watched: Mutex::new(HashMap::new()),
        }
    }
}

fn detect_level(line: &str) -> &'static str {
    let lower = line.to_lowercase();
    if lower.contains("error") || lower.contains("err]") || lower.contains("[e]") {
        "error"
    } else if lower.contains("warn") || lower.contains("wrn]") || lower.contains("[w]") {
        "warn"
    } else if lower.contains("info") || lower.contains("inf]") || lower.contains("[i]") {
        "info"
    } else if lower.contains("debug") || lower.contains("dbg]") || lower.contains("[d]") {
        "debug"
    } else if lower.contains("trace") || lower.contains("trc]") || lower.contains("[t]") {
        "trace"
    } else {
        "unknown"
    }
}

fn extract_timestamp(line: &str) -> Option<String> {
    // Match common timestamp patterns: ISO 8601, syslog, etc.
    let bytes = line.as_bytes();
    if bytes.len() >= 19 {
        // Check for ISO-like: 2024-01-15T10:30:00 or 2024-01-15 10:30:00
        let prefix = &line[..19];
        if prefix.chars().nth(4) == Some('-')
            && prefix.chars().nth(7) == Some('-')
            && (prefix.chars().nth(10) == Some('T') || prefix.chars().nth(10) == Some(' '))
        {
            return Some(prefix.to_string());
        }
    }
    // Check for bracket-enclosed timestamps: [2024-01-15 10:30:00]
    if line.starts_with('[') {
        if let Some(end) = line.find(']') {
            let inner = &line[1..end];
            if inner.len() >= 10 && inner.contains('-') {
                return Some(inner.to_string());
            }
        }
    }
    None
}

#[tauri::command]
pub fn logtail_read(
    manager: tauri::State<'_, LogTailManager>,
    path: String,
    tail_lines: Option<usize>,
) -> Result<LogTailResult, String> {
    let tail_n = tail_lines.unwrap_or(100);

    let metadata =
        std::fs::metadata(&path).map_err(|e| format!("Cannot access file: {}", e))?;

    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }

    let file_size = metadata.len();

    let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open file: {}", e))?;
    let reader = BufReader::new(file);

    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(|l| l.ok())
        .collect();

    let total = all_lines.len();
    let start_idx = if total > tail_n { total - tail_n } else { 0 };

    let lines: Vec<LogLine> = all_lines[start_idx..]
        .iter()
        .enumerate()
        .map(|(i, content)| LogLine {
            line_number: start_idx + i + 1,
            content: content.clone(),
            level: detect_level(content).to_string(),
            timestamp: extract_timestamp(content),
        })
        .collect();

    // Track this file
    if let Ok(mut watched) = manager.watched.lock() {
        watched.insert(
            path.clone(),
            WatchedFile {
                last_offset: file_size,
                line_count: total,
            },
        );
    }

    Ok(LogTailResult {
        path,
        lines,
        total_lines: total,
        file_size_bytes: file_size,
    })
}

#[tauri::command]
pub fn logtail_poll(
    manager: tauri::State<'_, LogTailManager>,
    path: String,
) -> Result<LogTailResult, String> {
    let metadata =
        std::fs::metadata(&path).map_err(|e| format!("Cannot access file: {}", e))?;
    let file_size = metadata.len();

    let last_offset = manager
        .watched
        .lock()
        .ok()
        .and_then(|w| w.get(&path).map(|f| f.last_offset))
        .unwrap_or(0);

    if file_size <= last_offset {
        return Ok(LogTailResult {
            path,
            lines: vec![],
            total_lines: 0,
            file_size_bytes: file_size,
        });
    }

    let mut file =
        std::fs::File::open(&path).map_err(|e| format!("Cannot open file: {}", e))?;
    file.seek(SeekFrom::Start(last_offset))
        .map_err(|e| format!("Seek error: {}", e))?;

    let reader = BufReader::new(file);
    let prev_count = manager
        .watched
        .lock()
        .ok()
        .and_then(|w| w.get(&path).map(|f| f.line_count))
        .unwrap_or(0);

    let new_lines: Vec<LogLine> = reader
        .lines()
        .filter_map(|l| l.ok())
        .enumerate()
        .map(|(i, content)| LogLine {
            line_number: prev_count + i + 1,
            content: content.clone(),
            level: detect_level(&content).to_string(),
            timestamp: extract_timestamp(&content),
        })
        .collect();

    let new_count = new_lines.len();

    if let Ok(mut watched) = manager.watched.lock() {
        let entry = watched.entry(path.clone()).or_insert(WatchedFile {
            last_offset: 0,
            line_count: 0,
        });
        entry.last_offset = file_size;
        entry.line_count += new_count;
    }

    Ok(LogTailResult {
        path,
        lines: new_lines,
        total_lines: prev_count + new_count,
        file_size_bytes: file_size,
    })
}

#[tauri::command]
pub fn logtail_unwatch(
    manager: tauri::State<'_, LogTailManager>,
    path: String,
) -> Result<(), String> {
    if let Ok(mut watched) = manager.watched.lock() {
        watched.remove(&path);
    }
    Ok(())
}

#[tauri::command]
pub fn logtail_list_watched(
    manager: tauri::State<'_, LogTailManager>,
) -> Result<Vec<String>, String> {
    Ok(manager
        .watched
        .lock()
        .ok()
        .map(|w| w.keys().cloned().collect())
        .unwrap_or_default())
}
