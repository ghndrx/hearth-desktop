use tauri::{
    image::Image as TauriImage,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, AppHandle, Emitter,
};
use std::sync::atomic::{AtomicU32, AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::snooze::{self, SnoozeDuration};

/// Cached original icon RGBA data and dimensions
static ORIGINAL_ICON: once_cell::sync::Lazy<Mutex<Option<(Vec<u8>, u32, u32)>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

/// Global unread count for tray updates
static UNREAD_COUNT: AtomicU32 = AtomicU32::new(0);

/// Global focus mode state
static FOCUS_MODE_ENABLED: AtomicBool = AtomicBool::new(false);

/// Global user presence status (0=online, 1=idle, 2=dnd, 3=invisible)
static USER_STATUS: AtomicU8 = AtomicU8::new(0);

/// User presence status matching frontend PresenceStatus type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserPresenceStatus {
    Online,
    Idle,
    Dnd,
    Invisible,
}

impl UserPresenceStatus {
    fn from_atomic(val: u8) -> Self {
        match val {
            1 => Self::Idle,
            2 => Self::Dnd,
            3 => Self::Invisible,
            _ => Self::Online,
        }
    }

    fn to_atomic(self) -> u8 {
        match self {
            Self::Online => 0,
            Self::Idle => 1,
            Self::Dnd => 2,
            Self::Invisible => 3,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Online => "Online",
            Self::Idle => "Idle",
            Self::Dnd => "Do Not Disturb",
            Self::Invisible => "Invisible",
        }
    }

    fn indicator(self) -> &'static str {
        match self {
            Self::Online => "●",
            Self::Idle => "◐",
            Self::Dnd => "⊘",
            Self::Invisible => "○",
        }
    }

    fn from_str(s: &str) -> Self {
        match s {
            "idle" => Self::Idle,
            "dnd" => Self::Dnd,
            "invisible" => Self::Invisible,
            _ => Self::Online,
        }
    }
}

impl std::fmt::Display for UserPresenceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Online => write!(f, "online"),
            Self::Idle => write!(f, "idle"),
            Self::Dnd => write!(f, "dnd"),
            Self::Invisible => write!(f, "invisible"),
        }
    }
}

