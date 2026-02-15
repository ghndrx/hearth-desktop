// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod commands;
mod deeplink;
mod menu;
mod tray;
mod updater;

use tauri::{GlobalShortcutBuilder, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .on_window_event(|window, event| {
            // Minimize to tray on close instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Save window state before hiding
                let _ = window.app_handle().save_window_state(StateFlags::all());
                // Hide the window instead of closing
                let _ = window.hide();
                // Prevent the window from being destroyed
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Set up native menu
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;

            // Get main window
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            window.set_decorations(true)?;

            // Register global shortcuts
            let shortcut_manager = app.global_shortcut_manager();

            // Toggle window visibility with Cmd/Ctrl+Shift+H
            shortcut_manager
                .register("CommandOrControl+Shift+H", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .ok();

            // Show window with Cmd/Ctrl+Shift+S
            shortcut_manager
                .register("CommandOrControl+Shift+S", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .ok();

            // Toggle mute with Cmd/Ctrl+Shift+M
            shortcut_manager
                .register("CommandOrControl+Shift+M", {
                    let app_handle = app.handle().clone();
                    move || {
                        let muted = crate::commands::toggle_mute().unwrap_or(false);
                        // Update the tray menu to reflect new state
                        let _ = crate::tray::update_tray_mute_state(&app_handle, muted);
                        
                        // Show a toast notification via the window
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let message = if muted {
                                "Notifications muted"
                            } else {
                                "Notifications unmuted"
                            };
                            let _ = window.emit("mute-state-changed", serde_json::json!({
                                "muted": muted,
                                "message": message
                            }));
                        }
                    }
                })
                .ok();

            // Toggle focus mode with Cmd/Ctrl+Shift+F
            shortcut_manager
                .register("CommandOrControl+Shift+F", {
                    let app_handle = app.handle().clone();
                    move || {
                        let active = crate::commands::toggle_focus_mode().unwrap_or(false);
                        // Update the tray menu to reflect new state
                        let _ = crate::tray::update_tray_focus_state(&app_handle, active);
                        
                        // Show a toast notification via the window
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let message = if active {
                                "Focus mode enabled - only mentions and DMs"
                            } else {
                                "Focus mode disabled"
                            };
                            let _ = window.emit("focus-mode-changed", serde_json::json!({
                                "active": active,
                                "message": message
                            }));
                        }
                    }
                })
                .ok();

            // Register deep link handler
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                if let Some(urls) = event.payload().as_str() {
                    // Parse as JSON array of URLs
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(urls) {
                        for url in urls {
                            deeplink::handle_deep_link(&handle, &url);
                        }
                    }
                }
            });

            // Check for updates on startup (async, non-blocking)
            let update_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_updates_on_startup(update_handle).await;
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
            commands::set_badge_count,
            commands::minimize_window,
            commands::toggle_maximize,
            commands::close_window,
            commands::hide_window,
            commands::show_window,
            commands::is_window_visible,
            commands::set_always_on_top,
            commands::toggle_fullscreen,
            commands::is_auto_start_enabled,
            commands::enable_auto_start,
            commands::disable_auto_start,
            commands::clipboard_write_text,
            commands::clipboard_read_text,
            commands::clipboard_has_text,
            commands::clipboard_clear,
            // Quick Mute commands
            commands::toggle_mute,
            commands::is_muted,
            commands::set_mute,
            // Tray badge commands
            commands::update_tray_badge,
            commands::get_tray_badge,
            // Focus Mode commands
            commands::toggle_focus_mode,
            commands::is_focus_mode_active,
            commands::set_focus_mode,
            updater::check_for_updates,
            updater::download_and_install_update,
            // Activity detection for rich presence
            activity::get_running_activities,
            activity::get_idle_status,
            activity::get_idle_status_with_threshold,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
