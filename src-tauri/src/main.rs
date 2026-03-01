// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod accessibility;
mod activity;
mod audio;
mod autoaway;
mod backup;
mod badge;
mod clipboard;
mod commands;
mod deeplink;
mod dnd;
mod drafts;
mod fileassoc;
mod filedrop;
mod globalshortcut;
mod linkpreview;
mod mediasession;
mod menu;
mod notification_center;
mod performance;
mod power;
mod privacy;
mod screenshot;
mod smartstatus;
mod snooze;
mod spellcheck;
mod sysinfo;
mod taskbar;
mod theme;
mod storage;
mod systemmonitor;
mod tray;
mod tts;
mod updater;
mod workspaceprofiles;
mod tabs;
mod quickcapture;
mod touchbar;
mod network;
mod filewatcher;
mod sessionlock;
mod quickreply;
mod sessionrestore;
mod privacylock;
mod voicerecorder;
mod dictation;
mod localsearch;
mod bandwidth;
mod calendar;
mod nativeauth;
mod qrcode;
mod scheduler;
mod hotcorners;
mod applog;
mod diagnostics;

use tauri::{DragDropEvent, GlobalShortcutBuilder, Manager, WindowEvent};
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
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            // When a second instance is launched, focus the existing window
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
            
            // Handle deep link URLs from the second instance arguments
            for arg in args {
                if arg.starts_with("hearth://") {
                    deeplink::handle_deep_link(app, &arg);
                }
            }
        }))
        .on_window_event(|window, event| {
            match event {
                // Minimize to tray on close instead of quitting
                WindowEvent::CloseRequested { api, .. } => {
                    // Save window state before hiding
                    let _ = window.app_handle().save_window_state(StateFlags::all());
                    // Hide the window instead of closing
                    let _ = window.hide();
                    // Prevent the window from being destroyed
                    api.prevent_close();
                }
                // Handle native file drag-and-drop
                WindowEvent::DragDrop(drag_event) => {
                    match drag_event {
                        DragDropEvent::Enter { paths, position } => {
                            // Files being dragged over window
                            filedrop::handle_file_hover(
                                window.app_handle(),
                                paths.clone(),
                                Some((position.x as i32, position.y as i32)),
                            );
                        }
                        DragDropEvent::Over { position } => {
                            // Continue dragging (position update)
                            // Could emit position updates if needed
                        }
                        DragDropEvent::Drop { paths, position } => {
                            // Files dropped
                            filedrop::handle_file_drop(
                                window.app_handle(),
                                paths.clone(),
                                Some((position.x as i32, position.y as i32)),
                            );
                        }
                        DragDropEvent::Leave => {
                            // Drag canceled
                            filedrop::handle_file_cancel(window.app_handle());
                        }
                        _ => {}
                    }
                }
                _ => {}
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

            // Toggle mini mode (PiP) with Cmd/Ctrl+Shift+P
            shortcut_manager
                .register("CommandOrControl+Shift+P", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let window_clone = window.clone();
                            tauri::async_runtime::spawn(async move {
                                match crate::commands::toggle_mini_mode(window_clone, None).await {
                                    Ok(state) => {
                                        let message = if state.is_active {
                                            "Mini mode enabled"
                                        } else {
                                            "Mini mode disabled"
                                        };
                                        let _ = window.emit("mini-mode-changed", serde_json::json!({
                                            "active": state.is_active,
                                            "message": message,
                                            "corner": state.corner
                                        }));
                                    }
                                    Err(e) => {
                                        log::error!("Failed to toggle mini mode: {}", e);
                                    }
                                }
                            });
                        }
                    }
                })
                .ok();

            // Toggle privacy mode with Cmd/Ctrl+Shift+L
            shortcut_manager
                .register("CommandOrControl+Shift+L", {
                    let app_handle = app.handle().clone();
                    move || {
                        privacy::emit_privacy_toggle(&app_handle);
                    }
                })
                .ok();

            // Toggle quick capture with Cmd/Ctrl+Shift+C
            shortcut_manager
                .register("CommandOrControl+Shift+C", {
                    let app_handle = app.handle().clone();
                    move || {
                        let manager = app_handle.state::<quickcapture::QuickCaptureManager>();
                        let _ = manager.toggle(&app_handle);
                    }
                })
                .ok();

            // Toggle quick replies with Cmd/Ctrl+Shift+R
            shortcut_manager
                .register("CommandOrControl+Shift+R", {
                    let app_handle = app.handle().clone();
                    move || {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("open-quick-replies", ());
                        }
                    }
                })
                .ok();

            // Register media key shortcuts
            shortcut_manager
                .register("MediaPlayPause", {
                    let app_handle = app.handle().clone();
                    move || {
                        mediasession::emit_media_action(&app_handle, "pause");
                    }
                })
                .ok();

            shortcut_manager
                .register("MediaStop", {
                    let app_handle = app.handle().clone();
                    move || {
                        mediasession::emit_media_action(&app_handle, "stop");
                    }
                })
                .ok();

            shortcut_manager
                .register("MediaTrackNext", {
                    let app_handle = app.handle().clone();
                    move || {
                        mediasession::emit_media_action(&app_handle, "next");
                    }
                })
                .ok();

            shortcut_manager
                .register("MediaTrackPrevious", {
                    let app_handle = app.handle().clone();
                    move || {
                        mediasession::emit_media_action(&app_handle, "previous");
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

            // Start DND schedule checker
            dnd::start_schedule_checker(app.handle().clone());

            // Start system theme watcher
            theme::start_theme_watcher(app.handle().clone());

            // Initialize clipboard state with history (max 100 entries)
            app.manage(clipboard::init_clipboard_state(100));

            // Initialize QR code state with history (max 50 entries)
            app.manage(qrcode::init_qrcode_state(50));

            // Initialize window tabs state
            app.manage(tabs::init_tabs_state(app.handle()));

            // Initialize notification center state
            app.manage(notification_center::NotificationCenterState::default());

            // Initialize drafts state
            app.manage(drafts::DraftsState::default());

            // Initialize quick capture manager
            app.manage(quickcapture::QuickCaptureManager::new());

            // Initialize voice recorder manager
            app.manage(voicerecorder::VoiceRecorderManager::default());

            // Initialize dictation manager
            app.manage(dictation::DictationManager::default());

            // Initialize Touch Bar manager (macOS)
            app.manage(touchbar::TouchBarManager::new());
            quickcapture::init(app.handle());

            // Initialize local search manager with FTS5
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            app.manage(localsearch::SearchManager::new(app_data_dir)
                .expect("Failed to initialize search index"));

            // Load custom spell check dictionary
            spellcheck::load_custom_dictionary(app.handle());

            // Start network connectivity monitor
            let net_handle = app.handle().clone();
            network::start_network_monitor(net_handle).ok();

            // Start session lock/unlock monitor
            let session_handle = app.handle().clone();
            sessionlock::start_session_lock_monitor(session_handle).ok();

            // Start auto-away monitor
            let away_handle = app.handle().clone();
            autoaway::start_auto_away_monitor(away_handle).ok();

            // Initialize message scheduler state
            let scheduler_state = std::sync::Arc::new(tokio::sync::RwLock::new(
                scheduler::SchedulerState::new()
            ));
            app.manage(scheduler_state.clone());

            // Initialize hot corners manager
            let hotcorners_manager = std::sync::Arc::new(hotcorners::HotCornersManager::new());
            app.manage(hotcorners_manager);

            // Initialize app log system
            applog::init_applog(app.handle());

            // Start scheduler background task
            let scheduler_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                scheduler::scheduler_loop(scheduler_state, scheduler_handle).await;
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
            commands::get_cursor_position,
            commands::is_auto_start_enabled,
            commands::enable_auto_start,
            commands::disable_auto_start,
            commands::clipboard_write_text,
            commands::clipboard_read_text,
            commands::clipboard_has_text,
            commands::clipboard_clear,
            commands::clipboard_read_image,
            commands::clipboard_has_image,
            commands::clipboard_write_image,
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
            // File commands
            commands::open_file,
            commands::reveal_in_folder,
            commands::file_exists,
            commands::get_file_info,
            updater::check_for_updates,
            updater::download_and_install_update,
            // Activity detection for rich presence
            activity::get_running_activities,
            activity::get_idle_status,
            activity::get_idle_status_with_threshold,
            // Power management commands
            power::prevent_sleep,
            power::allow_sleep,
            power::is_sleep_prevented,
            power::get_power_status,
            // Screenshot commands
            screenshot::capture_screenshot,
            screenshot::capture_window_screenshot,
            screenshot::capture_region_screenshot,
            screenshot::get_screenshots_dir,
            screenshot::list_screenshots,
            screenshot::delete_screenshot,
            // Audio commands
            audio::get_audio_input_devices,
            audio::get_audio_output_devices,
            audio::set_audio_input_device,
            audio::set_audio_output_device,
            audio::get_input_volume,
            audio::set_input_volume,
            audio::get_output_volume,
            audio::set_output_volume,
            audio::is_output_muted,
            audio::toggle_output_mute,
            // Do Not Disturb commands
            dnd::get_dnd_status,
            dnd::toggle_dnd,
            dnd::set_dnd,
            dnd::set_dnd_until,
            dnd::is_dnd_active,
            dnd::get_dnd_schedule,
            dnd::set_dnd_schedule,
            dnd::set_dnd_schedule_enabled,
            dnd::should_allow_notification,
            dnd::check_notification_allowed,
            dnd::get_dnd_presets,
            dnd::apply_dnd_preset,
            // Notification Center commands
            notification_center::send_notification,
            notification_center::schedule_notification,
            notification_center::cancel_scheduled_notification,
            notification_center::get_scheduled_notifications,
            notification_center::get_notification_history,
            notification_center::mark_notification_read,
            notification_center::mark_all_notifications_read,
            notification_center::clear_notification_history,
            notification_center::get_unread_notification_count,
            notification_center::set_notification_dnd,
            notification_center::get_grouped_notifications,
            // System theme commands
            theme::get_system_theme,
            theme::get_theme_info,
            theme::is_dark_mode,
            // File drop commands
            filedrop::read_file_as_base64,
            filedrop::get_file_thumbnail,
            filedrop::validate_dropped_files,
            // Window state persistence commands
            commands::save_window_state,
            commands::load_window_state,
            commands::restore_window_state,
            commands::get_window_state,
            commands::clear_window_state,
            commands::ping_server,
            // Window opacity commands
            commands::set_window_opacity,
            commands::get_window_opacity,
            // Window attention commands
            commands::request_window_attention,
            commands::request_urgent_attention,
            commands::cancel_window_attention,
            // Performance monitoring commands
            performance::get_performance_metrics,
            performance::get_memory_info,
            performance::get_app_uptime,
            // Rich clipboard commands
            clipboard::clipboard_copy_text,
            clipboard::clipboard_copy_html,
            clipboard::clipboard_copy_image,
            clipboard::clipboard_read,
            clipboard::clipboard_get_history,
            clipboard::clipboard_clear_history,
            clipboard::clipboard_remove_entry,
            clipboard::clipboard_paste_entry,
            // Global shortcut commands
            globalshortcut::register_global_shortcut,
            globalshortcut::unregister_global_shortcut,
            globalshortcut::unregister_all_global_shortcuts,
            globalshortcut::list_global_shortcuts,
            globalshortcut::is_global_shortcut_registered,
            // Spell check commands
            spellcheck::check_spelling,
            spellcheck::get_spelling_suggestions,
            spellcheck::add_to_dictionary,
            spellcheck::remove_from_dictionary,
            spellcheck::get_custom_dictionary,
            spellcheck::get_spell_check_languages,
            // File association commands
            fileassoc::get_supported_file_associations,
            fileassoc::handle_associated_file,
            fileassoc::import_chat_export,
            // Mini Mode / Picture-in-Picture commands
            commands::enter_mini_mode,
            commands::exit_mini_mode,
            commands::toggle_mini_mode,
            commands::get_mini_mode_state,
            commands::set_mini_mode_size,
            commands::move_mini_mode_corner,
            // Version tracking (What's New) commands
            commands::get_last_seen_version,
            commands::set_last_seen_version,
            // System information commands
            sysinfo::get_system_info,
            sysinfo::get_os_info,
            sysinfo::get_cpu_info,
            sysinfo::get_memory_info,
            sysinfo::get_runtime_info,
            // Badge commands
            badge::set_badge_count,
            badge::clear_badge,
            badge::set_badge_muted,
            badge::request_attention,
            badge::is_badge_supported,
            badge::get_badge_count,
            // Window Manager commands
            commands::get_monitors,
            commands::get_always_on_top,
            commands::minimize_to_tray,
            commands::set_window_size,
            commands::set_window_position,
            commands::center_window,
            commands::toggle_decorations,
            commands::request_user_attention,
            commands::clear_user_attention,
            // Reading list commands
            commands::fetch_page_html,
            // Taskbar progress commands
            taskbar::set_taskbar_progress,
            taskbar::clear_taskbar_progress,
            taskbar::get_taskbar_progress,
            taskbar::start_operation,
            taskbar::update_operation,
            taskbar::complete_operation,
            taskbar::get_operations,
            // Media session commands
            mediasession::media_session_register,
            mediasession::media_session_unregister,
            mediasession::media_session_set_metadata,
            mediasession::media_session_set_playback_state,
            mediasession::media_session_get_state,
            mediasession::media_session_simulate_action,
            // Privacy mode commands
            privacy::is_privacy_mode_active,
            privacy::set_privacy_mode,
            privacy::toggle_privacy_mode,
            // Storage management commands
            storage::get_storage_info,
            storage::clear_storage,
            storage::get_storage_path,
            storage::open_storage_location,
            // Accessibility commands
            accessibility::get_accessibility_settings,
            accessibility::save_accessibility_settings,
            accessibility::get_system_accessibility_state,
            // Backup & Restore commands
            backup::get_backup_history,
            backup::get_backup_schedule,
            backup::set_backup_schedule,
            backup::register_backup,
            backup::delete_backup,
            backup::export_settings,
            backup::import_settings,
            backup::export_themes,
            backup::import_themes,
            backup::export_shortcuts,
            backup::import_shortcuts,
            backup::export_layouts,
            backup::import_layouts,
            backup::run_scheduled_backup,
            backup::get_app_version,
            backup::get_platform,
            // Text-to-Speech commands
            tts::tts_init,
            tts::tts_get_voices,
            tts::tts_get_settings,
            tts::tts_set_settings,
            tts::tts_speak,
            tts::tts_stop,
            tts::tts_pause,
            tts::tts_resume,
            tts::tts_get_status,
            tts::tts_skip,
            tts::tts_remove_from_queue,
            tts::tts_get_queue,
            // Workspace profiles commands
            workspaceprofiles::load_workspace_profiles,
            workspaceprofiles::save_workspace_profile,
            workspaceprofiles::delete_workspace_profile,
            workspaceprofiles::set_active_profile_id,
            workspaceprofiles::capture_workspace_state,
            workspaceprofiles::apply_workspace_profile,
            workspaceprofiles::export_workspace_profile,
            workspaceprofiles::import_workspace_profile,
            workspaceprofiles::get_workspace_profile_stats,
            // Notification snooze commands
            snooze::snooze_notifications,
            snooze::snooze_notifications_custom,
            snooze::unsnooze_notifications,
            snooze::get_notification_snooze_status,
            snooze::are_notifications_snoozed,
            // Window tabs commands
            tabs::get_window_tabs,
            tabs::get_tab_groups,
            tabs::get_active_tab_id,
            tabs::save_window_tabs,
            tabs::save_tab_groups,
            tabs::confirm_close_tab,
            tabs::create_window_tab,
            tabs::close_window_tab,
            tabs::toggle_tab_pinned,
            tabs::set_tab_modified,
            tabs::reorder_tabs,
            tabs::create_tab_group,
            tabs::add_tab_to_group,
            tabs::remove_tab_from_groups,
            tabs::delete_tab_group,
            tabs::toggle_group_collapsed,
            // Message drafts commands
            drafts::save_draft,
            drafts::get_draft,
            drafts::delete_draft,
            drafts::get_all_drafts,
            drafts::get_draft_count,
            drafts::clear_all_drafts,
            drafts::cleanup_stale_drafts,
            drafts::load_drafts,
            // Quick capture commands
            quickcapture::quick_capture_show,
            quickcapture::quick_capture_hide,
            quickcapture::quick_capture_toggle,
            quickcapture::quick_capture_get_config,
            quickcapture::quick_capture_set_config,
            quickcapture::quick_capture_get_state,
            quickcapture::quick_capture_is_visible,
            // Touch Bar commands (macOS)
            touchbar::touchbar_check_available,
            touchbar::touchbar_get_presets,
            touchbar::touchbar_apply_preset,
            touchbar::touchbar_set_config,
            touchbar::touchbar_get_current_config,
            touchbar::touchbar_update_item,
            touchbar::touchbar_add_preset,
            touchbar::touchbar_remove_preset,
            touchbar::touchbar_clear,
            touchbar::touchbar_handle_event,
            // Smart Status commands
            smartstatus::detect_meeting,
            smartstatus::detect_screen_share,
            smartstatus::detect_music_playing,
            smartstatus::detect_gaming,
            smartstatus::get_idle_time,
            smartstatus::set_user_status,
            // Network monitor commands
            network::get_network_status,
            network::is_online,
            network::measure_latency,
            network::start_network_monitor,
            network::stop_network_monitor,
            // File watcher commands
            filewatcher::watch_directory,
            filewatcher::unwatch_directory,
            filewatcher::unwatch_all,
            filewatcher::list_watchers,
            // Session lock commands
            sessionlock::get_session_lock_status,
            sessionlock::is_session_locked,
            sessionlock::start_session_lock_monitor,
            sessionlock::stop_session_lock_monitor,
            // Quick reply commands
            quickreply::quickreply_load,
            quickreply::quickreply_save,
            quickreply::quickreply_stats,
            quickreply::quickreply_clear,
            quickreply::quickreply_export,
            quickreply::quickreply_import,
            // Auto-away commands
            autoaway::get_auto_away_state,
            autoaway::get_auto_away_config,
            autoaway::set_auto_away_config,
            autoaway::start_auto_away_monitor,
            autoaway::stop_auto_away_monitor,
            // Link preview commands
            linkpreview::fetch_link_preview,
            linkpreview::fetch_link_previews,
            linkpreview::clear_link_preview_cache,
            // System health monitor commands
            systemmonitor::get_system_health,
            systemmonitor::start_system_monitor,
            systemmonitor::stop_system_monitor,
            systemmonitor::is_system_monitor_running,
            // Session restore commands
            sessionrestore::save_session_state,
            sessionrestore::load_session_state,
            sessionrestore::clear_session_state,
            sessionrestore::restore_from_backup,
            sessionrestore::get_session_info,
            sessionrestore::capture_window_state,
            sessionrestore::restore_window_state,
            // Local search commands
            localsearch::search_messages,
            localsearch::index_message,
            localsearch::index_messages_batch,
            localsearch::delete_indexed_message,
            localsearch::get_search_stats,
            localsearch::optimize_search_index,
            localsearch::clear_search_index,
            // Bandwidth monitor commands
            bandwidth::bandwidth_record_sent,
            bandwidth::bandwidth_record_received,
            bandwidth::bandwidth_get_stats,
            bandwidth::bandwidth_reset,
            bandwidth::bandwidth_start_monitor,
            bandwidth::bandwidth_stop_monitor,
            // Calendar integration commands
            calendar::calendar_check_in_meeting,
            calendar::calendar_get_next_event,
            calendar::calendar_get_current_events,
            calendar::calendar_get_upcoming_events,
            // Native auth / keychain commands
            nativeauth::keychain_set,
            nativeauth::keychain_get,
            nativeauth::keychain_delete,
            nativeauth::keychain_biometric_available,
            nativeauth::keychain_list,
            // QR code commands
            qrcode::qr_generate,
            qrcode::qr_scan,
            qrcode::qr_get_history,
            qrcode::qr_clear_history,
            qrcode::qr_generate_invite,
            qrcode::qr_generate_wifi,
            // Message scheduler commands
            scheduler::schedule_message,
            scheduler::cancel_scheduled_message,
            scheduler::update_scheduled_message,
            scheduler::get_scheduled_messages,
            scheduler::get_channel_scheduled_messages,
            scheduler::mark_scheduled_sent,
            scheduler::mark_scheduled_failed,
            // Voice recorder commands
            voicerecorder::start_voice_recording,
            voicerecorder::stop_voice_recording,
            voicerecorder::pause_voice_recording,
            voicerecorder::resume_voice_recording,
            voicerecorder::cancel_voice_recording,
            voicerecorder::get_audio_level,
            voicerecorder::list_audio_input_devices,
            // Dictation / speech-to-text commands
            dictation::check_dictation_available,
            dictation::request_dictation_permission,
            dictation::get_supported_languages,
            dictation::start_dictation,
            dictation::stop_dictation,
            dictation::pause_dictation,
            dictation::resume_dictation,
            dictation::cancel_dictation,
            dictation::get_dictation_status,
            dictation::get_dictation_audio_level,
            dictation::update_dictation_transcript,
            dictation::add_punctuation,
            // Hot corners commands
            hotcorners::hotcorners_get_settings,
            hotcorners::hotcorners_update_settings,
            hotcorners::hotcorners_check_position,
            hotcorners::hotcorners_set_screen_dimensions,
            hotcorners::hotcorners_set_corner_action,
            hotcorners::hotcorners_set_corner_enabled,
            hotcorners::hotcorners_reset_tracking,
            hotcorners::hotcorners_get_available_actions,
            // App log viewer commands
            applog::applog_get_entries,
            applog::applog_get_stats,
            applog::applog_clear,
            applog::applog_export,
            applog::applog_log,
            // Diagnostics commands
            diagnostics::run_diagnostics,
            diagnostics::run_single_diagnostic,
            diagnostics::export_diagnostic_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