/// Global pomodoro tray state
static POMODORO_TIME_REMAINING: AtomicU64 = AtomicU64::new(0);
static POMODORO_IS_RUNNING: AtomicBool = AtomicBool::new(false);
static POMODORO_SESSION_TYPE: AtomicU32 = AtomicU32::new(0); // 0=work, 1=short_break, 2=long_break

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let menu = create_tray_menu(&handle, false)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hearth")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quick_capture" => {
                    if let Some(manager) = app.try_state::<crate::quickcapture::QuickCaptureManager>() {
                        let _ = manager.toggle(app);
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("navigate", "/settings");
                    }
                }
                "toggle_mute" => {
                    // Toggle mute state
                    let muted = crate::commands::toggle_mute().unwrap_or(false);
                    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                    // Update the menu to reflect new state
                    let _ = update_tray_menu(app, muted, focus_mode);
                    
                    // Show a notification toast when muting/unmuting
                    if muted {
                        let _ = app.notification()
                            .builder()
                            .title("Hearth")
                            .body("Notifications muted")
                            .show();
                    }
                }
                "toggle_focus" => {
                    // Toggle focus mode
                    let current = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                    let new_state = !current;
                    FOCUS_MODE_ENABLED.store(new_state, Ordering::Relaxed);

                    let is_muted = crate::commands::is_muted().unwrap_or(false);
                    let _ = update_tray_menu(app, is_muted, new_state);

                    let message = if new_state {
                        "Focus mode enabled - only mentions and DMs"
                    } else {
                        "Focus mode disabled"
                    };

                    // Notify the UI about focus mode change
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("focus-mode-changed", serde_json::json!({
                            "active": new_state,
                            "message": message
                        }));
                    }

                    // Show system notification
                    let _ = app.notification()
                        .builder()
                        .title("Hearth")
                        .body(message)
                        .show();
                }
                // User status menu items
                id if id.starts_with("status_") => {
                    let status_str = &id[7..]; // strip "status_"
                    let new_status = UserPresenceStatus::from_str(status_str);
                    USER_STATUS.store(new_status.to_atomic(), Ordering::Relaxed);

                    // Update tray menu to reflect new status
                    let is_muted = crate::commands::is_muted().unwrap_or(false);
                    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                    let _ = update_tray_menu(app, is_muted, focus_mode);

                    // Emit status change to frontend
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("tray:status-changed", serde_json::json!({
                            "status": new_status.to_string(),
                            "label": new_status.label()
                        }));
                    }
                }
                "toggle_privacy" => {
                    // Toggle privacy mode (boss key)
                    crate::privacy::emit_privacy_toggle(app);
                }
                "check_updates" => {
                    // Trigger update check
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        match crate::updater::check_for_updates(app_handle.clone()).await {
                            Ok(Some(update)) => {
                                // Update available
                                let _ = app_handle.notification()
                                    .builder()
                                    .title("Hearth Update Available")
                                    .body(format!("Version {} is available! (Current: {})", update.version, update.current_version))
                                    .show();
                                
                                // Also emit to UI
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    let _ = window.emit("update:available", update);
                                }
                            }
                            Ok(None) => {
                                // No update available
                                let _ = app_handle.notification()
                                    .builder()
                                    .title("Hearth")
                                    .body("You're running the latest version!")
                                    .show();
                            }
                            Err(e) => {
                                // Failed to check
                                let _ = app_handle.notification()
                                    .builder()
                                    .title("Hearth")
                                    .body(format!("Failed to check for updates: {}", e))
                                    .show();
                            }
                        }
                    });
                }
                // Snooze menu items
                "unsnooze" => {
                    let _ = snooze::end_snooze(app);
                    let is_muted = crate::commands::is_muted().unwrap_or(false);
                    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                    let _ = update_tray_menu(app, is_muted, focus_mode);
                }
                id if id.starts_with("snooze_") => {
                    if let Some(duration) = SnoozeDuration::from_menu_id(id) {
                        let _ = snooze::start_snooze(app, duration);
                        let is_muted = crate::commands::is_muted().unwrap_or(false);
                        let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                        let _ = update_tray_menu(app, is_muted, focus_mode);
                    }
                }
                // Pomodoro menu items
                "pomodoro_start_pause" => {
                    if let Some(manager) = app.try_state::<std::sync::Arc<crate::pomodoro::PomodoroManager>>() {
                        if manager.is_running() {
                            manager.pause();
                        } else {
                            manager.start();
                        }
                        let is_muted = crate::commands::is_muted().unwrap_or(false);
                        let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                        let _ = update_tray_menu(app, is_muted, focus_mode);
                        
                        // Emit event to UI
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("pomodoro:tray-action", serde_json::json!({
                                "action": if manager.is_running() { "started" } else { "paused" }
                            }));
                        }
                    }
                }
                "pomodoro_reset" => {
                    if let Some(manager) = app.try_state::<std::sync::Arc<crate::pomodoro::PomodoroManager>>() {
                        manager.reset();
                        let is_muted = crate::commands::is_muted().unwrap_or(false);
                        let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                        let _ = update_tray_menu(app, is_muted, focus_mode);
                        
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("pomodoro:tray-action", serde_json::json!({ "action": "reset" }));
                        }
                    }
                }
                "pomodoro_skip" => {
                    if let Some(manager) = app.try_state::<std::sync::Arc<crate::pomodoro::PomodoroManager>>() {
                        manager.skip_session();
                        let is_muted = crate::commands::is_muted().unwrap_or(false);
                        let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
                        let _ = update_tray_menu(app, is_muted, focus_mode);
                        
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("pomodoro:tray-action", serde_json::json!({ "action": "skipped" }));
                        }
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn create_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    is_muted: bool,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quick_capture_i = MenuItem::with_id(app, "quick_capture", "Quick Capture", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    
    let mute_text = if is_muted {
        "Unmute Notifications"
    } else {
        "Mute Notifications"
    };
    let toggle_mute_i = MenuItem::with_id(app, "toggle_mute", mute_text, true, None::<&str>)?;
    
    // Focus mode toggle
    let focus_mode_enabled = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
    let focus_text = if focus_mode_enabled {
        "Exit Focus Mode"
    } else {
        "Enter Focus Mode"
    };
    let toggle_focus_i = MenuItem::with_id(app, "toggle_focus", focus_text, true, None::<&str>)?;
    
    // User status submenu
    let current_status = UserPresenceStatus::from_atomic(USER_STATUS.load(Ordering::Relaxed));
    let statuses = [
        UserPresenceStatus::Online,
        UserPresenceStatus::Idle,
        UserPresenceStatus::Dnd,
        UserPresenceStatus::Invisible,
    ];
    let status_items: Vec<MenuItem<R>> = statuses
        .iter()
        .map(|s| {
            let check = if *s == current_status { " ✓" } else { "" };
            let label = format!("{} {}{}", s.indicator(), s.label(), check);
            MenuItem::with_id(app, &format!("status_{}", s), &label, true, None::<&str>)
                .expect("failed to create status menu item")
        })
        .collect();
    let status_refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = status_items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<R>).collect();
    let status_submenu = Submenu::with_items(
        app,
        &format!("Status: {}", current_status.label()),
        true,
        &status_refs,
    )?;

    // Snooze submenu
    let snooze_status = snooze::get_snooze_status();
    let snooze_submenu = if snooze_status.active {
        // Show active snooze status with option to cancel
        let remaining = snooze::get_snooze_remaining_text().unwrap_or_else(|| "Active".to_string());
        let status_item = MenuItem::with_id(app, "snooze_status", &format!("⏸ {}", remaining), false, None::<&str>)?;
        let unsnooze_item = MenuItem::with_id(app, "unsnooze", "End Snooze", true, None::<&str>)?;
        
        Submenu::with_items(app, "Snooze Notifications", true, &[&status_item, &unsnooze_item])?
    } else {
        // Show snooze duration options
        let snooze_15m = MenuItem::with_id(app, "snooze_15m", "15 minutes", true, None::<&str>)?;
        let snooze_30m = MenuItem::with_id(app, "snooze_30m", "30 minutes", true, None::<&str>)?;
        let snooze_1h = MenuItem::with_id(app, "snooze_1h", "1 hour", true, None::<&str>)?;
        let snooze_2h = MenuItem::with_id(app, "snooze_2h", "2 hours", true, None::<&str>)?;
        let snooze_4h = MenuItem::with_id(app, "snooze_4h", "4 hours", true, None::<&str>)?;
        let snooze_sep = PredefinedMenuItem::separator(app)?;
        let snooze_tomorrow = MenuItem::with_id(app, "snooze_tomorrow", "Until tomorrow", true, None::<&str>)?;
        
        Submenu::with_items(
            app,
            "Snooze Notifications",
            true,
            &[&snooze_15m, &snooze_30m, &snooze_1h, &snooze_2h, &snooze_4h, &snooze_sep, &snooze_tomorrow],
        )?
    };
    
    // Pomodoro submenu
    let pomodoro_time = get_pomodoro_time_display();
    let pomodoro_running = POMODORO_IS_RUNNING.load(Ordering::Relaxed);
    let pomodoro_session = match POMODORO_SESSION_TYPE.load(Ordering::Relaxed) {
        1 => "☕",
        2 => "🌴",
        _ => "🍅",
    };
    let pomodoro_status = MenuItem::with_id(app, "pomodoro_status", 
        &format!("{} {} {}", pomodoro_session, if pomodoro_running { "▶" } else { "⏸" }, pomodoro_time), 
        false, None::<&str>)?;
    let pomodoro_start_pause_text = if pomodoro_running { "⏸ Pause" } else { "▶ Start" };
    let pomodoro_start_pause_i = MenuItem::with_id(app, "pomodoro_start_pause", pomodoro_start_pause_text, true, None::<&str>)?;
    let pomodoro_reset_i = MenuItem::with_id(app, "pomodoro_reset", "↻ Reset", true, None::<&str>)?;
    let pomodoro_skip_i = MenuItem::with_id(app, "pomodoro_skip", "⏭ Skip", true, None::<&str>)?;
    let pomodoro_sep = PredefinedMenuItem::separator(app)?;
    
    let pomodoro_submenu = Submenu::with_items(
        app,
        "Pomodoro Timer",
        true,
        &[&pomodoro_status, &pomodoro_sep, &pomodoro_start_pause_i, &pomodoro_reset_i, &pomodoro_skip_i],
    )?;
    
    // Privacy mode toggle (boss key)
    let toggle_privacy_i = MenuItem::with_id(app, "toggle_privacy", "Privacy Mode (⇧⌘L)", true, None::<&str>)?;
    
    // Check for updates
    let check_updates_i = MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?;
    
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_i,
        &hide_i,
        &quick_capture_i,
        &settings_i,
        &separator,
        &status_submenu,
        &toggle_mute_i,
        &toggle_focus_i,
        &snooze_submenu,
        &pomodoro_submenu,
        &toggle_privacy_i,
        &check_updates_i,
        &separator2,
        &quit_i
    ])?;
    Ok(menu)
}

