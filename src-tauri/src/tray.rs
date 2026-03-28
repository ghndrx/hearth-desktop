use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Create tray menu
    let show_hide_item = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
    let separator = MenuItem::separator(app)?;
    let status_item = MenuItem::with_id(app, "status", "Status: Online", false, None::<&str>)?;
    let separator2 = MenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Hearth", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_hide_item,
        &separator,
        &status_item,
        &separator2,
        &quit_item,
    ])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hearth - Click to toggle window")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show_hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        match window.is_visible() {
                            Ok(true) => {
                                let _ = window.hide();
                            }
                            Ok(false) => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            Err(_) => {
                                // Fallback: try to show window
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
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
                    match window.is_visible() {
                        Ok(true) => {
                            let _ = window.hide();
                        }
                        Ok(false) => {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        Err(_) => {
                            // Fallback: try to show window
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
