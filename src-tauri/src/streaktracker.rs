use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreakDay {
    pub date: String, // YYYY-MM-DD
    pub active_minutes: u32,
    pub messages_sent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreakStats {
    pub current_streak: u32,
    pub longest_streak: u32,
    pub total_active_days: u32,
    pub today_active_minutes: u32,
    pub today_messages: u32,
    pub is_active_today: bool,
    pub history: Vec<StreakDay>,
}

pub struct StreakTrackerManager {
    state: Mutex<StreakTrackerState>,
}

struct StreakTrackerState {
    days: Vec<StreakDay>,
}

impl Default for StreakTrackerManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(StreakTrackerState { days: Vec::new() }),
        }
    }
}

fn today_str() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn get_or_create_today(days: &mut Vec<StreakDay>) -> &mut StreakDay {
    let today = today_str();
    if !days.iter().any(|d| d.date == today) {
        days.push(StreakDay {
            date: today.clone(),
            active_minutes: 0,
            messages_sent: 0,
        });
    }
    days.iter_mut().find(|d| d.date == today_str()).unwrap()
}

fn compute_streaks(days: &[StreakDay]) -> (u32, u32) {
    if days.is_empty() {
        return (0, 0);
    }

    let mut dates: Vec<chrono::NaiveDate> = days
        .iter()
        .filter_map(|d| chrono::NaiveDate::parse_from_str(&d.date, "%Y-%m-%d").ok())
        .collect();
    dates.sort();
    dates.dedup();

    if dates.is_empty() {
        return (0, 0);
    }

    let today = chrono::Local::now().date_naive();
    let mut current_streak = 0u32;
    let mut longest_streak = 0u32;
    let mut streak = 1u32;

    for i in 1..dates.len() {
        if dates[i] - dates[i - 1] == chrono::Duration::days(1) {
            streak += 1;
        } else {
            longest_streak = longest_streak.max(streak);
            streak = 1;
        }
    }
    longest_streak = longest_streak.max(streak);

    // Current streak: count backwards from today
    if dates.last().map_or(false, |&d| d == today || d == today - chrono::Duration::days(1)) {
        current_streak = 1;
        let mut check = *dates.last().unwrap();
        for date in dates.iter().rev().skip(1) {
            if check - *date == chrono::Duration::days(1) {
                current_streak += 1;
                check = *date;
            } else {
                break;
            }
        }
    }

    (current_streak, longest_streak)
}

fn build_stats(days: &[StreakDay]) -> StreakStats {
    let today = today_str();
    let today_entry = days.iter().find(|d| d.date == today);
    let (current_streak, longest_streak) = compute_streaks(days);

    // Return last 90 days of history
    let mut history: Vec<StreakDay> = days.iter().rev().take(90).cloned().collect();
    history.reverse();

    StreakStats {
        current_streak,
        longest_streak,
        total_active_days: days.len() as u32,
        today_active_minutes: today_entry.map_or(0, |d| d.active_minutes),
        today_messages: today_entry.map_or(0, |d| d.messages_sent),
        is_active_today: today_entry.is_some(),
        history,
    }
}

#[tauri::command]
pub fn streak_get_stats(
    manager: tauri::State<'_, StreakTrackerManager>,
) -> Result<StreakStats, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(build_stats(&state.days))
}

#[tauri::command]
pub fn streak_record_activity(
    manager: tauri::State<'_, StreakTrackerManager>,
    minutes: Option<u32>,
    messages: Option<u32>,
) -> Result<StreakStats, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    let day = get_or_create_today(&mut state.days);
    day.active_minutes += minutes.unwrap_or(1);
    day.messages_sent += messages.unwrap_or(0);
    Ok(build_stats(&state.days))
}

#[tauri::command]
pub fn streak_check_in(
    manager: tauri::State<'_, StreakTrackerManager>,
) -> Result<StreakStats, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    get_or_create_today(&mut state.days);
    Ok(build_stats(&state.days))
}

#[tauri::command]
pub fn streak_get_history(
    manager: tauri::State<'_, StreakTrackerManager>,
    days_back: Option<u32>,
) -> Result<Vec<StreakDay>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    let limit = days_back.unwrap_or(30) as usize;
    let mut history: Vec<StreakDay> = state.days.iter().rev().take(limit).cloned().collect();
    history.reverse();
    Ok(history)
}

#[tauri::command]
pub fn streak_reset(
    manager: tauri::State<'_, StreakTrackerManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.days.clear();
    Ok(())
}
