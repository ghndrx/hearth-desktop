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
mod locale;
mod mediasession;
mod menu;
mod notification_center;
mod performance;
mod power;
mod privacy;
mod screenshot;
mod screensources;
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
mod share;
mod translate;
mod applauncher;
mod nightlight;
mod widgets;
mod bluetooth;
mod processmanager;
mod dndsync;
mod colorpicker;
mod pomodoro;
mod connection_status;
mod zenmode;
mod focussessions;
mod quicknotes;
mod readinglist;
mod snippets;
mod proxy;
mod fontmanager;
mod analytics;
mod securevault;
mod imageoptimizer;
mod speedtest;
mod filecompression;
mod startupmanager;
mod clipboardpreview;
mod soundprofile;
mod filedialog;
mod accentcolor;
mod windowopacity;
mod chatexport;
mod inputmethod;
mod screenrecord;
mod windowsnap;
mod filepreview;
mod nativecontextmenu;
mod renderer;
mod printmanager;
mod gesturemanager;
mod contentfilter;
mod kanban;
mod reminders;
mod bookmarks;
mod fileindexer;
mod notificationgroups;
mod voicememos;
mod widgetdashboard;
mod workspacelayouts;
mod polls;
mod favorites;
mod activityheatmap;
mod habittracker;
mod fileorganizer;
mod messagetemplates;
mod stickynotes;
mod statuscountdown;
mod journal;
mod eyebreak;
mod hydration;
mod worldclock;
mod presencedetector;
mod meetingcost;
mod threadpip;
mod screentime;
mod moodtracker;
mod diskusage;
mod networkdiag;
mod texttransform;
mod systemuptime;
mod cryptohash;
mod unitconverter;
mod passwordgen;
mod quicktimer;
mod diceroller;
mod stopwatch;
mod colorpalette;
mod markdownpreview;
mod jsonformatter;

