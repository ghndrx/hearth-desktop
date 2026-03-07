//! Activity Heatmap - GitHub-style contribution graph for messaging activity
//!
//! Tracks messaging activity (messages sent, reactions, voice joins, etc.)
//! and aggregates into daily counts with SQLite persistence. Generates
//! heatmap data for date ranges with activity level classification.

use chrono::{Datelike, Local, NaiveDate, NaiveDateTime, Timelike};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: String,
    pub event_type: String,
    pub server_id: Option<String>,
    pub channel_id: Option<String>,
    pub timestamp: i64,
    pub date_key: String,
    pub hour: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyActivity {
    pub date: String,
    pub count: u32,
    pub level: String,
    pub events: Vec<EventTypeCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTypeCount {
    pub event_type: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapData {
    pub year: i32,
    pub weeks: Vec<Vec<DayCell>>,
    pub months: Vec<MonthLabel>,
    pub total_count: u32,
    pub active_days: u32,
    pub max_daily: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayCell {
    pub date: String,
    pub count: u32,
    pub level: String,
    pub day_of_week: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthLabel {
    pub name: String,
    pub week_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreakInfo {
    pub current_streak: u32,
    pub longest_streak: u32,
    pub last_active_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityStats {
    pub total_events: u32,
    pub active_days: u32,
    pub average_per_day: f64,
    pub most_active_day: Option<String>,
    pub most_active_count: u32,
    pub event_type_breakdown: Vec<EventTypeCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyActivity {
    pub hour: u32,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerActivity {
    pub server_id: String,
    pub count: u32,
    pub days_active: u32,
}

pub struct ActivityHeatmapManager {
    db: Mutex<rusqlite::Connection>,
}

fn classify_level(count: u32) -> String {
    match count {
        0 => "none".to_string(),
        1..=5 => "low".to_string(),
        6..=15 => "medium".to_string(),
        16..=30 => "high".to_string(),
        _ => "extreme".to_string(),
    }
}

fn now_epoch() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

impl ActivityHeatmapManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("activity_heatmap.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS activity_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                server_id TEXT,
                channel_id TEXT,
                timestamp INTEGER NOT NULL,
                date_key TEXT NOT NULL,
                hour INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_events(date_key);
            CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_activity_server ON activity_events(server_id);
            CREATE INDEX IF NOT EXISTS idx_activity_hour ON activity_events(hour);
            CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(event_type);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }

    fn get_daily_activity(&self, db: &rusqlite::Connection, date_key: &str) -> Result<DailyActivity, String> {
        let count: u32 = db
            .query_row(
                "SELECT COUNT(*) FROM activity_events WHERE date_key = ?1",
                rusqlite::params![date_key],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut stmt = db
            .prepare(
                "SELECT event_type, COUNT(*) as cnt FROM activity_events
                 WHERE date_key = ?1 GROUP BY event_type ORDER BY cnt DESC",
            )
            .map_err(|e| e.to_string())?;

        let events: Vec<EventTypeCount> = stmt
            .query_map(rusqlite::params![date_key], |row| {
                Ok(EventTypeCount {
                    event_type: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(DailyActivity {
            date: date_key.to_string(),
            count,
            level: classify_level(count),
            events,
        })
    }
}

#[tauri::command]
pub fn heatmap_record_activity(
    state: State<'_, ActivityHeatmapManager>,
    event_type: String,
    server_id: Option<String>,
    channel_id: Option<String>,
) -> Result<DailyActivity, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Local::now();
    let timestamp = now_epoch();
    let date_key = now.format("%Y-%m-%d").to_string();
    let hour = now.hour();
    let id = uuid::Uuid::new_v4().to_string();

    db.execute(
        "INSERT INTO activity_events (id, event_type, server_id, channel_id, timestamp, date_key, hour)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, event_type, server_id, channel_id, timestamp, date_key, hour],
    )
    .map_err(|e| e.to_string())?;

    state.get_daily_activity(&db, &date_key)
}

#[tauri::command]
pub fn heatmap_get_range(
    state: State<'_, ActivityHeatmapManager>,
    start_date: String,
    end_date: String,
) -> Result<Vec<DailyActivity>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {}", e))?;
    let end = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date: {}", e))?;

    // Get aggregated counts per date in range
    let mut stmt = db
        .prepare(
            "SELECT date_key, COUNT(*) FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2
             GROUP BY date_key ORDER BY date_key",
        )
        .map_err(|e| e.to_string())?;

    let mut counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let rows = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (date, count) = row.map_err(|e| e.to_string())?;
        counts.insert(date, count);
    }

    // Get event type breakdowns
    let mut type_stmt = db
        .prepare(
            "SELECT date_key, event_type, COUNT(*) FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2
             GROUP BY date_key, event_type ORDER BY date_key",
        )
        .map_err(|e| e.to_string())?;

    let mut type_map: std::collections::HashMap<String, Vec<EventTypeCount>> =
        std::collections::HashMap::new();
    let type_rows = type_stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u32>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in type_rows {
        let (date, etype, count) = row.map_err(|e| e.to_string())?;
        type_map.entry(date).or_default().push(EventTypeCount {
            event_type: etype,
            count,
        });
    }

    let mut result = Vec::new();
    let mut current = start;
    while current <= end {
        let dk = current.format("%Y-%m-%d").to_string();
        let count = counts.get(&dk).copied().unwrap_or(0);
        result.push(DailyActivity {
            date: dk.clone(),
            count,
            level: classify_level(count),
            events: type_map.remove(&dk).unwrap_or_default(),
        });
        current = current.succ_opt().unwrap_or(current);
    }

    Ok(result)
}

#[tauri::command]
pub fn heatmap_get_year(
    state: State<'_, ActivityHeatmapManager>,
    year: i32,
) -> Result<HeatmapData, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let start_date = format!("{}-01-01", year);
    let end_date = format!("{}-12-31", year);

    // Fetch all daily counts for the year
    let mut stmt = db
        .prepare(
            "SELECT date_key, COUNT(*) FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2
             GROUP BY date_key",
        )
        .map_err(|e| e.to_string())?;

    let mut counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let rows = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (date, count) = row.map_err(|e| e.to_string())?;
        counts.insert(date, count);
    }

    // Build the year grid: 53 possible weeks x 7 days
    let jan1 = NaiveDate::from_ymd_opt(year, 1, 1).ok_or("Invalid year")?;
    let dec31 = NaiveDate::from_ymd_opt(year, 12, 31).ok_or("Invalid year")?;

    // Start from the Sunday of the week containing Jan 1
    let start_weekday = jan1.weekday().num_days_from_sunday();
    let grid_start = jan1 - chrono::Duration::days(start_weekday as i64);

    let mut weeks: Vec<Vec<DayCell>> = Vec::new();
    let mut current_week: Vec<DayCell> = Vec::new();
    let mut current = grid_start;
    let mut total_count: u32 = 0;
    let mut active_days: u32 = 0;
    let mut max_daily: u32 = 0;

    // Track month labels
    let mut months: Vec<MonthLabel> = Vec::new();
    let mut last_month: u32 = 0;

    loop {
        let dk = current.format("%Y-%m-%d").to_string();
        let in_year = current >= jan1 && current <= dec31;
        let count = if in_year {
            counts.get(&dk).copied().unwrap_or(0)
        } else {
            0
        };

        if in_year && count > 0 {
            total_count += count;
            active_days += 1;
            if count > max_daily {
                max_daily = count;
            }
        }

        // Track month transitions
        if in_year && current.month() != last_month {
            last_month = current.month();
            let month_name = match current.month() {
                1 => "Jan",
                2 => "Feb",
                3 => "Mar",
                4 => "Apr",
                5 => "May",
                6 => "Jun",
                7 => "Jul",
                8 => "Aug",
                9 => "Sep",
                10 => "Oct",
                11 => "Nov",
                12 => "Dec",
                _ => "",
            };
            months.push(MonthLabel {
                name: month_name.to_string(),
                week_index: weeks.len(),
            });
        }

        current_week.push(DayCell {
            date: if in_year { dk } else { String::new() },
            count,
            level: if in_year {
                classify_level(count)
            } else {
                "none".to_string()
            },
            day_of_week: current.weekday().num_days_from_sunday(),
        });

        if current_week.len() == 7 {
            weeks.push(current_week);
            current_week = Vec::new();
        }

        if current > dec31 && current_week.is_empty() {
            break;
        }

        current = current.succ_opt().unwrap_or(current);

        // Safety: don't go more than 7 days past end of year
        if current > dec31 + chrono::Duration::days(7) {
            if !current_week.is_empty() {
                // Pad remaining days
                while current_week.len() < 7 {
                    current_week.push(DayCell {
                        date: String::new(),
                        count: 0,
                        level: "none".to_string(),
                        day_of_week: current_week.len() as u32,
                    });
                }
                weeks.push(current_week);
            }
            break;
        }
    }

    Ok(HeatmapData {
        year,
        weeks,
        months,
        total_count,
        active_days,
        max_daily,
    })
}

#[tauri::command]
pub fn heatmap_get_today(
    state: State<'_, ActivityHeatmapManager>,
) -> Result<DailyActivity, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    state.get_daily_activity(&db, &today)
}

#[tauri::command]
pub fn heatmap_get_streak(
    state: State<'_, ActivityHeatmapManager>,
) -> Result<StreakInfo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Get all distinct active dates, ordered descending
    let mut stmt = db
        .prepare(
            "SELECT DISTINCT date_key FROM activity_events ORDER BY date_key DESC",
        )
        .map_err(|e| e.to_string())?;

    let dates: Vec<NaiveDate> = stmt
        .query_map([], |row| {
            let dk: String = row.get(0)?;
            Ok(dk)
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|dk| NaiveDate::parse_from_str(&dk, "%Y-%m-%d").ok())
        .collect();

    if dates.is_empty() {
        return Ok(StreakInfo {
            current_streak: 0,
            longest_streak: 0,
            last_active_date: None,
        });
    }

    let today = Local::now().date_naive();
    let last_active = dates[0];

    // Calculate current streak (must include today or yesterday)
    let mut current_streak: u32 = 0;
    let diff_from_today = (today - last_active).num_days();
    if diff_from_today <= 1 {
        let mut expected = if diff_from_today == 0 { today } else { last_active };
        for date in &dates {
            if *date == expected {
                current_streak += 1;
                expected = expected.pred_opt().unwrap_or(expected);
            } else if *date < expected {
                break;
            }
        }
    }

    // Calculate longest streak
    let mut longest_streak: u32 = 0;
    let mut streak: u32 = 1;
    for i in 1..dates.len() {
        let diff = (dates[i - 1] - dates[i]).num_days();
        if diff == 1 {
            streak += 1;
        } else {
            if streak > longest_streak {
                longest_streak = streak;
            }
            streak = 1;
        }
    }
    if streak > longest_streak {
        longest_streak = streak;
    }

    Ok(StreakInfo {
        current_streak,
        longest_streak,
        last_active_date: Some(last_active.format("%Y-%m-%d").to_string()),
    })
}

#[tauri::command]
pub fn activity_heatmap_get_stats(
    state: State<'_, ActivityHeatmapManager>,
    start_date: String,
    end_date: String,
) -> Result<ActivityStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let total_events: u32 = db
        .query_row(
            "SELECT COUNT(*) FROM activity_events WHERE date_key >= ?1 AND date_key <= ?2",
            rusqlite::params![start_date, end_date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let active_days: u32 = db
        .query_row(
            "SELECT COUNT(DISTINCT date_key) FROM activity_events WHERE date_key >= ?1 AND date_key <= ?2",
            rusqlite::params![start_date, end_date],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {}", e))?;
    let end = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date: {}", e))?;
    let total_days = (end - start).num_days().max(1) as f64;
    let average_per_day = total_events as f64 / total_days;

    // Most active day
    let most_active: Option<(String, u32)> = db
        .query_row(
            "SELECT date_key, COUNT(*) as cnt FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2
             GROUP BY date_key ORDER BY cnt DESC LIMIT 1",
            rusqlite::params![start_date, end_date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    // Event type breakdown
    let mut type_stmt = db
        .prepare(
            "SELECT event_type, COUNT(*) as cnt FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2
             GROUP BY event_type ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;

    let event_type_breakdown: Vec<EventTypeCount> = type_stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok(EventTypeCount {
                event_type: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ActivityStats {
        total_events,
        active_days,
        average_per_day,
        most_active_day: most_active.as_ref().map(|(d, _)| d.clone()),
        most_active_count: most_active.map(|(_, c)| c).unwrap_or(0),
        event_type_breakdown,
    })
}

#[tauri::command]
pub fn heatmap_get_peak_hours(
    state: State<'_, ActivityHeatmapManager>,
) -> Result<Vec<HourlyActivity>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT hour, COUNT(*) as cnt FROM activity_events
             GROUP BY hour ORDER BY hour",
        )
        .map_err(|e| e.to_string())?;

    let mut hourly: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, u32>(0)?, row.get::<_, u32>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (hour, count) = row.map_err(|e| e.to_string())?;
        hourly.insert(hour, count);
    }

    // Return all 24 hours
    let result: Vec<HourlyActivity> = (0..24)
        .map(|h| HourlyActivity {
            hour: h,
            count: hourly.get(&h).copied().unwrap_or(0),
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn heatmap_get_server_breakdown(
    state: State<'_, ActivityHeatmapManager>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ServerActivity>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT server_id, COUNT(*) as cnt, COUNT(DISTINCT date_key) as days
             FROM activity_events
             WHERE date_key >= ?1 AND date_key <= ?2 AND server_id IS NOT NULL
             GROUP BY server_id ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;

    let results: Vec<ServerActivity> = stmt
        .query_map(rusqlite::params![start_date, end_date], |row| {
            Ok(ServerActivity {
                server_id: row.get(0)?,
                count: row.get(1)?,
                days_active: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[tauri::command]
pub fn heatmap_clear(
    state: State<'_, ActivityHeatmapManager>,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM activity_events", [])
        .map_err(|e| e.to_string())?;
    Ok(true)
}
