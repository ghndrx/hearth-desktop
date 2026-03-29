// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;
mod hotkey;

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
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Set up hotkey manager
            hotkey::setup_hotkey_manager(app.handle())?;
            hotkey::setup_hotkey_event_listener(app.handle())?;

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
            commands::register_hotkey,
            commands::unregister_hotkey,
            commands::update_hotkey,
            commands::get_hotkeys,
            commands::register_hotkeys,
            commands::unregister_all_hotkeys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
