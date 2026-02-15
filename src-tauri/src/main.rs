// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod deeplink;
mod menu;
mod tray;

use tauri::{GlobalShortcutBuilder, Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .on_window_event(|window, event| {
            // Minimize to tray on close instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Hide the window instead of closing
                let _ = window.hide();
                // Prevent the window from being destroyed
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Set up native menu
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            // Register global shortcuts
            let shortcut_manager = app.global_shortcut_manager();

            // Toggle window visibility with Cmd/Ctrl+Shift+H
            shortcut_manager
                .register("CommandOrControl+Shift+H", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .ok();

            // Show window with Cmd/Ctrl+Shift+S
            shortcut_manager
                .register("CommandOrControl+Shift+S", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .ok();

            // Register deep link handler
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                if let Some(urls) = event.payload().as_str() {
                    // Parse as JSON array of URLs
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(urls) {
                        for url in urls {
                            deeplink::handle_deep_link(&handle, &url);
                        }
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::minimize_window,
            commands::toggle_maximize,
            commands::close_window,
            commands::hide_window,
            commands::show_window,
            commands::is_window_visible,
            commands::set_always_on_top,
            commands::toggle_fullscreen,
            commands::is_auto_start_enabled,
            commands::enable_auto_start,
            commands::disable_auto_start,
            commands::clipboard_write_text,
            commands::clipboard_read_text,
            commands::clipboard_has_text,
            commands::clipboard_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
