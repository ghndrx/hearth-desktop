use tauri::command;
use std::process::Command;

/// Audio device information
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub device_type: AudioDeviceType,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub enum AudioDeviceType {
    Input,
    Output,
}

/// Get list of available audio input devices (microphones)
#[tauri::command]
pub fn get_audio_input_devices() -> Result<Vec<AudioDevice>, String> {
    #[cfg(target_os = "macos")]
    {
        // Use SwitchAudioSource or coreaudio directly
        let output = Command::new("SwitchAudioSource")
            .args(&["-a", "-t", "input"])
            .output()
            .map_err(|e| format!("Failed to get input devices: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let current_output = Command::new("SwitchAudioSource")
            .args(&["-c", "-t", "input"])
            .output()
            .map_err(|e| format!("Failed to get current input: {}", e))?;
        
        let current = String::from_utf8_lossy(&current_output.stdout).trim().to_string();
        
        let devices: Vec<AudioDevice> = stdout
            .lines()
            .filter(|line| !line.is_empty())
            .enumerate()
            .map(|(idx, name)| AudioDevice {
                id: format!("input_{}", idx),
                name: name.trim().to_string(),
                is_default: name.trim() == current,
                device_type: AudioDeviceType::Input,
            })
            .collect();
        
        Ok(devices)
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, we'd use WASAPI or Core Audio APIs
        // For now, return a placeholder
        Ok(vec![
            AudioDevice {
                id: "default".to_string(),
                name: "Default Microphone".to_string(),
                is_default: true,
                device_type: AudioDeviceType::Input,
            },
        ])
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use pactl or amixer
        let output = Command::new("pactl")
            .args(&["list", "sources", "short"])
            .output()
            .map_err(|e| format!("Failed to get input devices: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut devices = vec![];
        
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts.get(1).unwrap_or(&"Unknown").to_string();
                let id = parts.get(0).unwrap_or(&"0").to_string();
                let is_default = line.contains("RUNNING") || line.contains("Default");
                
                devices.push(AudioDevice {
                    id,
                    name,
                    is_default,
                    device_type: AudioDeviceType::Input,
                });
            }
        }
        
        if devices.is_empty() {
            devices.push(AudioDevice {
                id: "default".to_string(),
                name: "Default Microphone".to_string(),
                is_default: true,
                device_type: AudioDeviceType::Input,
            });
        }
        
        Ok(devices)
    }
}

/// Get list of available audio output devices (speakers/headphones)
#[tauri::command]
pub fn get_audio_output_devices() -> Result<Vec<AudioDevice>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("SwitchAudioSource")
            .args(&["-a", "-t", "output"])
            .output()
            .map_err(|e| format!("Failed to get output devices: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let current_output = Command::new("SwitchAudioSource")
            .args(&["-c", "-t", "output"])
            .output()
            .map_err(|e| format!("Failed to get current output: {}", e))?;
        
        let current = String::from_utf8_lossy(&current_output.stdout).trim().to_string();
        
        let devices: Vec<AudioDevice> = stdout
            .lines()
            .filter(|line| !line.is_empty())
            .enumerate()
            .map(|(idx, name)| AudioDevice {
                id: format!("output_{}", idx),
                name: name.trim().to_string(),
                is_default: name.trim() == current,
                device_type: AudioDeviceType::Output,
            })
            .collect();
        
        Ok(devices)
    }
    
    #[cfg(target_os = "windows")]
    {
        Ok(vec![
            AudioDevice {
                id: "default".to_string(),
                name: "Default Speakers".to_string(),
                is_default: true,
                device_type: AudioDeviceType::Output,
            },
        ])
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("pactl")
            .args(&["list", "sinks", "short"])
            .output()
            .map_err(|e| format!("Failed to get output devices: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut devices = vec![];
        
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts.get(1).unwrap_or(&"Unknown").to_string();
                let id = parts.get(0).unwrap_or(&"0").to_string();
                let is_default = line.contains("RUNNING") || parts.get(3) == Some(&"DEFAULT");
                
                devices.push(AudioDevice {
                    id,
                    name,
                    is_default,
                    device_type: AudioDeviceType::Output,
                });
            }
        }
        
        if devices.is_empty() {
            devices.push(AudioDevice {
                id: "default".to_string(),
                name: "Default Speakers".to_string(),
                is_default: true,
                device_type: AudioDeviceType::Output,
            });
        }
        
        Ok(devices)
    }
}

/// Set the default audio input device
#[tauri::command]
pub fn set_audio_input_device(device_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Extract device name from id
        let device_name = device_id.strip_prefix("input_")
            .ok_or("Invalid device ID")?;
        
        let output = Command::new("SwitchAudioSource")
            .args(&["-t", "input", "-s", device_name])
            .output()
            .map_err(|e| format!("Failed to set input device: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to set input device".to_string());
        }
        
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // Placeholder for other platforms
        Ok(())
    }
}

/// Set the default audio output device
#[tauri::command]
pub fn set_audio_output_device(device_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let device_name = device_id.strip_prefix("output_")
            .ok_or("Invalid device ID")?;
        
        let output = Command::new("SwitchAudioSource")
            .args(&["-t", "output", "-s", device_name])
            .output()
            .map_err(|e| format!("Failed to set output device: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to set output device".to_string());
        }
        
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

/// Get current input volume (0-100)
#[tauri::command]
pub fn get_input_volume() -> Result<u8, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", "input volume of (get volume settings)"])
            .output()
            .map_err(|e| format!("Failed to get input volume: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .trim()
            .parse::<u8>()
            .map_err(|e| format!("Failed to parse volume: {}", e))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(50) // Default
    }
}

/// Set input volume (0-100)
#[tauri::command]
pub fn set_input_volume(volume: u8) -> Result<(), String> {
    let volume = volume.min(100);
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", &format!("set volume input volume {}", volume)])
            .output()
            .map_err(|e| format!("Failed to set input volume: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to set input volume".to_string());
        }
        
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

/// Get current output volume (0-100)
#[tauri::command]
pub fn get_output_volume() -> Result<u8, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", "output volume of (get volume settings)"])
            .output()
            .map_err(|e| format!("Failed to get output volume: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .trim()
            .parse::<u8>()
            .map_err(|e| format!("Failed to parse volume: {}", e))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(50) // Default
    }
}

/// Set output volume (0-100)
#[tauri::command]
pub fn set_output_volume(volume: u8) -> Result<(), String> {
    let volume = volume.min(100);
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", &format!("set volume output volume {}", volume)])
            .output()
            .map_err(|e| format!("Failed to set output volume: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to set output volume".to_string());
        }
        
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

/// Check if output is muted
#[tauri::command]
pub fn is_output_muted() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", "output muted of (get volume settings)"])
            .output()
            .map_err(|e| format!("Failed to get mute status: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim() == "true")
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

/// Toggle output mute state
#[tauri::command]
pub fn toggle_output_mute() -> Result<bool, String> {
    let currently_muted = is_output_muted()?;
    let new_state = !currently_muted;
    
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(&["-e", &format!("set volume with output muted {}", new_state)])
            .output()
            .map_err(|e| format!("Failed to toggle mute: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to toggle mute".to_string());
        }
    }
    
    Ok(new_state)
}
