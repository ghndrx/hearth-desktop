use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::time::{interval, Duration};

/// Pomodoro session types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionType {
    Work,
    ShortBreak,
    LongBreak,
}

impl SessionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SessionType::Work => "work",
            SessionType::ShortBreak => "short-break",
            SessionType::LongBreak => "long-break",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            SessionType::Work => "Focus Time",
            SessionType::ShortBreak => "Short Break",
            SessionType::LongBreak => "Long Break",
        }
    }
}

/// Pomodoro settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroSettings {
    pub work_duration: u32,              // minutes
    pub short_break_duration: u32,     // minutes
    pub long_break_duration: u32,      // minutes
    pub pomodoros_before_long_break: u32,
    pub auto_start_breaks: bool,
    pub auto_start_work: bool,
    pub sound_enabled: bool,
    pub notifications_enabled: bool,
}

impl Default for PomodoroSettings {
    fn default() -> Self {
        Self {
            work_duration: 25,
            short_break_duration: 5,
            long_break_duration: 15,
            pomodoros_before_long_break: 4,
            auto_start_breaks: false,
            auto_start_work: false,
            sound_enabled: true,
            notifications_enabled: true,
        }
    }
}

/// Pomodoro state for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroState {
    pub session_type: SessionType,
    pub time_remaining: u32, // seconds
    pub is_running: bool,
    pub completed_pomodoros: u32,
    pub total_completed_today: u32,
    pub streak: u32,
    pub last_session_date: String, // YYYY-MM-DD format
}

impl Default for PomodoroState {
    fn default() -> Self {
        Self {
            session_type: SessionType::Work,
            time_remaining: 25 * 60, // 25 minutes in seconds
            is_running: false,
            completed_pomodoros: 0,
            total_completed_today: 0,
            streak: 0,
            last_session_date: chrono::Local::now().format("%Y-%m-%d").to_string(),
        }
    }
}

/// Runtime pomodoro manager
pub struct PomodoroManager {
    state: Arc<Mutex<PomodoroState>>,
    settings: Arc<Mutex<PomodoroSettings>>,
    is_running: Arc<AtomicBool>,
    last_tick: Arc<AtomicU64>,
}

