use tauri::{Manager, Window, AppHandle, Emitter, LogicalPosition, LogicalSize};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};
use std::fs;
use std::path::PathBuf;
use once_cell::sync::Lazy;

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Minimize the window
#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Maximize/restore the window
#[tauri::command]
pub async fn toggle_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Close the window
#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Hide the window
#[tauri::command]
pub async fn hide_window(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Show and focus the window
#[tauri::command]
pub async fn show_window(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

/// Check if window is visible
#[tauri::command]
pub async fn is_window_visible(window: Window) -> Result<bool, String> {
    window.is_visible().map_err(|e| e.to_string())
}

/// Set window always on top
#[tauri::command]
pub async fn set_always_on_top(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

/// Toggle fullscreen
#[tauri::command]
pub async fn toggle_fullscreen(window: Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// set_badge_count is in badge module

/// Get auto-start status
#[tauri::command]
pub fn is_auto_start_enabled(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Enable auto-start
#[tauri::command]
pub fn enable_auto_start(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().enable().map_err(|e| e.to_string())
}

/// Disable auto-start
#[tauri::command]
pub fn disable_auto_start(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().disable().map_err(|e| e.to_string())
}

/// Copy text to clipboard
#[tauri::command]
pub async fn copy_to_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

/// Read text from clipboard
#[tauri::command]
pub async fn read_clipboard(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())
}

/// Open URL in default browser
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

/// Open a file with the default application
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(std::path::Path::new(&path)).map_err(|e| e.to_string())
}

/// Show file in system file manager
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .unwrap_or(std::path::Path::new("/"));
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Generate a screenshot of the current window as base64 PNG
#[derive(serde::Serialize)]
pub struct ScreenshotResult {
    pub data: String,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
}

// ============================================================================
// Quick Mute Commands
// ============================================================================

static NOTIFICATIONS_MUTED: AtomicBool = AtomicBool::new(false);

/// Toggle notification mute state
#[tauri::command]
pub fn toggle_mute() -> Result<bool, String> {
    let current = NOTIFICATIONS_MUTED.load(Ordering::Relaxed);
    let new_state = !current;
    NOTIFICATIONS_MUTED.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

/// Get current mute state
#[tauri::command]
pub fn is_muted() -> Result<bool, String> {
    Ok(NOTIFICATIONS_MUTED.load(Ordering::Relaxed))
}

/// Set mute state explicitly
#[tauri::command]
pub fn set_mute(muted: bool) -> Result<bool, String> {
    NOTIFICATIONS_MUTED.store(muted, Ordering::Relaxed);
    Ok(muted)
}

// ============================================================================
// Tray Badge Commands
// ============================================================================

static BADGE_COUNT: AtomicU64 = AtomicU64::new(0);

// get_badge_count and set_tray_badge are in badge and tray modules

// get_system_info is in sysinfo module

// ============================================================================
// Focus / User Attention Commands
// ============================================================================

/// Request user attention (bounce dock icon etc.)
#[tauri::command]
pub async fn focus_window(window: Window) -> Result<(), String> {
    window.set_focus().map_err(|e| e.to_string())
}

// request_attention is in badge module

// ============================================================================
// Window State Persistence Commands
// ============================================================================

/// Window state for persistence
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_maximized: bool,
    pub is_fullscreen: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1280,
            height: 800,
            is_maximized: false,
            is_fullscreen: false,
        }
    }
}

static WINDOW_STATE: RwLock<Option<WindowState>> = RwLock::new(None);

fn get_state_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_dir.join("window-state.json"))
}

/// Save the current window state to disk
#[tauri::command]
pub async fn save_window_state(app: AppHandle, window: Window) -> Result<(), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;

    let state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        is_maximized,
        is_fullscreen,
    };

    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = Some(state.clone());
    }

    let state_file = get_state_file_path(&app)?;
    let json = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize window state: {}", e))?;
    fs::write(&state_file, json)
        .map_err(|e| format!("Failed to write window state: {}", e))?;

    Ok(())
}

/// Load window state from disk
#[tauri::command]
pub async fn load_window_state(app: AppHandle) -> Result<WindowState, String> {
    {
        let cached = WINDOW_STATE.read().map_err(|e| e.to_string())?;
        if let Some(state) = cached.as_ref() {
            return Ok(state.clone());
        }
    }

    let state_file = get_state_file_path(&app)?;

    if !state_file.exists() {
        return Ok(WindowState::default());
    }

    let json = fs::read_to_string(&state_file)
        .map_err(|e| format!("Failed to read window state: {}", e))?;
    let state: WindowState = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse window state: {}", e))?;

    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = Some(state.clone());
    }

    Ok(state)
}

