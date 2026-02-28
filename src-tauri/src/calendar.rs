use serde::{Deserialize, Serialize};
use tauri::AppHandle;

/// Represents a calendar event from the system calendar
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub title: String,
    pub start_time: u64,
    pub end_time: u64,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub calendar_name: Option<String>,
}

/// Check if the user is currently in a meeting based on system calendar
#[tauri::command]
pub fn calendar_check_in_meeting() -> Result<bool, String> {
    let events = calendar_get_current_events()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(events.iter().any(|e| !e.is_all_day && e.start_time <= now && e.end_time > now))
}

/// Get the next upcoming calendar event
#[tauri::command]
pub fn calendar_get_next_event() -> Result<Option<CalendarEvent>, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let events = calendar_get_upcoming_events(3600)?; // next hour
    Ok(events.into_iter().find(|e| !e.is_all_day && e.start_time > now))
}

/// Get events happening right now
#[tauri::command]
pub fn calendar_get_current_events() -> Result<Vec<CalendarEvent>, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let all = calendar_get_upcoming_events(0)?;
    Ok(all
        .into_iter()
        .filter(|e| e.start_time <= now && e.end_time > now)
        .collect())
}

/// Get events within the next N seconds
#[tauri::command]
pub fn calendar_get_upcoming_events(lookahead_secs: u64) -> Result<Vec<CalendarEvent>, String> {
    #[cfg(target_os = "macos")]
    {
        get_macos_events(lookahead_secs)
    }

    #[cfg(target_os = "linux")]
    {
        get_linux_events(lookahead_secs)
    }

    #[cfg(target_os = "windows")]
    {
        get_windows_events(lookahead_secs)
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Ok(vec![])
    }
}

#[cfg(target_os = "macos")]
fn get_macos_events(lookahead_secs: u64) -> Result<Vec<CalendarEvent>, String> {
    use std::process::Command;

    // Use AppleScript to query the Calendar app
    let script = format!(
        r#"
        use framework "Foundation"
        use framework "EventKit"

        set eventStore to current application's EKEventStore's alloc()'s init()
        set now to current application's NSDate's |date|()
        set endDate to now's dateByAddingTimeInterval:{}
        set calendars to eventStore's calendarsForEntityType:0
        set predicate to eventStore's predicateForEventsWithStartDate:now endDate:endDate calendars:calendars
        set events to eventStore's eventsMatchingPredicate:predicate

        set output to ""
        repeat with evt in events
            set evtTitle to (evt's title() as text)
            set evtStart to ((evt's startDate()'s timeIntervalSince1970()) as integer) as text
            set evtEnd to ((evt's endDate()'s timeIntervalSince1970()) as integer) as text
            set evtAllDay to (evt's isAllDay()) as text
            set output to output & evtTitle & tab & evtStart & tab & evtEnd & tab & evtAllDay & linefeed
        end repeat
        return output
        "#,
        lookahead_secs
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Failed to query calendar: {}", e))?;

    if !output.status.success() {
        // Calendar access may be denied - return empty
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut events = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 4 {
            events.push(CalendarEvent {
                title: parts[0].to_string(),
                start_time: parts[1].parse().unwrap_or(0),
                end_time: parts[2].parse().unwrap_or(0),
                is_all_day: parts[3] == "true",
                location: None,
                calendar_name: None,
            });
        }
    }

    Ok(events)
}

#[cfg(target_os = "linux")]
fn get_linux_events(lookahead_secs: u64) -> Result<Vec<CalendarEvent>, String> {
    use std::process::Command;

    // Try to read from GNOME Calendar / Evolution Data Server via D-Bus
    // Fallback: check for .ics files in standard locations
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let end = now + lookahead_secs;

    // Try gnome-calendar via busctl
    let output = Command::new("busctl")
        .args([
            "--user",
            "call",
            "org.gnome.evolution.dataserver.Calendar8",
            "/org/gnome/evolution/dataserver/Calendar",
            "org.gnome.evolution.dataserver.Calendar",
            "GetObjectList",
            "s",
            &format!(
                "occur-in-time-range?start={}&end={}",
                now, end
            ),
        ])
        .output();

    // If D-Bus fails, return empty (calendar integration is optional)
    if output.is_err() {
        return Ok(vec![]);
    }

    // Parse would require ICS parsing; for now return empty on Linux
    // as calendar integration is best-effort
    Ok(vec![])
}

#[cfg(target_os = "windows")]
fn get_windows_events(lookahead_secs: u64) -> Result<Vec<CalendarEvent>, String> {
    // Windows calendar integration via COM/UWP requires more setup
    // Return empty for now - smart status will use other signals
    Ok(vec![])
}
