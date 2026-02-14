use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager, Runtime, Wry,
};

pub fn create_menu(app: &AppHandle<Wry>) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    // File menu
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "new_chat", "New Chat", true, Some("CommandOrControl+N"))?,
            &MenuItem::with_id(app, "new_room", "New Room", true, Some("CommandOrControl+Shift+N"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Settings...", true, Some("CommandOrControl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(app, Some("Quit"))?,
        ],
    )?;

    // Edit menu
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Undo"))?,
            &PredefinedMenuItem::redo(app, Some("Redo"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cut"))?,
            &PredefinedMenuItem::copy(app, Some("Copy"))?,
            &PredefinedMenuItem::paste(app, Some("Paste"))?,
            &PredefinedMenuItem::select_all(app, Some("Select All"))?,
        ],
    )?;

    // View menu
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "toggle_sidebar", "Toggle Sidebar", true, Some("CommandOrControl+\\"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CommandOrControl+Plus"))?,
            &MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CommandOrControl+-"))?,
            &MenuItem::with_id(app, "zoom_reset", "Actual Size", true, Some("CommandOrControl+0"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "toggle_fullscreen", "Toggle Full Screen", true, Some("F11"))?,
            &MenuItem::with_id(app, "reload", "Reload", true, Some("CommandOrControl+R"))?,
            #[cfg(debug_assertions)]
            &MenuItem::with_id(app, "dev_tools", "Developer Tools", true, Some("CommandOrControl+Shift+I"))?,
        ],
    )?;

    // Help menu
    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &MenuItem::with_id(app, "docs", "Documentation", true, None::<&str>)?,
            &MenuItem::with_id(app, "report_issue", "Report Issue", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &MenuItem::with_id(app, "about", "About Hearth", true, None::<&str>)?,
        ],
    )?;

    // macOS App menu
    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "Hearth",
            true,
            &[
                &PredefinedMenuItem::about(
                    app,
                    Some("About Hearth"),
                    Some(AboutMetadata {
                        name: Some("Hearth".to_string()),
                        version: Some(env!("CARGO_PKG_VERSION").to_string()),
                        short_version: None,
                        authors: Some(vec!["Greg Hendrickson".to_string()]),
                        comments: Some("Self-hosted chat platform".to_string()),
                        copyright: Some("© 2026 Hearth".to_string()),
                        license: Some("MIT".to_string()),
                        website: Some("https://hearth.chat".to_string()),
                        website_label: Some("Website".to_string()),
                        credits: None,
                        icon: None,
                    }),
                )?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "settings", "Settings...", true, Some("CommandOrControl+,"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, Some("Services"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, Some("Hide Hearth"))?,
                &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
                &PredefinedMenuItem::show_all(app, Some("Show All"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, Some("Quit Hearth"))?,
            ],
        )?;

        let window_menu = Submenu::with_items(
            app,
            "Window",
            true,
            &[
                &PredefinedMenuItem::minimize(app, Some("Minimize"))?,
                &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::close_window(app, Some("Close"))?,
            ],
        )?;

        return Ok(Menu::with_items(
            app,
            &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
        )?);
    }

    #[cfg(not(target_os = "macos"))]
    Ok(Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &view_menu, &help_menu],
    )?)
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };

    match event_id {
        "new_chat" => {
            let _ = window.emit("menu:new_chat", ());
        }
        "new_room" => {
            let _ = window.emit("menu:new_room", ());
        }
        "settings" => {
            let _ = window.emit("menu:settings", ());
        }
        "toggle_sidebar" => {
            let _ = window.emit("menu:toggle_sidebar", ());
        }
        "zoom_in" => {
            let _ = window.eval("document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1).toString()");
        }
        "zoom_out" => {
            let _ = window.eval("document.body.style.zoom = Math.max(0.5, (parseFloat(document.body.style.zoom || 1) - 0.1)).toString()");
        }
        "zoom_reset" => {
            let _ = window.eval("document.body.style.zoom = '1'");
        }
        "toggle_fullscreen" => {
            if let Ok(is_fullscreen) = window.is_fullscreen() {
                let _ = window.set_fullscreen(!is_fullscreen);
            }
        }
        "reload" => {
            let _ = window.eval("window.location.reload()");
        }
        #[cfg(debug_assertions)]
        "dev_tools" => {
            let _ = window.open_devtools();
        }
        "docs" => {
            let _ = open::that("https://hearth.chat/docs");
        }
        "report_issue" => {
            let _ = open::that("https://github.com/greghendrickson/hearth-desktop/issues");
        }
        "check_updates" => {
            let _ = window.emit("menu:check_updates", ());
        }
        "about" => {
            let _ = window.emit("menu:about", ());
        }
        _ => {}
    }
}
