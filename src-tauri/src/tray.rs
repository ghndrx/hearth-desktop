use tauri::{
    menu::{Menu, MenuItemBuilder, CheckMenuItemBuilder, SubmenuBuilder, PredefinedMenuItemBuilder, MenuEvent},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, AppHandle,
};

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let menu = create_tray_menu(app)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hearth - Voice Chat")
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| handle_menu_event(app, event))
        .build(app)?;

    Ok(())
}

fn create_tray_menu<R: Runtime>(app: &tauri::App<R>) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    // Voice Controls Section
    let voice_submenu = SubmenuBuilder::new(app, "Voice Controls")
        .items(&[
            &CheckMenuItemBuilder::new(app, "mute", "Mute")
                .checked(false)
                .accelerator("Ctrl+M")
                .build()?,
            &CheckMenuItemBuilder::new(app, "deafen", "Deafen")
                .checked(false)
                .accelerator("Ctrl+D")
                .build()?,
            &PredefinedMenuItemBuilder::new(app, "separator").build()?,
            &CheckMenuItemBuilder::new(app, "transcription", "Live Transcription")
                .checked(false)
                .accelerator("Ctrl+T")
                .build()?,
            &MenuItemBuilder::new(app, "clear_transcription", "Clear Transcription")
                .enabled(false)
                .build()?,
        ])
        .build()?;

    // Status Section
    let status_submenu = SubmenuBuilder::new(app, "Status")
        .items(&[
            &CheckMenuItemBuilder::new(app, "status_online", "Online")
                .checked(true)
                .build()?,
            &CheckMenuItemBuilder::new(app, "status_away", "Away")
                .checked(false)
                .build()?,
            &CheckMenuItemBuilder::new(app, "status_dnd", "Do Not Disturb")
                .checked(false)
                .build()?,
            &CheckMenuItemBuilder::new(app, "status_invisible", "Invisible")
                .checked(false)
                .build()?,
        ])
        .build()?;

    // Main menu
    let menu = Menu::new(app)?
        .add_items(&[
            &MenuItemBuilder::new(app, "show_hide", "Show Hearth")
                .accelerator("Ctrl+Shift+H")
                .build()?,
            &PredefinedMenuItemBuilder::new(app, "separator").build()?,
            &voice_submenu,
            &status_submenu,
            &PredefinedMenuItemBuilder::new(app, "separator").build()?,
            &MenuItemBuilder::new(app, "settings", "Settings")
                .accelerator("Ctrl+,")
                .build()?,
            &MenuItemBuilder::new(app, "about", "About Hearth")
                .build()?,
            &PredefinedMenuItemBuilder::new(app, "separator").build()?,
            &MenuItemBuilder::new(app, "quit", "Quit Hearth")
                .accelerator("Ctrl+Q")
                .build()?,
        ])?;

    Ok(menu)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let window = app.get_webview_window("main");

    match event.id.as_ref() {
        "show_hide" => {
            if let Some(window) = &window {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        },
        "mute" => {
            // Emit event to frontend to toggle mute
            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "toggle_mute"
                }));
            }
        },
        "deafen" => {
            // Emit event to frontend to toggle deafen
            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "toggle_deafen"
                }));
            }
        },
        "transcription" => {
            // Emit event to frontend to toggle transcription
            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "toggle_transcription"
                }));
            }
        },
        "clear_transcription" => {
            // Emit event to frontend to clear transcription
            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "clear_transcription"
                }));
            }
        },
        "status_online" | "status_away" | "status_dnd" | "status_invisible" => {
            let status = match event.id.as_ref() {
                "status_online" => "online",
                "status_away" => "away",
                "status_dnd" => "dnd",
                "status_invisible" => "invisible",
                _ => "online"
            };

            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "set_status",
                    "status": status
                }));
            }
        },
        "settings" => {
            if let Some(window) = &window {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "open_settings"
                }));
            }
        },
        "about" => {
            if let Some(window) = &window {
                let _ = window.emit("tray_menu_action", serde_json::json!({
                    "action": "show_about"
                }));
            }
        },
        "quit" => {
            app.exit(0);
        },
        _ => {}
    }
}
