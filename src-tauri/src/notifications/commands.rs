use std::sync::Mutex;
use tauri::State;

use super::db::{NotificationDb, NotificationLevel, NotificationPreferences};

type DbState = Mutex<NotificationDb>;

#[tauri::command]
pub fn get_notification_preferences(db: State<'_, DbState>) -> Result<NotificationPreferences, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_preferences().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_notification_preferences(
    db: State<'_, DbState>,
    prefs: NotificationPreferences,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.save_preferences(&prefs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_server_notification_level(
    db: State<'_, DbState>,
    server_id: String,
) -> Result<u8, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = db.get_server_level(&server_id).map_err(|e| e.to_string())?;
    Ok(level as u8)
}

#[tauri::command]
pub fn set_server_notification_level(
    db: State<'_, DbState>,
    server_id: String,
    level: u8,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = NotificationLevel::from_u8(level).map_err(|e| e.to_string())?;
    db.set_server_level(&server_id, level).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_channel_notification_override(
    db: State<'_, DbState>,
    channel_id: String,
) -> Result<Option<u8>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = db.get_channel_override(&channel_id).map_err(|e| e.to_string())?;
    Ok(level.map(|l| l as u8))
}

#[tauri::command]
pub fn set_channel_notification_override(
    db: State<'_, DbState>,
    channel_id: String,
    server_id: String,
    level: u8,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = NotificationLevel::from_u8(level).map_err(|e| e.to_string())?;
    db.set_channel_override(&channel_id, &server_id, level)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_channel_notification_override(
    db: State<'_, DbState>,
    channel_id: String,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.remove_channel_override(&channel_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_user_dm_notification_level(
    db: State<'_, DbState>,
    user_id: String,
) -> Result<u8, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = db.get_user_dm_level(&user_id).map_err(|e| e.to_string())?;
    Ok(level as u8)
}

#[tauri::command]
pub fn set_user_dm_notification_level(
    db: State<'_, DbState>,
    user_id: String,
    level: u8,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let level = NotificationLevel::from_u8(level).map_err(|e| e.to_string())?;
    db.set_user_dm_level(&user_id, level).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_keyword_triggers(db: State<'_, DbState>) -> Result<Vec<String>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_keyword_triggers().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_keyword_trigger(db: State<'_, DbState>, keyword: String) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.add_keyword(&keyword).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_keyword_trigger(db: State<'_, DbState>, keyword: String) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.remove_keyword(&keyword).map_err(|e| e.to_string())
}
