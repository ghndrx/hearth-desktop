// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
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
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:hearth.db", database::get_migrations())
                .build(),
        )
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
            // Database commands
            database::db_get_messages,
            database::db_save_message,
            database::db_update_message,
            database::db_delete_message,
            database::db_search_messages,
            database::db_get_direct_messages,
            // Channel commands
            database::db_get_channels,
            database::db_get_channel,
            database::db_save_channel,
            database::db_update_channel,
            database::db_delete_channel,
            // Server commands
            database::db_get_servers,
            database::db_get_server,
            database::db_save_server,
            database::db_delete_server,
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
