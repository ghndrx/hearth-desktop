use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const MAX_RECENT: usize = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentChannel {
    pub channel_id: String,
    pub channel_name: String,
    pub server_id: Option<String>,
    pub server_name: Option<String>,
    pub channel_type: u8, // 0=text, 1=dm, 2=voice
    pub visited_at: u64,
}

pub struct RecentChannelsState {
    channels: Mutex<Vec<RecentChannel>>,
}

impl Default for RecentChannelsState {
    fn default() -> Self {
        Self {
            channels: Mutex::new(Vec::new()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn recent_channels_visit(
    state: tauri::State<'_, RecentChannelsState>,
    channel_id: String,
    channel_name: String,
    server_id: Option<String>,
    server_name: Option<String>,
    channel_type: Option<u8>,
) -> Result<(), String> {
    let mut channels = state.channels.lock().map_err(|e| e.to_string())?;

    // Remove existing entry for this channel
    channels.retain(|c| c.channel_id != channel_id);

    // Insert at the front
    channels.insert(0, RecentChannel {
        channel_id,
        channel_name,
        server_id,
        server_name,
        channel_type: channel_type.unwrap_or(0),
        visited_at: now_ms(),
    });

    // Trim to max
    channels.truncate(MAX_RECENT);

    Ok(())
}

#[tauri::command]
pub fn recent_channels_list(
    state: tauri::State<'_, RecentChannelsState>,
) -> Result<Vec<RecentChannel>, String> {
    let channels = state.channels.lock().map_err(|e| e.to_string())?;
    Ok(channels.clone())
}

#[tauri::command]
pub fn recent_channels_clear(
    state: tauri::State<'_, RecentChannelsState>,
) -> Result<(), String> {
    let mut channels = state.channels.lock().map_err(|e| e.to_string())?;
    channels.clear();
    Ok(())
}

/// Get recent channels for tray menu building (non-command helper)
pub fn get_recent_for_tray(
    state: &RecentChannelsState,
) -> Vec<RecentChannel> {
    state.channels.lock()
        .map(|c| c.iter().take(5).cloned().collect())
        .unwrap_or_default()
}