// restore_window_state is in sessionrestore module

/// Get current window state without saving
#[tauri::command]
pub async fn get_window_state(window: Window) -> Result<WindowState, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;

    Ok(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        is_maximized,
        is_fullscreen,
    })
}

/// Clear saved window state (reset to defaults)
#[tauri::command]
pub async fn clear_window_state(app: AppHandle) -> Result<(), String> {
    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = None;
    }

    let state_file = get_state_file_path(&app)?;
    if state_file.exists() {
        fs::remove_file(&state_file)
            .map_err(|e| format!("Failed to remove window state file: {}", e))?;
    }

    Ok(())
}

// Window opacity commands are in windowopacity module

// ============================================================================
// Mini Mode / Picture-in-Picture Commands
// ============================================================================

/// Stored mini mode state including previous window dimensions
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MiniModeState {
    pub is_active: bool,
    pub previous_x: i32,
    pub previous_y: i32,
    pub previous_width: u32,
    pub previous_height: u32,
    pub previous_always_on_top: bool,
    pub mini_width: u32,
    pub mini_height: u32,
    pub corner: String,
}

impl Default for MiniModeState {
    fn default() -> Self {
        Self {
            is_active: false,
            previous_x: 0,
            previous_y: 0,
            previous_width: 1200,
            previous_height: 800,
            previous_always_on_top: false,
            mini_width: 320,
            mini_height: 480,
            corner: "bottom-right".to_string(),
        }
    }
}

static MINI_MODE_STATE: Lazy<RwLock<MiniModeState>> = Lazy::new(|| {
    RwLock::new(MiniModeState::default())
});

/// Enter mini mode (Picture-in-Picture)
#[tauri::command]
pub async fn enter_mini_mode(window: Window, corner: Option<String>) -> Result<MiniModeState, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let was_always_on_top = window.is_always_on_top().unwrap_or(false);

    let selected_corner = corner.unwrap_or_else(|| "bottom-right".to_string());

    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    state.is_active = true;
    state.previous_x = position.x;
    state.previous_y = position.y;
    state.previous_width = size.width;
    state.previous_height = size.height;
    state.previous_always_on_top = was_always_on_top;
    state.corner = selected_corner.clone();

    let monitor = window.current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let scale_factor = monitor.scale_factor();

    let screen_width = (monitor_size.width as f64 / scale_factor) as i32;
    let screen_height = (monitor_size.height as f64 / scale_factor) as i32;
    let screen_x = (monitor_pos.x as f64 / scale_factor) as i32;
    let screen_y = (monitor_pos.y as f64 / scale_factor) as i32;

    let padding = 20i32;
    let mini_w = state.mini_width as i32;
    let mini_h = state.mini_height as i32;

    let (new_x, new_y) = match selected_corner.as_str() {
        "top-left" => (screen_x + padding, screen_y + padding + 30),
        "top-right" => (screen_x + screen_width - mini_w - padding, screen_y + padding + 30),
        "bottom-left" => (screen_x + padding, screen_y + screen_height - mini_h - padding - 40),
        "bottom-right" | _ => (screen_x + screen_width - mini_w - padding, screen_y + screen_height - mini_h - padding - 40),
    };

    window.set_size(LogicalSize::new(state.mini_width as f64, state.mini_height as f64))
        .map_err(|e| e.to_string())?;
    window.set_position(LogicalPosition::new(new_x as f64, new_y as f64))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_min_size(Some(LogicalSize::new(280.0, 400.0)))
        .map_err(|e| e.to_string())?;

    Ok(state.clone())
}

/// Exit mini mode and restore previous window state
#[tauri::command]
pub async fn exit_mini_mode(window: Window) -> Result<MiniModeState, String> {
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;

    if !state.is_active {
        return Ok(state.clone());
    }

    window.set_size(LogicalSize::new(state.previous_width as f64, state.previous_height as f64))
        .map_err(|e| e.to_string())?;
    window.set_position(LogicalPosition::new(state.previous_x as f64, state.previous_y as f64))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(state.previous_always_on_top).map_err(|e| e.to_string())?;
    window.set_min_size(Some(LogicalSize::new(800.0, 600.0)))
        .map_err(|e| e.to_string())?;

    state.is_active = false;

    Ok(state.clone())
}

