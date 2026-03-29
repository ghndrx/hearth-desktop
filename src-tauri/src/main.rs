// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod global_input;
mod tray;

use tauri::Manager;

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

            // Set up global shortcuts system
            global_input::setup_global_shortcuts(app)?;

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            // Show window on tray icon click
            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            global_input::register_global_shortcut,
            global_input::unregister_global_shortcut,
            global_input::start_input_monitoring,
            global_input::stop_input_monitoring,
            global_input::is_input_monitoring_active,
            global_input::get_available_keys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
