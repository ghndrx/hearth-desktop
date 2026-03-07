use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedFile {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub mime_type: String,
    pub checksum: String,
    pub shared_at: i64,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileShareState {
    pub files: Vec<SharedFile>,
    pub total_shared: u64,
    pub total_bytes: u64,
}

pub struct FileShareManager {
    state: Mutex<FileShareState>,
}

impl Default for FileShareManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(FileShareState {
                files: Vec::new(),
                total_shared: 0,
                total_bytes: 0,
            }),
        }
    }
}

fn with_state<F, R>(mgr: &FileShareManager, f: F) -> Result<R, String>
where
    F: FnOnce(&mut FileShareState) -> R,
{
    let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

fn guess_mime(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".pdf") {
        "application/pdf"
    } else if lower.ends_with(".zip") {
        "application/zip"
    } else if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".txt") || lower.ends_with(".md") {
        "text/plain"
    } else if lower.ends_with(".json") {
        "application/json"
    } else if lower.ends_with(".html") || lower.ends_with(".htm") {
        "text/html"
    } else if lower.ends_with(".css") {
        "text/css"
    } else if lower.ends_with(".js") || lower.ends_with(".ts") {
        "text/javascript"
    } else {
        "application/octet-stream"
    }
    .to_string()
}

fn compute_checksum(data: &[u8]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[tauri::command]
pub fn fileshare_get_state(
    mgr: tauri::State<'_, FileShareManager>,
) -> Result<FileShareState, String> {
    with_state(&mgr, |s| s.clone())
}

#[tauri::command]
pub fn fileshare_add_file(
    mgr: tauri::State<'_, FileShareManager>,
    file_path: String,
    expires_hours: Option<u64>,
) -> Result<SharedFile, String> {
    let metadata =
        std::fs::metadata(&file_path).map_err(|e| format!("Cannot read file: {}", e))?;
    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }
    let file_size = metadata.len();
    // Read first 8KB for checksum
    let data = std::fs::read(&file_path)
        .map(|d| if d.len() > 8192 { d[..8192].to_vec() } else { d })
        .unwrap_or_default();
    let checksum = compute_checksum(&data);
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());
    let mime_type = guess_mime(&file_path);
    let now = chrono::Utc::now().timestamp_millis();
    let expires_at = expires_hours.map(|h| now + (h as i64 * 3600 * 1000));
    let id = format!(
        "fs-{}",
        uuid::Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("0")
    );

    let shared = SharedFile {
        id: id.clone(),
        file_name,
        file_path: file_path.clone(),
        file_size,
        mime_type,
        checksum,
        shared_at: now,
        expires_at,
    };

    let result = shared.clone();
    let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
    state.total_shared += 1;
    state.total_bytes += file_size;
    state.files.insert(0, shared);
    Ok(result)
}

#[tauri::command]
pub fn fileshare_remove(
    mgr: tauri::State<'_, FileShareManager>,
    id: String,
) -> Result<FileShareState, String> {
    with_state(&mgr, |s| {
        s.files.retain(|f| f.id != id);
        s.clone()
    })
}

#[tauri::command]
pub fn fileshare_get_file_info(
    file_path: String,
) -> Result<SharedFile, String> {
    let metadata =
        std::fs::metadata(&file_path).map_err(|e| format!("Cannot read file: {}", e))?;
    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());
    Ok(SharedFile {
        id: String::new(),
        file_name,
        file_path: file_path.clone(),
        file_size: metadata.len(),
        mime_type: guess_mime(&file_path),
        checksum: String::new(),
        shared_at: chrono::Utc::now().timestamp_millis(),
        expires_at: None,
    })
}

#[tauri::command]
pub fn fileshare_open_in_folder(
    file_path: String,
) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    let dir = path.parent().unwrap_or(path);
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn fileshare_clear_expired(
    mgr: tauri::State<'_, FileShareManager>,
) -> Result<FileShareState, String> {
    let now = chrono::Utc::now().timestamp_millis();
    with_state(&mgr, |s| {
        s.files
            .retain(|f| f.expires_at.map_or(true, |exp| exp > now));
        s.clone()
    })
}
