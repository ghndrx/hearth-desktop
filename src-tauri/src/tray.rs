use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, AppHandle, State,
};
use std::sync::atomic::{AtomicU32, AtomicBool, Ordering};

/// Global unread count for tray updates
static UNREAD_COUNT: AtomicU32 = AtomicU32::new(0);

/// Global focus mode state
static FOCUS_MODE_ENABLED: AtomicBool = AtomicBool::new(false);

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
                    
                    // Notify the UI about focus mode change
                    if let Some(window) = app.get_webview_window("main") {
                        let message = if new_state {
                            "Focus mode enabled - only mentions and DMs"
                        } else {
                            "Focus mode disabled"
                        };
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
    
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_i, &hide_i, &separator, &toggle_mute_i, &toggle_focus_i, &separator2, &quit_i])?;
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
