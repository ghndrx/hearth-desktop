use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub version: String,
    pub created_at: String,
    pub app_version: String,
    pub platform: String,
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledBackup {
    pub enabled: bool,
    pub frequency: String,
    pub last_backup: Option<String>,
    pub next_backup: Option<String>,
    pub keep_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupHistoryStore {
    backups: Vec<BackupMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SettingsStore {
    #[serde(flatten)]
    data: serde_json::Value,
}

fn get_backup_dir(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_data.join("backups")
}

fn get_history_file(app: &AppHandle) -> PathBuf {
    get_backup_dir(app).join("history.json")
}

fn get_schedule_file(app: &AppHandle) -> PathBuf {
    get_backup_dir(app).join("schedule.json")
}

fn get_settings_file(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_data.join("settings.json")
}

fn get_themes_file(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_data.join("themes.json")
}

fn get_shortcuts_file(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_data.join("shortcuts.json")
}

fn get_layouts_file(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_data.join("layouts.json")
}

fn ensure_backup_dir(app: &AppHandle) -> Result<(), String> {
    let dir = get_backup_dir(app);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }
    Ok(())
}

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<T, String> {
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))
}

fn write_json_file<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn get_backup_history(app: AppHandle) -> Result<Vec<BackupMetadata>, String> {
    ensure_backup_dir(&app)?;
    let history_file = get_history_file(&app);
    
    if !history_file.exists() {
        return Ok(Vec::new());
    }
    
    let store: BackupHistoryStore = read_json_file(&history_file)?;
    Ok(store.backups)
}

#[tauri::command]
pub fn get_backup_schedule(app: AppHandle) -> Result<ScheduledBackup, String> {
    ensure_backup_dir(&app)?;
    let schedule_file = get_schedule_file(&app);
    
    if !schedule_file.exists() {
        return Ok(ScheduledBackup {
            enabled: false,
            frequency: "weekly".to_string(),
            last_backup: None,
            next_backup: None,
            keep_count: 5,
        });
    }
    
    read_json_file(&schedule_file)
}

#[tauri::command]
pub fn set_backup_schedule(app: AppHandle, schedule: ScheduledBackup) -> Result<(), String> {
    ensure_backup_dir(&app)?;
    let schedule_file = get_schedule_file(&app);
    write_json_file(&schedule_file, &schedule)
}

#[tauri::command]
pub fn register_backup(app: AppHandle, metadata: BackupMetadata) -> Result<(), String> {
    ensure_backup_dir(&app)?;
    let history_file = get_history_file(&app);
    
    let mut store = if history_file.exists() {
        read_json_file::<BackupHistoryStore>(&history_file).unwrap_or(BackupHistoryStore { backups: Vec::new() })
    } else {
        BackupHistoryStore { backups: Vec::new() }
    };
    
    // Add new backup at the beginning
    store.backups.insert(0, metadata);
    
    // Keep only the last 50 entries
    store.backups.truncate(50);
    
    write_json_file(&history_file, &store)
}

#[tauri::command]
pub fn delete_backup(app: AppHandle, created_at: String) -> Result<(), String> {
    ensure_backup_dir(&app)?;
    let history_file = get_history_file(&app);
    
    if !history_file.exists() {
        return Ok(());
    }
    
    let mut store: BackupHistoryStore = read_json_file(&history_file)?;
    store.backups.retain(|b| b.created_at != created_at);
    write_json_file(&history_file, &store)
}

#[tauri::command]
pub fn export_settings(app: AppHandle) -> Result<serde_json::Value, String> {
    let settings_file = get_settings_file(&app);
    
    if !settings_file.exists() {
        return Ok(serde_json::json!({}));
    }
    
    read_json_file(&settings_file)
}

#[tauri::command]
pub fn import_settings(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let settings_file = get_settings_file(&app);
    write_json_file(&settings_file, &data)
}

