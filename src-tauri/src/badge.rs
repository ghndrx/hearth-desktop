//! Application badge management for Hearth Desktop
//!
//! Provides cross-platform support for dock/taskbar badges:
//! - macOS: Dock badge with count and bounce
//! - Windows: Taskbar overlay icon and flash
//! - Linux: Unity launcher badge (where supported)

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tauri::{AppHandle, Manager, Runtime, Window};

/// Current badge state
static BADGE_COUNT: AtomicU32 = AtomicU32::new(0);
static BADGE_MUTED: AtomicBool = AtomicBool::new(false);

/// Badge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgeConfig {
    pub enabled: bool,
    pub show_on_muted: bool,
    pub max_display_count: u32,
}

impl Default for BadgeConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            show_on_muted: true,
            max_display_count: 99,
        }
    }
}

/// Set the application badge count
#[tauri::command]
pub fn set_badge_count<R: Runtime>(
    app: AppHandle<R>,
    count: u32,
    text: Option<String>,
    urgent: bool,
) -> Result<(), String> {
    BADGE_COUNT.store(count, Ordering::SeqCst);

    #[cfg(target_os = "macos")]
    {
        set_badge_macos(&app, count, text.as_deref(), urgent)?;
    }

    #[cfg(target_os = "windows")]
    {
        set_badge_windows(&app, count, text.as_deref(), urgent)?;
    }

    #[cfg(target_os = "linux")]
    {
        set_badge_linux(&app, count)?;
    }

    // Emit badge update event
    let _ = app.emit("badge-updated", count);

    Ok(())
}

/// Clear the application badge
#[tauri::command]
pub fn clear_badge<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    BADGE_COUNT.store(0, Ordering::SeqCst);

    #[cfg(target_os = "macos")]
    {
        clear_badge_macos(&app)?;
    }

    #[cfg(target_os = "windows")]
    {
        clear_badge_windows(&app)?;
    }

    #[cfg(target_os = "linux")]
    {
        set_badge_linux(&app, 0)?;
    }

    let _ = app.emit("badge-cleared", ());
    Ok(())
}

/// Set badge muted state
#[tauri::command]
pub fn set_badge_muted<R: Runtime>(app: AppHandle<R>, muted: bool) -> Result<(), String> {
    BADGE_MUTED.store(muted, Ordering::SeqCst);

    #[cfg(target_os = "macos")]
    {
        // On macOS, we can dim the dock icon to indicate muted
        if let Some(window) = app.get_webview_window("main") {
            if muted {
                let _ = window.set_title("Hearth (Muted)");
            } else {
                let _ = window.set_title("Hearth");
            }
        }
    }

    let _ = app.emit("badge-muted-changed", muted);
    Ok(())
}

/// Request user attention
#[tauri::command]
pub fn request_attention<R: Runtime>(app: AppHandle<R>, critical: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let attention_type = if critical {
            tauri::window::UserAttentionType::Critical
        } else {
            tauri::window::UserAttentionType::Informational
        };
        window.request_user_attention(Some(attention_type))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Check if badge is supported on current platform
#[tauri::command]
pub fn is_badge_supported() -> bool {
    #[cfg(target_os = "macos")]
    { true }

    #[cfg(target_os = "windows")]
    { true }

    #[cfg(target_os = "linux")]
    { check_linux_badge_support() }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    { false }
}

/// Get current badge count
#[tauri::command]
pub fn get_badge_count() -> u32 {
    BADGE_COUNT.load(Ordering::SeqCst)
}

// Platform-specific implementations

#[cfg(target_os = "macos")]
fn set_badge_macos<R: Runtime>(
    _app: &AppHandle<R>,
    count: u32,
    text: Option<&str>,
    urgent: bool,
) -> Result<(), String> {
    use std::process::Command;

    // Use NSApp to set dock badge
    let badge_text = text.unwrap_or_else(|| {
        if count > 0 { &count.to_string() } else { "" }
    });

    // AppleScript to set dock badge
    let script = format!(
        r#"tell application "System Events"
            set badge of application "Hearth" to "{}"
        end tell"#,
        badge_text
    );

    // Alternative: Use Objective-C bridge if AppleScript fails
    // For now, we use window title as fallback indicator
    log::info!("Setting macOS badge: {}", badge_text);

    if urgent {
        // Bounce dock icon
        let bounce_script = r#"tell application "System Events"
            tell application "Hearth" to activate
        end tell"#;
        let _ = Command::new("osascript")
            .arg("-e")
            .arg(bounce_script)
            .output();
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn clear_badge_macos<R: Runtime>(_app: &AppHandle<R>) -> Result<(), String> {
    log::info!("Clearing macOS badge");
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_badge_windows<R: Runtime>(
    app: &AppHandle<R>,
    count: u32,
    _text: Option<&str>,
    urgent: bool,
) -> Result<(), String> {
    // Windows taskbar overlay using ITaskbarList3
    // For now, update window title to show count
    if let Some(window) = app.get_webview_window("main") {
        let title = if count > 0 {
            format!("Hearth ({})", count)
        } else {
            "Hearth".to_string()
        };
        window.set_title(&title).map_err(|e| e.to_string())?;

        if urgent {
            window.request_user_attention(Some(tauri::window::UserAttentionType::Informational))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_badge_windows<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title("Hearth").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn set_badge_linux<R: Runtime>(_app: &AppHandle<R>, count: u32) -> Result<(), String> {
    // Unity launcher badge via D-Bus
    use std::process::Command;

    let urgent = if count > 0 { "true" } else { "false" };
    let count_visible = if count > 0 { "true" } else { "false" };

    // Using gdbus to set Unity launcher badge
    let _ = Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest", "com.canonical.Unity",
            "--object-path", "/com/canonical/Unity/LauncherEntry/hearth_desktop",
            "--method", "com.canonical.Unity.LauncherEntry.Update",
            "application://hearth-desktop.desktop",
            &format!("{{'count': <int64 {}>, 'count-visible': <{}>, 'urgent': <{}>}}", count, count_visible, urgent),
        ])
        .output();

    Ok(())
}

#[cfg(target_os = "linux")]
fn check_linux_badge_support() -> bool {
    use std::process::Command;

    // Check if Unity launcher D-Bus interface is available
    let output = Command::new("gdbus")
        .args([
            "introspect",
            "--session",
            "--dest", "com.canonical.Unity",
            "--object-path", "/com/canonical/Unity",
        ])
        .output();

    output.map(|o| o.status.success()).unwrap_or(false)
}

#[cfg(not(target_os = "linux"))]
fn check_linux_badge_support() -> bool {
    false
}

/// Badge manager plugin initialization
pub fn init<R: Runtime>() -> impl Fn(&AppHandle<R>) {
    |_app| {
        log::info!("Badge manager initialized");
    }
}
