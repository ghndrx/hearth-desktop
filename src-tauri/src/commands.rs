use tauri::{Manager, Window, AppHandle, LogicalPosition, LogicalSize};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

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

/// Set the dock/taskbar badge count (unread messages)
#[tauri::command]
pub async fn set_badge_count(app: AppHandle, count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if count > 0 {
                window.set_badge_count(Some(count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

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

// ============================================================================
// Clipboard Commands
// ============================================================================

/// Copy text to the system clipboard
#[tauri::command]
pub async fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(&text)
        .map_err(|e| e.to_string())
}

/// Read text from the system clipboard
#[tauri::command]
pub async fn clipboard_read_text(app: AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| e.to_string())
}

/// Check if clipboard has text content
#[tauri::command]
pub async fn clipboard_has_text(app: AppHandle) -> Result<bool, String> {
    match app.clipboard().read_text() {
        Ok(text) => Ok(!text.is_empty()),
        Err(_) => Ok(false),
    }
}

/// Clear the clipboard
#[tauri::command]
pub async fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    app.clipboard()
        .write_text("")
        .map_err(|e| e.to_string())
}

/// Read image from clipboard as base64-encoded PNG
/// Returns None if no image is available
#[tauri::command]
pub async fn clipboard_read_image(app: AppHandle) -> Result<Option<ClipboardImageData>, String> {
    use tauri_plugin_clipboard_manager::ClipImage;
    
    match app.clipboard().read_image() {
        Ok(image) => {
            let bytes = image.rgba().to_vec();
            let width = image.width();
            let height = image.height();
            
            // Encode RGBA bytes to PNG
            let mut png_bytes = Vec::new();
            {
                let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
                writer.write_image_data(&bytes).map_err(|e| e.to_string())?;
            }
            
            // Encode to base64
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            let base64_data = STANDARD.encode(&png_bytes);
            
            Ok(Some(ClipboardImageData {
                data: base64_data,
                width,
                height,
                mime_type: "image/png".to_string(),
            }))
        }
        Err(_) => Ok(None),
    }
}

/// Check if clipboard has image content
#[tauri::command]
pub async fn clipboard_has_image(app: AppHandle) -> Result<bool, String> {
    match app.clipboard().read_image() {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Write image to clipboard from base64-encoded data
#[tauri::command]
pub async fn clipboard_write_image(
    app: AppHandle,
    data: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipImage;
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // Decode base64 to bytes
    let bytes = STANDARD.decode(&data).map_err(|e| format!("Invalid base64: {}", e))?;
    
    // Create ClipImage from RGBA bytes
    let image = ClipImage::new(&bytes, width, height);
    
    app.clipboard()
        .write_image(&image)
        .map_err(|e| e.to_string())
}

/// Clipboard image data structure
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ClipboardImageData {
    /// Base64-encoded PNG image data
    pub data: String,
    /// Image width in pixels
    pub width: u32,
    /// Image height in pixels  
    pub height: u32,
    /// MIME type (always "image/png")
    pub mime_type: String,
}

// ============================================================================
// Quick Mute Commands
// ============================================================================

use std::sync::atomic::{AtomicBool, Ordering};

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

/// Update the tray icon with unread message count
#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    crate::tray::set_unread_count(&app, count).map_err(|e| e.to_string())
}

/// Get current unread count from tray
#[tauri::command]
pub fn get_tray_badge() -> u32 {
    crate::tray::get_unread_count()
}

// ============================================================================
// Focus Mode Commands
// ============================================================================

static FOCUS_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Toggle focus mode state
#[tauri::command]
pub fn toggle_focus_mode() -> Result<bool, String> {
    let current = FOCUS_MODE_ACTIVE.load(Ordering::Relaxed);
    let new_state = !current;
    FOCUS_MODE_ACTIVE.store(new_state, Ordering::Relaxed);
    Ok(new_state)
}

/// Get current focus mode state
#[tauri::command]
pub fn is_focus_mode_active() -> Result<bool, String> {
    Ok(FOCUS_MODE_ACTIVE.load(Ordering::Relaxed))
}

/// Set focus mode state explicitly
#[tauri::command]
pub fn set_focus_mode(active: bool) -> Result<bool, String> {
    FOCUS_MODE_ACTIVE.store(active, Ordering::Relaxed);
    Ok(active)
}

// ============================================================================
// File Commands
// ============================================================================

use std::path::PathBuf;

/// Open a file with the default application
#[tauri::command]
pub async fn open_file(filepath: String) -> Result<(), String> {
    let path = PathBuf::from(&filepath);
    
    if !path.exists() {
        return Err(format!("File not found: {}", filepath));
    }
    
    // Use the opener crate for cross-platform file opening
    opener::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    
    Ok(())
}

/// Reveal a file in the system file manager
#[tauri::command]
pub async fn reveal_in_folder(filepath: String) -> Result<(), String> {
    let path = PathBuf::from(&filepath);
    
    if !path.exists() {
        return Err(format!("File not found: {}", filepath));
    }
    
    // Get the parent directory
    let parent = path.parent()
        .ok_or_else(|| "Could not get parent directory".to_string())?;
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, use `open` with the -R flag to reveal the file
        std::process::Command::new("open")
            .args(&["-R", &filepath])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, use explorer with /select flag
        std::process::Command::new("explorer")
            .args(&["/select,", &filepath])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, open the parent folder (selecting specific files varies by file manager)
        opener::open(parent)
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

/// Check if a file exists
#[tauri::command]
pub async fn file_exists(filepath: String) -> Result<bool, String> {
    let path = PathBuf::from(&filepath);
    Ok(path.exists())
}

/// Get file metadata
#[tauri::command]
pub async fn get_file_info(filepath: String) -> Result<FileInfo, String> {
    use std::time::UNIX_EPOCH;
    
    let path = PathBuf::from(&filepath);
    
    if !path.exists() {
        return Err(format!("File not found: {}", filepath));
    }
    
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());
    
    let created = metadata.created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    Ok(FileInfo {
        name,
        path: filepath,
        size: metadata.len(),
        extension,
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
        created,
        modified,
    })
}

/// File info struct
#[derive(serde::Serialize)]
pub struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: Option<String>,
    is_file: bool,
    is_dir: bool,
    created: Option<u64>,
    modified: Option<u64>,
}

// ============================================================================
// Window Attention Commands
// ============================================================================

/// Flash the window taskbar icon to get user attention
/// Used when receiving notifications while window is not focused
#[tauri::command]
pub async fn request_window_attention(window: Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we bounce the dock icon
        window.request_user_attention(Some(tauri::UserAttentionType::Informational))
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, flash the taskbar icon
        window.request_user_attention(Some(tauri::UserAttentionType::Informational))
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, request attention via the window manager
        window.request_user_attention(Some(tauri::UserAttentionType::Informational))
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// Flash the window urgently (critical notification)
#[tauri::command]
pub async fn request_urgent_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(Some(tauri::UserAttentionType::Critical))
        .map_err(|e| e.to_string())
}

/// Cancel any active window attention request
#[tauri::command]
pub async fn cancel_window_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(None)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Window State Persistence Commands
// ============================================================================

use std::sync::RwLock;
use std::fs;

/// Window state for persistence
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct WindowState {
    /// X position of the window
    pub x: i32,
    /// Y position of the window
    pub y: i32,
    /// Width of the window
    pub width: u32,
    /// Height of the window
    pub height: u32,
    /// Whether the window is maximized
    pub is_maximized: bool,
    /// Whether the window is fullscreen
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
    
    // Update in-memory state
    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = Some(state.clone());
    }
    
    // Persist to disk
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
    // Check cache first
    {
        let cached = WINDOW_STATE.read().map_err(|e| e.to_string())?;
        if let Some(state) = cached.as_ref() {
            return Ok(state.clone());
        }
    }
    
    // Load from disk
    let state_file = get_state_file_path(&app)?;
    
    if !state_file.exists() {
        return Ok(WindowState::default());
    }
    
    let json = fs::read_to_string(&state_file)
        .map_err(|e| format!("Failed to read window state: {}", e))?;
    let state: WindowState = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse window state: {}", e))?;
    
    // Cache for future reads
    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = Some(state.clone());
    }
    
    Ok(state)
}

