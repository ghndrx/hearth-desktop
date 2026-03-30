// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;
mod global_input;

use tauri::Manager;
use std::sync::{Arc, Mutex};
use global_input::GlobalInputManager;

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

            // Set up global input manager
            let mut input_manager = GlobalInputManager::new();
            input_manager.set_app_handle(app.app_handle().clone());

            // Start monitoring global input events
            input_manager.start_monitoring()
                .map_err(|e| format!("Failed to start global input monitoring: {}", e))?;

            // Store the input manager in app state
            app.manage(Arc::new(Mutex::new(input_manager)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::get_capture_devices,
            commands::init_camera_capture,
            commands::capture_frame,
            commands::get_screens,
            commands::capture_screen,
            commands::capture_screen_by_index,
            commands::register_global_shortcut,
            commands::unregister_global_shortcut,
            commands::get_global_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