fn update_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    is_muted: bool,
    is_focus_mode: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main") {
        let new_menu = create_tray_menu(app, is_muted)?;
        tray.set_menu(Some(new_menu))?;
    }
    Ok(())
}

/// Update tray menu from external calls (e.g., when mute is toggled via keyboard shortcut)
pub fn update_tray_mute_state<R: Runtime>(
    app: &AppHandle<R>,
    is_muted: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
    update_tray_menu(app, is_muted, focus_mode)
}

/// Update focus mode state from external calls
pub fn update_tray_focus_state<R: Runtime>(
    app: &AppHandle<R>,
    is_focus_mode: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    FOCUS_MODE_ENABLED.store(is_focus_mode, Ordering::Relaxed);
    let is_muted = crate::commands::is_muted().unwrap_or(false);
    update_tray_menu(app, is_muted, is_focus_mode)
}

/// Get current focus mode state
pub fn is_focus_mode_enabled() -> bool {
    FOCUS_MODE_ENABLED.load(Ordering::Relaxed)
}

/// Update the tray icon tooltip to show unread count
pub fn update_tray_tooltip<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let count = UNREAD_COUNT.load(Ordering::Relaxed);
    let tooltip = if count > 0 {
        format!("Hearth ({} unread)", count)
    } else {
        "Hearth".to_string()
    };
    
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip))?;
    }
    
    Ok(())
}