/// Restore window to saved state
#[tauri::command]
pub async fn restore_window_state(app: AppHandle, window: Window) -> Result<bool, String> {
    let state = load_window_state(app).await?;
    
    // Don't restore if maximized or fullscreen - just restore those flags
    if state.is_fullscreen {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    
    if state.is_maximized {
        window.maximize().map_err(|e| e.to_string())?;
        return Ok(true);
    }
    
    // Restore position and size
    use tauri::{LogicalPosition, LogicalSize};
    
    window.set_position(LogicalPosition::new(state.x as f64, state.y as f64))
        .map_err(|e| e.to_string())?;
    window.set_size(LogicalSize::new(state.width as f64, state.height as f64))
        .map_err(|e| e.to_string())?;
    
    Ok(true)
}

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
    // Clear cache
    {
        let mut cached = WINDOW_STATE.write().map_err(|e| e.to_string())?;
        *cached = None;
    }
    
    // Remove file
    let state_file = get_state_file_path(&app)?;
    if state_file.exists() {
        fs::remove_file(&state_file)
            .map_err(|e| format!("Failed to remove window state file: {}", e))?;
    }
    
    Ok(())
}

// ============================================================================
// Window Opacity Commands
// ============================================================================

use std::sync::atomic::{AtomicU64, Ordering};