use tauri::{DragDropEvent, Emitter, Listener, Manager, WindowEvent};
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

            // Global shortcuts - OS-level registration requires tauri-plugin-global-shortcut
            // which is not currently in Cargo.toml. Shortcut registration is handled by the
            // globalshortcut module at the app-state level. When the plugin is added, this
            // block can be restored to register OS-level shortcuts.
            //
            // Intended shortcuts:
            //   CommandOrControl+Shift+H  - Toggle window visibility
            //   CommandOrControl+Shift+S  - Show window
            //   CommandOrControl+Shift+M  - Toggle mute
            //   CommandOrControl+Shift+F  - Toggle focus mode
            //   CommandOrControl+Shift+P  - Toggle mini mode (PiP)
            //   CommandOrControl+Shift+L  - Toggle privacy mode
            //   CommandOrControl+Shift+Z  - Toggle Zen Mode
            //   CommandOrControl+Shift+C  - Toggle quick capture
            //   CommandOrControl+Shift+N  - Toggle quick notes
            //   CommandOrControl+Shift+R  - Toggle quick replies
            //   MediaPlayPause / MediaStop / MediaTrackNext / MediaTrackPrevious
            {
                let _ = app.handle().clone(); // placeholder
            }

            // Register deep link handler
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event: tauri::Event| {
                let payload = event.payload();
                // Parse as JSON array of URLs
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(payload) {
                    for url in urls {
                        deeplink::handle_deep_link(&handle, &url);
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
            app.manage(localsearch::SearchManager::new(app_data_dir.clone())
                .expect("Failed to initialize search index"));

            // Initialize Bookmarks Manager
            app.manage(bookmarks::BookmarkManager::new(app_data_dir.clone())
                .expect("Failed to initialize bookmarks"));

            // Initialize Polls Manager
            app.manage(polls::PollManager::new(app_data_dir.clone())
                .expect("Failed to initialize polls"));

            // Initialize Habit Tracker Manager
            app.manage(habittracker::HabitTrackerManager::new(app_data_dir.clone())
                .expect("Failed to initialize habit tracker"));

            // Initialize Favorite Channels Manager
            app.manage(favorites::FavoriteChannelsManager::new(app_data_dir.clone())
                .expect("Failed to initialize favorites"));

            // Initialize Disk Usage Manager
            app.manage(diskusage::DiskUsageManager::default());

            // Initialize Network Diagnostics Manager
            app.manage(networkdiag::NetworkDiagManager::default());

            // Initialize System Uptime Manager
            app.manage(systemuptime::UptimeManager::default());

            // Initialize Crypto Hash Manager
            app.manage(cryptohash::CryptoHashManager::default());

            // Initialize Activity Heatmap Manager
            app.manage(activityheatmap::ActivityHeatmapManager::new(app_data_dir)
                .expect("Failed to initialize activity heatmap"));

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

            // Initialize application launcher state
            app.manage(applauncher::AppLauncherState::default());

            // Initialize color picker state
            app.manage(colorpicker::ColorPickerState::default());

            // Initialize night light state and start monitor
            let nightlight_state = std::sync::Arc::new(nightlight::NightLightState::default());
            app.manage(nightlight_state.clone());
            nightlight::start_nightlight_monitor(app.handle().clone(), nightlight_state);

            // Start scheduler background task
            let scheduler_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                scheduler::scheduler_loop(scheduler_state, scheduler_handle).await;
            });

            // Initialize pomodoro timer
            let (pomodoro_state, pomodoro_settings) = pomodoro::load_pomodoro_state(app.handle());
            let pomodoro_manager = std::sync::Arc::new(pomodoro::PomodoroManager::with_state(
                pomodoro_state,
                pomodoro_settings,
            ));
            app.manage(pomodoro_manager.clone());
            pomodoro::start_pomodoro_timer(app.handle().clone(), pomodoro_manager);

            // Initialize connection status manager
            app.manage(connection_status::ConnectionStatusManager::new());
            connection_status::init(app.handle());

            // Initialize Zen Mode
            zenmode::init_zen_mode(app.handle());

            // Initialize Focus Sessions
            let focus_manager = std::sync::Arc::new(focussessions::FocusSessionManager::default());
            app.manage(focus_manager);

            // Initialize Quick Notes
            app.manage(quicknotes::QuickNotesManager::default());

            // Initialize Reading List
            app.manage(readinglist::ReadingListManager::default());

            // Initialize Snippet Manager
            app.manage(snippets::SnippetsManager::default());

            // Initialize Proxy settings
            app.manage(proxy::ProxyState::default());

            // Initialize Font Manager
            app.manage(fontmanager::FontManagerState::default());

            // Initialize Analytics
            app.manage(analytics::AnalyticsState::default());

            // Initialize Secure Vault
            app.manage(securevault::SecureVaultManager::default());

            // Initialize Image Optimizer
            app.manage(imageoptimizer::ImageOptimizerManager::default());

            // Initialize Speed Test
            app.manage(speedtest::SpeedTestManager::default());

            // Initialize File Compression
            app.manage(filecompression::FileCompressionManager::default());

            // Initialize Startup Manager
            app.manage(startupmanager::StartupManager::default());

            // Initialize Clipboard Preview
            app.manage(clipboardpreview::ClipboardPreviewManager::default());

            // Initialize Screen Record Manager
            app.manage(screenrecord::ScreenRecordManager::default());

            // Initialize Window Snap Manager
            app.manage(windowsnap::WindowSnapManager::default());

            // Initialize File Preview Manager
            app.manage(filepreview::FilePreviewManager::default());

            // Initialize Context Menu Manager
            app.manage(nativecontextmenu::ContextMenuManager::default());

            // Initialize Renderer Manager
            app.manage(renderer::RendererManager::default());

            // Initialize Print Manager
            app.manage(printmanager::PrintManagerState::default());

            // Initialize Gesture Manager
            app.manage(gesturemanager::GestureManagerState::default());

            // Initialize Content Filter
            app.manage(contentfilter::ContentFilterState::default());

            // Initialize Kanban Board
            app.manage(kanban::KanbanManager::default());

            // Initialize File Organizer
            app.manage(fileorganizer::FileOrganizerManager::default());

            // Initialize Message Templates
            let templates_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            app.manage(messagetemplates::MessageTemplateManager::new(templates_dir)
                .expect("Failed to initialize message templates"));

            // Initialize Sticky Notes
            app.manage(stickynotes::StickyNotesManager::default());

            // Initialize Status Countdown Timer
            app.manage(statuscountdown::StatusCountdownManager::default());
            app.manage(journal::JournalManager::default());

            // Initialize Eye Break Reminder
            app.manage(eyebreak::EyeBreakManager::default());

            // Initialize Hydration Reminder
            app.manage(hydration::HydrationManager::default());

            // Initialize World Clock
            app.manage(worldclock::WorldClockManager::default());
            app.manage(meetingcost::MeetingCostManager::default());

            // Reminder manager
            let reminder_manager = std::sync::Arc::new(reminders::ReminderManager::default());
            app.manage(reminder_manager.clone());
            reminders::start_reminder_monitor(app.handle().clone(), reminder_manager);

            // Initialize File Indexer (SQLite FTS5)
            let app_data_dir2 = app.path().app_data_dir().map_err(|e| e.to_string())?;
            app.manage(fileindexer::FileIndexerManager::new(app_data_dir2)
                .expect("Failed to initialize file indexer"));

            // Initialize Notification Groups
            app.manage(notificationgroups::NotificationGroupManager::default());

            // Initialize Voice Memos
            app.manage(voicememos::VoiceMemoManager::default());

            // Initialize Widget Dashboard
            app.manage(widgetdashboard::WidgetDashboardManager::default());

            // Initialize Workspace Layouts
            app.manage(workspacelayouts::WorkspaceLayoutManager::default());

            // Initialize Mood Tracker
            app.manage(moodtracker::MoodTrackerManager::default());

            // Initialize Quick Timer
            let quicktimer_manager = std::sync::Arc::new(quicktimer::QuickTimerManager::default());
            app.manage(quicktimer_manager.clone());
            quicktimer::start_timer_loop(app.handle().clone(), quicktimer_manager);

            // Initialize Dice Roller
            app.manage(diceroller::DiceRollerManager::default());

            // Initialize Stopwatch
            let stopwatch_manager = std::sync::Arc::new(stopwatch::StopwatchManager::default());
            app.manage(stopwatch_manager.clone());
            stopwatch::start_stopwatch_loop(app.handle().clone(), stopwatch_manager);

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::show_notification,
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
            // Screen source enumeration for screen sharing
            screensources::get_screen_sources,
            screensources::capture_source_thumbnail,
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
            commands::get_window_state,
            commands::clear_window_state,
            commands::ping_server,
            // Window attention commands
            commands::request_window_attention,
            commands::request_urgent_attention,
            commands::cancel_window_attention,
            // Performance monitoring commands
            performance::get_performance_metrics,
            performance::get_perf_memory_info,
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
            quickcapture::quick_capture_send_message,
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
            // Tray user status commands
            tray::tray_get_user_status,
            tray::tray_set_user_status,
            tray::set_tray_badge,
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
            // Locale detection commands
            locale::get_system_locale,
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
            // Native share sheet commands
            share::get_share_targets,
            share::share_content,
            share::is_share_available,
            share::get_share_icon,
            // Translation commands
            translate::detect_language,
            translate::translate_text,
            translate::get_translation_languages,
            // Night light / blue light filter commands
            nightlight::nightlight_get_status,
            nightlight::nightlight_get_settings,
            nightlight::nightlight_set_settings,
            nightlight::nightlight_toggle,
            nightlight::nightlight_set_temperature,
            nightlight::nightlight_set_mode,
            nightlight::nightlight_set_schedule,
            nightlight::nightlight_get_presets,
            // Widget bar commands
            widgets::get_widget_system_stats,
            widgets::get_widget_weather,
            // Bluetooth device management commands
            bluetooth::bluetooth_get_status,
            bluetooth::bluetooth_get_devices,
            bluetooth::bluetooth_get_audio_devices,
            bluetooth::bluetooth_is_available,
            bluetooth::bluetooth_start_monitor,
            bluetooth::bluetooth_stop_monitor,
            bluetooth::bluetooth_is_monitoring,
            // Process manager commands
            processmanager::process_get_summary,
            processmanager::process_find_by_name,
            processmanager::process_detect_apps,
            processmanager::process_get_count,
            processmanager::process_is_running,
            processmanager::process_detect_communication_apps,
            processmanager::process_detect_gaming_apps,
            // OS DND sync commands
            dndsync::dndsync_get_os_status,
            dndsync::dndsync_is_os_dnd_active,
            dndsync::dndsync_is_supported,
            dndsync::dndsync_start_sync,
            dndsync::dndsync_stop_sync,
            dndsync::dndsync_is_sync_running,
            // Color picker commands
            colorpicker::pick_color_at_cursor,
            colorpicker::parse_color,
            colorpicker::get_color_history,
            colorpicker::clear_color_history,
            colorpicker::add_color_to_favorites,
            colorpicker::remove_color_from_favorites,
            colorpicker::get_favorite_colors,
            colorpicker::copy_color_to_clipboard,
            colorpicker::generate_color_palette,
            // Tray settings commands
            commands::get_tray_settings,
            commands::set_tray_settings,
            commands::load_tray_settings,
            commands::test_tray_notification,
            commands::should_minimize_to_tray,
            commands::should_close_to_tray,
            // Pomodoro timer commands
            pomodoro::pomodoro_start,
            pomodoro::pomodoro_pause,
            pomodoro::pomodoro_reset,
            pomodoro::pomodoro_skip,
            pomodoro::pomodoro_set_session,
            pomodoro::pomodoro_get_state,
            pomodoro::pomodoro_get_settings,
            pomodoro::pomodoro_update_settings,
            pomodoro::pomodoro_is_running,
            pomodoro::pomodoro_save_state,
            pomodoro::pomodoro_get_tray_info,
            // Connection status commands
            connection_status::connection_get_stats,
            connection_status::connection_start_monitoring,
            connection_status::connection_stop_monitoring,
            connection_status::connection_reconnect,
            connection_status::connection_set_auto_reconnect,
            connection_status::connection_get_auto_reconnect,
            connection_status::connection_reset,
            connection_status::connection_simulate_state,
            // Zen Mode commands
            zenmode::is_zen_mode_enabled,
            zenmode::toggle_zen_mode,
            zenmode::set_zen_mode,
            zenmode::get_zen_mode_config,
            zenmode::update_zen_mode_config,
            zenmode::enter_channel_zen_mode,
            zenmode::exit_channel_zen_mode,
            zenmode::is_channel_in_zen_mode,
            zenmode::get_zen_mode_state,
            zenmode::reset_zen_mode_config,
            zenmode::cycle_zen_mode_preset,
            // Focus Sessions commands
            focussessions::focus_session_start,
            focussessions::focus_session_pause,
            focussessions::focus_session_stop,
            focussessions::focus_session_skip,
            focussessions::focus_session_get_state,
            focussessions::focus_session_get_settings,
            focussessions::focus_session_update_settings,
            focussessions::focus_session_get_stats,
            focussessions::focus_session_get_history,
            focussessions::focus_session_clear_history,
            focussessions::focus_session_tick,
            // Quick Notes commands
            quicknotes::quicknotes_get_state,
            quicknotes::quicknotes_create,
            quicknotes::quicknotes_update,
            quicknotes::quicknotes_delete,
            quicknotes::quicknotes_toggle_pin,
            quicknotes::quicknotes_set_active,
            quicknotes::quicknotes_toggle_visible,
            quicknotes::quicknotes_get_all,
            quicknotes::quicknotes_search,
            quicknotes::quicknotes_export,
            quicknotes::quicknotes_import,
            // Reading List commands
            readinglist::reading_list_add,
            readinglist::reading_list_remove,
            readinglist::reading_list_mark_read,
            readinglist::reading_list_mark_unread,
            readinglist::reading_list_archive,
            readinglist::reading_list_update_tags,
            readinglist::reading_list_update_priority,
            readinglist::reading_list_update_notes,
            readinglist::reading_list_get_all,
            readinglist::reading_list_get_unread,
            readinglist::reading_list_get_stats,
            readinglist::reading_list_search,
            readinglist::reading_list_clear_read,
            snippets::snippets_get_state,
            snippets::snippets_create,
            snippets::snippets_update,
            snippets::snippets_delete,
            snippets::snippets_toggle_favorite,
            snippets::snippets_record_use,
            snippets::snippets_search,
            snippets::snippets_get_by_category,
            snippets::snippets_get_favorites,
            snippets::snippets_toggle_visible,
            snippets::snippets_add_category,
            snippets::snippets_remove_category,
            // Proxy settings commands
            proxy::proxy_get_config,
            proxy::proxy_set_config,
            proxy::proxy_get_url,
            proxy::proxy_test_connection,
            proxy::proxy_is_enabled,
            proxy::proxy_toggle,
            proxy::proxy_add_bypass,
            proxy::proxy_remove_bypass,
            // Font manager commands
            fontmanager::font_list_system,
            fontmanager::font_list_monospace,
            fontmanager::font_get_categories,
            fontmanager::font_get_preferences,
            fontmanager::font_set_preferences,
            fontmanager::font_get_css,
            fontmanager::font_refresh_cache,
            fontmanager::font_search,
            // Analytics commands
            analytics::analytics_record_event,
            analytics::analytics_record_voice_time,
            analytics::analytics_record_active_time,
            analytics::analytics_get_today,
            analytics::analytics_get_daily,
            analytics::analytics_get_range,
            analytics::analytics_get_summary,
            analytics::analytics_get_weekly_report,
            analytics::analytics_reset,
            // Secure Vault commands
            securevault::vault_setup_pin,
            securevault::vault_unlock,
            securevault::vault_lock,
            securevault::vault_get_state,
            securevault::vault_add_entry,
            securevault::vault_update_entry,
            securevault::vault_delete_entry,
            securevault::vault_search,
            securevault::vault_set_auto_lock,
            securevault::vault_add_category,
            securevault::vault_change_pin,
            securevault::vault_export,
            securevault::vault_import,
            // Image Optimizer commands
            imageoptimizer::image_get_info,
            imageoptimizer::image_optimize,
            imageoptimizer::image_optimize_batch,
            imageoptimizer::image_estimate_size,
            imageoptimizer::image_get_optimizer_stats,
            imageoptimizer::image_set_defaults,
            // Speed Test commands
            speedtest::speedtest_run,
            speedtest::speedtest_quick_latency,
            speedtest::speedtest_get_state,
            speedtest::speedtest_get_history,
            speedtest::speedtest_clear_history,
            speedtest::speedtest_is_running,
            // File Compression commands
            filecompression::compress_files,
            filecompression::extract_archive,
            filecompression::list_archive,
            filecompression::compression_get_state,
            filecompression::compression_is_busy,
            // Startup Manager commands
            startupmanager::startup_get_state,
            startupmanager::startup_get_tasks,
            startupmanager::startup_toggle_task,
            startupmanager::startup_set_task_defer,
            startupmanager::startup_set_task_priority,
            startupmanager::startup_record_timing,
            startupmanager::startup_record_boot,
            startupmanager::startup_get_metrics,
            startupmanager::startup_get_profiles,
            startupmanager::startup_set_active_profile,
            startupmanager::startup_create_profile,
            startupmanager::startup_delete_profile,
            startupmanager::startup_set_lazy_load,
            startupmanager::startup_set_optimization,
            startupmanager::startup_reset_metrics,
            // Clipboard Preview commands
            clipboardpreview::clipboard_preview_add_image,
            clipboardpreview::clipboard_preview_add_text,
            clipboardpreview::clipboard_preview_get_state,
            clipboardpreview::clipboard_preview_get_entries,
            clipboardpreview::clipboard_preview_pin,
            clipboardpreview::clipboard_preview_delete,
            clipboardpreview::clipboard_preview_clear,
            clipboardpreview::clipboard_preview_set_max,
            clipboardpreview::clipboard_preview_set_thumbnail_size,
            clipboardpreview::clipboard_preview_search,
            // App Launcher commands
            applauncher::scan_installed_apps,
            applauncher::search_apps,
            applauncher::launch_app,
            applauncher::get_recent_apps,
            // Sound Profile commands
            soundprofile::soundprofile_get_state,
            soundprofile::soundprofile_get_active,
            soundprofile::soundprofile_set_active,
            soundprofile::soundprofile_create,
            soundprofile::soundprofile_delete,
            soundprofile::soundprofile_update,
            soundprofile::soundprofile_get_sound_for_event,
            soundprofile::soundprofile_duplicate,
            // File dialog commands
            filedialog::open_file_dialog,
            filedialog::save_file_dialog,
            filedialog::write_file,
            filedialog::write_file_bytes,
            filedialog::read_file_bytes,
            filedialog::get_file_metadata,
            filedialog::pick_folder_dialog,
            // System accent color commands
            accentcolor::get_system_accent_color,
            accentcolor::get_system_theme_info,
            accentcolor::watch_system_theme,
            // Window opacity & popout commands
            windowopacity::set_window_opacity,
            windowopacity::get_window_opacity,
            windowopacity::set_window_vibrancy,
            windowopacity::set_compact_mode,
            windowopacity::create_popout_window,
            windowopacity::close_popout_window,
            windowopacity::list_popout_windows,
            // Chat export commands
            chatexport::export_chat,
            // Input method commands
            inputmethod::get_current_input_method,
            inputmethod::list_input_methods,
            inputmethod::watch_input_method,
            // Screen recording commands
            screenrecord::screenrecord_start,
            screenrecord::screenrecord_stop,
            screenrecord::screenrecord_pause,
            screenrecord::screenrecord_resume,
            screenrecord::screenrecord_cancel,
            screenrecord::screenrecord_get_state,
            screenrecord::screenrecord_get_settings,
            screenrecord::screenrecord_update_settings,
            screenrecord::screenrecord_list_recordings,
            screenrecord::screenrecord_delete_recording,
            screenrecord::screenrecord_get_recording_info,
            // Window snap commands
            windowsnap::snap_window,
            windowsnap::snap_restore,
            windowsnap::snap_get_zones,
            windowsnap::snap_get_config,
            windowsnap::snap_set_config,
            windowsnap::snap_is_snapped,
            windowsnap::snap_get_state,
            windowsnap::snap_cycle_zone,
            windowsnap::snap_to_monitor,
            windowsnap::snap_cascade,
            windowsnap::snap_get_monitors,
            // File preview commands
            filepreview::preview_get_info,
            filepreview::preview_get_thumbnail,
            filepreview::preview_read_text,
            filepreview::preview_list_archive,
            filepreview::preview_get_image_data,
            filepreview::preview_is_supported,
            filepreview::preview_get_supported_types,
            filepreview::preview_get_file_icon,
            filepreview::preview_extract_metadata,
            filepreview::preview_get_hex_dump,
            // Native context menu commands
            nativecontextmenu::show_context_menu,
            nativecontextmenu::show_text_edit_menu,
            nativecontextmenu::show_message_menu,
            nativecontextmenu::show_image_menu,
            nativecontextmenu::show_link_menu,
            nativecontextmenu::show_channel_menu,
            nativecontextmenu::get_predefined_templates,
            nativecontextmenu::contextmenu_get_config,
            nativecontextmenu::contextmenu_set_config,
            // Renderer/GPU settings commands
            renderer::renderer_get_info,
            renderer::renderer_get_settings,
            renderer::renderer_update_settings,
            renderer::renderer_apply_preset,
            renderer::renderer_get_presets,
            renderer::renderer_get_fps,
            renderer::renderer_benchmark,
            renderer::renderer_get_capabilities,
            renderer::renderer_reset_defaults,
            renderer::renderer_get_memory_usage,
            // Print Manager commands
            printmanager::print_get_settings,
            printmanager::print_update_settings,
            printmanager::print_generate_preview,
            printmanager::print_create_job,
            printmanager::print_get_jobs,
            printmanager::print_cancel_job,
            printmanager::print_clear_jobs,
            printmanager::print_export_pdf,
            // Gesture Manager commands
            gesturemanager::gesture_get_config,
            gesturemanager::gesture_update_config,
            gesturemanager::gesture_set_enabled,
            gesturemanager::gesture_set_sensitivity,
            gesturemanager::gesture_resolve_action,
            gesturemanager::gesture_get_stats,
            gesturemanager::gesture_reset_stats,
            gesturemanager::gesture_get_available_actions,
            gesturemanager::gesture_reset_config,
            // Content Filter commands
            contentfilter::filter_get_config,
            contentfilter::filter_update_config,
            contentfilter::filter_set_enabled,
            contentfilter::filter_check_content,
            contentfilter::filter_add_blocked_word,
            contentfilter::filter_remove_blocked_word,
            contentfilter::filter_get_stats,
            contentfilter::filter_get_log,
            contentfilter::filter_clear_log,
            contentfilter::filter_reset_stats,
            contentfilter::filter_report_false_positive,
            contentfilter::filter_test_content,
            // Kanban Board commands
            kanban::kanban_get_board,
            kanban::kanban_add_card,
            kanban::kanban_update_card,
            kanban::kanban_delete_card,
            kanban::kanban_move_card,
            kanban::kanban_add_column,
            kanban::kanban_delete_column,
            kanban::kanban_rename_column,
            kanban::kanban_get_stats,
            // Message Reminder commands
            reminders::reminder_create,
            reminders::reminder_cancel,
            reminders::reminder_get_all,
            reminders::reminder_get_pending_count,
            reminders::reminder_get_stats,
            reminders::reminder_clear_fired,
            reminders::reminder_update_note,
            reminders::reminder_reschedule,
            // Bookmark commands
            bookmarks::bookmark_add,
            bookmarks::bookmark_remove,
            bookmarks::bookmark_remove_by_message,
            bookmarks::bookmark_get_all,
            bookmarks::bookmark_search,
            bookmarks::bookmark_update_note,
            bookmarks::bookmark_update_tags,
            bookmarks::bookmark_is_bookmarked,
            bookmarks::bookmark_get_count,
            bookmarks::bookmark_clear_all,
            // Habit Tracker commands
            habittracker::habit_create,
            habittracker::habit_update,
            habittracker::habit_delete,
            habittracker::habit_get_all,
            habittracker::habit_complete,
            habittracker::habit_uncomplete,
            habittracker::habit_get_completions,
            habittracker::habit_get_stats,
            habittracker::habit_get_all_stats,
            habittracker::habit_get_streak,
            habittracker::habit_reset,
            polls::poll_create,
            polls::poll_vote,
            polls::poll_close,
            polls::poll_get,
            polls::poll_list_by_channel,
            polls::poll_delete,
            // File Indexer commands (SQLite FTS5)
            fileindexer::file_index_add,
            fileindexer::file_index_remove,
            fileindexer::file_index_search,
            fileindexer::file_index_get_recent,
            fileindexer::file_index_get_by_channel,
            fileindexer::file_index_get_by_type,
            fileindexer::file_index_get_stats,
            fileindexer::file_index_clear,
            fileindexer::file_index_rebuild,
            // Notification Groups commands
            notificationgroups::notifgroup_add,
            notificationgroups::notifgroup_get_all,
            notificationgroups::notifgroup_get_group,
            notificationgroups::notifgroup_mark_read,
            notificationgroups::notifgroup_mark_all_read,
            notificationgroups::notifgroup_dismiss,
            notificationgroups::notifgroup_dismiss_all,
            notificationgroups::notifgroup_mute_group,
            notificationgroups::notifgroup_unmute_group,
            notificationgroups::notifgroup_get_config,
            notificationgroups::notifgroup_set_config,
            notificationgroups::notifgroup_get_unread_count,
            notificationgroups::notifgroup_get_summary,
            // Voice Memos commands
            voicememos::memo_start_recording,
            voicememos::memo_stop_recording,
            voicememos::memo_cancel_recording,
            voicememos::memo_get_recording_state,
            voicememos::memo_save,
            voicememos::memo_delete,
            voicememos::memo_get_all,
            voicememos::memo_get_by_channel,
            voicememos::memo_search,
            voicememos::memo_toggle_favorite,
            voicememos::memo_update_title,
            voicememos::memo_update_transcript,
            voicememos::memo_update_tags,
            voicememos::memo_get_stats,
            voicememos::memo_export,
            // Widget Dashboard commands
            widgetdashboard::dashboard_get_state,
            widgetdashboard::dashboard_set_visible,
            widgetdashboard::dashboard_toggle_visible,
            widgetdashboard::dashboard_add_widget,
            widgetdashboard::dashboard_remove_widget,
            widgetdashboard::dashboard_update_widget,
            widgetdashboard::dashboard_move_widget,
            widgetdashboard::dashboard_resize_widget,
            widgetdashboard::dashboard_toggle_widget_pin,
            widgetdashboard::dashboard_get_config,
            widgetdashboard::dashboard_set_config,
            widgetdashboard::dashboard_reset,
            widgetdashboard::dashboard_get_available_widgets,
            widgetdashboard::dashboard_export,
            widgetdashboard::dashboard_import,
            // Workspace Layouts commands
            workspacelayouts::layout_save,
            workspacelayouts::layout_load,
            workspacelayouts::layout_delete,
            workspacelayouts::layout_rename,
            workspacelayouts::layout_get_all,
            workspacelayouts::layout_get_active,
            workspacelayouts::layout_set_default,
            workspacelayouts::layout_get_presets,
            workspacelayouts::layout_apply_preset,
            workspacelayouts::layout_export,
            workspacelayouts::layout_import,
            workspacelayouts::layout_duplicate,
            // Favorite Channels commands
            favorites::favorites_add,
            favorites::favorites_remove,
            favorites::favorites_list,
            favorites::favorites_is_favorited,
            favorites::favorites_toggle,
            favorites::favorites_reorder,
            favorites::favorites_clear,
            // Activity Heatmap commands
            activityheatmap::heatmap_record_activity,
            activityheatmap::heatmap_get_range,
            activityheatmap::heatmap_get_year,
            activityheatmap::heatmap_get_today,
            activityheatmap::heatmap_get_streak,
            activityheatmap::heatmap_get_stats,
            activityheatmap::heatmap_get_peak_hours,
            activityheatmap::heatmap_get_server_breakdown,
            activityheatmap::heatmap_clear,
            // File Organizer commands
            fileorganizer::organizer_get_config,
            fileorganizer::organizer_set_config,
            fileorganizer::organizer_categorize_file,
            fileorganizer::organizer_organize_file,
            fileorganizer::organizer_organize_directory,
            fileorganizer::organizer_get_history,
            fileorganizer::organizer_undo_last,
            fileorganizer::organizer_get_stats,
            fileorganizer::organizer_add_rule,
            fileorganizer::organizer_remove_rule,
            fileorganizer::organizer_get_rules,
            fileorganizer::organizer_set_enabled,
            fileorganizer::organizer_preview_organize,
            // Message Template commands
            messagetemplates::template_create,
            messagetemplates::template_update,
            messagetemplates::template_delete,
            messagetemplates::template_get_all,
            messagetemplates::template_get_by_category,
            messagetemplates::template_search,
            messagetemplates::template_apply,
            messagetemplates::template_record_use,
            messagetemplates::template_get_frequent,
            messagetemplates::template_export,
            messagetemplates::template_import,
            // Sticky Notes commands
            stickynotes::sticky_create,
            stickynotes::sticky_update,
            stickynotes::sticky_delete,
            stickynotes::sticky_get_all,
            stickynotes::sticky_set_color,
            stickynotes::sticky_set_position,
            stickynotes::sticky_set_size,
            stickynotes::sticky_toggle_pin,
            stickynotes::sticky_archive,
            stickynotes::sticky_get_archived,
            stickynotes::sticky_restore,
            stickynotes::sticky_link_to_message,
            stickynotes::sticky_clear_archived,
            // Status Countdown Timer commands
            statuscountdown::countdown_start,
            statuscountdown::countdown_stop,
            statuscountdown::countdown_get,
            statuscountdown::countdown_pause,
            statuscountdown::countdown_resume,
            statuscountdown::countdown_extend,
            statuscountdown::countdown_get_presets,
            statuscountdown::countdown_add_preset,
            statuscountdown::countdown_remove_preset,
            // Daily Journal commands
            journal::journal_get_entry,
            journal::journal_save_entry,
            journal::journal_delete_entry,
            journal::journal_get_stats,
            journal::journal_list_dates,
            // Eye Break Reminder commands
            eyebreak::eyebreak_start,
            eyebreak::eyebreak_stop,
            eyebreak::eyebreak_begin_break,
            eyebreak::eyebreak_end_break,
            eyebreak::eyebreak_skip_break,
            eyebreak::eyebreak_get_state,
            eyebreak::eyebreak_get_config,
            eyebreak::eyebreak_set_config,
            eyebreak::eyebreak_reset_stats,
            hydration::hydration_start,
            hydration::hydration_stop,
            hydration::hydration_log_drink,
            hydration::hydration_dismiss_reminder,
            hydration::hydration_get_state,
            hydration::hydration_get_config,
            hydration::hydration_set_config,
            hydration::hydration_reset_today,
            worldclock::worldclock_get_clocks,
            worldclock::worldclock_get_times,
            worldclock::worldclock_add_clock,
            worldclock::worldclock_remove_clock,
            // Presence Detector commands
            presencedetector::get_presence_state,
            presencedetector::set_presence_config,
            presencedetector::start_presence_detector,
            presencedetector::stop_presence_detector,
            presencedetector::set_manual_status,
            // Meeting Cost Timer commands
            meetingcost::meeting_start,
            meetingcost::meeting_stop,
            meetingcost::meeting_pause,
            meetingcost::meeting_resume,
            meetingcost::meeting_update_attendees,
            meetingcost::meeting_get_state,
            meetingcost::meeting_get_config,
            meetingcost::meeting_set_config,
            meetingcost::meeting_reset_daily,
            // Thread PiP commands
            threadpip::pip_open_window,
            threadpip::pip_close_window,
            threadpip::pip_close_all,
            threadpip::pip_list_windows,
            threadpip::pip_set_opacity,
            threadpip::pip_set_always_on_top,
            threadpip::pip_set_compact,
            threadpip::pip_get_config,
            threadpip::pip_set_config,
            // Screen Time Tracker commands
            screentime::screentime_start,
            screentime::screentime_stop,
            screentime::screentime_heartbeat,
            screentime::screentime_activity,
            screentime::screentime_get_state,
            screentime::screentime_get_today,
            screentime::screentime_get_weekly,
            screentime::screentime_get_range,
            screentime::screentime_set_idle_threshold,
            screentime::screentime_reset,
            screentime::screentime_save,
            // Mood Tracker commands
            moodtracker::mood_log,
            moodtracker::mood_get_today,
            moodtracker::mood_get_range,
            moodtracker::mood_get_history,
            moodtracker::mood_delete,
            moodtracker::mood_get_stats,
            moodtracker::mood_clear,
            // Disk Usage commands
            diskusage::disk_get_usage,
            diskusage::disk_get_info,
            diskusage::disk_get_threshold,
            diskusage::disk_set_threshold,
            diskusage::disk_check_alerts,
            diskusage::disk_clear_alerts,
            // Network Diagnostics commands
            networkdiag::netdiag_ping,
            networkdiag::netdiag_dns_lookup,
            networkdiag::netdiag_check_port,
            networkdiag::netdiag_get_history,
            networkdiag::netdiag_clear_history,
            // Text Transform commands
            texttransform::text_base64_encode,
            texttransform::text_base64_decode,
            texttransform::text_url_encode,
            texttransform::text_url_decode,
            texttransform::text_hash,
            texttransform::text_transform_case,
            texttransform::text_get_stats,
            texttransform::text_get_available_transforms,
            // System Uptime commands
            systemuptime::uptime_get_info,
            systemuptime::uptime_acknowledge_milestone,
            systemuptime::uptime_get_sessions,
            systemuptime::uptime_get_total_app_time,
            // Crypto Hash commands
            cryptohash::hash_file,
            cryptohash::hash_text,
            cryptohash::hash_compare_files,
            cryptohash::hash_get_history,
            cryptohash::hash_clear_history,
            cryptohash::hash_verify,
            // Unit Converter commands
            unitconverter::unit_convert,
            unitconverter::unit_get_categories,
            // Password Generator commands
            passwordgen::password_generate,
            passwordgen::passphrase_generate,
            // Quick Timer commands
            quicktimer::quicktimer_start,
            quicktimer::quicktimer_cancel,
            quicktimer::quicktimer_cancel_all,
            quicktimer::quicktimer_get_all,
            // Dice Roller commands
            diceroller::dice_roll,
            diceroller::dice_roll_quick,
            diceroller::dice_get_history,
            diceroller::dice_clear_history,
            // Stopwatch commands
            stopwatch::stopwatch_start,
            stopwatch::stopwatch_stop,
            stopwatch::stopwatch_reset,
            stopwatch::stopwatch_lap,
            stopwatch::stopwatch_get_state,
            // Color Palette commands
            colorpalette::palette_generate,
            colorpalette::palette_all_modes,
            colorpalette::palette_hex_to_hsl,
            // Markdown preview commands
            markdownpreview::markdown_render,
            markdownpreview::markdown_word_count,
            // JSON Formatter commands
            jsonformatter::json_format,
            jsonformatter::json_minify,
            jsonformatter::json_validate,
            jsonformatter::json_query,
            jsonformatter::json_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hearth desktop application");
}