/// Set the unread message count and update tray
pub fn set_unread_count<R: Runtime>(
    app: &AppHandle<R>,
    count: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    UNREAD_COUNT.store(count, Ordering::Relaxed);
    update_tray_tooltip(app)?;
    Ok(())
}

/// Get current unread count
pub fn get_unread_count() -> u32 {
    UNREAD_COUNT.load(Ordering::Relaxed)
}

/// Get formatted pomodoro time for tray display
fn get_pomodoro_time_display() -> String {
    let seconds = POMODORO_TIME_REMAINING.load(Ordering::Relaxed);
    let minutes = seconds / 60;
    let secs = seconds % 60;
    format!("{:02}:{:02}", minutes, secs)
}

/// Update pomodoro state from the timer
pub fn update_pomodoro_state(
    time_remaining: u64,
    is_running: bool,
    session_type: crate::pomodoro::SessionType,
) {
    POMODORO_TIME_REMAINING.store(time_remaining, Ordering::Relaxed);
    POMODORO_IS_RUNNING.store(is_running, Ordering::Relaxed);
    let session_num = match session_type {
        crate::pomodoro::SessionType::Work => 0,
        crate::pomodoro::SessionType::ShortBreak => 1,
        crate::pomodoro::SessionType::LongBreak => 2,
    };
    POMODORO_SESSION_TYPE.store(session_num, Ordering::Relaxed);
}

/// Get current user presence status
pub fn get_user_status() -> UserPresenceStatus {
    UserPresenceStatus::from_atomic(USER_STATUS.load(Ordering::Relaxed))
}

/// Set user presence status from frontend and update tray
pub fn set_user_status_value<R: Runtime>(
    app: &AppHandle<R>,
    status: UserPresenceStatus,
) -> Result<(), Box<dyn std::error::Error>> {
    USER_STATUS.store(status.to_atomic(), Ordering::Relaxed);
    let is_muted = crate::commands::is_muted().unwrap_or(false);
    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
    update_tray_menu(app, is_muted, focus_mode)
}

/// Update tray menu with pomodoro state (call this when pomodoro state changes)
pub fn update_tray_pomodoro_state<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let is_muted = crate::commands::is_muted().unwrap_or(false);
    let focus_mode = FOCUS_MODE_ENABLED.load(Ordering::Relaxed);
    update_tray_menu(app, is_muted, focus_mode)?;
    
    // Also update tooltip to show pomodoro status
    update_tray_tooltip_with_pomodoro(app)?;
    
    Ok(())
}

