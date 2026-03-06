// Night Light / Blue Light Filter
// Adjusts display color temperature to reduce eye strain during evening hours

use chrono::{Datelike, Local, NaiveTime, Timelike};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter, Manager, State};

/// Color temperature in Kelvin (lower = warmer/more orange)
/// Typical range: 1900K (candlelight) to 6500K (daylight)
pub const TEMP_DAYLIGHT: u32 = 6500;
pub const TEMP_SUNSET: u32 = 4500;
pub const TEMP_WARM: u32 = 3400;
pub const TEMP_CANDLELIGHT: u32 = 1900;

/// Night light mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NightLightMode {
    /// Off - no color adjustment
    Off,
    /// Manual - user controls when active
    Manual,
    /// Scheduled - active during set hours
    Scheduled,
    /// SunsetToSunrise - automatic based on approximate solar times
    SunsetToSunrise,
}

impl Default for NightLightMode {
    fn default() -> Self {
        NightLightMode::Off
    }
}

/// Night light schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NightLightSchedule {
    /// Time to turn on (24h format, e.g., "20:00")
    pub start_time: String,
    /// Time to turn off (24h format, e.g., "07:00")
    pub end_time: String,
    /// Minutes to transition (fade in/out)
    pub transition_minutes: u32,
}

impl Default for NightLightSchedule {
    fn default() -> Self {
        Self {
            start_time: "20:00".to_string(),
            end_time: "07:00".to_string(),
            transition_minutes: 30,
        }
    }
}

/// Night light settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NightLightSettings {
    /// Operating mode
    pub mode: NightLightMode,
    /// Target color temperature when active (Kelvin)
    pub temperature: u32,
    /// Current intensity (0.0 to 1.0, for transitions)
    pub intensity: f32,
    /// Is currently active (applying filter)
    pub is_active: bool,
    /// Schedule settings
    pub schedule: NightLightSchedule,
    /// Latitude for sunset/sunrise calculation (optional)
    pub latitude: Option<f64>,
    /// Longitude for sunset/sunrise calculation (optional)
    pub longitude: Option<f64>,
}

impl Default for NightLightSettings {
    fn default() -> Self {
        Self {
            mode: NightLightMode::Off,
            temperature: TEMP_WARM,
            intensity: 1.0,
            is_active: false,
            schedule: NightLightSchedule::default(),
            latitude: None,
            longitude: None,
        }
    }
}

/// Night light status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NightLightStatus {
    pub settings: NightLightSettings,
    /// Effective color temperature being applied
    pub effective_temperature: u32,
    /// CSS filter value for the frontend to apply
    pub css_filter: String,
    /// Next scheduled state change (if scheduled mode)
    pub next_change: Option<String>,
    /// Human-readable status
    pub status_text: String,
}

/// State managed by Tauri
pub struct NightLightState {
    pub settings: RwLock<NightLightSettings>,
}

impl Default for NightLightState {
    fn default() -> Self {
        Self {
            settings: RwLock::new(NightLightSettings::default()),
        }
    }
}

/// Convert color temperature to CSS filter
/// Uses sepia, saturate, and brightness to approximate color temperature shift
fn temperature_to_css_filter(temp: u32, intensity: f32) -> String {
    if intensity <= 0.0 || temp >= TEMP_DAYLIGHT {
        return "none".to_string();
    }

    // Calculate warmth factor (0.0 = daylight, 1.0 = candlelight)
    let warmth = ((TEMP_DAYLIGHT - temp) as f32 / (TEMP_DAYLIGHT - TEMP_CANDLELIGHT) as f32)
        .clamp(0.0, 1.0);
    
    // Apply intensity scaling
    let effective_warmth = warmth * intensity;
    
    if effective_warmth <= 0.01 {
        return "none".to_string();
    }

    // Generate CSS filter
    // Sepia adds the warm tint
    let sepia = (effective_warmth * 40.0).round() as u32;
    // Reduce brightness slightly for very warm temperatures
    let brightness = 100 - (effective_warmth * 10.0).round() as u32;
    // Adjust saturation
    let saturate = 100 + (effective_warmth * 20.0).round() as u32;
    // Add slight hue rotation towards orange
    let hue_rotate = -(effective_warmth * 10.0).round() as i32;

    format!(
        "sepia({}%) brightness({}%) saturate({}%) hue-rotate({}deg)",
        sepia, brightness, saturate, hue_rotate
    )
}

/// Parse time string to NaiveTime
fn parse_time(time_str: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(time_str, "%H:%M").ok()
}