impl PomodoroManager {
    pub fn new() -> Self {
        let settings = PomodoroSettings::default();
        let mut state = PomodoroState::default();
        state.time_remaining = settings.work_duration * 60;

        Self {
            state: Arc::new(Mutex::new(state)),
            settings: Arc::new(Mutex::new(settings)),
            is_running: Arc::new(AtomicBool::new(false)),
            last_tick: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn with_state(state: PomodoroState, settings: PomodoroSettings) -> Self {
        Self {
            state: Arc::new(Mutex::new(state)),
            settings: Arc::new(Mutex::new(settings)),
            is_running: Arc::new(AtomicBool::new(false)),
            last_tick: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Start the pomodoro timer
    pub fn start(&self) {
        self.is_running.store(true, Ordering::SeqCst);
        self.last_tick.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            Ordering::SeqCst,
        );
    }

    /// Pause the pomodoro timer
    pub fn pause(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    /// Reset the current session
    pub fn reset(&self) {
        self.is_running.store(false, Ordering::SeqCst);
        let settings = self.settings.lock().unwrap();
        let mut state = self.state.lock().unwrap();
        state.time_remaining = match state.session_type {
            SessionType::Work => settings.work_duration * 60,
            SessionType::ShortBreak => settings.short_break_duration * 60,
            SessionType::LongBreak => settings.long_break_duration * 60,
        };
    }

    /// Skip to the next session
    pub fn skip_session(&self) -> PomodoroState {
        self.is_running.store(false, Ordering::SeqCst);
        self.complete_session()
    }

    /// Set the current session type
    pub fn set_session_type(&self, session_type: SessionType) {
        let settings = self.settings.lock().unwrap();
        let mut state = self.state.lock().unwrap();
        state.session_type = session_type;
        state.time_remaining = match session_type {
            SessionType::Work => settings.work_duration * 60,
            SessionType::ShortBreak => settings.short_break_duration * 60,
            SessionType::LongBreak => settings.long_break_duration * 60,
        };
        state.is_running = false;
    }

    /// Complete the current session and move to next
    pub fn complete_session(&self) -> PomodoroState {
        let settings = self.settings.lock().unwrap();
        let mut state = self.state.lock().unwrap();

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        
        // Reset daily counter if it's a new day
        if state.last_session_date != today {
            state.total_completed_today = 0;
            state.streak = 0;
            state.last_session_date = today;
        }

        match state.session_type {
            SessionType::Work => {
                state.completed_pomodoros += 1;
                state.total_completed_today += 1;

                // Determine next session type
                if state.completed_pomodoros >= settings.pomodoros_before_long_break {
                    state.session_type = SessionType::LongBreak;
                    state.completed_pomodoros = 0;
                    state.streak += 1;
                    state.time_remaining = settings.long_break_duration * 60;
                } else {
                    state.session_type = SessionType::ShortBreak;
                    state.time_remaining = settings.short_break_duration * 60;
                }
            }
            _ => {
                // Break is over, go back to work
                state.session_type = SessionType::Work;
                state.time_remaining = settings.work_duration * 60;
            }
        }

        state.is_running = false;
        state.clone()
    }

    /// Tick the timer (decrement by 1 second)
    pub fn tick(&self) -> Option<PomodoroState> {
        if !self.is_running.load(Ordering::SeqCst) {
            return None;
        }

        let mut state = self.state.lock().unwrap();

        if state.time_remaining > 0 {
            state.time_remaining -= 1;
            
            // Check if session completed
            if state.time_remaining == 0 {
                drop(state); // Release lock before calling complete_session
                return Some(self.complete_session());
            }
        }

        Some(state.clone())
    }

    /// Get current state
    pub fn get_state(&self) -> PomodoroState {
        self.state.lock().unwrap().clone()
    }

    /// Get settings
    pub fn get_settings(&self) -> PomodoroSettings {
        self.settings.lock().unwrap().clone()
    }

    /// Update settings
    pub fn update_settings(&self, new_settings: PomodoroSettings) {
        let mut settings = self.settings.lock().unwrap();
        *settings = new_settings;
    }

    /// Check if timer is running
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Get time remaining for tray display
    pub fn get_time_remaining_display(&self) -> String {
        let state = self.state.lock().unwrap();
        let minutes = state.time_remaining / 60;
        let seconds = state.time_remaining % 60;
        format!("{:02}:{:02}", minutes, seconds)
    }

    /// Get current session type for tray
    pub fn get_session_type(&self) -> SessionType {
        self.state.lock().unwrap().session_type
    }
}

impl Default for PomodoroManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Start the background timer task
pub fn start_pomodoro_timer<R: Runtime>(app_handle: AppHandle<R>, manager: Arc<PomodoroManager>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = interval(Duration::from_secs(1));
        let mut was_running = false;
        let mut last_session_type = SessionType::Work;

        loop {
            interval.tick().await;

            if let Some(state) = manager.tick() {
                let is_running = manager.is_running();
                
                // Update tray state whenever pomodoro state changes
                if is_running != was_running || state.session_type != last_session_type {
                    crate::tray::update_pomodoro_state(
                        state.time_remaining as u64,
                        is_running,
                        state.session_type.clone(),
                    );
                    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
                    was_running = is_running;
                    last_session_type = state.session_type.clone();
                } else if is_running {
                    // Update tray time display every tick while running
                    crate::tray::update_pomodoro_state(
                        state.time_remaining as u64,
                        is_running,
                        state.session_type.clone(),
                    );
                    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
                }
                
                // Emit tick event with current time
                let time_display = manager.get_time_remaining_display();
                let _ = app_handle.emit("pomodoro:tick", serde_json::json!({
                    "time_remaining": state.time_remaining,
                    "time_display": time_display,
                    "is_running": is_running,
                    "session_type": state.session_type,
                }));

                // Check if session just completed
                if state.time_remaining == 0 || 
                   (is_running && state.time_remaining == 0) {
                    // Session completed
                    let completed_type = match state.session_type {
                        SessionType::Work => SessionType::LongBreak, // We just switched
                        _ => SessionType::Work,
                    };

                    let _ = app_handle.emit("pomodoro:completed", serde_json::json!({
                        "completed_type": completed_type,
                        "new_session_type": state.session_type,
                        "completed_pomodoros": state.completed_pomodoros,
                        "total_completed_today": state.total_completed_today,
                    }));

                    // Update tray one more time after completion
                    crate::tray::update_pomodoro_state(
                        state.time_remaining as u64,
                        false,
                        state.session_type.clone(),
                    );
                    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);

                    // Show notification
                    let settings = manager.get_settings();
                    if settings.notifications_enabled {
                        let title = if completed_type == SessionType::Work {
                            "🍅 Pomodoro Complete!"
                        } else {
                            "⏰ Break Over!"
                        };
                        let body = if completed_type == SessionType::Work {
                            "Great work! Time for a break."
                        } else {
                            "Ready to focus again?"
                        };

                        let _ = app_handle.notification()
                            .builder()
                            .title(title)
                            .body(body)
                            .show();
                    }
                }
            }
        }
    });
}

/// Load pomodoro state from disk
pub fn load_pomodoro_state(app_handle: &AppHandle) -> (PomodoroState, PomodoroSettings) {
    let app_data_dir = app_handle.path().app_data_dir()
        .expect("Failed to get app data directory");
    let state_path = app_data_dir.join("pomodoro_state.json");
    let settings_path = app_data_dir.join("pomodoro_settings.json");

    let state = if state_path.exists() {
        std::fs::read_to_string(&state_path)
            .ok()
            .and_then(|s| serde_json::from_str::<PomodoroState>(&s).ok())
            .unwrap_or_default()
    } else {
        PomodoroState::default()
    };

    let settings = if settings_path.exists() {
        std::fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str::<PomodoroSettings>(&s).ok())
            .unwrap_or_default()
    } else {
        PomodoroSettings::default()
    };

