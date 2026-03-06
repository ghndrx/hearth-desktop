use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

/// Screenshot capture result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub data: String,
    pub width: u32,
    pub height: u32,
}

/// Capture fullscreen screenshot
#[tauri::command]
pub async fn capture_fullscreen_screenshot() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, use screencapture utility
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        let output = std::process::Command::new("screencapture")
            .args(["-x", temp_path.to_string_lossy().as_ref()])
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("screencapture failed".to_string());
        }
        
        let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_path);
        
        let base64 = STANDARD.encode(&data);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, use win32 API or PowerShell
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        let script = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$bitmap.Save("{}")"#,
            temp_path.to_string_lossy()
        );
        
        let output = std::process::Command::new("powershell")
            .args(["-Command", &script])
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("PowerShell screenshot failed".to_string());
        }
        
        let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_path);
        
        let base64 = STANDARD.encode(&data);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, use gnome-screenshot, scrot, or import (ImageMagick)
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        // Try gnome-screenshot first, then scrot, then import
        let temp_path_str = temp_path.to_string_lossy().to_string();
        let tools = [
            vec!["gnome-screenshot", "-f", temp_path_str.as_str()],
            vec!["scrot", temp_path_str.as_str()],
            vec!["import", "-window", "root", temp_path_str.as_str()],
        ];
        
        let mut success = false;
        for tool in &tools {
            if let Ok(output) = std::process::Command::new(tool[0])
                .args(&tool[1..])
                .output()
            {
                if output.status.success() {
                    success = true;
                    break;
                }
            }
        }
        
        if !success {
            return Err("No screenshot tool available".to_string());
        }
        
        let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_path);
        
        let base64 = STANDARD.encode(&data);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    #[allow(unreachable_code)]
    Err("Screenshot not supported on this platform".to_string())
}

/// Capture window screenshot
#[tauri::command]
pub async fn capture_window_screenshot() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        // -w flag captures the focused window
        let output = std::process::Command::new("screencapture")
            .args(["-x", "-w", temp_path.to_string_lossy().as_ref()])
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() {
            return Err("screencapture failed".to_string());
        }
        
        let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_path);
        
        let base64 = STANDARD.encode(&data);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    #[cfg(target_os = "linux")]
    {
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        // Try gnome-screenshot with -w flag
        let output = std::process::Command::new("gnome-screenshot")
            .args(["-w", "-f", temp_path.to_string_lossy().as_ref()])
            .output();
        
        if let Ok(o) = output {
            if o.status.success() {
                let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
                let _ = std::fs::remove_file(&temp_path);
                
                let base64 = STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", base64));
            }
        }
        
        return Err("Window screenshot not available".to_string());
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows - capture active window
        return capture_fullscreen_screenshot().await;
    }
    
    #[allow(unreachable_code)]
    Err("Window screenshot not supported on this platform".to_string())
}

/// Capture region screenshot (interactive selection)
#[tauri::command]
pub async fn capture_region_screenshot() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        // -s flag for selection mode
        let output = std::process::Command::new("screencapture")
            .args(["-x", "-s", temp_path.to_string_lossy().as_ref()])
            .output()
            .map_err(|e| e.to_string())?;
        
        if !output.status.success() || !temp_path.exists() {
            return Err("Selection cancelled or failed".to_string());
        }
        
        let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&temp_path);
        
        let base64 = STANDARD.encode(&data);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    #[cfg(target_os = "linux")]
    {
        let temp_path = std::env::temp_dir().join(format!(
            "screenshot_{}.png",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        
        // Try gnome-screenshot with -a (area) flag
        let output = std::process::Command::new("gnome-screenshot")
            .args(["-a", "-f", temp_path.to_string_lossy().as_ref()])
            .output();
        
        if let Ok(o) = output {
            if o.status.success() && temp_path.exists() {
                let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
                let _ = std::fs::remove_file(&temp_path);
                
                let base64 = STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", base64));
            }
        }
        
        // Fallback to scrot with -s
        let output = std::process::Command::new("scrot")
            .args(["-s", temp_path.to_string_lossy().as_ref()])
            .output();
        
        if let Ok(o) = output {
            if o.status.success() && temp_path.exists() {
                let data = std::fs::read(&temp_path).map_err(|e| e.to_string())?;
                let _ = std::fs::remove_file(&temp_path);
                
                let base64 = STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", base64));
            }
        }
        
        return Err("Region selection not available".to_string());
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows - use Snipping Tool or similar
        // For now, fallback to fullscreen
        return capture_fullscreen_screenshot().await;
    }
    
    #[allow(unreachable_code)]
    Err("Region screenshot not supported on this platform".to_string())
}

/// Save screenshot to file
#[tauri::command]
pub async fn save_screenshot(data_url: String, app: AppHandle) -> Result<String, String> {
    // Parse data URL
    let base64_data = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or("Invalid data URL")?;
    
    let image_data = STANDARD.decode(base64_data).map_err(|e| e.to_string())?;
    
    // Get save path from user
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let default_name = format!("Screenshot_{}.png", timestamp);
    
    // Use native file dialog
    let save_path = if let Some(downloads_dir) = dirs::download_dir() {
        downloads_dir.join(&default_name)
    } else {
        PathBuf::from(&default_name)
    };
    
    // Could use tauri's dialog API here for a proper save dialog
    // For now, save to downloads directory
    std::fs::write(&save_path, image_data).map_err(|e| e.to_string())?;
    
    Ok(save_path.to_string_lossy().to_string())
}

/// Alias for capture_fullscreen_screenshot (referenced from main.rs)
#[tauri::command]
pub async fn capture_screenshot() -> Result<String, String> {
    capture_fullscreen_screenshot().await
}

/// Get the screenshots directory
#[tauri::command]
pub async fn get_screenshots_dir(app: AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let screenshots_dir = app_data.join("screenshots");
    if !screenshots_dir.exists() {
        std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
    }
    Ok(screenshots_dir.to_string_lossy().to_string())
}

/// List saved screenshots
#[tauri::command]
pub async fn list_screenshots(app: AppHandle) -> Result<Vec<String>, String> {
    use tauri::Manager;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let screenshots_dir = app_data.join("screenshots");
    if !screenshots_dir.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    let entries = std::fs::read_dir(&screenshots_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            files.push(path.to_string_lossy().to_string());
        }
    }
    files.sort();
    files.reverse();
    Ok(files)
}

/// Delete a screenshot
#[tauri::command]
pub async fn delete_screenshot(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete screenshot: {}", e))
}
