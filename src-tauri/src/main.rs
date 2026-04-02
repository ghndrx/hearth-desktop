// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;

use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

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

            // Set up default global shortcuts
            let app_handle = app.handle().clone();
            let toggle_shortcut = if cfg!(target_os = "macos") {
                "cmd+shift+space"
            } else {
                "ctrl+shift+space"
            };

            if let Ok(shortcut) = toggle_shortcut.parse::<Shortcut>() {
                let _ = app.global_shortcut().register(shortcut);
                println!("Registered default global shortcut: {}", toggle_shortcut);
            }

            // Handle global shortcut events
            app.listen("shortcut", move |event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = if window.is_visible().unwrap_or(false) {
                        window.hide()
                    } else {
                        window.show().and_then(|_| window.set_focus())
                    };
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::register_global_shortcut,
            commands::unregister_global_shortcut,
            commands::is_global_shortcut_registered,
            commands::unregister_all_global_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