/// Toggle mini mode on/off
#[tauri::command]
pub async fn toggle_mini_mode(window: Window, corner: Option<String>) -> Result<MiniModeState, String> {
    let is_active = {
        let state = MINI_MODE_STATE.read().map_err(|e| e.to_string())?;
        state.is_active
    };

    if is_active {
        exit_mini_mode(window).await
    } else {
        enter_mini_mode(window, corner).await
    }
}

/// Get current mini mode state
#[tauri::command]
pub async fn get_mini_mode_state() -> Result<MiniModeState, String> {
    let state = MINI_MODE_STATE.read().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

/// Set mini mode dimensions
#[tauri::command]
pub async fn set_mini_mode_size(width: u32, height: u32) -> Result<(), String> {
    if width < 280 || height < 400 {
        return Err("Mini mode dimensions too small (min: 280x400)".to_string());
    }
    if width > 600 || height > 800 {
        return Err("Mini mode dimensions too large (max: 600x800)".to_string());
    }

    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    state.mini_width = width;
    state.mini_height = height;

    Ok(())
}

/// Move mini mode window to a different corner
#[tauri::command]
pub async fn move_mini_mode_corner(window: Window, corner: String) -> Result<MiniModeState, String> {
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;

    if !state.is_active {
        state.corner = corner;
        return Ok(state.clone());
    }

    let monitor = window.current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let scale_factor = monitor.scale_factor();

    let screen_width = (monitor_size.width as f64 / scale_factor) as i32;
    let screen_height = (monitor_size.height as f64 / scale_factor) as i32;
    let screen_x = (monitor_pos.x as f64 / scale_factor) as i32;
    let screen_y = (monitor_pos.y as f64 / scale_factor) as i32;

    let padding = 20i32;
    let mini_w = state.mini_width as i32;
    let mini_h = state.mini_height as i32;

    let (new_x, new_y) = match corner.as_str() {
        "top-left" => (screen_x + padding, screen_y + padding + 30),
        "top-right" => (screen_x + screen_width - mini_w - padding, screen_y + padding + 30),
        "bottom-left" => (screen_x + padding, screen_y + screen_height - mini_h - padding - 40),
        "bottom-right" | _ => (screen_x + screen_width - mini_w - padding, screen_y + screen_height - mini_h - padding - 40),
    };

    window.set_position(LogicalPosition::new(new_x as f64, new_y as f64))
        .map_err(|e| e.to_string())?;

    state.corner = corner;

    Ok(state.clone())
}

// ============================================================================
// Version Tracking (What's New)
// ============================================================================

fn get_version_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data_dir.join("last_seen_version.txt"))
}

/// Get the last version the user acknowledged in What's New
#[tauri::command]
pub async fn get_last_seen_version(app: AppHandle) -> Result<String, String> {
    let version_file = get_version_file_path(&app)?;
    match fs::read_to_string(&version_file) {
        Ok(version) => Ok(version.trim().to_string()),
        Err(_) => Ok(String::new())
    }
}

/// Set the last version the user acknowledged in What's New
#[tauri::command]
pub async fn set_last_seen_version(app: AppHandle, version: String) -> Result<(), String> {
    let version_file = get_version_file_path(&app)?;
    fs::write(&version_file, version.trim())
        .map_err(|e| format!("Failed to save version: {}", e))?;
    Ok(())
}

// ============================================================================
// Window Manager Commands
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub position: LogicalPosition<i32>,
    pub size: LogicalSize<u32>,
    pub scale_factor: f64,
}

/// Get information about all available monitors
#[tauri::command]
pub async fn get_monitors(window: Window) -> Result<Vec<MonitorInfo>, String> {
    let monitors = window.available_monitors()
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for monitor in monitors {
        let pos = monitor.position();
        let size = monitor.size();
        result.push(MonitorInfo {
            name: monitor.name().map(|s| s.to_string()),
            position: LogicalPosition::new(pos.x, pos.y),
            size: LogicalSize::new(size.width, size.height),
            scale_factor: monitor.scale_factor(),
        });
    }

    Ok(result)
}

/// Get the always-on-top state of the window
#[tauri::command]
pub async fn get_always_on_top(_window: Window) -> Result<bool, String> {
    Ok(false)
}

