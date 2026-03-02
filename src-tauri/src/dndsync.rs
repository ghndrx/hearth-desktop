//! OS Do-Not-Disturb synchronization
//!
//! Detects the operating system's Do Not Disturb / Focus mode state and
//! syncs it with Hearth's internal DND system. When the OS enables DND,
//! Hearth automatically mutes notifications; when disabled, it restores.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsDndStatus {
    /// Whether the OS DND is currently active
    pub active: bool,
    /// Name of the focus mode (e.g. "Do Not Disturb", "Sleep", "Work")
    pub mode_name: Option<String>,
    /// Whether auto-sync is enabled
    pub sync_enabled: bool,
    /// Platform identifier
    pub platform: String,
    /// Whether the platform supports DND detection
    pub supported: bool,
}

/// Get the current OS DND/Focus mode status
#[tauri::command]
pub fn dndsync_get_os_status() -> OsDndStatus {
    let (active, mode_name) = detect_os_dnd();
    OsDndStatus {
        active,
        mode_name,
        sync_enabled: SYNC_RUNNING.load(Ordering::Relaxed),
        platform: get_platform_name(),
        supported: is_dnd_detection_supported(),
    }
}

/// Check if the OS DND is currently active
#[tauri::command]
pub fn dndsync_is_os_dnd_active() -> bool {
    detect_os_dnd().0
}

/// Check if DND detection is supported on this platform
#[tauri::command]
pub fn dndsync_is_supported() -> bool {
    is_dnd_detection_supported()
}

/// Start syncing OS DND state with Hearth's DND
#[tauri::command]
pub fn dndsync_start_sync(app: AppHandle, interval_secs: Option<u64>) -> Result<(), String> {
    if SYNC_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let interval = interval_secs.unwrap_or(3).max(1);
    let mut previous_active = false;

    tauri::async_runtime::spawn(async move {
        loop {
            if !SYNC_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

            let (active, mode_name) = detect_os_dnd();

            if active != previous_active {
                let status = OsDndStatus {
                    active,
                    mode_name: mode_name.clone(),
                    sync_enabled: true,
                    platform: get_platform_name(),
                    supported: true,
                };

                if active {
                    log::info!(
                        "OS DND activated: {}",
                        mode_name.as_deref().unwrap_or("Do Not Disturb")
                    );
                    let _ = app.emit("dndsync:os-dnd-activated", &status);
                } else {
                    log::info!("OS DND deactivated");
                    let _ = app.emit("dndsync:os-dnd-deactivated", &status);
                }

                let _ = app.emit("dndsync:status-changed", &status);
                previous_active = active;
            }
        }

        log::info!("DND sync monitor stopped");
    });

    Ok(())
}

/// Stop syncing OS DND state
#[tauri::command]
pub fn dndsync_stop_sync() -> Result<(), String> {
    SYNC_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

/// Check if sync is currently running
#[tauri::command]
pub fn dndsync_is_sync_running() -> bool {
    SYNC_RUNNING.load(Ordering::Relaxed)
}

fn get_platform_name() -> String {
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return "unknown".to_string();
}

fn is_dnd_detection_supported() -> bool {
    cfg!(any(
        target_os = "macos",
        target_os = "linux",
        target_os = "windows"
    ))
}

// Platform-specific DND detection

#[cfg(target_os = "macos")]
fn detect_os_dnd() -> (bool, Option<String>) {
    use std::process::Command;

    // macOS Focus mode detection via defaults
    let output = Command::new("defaults")
        .args(["-currentHost", "read", "com.apple.notificationcenterui", "doNotDisturb"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    if let Some(result) = output {
        let active = result.trim() == "1";
        if active {
            // Try to get the focus mode name
            let mode = Command::new("defaults")
                .args([
                    "-currentHost",
                    "read",
                    "com.apple.notificationcenterui",
                    "doNotDisturbName",
                ])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            return (true, mode.or_else(|| Some("Do Not Disturb".to_string())));
        }
    }

    // Alternative: check via reflection on Focus mode assertions
    let focus_output = Command::new("plutil")
        .args([
            "-extract",
            "data",
            "raw",
            "-",
        ])
        .output()
        .ok();

    // Fallback: check notification center process state
    let nc_check = Command::new("defaults")
        .args(["read", "com.apple.controlcenter", "NSStatusItem Visible FocusModes"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    (false, None)
}

#[cfg(target_os = "linux")]
fn detect_os_dnd() -> (bool, Option<String>) {
    use std::process::Command;

    // GNOME: Check via gsettings
    let gnome_dnd = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.notifications", "show-banners"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    if let Some(result) = gnome_dnd {
        let banners_enabled = result.trim() == "true";
        if !banners_enabled {
            return (true, Some("Do Not Disturb".to_string()));
        }
        return (false, None);
    }

    // KDE: Check via dbus
    let kde_dnd = Command::new("qdbus")
        .args([
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications.Inhibited",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    if let Some(result) = kde_dnd {
        let inhibited = result.trim() == "true";
        if inhibited {
            return (true, Some("Do Not Disturb".to_string()));
        }
        return (false, None);
    }

    // Dunst: Check via dunstctl
    let dunst_dnd = Command::new("dunstctl")
        .args(["is-paused"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    if let Some(result) = dunst_dnd {
        let paused = result.trim() == "true";
        if paused {
            return (true, Some("Do Not Disturb".to_string()));
        }
        return (false, None);
    }

    (false, None)
}

#[cfg(target_os = "windows")]
fn detect_os_dnd() -> (bool, Option<String>) {
    use std::process::Command;

    // Windows Focus Assist / Quiet Hours detection via registry
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            try {
                $path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings'
                $value = Get-ItemPropertyValue -Path $path -Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -ErrorAction Stop
                if ($value -eq 0) { Write-Output 'active' } else { Write-Output 'inactive' }
            } catch {
                # Try Focus Assist
                try {
                    $fa = (Get-ItemPropertyValue -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.notifications.quiethourssettings\windows.data.notifications.quiethourssettings' -Name 'Data' -ErrorAction Stop)
                    if ($fa) { Write-Output 'active' } else { Write-Output 'inactive' }
                } catch {
                    Write-Output 'inactive'
                }
            }
            "#,
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    if let Some(result) = output {
        let active = result.trim() == "active";
        if active {
            return (true, Some("Focus Assist".to_string()));
        }
    }

    (false, None)
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn detect_os_dnd() -> (bool, Option<String>) {
    (false, None)
}
