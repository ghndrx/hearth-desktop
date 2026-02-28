//! Session lock/unlock detection for the Hearth desktop app
//!
//! Detects when the user locks or unlocks their screen/session:
//! - Auto-set status to "away" on lock
//! - Restore status on unlock
//! - Track lock duration for activity reporting
//! - Emit events for the frontend to react to

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{AppHandle, Emitter};

static SESSION_LOCKED: AtomicBool = AtomicBool::new(false);
static LOCK_TIMESTAMP: AtomicU64 = AtomicU64::new(0);
static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

/// Session lock status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLockStatus {
    /// Whether the session is currently locked
    pub is_locked: bool,
    /// Unix timestamp (ms) of when the session was locked (0 if not locked)
    pub locked_since: u64,
    /// Duration in seconds the session has been locked (0 if not locked)
    pub locked_duration_secs: u64,
}

/// Session lock change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLockEvent {
    /// Whether the session just became locked (true) or unlocked (false)
    pub locked: bool,
    /// Duration in seconds the session was locked (only set on unlock)
    pub lock_duration_secs: Option<u64>,
    /// Unix timestamp (ms)
    pub timestamp: u64,
}

/// Get current session lock status
#[tauri::command]
pub fn get_session_lock_status() -> SessionLockStatus {
    let is_locked = SESSION_LOCKED.load(Ordering::Relaxed);
    let locked_since = LOCK_TIMESTAMP.load(Ordering::Relaxed);

    let locked_duration_secs = if is_locked && locked_since > 0 {
        let now = current_timestamp_ms();
        (now.saturating_sub(locked_since)) / 1000
    } else {
        0
    };

    SessionLockStatus {
        is_locked,
        locked_since,
        locked_duration_secs,
    }
}

/// Check if the session is currently locked
#[tauri::command]
pub fn is_session_locked() -> bool {
    SESSION_LOCKED.load(Ordering::Relaxed)
}

/// Start background session lock monitoring
#[tauri::command]
pub fn start_session_lock_monitor(app: AppHandle) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    tauri::async_runtime::spawn(async move {
        let mut last_locked = false;

        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            let currently_locked = check_session_locked();
            let now = current_timestamp_ms();

            if currently_locked != last_locked {
                if currently_locked {
                    // Session just locked
                    SESSION_LOCKED.store(true, Ordering::Relaxed);
                    LOCK_TIMESTAMP.store(now, Ordering::Relaxed);

                    log::info!("Session locked detected");

                    let event = SessionLockEvent {
                        locked: true,
                        lock_duration_secs: None,
                        timestamp: now,
                    };
                    let _ = app.emit("session:lock-changed", &event);
                } else {
                    // Session just unlocked
                    let locked_since = LOCK_TIMESTAMP.load(Ordering::Relaxed);
                    let duration = if locked_since > 0 {
                        Some((now.saturating_sub(locked_since)) / 1000)
                    } else {
                        None
                    };

                    SESSION_LOCKED.store(false, Ordering::Relaxed);
                    LOCK_TIMESTAMP.store(0, Ordering::Relaxed);

                    log::info!("Session unlocked detected (locked for {:?}s)", duration);

                    let event = SessionLockEvent {
                        locked: false,
                        lock_duration_secs: duration,
                        timestamp: now,
                    };
                    let _ = app.emit("session:lock-changed", &event);
                }

                last_locked = currently_locked;
            }
        }

        log::info!("Session lock monitor stopped");
    });

    Ok(())
}

/// Stop the session lock monitor
#[tauri::command]
pub fn stop_session_lock_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// =============================================================================
// Platform-specific session lock detection
// =============================================================================

#[cfg(target_os = "linux")]
fn check_session_locked() -> bool {
    use std::process::Command;

    // Try loginctl (systemd)
    let output = Command::new("loginctl")
        .args(["show-session", "auto", "--property=LockedHint"])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("LockedHint=yes") {
            return true;
        }
    }

    // Fallback: try DBus screensaver interface
    let output = Command::new("dbus-send")
        .args([
            "--session",
            "--dest=org.freedesktop.ScreenSaver",
            "--type=method_call",
            "--print-reply",
            "/org/freedesktop/ScreenSaver",
            "org.freedesktop.ScreenSaver.GetActive",
        ])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("boolean true") {
            return true;
        }
    }

    // Fallback: GNOME screensaver
    let output = Command::new("dbus-send")
        .args([
            "--session",
            "--dest=org.gnome.ScreenSaver",
            "--type=method_call",
            "--print-reply",
            "/org/gnome/ScreenSaver",
            "org.gnome.ScreenSaver.GetActive",
        ])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("boolean true") {
            return true;
        }
    }

    false
}

#[cfg(target_os = "macos")]
fn check_session_locked() -> bool {
    use std::process::Command;

    // Check if screen is locked via CGSession
    let output = Command::new("python3")
        .args([
            "-c",
            "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary().get('CGSSessionScreenIsLocked', 0))",
        ])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if text == "1" {
            return true;
        }
    }

    // Fallback: check for loginwindow
    let output = Command::new("defaults")
        .args(["read", "/Library/Preferences/com.apple.loginwindow"])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("showInputMenu") {
            // This is a heuristic; loginwindow being active may indicate lock screen
        }
    }

    false
}

#[cfg(target_os = "windows")]
fn check_session_locked() -> bool {
    use std::process::Command;

    // Check if the lock screen process is active
    let output = Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq LogonUI.exe", "/NH"])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        if text.contains("LogonUI.exe") {
            return true;
        }
    }

    false
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn check_session_locked() -> bool {
    false
}