/// Minimize the window to the system tray
#[tauri::command]
pub async fn minimize_to_tray(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Set window size with logical dimensions
#[tauri::command]
pub async fn set_window_size(window: Window, width: u32, height: u32) -> Result<(), String> {
    window.set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

/// Set window position with logical coordinates
#[tauri::command]
pub async fn set_window_position(window: Window, x: i32, y: i32) -> Result<(), String> {
    window.set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

/// Center the window on the primary monitor
#[tauri::command]
pub async fn center_window(window: Window) -> Result<(), String> {
    window.center().map_err(|e| e.to_string())
}

/// Toggle window decorations
#[tauri::command]
pub async fn toggle_decorations(window: Window) -> Result<bool, String> {
    let is_decorated = window.is_decorated().map_err(|e| e.to_string())?;
    window.set_decorations(!is_decorated).map_err(|e| e.to_string())?;
    Ok(!is_decorated)
}

/// Request user attention for the window
#[tauri::command]
pub async fn request_user_attention(window: Window, critical: bool) -> Result<(), String> {
    let attention_type = if critical {
        Some(tauri::UserAttentionType::Critical)
    } else {
        Some(tauri::UserAttentionType::Informational)
    };
    window.request_user_attention(attention_type)
        .map_err(|e| e.to_string())
}

/// Clear user attention request
#[tauri::command]
pub async fn clear_user_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(None)
        .map_err(|e| e.to_string())
}

/// Ping server for connection health check
#[tauri::command]
pub async fn ping_server() -> Result<u64, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    Ok(timestamp)
}

/// Fetch HTML content from a URL for metadata extraction
#[tauri::command]
pub async fn fetch_page_html(url: String) -> Result<String, String> {
    use std::time::Duration;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (compatible; HearthDesktop/1.0)")
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let parsed_url = reqwest::Url::parse(&url)
        .map_err(|e| format!("Invalid URL: {}", e))?;

    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err("Only HTTP and HTTPS URLs are supported".to_string());
    }

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|ct| ct.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("text/html") && !content_type.contains("application/xhtml") {
        return Err("Content is not HTML".to_string());
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if bytes.len() > 1_048_576 {
        return Err("Response too large".to_string());
    }

    let html = String::from_utf8_lossy(&bytes).to_string();

    if let Some(head_end) = html.to_lowercase().find("</head>") {
        Ok(html[..head_end + 7].to_string())
    } else {
        Ok(html.chars().take(51200).collect())
    }
}

/// Cursor position result
#[derive(serde::Serialize)]
pub struct CursorPosition {
    pub x: i32,
    pub y: i32,
}

/// Get the current cursor/mouse position on screen
#[tauri::command]
pub fn get_cursor_position() -> Result<CursorPosition, String> {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;

        let output = Command::new("xdotool")
            .args(["getmouselocation", "--shell"])
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut x = 0i32;
                let mut y = 0i32;

                for line in stdout.lines() {
                    if let Some(val) = line.strip_prefix("X=") {
                        x = val.parse().unwrap_or(0);
                    } else if let Some(val) = line.strip_prefix("Y=") {
                        y = val.parse().unwrap_or(0);
                    }
                }

                Ok(CursorPosition { x, y })
            }
            _ => Err("Could not get cursor position".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let script = r#"
            use framework "Foundation"
            use framework "AppKit"
            set mouseLocation to current application's NSEvent's mouseLocation()
            set screenFrame to current application's NSScreen's mainScreen()'s frame()
            set x to mouseLocation's x as integer
            set y to ((screenFrame's |size|'s height) - (mouseLocation's y)) as integer
            return (x as text) & "," & (y as text)
        "#;

        let output = Command::new("osascript")
            .args(["-e", script])
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let parts: Vec<&str> = stdout.split(',').collect();
                if parts.len() == 2 {
                    let x = parts[0].parse().unwrap_or(0);
                    let y = parts[1].parse().unwrap_or(0);
                    Ok(CursorPosition { x, y })
                } else {
                    Err("Invalid cursor position format".to_string())
                }
            }
            _ => Err("Could not get cursor position".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
        use windows_sys::Win32::Foundation::POINT;

        let mut point = POINT { x: 0, y: 0 };

        unsafe {
            if GetCursorPos(&mut point) != 0 {
                Ok(CursorPosition { x: point.x, y: point.y })
            } else {
                Err("Could not get cursor position".to_string())
            }
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Cursor position not supported on this platform".to_string())
    }
}

/// Check if screen sharing is active
#[tauri::command]
pub fn check_screen_sharing() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("pgrep")
            .args(["-x", "ScreenCaptureKit|screencaptureui|QuickTime Player|OBS|Zoom"])
            .output();

        if let Ok(output) = output {
            if output.status.success() && !output.stdout.is_empty() {
                return true;
            }
        }
        false
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let processes = ["obs", "simplescreenrecorder", "kazam", "peek", "recordmydesktop"];

        for process in &processes {
            let output = Command::new("pgrep")
                .args(["-x", process])
                .output();

            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    return true;
                }
            }
        }
        false
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("tasklist").output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let streaming_apps = ["obs64.exe", "obs32.exe", "streamlabs", "xsplit"];

            for app in &streaming_apps {
                if stdout.contains(app) {
                    return true;
                }
            }
        }
        false
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

