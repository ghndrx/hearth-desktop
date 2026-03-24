use chrono::{Datelike, Local, NaiveDateTime, Timelike};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronParseResult {
    pub expression: String,
    pub is_valid: bool,
    pub description: String,
    pub next_runs: Vec<String>,
    pub fields: CronFields,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronFields {
    pub minute: String,
    pub hour: String,
    pub day_of_month: String,
    pub month: String,
    pub day_of_week: String,
    pub minute_desc: String,
    pub hour_desc: String,
    pub dom_desc: String,
    pub month_desc: String,
    pub dow_desc: String,
}

pub struct CronParserManager {
    history: Mutex<Vec<CronParseResult>>,
}

impl Default for CronParserManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn describe_field(field: &str, name: &str, range_start: u32, range_end: u32) -> String {
    if field == "*" {
        return format!("every {}", name);
    }

    // */N step
    if let Some(step) = field.strip_prefix("*/") {
        if let Ok(n) = step.parse::<u32>() {
            return format!("every {} {}s", n, name);
        }
    }

    // Range: N-M
    if field.contains('-') && !field.contains(',') {
        let parts: Vec<&str> = field.split('-').collect();
        if parts.len() == 2 {
            return format!("{} {} through {}", name, parts[0], parts[1]);
        }
    }

    // List: N,M,O
    if field.contains(',') {
        return format!("{} {}", name, field);
    }

    // Single value
    format!("at {} {}", name, field)
}

fn describe_dow(field: &str) -> String {
    let day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    if field == "*" {
        return "every day of the week".into();
    }

    let resolved = field
        .split(',')
        .filter_map(|part| {
            part.parse::<usize>()
                .ok()
                .and_then(|n| day_names.get(n))
                .map(|s| s.to_string())
                .or_else(|| {
                    let upper = part.to_uppercase();
                    match upper.as_str() {
                        "SUN" => Some("Sunday".into()),
                        "MON" => Some("Monday".into()),
                        "TUE" => Some("Tuesday".into()),
                        "WED" => Some("Wednesday".into()),
                        "THU" => Some("Thursday".into()),
                        "FRI" => Some("Friday".into()),
                        "SAT" => Some("Saturday".into()),
                        _ => Some(part.to_string()),
                    }
                })
        })
        .collect::<Vec<_>>();

    if resolved.is_empty() {
        return field.to_string();
    }

    format!("on {}", resolved.join(", "))
}

fn describe_month(field: &str) -> String {
    let month_names = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];

    if field == "*" {
        return "every month".into();
    }

    let resolved = field
        .split(',')
        .filter_map(|part| {
            part.parse::<usize>()
                .ok()
                .and_then(|n| month_names.get(n))
                .map(|s| s.to_string())
                .or_else(|| Some(part.to_string()))
        })
        .collect::<Vec<_>>();

    format!("in {}", resolved.join(", "))
}