/// Check if current time is within the schedule
fn is_within_schedule(schedule: &NightLightSchedule) -> (bool, f32) {
    let now = Local::now().time();
    
    let start = match parse_time(&schedule.start_time) {
        Some(t) => t,
        None => return (false, 0.0),
    };
    let end = match parse_time(&schedule.end_time) {
        Some(t) => t,
        None => return (false, 0.0),
    };

    let transition_secs = (schedule.transition_minutes * 60) as i64;
    let now_secs = now.num_seconds_from_midnight() as i64;
    let start_secs = start.num_seconds_from_midnight() as i64;
    let end_secs = end.num_seconds_from_midnight() as i64;

    // Handle overnight schedules (e.g., 20:00 to 07:00)
    let (in_schedule, seconds_since_start, seconds_until_end) = if start_secs > end_secs {
        // Overnight schedule
        if now_secs >= start_secs {
            // After start time (same day)
            let since_start = now_secs - start_secs;
            let until_end = (86400 - now_secs) + end_secs;
            (true, since_start, until_end)
        } else if now_secs < end_secs {
            // Before end time (next day)
            let since_start = (86400 - start_secs) + now_secs;
            let until_end = end_secs - now_secs;
            (true, since_start, until_end)
        } else {
            (false, 0, 0)
        }
    } else {
        // Same-day schedule
        if now_secs >= start_secs && now_secs < end_secs {
            (true, now_secs - start_secs, end_secs - now_secs)
        } else {
            (false, 0, 0)
        }
    };

    if !in_schedule {
        return (false, 0.0);
    }

    // Calculate transition intensity
    let intensity = if seconds_since_start < transition_secs {
        // Fading in
        seconds_since_start as f32 / transition_secs as f32
    } else if seconds_until_end < transition_secs {
        // Fading out
        seconds_until_end as f32 / transition_secs as f32
    } else {
        // Full intensity
        1.0
    };

    (true, intensity.clamp(0.0, 1.0))
}

/// Get approximate sunset/sunrise times based on latitude
/// This is a simplified calculation - a production app would use more accurate algorithms
fn get_sun_schedule(_latitude: f64) -> NightLightSchedule {
    // Simplified: use seasonal approximation based on month
    let month = Local::now().month();
    
    let (start, end) = match month {
        // Winter (earlier sunset)
        12 | 1 | 2 => ("17:00", "07:30"),
        // Spring (later sunset)
        3 | 4 | 5 => ("19:00", "06:30"),
        // Summer (latest sunset)
        6 | 7 | 8 => ("21:00", "05:30"),
        // Fall (earlier sunset)
        9 | 10 | 11 => ("18:30", "06:30"),
        _ => ("20:00", "07:00"),
    };

    NightLightSchedule {
        start_time: start.to_string(),
        end_time: end.to_string(),
        transition_minutes: 45,
    }
}

/// Calculate the current status
fn calculate_status(settings: &NightLightSettings) -> NightLightStatus {
    let (is_active, intensity) = match settings.mode {
        NightLightMode::Off => (false, 0.0),
        NightLightMode::Manual => (settings.is_active, if settings.is_active { settings.intensity } else { 0.0 }),
        NightLightMode::Scheduled => {
            is_within_schedule(&settings.schedule)
        }
        NightLightMode::SunsetToSunrise => {
            let schedule = get_sun_schedule(settings.latitude.unwrap_or(40.0));
            is_within_schedule(&schedule)
        }
    };

    let effective_temperature = if is_active && intensity > 0.0 {
        // Interpolate between daylight and target temperature
        let temp_diff = (TEMP_DAYLIGHT - settings.temperature) as f32;
        TEMP_DAYLIGHT - (temp_diff * intensity) as u32
    } else {
        TEMP_DAYLIGHT
    };

    let css_filter = temperature_to_css_filter(settings.temperature, intensity);

    let status_text = match settings.mode {
        NightLightMode::Off => "Night light is off".to_string(),
        NightLightMode::Manual => {
            if is_active {
                format!("Night light on ({}K)", settings.temperature)
            } else {
                "Night light ready (manual mode)".to_string()
            }
        }
        NightLightMode::Scheduled => {
            if is_active {
                format!("Night light active until {}", settings.schedule.end_time)
            } else {
                format!("Night light scheduled for {}", settings.schedule.start_time)
            }
        }
        NightLightMode::SunsetToSunrise => {
            if is_active {
                "Night light active until sunrise".to_string()
            } else {
                "Night light will activate at sunset".to_string()
            }
        }
    };

    let next_change = match settings.mode {
        NightLightMode::Scheduled => {
            Some(if is_active {
                settings.schedule.end_time.clone()
            } else {
                settings.schedule.start_time.clone()
            })
        }
        _ => None,
    };

    NightLightStatus {
        settings: NightLightSettings {
            is_active,
            intensity,
            ..settings.clone()
        },
        effective_temperature,
        css_filter,
        next_change,
        status_text,
    }
}

