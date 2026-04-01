// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcut, GlobalShortcutExt, Modifiers};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;
            
            // Get main window
            let window = app.get_webview_window("main").unwrap();
            
            // Show window on tray icon click
            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            // Register global shortcut to toggle window visibility
            let app_handle = app.app_handle().clone();
            app.global_shortcut().register(
                GlobalShortcut::new(Modifiers::CTRL | Modifiers::SHIFT, Code::KeyH),
                move || {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        match window.is_visible() {
                            Ok(true) => {
                                let _ = window.hide();
                            }
                            _ => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                },
            )?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::toggle_window,
            commands::get_available_screens,
            commands::capture_screenshot,
            commands::check_screen_capture_permissions,
            commands::request_screen_capture_permissions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
