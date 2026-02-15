//! Activity and presence detection for rich presence
//!
//! This module provides:
//! - Running application detection (games, media players, etc.)
//! - Idle detection based on system inactivity
//! - Cross-platform support for Windows, macOS, and Linux

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Represents a detected running application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedActivity {
    /// Name of the application
    pub name: String,
    /// Process name / executable
    pub process_name: String,
    /// Activity type (0=Playing, 1=Streaming, 2=Listening, 3=Watching)
    pub activity_type: u8,
    /// Optional window title for more context
    pub window_title: Option<String>,
    /// When the activity started (Unix timestamp in ms)
    pub started_at: u64,
}

/// System idle information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdleStatus {
    /// Seconds since last user input
    pub idle_seconds: u64,
    /// Whether the system is considered idle (> threshold)
    pub is_idle: bool,
    /// Whether the screen is locked
    pub screen_locked: bool,
}

/// Known applications to detect for rich presence
static KNOWN_APPS: &[(&str, &str, u8)] = &[
    // Games (type 0 = Playing)
    ("steam", "Steam", 0),
    ("minecraft", "Minecraft", 0),
    ("javaw", "Minecraft", 0),
    ("league of legends", "League of Legends", 0),
    ("leagueclient", "League of Legends", 0),
    ("valorant", "VALORANT", 0),
    ("csgo", "Counter-Strike", 0),
    ("cs2", "Counter-Strike 2", 0),
    ("dota2", "Dota 2", 0),
    ("overwatch", "Overwatch", 0),
    ("fortnite", "Fortnite", 0),
    ("roblox", "Roblox", 0),
    ("gta5", "GTA V", 0),
    ("gtav", "GTA V", 0),
    ("cyberpunk2077", "Cyberpunk 2077", 0),
    ("eldenring", "Elden Ring", 0),
    ("baldur", "Baldur's Gate 3", 0),
    ("bg3", "Baldur's Gate 3", 0),
    ("wow", "World of Warcraft", 0),
    ("ffxiv", "Final Fantasy XIV", 0),
    ("destiny2", "Destiny 2", 0),
    ("apex", "Apex Legends", 0),
    ("rust", "Rust", 0),
    ("terraria", "Terraria", 0),
    ("starcraft", "StarCraft", 0),
    ("diablo", "Diablo", 0),
    ("hearthstone", "Hearthstone", 0),
    ("fallout", "Fallout", 0),
    ("skyrim", "Skyrim", 0),
    ("witcher", "The Witcher", 0),

    // Music (type 2 = Listening)
    ("spotify", "Spotify", 2),
    ("music", "Apple Music", 2),
    ("itunes", "iTunes", 2),
    ("tidal", "Tidal", 2),
    ("deezer", "Deezer", 2),
    ("soundcloud", "SoundCloud", 2),
    ("amazon music", "Amazon Music", 2),
    ("vlc", "VLC", 2),
    ("foobar", "foobar2000", 2),
    ("musicbee", "MusicBee", 2),

    // Video (type 3 = Watching)
    ("netflix", "Netflix", 3),
    ("plex", "Plex", 3),
    ("mpv", "Video", 3),
    ("kodi", "Kodi", 3),
    ("obs", "OBS Studio", 1), // Streaming
    ("streamlabs", "Streamlabs", 1),

    // Development tools (type 0 = Playing/Using)
    ("code", "Visual Studio Code", 0),
    ("code - insiders", "VS Code Insiders", 0),
    ("cursor", "Cursor", 0),
    ("webstorm", "WebStorm", 0),
    ("intellij", "IntelliJ IDEA", 0),
    ("pycharm", "PyCharm", 0),
    ("rider", "Rider", 0),
    ("android studio", "Android Studio", 0),
    ("xcode", "Xcode", 0),
    ("sublime", "Sublime Text", 0),
    ("atom", "Atom", 0),
    ("vim", "Vim", 0),
    ("nvim", "Neovim", 0),
    ("emacs", "Emacs", 0),
];

/// Default idle threshold in seconds (5 minutes)
const DEFAULT_IDLE_THRESHOLD: u64 = 300;

/// Get the list of detected activities (running apps that we care about)
#[tauri::command]
pub fn get_running_activities() -> Vec<DetectedActivity> {
    let mut activities = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    #[cfg(target_os = "windows")]
    {
        activities = get_windows_activities(now);
    }

    #[cfg(target_os = "macos")]
    {
        activities = get_macos_activities(now);
    }

    #[cfg(target_os = "linux")]
    {
        activities = get_linux_activities(now);
    }

    activities
}