/// Get current night light status
#[tauri::command]
pub fn nightlight_get_status(state: State<'_, Arc<NightLightState>>) -> NightLightStatus {
    let settings = state.settings.read().unwrap();
    calculate_status(&settings)
}

/// Get night light settings
#[tauri::command]
pub fn nightlight_get_settings(state: State<'_, Arc<NightLightState>>) -> NightLightSettings {
    state.settings.read().unwrap().clone()
}

/// Update night light settings
#[tauri::command]
pub fn nightlight_set_settings(
    state: State<'_, Arc<NightLightState>>,
    app_handle: AppHandle,
    settings: NightLightSettings,
) -> NightLightStatus {
    {
        let mut current = state.settings.write().unwrap();
        *current = settings;
    }
    
    let status = nightlight_get_status(state);
    let _ = app_handle.emit("nightlight-changed", &status);
    status
}

/// Toggle night light on/off (for manual mode)
#[tauri::command]
pub fn nightlight_toggle(
    state: State<'_, Arc<NightLightState>>,
    app_handle: AppHandle,
) -> NightLightStatus {
    {
        let mut settings = state.settings.write().unwrap();
        if settings.mode == NightLightMode::Off {
            settings.mode = NightLightMode::Manual;
        }
        settings.is_active = !settings.is_active;
    }
    
    let status = nightlight_get_status(state);
    let _ = app_handle.emit("nightlight-changed", &status);
    status
}

/// Set the color temperature
#[tauri::command]
pub fn nightlight_set_temperature(
    state: State<'_, Arc<NightLightState>>,
    app_handle: AppHandle,
    temperature: u32,
) -> NightLightStatus {
    {
        let mut settings = state.settings.write().unwrap();
        settings.temperature = temperature.clamp(TEMP_CANDLELIGHT, TEMP_DAYLIGHT);
    }
    
    let status = nightlight_get_status(state);
    let _ = app_handle.emit("nightlight-changed", &status);
    status
}

/// Set the operating mode
#[tauri::command]
pub fn nightlight_set_mode(
    state: State<'_, Arc<NightLightState>>,
    app_handle: AppHandle,
    mode: NightLightMode,
) -> NightLightStatus {
    {
        let mut settings = state.settings.write().unwrap();
        settings.mode = mode;
        if mode == NightLightMode::Manual {
            settings.is_active = true;
        }
    }
    
    let status = nightlight_get_status(state);
    let _ = app_handle.emit("nightlight-changed", &status);
    status
}

/// Set the schedule
#[tauri::command]
pub fn nightlight_set_schedule(
    state: State<'_, Arc<NightLightState>>,
    app_handle: AppHandle,
    start_time: String,
    end_time: String,
    transition_minutes: Option<u32>,
) -> NightLightStatus {
    {
        let mut settings = state.settings.write().unwrap();
        settings.schedule.start_time = start_time;
        settings.schedule.end_time = end_time;
        if let Some(minutes) = transition_minutes {
            settings.schedule.transition_minutes = minutes;
        }
    }
    
    let status = nightlight_get_status(state);
    let _ = app_handle.emit("nightlight-changed", &status);
    status
}

/// Get temperature presets
#[tauri::command]
pub fn nightlight_get_presets() -> Vec<(String, u32)> {
    vec![
        ("Daylight".to_string(), TEMP_DAYLIGHT),
        ("Sunset".to_string(), TEMP_SUNSET),
        ("Warm".to_string(), TEMP_WARM),
        ("Candlelight".to_string(), TEMP_CANDLELIGHT),
    ]
}

/// Start the night light monitor that emits periodic status updates
pub fn start_nightlight_monitor(app_handle: AppHandle, state: Arc<NightLightState>) {
    std::thread::spawn(move || {
        let mut last_css_filter = String::new();
        
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            
            let status = {
                let settings = state.settings.read().unwrap();
                calculate_status(&settings)
            };
            
            // Only emit if the filter actually changed
            if status.css_filter != last_css_filter {
                last_css_filter = status.css_filter.clone();
                let _ = app_handle.emit("nightlight-changed", &status);
            }
        }
    });
}