#[tauri::command]
pub fn export_themes(app: AppHandle) -> Result<serde_json::Value, String> {
    let themes_file = get_themes_file(&app);
    
    if !themes_file.exists() {
        return Ok(serde_json::json!({}));
    }
    
    read_json_file(&themes_file)
}

#[tauri::command]
pub fn import_themes(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let themes_file = get_themes_file(&app);
    write_json_file(&themes_file, &data)
}

#[tauri::command]
pub fn export_shortcuts(app: AppHandle) -> Result<serde_json::Value, String> {
    let shortcuts_file = get_shortcuts_file(&app);
    
    if !shortcuts_file.exists() {
        return Ok(serde_json::json!({}));
    }
    
    read_json_file(&shortcuts_file)
}

#[tauri::command]
pub fn import_shortcuts(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let shortcuts_file = get_shortcuts_file(&app);
    write_json_file(&shortcuts_file, &data)
}

#[tauri::command]
pub fn export_layouts(app: AppHandle) -> Result<serde_json::Value, String> {
    let layouts_file = get_layouts_file(&app);
    
    if !layouts_file.exists() {
        return Ok(serde_json::json!({}));
    }
    
    read_json_file(&layouts_file)
}

#[tauri::command]
pub fn import_layouts(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let layouts_file = get_layouts_file(&app);
    write_json_file(&layouts_file, &data)
}

#[tauri::command]
pub fn run_scheduled_backup(app: AppHandle) -> Result<(), String> {
    // Get current schedule
    let schedule_file = get_schedule_file(&app);
    let mut schedule = get_backup_schedule(app.clone())?;
    
    // Update last backup time
    schedule.last_backup = Some(chrono::Utc::now().to_rfc3339());
    
    // Calculate next backup based on frequency
    let next = match schedule.frequency.as_str() {
        "daily" => chrono::Utc::now() + chrono::Duration::days(1),
        "weekly" => chrono::Utc::now() + chrono::Duration::weeks(1),
        "monthly" => chrono::Utc::now() + chrono::Duration::days(30),
        _ => chrono::Utc::now() + chrono::Duration::weeks(1),
    };
    schedule.next_backup = Some(next.to_rfc3339());
    
    // Save schedule
    write_json_file(&schedule_file, &schedule)?;
    
    // Create backup metadata
    let metadata = BackupMetadata {
        version: "1.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        categories: vec!["settings".to_string(), "themes".to_string(), "shortcuts".to_string(), "layouts".to_string()],
    };
    
    // Register this backup
    register_backup(app.clone(), metadata.clone())?;
    
    // Save backup data to file
    let backup_dir = get_backup_dir(&app);
    let backup_file = backup_dir.join(format!("auto-backup-{}.json", 
        chrono::Utc::now().format("%Y%m%d-%H%M%S")));
    
    let backup_data = serde_json::json!({
        "metadata": metadata,
        "settings": export_settings(app.clone())?,
        "themes": export_themes(app.clone())?,
        "shortcuts": export_shortcuts(app.clone())?,
        "layouts": export_layouts(app.clone())?,
    });
    
    write_json_file(&backup_file, &backup_data)?;
    
    // Clean up old backups if needed
    cleanup_old_backups(&app, schedule.keep_count)?;
    
    Ok(())
}

fn cleanup_old_backups(app: &AppHandle, keep_count: u32) -> Result<(), String> {
    let backup_dir = get_backup_dir(app);
    
    let mut backups: Vec<_> = fs::read_dir(&backup_dir)
        .map_err(|e| format!("Failed to read backup directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_str()
                .map(|n| n.starts_with("auto-backup-") && n.ends_with(".json"))
                .unwrap_or(false)
        })
        .collect();
    
    // Sort by name (which includes timestamp) in reverse order
    backups.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
    
    // Remove backups beyond keep_count
    for backup in backups.iter().skip(keep_count as usize) {
        let _ = fs::remove_file(backup.path());
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}
