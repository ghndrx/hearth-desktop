use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeystrokeStats {
    pub counts: HashMap<String, u64>,
    pub total_keystrokes: u64,
    pub session_start: u64,
    pub peak_key: Option<String>,
    pub peak_count: u64,
}

pub struct KeystrokeHeatmapManager {
    counts: Mutex<HashMap<String, u64>>,
    total: Mutex<u64>,
    session_start: u64,
}

impl Default for KeystrokeHeatmapManager {
    fn default() -> Self {
        Self {
            counts: Mutex::new(HashMap::new()),
            total: Mutex::new(0),
            session_start: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        }
    }
}

#[tauri::command]
pub fn heatmap_record_key(
    state: State<'_, KeystrokeHeatmapManager>,
    key: String,
) -> Result<(), String> {
    let normalized = key.to_lowercase();
    let mut counts = state.counts.lock().map_err(|e| e.to_string())?;
    *counts.entry(normalized).or_insert(0) += 1;
    let mut total = state.total.lock().map_err(|e| e.to_string())?;
    *total += 1;
    Ok(())
}

#[tauri::command]
pub fn heatmap_record_keys(
    state: State<'_, KeystrokeHeatmapManager>,
    keys: Vec<String>,
) -> Result<(), String> {
    let mut counts = state.counts.lock().map_err(|e| e.to_string())?;
    let mut total = state.total.lock().map_err(|e| e.to_string())?;
    for key in keys {
        let normalized = key.to_lowercase();
        *counts.entry(normalized).or_insert(0) += 1;
        *total += 1;
    }
    Ok(())
}

#[tauri::command]
pub fn heatmap_get_stats(
    state: State<'_, KeystrokeHeatmapManager>,
) -> Result<KeystrokeStats, String> {
    let counts = state.counts.lock().map_err(|e| e.to_string())?;
    let total = *state.total.lock().map_err(|e| e.to_string())?;

    let (peak_key, peak_count) = counts
        .iter()
        .max_by_key(|(_, &v)| v)
        .map(|(k, &v)| (Some(k.clone()), v))
        .unwrap_or((None, 0));

    Ok(KeystrokeStats {
        counts: counts.clone(),
        total_keystrokes: total,
        session_start: state.session_start,
        peak_key,
        peak_count,
    })
}

#[tauri::command]
pub fn heatmap_get_top_keys(
    state: State<'_, KeystrokeHeatmapManager>,
    limit: Option<usize>,
) -> Result<Vec<(String, u64)>, String> {
    let counts = state.counts.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20);
    let mut sorted: Vec<(String, u64)> = counts.iter().map(|(k, &v)| (k.clone(), v)).collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    sorted.truncate(limit);
    Ok(sorted)
}

#[tauri::command]
pub fn heatmap_reset(
    state: State<'_, KeystrokeHeatmapManager>,
) -> Result<(), String> {
    let mut counts = state.counts.lock().map_err(|e| e.to_string())?;
    counts.clear();
    let mut total = state.total.lock().map_err(|e| e.to_string())?;
    *total = 0;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_manager() {
        let mgr = KeystrokeHeatmapManager::default();
        assert_eq!(*mgr.total.lock().unwrap(), 0);
        assert!(mgr.counts.lock().unwrap().is_empty());
    }
}
