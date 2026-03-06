//! Voice Memo Manager - Quick voice notes with metadata storage
//!
//! Provides in-memory voice memo management with recording state
//! tracking, searchable metadata, favorites, and export support.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMemo {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub duration_ms: u64,
    pub file_size: u64,
    pub channel_id: Option<String>,
    pub transcript: Option<String>,
    pub tags: Vec<String>,
    pub created_at: u64,
    pub is_favorite: bool,
    pub waveform_data: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMemoState {
    pub is_recording: bool,
    pub current_memo_id: Option<String>,
    pub recording_start_time: Option<u64>,
    pub audio_level: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVoiceMemo {
    pub title: String,
    pub file_path: String,
    pub duration_ms: u64,
    pub file_size: u64,
    pub channel_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub waveform_data: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceMemoStats {
    pub total_count: usize,
    pub total_duration_ms: u64,
    pub favorites_count: usize,
}

pub struct VoiceMemoManager {
    memos: Mutex<Vec<VoiceMemo>>,
    recording_state: Mutex<VoiceMemoState>,
}

impl Default for VoiceMemoManager {
    fn default() -> Self {
        Self {
            memos: Mutex::new(Vec::new()),
            recording_state: Mutex::new(VoiceMemoState {
                is_recording: false,
                current_memo_id: None,
                recording_start_time: None,
                audio_level: 0.0,
            }),
        }
    }
}

impl VoiceMemoManager {
    pub fn new() -> Self {
        Self::default()
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn memo_start_recording(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
) -> Result<VoiceMemoState, String> {
    let mut recording = state.recording_state.lock().map_err(|e| e.to_string())?;
    if recording.is_recording {
        return Err("Already recording".to_string());
    }

    let memo_id = uuid::Uuid::new_v4().to_string();
    recording.is_recording = true;
    recording.current_memo_id = Some(memo_id);
    recording.recording_start_time = Some(now_ms());
    recording.audio_level = 0.0;

    let snapshot = recording.clone();
    let _ = app.emit("memo:recording-started", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn memo_stop_recording(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    data: CreateVoiceMemo,
) -> Result<VoiceMemo, String> {
    let mut recording = state.recording_state.lock().map_err(|e| e.to_string())?;
    if !recording.is_recording {
        return Err("Not currently recording".to_string());
    }

    let id = recording
        .current_memo_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    recording.is_recording = false;
    recording.current_memo_id = None;
    recording.recording_start_time = None;
    recording.audio_level = 0.0;

    drop(recording);

    let memo = VoiceMemo {
        id,
        title: data.title,
        file_path: data.file_path,
        duration_ms: data.duration_ms,
        file_size: data.file_size,
        channel_id: data.channel_id,
        transcript: None,
        tags: data.tags.unwrap_or_default(),
        created_at: now_ms(),
        is_favorite: false,
        waveform_data: data.waveform_data.unwrap_or_default(),
    };

    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    memos.push(memo.clone());

    let _ = app.emit("memo:recording-stopped", &memo);
    let _ = app.emit("memo:saved", &memo);
    Ok(memo)
}

#[tauri::command]
pub fn memo_cancel_recording(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
) -> Result<bool, String> {
    let mut recording = state.recording_state.lock().map_err(|e| e.to_string())?;
    if !recording.is_recording {
        return Err("Not currently recording".to_string());
    }

    recording.is_recording = false;
    recording.current_memo_id = None;
    recording.recording_start_time = None;
    recording.audio_level = 0.0;

    let _ = app.emit("memo:recording-stopped", "cancelled");
    Ok(true)
}

#[tauri::command]
pub fn memo_get_recording_state(
    state: State<'_, VoiceMemoManager>,
) -> Result<VoiceMemoState, String> {
    let recording = state.recording_state.lock().map_err(|e| e.to_string())?;
    Ok(recording.clone())
}

#[tauri::command]
pub fn memo_save(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    data: CreateVoiceMemo,
) -> Result<VoiceMemo, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let memo = VoiceMemo {
        id,
        title: data.title,
        file_path: data.file_path,
        duration_ms: data.duration_ms,
        file_size: data.file_size,
        channel_id: data.channel_id,
        transcript: None,
        tags: data.tags.unwrap_or_default(),
        created_at: now_ms(),
        is_favorite: false,
        waveform_data: data.waveform_data.unwrap_or_default(),
    };

    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    memos.push(memo.clone());

    let _ = app.emit("memo:saved", &memo);
    Ok(memo)
}

#[tauri::command]
pub fn memo_delete(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    id: String,
) -> Result<bool, String> {
    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    let len_before = memos.len();
    memos.retain(|m| m.id != id);
    let removed = memos.len() < len_before;
    if removed {
        let _ = app.emit("memo:deleted", &id);
    }
    Ok(removed)
}

#[tauri::command]
pub fn memo_get_all(
    state: State<'_, VoiceMemoManager>,
) -> Result<Vec<VoiceMemo>, String> {
    let memos = state.memos.lock().map_err(|e| e.to_string())?;
    let mut sorted = memos.clone();
    sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sorted)
}

#[tauri::command]
pub fn memo_get_by_channel(
    state: State<'_, VoiceMemoManager>,
    channel_id: String,
) -> Result<Vec<VoiceMemo>, String> {
    let memos = state.memos.lock().map_err(|e| e.to_string())?;
    let mut filtered: Vec<VoiceMemo> = memos
        .iter()
        .filter(|m| m.channel_id.as_deref() == Some(&channel_id))
        .cloned()
        .collect();
    filtered.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(filtered)
}

#[tauri::command]
pub fn memo_search(
    state: State<'_, VoiceMemoManager>,
    query: String,
) -> Result<Vec<VoiceMemo>, String> {
    let memos = state.memos.lock().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();
    let mut results: Vec<VoiceMemo> = memos
        .iter()
        .filter(|m| {
            m.title.to_lowercase().contains(&query_lower)
                || m.transcript
                    .as_ref()
                    .map(|t| t.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || m.tags
                    .iter()
                    .any(|tag| tag.to_lowercase().contains(&query_lower))
        })
        .cloned()
        .collect();
    results.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(results)
}

#[tauri::command]
pub fn memo_toggle_favorite(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    id: String,
) -> Result<bool, String> {
    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    if let Some(memo) = memos.iter_mut().find(|m| m.id == id) {
        memo.is_favorite = !memo.is_favorite;
        let _ = app.emit("memo:saved", &memo.clone());
        Ok(memo.is_favorite)
    } else {
        Err("Memo not found".to_string())
    }
}

#[tauri::command]
pub fn memo_update_title(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    id: String,
    title: String,
) -> Result<bool, String> {
    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    if let Some(memo) = memos.iter_mut().find(|m| m.id == id) {
        memo.title = title;
        let _ = app.emit("memo:saved", &memo.clone());
        Ok(true)
    } else {
        Err("Memo not found".to_string())
    }
}

#[tauri::command]
pub fn memo_update_transcript(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    id: String,
    transcript: Option<String>,
) -> Result<bool, String> {
    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    if let Some(memo) = memos.iter_mut().find(|m| m.id == id) {
        memo.transcript = transcript;
        let _ = app.emit("memo:saved", &memo.clone());
        Ok(true)
    } else {
        Err("Memo not found".to_string())
    }
}

#[tauri::command]
pub fn memo_update_tags(
    app: AppHandle,
    state: State<'_, VoiceMemoManager>,
    id: String,
    tags: Vec<String>,
) -> Result<bool, String> {
    let mut memos = state.memos.lock().map_err(|e| e.to_string())?;
    if let Some(memo) = memos.iter_mut().find(|m| m.id == id) {
        memo.tags = tags;
        let _ = app.emit("memo:saved", &memo.clone());
        Ok(true)
    } else {
        Err("Memo not found".to_string())
    }
}

#[tauri::command]
pub fn memo_get_stats(
    state: State<'_, VoiceMemoManager>,
) -> Result<VoiceMemoStats, String> {
    let memos = state.memos.lock().map_err(|e| e.to_string())?;
    let total_count = memos.len();
    let total_duration_ms: u64 = memos.iter().map(|m| m.duration_ms).sum();
    let favorites_count = memos.iter().filter(|m| m.is_favorite).count();
    Ok(VoiceMemoStats {
        total_count,
        total_duration_ms,
        favorites_count,
    })
}

#[tauri::command]
pub fn memo_export(
    state: State<'_, VoiceMemoManager>,
) -> Result<String, String> {
    let memos = state.memos.lock().map_err(|e| e.to_string())?;
    let mut sorted = memos.clone();
    sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    serde_json::to_string_pretty(&sorted).map_err(|e| e.to_string())
}
