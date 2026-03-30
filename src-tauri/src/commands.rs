use tauri_plugin_notification::NotificationExt;
use serde::Serialize;
use cpal::traits::{DeviceTrait, HostTrait};

/// Audio device information for cross-platform enumeration
#[derive(Serialize)]
pub struct AudioDevice {
    /// Unique device identifier
    pub device_id: String,
    /// Human-readable device name
    pub name: String,
    /// Device type: "input" or "output"
    pub device_type: String,
    /// Whether this is the default device
    pub is_default: bool,
    /// Number of input channels (0 for output devices)
    pub input_channels: u32,
    /// Number of output channels (0 for input devices)
    pub output_channels: u32,
}

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set the dock/taskbar badge count (unread messages)
#[tauri::command]
pub async fn set_badge_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if count > 0 {
                window.set_badge_count(Some(count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Enumerate all available audio input and output devices
#[tauri::command]
pub async fn enumerate_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    // Get default devices for comparison
    let default_input = host.default_input_device();
    let default_output = host.default_output_device();

    // Enumerate input devices
    match host.input_devices() {
        Ok(input_devices) => {
            for device in input_devices {
                match device.name() {
                    Ok(name) => {
                        let device_id = format!("input_{}", name.replace(" ", "_").to_lowercase());
                        let is_default = default_input.as_ref()
                            .and_then(|d| d.name().ok())
                            .map(|default_name| default_name == name)
                            .unwrap_or(false);

                        // Get supported input configurations
                        let input_channels = device.default_input_config()
                            .map(|config| config.channels() as u32)
                            .unwrap_or(0);

                        devices.push(AudioDevice {
                            device_id,
                            name,
                            device_type: "input".to_string(),
                            is_default,
                            input_channels,
                            output_channels: 0,
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to get input device name: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to enumerate input devices: {}", e);
        }
    }

    // Enumerate output devices
    match host.output_devices() {
        Ok(output_devices) => {
            for device in output_devices {
                match device.name() {
                    Ok(name) => {
                        let device_id = format!("output_{}", name.replace(" ", "_").to_lowercase());
                        let is_default = default_output.as_ref()
                            .and_then(|d| d.name().ok())
                            .map(|default_name| default_name == name)
                            .unwrap_or(false);

                        // Get supported output configurations
                        let output_channels = device.default_output_config()
                            .map(|config| config.channels() as u32)
                            .unwrap_or(0);

                        devices.push(AudioDevice {
                            device_id,
                            name,
                            device_type: "output".to_string(),
                            is_default,
                            input_channels: 0,
                            output_channels,
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to get output device name: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to enumerate output devices: {}", e);
        }
    }

    Ok(devices)
}