/// Stored opacity value (as bits, since AtomicF64 doesn't exist)
static WINDOW_OPACITY: AtomicU64 = AtomicU64::new(0x3FF0000000000000); // 1.0 as f64 bits

/// Set window opacity (transparency level)
/// Opacity value should be between 0.0 (fully transparent) and 1.0 (fully opaque)
/// Note: Actual window transparency requires platform-specific implementations.
/// This stores the preference for the frontend to use with CSS opacity fallback.
#[tauri::command]
pub async fn set_window_opacity(_window: Window, opacity: f64) -> Result<(), String> {
    // Clamp opacity to valid range
    let clamped = opacity.clamp(0.1, 1.0); // Minimum 10% to prevent invisible window
    
    // Store the opacity value
    WINDOW_OPACITY.store(clamped.to_bits(), Ordering::SeqCst);
    
    // Log for debugging
    log::info!("Window opacity set to: {:.0}%", clamped * 100.0);
    
    Ok(())
}

/// Get current window opacity
#[tauri::command]
pub async fn get_window_opacity(_window: Window) -> Result<f64, String> {
    let bits = WINDOW_OPACITY.load(Ordering::SeqCst);
    Ok(f64::from_bits(bits))
}

// ============================================================================
// Mini Mode / Picture-in-Picture Commands
// ============================================================================