// =============================================================================
// Tray Settings Commands
// =============================================================================

/// Tray settings configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraySettings {
    pub minimize_to_tray: bool,
    pub close_to_tray: bool,
    pub show_unread_badge: bool,
    pub animate_badge: bool,
    pub start_minimized: bool,
    pub show_in_dock: bool,
    pub single_click_action: String,
    pub custom_tooltip: bool,
    pub tooltip_template: String,
}

impl Default for TraySettings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            close_to_tray: true,
            show_unread_badge: true,
            animate_badge: true,
            start_minimized: false,
            show_in_dock: true,
            single_click_action: "toggle".to_string(),
            custom_tooltip: false,
            tooltip_template: "Hearth - {unread} unread".to_string(),
        }
    }
}

lazy_static::lazy_static! {
    static ref TRAY_SETTINGS: Mutex<TraySettings> = Mutex::new(TraySettings::default());
}

/// Get current tray settings
#[tauri::command]
pub fn get_tray_settings() -> Result<TraySettings, String> {
    let settings = TRAY_SETTINGS.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

/// Update tray settings
#[tauri::command]
pub fn set_tray_settings(app: AppHandle, settings: TraySettings) -> Result<(), String> {
    {
        let mut current = TRAY_SETTINGS.lock().map_err(|e| e.to_string())?;
        *current = settings.clone();
    }

    let store_path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let settings_file = store_path.join("tray_settings.json");

    std::fs::create_dir_all(&store_path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&settings_file, json).map_err(|e| e.to_string())?;

    // Emit settings change event
    let _ = app.emit("tray-settings-changed", &settings);

    Ok(())
}

/// Load tray settings from persistent storage
#[tauri::command]
pub fn load_tray_settings(app: AppHandle) -> Result<TraySettings, String> {
    let store_path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let settings_file = store_path.join("tray_settings.json");

    if settings_file.exists() {
        let json = std::fs::read_to_string(&settings_file).map_err(|e| e.to_string())?;
        let settings: TraySettings = serde_json::from_str(&json).map_err(|e| e.to_string())?;

        let mut current = TRAY_SETTINGS.lock().map_err(|e| e.to_string())?;
        *current = settings.clone();

        Ok(settings)
    } else {
        Ok(TraySettings::default())
    }
}

/// Send a test notification from tray
#[tauri::command]
pub async fn test_tray_notification(app: AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Hearth Tray Test")
        .body("System tray notifications are working correctly!")
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Check if minimize to tray is enabled
#[tauri::command]
pub fn should_minimize_to_tray() -> Result<bool, String> {
    let settings = TRAY_SETTINGS.lock().map_err(|e| e.to_string())?;
    Ok(settings.minimize_to_tray)
}

/// Check if close to tray is enabled
#[tauri::command]
pub fn should_close_to_tray() -> Result<bool, String> {
    let settings = TRAY_SETTINGS.lock().map_err(|e| e.to_string())?;
    Ok(settings.close_to_tray)
}

// ============================================================================
// Clipboard Commands
// ============================================================================

/// Write text to clipboard
#[tauri::command]
pub async fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

/// Read text from clipboard
#[tauri::command]
pub async fn clipboard_read_text(app: AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

/// Check if clipboard has text
#[tauri::command]
pub async fn clipboard_has_text(app: AppHandle) -> Result<bool, String> {
    match app.clipboard().read_text() {
        Ok(text) => Ok(!text.is_empty()),
        Err(_) => Ok(false),
    }
}

/// Clear clipboard
#[tauri::command]
pub async fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    app.clipboard().write_text(String::new()).map_err(|e| e.to_string())
}

/// Read image from clipboard (stub - returns error on non-supported platforms)
#[tauri::command]
pub async fn clipboard_read_image(_app: AppHandle) -> Result<String, String> {
    Err("Clipboard image reading not supported".to_string())
}

/// Check if clipboard has image
#[tauri::command]
pub async fn clipboard_has_image(_app: AppHandle) -> Result<bool, String> {
    Ok(false)
}

/// Write image to clipboard (stub)
#[tauri::command]
pub async fn clipboard_write_image(_app: AppHandle, _data: String) -> Result<(), String> {
    Err("Clipboard image writing not supported".to_string())
}

// ============================================================================
// Focus Mode Commands
// ============================================================================

static FOCUS_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Toggle focus mode
#[tauri::command]
pub fn toggle_focus_mode() -> Result<bool, String> {
    let current = FOCUS_MODE_ACTIVE.load(Ordering::Relaxed);
    let new_state = !current;
    FOCUS_MODE_ACTIVE.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

/// Check if focus mode is active
#[tauri::command]
pub fn is_focus_mode_active() -> Result<bool, String> {
    Ok(FOCUS_MODE_ACTIVE.load(Ordering::Relaxed))
}

/// Set focus mode explicitly
#[tauri::command]
pub fn set_focus_mode(active: bool) -> Result<bool, String> {
    FOCUS_MODE_ACTIVE.store(active, Ordering::Relaxed);
    Ok(active)
}

// ============================================================================
// Tray Badge Update Commands
// ============================================================================

/// Update tray badge (alias for set_tray_badge)
#[tauri::command]
pub fn update_tray_badge(count: u64) -> u64 {
    BADGE_COUNT.store(count, Ordering::Relaxed);
    count
}

// ============================================================================
// File Utility Commands
// ============================================================================

/// Show file in folder (alias for show_in_folder)
#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    show_in_folder(path)
}

/// Check if a file exists
#[tauri::command]
pub fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Get file information
#[derive(serde::Serialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub extension: String,
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p = std::path::Path::new(&path);
    let metadata = fs::metadata(&p).map_err(|e| e.to_string())?;

    Ok(FileInfo {
        name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        path: path.clone(),
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        extension: p.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default(),
    })
}

// ============================================================================
// Window Attention Commands
// ============================================================================

/// Request window attention
#[tauri::command]
pub async fn request_window_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(Some(tauri::UserAttentionType::Informational))
        .map_err(|e| e.to_string())
}

