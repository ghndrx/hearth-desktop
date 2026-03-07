//! Native screen and window source enumeration for screen sharing
//!
//! Provides desktop-native source selection for screen sharing in voice/video calls.
//! Lists all available displays and application windows with thumbnails.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSource {
    pub id: String,
    pub name: String,
    pub source_type: SourceType,
    pub thumbnail: Option<String>, // Base64 data URL
    pub app_icon: Option<String>,  // Base64 data URL for window sources
    pub is_primary: bool,           // For displays
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Screen,
    Window,
}

/// Get list of all available screen/window sources
#[tauri::command]
pub async fn get_screen_sources() -> Result<Vec<ScreenSource>, String> {
    #[cfg(target_os = "macos")]
    {
        get_macos_sources().await
    }
    
    #[cfg(target_os = "linux")]
    {
        get_linux_sources().await
    }
    
    #[cfg(target_os = "windows")]
    {
        get_windows_sources().await
    }
}

#[cfg(target_os = "macos")]
async fn get_macos_sources() -> Result<Vec<ScreenSource>, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::process::Command;
    
    let mut sources = Vec::new();
    
    // Get displays using system_profiler
    let display_output = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
        .map_err(|e| format!("Failed to get displays: {}", e))?;
    
    if display_output.status.success() {
        // Parse display info (simplified - real implementation would parse JSON)
        // For now, just add a "Entire Screen" option
        sources.push(ScreenSource {
            id: "screen:0".to_string(),
            name: "Entire Screen".to_string(),
            source_type: SourceType::Screen,
            thumbnail: None, // TODO: capture small preview
            app_icon: None,
            is_primary: true,
        });
    }
    
    // Get windows using AppleScript
    let window_script = r#"
        tell application "System Events"
            set windowList to {}
            repeat with proc in (every process whose background only is false)
                set procName to name of proc
                set windowCount to count of (every window of proc)
                if windowCount > 0 then
                    repeat with win in (every window of proc)
                        set windowName to name of win
                        set end of windowList to {procName, windowName}
                    end repeat
                end if
            end repeat
            return windowList
        end tell
    "#;
    
    let window_output = Command::new("osascript")
        .args(["-e", window_script])
        .output()
        .map_err(|e| format!("Failed to get windows: {}", e))?;
    
    if window_output.status.success() {
        let output_str = String::from_utf8_lossy(&window_output.stdout);
        
        // Parse AppleScript output (format: "App1, Window1, App2, Window2, ...")
        let parts: Vec<&str> = output_str
            .trim()
            .split(", ")
            .collect();
        
        for chunk in parts.chunks(2) {
            if chunk.len() == 2 {
                let app_name = chunk[0].trim();
                let window_name = chunk[1].trim();
                
                sources.push(ScreenSource {
                    id: format!("window:{}:{}", app_name, window_name),
                    name: format!("{} - {}", app_name, window_name),
                    source_type: SourceType::Window,
                    thumbnail: None, // TODO: capture window preview
                    app_icon: None,  // TODO: get app icon
                    is_primary: false,
                });
            }
        }
    }
    
    Ok(sources)
}

#[cfg(target_os = "linux")]
async fn get_linux_sources() -> Result<Vec<ScreenSource>, String> {
    use std::process::Command;
    
    let mut sources = Vec::new();
    
    // Check if running under Wayland or X11
    let session_type = std::env::var("XDG_SESSION_TYPE")
        .unwrap_or_else(|_| "x11".to_string());
    
    // Add screen source
    sources.push(ScreenSource {
        id: "screen:0".to_string(),
        name: "Entire Screen".to_string(),
        source_type: SourceType::Screen,
        thumbnail: None,
        app_icon: None,
        is_primary: true,
    });
    
    // Get windows using wmctrl (X11) or wlr-randr (Wayland)
    if session_type == "x11" {
        // Try wmctrl for X11
        let window_output = Command::new("wmctrl")
            .args(["-l"])
            .output();
        
        if let Ok(output) = window_output {
            if output.status.success() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                
                for line in output_str.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let window_id = parts[0];
                        let window_title = parts[3..].join(" ");
                        
                        sources.push(ScreenSource {
                            id: format!("window:{}", window_id),
                            name: window_title,
                            source_type: SourceType::Window,
                            thumbnail: None,
                            app_icon: None,
                            is_primary: false,
                        });
                    }
                }
            }
        }
    }
    
    Ok(sources)
}

#[cfg(target_os = "windows")]
async fn get_windows_sources() -> Result<Vec<ScreenSource>, String> {
    use std::process::Command;
    
    let mut sources = Vec::new();
    
    // Add primary display
    sources.push(ScreenSource {
        id: "screen:0".to_string(),
        name: "Entire Screen".to_string(),
        source_type: SourceType::Screen,
        thumbnail: None,
        app_icon: None,
        is_primary: true,
    });
    
    // Get windows using PowerShell
    let window_script = r#"
        Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | 
        Select-Object Id, ProcessName, MainWindowTitle | 
        ConvertTo-Json
    "#;
    
    let window_output = Command::new("powershell")
        .args(["-Command", window_script])
        .output()
        .map_err(|e| format!("Failed to get windows: {}", e))?;
    
    if window_output.status.success() {
        let output_str = String::from_utf8_lossy(&window_output.stdout);
        
        // Parse JSON output
        if let Ok(windows) = serde_json::from_str::<serde_json::Value>(&output_str) {
            if let Some(array) = windows.as_array() {
                for window in array {
                    if let (Some(id), Some(name), Some(title)) = (
                        window["Id"].as_i64(),
                        window["ProcessName"].as_str(),
                        window["MainWindowTitle"].as_str(),
                    ) {
                        sources.push(ScreenSource {
                            id: format!("window:{}", id),
                            name: format!("{} - {}", name, title),
                            source_type: SourceType::Window,
                            thumbnail: None,
                            app_icon: None,
                            is_primary: false,
                        });
                    }
                }
            }
        }
    }
    
    Ok(sources)
}

/// Capture thumbnail for a specific source
#[tauri::command]
pub async fn capture_source_thumbnail(source_id: String) -> Result<String, String> {
    // TODO: Implement platform-specific thumbnail capture
    // For now, return empty data URL
    Ok("data:image/png;base64,".to_string())
}