    // Check if we need to reset daily stats
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut state = state;
    if state.last_session_date != today {
        state.total_completed_today = 0;
        state.last_session_date = today;
    }

    (state, settings)
}

/// Save pomodoro state to disk
pub fn save_pomodoro_state(app_handle: &AppHandle, state: &PomodoroState) {
    let app_data_dir = app_handle.path().app_data_dir()
        .expect("Failed to get app data directory");
    let state_path = app_data_dir.join("pomodoro_state.json");

    if let Ok(json) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(&state_path, json);
    }
}

/// Save pomodoro settings to disk
pub fn save_pomodoro_settings(app_handle: &AppHandle, settings: &PomodoroSettings) {
    let app_data_dir = app_handle.path().app_data_dir()
        .expect("Failed to get app data directory");
    let settings_path = app_data_dir.join("pomodoro_settings.json");

    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = std::fs::write(&settings_path, json);
    }
}

// Tauri Commands

#[tauri::command]
pub fn pomodoro_start(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) {
    manager.start();
    // Sync with tray
    let state = manager.get_state();
    crate::tray::update_pomodoro_state(state.time_remaining as u64, true, state.session_type);
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
}

#[tauri::command]
pub fn pomodoro_pause(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) {
    manager.pause();
    // Sync with tray
    let state = manager.get_state();
    crate::tray::update_pomodoro_state(state.time_remaining as u64, false, state.session_type);
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
}

#[tauri::command]
pub fn pomodoro_reset(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) {
    manager.reset();
    // Sync with tray
    let state = manager.get_state();
    crate::tray::update_pomodoro_state(state.time_remaining as u64, false, state.session_type);
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
}

#[tauri::command]
pub fn pomodoro_skip(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) -> PomodoroState {
    let state = manager.skip_session();
    // Sync with tray
    crate::tray::update_pomodoro_state(state.time_remaining as u64, false, state.session_type.clone());
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
    state
}

#[tauri::command]
pub fn pomodoro_set_session(
    session_type: String,
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) {
    let session_type = match session_type.as_str() {
        "work" => SessionType::Work,
        "short-break" => SessionType::ShortBreak,
        "long-break" => SessionType::LongBreak,
        _ => SessionType::Work,
    };
    manager.set_session_type(session_type.clone());
    // Sync with tray
    let state = manager.get_state();
    crate::tray::update_pomodoro_state(state.time_remaining as u64, manager.is_running(), session_type);
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
}

#[tauri::command]
pub fn pomodoro_get_state(manager: tauri::State<'_, Arc<PomodoroManager>>) -> PomodoroState {
    manager.get_state()
}

#[tauri::command]
pub fn pomodoro_get_settings(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
) -> PomodoroSettings {
    manager.get_settings()
}

#[tauri::command]
pub fn pomodoro_update_settings(
    settings: PomodoroSettings,
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) {
    manager.update_settings(settings.clone());
    save_pomodoro_settings(&app_handle, &settings);
}

#[tauri::command]
pub fn pomodoro_is_running(manager: tauri::State<'_, Arc<PomodoroManager>>) -> bool {
    manager.is_running()
}

#[tauri::command]
pub fn pomodoro_save_state(
    app_handle: AppHandle,
    manager: tauri::State<'_, Arc<PomodoroManager>>,
) {
    let state = manager.get_state();
    save_pomodoro_state(&app_handle, &state);
    // Sync with tray
    crate::tray::update_pomodoro_state(state.time_remaining as u64, manager.is_running(), state.session_type);
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
}

#[tauri::command]
pub fn pomodoro_get_tray_info(
    manager: tauri::State<'_, Arc<PomodoroManager>>,
    app_handle: AppHandle,
) -> serde_json::Value {
    // Update tray state when info is requested
    let state = manager.get_state();
    crate::tray::update_pomodoro_state(state.time_remaining as u64, manager.is_running(), state.session_type.clone());
    let _ = crate::tray::update_tray_pomodoro_state(&app_handle);
    
    serde_json::json!({
        "time_display": manager.get_time_remaining_display(),
        "is_running": manager.is_running(),
        "session_type": state.session_type,
    })
}