/// Request urgent window attention
#[tauri::command]
pub async fn request_urgent_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(Some(tauri::UserAttentionType::Critical))
        .map_err(|e| e.to_string())
}

/// Cancel window attention request
#[tauri::command]
pub async fn cancel_window_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(None)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Screen Source Enumeration Commands
// ============================================================================

/// A media source for screen/window/camera sharing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub thumbnail: String, // Base64 PNG or empty
}

/// Enumerate all available screen, window, and camera sources
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<MediaSource>, String> {
    let mut sources = Vec::new();

    // Enumerate screens using xcap
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
    {
        use xcap::Screen;

        if let Ok(screens) = Screen::all() {
            for (idx, screen) in screens.iter().enumerate() {
                let name = screen.name()
                    .map(|n| n.to_string())
                    .unwrap_or_else(|| format!("Display {}", idx + 1));

                sources.push(MediaSource {
                    id: format!("screen:{}", idx),
                    name,
                    source_type: "screen".to_string(),
                    thumbnail: String::new(), // Empty for now, can capture later
                });
            }
        }
    }

    // Enumerate windows using xcap
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
    {
        use xcap::Window;

        if let Ok(windows) = Window::all() {
            for window in windows {
                // Filter out hidden windows
                if window.is_minimized() {
                    continue;
                }

                let title = window.title();
                if title.is_empty() {
                    continue;
                }

                let pid = window.pid();
                sources.push(MediaSource {
                    id: format!("window:{}", pid),
                    name: title,
                    source_type: "window".to_string(),
                    thumbnail: String::new(),
                });
            }
        }
    }

    // Enumerate cameras using nokhwa
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
    {
        use nokhwa::utils::CameraEnumerator;

        if let Ok(mut enumerator) = CameraEnumerator::new() {
            if let Ok(cameras) = enumerator.clone().detect_devices() {
                for (idx, _camera_info) in cameras.iter().enumerate() {
                    let name = format!("Camera {}", idx + 1);

                    sources.push(MediaSource {
                        id: format!("camera:{}", idx),
                        name,
                        source_type: "camera".to_string(),
                        thumbnail: String::new(),
                    });
                }
            }
        }
    }

    Ok(sources)
}
