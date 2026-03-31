use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let menu = create_tray_menu(app)?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hearth")
        .menu(&menu)
        .menu_on_left_click(false)
        .id("main")
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();
            match event_id {
                "toggle_mute" => {
                    let _ = app.emit("tray-toggle-mute", ());
                }
                "toggle_deafen" => {
                    let _ = app.emit("tray-toggle-deafen", ());
                }
                "status_online" => {
                    let _ = app.emit("tray-set-status", "online");
                }
                "status_away" => {
                    let _ = app.emit("tray-set-status", "away");
                }
                "status_dnd" => {
                    let _ = app.emit("tray-set-status", "dnd");
                }
                "status_invisible" => {
                    let _ = app.emit("tray-set-status", "invisible");
                }
                "show_main" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "settings" => {
                    let _ = app.emit("tray-open-settings", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

fn create_tray_menu<R: Runtime>(app: &tauri::App<R>) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let mute_item = MenuItem::with_id(app, "toggle_mute", "Toggle Mute", true, None::<&str>)?;
    let deafen_item = MenuItem::with_id(app, "toggle_deafen", "Toggle Deafen", true, None::<&str>)?;

    let voice_submenu = Submenu::with_id_and_items(
        app,
        "voice_controls",
        "Voice Controls",
        true,
        &[&mute_item, &deafen_item]
    )?;

    let status_online = MenuItem::with_id(app, "status_online", "Online", true, None::<&str>)?;
    let status_away = MenuItem::with_id(app, "status_away", "Away", true, None::<&str>)?;
    let status_dnd = MenuItem::with_id(app, "status_dnd", "Do Not Disturb", true, None::<&str>)?;
    let status_invisible = MenuItem::with_id(app, "status_invisible", "Invisible", true, None::<&str>)?;

    let status_submenu = Submenu::with_id_and_items(
        app,
        "status",
        "Set Status",
        true,
        &[&status_online, &status_away, &status_dnd, &status_invisible]
    )?;

    let show_item = MenuItem::with_id(app, "show_main", "Show Hearth", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit_item = PredefinedMenuItem::quit(app, Some("Quit Hearth"))?;

    Menu::with_items(app, &[
        &voice_submenu,
        &status_submenu,
        &PredefinedMenuItem::separator(app)?,
        &show_item,
        &settings_item,
        &PredefinedMenuItem::separator(app)?,
        &quit_item
    ])
}
