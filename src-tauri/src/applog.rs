// App Log Viewer - Capture and expose application logs to the frontend
// Provides log history, filtering, and export capabilities for debugging

use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES: usize = 1000;

/// Log levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "trace" => LogLevel::Trace,
            "debug" => LogLevel::Debug,
            "info" => LogLevel::Info,
            "warn" | "warning" => LogLevel::Warn,
            "error" | "err" => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }

    pub fn severity(&self) -> u8 {
        match self {
            LogLevel::Trace => 0,
            LogLevel::Debug => 1,
            LogLevel::Info => 2,
            LogLevel::Warn => 3,
            LogLevel::Error => 4,
        }
    }
}

/// A single log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: u64,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub module: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

/// Log filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFilter {
    pub min_level: Option<String>,
    pub module: Option<String>,
    pub search: Option<String>,
    pub since: Option<String>,
    pub limit: Option<usize>,
}

/// App log stats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStats {
    pub total_entries: usize,
    pub trace_count: usize,
    pub debug_count: usize,
    pub info_count: usize,
    pub warn_count: usize,
    pub error_count: usize,
    pub oldest_entry: Option<String>,
    pub newest_entry: Option<String>,
    pub modules: Vec<String>,
}

/// Global log store
static LOG_STORE: Lazy<Mutex<LogStore>> = Lazy::new(|| Mutex::new(LogStore::new()));

struct LogStore {
    entries: VecDeque<LogEntry>,
    next_id: u64,
}

impl LogStore {
    fn new() -> Self {
        Self {
            entries: VecDeque::with_capacity(MAX_LOG_ENTRIES),
            next_id: 1,
        }
    }

    fn add_entry(&mut self, level: LogLevel, module: &str, message: &str, context: Option<serde_json::Value>) -> LogEntry {
        let entry = LogEntry {
            id: self.next_id,
            timestamp: Utc::now(),
            level,
            module: module.to_string(),
            message: message.to_string(),
            context,
        };
        self.next_id += 1;

        // Remove oldest if at capacity
        if self.entries.len() >= MAX_LOG_ENTRIES {
            self.entries.pop_front();
        }
        self.entries.push_back(entry.clone());
        entry
    }

    fn get_entries(&self, filter: &LogFilter) -> Vec<LogEntry> {
        let min_severity = filter
            .min_level
            .as_ref()
            .map(|l| LogLevel::from_str(l).severity())
            .unwrap_or(0);

        let since = filter.since.as_ref().and_then(|s| {
            DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        let limit = filter.limit.unwrap_or(500);

        self.entries
            .iter()
            .filter(|e| {
                // Level filter
                if e.level.severity() < min_severity {
                    return false;
                }
                // Module filter
                if let Some(ref module) = filter.module {
                    if !e.module.to_lowercase().contains(&module.to_lowercase()) {
                        return false;
                    }
                }
                // Search filter
                if let Some(ref search) = filter.search {
                    let search_lower = search.to_lowercase();
                    if !e.message.to_lowercase().contains(&search_lower)
                        && !e.module.to_lowercase().contains(&search_lower)
                    {
                        return false;
                    }
                }
                // Time filter
                if let Some(since_time) = since {
                    if e.timestamp < since_time {
                        return false;
                    }
                }
                true
            })
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    fn get_stats(&self) -> LogStats {
        let mut stats = LogStats {
            total_entries: self.entries.len(),
            trace_count: 0,
            debug_count: 0,
            info_count: 0,
            warn_count: 0,
            error_count: 0,
            oldest_entry: None,
            newest_entry: None,
            modules: Vec::new(),
        };

        let mut modules_set = std::collections::HashSet::new();

        for entry in &self.entries {
            match entry.level {
                LogLevel::Trace => stats.trace_count += 1,
                LogLevel::Debug => stats.debug_count += 1,
                LogLevel::Info => stats.info_count += 1,
                LogLevel::Warn => stats.warn_count += 1,
                LogLevel::Error => stats.error_count += 1,
            }
            modules_set.insert(entry.module.clone());
        }

        stats.modules = modules_set.into_iter().collect();
        stats.modules.sort();

        if let Some(first) = self.entries.front() {
            stats.oldest_entry = Some(first.timestamp.to_rfc3339());
        }
        if let Some(last) = self.entries.back() {
            stats.newest_entry = Some(last.timestamp.to_rfc3339());
        }

        stats
    }

    fn clear(&mut self) {
        self.entries.clear();
    }
}

/// Log a message to the app log store and emit to frontend
pub fn log_message(app: Option<&AppHandle>, level: LogLevel, module: &str, message: &str, context: Option<serde_json::Value>) {
    let entry = {
        let mut store = LOG_STORE.lock().unwrap();
        store.add_entry(level, module, message, context)
    };

    // Emit to frontend if app handle available
    if let Some(app) = app {
        let _ = app.emit("applog:entry", &entry);
    }
}

/// Helper macros for logging
#[macro_export]
macro_rules! app_log {
    ($app:expr, $level:expr, $module:expr, $($arg:tt)*) => {
        $crate::applog::log_message(
            $app,
            $level,
            $module,
            &format!($($arg)*),
            None
        )
    };
}

/// Get filtered log entries
#[tauri::command]
pub fn applog_get_entries(filter: LogFilter) -> Result<Vec<LogEntry>, String> {
    let store = LOG_STORE.lock().map_err(|e| e.to_string())?;
    Ok(store.get_entries(&filter))
}

/// Get log statistics
#[tauri::command]
pub fn applog_get_stats() -> Result<LogStats, String> {
    let store = LOG_STORE.lock().map_err(|e| e.to_string())?;
    Ok(store.get_stats())
}

/// Clear all log entries
#[tauri::command]
pub fn applog_clear() -> Result<(), String> {
    let mut store = LOG_STORE.lock().map_err(|e| e.to_string())?;
    store.clear();
    Ok(())
}

/// Export logs to file
#[tauri::command]
pub fn applog_export(app: AppHandle, format: String) -> Result<String, String> {
    let store = LOG_STORE.lock().map_err(|e| e.to_string())?;
    let entries: Vec<_> = store.entries.iter().cloned().collect();
    drop(store);

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    let logs_dir = app_data_dir.join("exported_logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let (filename, content) = match format.as_str() {
        "json" => {
            let filename = format!("hearth_logs_{}.json", timestamp);
            let content = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
            (filename, content)
        }
        "txt" | _ => {
            let filename = format!("hearth_logs_{}.txt", timestamp);
            let content = entries
                .iter()
                .map(|e| {
                    format!(
                        "[{}] [{}] [{}] {}",
                        e.timestamp.format("%Y-%m-%d %H:%M:%S%.3f"),
                        e.level.as_str().to_uppercase(),
                        e.module,
                        e.message
                    )
                })
                .collect::<Vec<_>>()
                .join("\n");
            (filename, content)
        }
    };

    let filepath = logs_dir.join(&filename);
    let mut file = File::create(&filepath).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;

    Ok(filepath.to_string_lossy().to_string())
}

/// Log a message from frontend
#[tauri::command]
pub fn applog_log(
    app: AppHandle,
    level: String,
    module: String,
    message: String,
    context: Option<serde_json::Value>,
) -> Result<(), String> {
    let log_level = LogLevel::from_str(&level);
    log_message(Some(&app), log_level, &module, &message, context);
    Ok(())
}

/// Initialize app logging with some startup messages
pub fn init_applog(app: &AppHandle) {
    log_message(Some(app), LogLevel::Info, "system", "Hearth Desktop started", None);
    log_message(Some(app), LogLevel::Debug, "applog", "App log system initialized", None);
}
