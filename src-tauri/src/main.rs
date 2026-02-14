// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;

use tauri::{
    Manager,
    GlobalShortcutBuilder
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            // Show window on tray icon click
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
