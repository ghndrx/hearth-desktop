// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod globalshortcut;
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
        .manage(globalshortcut::ShortcutRegistry::default())
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

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
            commands::get_camera_devices,
            commands::test_camera_connection,
            globalshortcut::register_global_shortcut,
            globalshortcut::unregister_global_shortcut,
            globalshortcut::list_global_shortcuts,
            globalshortcut::is_shortcut_registered,
            globalshortcut::check_shortcut_conflict,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
