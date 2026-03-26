// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod tray;
mod transcription;

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
        .manage(transcription::TranscriptionManager::default())
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
            // Transcription commands
            transcription::transcription_list_models,
            transcription::transcription_download_model,
            transcription::transcription_load_model,
            transcription::transcription_unload_model,
            transcription::transcription_transcribe,
            transcription::transcription_start_live,
            transcription::transcription_stop_live,
            transcription::transcription_live_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
