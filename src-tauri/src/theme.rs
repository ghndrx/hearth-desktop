// Native system theme detection and synchronization
// Automatically detects OS dark/light mode and emits change events

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Current system theme
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SystemTheme {
    Light,
    Dark,
}

impl Default for SystemTheme {
    fn default() -> Self {
        SystemTheme::Light
    }
}

/// Theme information payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeInfo {
    pub theme: SystemTheme,
    pub is_dark: bool,
    pub accent_color: Option<String>,
    pub high_contrast: bool,
    pub reduced_motion: bool,
    pub reduced_transparency: bool,
}

impl Default for ThemeInfo {
    fn default() -> Self {
        Self {
            theme: SystemTheme::Light,
            is_dark: false,
            accent_color: None,
            high_contrast: false,
            reduced_motion: false,
            reduced_transparency: false,
        }
    }
}

/// Get the current system theme
#[cfg(target_os = "macos")]
fn get_system_theme_internal() -> SystemTheme {
    use std::process::Command;
    
    let output = Command::new("defaults")
        .args(["read", "-g", "AppleInterfaceStyle"])
        .output();
    
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            if stdout.trim().eq_ignore_ascii_case("dark") {
                SystemTheme::Dark
            } else {
                SystemTheme::Light
            }
        }
        // If the command fails, it usually means Light mode (no AppleInterfaceStyle set)
        Err(_) => SystemTheme::Light,
    }
}

#[cfg(target_os = "windows")]
fn get_system_theme_internal() -> SystemTheme {
    use std::process::Command;
    
    // Query the registry for the AppsUseLightTheme value
    let output = Command::new("reg")
        .args([
            "query",
            "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
            "/v",
            "AppsUseLightTheme",
        ])
        .output();
    
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // If AppsUseLightTheme is 0, it's dark mode
            if stdout.contains("0x0") {
                SystemTheme::Dark
            } else {
                SystemTheme::Light
            }
        }
        Err(_) => SystemTheme::Light,
    }
}

#[cfg(target_os = "linux")]
fn get_system_theme_internal() -> SystemTheme {
    use std::process::Command;
    
    // Try GTK settings first
    let gtk_output = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output();
    
    if let Ok(o) = gtk_output {
        let stdout = String::from_utf8_lossy(&o.stdout).to_lowercase();
        if stdout.contains("dark") {
            return SystemTheme::Dark;
        } else if stdout.contains("light") {
            return SystemTheme::Light;
        }
    }
    
    // Fallback: check gtk-theme-name
    let theme_output = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output();
    
    if let Ok(o) = theme_output {
        let stdout = String::from_utf8_lossy(&o.stdout).to_lowercase();
        if stdout.contains("dark") {
            return SystemTheme::Dark;
        }
    }
    
    SystemTheme::Light
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn get_system_theme_internal() -> SystemTheme {
    SystemTheme::Light
}

/// Check if high contrast mode is enabled
#[cfg(target_os = "macos")]
fn get_high_contrast() -> bool {
    use std::process::Command;
    
    let output = Command::new("defaults")
        .args(["read", "-g", "AppleHighContrastEnabled"])
        .output();
    
    matches!(output, Ok(o) if String::from_utf8_lossy(&o.stdout).trim() == "1")
}

#[cfg(target_os = "windows")]
fn get_high_contrast() -> bool {
    use std::process::Command;
    
    let output = Command::new("reg")
        .args([
            "query",
            "HKCU\\Control Panel\\Accessibility\\HighContrast",
            "/v",
            "Flags",
        ])
        .output();
    
    // High contrast flag bit is set when enabled
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains("0x1") || stdout.contains("0x7f")
        }
        Err(_) => false,
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn get_high_contrast() -> bool {
    false
}

/// Check if reduced motion is preferred
#[cfg(target_os = "macos")]
fn get_reduced_motion() -> bool {
    use std::process::Command;
    
    let output = Command::new("defaults")
        .args(["read", "-g", "AppleReduceMotion"])
        .output();
    
    matches!(output, Ok(o) if String::from_utf8_lossy(&o.stdout).trim() == "1")
}

#[cfg(not(target_os = "macos"))]
fn get_reduced_motion() -> bool {
    false
}

/// Check if reduced transparency is preferred
#[cfg(target_os = "macos")]
fn get_reduced_transparency() -> bool {
    use std::process::Command;
    
    let output = Command::new("defaults")
        .args(["read", "-g", "AppleReduceTransparency"])
        .output();
    
    matches!(output, Ok(o) if String::from_utf8_lossy(&o.stdout).trim() == "1")
}

#[cfg(not(target_os = "macos"))]
fn get_reduced_transparency() -> bool {
    false
}

/// Get the system accent color (macOS only for now)
#[cfg(target_os = "macos")]
fn get_accent_color() -> Option<String> {
    use std::process::Command;
    
    let output = Command::new("defaults")
        .args(["read", "-g", "AppleAccentColor"])
        .output();
    
    match output {
        Ok(o) => {
            let color_code = String::from_utf8_lossy(&o.stdout).trim().to_string();
            match color_code.as_str() {
                "-1" => Some("#8c8c8c".to_string()), // Graphite
                "0" => Some("#ff5257".to_string()),  // Red
                "1" => Some("#f7821b".to_string()),  // Orange
                "2" => Some("#ffc600".to_string()),  // Yellow
                "3" => Some("#62ba46".to_string()),  // Green
                "4" => Some("#007aff".to_string()),  // Blue (default)
                "5" => Some("#a550a7".to_string()),  // Purple
                "6" => Some("#f74f9e".to_string()),  // Pink
                _ => None,
            }
        }
        Err(_) => Some("#007aff".to_string()), // Default blue
    }
}

#[cfg(not(target_os = "macos"))]
fn get_accent_color() -> Option<String> {
    None
}

/// Get complete theme information
fn get_theme_info_internal() -> ThemeInfo {
    let theme = get_system_theme_internal();
    ThemeInfo {
        theme,
        is_dark: theme == SystemTheme::Dark,
        accent_color: get_accent_color(),
        high_contrast: get_high_contrast(),
        reduced_motion: get_reduced_motion(),
        reduced_transparency: get_reduced_transparency(),
    }
}

/// Get the current system theme
#[tauri::command]
pub fn get_system_theme() -> SystemTheme {
    get_system_theme_internal()
}

/// Get complete theme information including accessibility preferences
#[tauri::command]
pub fn get_theme_info() -> ThemeInfo {
    get_theme_info_internal()
}

/// Check if the system is in dark mode
#[tauri::command]
pub fn is_dark_mode() -> bool {
    get_system_theme_internal() == SystemTheme::Dark
}

/// Start watching for system theme changes
/// Polls the system theme periodically and emits events when it changes
pub fn start_theme_watcher(app_handle: AppHandle) {
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = Arc::clone(&running);
    
    std::thread::spawn(move || {
        let mut last_info = get_theme_info_internal();
        
        // Emit initial theme
        let _ = app_handle.emit("system-theme-changed", &last_info);
        
        while running_clone.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_secs(2));
            
            let current_info = get_theme_info_internal();
            
            // Check if anything changed
            if current_info.is_dark != last_info.is_dark
                || current_info.high_contrast != last_info.high_contrast
                || current_info.reduced_motion != last_info.reduced_motion
                || current_info.reduced_transparency != last_info.reduced_transparency
                || current_info.accent_color != last_info.accent_color
            {
                // Emit the change event
                let _ = app_handle.emit("system-theme-changed", &current_info);
                last_info = current_info;
            }
        }
    });
}