/// Get idle status
#[tauri::command]
pub fn get_idle_status() -> IdleStatus {
    let idle_seconds = get_system_idle_seconds();
    
    IdleStatus {
        idle_seconds,
        is_idle: idle_seconds > DEFAULT_IDLE_THRESHOLD,
        screen_locked: is_screen_locked(),
    }
}

/// Get idle status with custom threshold
#[tauri::command]
pub fn get_idle_status_with_threshold(threshold_seconds: u64) -> IdleStatus {
    let idle_seconds = get_system_idle_seconds();
    
    IdleStatus {
        idle_seconds,
        is_idle: idle_seconds > threshold_seconds,
        screen_locked: is_screen_locked(),
    }
}

// =============================================================================
// Platform-specific implementations
// =============================================================================

#[cfg(target_os = "windows")]
fn get_windows_activities(now: u64) -> Vec<DetectedActivity> {
    use std::process::Command;
    
    let mut activities = Vec::new();
    
    // Use WMIC or PowerShell to get running processes
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json"
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Ok(procs) = serde_json::from_str::<Vec<serde_json::Value>>(&text) {
                for proc in procs {
                    let process_name = proc.get("ProcessName")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_lowercase();
                    let window_title = proc.get("MainWindowTitle")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    
                    if let Some(activity) = match_known_app(&process_name, window_title, now) {
                        activities.push(activity);
                    }
                }
            }
        }
    }
    
    activities
}

#[cfg(target_os = "macos")]
fn get_macos_activities(now: u64) -> Vec<DetectedActivity> {
    use std::process::Command;
    
    let mut activities = Vec::new();
    
    // Use AppleScript to get running applications
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events"
                set appList to ""
                repeat with p in (every process whose background only is false)
                    set appList to appList & name of p & "||" & (name of front window of p) & "
"
                end repeat
                return appList
            end tell"#
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            for line in text.lines() {
                let parts: Vec<&str> = line.split("||").collect();
                if parts.is_empty() { continue; }
                
                let process_name = parts[0].to_lowercase();
                let window_title = parts.get(1).map(|s| s.to_string());
                
                if let Some(activity) = match_known_app(&process_name, window_title, now) {
                    activities.push(activity);
                }
            }
        }
    }
    
    activities
}

#[cfg(target_os = "linux")]
fn get_linux_activities(now: u64) -> Vec<DetectedActivity> {
    use std::process::Command;
    
    let mut activities = Vec::new();
    
    // Try wmctrl first, then fall back to xdotool, then ps
    let output = Command::new("wmctrl")
        .args(["-l", "-p"])
        .output();
    
    let processes: Vec<(String, Option<String>)> = if let Ok(output) = output {
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 5 {
                        let window_title = parts[4..].join(" ");
                        // Try to get process name from PID
                        if let Ok(pid) = parts[2].parse::<u32>() {
                            let cmdline = std::fs::read_to_string(format!("/proc/{}/comm", pid))
                                .unwrap_or_default()
                                .trim()
                                .to_string();
                            Some((cmdline.to_lowercase(), Some(window_title)))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        // Fall back to ps
        let ps_output = Command::new("ps")
            .args(["aux"])
            .output();
        
        if let Ok(output) = ps_output {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .skip(1)
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 11 {
                        let cmd = parts[10..].join(" ");
                        let process_name = cmd.split('/').last().unwrap_or(&cmd).to_lowercase();
                        Some((process_name, None))
                    } else {
                        None
                    }
                })
                .collect()
        } else {
            Vec::new()
        }
    };
    
    for (process_name, window_title) in processes {
        if let Some(activity) = match_known_app(&process_name, window_title, now) {
            activities.push(activity);
        }
    }
    
    activities
}

