// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod notifications;
mod tray;

use std::sync::Mutex;
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

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            // Show window on tray icon click
            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            // Initialize notification preferences DB
            let app_data = app.path().app_data_dir().expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data).ok();
            let db_path = app_data.join("notifications.db");
            let db = notifications::NotificationDb::new(db_path)
                .expect("failed to open notification preferences database");
            db.init().expect("failed to initialize notification preferences schema");
            app.manage(Mutex::new(db));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::get_badge_count,
            notifications::commands::get_notification_preferences,
            notifications::commands::save_notification_preferences,
            notifications::commands::get_server_notification_level,
            notifications::commands::set_server_notification_level,
            notifications::commands::get_channel_notification_override,
            notifications::commands::set_channel_notification_override,
            notifications::commands::remove_channel_notification_override,
            notifications::commands::get_user_dm_notification_level,
            notifications::commands::set_user_dm_notification_level,
            notifications::commands::get_keyword_triggers,
            notifications::commands::add_keyword_trigger,
            notifications::commands::remove_keyword_trigger,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
