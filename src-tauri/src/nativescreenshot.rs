use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub captured_at: i64,
    pub annotation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotState {
    pub captures: Vec<Screenshot>,
    pub save_directory: String,
    pub total_captures: u64,
    pub auto_copy: bool,
    pub format: String, // "png" or "jpg"
}

pub struct ScreenshotManager {
    state: Mutex<ScreenshotState>,
}

impl ScreenshotManager {
    pub fn new(save_dir: std::path::PathBuf) -> Self {
        let dir_str = save_dir
            .join("screenshots")
            .to_string_lossy()
            .to_string();
        // Ensure directory exists
        let _ = std::fs::create_dir_all(&dir_str);
        Self {
            state: Mutex::new(ScreenshotState {
                captures: Vec::new(),
                save_directory: dir_str,
                total_captures: 0,
                auto_copy: true,
                format: "png".into(),
            }),
        }
    }
}

fn with_state<F, R>(mgr: &ScreenshotManager, f: F) -> Result<R, String>
where
    F: FnOnce(&mut ScreenshotState) -> R,
{
    let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
    Ok(f(&mut state))
}

#[tauri::command]
pub fn screenshot_get_state(
    mgr: tauri::State<'_, ScreenshotManager>,
) -> Result<ScreenshotState, String> {
    with_state(&mgr, |s| s.clone())
}

#[tauri::command]
pub fn screenshot_capture(
    mgr: tauri::State<'_, ScreenshotManager>,
) -> Result<Screenshot, String> {
    let (save_dir, format) = {
        let state = mgr.state.lock().map_err(|e| e.to_string())?;
        (state.save_directory.clone(), state.format.clone())
    };

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let file_name = format!("screenshot_{}.{}", timestamp, format);
    let file_path = format!("{}/{}", save_dir, file_name);

    // Use native screenshot tools
    let result = if cfg!(target_os = "linux") {
        // Try gnome-screenshot, then scrot, then import (ImageMagick)
        std::process::Command::new("gnome-screenshot")
            .args(["-f", &file_path])
            .output()
            .or_else(|_| {
                std::process::Command::new("scrot")
                    .arg(&file_path)
                    .output()
            })
            .or_else(|_| {
                std::process::Command::new("import")
                    .args(["-window", "root", &file_path])
                    .output()
            })
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("screencapture")
            .args(["-x", &file_path])
            .output()
    } else {
        return Err("Screenshot not supported on this platform".into());
    };

    match result {
        Ok(output) if output.status.success() => {
            let metadata = std::fs::metadata(&file_path)
                .map_err(|e| format!("Screenshot saved but cannot read: {}", e))?;

            // Try to get dimensions from the image
            let (width, height) = read_image_dimensions(&file_path).unwrap_or((0, 0));

            let id = format!(
                "ss-{}",
                uuid::Uuid::new_v4()
                    .to_string()
                    .split('-')
                    .next()
                    .unwrap_or("0")
            );
            let screenshot = Screenshot {
                id,
                file_path: file_path.clone(),
                file_name,
                width,
                height,
                file_size: metadata.len(),
                captured_at: chrono::Utc::now().timestamp_millis(),
                annotation: String::new(),
            };

            let result = screenshot.clone();
            let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
            state.total_captures += 1;
            state.captures.insert(0, screenshot);
            // Keep last 50
            state.captures.truncate(50);
            Ok(result)
        }
        Ok(output) => Err(format!(
            "Screenshot failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )),
        Err(e) => Err(format!("No screenshot tool available: {}", e)),
    }
}

fn read_image_dimensions(path: &str) -> Option<(u32, u32)> {
    // Read PNG header for dimensions
    let data = std::fs::read(path).ok()?;
    if data.len() > 24 && &data[0..4] == b"\x89PNG" {
        let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
        Some((width, height))
    } else {
        None
    }
}

#[tauri::command]
pub fn screenshot_capture_area(
    mgr: tauri::State<'_, ScreenshotManager>,
) -> Result<Screenshot, String> {
    let (save_dir, format) = {
        let state = mgr.state.lock().map_err(|e| e.to_string())?;
        (state.save_directory.clone(), state.format.clone())
    };

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let file_name = format!("screenshot_area_{}.{}", timestamp, format);
    let file_path = format!("{}/{}", save_dir, file_name);

    let result = if cfg!(target_os = "linux") {
        std::process::Command::new("gnome-screenshot")
            .args(["-a", "-f", &file_path])
            .output()
            .or_else(|_| {
                std::process::Command::new("scrot")
                    .args(["-s", &file_path])
                    .output()
            })
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("screencapture")
            .args(["-i", &file_path])
            .output()
    } else {
        return Err("Area screenshot not supported".into());
    };

    match result {
        Ok(output) if output.status.success() => {
            if !std::path::Path::new(&file_path).exists() {
                return Err("Screenshot cancelled".into());
            }
            let metadata = std::fs::metadata(&file_path)
                .map_err(|e| format!("Cannot read screenshot: {}", e))?;
            let (width, height) = read_image_dimensions(&file_path).unwrap_or((0, 0));
            let id = format!(
                "ss-{}",
                uuid::Uuid::new_v4()
                    .to_string()
                    .split('-')
                    .next()
                    .unwrap_or("0")
            );
            let screenshot = Screenshot {
                id,
                file_path: file_path.clone(),
                file_name,
                width,
                height,
                file_size: metadata.len(),
                captured_at: chrono::Utc::now().timestamp_millis(),
                annotation: String::new(),
            };
            let result = screenshot.clone();
            let mut state = mgr.state.lock().map_err(|e| e.to_string())?;
            state.total_captures += 1;
            state.captures.insert(0, screenshot);
            state.captures.truncate(50);
            Ok(result)
        }
        Ok(output) => Err(format!(
            "Area screenshot failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )),
        Err(e) => Err(format!("No screenshot tool available: {}", e)),
    }
}

#[tauri::command]
pub fn screenshot_annotate(
    mgr: tauri::State<'_, ScreenshotManager>,
    id: String,
    annotation: String,
) -> Result<ScreenshotState, String> {
    with_state(&mgr, |s| {
        if let Some(cap) = s.captures.iter_mut().find(|c| c.id == id) {
            cap.annotation = annotation;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn screenshot_delete(
    mgr: tauri::State<'_, ScreenshotManager>,
    id: String,
) -> Result<ScreenshotState, String> {
    with_state(&mgr, |s| {
        if let Some(cap) = s.captures.iter().find(|c| c.id == id) {
            let _ = std::fs::remove_file(&cap.file_path);
        }
        s.captures.retain(|c| c.id != id);
        s.clone()
    })
}

#[tauri::command]
pub fn screenshot_open_file(
    file_path: String,
) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(&file_path)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn screenshot_set_format(
    mgr: tauri::State<'_, ScreenshotManager>,
    format: String,
) -> Result<ScreenshotState, String> {
    with_state(&mgr, |s| {
        if format == "png" || format == "jpg" {
            s.format = format;
        }
        s.clone()
    })
}

#[tauri::command]
pub fn screenshot_set_auto_copy(
    mgr: tauri::State<'_, ScreenshotManager>,
    auto_copy: bool,
) -> Result<ScreenshotState, String> {
    with_state(&mgr, |s| {
        s.auto_copy = auto_copy;
        s.clone()
    })
}