/// Update tray tooltip to include pomodoro status
fn update_tray_tooltip_with_pomodoro<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let count = UNREAD_COUNT.load(Ordering::Relaxed);
    let pomodoro_time = get_pomodoro_time_display();
    let pomodoro_running = POMODORO_IS_RUNNING.load(Ordering::Relaxed);
    let pomodoro_session = match POMODORO_SESSION_TYPE.load(Ordering::Relaxed) {
        1 => "☕ Break",
        2 => "🌴 Long Break",
        _ => "🍅 Focus",
    };
    
    let mut tooltip = String::from("Hearth");
    
    // Add pomodoro status
    if pomodoro_running {
        tooltip.push_str(&format!("\n{} {} (running)", pomodoro_session, pomodoro_time));
    } else if POMODORO_TIME_REMAINING.load(Ordering::Relaxed) > 0 {
        tooltip.push_str(&format!("\n{} {} (paused)", pomodoro_session, pomodoro_time));
    }
    
    // Add unread count if any
    if count > 0 {
        tooltip.push_str(&format!("\n{} unread messages", count));
    }

    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip))?;
    }

    Ok(())
}

// --- Tauri commands for user status ---

/// Get the current tray user status
#[tauri::command]
pub fn tray_get_user_status() -> String {
    get_user_status().to_string()
}

/// Set the tray user status from the frontend
#[tauri::command]
pub fn tray_set_user_status(app: AppHandle, status: String) -> Result<String, String> {
    let parsed = UserPresenceStatus::from_str(&status);
    set_user_status_value(&app, parsed).map_err(|e| e.to_string())?;
    Ok(parsed.to_string())
}

// ============================================================================
// Tray Icon Badge Rendering
// ============================================================================

/// Cache the original tray icon on first use
fn cache_original_icon<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let mut guard = ORIGINAL_ICON.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let icon = app
        .default_window_icon()
        .ok_or("No default window icon")?;
    let rgba = icon.rgba().to_vec();
    let w = icon.width();
    let h = icon.height();
    *guard = Some((rgba, w, h));
    Ok(())
}

/// Render a red badge circle with a count number onto an RGBA image buffer.
/// Returns a new RGBA buffer with the badge composited in the bottom-right corner.
fn render_badge_on_icon(
    rgba: &[u8],
    width: u32,
    height: u32,
    count: u32,
) -> Vec<u8> {
    let mut out = rgba.to_vec();
    let w = width as i32;
    let h = height as i32;

    // Badge occupies roughly 45% of the icon in the bottom-right
    let badge_radius = (w.min(h) as f64 * 0.22).round() as i32;
    let cx = w - badge_radius - 1;
    let cy = h - badge_radius - 1;

    // Draw filled red circle
    let r2 = (badge_radius * badge_radius) as i64;
    let aa_r2 = ((badge_radius + 1) * (badge_radius + 1)) as i64;

    for py in (cy - badge_radius - 1).max(0)..=(cy + badge_radius + 1).min(h - 1) {
        for px in (cx - badge_radius - 1).max(0)..=(cx + badge_radius + 1).min(w - 1) {
            let dx = (px - cx) as i64;
            let dy = (py - cy) as i64;
            let dist2 = dx * dx + dy * dy;

            if dist2 <= aa_r2 {
                let idx = ((py * w + px) * 4) as usize;
                if idx + 3 >= out.len() {
                    continue;
                }

                // Anti-aliased alpha based on distance from edge
                let alpha = if dist2 <= r2 {
                    255u8
                } else {
                    let edge_dist = (dist2 as f64).sqrt() - badge_radius as f64;
                    (255.0 * (1.0 - edge_dist).max(0.0)) as u8
                };

                // Red badge color (0xED, 0x4245) - Discord-style red
                let badge_r = 237u8;
                let badge_g = 66u8;
                let badge_b = 69u8;

                if alpha == 255 {
                    out[idx] = badge_r;
                    out[idx + 1] = badge_g;
                    out[idx + 2] = badge_b;
                    out[idx + 3] = 255;
                } else if alpha > 0 {
                    // Alpha blend
                    let a = alpha as f64 / 255.0;
                    let inv = 1.0 - a;
                    out[idx] = (badge_r as f64 * a + out[idx] as f64 * inv) as u8;
                    out[idx + 1] = (badge_g as f64 * a + out[idx + 1] as f64 * inv) as u8;
                    out[idx + 2] = (badge_b as f64 * a + out[idx + 2] as f64 * inv) as u8;
                    out[idx + 3] = (alpha as u16 + out[idx + 3] as u16 * (255 - alpha) as u16 / 255) as u8;
                }
            }
        }
    }

    // Draw the count text as simple pixel digits
    let text = if count > 99 { "99+".to_string() } else { count.to_string() };
    draw_badge_text(&mut out, w, h, cx, cy, badge_radius, &text);

    out
}

