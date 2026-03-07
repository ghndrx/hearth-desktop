//! Alarm Clock - Set and manage time-based alarms with notifications
//!
//! Supports one-shot and repeating alarms with snooze capability.

use chrono::{Local, NaiveTime, Datelike, Timelike};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alarm {
    pub id: String,
    pub label: String,
    pub time: String,        // HH:MM format
    pub enabled: bool,
    pub repeat_days: Vec<u8>, // 0=Sun, 1=Mon, ..., 6=Sat; empty = one-shot
    pub snoozed_until: Option<i64>, // unix timestamp if snoozed
    pub last_fired: Option<String>, // ISO date string YYYY-MM-DD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmStatus {
    pub alarms: Vec<Alarm>,
    pub next_alarm: Option<NextAlarmInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextAlarmInfo {
    pub id: String,
    pub label: String,
    pub time: String,
    pub minutes_until: i64,
}

pub struct AlarmClockManager {
    alarms: Mutex<Vec<Alarm>>,
}

impl Default for AlarmClockManager {
    fn default() -> Self {
        Self {
            alarms: Mutex::new(Vec::new()),
        }
    }
}

impl AlarmClockManager {
    fn find_next_alarm(alarms: &[Alarm]) -> Option<NextAlarmInfo> {
        let now = Local::now();
        let current_minutes = now.hour() as i64 * 60 + now.minute() as i64;

        let mut best: Option<(i64, &Alarm)> = None;

        for alarm in alarms.iter().filter(|a| a.enabled) {
            if let Some(alarm_minutes) = parse_time_minutes(&alarm.time) {
                // Check snooze
                if let Some(snoozed_until) = alarm.snoozed_until {
                    if now.timestamp() < snoozed_until {
                        let mins_until = (snoozed_until - now.timestamp()) / 60;
                        if best.is_none() || mins_until < best.unwrap().0 {
                            best = Some((mins_until, alarm));
                        }
                        continue;
                    }
                }

                let today_str = now.format("%Y-%m-%d").to_string();
                let already_fired_today = alarm.last_fired.as_deref() == Some(&today_str);

                // For one-shot alarms that already fired today, skip
                if alarm.repeat_days.is_empty() && already_fired_today {
                    continue;
                }

                let mut mins_until = alarm_minutes - current_minutes;
                if mins_until <= 0 {
                    // Check if it should fire today (hasn't fired yet)
                    if mins_until == 0 && !already_fired_today {
                        mins_until = 0;
                    } else {
                        mins_until += 24 * 60; // tomorrow
                    }
                }

                if best.is_none() || mins_until < best.unwrap().0 {
                    best = Some((mins_until, alarm));
                }
            }
        }

        best.map(|(mins, alarm)| NextAlarmInfo {
            id: alarm.id.clone(),
            label: alarm.label.clone(),
            time: alarm.time.clone(),
            minutes_until: mins,
        })
    }
}

fn parse_time_minutes(time_str: &str) -> Option<i64> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let hours: i64 = parts[0].parse().ok()?;
    let minutes: i64 = parts[1].parse().ok()?;
    Some(hours * 60 + minutes)
}

#[tauri::command]
pub fn alarm_get_status(
    state: State<'_, AlarmClockManager>,
) -> Result<AlarmStatus, String> {
    let alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    let next_alarm = AlarmClockManager::find_next_alarm(&alarms);
    Ok(AlarmStatus {
        alarms: alarms.clone(),
        next_alarm,
    })
}

#[tauri::command]
pub fn alarm_create(
    state: State<'_, AlarmClockManager>,
    label: String,
    time: String,
    repeat_days: Vec<u8>,
) -> Result<Alarm, String> {
    // Validate time format
    if NaiveTime::parse_from_str(&time, "%H:%M").is_err() {
        return Err("Invalid time format. Use HH:MM".into());
    }

    let alarm = Alarm {
        id: uuid::Uuid::new_v4().to_string(),
        label,
        time,
        enabled: true,
        repeat_days,
        snoozed_until: None,
        last_fired: None,
    };

    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    alarms.push(alarm.clone());
    Ok(alarm)
}

#[tauri::command]
pub fn alarm_delete(
    state: State<'_, AlarmClockManager>,
    id: String,
) -> Result<(), String> {
    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    alarms.retain(|a| a.id != id);
    Ok(())
}

#[tauri::command]
pub fn alarm_toggle(
    state: State<'_, AlarmClockManager>,
    id: String,
) -> Result<Alarm, String> {
    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    let alarm = alarms.iter_mut().find(|a| a.id == id)
        .ok_or("Alarm not found")?;
    alarm.enabled = !alarm.enabled;
    if alarm.enabled {
        alarm.snoozed_until = None;
        alarm.last_fired = None;
    }
    Ok(alarm.clone())
}

#[tauri::command]
pub fn alarm_snooze(
    state: State<'_, AlarmClockManager>,
    id: String,
    minutes: u32,
) -> Result<Alarm, String> {
    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    let alarm = alarms.iter_mut().find(|a| a.id == id)
        .ok_or("Alarm not found")?;
    alarm.snoozed_until = Some(Local::now().timestamp() + (minutes as i64 * 60));
    Ok(alarm.clone())
}

#[tauri::command]
pub fn alarm_check_triggered(
    state: State<'_, AlarmClockManager>,
) -> Result<Vec<Alarm>, String> {
    let now = Local::now();
    let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
    let today_str = now.format("%Y-%m-%d").to_string();
    let today_dow = now.weekday().num_days_from_sunday() as u8;

    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    let mut triggered = Vec::new();

    for alarm in alarms.iter_mut() {
        if !alarm.enabled {
            continue;
        }

        // Check snooze
        if let Some(snoozed_until) = alarm.snoozed_until {
            if now.timestamp() >= snoozed_until {
                alarm.snoozed_until = None;
                alarm.last_fired = Some(today_str.clone());
                triggered.push(alarm.clone());
                // Disable one-shot alarms after firing
                if alarm.repeat_days.is_empty() {
                    alarm.enabled = false;
                }
            }
            continue;
        }

        // Check if already fired today
        if alarm.last_fired.as_deref() == Some(&today_str) {
            continue;
        }

        // Check time match
        if alarm.time != current_time {
            continue;
        }

        // Check day-of-week for repeating alarms
        if !alarm.repeat_days.is_empty() && !alarm.repeat_days.contains(&today_dow) {
            continue;
        }

        alarm.last_fired = Some(today_str.clone());
        triggered.push(alarm.clone());

        // Disable one-shot alarms after firing
        if alarm.repeat_days.is_empty() {
            alarm.enabled = false;
        }
    }

    Ok(triggered)
}

#[tauri::command]
pub fn alarm_update(
    state: State<'_, AlarmClockManager>,
    id: String,
    label: String,
    time: String,
    repeat_days: Vec<u8>,
) -> Result<Alarm, String> {
    if NaiveTime::parse_from_str(&time, "%H:%M").is_err() {
        return Err("Invalid time format. Use HH:MM".into());
    }

    let mut alarms = state.alarms.lock().map_err(|e| e.to_string())?;
    let alarm = alarms.iter_mut().find(|a| a.id == id)
        .ok_or("Alarm not found")?;
    alarm.label = label;
    alarm.time = time;
    alarm.repeat_days = repeat_days;
    alarm.last_fired = None;
    alarm.snoozed_until = None;
    Ok(alarm.clone())
}