/// Match a process against known applications
fn match_known_app(process_name: &str, window_title: Option<String>, started_at: u64) -> Option<DetectedActivity> {
    let process_lower = process_name.to_lowercase();
    
    for (pattern, name, activity_type) in KNOWN_APPS {
        if process_lower.contains(pattern) {
            return Some(DetectedActivity {
                name: name.to_string(),
                process_name: process_name.to_string(),
                activity_type: *activity_type,
                window_title,
                started_at,
            });
        }
    }
    
    // Also check window title for matches
    if let Some(ref title) = window_title {
        let title_lower = title.to_lowercase();
        for (pattern, name, activity_type) in KNOWN_APPS {
            if title_lower.contains(pattern) {
                return Some(DetectedActivity {
                    name: name.to_string(),
                    process_name: process_name.to_string(),
                    activity_type: *activity_type,
                    window_title: Some(title.clone()),
                    started_at,
                });
            }
        }
    }
    
    None
}

// =============================================================================
// Idle detection
// =============================================================================

#[cfg(target_os = "windows")]
fn get_system_idle_seconds() -> u64 {
    use std::process::Command;
    
    // Use PowerShell to get idle time
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            Add-Type @'
            using System;
            using System.Runtime.InteropServices;
            public class IdleTime {
                [DllImport("user32.dll")]
                static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
                [StructLayout(LayoutKind.Sequential)]
                struct LASTINPUTINFO {
                    public uint cbSize;
                    public uint dwTime;
                }
                public static uint GetIdleTime() {
                    LASTINPUTINFO lastInput = new LASTINPUTINFO();
                    lastInput.cbSize = (uint)Marshal.SizeOf(lastInput);
                    GetLastInputInfo(ref lastInput);
                    return ((uint)Environment.TickCount - lastInput.dwTime) / 1000;
                }
            }
'@
            [IdleTime]::GetIdleTime()
            "#
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.trim().parse().unwrap_or(0);
        }
    }
    
    0
}

#[cfg(target_os = "macos")]
fn get_system_idle_seconds() -> u64 {
    use std::process::Command;
    
    let output = Command::new("ioreg")
        .args(["-c", "IOHIDSystem", "-d", "4"])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            // Parse HIDIdleTime from ioreg output (value is in nanoseconds)
            for line in text.lines() {
                if line.contains("HIDIdleTime") {
                    if let Some(value_start) = line.find('=') {
                        let value_str = line[value_start + 1..].trim();
                        if let Ok(ns) = value_str.parse::<u64>() {
                            return ns / 1_000_000_000; // Convert to seconds
                        }
                    }
                }
            }
        }
    }
    
    0
}

#[cfg(target_os = "linux")]
fn get_system_idle_seconds() -> u64 {
    use std::process::Command;
    
    // Try xprintidle first (X11)
    let output = Command::new("xprintidle").output();
    
    if let Ok(output) = output {
        if output.status.success() {
            if let Ok(text) = String::from_utf8(output.stdout) {
                if let Ok(ms) = text.trim().parse::<u64>() {
                    return ms / 1000;
                }
            }
        }
    }
    
    // Fall back to reading /proc/uptime and comparing with session activity
    // This is less accurate but works without X11
    0
}

#[cfg(target_os = "windows")]
fn is_screen_locked() -> bool {
    use std::process::Command;
    
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-Process -Name LogonUI -ErrorAction SilentlyContinue) -ne $null"
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.trim().to_lowercase() == "true";
        }
    }
    
    false
}

#[cfg(target_os = "macos")]
fn is_screen_locked() -> bool {
    use std::process::Command;
    
    let output = Command::new("python3")
        .args([
            "-c",
            "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary().get('CGSSessionScreenIsLocked', 0))"
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.trim() == "1";
        }
    }
    
    false
}

#[cfg(target_os = "linux")]
fn is_screen_locked() -> bool {
    use std::process::Command;
    
    // Check common screen lockers
    let lockers = ["gnome-screensaver", "xscreensaver", "i3lock", "swaylock"];
    
    for locker in lockers {
        let output = Command::new("pgrep")
            .args(["-x", locker])
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                return true;
            }
        }
    }
    
    // Check D-Bus for session lock status
    let output = Command::new("dbus-send")
        .args([
            "--session",
            "--dest=org.freedesktop.ScreenSaver",
            "--type=method_call",
            "--print-reply",
            "/org/freedesktop/ScreenSaver",
            "org.freedesktop.ScreenSaver.GetActive"
        ])
        .output();
    
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.contains("boolean true");
        }
    }
    
    false
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn get_system_idle_seconds() -> u64 {
    0
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn is_screen_locked() -> bool {
    false
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn get_windows_activities(_now: u64) -> Vec<DetectedActivity> {
    Vec::new()
}
