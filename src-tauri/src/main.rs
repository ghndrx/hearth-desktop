// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod overlay;
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
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Set up overlay window
            overlay::setup_overlay(&app.handle())?;

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
            commands::enumerate_sources,
            commands::show_overlay,
            commands::hide_overlay,
            commands::toggle_overlay,
            commands::set_overlay_position,
            commands::set_overlay_size,
            commands::set_overlay_opacity,
            commands::get_overlay_state,
            commands::check_overlay_support,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