fn build_description(fields: &CronFields) -> String {
    let mut parts = Vec::new();

    // Time component
    match (fields.minute.as_str(), fields.hour.as_str()) {
        ("*", "*") => parts.push("every minute".to_string()),
        (m, "*") if !m.contains('/') && !m.contains(',') && !m.contains('-') => {
            parts.push(format!("at minute {}", m));
        }
        ("*", h) if !h.contains('/') && !h.contains(',') && !h.contains('-') => {
            parts.push(format!("every minute during hour {}", h));
        }
        ("0", h) if !h.contains('/') && !h.contains(',') && !h.contains('-') => {
            parts.push(format!("at {}:00", h));
        }
        (m, h) if !m.contains('/') && !m.contains(',') && !m.contains('-')
                && !h.contains('/') && !h.contains(',') && !h.contains('-') => {
            parts.push(format!("at {}:{:0>2}", h, m));
        }
        _ => {
            parts.push(fields.minute_desc.clone());
            parts.push(fields.hour_desc.clone());
        }
    }

    if fields.day_of_month != "*" {
        parts.push(fields.dom_desc.clone());
    }
    if fields.month != "*" {
        parts.push(fields.month_desc.clone());
    }
    if fields.day_of_week != "*" {
        parts.push(fields.dow_desc.clone());
    }

    let desc = parts.join(", ");
    let mut chars = desc.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

fn expand_field(field: &str, min: u32, max: u32) -> Vec<u32> {
    let mut values = Vec::new();

    for part in field.split(',') {
        if part == "*" {
            values.extend(min..=max);
        } else if let Some(step_str) = part.strip_prefix("*/") {
            if let Ok(step) = step_str.parse::<u32>() {
                let mut v = min;
                while v <= max {
                    values.push(v);
                    v += step;
                }
            }
        } else if part.contains('-') {
            let range_parts: Vec<&str> = part.split('-').collect();
            if range_parts.len() == 2 {
                if let (Ok(start), Ok(end)) = (range_parts[0].parse::<u32>(), range_parts[1].parse::<u32>()) {
                    values.extend(start..=end);
                }
            }
        } else if let Ok(v) = part.parse::<u32>() {
            values.push(v);
        }
    }

    values.sort();
    values.dedup();
    values
}

fn compute_next_runs(minute: &str, hour: &str, dom: &str, month: &str, dow: &str, count: usize) -> Vec<String> {
    let minutes = expand_field(minute, 0, 59);
    let hours = expand_field(hour, 0, 23);
    let doms = expand_field(dom, 1, 31);
    let months = expand_field(month, 1, 12);
    let dows = expand_field(dow, 0, 6);

    if minutes.is_empty() || hours.is_empty() || doms.is_empty() || months.is_empty() || dows.is_empty() {
        return vec![];
    }

    let now = Local::now().naive_local();
    let mut results = Vec::new();

    // Iterate forward through time to find next runs
    let mut current = now + chrono::Duration::minutes(1);
    // Zero out seconds
    current = NaiveDateTime::new(
        current.date(),
        chrono::NaiveTime::from_hms_opt(current.hour(), current.minute(), 0).unwrap(),
    );

    let max_iterations = 525600; // One year of minutes
    let mut iterations = 0;

    while results.len() < count && iterations < max_iterations {
        let m = current.minute();
        let h = current.hour();
        let d = current.day();
        let mo = current.month();
        let wd = current.weekday().num_days_from_sunday();

        if minutes.contains(&m)
            && hours.contains(&h)
            && doms.contains(&d)
            && months.contains(&mo)
            && dows.contains(&wd)
        {
            results.push(current.format("%Y-%m-%d %H:%M:%S").to_string());
            current += chrono::Duration::minutes(1);
        } else {
            // Skip ahead intelligently
            if !minutes.contains(&m) {
                current += chrono::Duration::minutes(1);
            } else if !hours.contains(&h) {
                // Skip to next hour
                current = NaiveDateTime::new(
                    current.date(),
                    chrono::NaiveTime::from_hms_opt((h + 1) % 24, 0, 0).unwrap_or(
                        chrono::NaiveTime::from_hms_opt(0, 0, 0).unwrap(),
                    ),
                );
                if (h + 1) >= 24 {
                    current += chrono::Duration::days(1);
                }
            } else {
                current += chrono::Duration::minutes(1);
            }
        }

        iterations += 1;
    }

    results
}

#[tauri::command]
pub fn cron_parse(
    manager: tauri::State<'_, CronParserManager>,
    expression: String,
) -> Result<CronParseResult, String> {
    let parts: Vec<&str> = expression.trim().split_whitespace().collect();

    if parts.len() != 5 {
        return Ok(CronParseResult {
            expression: expression.clone(),
            is_valid: false,
            description: format!(
                "Expected 5 fields (minute hour day month weekday), got {}",
                parts.len()
            ),
            next_runs: vec![],
            fields: CronFields {
                minute: String::new(),
                hour: String::new(),
                day_of_month: String::new(),
                month: String::new(),
                day_of_week: String::new(),
                minute_desc: String::new(),
                hour_desc: String::new(),
                dom_desc: String::new(),
                month_desc: String::new(),
                dow_desc: String::new(),
            },
        });
    }

    let fields = CronFields {
        minute: parts[0].to_string(),
        hour: parts[1].to_string(),
        day_of_month: parts[2].to_string(),
        month: parts[3].to_string(),
        day_of_week: parts[4].to_string(),
        minute_desc: describe_field(parts[0], "minute", 0, 59),
        hour_desc: describe_field(parts[1], "hour", 0, 23),
        dom_desc: describe_field(parts[2], "day of month", 1, 31),
        month_desc: describe_month(parts[3]),
        dow_desc: describe_dow(parts[4]),
    };

    let description = build_description(&fields);
    let next_runs = compute_next_runs(parts[0], parts[1], parts[2], parts[3], parts[4], 5);

    let result = CronParseResult {
        expression: expression.clone(),
        is_valid: true,
        description,
        next_runs,
        fields,
    };

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 30 {
            history.truncate(30);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn cron_get_presets() -> Vec<(String, String)> {
    vec![
        ("* * * * *".into(), "Every minute".into()),
        ("*/5 * * * *".into(), "Every 5 minutes".into()),
        ("*/15 * * * *".into(), "Every 15 minutes".into()),
        ("0 * * * *".into(), "Every hour".into()),
        ("0 */6 * * *".into(), "Every 6 hours".into()),
        ("0 0 * * *".into(), "Daily at midnight".into()),
        ("0 9 * * 1-5".into(), "Weekdays at 9 AM".into()),
        ("0 0 * * 0".into(), "Weekly on Sunday".into()),
        ("0 0 1 * *".into(), "Monthly on the 1st".into()),
        ("0 0 1 1 *".into(), "Yearly on January 1st".into()),
        ("30 4 * * *".into(), "Daily at 4:30 AM".into()),
        ("0 12 * * 1".into(), "Every Monday at noon".into()),
    ]
}

#[tauri::command]
pub fn cron_get_history(
    manager: tauri::State<'_, CronParserManager>,
) -> Result<Vec<CronParseResult>, String> {
    let history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    Ok(history.clone())
}

#[tauri::command]
pub fn cron_clear_history(
    manager: tauri::State<'_, CronParserManager>,
) -> Result<(), String> {
    let mut history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    history.clear();
    Ok(())
}
