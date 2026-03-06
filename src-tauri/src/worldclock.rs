//! World Clock - Display multiple timezone clocks for remote team coordination
//!
//! Allows users to add, remove, and view clocks in different timezones.
//! Stores timezone list persistently via Tauri state.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldClockEntry {
    pub id: String,
    pub label: String,
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldClockTime {
    pub id: String,
    pub label: String,
    pub timezone: String,
    pub hours: u32,
    pub minutes: u32,
    pub seconds: u32,
    pub offset_hours: i32,
    pub offset_minutes: i32,
    pub day_of_week: String,
    pub date_str: String,
    pub is_dst: bool,
}

pub struct WorldClockManager {
    clocks: Mutex<Vec<WorldClockEntry>>,
}

impl Default for WorldClockManager {
    fn default() -> Self {
        Self {
            clocks: Mutex::new(vec![
                WorldClockEntry {
                    id: "utc".into(),
                    label: "UTC".into(),
                    timezone: "UTC+0".into(),
                },
                WorldClockEntry {
                    id: "est".into(),
                    label: "New York".into(),
                    timezone: "UTC-5".into(),
                },
                WorldClockEntry {
                    id: "pst".into(),
                    label: "San Francisco".into(),
                    timezone: "UTC-8".into(),
                },
                WorldClockEntry {
                    id: "cet".into(),
                    label: "London".into(),
                    timezone: "UTC+0".into(),
                },
            ]),
        }
    }
}

fn parse_utc_offset(tz: &str) -> (i32, i32) {
    let stripped = tz.trim_start_matches("UTC").trim_start_matches("utc");
    if stripped.is_empty() || stripped == "+0" || stripped == "-0" {
        return (0, 0);
    }

    let (sign, rest) = if stripped.starts_with('-') {
        (-1, &stripped[1..])
    } else if stripped.starts_with('+') {
        (1, &stripped[1..])
    } else {
        (1, stripped)
    };

    if let Some(colon_pos) = rest.find(':') {
        let hours: i32 = rest[..colon_pos].parse().unwrap_or(0);
        let minutes: i32 = rest[colon_pos + 1..].parse().unwrap_or(0);
        (sign * hours, sign * minutes)
    } else {
        let hours: i32 = rest.parse().unwrap_or(0);
        (sign * hours, 0)
    }
}

fn day_of_week_name(days_since_epoch: i64) -> &'static str {
    // Jan 1, 1970 was a Thursday (day 4)
    let dow = ((days_since_epoch % 7) + 4 + 7) % 7;
    match dow {
        0 => "Sun",
        1 => "Mon",
        2 => "Tue",
        3 => "Wed",
        4 => "Thu",
        5 => "Fri",
        6 => "Sat",
        _ => "???",
    }
}

fn format_date(total_secs: i64) -> String {
    // Simple date calculation from unix timestamp
    let days = total_secs / 86400;
    let mut y = 1970i64;
    let mut remaining_days = days;

    loop {
        let days_in_year = if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }

    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let month_days = [
        31,
        if leap { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    let mut m = 0usize;
    for (i, &md) in month_days.iter().enumerate() {
        if remaining_days < md as i64 {
            m = i;
            break;
        }
        remaining_days -= md as i64;
    }

    format!("{} {} {}", month_names[m], remaining_days + 1, y)
}

fn get_clock_time(tz: &str) -> (u32, u32, u32, i32, i32, String, String) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    let (offset_h, offset_m) = parse_utc_offset(tz);
    let total_offset_secs = (offset_h as i64) * 3600 + (offset_m as i64) * 60;
    let local_secs = now.as_secs() as i64 + total_offset_secs;

    let day_secs = ((local_secs % 86400) + 86400) % 86400;
    let hours = (day_secs / 3600) as u32;
    let minutes = ((day_secs % 3600) / 60) as u32;
    let seconds = (day_secs % 60) as u32;

    let days_since_epoch = local_secs / 86400;
    let dow = day_of_week_name(days_since_epoch).to_string();
    let date = format_date(local_secs);

    (hours, minutes, seconds, offset_h, offset_m, dow, date)
}

#[tauri::command]
pub fn worldclock_get_clocks(
    manager: State<'_, WorldClockManager>,
) -> Result<Vec<WorldClockEntry>, String> {
    let clocks = manager.clocks.lock().map_err(|e| e.to_string())?;
    Ok(clocks.clone())
}

#[tauri::command]
pub fn worldclock_get_times(
    manager: State<'_, WorldClockManager>,
) -> Result<Vec<WorldClockTime>, String> {
    let clocks = manager.clocks.lock().map_err(|e| e.to_string())?;
    let times = clocks
        .iter()
        .map(|c| {
            let (hours, minutes, seconds, offset_h, offset_m, dow, date) =
                get_clock_time(&c.timezone);
            WorldClockTime {
                id: c.id.clone(),
                label: c.label.clone(),
                timezone: c.timezone.clone(),
                hours,
                minutes,
                seconds,
                offset_hours: offset_h,
                offset_minutes: offset_m,
                day_of_week: dow,
                date_str: date,
                is_dst: false,
            }
        })
        .collect();
    Ok(times)
}

#[tauri::command]
pub fn worldclock_add_clock(
    manager: State<'_, WorldClockManager>,
    label: String,
    timezone: String,
) -> Result<Vec<WorldClockEntry>, String> {
    let mut clocks = manager.clocks.lock().map_err(|e| e.to_string())?;
    let id = format!(
        "clock_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    clocks.push(WorldClockEntry {
        id,
        label,
        timezone,
    });
    Ok(clocks.clone())
}

#[tauri::command]
pub fn worldclock_remove_clock(
    manager: State<'_, WorldClockManager>,
    id: String,
) -> Result<Vec<WorldClockEntry>, String> {
    let mut clocks = manager.clocks.lock().map_err(|e| e.to_string())?;
    clocks.retain(|c| c.id != id);
    Ok(clocks.clone())
}

use tauri::State;
