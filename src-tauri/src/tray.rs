use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, AppHandle,
};
use std::sync::atomic::{AtomicU32, AtomicBool, AtomicU64, Ordering};
use crate::snooze::{self, SnoozeDuration};

/// Global unread count for tray updates
static UNREAD_COUNT: AtomicU32 = AtomicU32::new(0);

/// Global focus mode state
static FOCUS_MODE_ENABLED: AtomicBool = AtomicBool::new(false);

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
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
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
        &separator, 
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
