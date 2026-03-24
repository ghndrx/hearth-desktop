use chrono::{DateTime, Local, NaiveDateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpochConversion {
    pub epoch_seconds: i64,
    pub epoch_millis: i64,
    pub utc_iso: String,
    pub utc_readable: String,
    pub local_iso: String,
    pub local_readable: String,
    pub relative: String,
    pub day_of_week: String,
    pub day_of_year: u32,
    pub week_number: u32,
    pub is_leap_year: bool,
}

pub struct EpochConverterManager {
    history: Mutex<Vec<EpochConversion>>,
}

impl Default for EpochConverterManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn relative_time(dt: DateTime<Utc>) -> String {
    let now = Utc::now();
    let diff = now.signed_duration_since(dt);

    if diff.num_seconds().abs() < 60 {
        return "just now".into();
    }

    let (amount, unit, is_past) = if diff.num_seconds() > 0 {
        // Past
        if diff.num_days() > 365 {
            (diff.num_days() / 365, "year", true)
        } else if diff.num_days() > 30 {
            (diff.num_days() / 30, "month", true)
        } else if diff.num_days() > 0 {
            (diff.num_days(), "day", true)
        } else if diff.num_hours() > 0 {
            (diff.num_hours(), "hour", true)
        } else {
            (diff.num_minutes(), "minute", true)
        }
    } else {
        // Future
        let abs = -diff.num_seconds();
        let days = abs / 86400;
        let hours = abs / 3600;
        let minutes = abs / 60;

        if days > 365 {
            (days / 365, "year", false)
        } else if days > 30 {
            (days / 30, "month", false)
        } else if days > 0 {
            (days, "day", false)
        } else if hours > 0 {
            (hours, "hour", false)
        } else {
            (minutes, "minute", false)
        }
    };

    let plural = if amount == 1 { "" } else { "s" };
    if is_past {
        format!("{} {}{} ago", amount, unit, plural)
    } else {
        format!("in {} {}{}", amount, unit, plural)
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn convert_epoch(epoch_seconds: i64) -> Result<EpochConversion, String> {
    let utc_dt = DateTime::<Utc>::from_timestamp(epoch_seconds, 0)
        .ok_or("Invalid epoch timestamp")?;
    let local_dt = utc_dt.with_timezone(&Local);

    Ok(EpochConversion {
        epoch_seconds,
        epoch_millis: epoch_seconds * 1000,
        utc_iso: utc_dt.to_rfc3339(),
        utc_readable: utc_dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        local_iso: local_dt.to_rfc3339(),
        local_readable: local_dt.format("%Y-%m-%d %H:%M:%S %Z").to_string(),
        relative: relative_time(utc_dt),
        day_of_week: utc_dt.format("%A").to_string(),
        day_of_year: utc_dt.format("%j").to_string().parse().unwrap_or(0),
        week_number: utc_dt.format("%U").to_string().parse().unwrap_or(0),
        is_leap_year: is_leap_year(utc_dt.format("%Y").to_string().parse().unwrap_or(0)),
    })
}

#[tauri::command]
pub fn epoch_get_now(
    manager: tauri::State<'_, EpochConverterManager>,
) -> Result<EpochConversion, String> {
    let now = Utc::now().timestamp();
    let result = convert_epoch(now)?;

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn epoch_from_timestamp(
    manager: tauri::State<'_, EpochConverterManager>,
    timestamp: i64,
) -> Result<EpochConversion, String> {
    // Auto-detect seconds vs milliseconds
    let seconds = if timestamp > 1_000_000_000_000 {
        timestamp / 1000
    } else {
        timestamp
    };

    let result = convert_epoch(seconds)?;

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn epoch_from_date(
    manager: tauri::State<'_, EpochConverterManager>,
    date_string: String,
) -> Result<EpochConversion, String> {
    // Try several common formats
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%B %d, %Y %H:%M:%S",
        "%B %d, %Y",
    ];

    let trimmed = date_string.trim();

    // Try RFC3339 first
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        let result = convert_epoch(dt.timestamp())?;
        if let Ok(mut history) = manager.history.lock() {
            history.insert(0, result.clone());
            if history.len() > 50 { history.truncate(50); }
        }
        return Ok(result);
    }

    // Try RFC2822
    if let Ok(dt) = DateTime::parse_from_rfc2822(trimmed) {
        let result = convert_epoch(dt.timestamp())?;
        if let Ok(mut history) = manager.history.lock() {
            history.insert(0, result.clone());
            if history.len() > 50 { history.truncate(50); }
        }
        return Ok(result);
    }

    for fmt in &formats {
        if let Ok(naive) = NaiveDateTime::parse_from_str(trimmed, fmt) {
            let utc = Utc.from_utc_datetime(&naive);
            let result = convert_epoch(utc.timestamp())?;
            if let Ok(mut history) = manager.history.lock() {
                history.insert(0, result.clone());
                if history.len() > 50 { history.truncate(50); }
            }
            return Ok(result);
        }
        // Try date-only formats
        if let Ok(naive_date) = chrono::NaiveDate::parse_from_str(trimmed, fmt) {
            let naive = naive_date.and_hms_opt(0, 0, 0).unwrap();
            let utc = Utc.from_utc_datetime(&naive);
            let result = convert_epoch(utc.timestamp())?;
            if let Ok(mut history) = manager.history.lock() {
                history.insert(0, result.clone());
                if history.len() > 50 { history.truncate(50); }
            }
            return Ok(result);
        }
    }

    Err(format!("Could not parse date string: '{}'", trimmed))
}

#[tauri::command]
pub fn epoch_get_history(
    manager: tauri::State<'_, EpochConverterManager>,
) -> Result<Vec<EpochConversion>, String> {
    let history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    Ok(history.clone())
}

#[tauri::command]
pub fn epoch_clear_history(
    manager: tauri::State<'_, EpochConverterManager>,
) -> Result<(), String> {
    let mut history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    history.clear();
    Ok(())
}
