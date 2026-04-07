// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod notification_manager;
mod tray;

use notification_manager::NotificationManager;
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(NotificationManager::with_defaults())
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            // Show window on tray icon click
            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            // Start background flush loop for batched notifications
            let manager = app.state::<NotificationManager>().inner().clone();
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
                loop {
                    interval.tick().await;
                    let ready = manager.flush_ready().await;
                    for (title, body, _sound) in ready {
                        if let Err(e) = app_handle
                            .notification()
                            .builder()
                            .title(&title)
                            .body(&body)
                            .show()
                        {
                            log::warn!("Failed to show notification: {}", e);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::queue_notification,
            commands::flush_notifications,
            commands::get_notification_stats,
            commands::update_notification_settings,
            commands::get_notification_settings,
            commands::clear_notifications,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
