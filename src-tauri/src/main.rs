// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;

use tauri::Manager;
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyEventReceiver};
use std::sync::mpsc;

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

            // Initialize hotkey manager
            let _ = commands::init_hotkey_manager().await;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::init_hotkey_manager,
            commands::register_hotkey,
            commands::unregister_hotkey,
            commands::is_hotkey_registered,
            commands::get_registered_hotkeys,
            commands::enumerate_sources,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
