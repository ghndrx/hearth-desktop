//! App usage analytics for Hearth desktop app
//!
//! Tracks local-only usage patterns to help users understand
//! their communication habits. All data stays on-device.

use chrono::{DateTime, Utc, Duration, Datelike, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageEvent {
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyStats {
    pub date: String,
    pub messages_sent: u32,
    pub messages_received: u32,
    pub reactions_sent: u32,
    pub voice_minutes: f64,
    pub active_minutes: u32,
    pub servers_visited: u32,
    pub channels_visited: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyReport {
    pub week_start: String,
    pub week_end: String,
    pub total_messages: u32,
    pub total_voice_minutes: f64,
    pub total_active_minutes: u32,
    pub most_active_day: String,
    pub most_active_hour: u8,
    pub top_servers: Vec<(String, u32)>,
    pub top_channels: Vec<(String, u32)>,
    pub daily_breakdown: Vec<DailyStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyActivity {
    pub hour: u8,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSummary {
    pub total_messages_sent: u64,
    pub total_messages_received: u64,
    pub total_reactions: u64,
    pub total_voice_minutes: f64,
    pub total_active_hours: f64,
    pub member_since: Option<String>,
    pub current_streak_days: u32,
    pub longest_streak_days: u32,
    pub hourly_activity: Vec<HourlyActivity>,
    pub favorite_time: String,
}

pub struct AnalyticsState {
    pub events: Mutex<Vec<UsageEvent>>,
    pub daily_stats: Mutex<HashMap<String, DailyStats>>,
    pub lifetime: Mutex<LifetimeStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LifetimeStats {
    pub total_messages_sent: u64,
    pub total_messages_received: u64,
    pub total_reactions: u64,
    pub total_voice_minutes: f64,
    pub total_active_minutes: u64,
    pub first_seen: Option<DateTime<Utc>>,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub hourly_counts: [u32; 24],
}

impl Default for AnalyticsState {
    fn default() -> Self {
        Self {
            events: Mutex::new(Vec::new()),
            daily_stats: Mutex::new(HashMap::new()),
            lifetime: Mutex::new(LifetimeStats::default()),
        }
    }
}

fn today_key() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

#[tauri::command]
pub fn analytics_record_event(
    state: State<'_, AnalyticsState>,
    event_type: String,
    metadata: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let event = UsageEvent {
        event_type: event_type.clone(),
        timestamp: Utc::now(),
        metadata: metadata.unwrap_or_default(),
    };

    let mut events = state.events.lock().map_err(|e| e.to_string())?;
    events.push(event);

    // Keep only last 10000 events
    if events.len() > 10000 {
        let drain_count = events.len() - 10000;
        events.drain(..drain_count);
    }

    // Update daily stats
    let key = today_key();
    let mut daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    let stats = daily.entry(key.clone()).or_insert_with(|| DailyStats {
        date: key,
        ..Default::default()
    });

    match event_type.as_str() {
        "message_sent" => stats.messages_sent += 1,
        "message_received" => stats.messages_received += 1,
        "reaction_sent" => stats.reactions_sent += 1,
        _ => {}
    }

    // Update lifetime stats
    let mut lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;
    match event_type.as_str() {
        "message_sent" => lifetime.total_messages_sent += 1,
        "message_received" => lifetime.total_messages_received += 1,
        "reaction_sent" => lifetime.total_reactions += 1,
        _ => {}
    }

    let hour = Utc::now().hour() as usize;
    if hour < 24 {
        lifetime.hourly_counts[hour] += 1;
    }

    if lifetime.first_seen.is_none() {
        lifetime.first_seen = Some(Utc::now());
    }

    Ok(())
}

#[tauri::command]
pub fn analytics_record_voice_time(
    state: State<'_, AnalyticsState>,
    minutes: f64,
) -> Result<(), String> {
    let key = today_key();
    let mut daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    let stats = daily.entry(key.clone()).or_insert_with(|| DailyStats {
        date: key,
        ..Default::default()
    });
    stats.voice_minutes += minutes;

    let mut lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;
    lifetime.total_voice_minutes += minutes;

    Ok(())
}

#[tauri::command]
pub fn analytics_record_active_time(
    state: State<'_, AnalyticsState>,
    minutes: u32,
) -> Result<(), String> {
    let key = today_key();
    let mut daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    let stats = daily.entry(key.clone()).or_insert_with(|| DailyStats {
        date: key,
        ..Default::default()
    });
    stats.active_minutes += minutes;

    let mut lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;
    lifetime.total_active_minutes += minutes as u64;

    Ok(())
}

#[tauri::command]
pub fn analytics_get_today(
    state: State<'_, AnalyticsState>,
) -> Result<DailyStats, String> {
    let key = today_key();
    let daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    Ok(daily.get(&key).cloned().unwrap_or_else(|| DailyStats {
        date: key,
        ..Default::default()
    }))
}

#[tauri::command]
pub fn analytics_get_daily(
    state: State<'_, AnalyticsState>,
    date: String,
) -> Result<DailyStats, String> {
    let daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    Ok(daily.get(&date).cloned().unwrap_or_else(|| DailyStats {
        date,
        ..Default::default()
    }))
}

#[tauri::command]
pub fn analytics_get_range(
    state: State<'_, AnalyticsState>,
    days: u32,
) -> Result<Vec<DailyStats>, String> {
    let daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();
    let mut result = Vec::new();

    for i in 0..days {
        let date = (now - Duration::days(i as i64)).format("%Y-%m-%d").to_string();
        let stats = daily.get(&date).cloned().unwrap_or_else(|| DailyStats {
            date,
            ..Default::default()
        });
        result.push(stats);
    }

    result.reverse();
    Ok(result)
}

#[tauri::command]
pub fn analytics_get_summary(
    state: State<'_, AnalyticsState>,
) -> Result<UsageSummary, String> {
    let lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;

    let hourly_activity: Vec<HourlyActivity> = lifetime
        .hourly_counts
        .iter()
        .enumerate()
        .map(|(h, &count)| HourlyActivity {
            hour: h as u8,
            count,
        })
        .collect();

    let peak_hour = lifetime
        .hourly_counts
        .iter()
        .enumerate()
        .max_by_key(|(_, &count)| count)
        .map(|(h, _)| h)
        .unwrap_or(12);

    let favorite_time = format!(
        "{:02}:00 - {:02}:00",
        peak_hour,
        (peak_hour + 1) % 24
    );

    Ok(UsageSummary {
        total_messages_sent: lifetime.total_messages_sent,
        total_messages_received: lifetime.total_messages_received,
        total_reactions: lifetime.total_reactions,
        total_voice_minutes: lifetime.total_voice_minutes,
        total_active_hours: lifetime.total_active_minutes as f64 / 60.0,
        member_since: lifetime.first_seen.map(|d| d.format("%Y-%m-%d").to_string()),
        current_streak_days: lifetime.current_streak,
        longest_streak_days: lifetime.longest_streak,
        hourly_activity,
        favorite_time,
    })
}

#[tauri::command]
pub fn analytics_get_weekly_report(
    state: State<'_, AnalyticsState>,
) -> Result<WeeklyReport, String> {
    let daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();
    let week_start = now - Duration::days(6);

    let mut total_messages = 0u32;
    let mut total_voice = 0.0f64;
    let mut total_active = 0u32;
    let mut most_active_day = String::new();
    let mut max_activity = 0u32;
    let mut breakdown = Vec::new();

    for i in 0..7 {
        let date = (week_start + Duration::days(i)).format("%Y-%m-%d").to_string();
        let stats = daily.get(&date).cloned().unwrap_or_else(|| DailyStats {
            date: date.clone(),
            ..Default::default()
        });

        let day_total = stats.messages_sent + stats.messages_received;
        total_messages += day_total;
        total_voice += stats.voice_minutes;
        total_active += stats.active_minutes;

        if day_total > max_activity {
            max_activity = day_total;
            most_active_day = date;
        }

        breakdown.push(stats);
    }

    let lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;
    let most_active_hour = lifetime
        .hourly_counts
        .iter()
        .enumerate()
        .max_by_key(|(_, &count)| count)
        .map(|(h, _)| h as u8)
        .unwrap_or(12);

    Ok(WeeklyReport {
        week_start: week_start.format("%Y-%m-%d").to_string(),
        week_end: now.format("%Y-%m-%d").to_string(),
        total_messages,
        total_voice_minutes: total_voice,
        total_active_minutes: total_active,
        most_active_day,
        most_active_hour,
        top_servers: Vec::new(),
        top_channels: Vec::new(),
        daily_breakdown: breakdown,
    })
}

#[tauri::command]
pub fn analytics_reset(
    state: State<'_, AnalyticsState>,
) -> Result<(), String> {
    let mut events = state.events.lock().map_err(|e| e.to_string())?;
    events.clear();
    let mut daily = state.daily_stats.lock().map_err(|e| e.to_string())?;
    daily.clear();
    let mut lifetime = state.lifetime.lock().map_err(|e| e.to_string())?;
    *lifetime = LifetimeStats::default();
    Ok(())
}