use std::sync::RwLock;
use once_cell::sync::Lazy;

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
    pub corner: String, // "top-left", "top-right", "bottom-left", "bottom-right"
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
/// Shrinks the window to a compact size and pins it on top
#[tauri::command]
pub async fn enter_mini_mode(window: Window, corner: Option<String>) -> Result<MiniModeState, String> {
    use tauri::{LogicalPosition, LogicalSize};
    
    // Get current window state to restore later
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let was_always_on_top = window.is_always_on_top().unwrap_or(false);
    
    let selected_corner = corner.unwrap_or_else(|| "bottom-right".to_string());
    
    // Update state
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    state.is_active = true;
    state.previous_x = position.x;
    state.previous_y = position.y;
    state.previous_width = size.width;
    state.previous_height = size.height;
    state.previous_always_on_top = was_always_on_top;
    state.corner = selected_corner.clone();
    
    // Calculate position based on corner
    // We'll get the monitor size to position correctly
    let monitor = window.current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let scale_factor = monitor.scale_factor();
    
    // Convert to logical units
    let screen_width = (monitor_size.width as f64 / scale_factor) as i32;
    let screen_height = (monitor_size.height as f64 / scale_factor) as i32;
    let screen_x = (monitor_pos.x as f64 / scale_factor) as i32;
    let screen_y = (monitor_pos.y as f64 / scale_factor) as i32;
    
    let padding = 20i32;
    let mini_w = state.mini_width as i32;
    let mini_h = state.mini_height as i32;
    
    let (new_x, new_y) = match selected_corner.as_str() {
        "top-left" => (screen_x + padding, screen_y + padding + 30), // +30 for menubar
        "top-right" => (screen_x + screen_width - mini_w - padding, screen_y + padding + 30),
        "bottom-left" => (screen_x + padding, screen_y + screen_height - mini_h - padding - 40), // -40 for dock
        "bottom-right" | _ => (screen_x + screen_width - mini_w - padding, screen_y + screen_height - mini_h - padding - 40),
    };
    
    // Resize and reposition window
    window.set_size(LogicalSize::new(state.mini_width as f64, state.mini_height as f64))
        .map_err(|e| e.to_string())?;
    window.set_position(LogicalPosition::new(new_x as f64, new_y as f64))
        .map_err(|e| e.to_string())?;
    
    // Always on top for mini mode
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    
    // Set minimum size for mini mode (prevent too small)
    window.set_min_size(Some(LogicalSize::new(280.0, 400.0)))
        .map_err(|e| e.to_string())?;
    
    log::info!("Entered mini mode - corner: {}, size: {}x{}", selected_corner, state.mini_width, state.mini_height);
    
    Ok(state.clone())
}

/// Exit mini mode and restore previous window state
#[tauri::command]
pub async fn exit_mini_mode(window: Window) -> Result<MiniModeState, String> {
    use tauri::{LogicalPosition, LogicalSize};
    
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    
    if !state.is_active {
        return Ok(state.clone());
    }
    
    // Restore previous size and position
    window.set_size(LogicalSize::new(state.previous_width as f64, state.previous_height as f64))
        .map_err(|e| e.to_string())?;
    window.set_position(LogicalPosition::new(state.previous_x as f64, state.previous_y as f64))
        .map_err(|e| e.to_string())?;
    
    // Restore always-on-top state
    window.set_always_on_top(state.previous_always_on_top).map_err(|e| e.to_string())?;
    
    // Reset minimum size
    window.set_min_size(Some(LogicalSize::new(800.0, 600.0)))
        .map_err(|e| e.to_string())?;
    
    state.is_active = false;
    
    log::info!("Exited mini mode - restored to {}x{}", state.previous_width, state.previous_height);
    
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

/// Set mini mode dimensions (customize the PiP window size)
#[tauri::command]
pub async fn set_mini_mode_size(width: u32, height: u32) -> Result<(), String> {
    // Validate dimensions
    if width < 280 || height < 400 {
        return Err("Mini mode dimensions too small (min: 280x400)".to_string());
    }
    if width > 600 || height > 800 {
        return Err("Mini mode dimensions too large (max: 600x800)".to_string());
    }
    
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    state.mini_width = width;
    state.mini_height = height;
    
    log::info!("Mini mode size set to {}x{}", width, height);
    Ok(())
}

/// Move mini mode window to a different corner
#[tauri::command]
pub async fn move_mini_mode_corner(window: Window, corner: String) -> Result<MiniModeState, String> {
    use tauri::LogicalPosition;
    
    let mut state = MINI_MODE_STATE.write().map_err(|e| e.to_string())?;
    
    if !state.is_active {
        state.corner = corner;
        return Ok(state.clone());
    }
    
    // Calculate new position
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
    
    state.corner = corner.clone();
    
    log::info!("Mini mode moved to corner: {}", corner);
    Ok(state.clone())
}

// ============================================================================
// Version Tracking (What's New)
// ============================================================================

use std::fs;
use std::path::PathBuf;

fn get_version_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    // Ensure the directory exists
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
        Err(_) => Ok(String::new()) // No version seen yet
    }
}

