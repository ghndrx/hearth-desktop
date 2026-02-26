use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilitySettings {
    pub reduced_motion: bool,
    pub high_contrast: bool,
    pub font_scale: f64,
    pub screen_reader_enabled: bool,
    pub keyboard_navigation: bool,
    pub focus_indicators: bool,
    pub color_blind_mode: ColorBlindMode,
    pub captions_enabled: bool,
    pub auto_play_media: bool,
    pub animation_speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ColorBlindMode {
    None,
    Protanopia,
    Deuteranopia,
    Tritanopia,
}

impl Default for AccessibilitySettings {
    fn default() -> Self {
        Self {
            reduced_motion: false,
            high_contrast: false,
            font_scale: 1.0,
            screen_reader_enabled: false,
            keyboard_navigation: true,
            focus_indicators: true,
            color_blind_mode: ColorBlindMode::None,
            captions_enabled: false,
            auto_play_media: true,
            animation_speed: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemA11yState {
    pub reduced_motion: bool,
    pub high_contrast: bool,
    pub screen_reader_active: bool,
}

impl Default for SystemA11yState {
    fn default() -> Self {
        Self {
            reduced_motion: false,
            high_contrast: false,
            screen_reader_active: false,
        }
    }
}

fn get_settings_path(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("Failed to get app data dir");
    app_data.join("accessibility_settings.json")
}

#[tauri::command]
pub async fn get_accessibility_settings(app: AppHandle) -> Result<Option<AccessibilitySettings>, String> {
    let path = get_settings_path(&app);
    
    if !path.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read accessibility settings: {}", e))?;
    
    let settings: AccessibilitySettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse accessibility settings: {}", e))?;
    
    Ok(Some(settings))
}

#[tauri::command]
pub async fn save_accessibility_settings(app: AppHandle, settings: AccessibilitySettings) -> Result<(), String> {
    let path = get_settings_path(&app);
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize accessibility settings: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write accessibility settings: {}", e))?;
    
    // Emit event to notify all windows of settings change
    let _ = app.emit("accessibility-settings-changed", settings);
    
    Ok(())
}

#[tauri::command]
pub async fn get_system_accessibility_state(_app: AppHandle) -> Result<SystemA11yState, String> {
    let state = detect_system_accessibility();
    Ok(state)
}

/// Detect system-level accessibility settings
fn detect_system_accessibility() -> SystemA11yState {
    let mut state = SystemA11yState::default();
    
    #[cfg(target_os = "macos")]
    {
        state = detect_macos_accessibility();
    }
    
    #[cfg(target_os = "windows")]
    {
        state = detect_windows_accessibility();
    }
    
    #[cfg(target_os = "linux")]
    {
        state = detect_linux_accessibility();
    }
    
    state
}

#[cfg(target_os = "macos")]
fn detect_macos_accessibility() -> SystemA11yState {
    use std::process::Command;
    
    let mut state = SystemA11yState::default();
    
    // Check reduced motion preference
    if let Ok(output) = Command::new("defaults")
        .args(["read", "com.apple.universalaccess", "reduceMotion"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        state.reduced_motion = result.trim() == "1";
    }
    
    // Check contrast preference
    if let Ok(output) = Command::new("defaults")
        .args(["read", "com.apple.universalaccess", "increaseContrast"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        state.high_contrast = result.trim() == "1";
    }
    
    // Check if VoiceOver is running
    if let Ok(output) = Command::new("defaults")
        .args(["read", "com.apple.universalaccess", "voiceOverOnOffKey"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        state.screen_reader_active = result.trim() == "1";
    }
    
    state
}

#[cfg(target_os = "windows")]
fn detect_windows_accessibility() -> SystemA11yState {
    use std::process::Command;
    
    let mut state = SystemA11yState::default();
    
    // Query SystemParametersInfo for accessibility settings
    // Using PowerShell as a cross-compile friendly approach
    if let Ok(output) = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $settings = @{}
            try {
                Add-Type -TypeDefinition @'
                    using System.Runtime.InteropServices;
                    public class SystemParams {
                        [DllImport("user32.dll")]
                        public static extern bool SystemParametersInfo(int uAction, int uParam, ref bool lpvParam, int fuWinIni);
                        public const int SPI_GETCLIENTAREAANIMATION = 0x1042;
                        public const int SPI_GETHIGHCONTRAST = 0x0042;
                        public const int SPI_GETSCREENREADER = 0x0046;
                    }
'@
                $animationEnabled = $true
                $highContrast = $false
                $screenReader = $false
                [SystemParams]::SystemParametersInfo([SystemParams]::SPI_GETCLIENTAREAANIMATION, 0, [ref]$animationEnabled, 0) | Out-Null
                [SystemParams]::SystemParametersInfo([SystemParams]::SPI_GETSCREENREADER, 0, [ref]$screenReader, 0) | Out-Null
                $settings.reducedMotion = -not $animationEnabled
                $settings.highContrast = $highContrast
                $settings.screenReader = $screenReader
            } catch {}
            $settings | ConvertTo-Json
            "#,
        ])
        .output()
    {
        if let Ok(json) = String::from_utf8(output.stdout) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json) {
                state.reduced_motion = parsed["reducedMotion"].as_bool().unwrap_or(false);
                state.high_contrast = parsed["highContrast"].as_bool().unwrap_or(false);
                state.screen_reader_active = parsed["screenReader"].as_bool().unwrap_or(false);
            }
        }
    }
    
    state
}

#[cfg(target_os = "linux")]
fn detect_linux_accessibility() -> SystemA11yState {
    use std::process::Command;
    
    let mut state = SystemA11yState::default();
    
    // Check GNOME accessibility settings via gsettings
    if let Ok(output) = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "enable-animations"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        state.reduced_motion = result.trim() == "false";
    }
    
    // Check GTK high contrast theme
    if let Ok(output) = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        state.high_contrast = result.to_lowercase().contains("highcontrast");
    }
    
    // Check if Orca screen reader is running
    if let Ok(output) = Command::new("pgrep")
        .args(["-x", "orca"])
        .output()
    {
        state.screen_reader_active = output.status.success();
    }
    
    // Also check AT-SPI
    if let Ok(output) = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.a11y.applications", "screen-reader-enabled"])
        .output()
    {
        let result = String::from_utf8_lossy(&output.stdout);
        if result.trim() == "true" {
            state.screen_reader_active = true;
        }
    }
    
    state
}

/// Start monitoring for system accessibility changes (call from setup)
pub fn start_accessibility_monitor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_state = detect_system_accessibility();
        
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            
            let current_state = detect_system_accessibility();
            
            if current_state.reduced_motion != last_state.reduced_motion
                || current_state.high_contrast != last_state.high_contrast
                || current_state.screen_reader_active != last_state.screen_reader_active
            {
                let _ = app.emit("system-accessibility-changed", &current_state);
                last_state = current_state;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = AccessibilitySettings::default();
        assert!(!settings.reduced_motion);
        assert!(!settings.high_contrast);
        assert_eq!(settings.font_scale, 1.0);
        assert!(settings.keyboard_navigation);
        assert!(settings.focus_indicators);
        assert_eq!(settings.color_blind_mode, ColorBlindMode::None);
        assert!(settings.auto_play_media);
        assert_eq!(settings.animation_speed, 1.0);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = AccessibilitySettings {
            reduced_motion: true,
            high_contrast: true,
            font_scale: 1.5,
            screen_reader_enabled: true,
            keyboard_navigation: true,
            focus_indicators: true,
            color_blind_mode: ColorBlindMode::Protanopia,
            captions_enabled: true,
            auto_play_media: false,
            animation_speed: 0.5,
        };
        
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("\"reducedMotion\":true"));
        assert!(json.contains("\"colorBlindMode\":\"protanopia\""));
        
        let parsed: AccessibilitySettings = serde_json::from_str(&json).unwrap();
        assert!(parsed.reduced_motion);
        assert_eq!(parsed.color_blind_mode, ColorBlindMode::Protanopia);
    }

    #[test]
    fn test_system_state_default() {
        let state = SystemA11yState::default();
        assert!(!state.reduced_motion);
        assert!(!state.high_contrast);
        assert!(!state.screen_reader_active);
    }
}