/// Draw simple pixel-art digits centered in the badge circle.
/// Each digit is rendered from a 3x5 bitmap font at a scale appropriate for the badge.
fn draw_badge_text(
    buf: &mut [u8],
    w: i32,
    h: i32,
    cx: i32,
    cy: i32,
    badge_radius: i32,
    text: &str,
) {
    // 3x5 bitmap font for digits 0-9 and '+'
    let glyphs: &[(&str, [u8; 5])] = &[
        ("0", [0b111, 0b101, 0b101, 0b101, 0b111]),
        ("1", [0b010, 0b110, 0b010, 0b010, 0b111]),
        ("2", [0b111, 0b001, 0b111, 0b100, 0b111]),
        ("3", [0b111, 0b001, 0b111, 0b001, 0b111]),
        ("4", [0b101, 0b101, 0b111, 0b001, 0b001]),
        ("5", [0b111, 0b100, 0b111, 0b001, 0b111]),
        ("6", [0b111, 0b100, 0b111, 0b101, 0b111]),
        ("7", [0b111, 0b001, 0b010, 0b010, 0b010]),
        ("8", [0b111, 0b101, 0b111, 0b101, 0b111]),
        ("9", [0b111, 0b101, 0b111, 0b001, 0b111]),
        ("+", [0b000, 0b010, 0b111, 0b010, 0b000]),
    ];

    // Scale factor: each font pixel maps to `scale` real pixels
    let scale = (badge_radius as f64 * 0.28).round().max(1.0) as i32;
    let char_w = 3 * scale;
    let char_h = 5 * scale;
    let gap = scale.max(1);
    let total_w: i32 = text.len() as i32 * char_w + (text.len() as i32 - 1).max(0) * gap;

    let start_x = cx - total_w / 2;
    let start_y = cy - char_h / 2;

    for (ci, ch) in text.chars().enumerate() {
        let ch_str = ch.to_string();
        let glyph = glyphs.iter().find(|(c, _)| *c == ch_str);
        let bitmap = match glyph {
            Some((_, bm)) => bm,
            None => continue,
        };

        let ox = start_x + ci as i32 * (char_w + gap);

        for row in 0..5 {
            for col in 0..3 {
                if bitmap[row as usize] & (1 << (2 - col)) != 0 {
                    // Draw a scale x scale block
                    for sy in 0..scale {
                        for sx in 0..scale {
                            let px = ox + col * scale + sx;
                            let py = start_y + row * scale + sy;
                            if px >= 0 && px < w && py >= 0 && py < h {
                                let idx = ((py * w + px) * 4) as usize;
                                if idx + 3 < buf.len() {
                                    buf[idx] = 255;     // white text
                                    buf[idx + 1] = 255;
                                    buf[idx + 2] = 255;
                                    buf[idx + 3] = 255;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Set tray icon badge with unread count. Count of 0 resets to the original icon.
#[tauri::command]
pub fn set_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    cache_original_icon(&app)?;

    let guard = ORIGINAL_ICON.lock().map_err(|e| e.to_string())?;
    let (rgba, w, h) = guard.as_ref().ok_or("Icon not cached")?;

    let icon_data = if count > 0 {
        render_badge_on_icon(rgba, *w, *h, count)
    } else {
        rgba.clone()
    };

    let new_icon = TauriImage::new_owned(icon_data, *w, *h);

    if let Some(tray) = app.tray_by_id("main") {
        tray.set_icon(Some(new_icon)).map_err(|e| e.to_string())?;
    }

    // Also update tooltip and internal count
    set_unread_count(&app, count).map_err(|e| e.to_string())?;

    Ok(())
}