/// Set the last version the user acknowledged in What's New
#[tauri::command]
pub async fn set_last_seen_version(app: AppHandle, version: String) -> Result<(), String> {
    let version_file = get_version_file_path(&app)?;
    
    fs::write(&version_file, version.trim())
        .map_err(|e| format!("Failed to save version: {}", e))?;
    
    log::info!("Last seen version set to: {}", version.trim());
    Ok(())
}

// ============================================================================
// Window Manager Commands
// ============================================================================

use serde::Serialize;

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
pub async fn get_always_on_top(window: Window) -> Result<bool, String> {
    // Tauri doesn't expose a getter for always-on-top state directly,
    // so we track it via the window state if needed. For now, return false
    // as we can't reliably get this state.
    Ok(false)
}

/// Minimize the window to the system tray
#[tauri::command]
pub async fn minimize_to_tray(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    log::info!("Window minimized to tray");
    Ok(())
}

/// Set window size with logical dimensions
#[tauri::command]
pub async fn set_window_size(window: Window, width: u32, height: u32) -> Result<(), String> {
    window.set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    log::debug!("Window size set to {}x{}", width, height);
    Ok(())
}

/// Set window position with logical coordinates
#[tauri::command]
pub async fn set_window_position(window: Window, x: i32, y: i32) -> Result<(), String> {
    window.set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    log::debug!("Window position set to ({}, {})", x, y);
    Ok(())
}

/// Center the window on the primary monitor
#[tauri::command]
pub async fn center_window(window: Window) -> Result<(), String> {
    window.center().map_err(|e| e.to_string())?;
    log::debug!("Window centered");
    Ok(())
}

/// Toggle window decorations (title bar, borders)
#[tauri::command]
pub async fn toggle_decorations(window: Window) -> Result<bool, String> {
    let is_decorated = window.is_decorated().map_err(|e| e.to_string())?;
    window.set_decorations(!is_decorated).map_err(|e| e.to_string())?;
    log::info!("Window decorations toggled to: {}", !is_decorated);
    Ok(!is_decorated)
}

/// Request user attention for the window
#[tauri::command]
pub async fn request_user_attention(window: Window, critical: bool) -> Result<(), String> {
    use tauri::window::UserAttentionType;
    let attention_type = if critical {
        Some(UserAttentionType::Critical)
    } else {
        Some(UserAttentionType::Informational)
    };
    window.request_user_attention(attention_type)
        .map_err(|e| e.to_string())?;
    log::debug!("Requested user attention (critical: {})", critical);
    Ok(())
}

/// Clear user attention request
#[tauri::command]
pub async fn clear_user_attention(window: Window) -> Result<(), String> {
    window.request_user_attention(None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowState {
    pub is_maximized: bool,
    pub is_minimized: bool,
    pub is_fullscreen: bool,
    pub is_decorated: bool,
    pub is_visible: bool,
    pub is_focused: bool,
    pub position: LogicalPosition<i32>,
    pub size: LogicalSize<u32>,
    pub scale_factor: f64,
}

/// Get comprehensive window state
#[tauri::command]
pub async fn get_window_state(window: Window) -> Result<WindowState, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    
    Ok(WindowState {
        is_maximized: window.is_maximized().map_err(|e| e.to_string())?,
        is_minimized: window.is_minimized().map_err(|e| e.to_string())?,
        is_fullscreen: window.is_fullscreen().map_err(|e| e.to_string())?,
        is_decorated: window.is_decorated().map_err(|e| e.to_string())?,
        is_visible: window.is_visible().map_err(|e| e.to_string())?,
        is_focused: window.is_focused().map_err(|e| e.to_string())?,
        position: LogicalPosition::new(position.x, position.y),
        size: LogicalSize::new(size.width, size.height),
        scale_factor: window.scale_factor().map_err(|e| e.to_string())?,
    })
}

/// Ping server for connection health check
/// Returns immediately - used to measure round-trip latency from frontend
#[tauri::command]
pub async fn ping_server() -> Result<u64, String> {
    // Return timestamp to help calculate latency
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    Ok(timestamp)
}
