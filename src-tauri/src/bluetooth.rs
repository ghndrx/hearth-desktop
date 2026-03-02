//! Bluetooth device detection and management
//!
//! Provides system-level Bluetooth device discovery and status monitoring.
//! Uses platform-specific APIs to list paired/connected devices and emit
//! connection change events to the frontend.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothDevice {
    pub name: String,
    pub address: String,
    pub device_type: String,
    pub connected: bool,
    pub paired: bool,
    pub battery_level: Option<u8>,
    pub signal_strength: Option<i8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothStatus {
    pub available: bool,
    pub enabled: bool,
    pub discovering: bool,
    pub devices: Vec<BluetoothDevice>,
}

/// Get current Bluetooth status and paired devices
#[tauri::command]
pub fn bluetooth_get_status() -> BluetoothStatus {
    get_bluetooth_info()
}

/// Get list of paired Bluetooth devices
#[tauri::command]
pub fn bluetooth_get_devices() -> Vec<BluetoothDevice> {
    get_bluetooth_info().devices
}

/// Get connected audio devices (headphones, speakers)
#[tauri::command]
pub fn bluetooth_get_audio_devices() -> Vec<BluetoothDevice> {
    get_bluetooth_info()
        .devices
        .into_iter()
        .filter(|d| {
            let t = d.device_type.to_lowercase();
            t.contains("audio") || t.contains("headset") || t.contains("headphone") || t.contains("speaker")
        })
        .collect()
}

/// Check if Bluetooth is available on this system
#[tauri::command]
pub fn bluetooth_is_available() -> bool {
    get_bluetooth_info().available
}

/// Start monitoring Bluetooth device changes
#[tauri::command]
pub fn bluetooth_start_monitor(app: AppHandle, interval_secs: Option<u64>) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let interval = interval_secs.unwrap_or(5).max(2);
    let mut previous_devices: Vec<BluetoothDevice> = Vec::new();

    tauri::async_runtime::spawn(async move {
        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

            let status = get_bluetooth_info();
            let current_devices = status.devices.clone();

            // Detect connection changes
            for device in &current_devices {
                let prev = previous_devices
                    .iter()
                    .find(|d| d.address == device.address);

                match prev {
                    Some(p) if p.connected != device.connected => {
                        let event = if device.connected {
                            "bluetooth:connected"
                        } else {
                            "bluetooth:disconnected"
                        };
                        let _ = app.emit(event, device);
                    }
                    None if device.connected => {
                        let _ = app.emit("bluetooth:connected", device);
                    }
                    _ => {}
                }
            }

            // Detect removed devices
            for prev_device in &previous_devices {
                if !current_devices
                    .iter()
                    .any(|d| d.address == prev_device.address)
                {
                    let _ = app.emit("bluetooth:removed", prev_device);
                }
            }

            let _ = app.emit("bluetooth:status", &status);
            previous_devices = current_devices;
        }

        log::info!("Bluetooth monitor stopped");
    });

    Ok(())
}

/// Stop monitoring Bluetooth devices
#[tauri::command]
pub fn bluetooth_stop_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

/// Check if the Bluetooth monitor is running
#[tauri::command]
pub fn bluetooth_is_monitoring() -> bool {
    MONITOR_RUNNING.load(Ordering::Relaxed)
}

// Platform-specific Bluetooth detection

#[cfg(target_os = "linux")]
fn get_bluetooth_info() -> BluetoothStatus {
    use std::process::Command;

    // Check if Bluetooth controller exists
    let available = Command::new("bluetoothctl")
        .args(["show"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !available {
        return BluetoothStatus {
            available: false,
            enabled: false,
            discovering: false,
            devices: Vec::new(),
        };
    }

    // Check if powered on
    let controller_output = Command::new("bluetoothctl")
        .args(["show"])
        .output()
        .ok();

    let enabled = controller_output
        .as_ref()
        .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
        .map(|s| s.contains("Powered: yes"))
        .unwrap_or(false);

    let discovering = controller_output
        .as_ref()
        .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
        .map(|s| s.contains("Discovering: yes"))
        .unwrap_or(false);

    // List paired devices
    let devices_output = Command::new("bluetoothctl")
        .args(["devices", "Paired"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default();

    let mut devices = Vec::new();

    for line in devices_output.lines() {
        // Format: "Device AA:BB:CC:DD:EE:FF Device Name"
        let parts: Vec<&str> = line.splitn(3, ' ').collect();
        if parts.len() >= 3 {
            let address = parts[1].to_string();
            let name = parts[2].to_string();

            // Check if connected
            let info_output = Command::new("bluetoothctl")
                .args(["info", &address])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .unwrap_or_default();

            let connected = info_output.contains("Connected: yes");
            let device_type = extract_device_type(&info_output);
            let battery_level = extract_battery_level(&info_output);

            devices.push(BluetoothDevice {
                name,
                address,
                device_type,
                connected,
                paired: true,
                battery_level,
                signal_strength: None,
            });
        }
    }

    BluetoothStatus {
        available,
        enabled,
        discovering,
        devices,
    }
}

#[cfg(target_os = "macos")]
fn get_bluetooth_info() -> BluetoothStatus {
    use std::process::Command;

    // Use system_profiler on macOS
    let output = Command::new("system_profiler")
        .args(["SPBluetoothDataType", "-json"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let available = output.is_some();

    let mut devices = Vec::new();

    if let Some(json_str) = output {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if let Some(bt_data) = json.get("SPBluetoothDataType").and_then(|v| v.as_array()) {
                for entry in bt_data {
                    // Parse connected devices
                    if let Some(connected_devices) = entry
                        .get("device_connected")
                        .and_then(|v| v.as_array())
                    {
                        for device_obj in connected_devices {
                            if let Some(obj) = device_obj.as_object() {
                                for (name, info) in obj {
                                    let address = info
                                        .get("device_address")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unknown")
                                        .to_string();
                                    let device_type = info
                                        .get("device_minorType")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string();

                                    devices.push(BluetoothDevice {
                                        name: name.clone(),
                                        address,
                                        device_type,
                                        connected: true,
                                        paired: true,
                                        battery_level: None,
                                        signal_strength: None,
                                    });
                                }
                            }
                        }
                    }

                    // Parse paired but not connected
                    if let Some(paired_devices) = entry
                        .get("device_not_connected")
                        .and_then(|v| v.as_array())
                    {
                        for device_obj in paired_devices {
                            if let Some(obj) = device_obj.as_object() {
                                for (name, info) in obj {
                                    let address = info
                                        .get("device_address")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unknown")
                                        .to_string();
                                    let device_type = info
                                        .get("device_minorType")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string();

                                    devices.push(BluetoothDevice {
                                        name: name.clone(),
                                        address,
                                        device_type,
                                        connected: false,
                                        paired: true,
                                        battery_level: None,
                                        signal_strength: None,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    BluetoothStatus {
        available,
        enabled: available,
        discovering: false,
        devices,
    }
}

#[cfg(target_os = "windows")]
fn get_bluetooth_info() -> BluetoothStatus {
    use std::process::Command;

    // Use PowerShell to query Bluetooth devices
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let available = output.is_some();
    let mut devices = Vec::new();

    if let Some(json_str) = output {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let items = match &json {
                serde_json::Value::Array(arr) => arr.clone(),
                obj @ serde_json::Value::Object(_) => vec![obj.clone()],
                _ => Vec::new(),
            };

            for item in items {
                let name = item
                    .get("FriendlyName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();

                // Skip the Bluetooth adapter itself
                if name.contains("Bluetooth") && name.contains("Radio") {
                    continue;
                }

                let status = item
                    .get("Status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown");

                let instance_id = item
                    .get("InstanceId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // Extract address from instance ID if possible
                let address = instance_id
                    .split('\\')
                    .last()
                    .unwrap_or("")
                    .to_string();

                devices.push(BluetoothDevice {
                    name,
                    address,
                    device_type: "Unknown".to_string(),
                    connected: status == "OK",
                    paired: true,
                    battery_level: None,
                    signal_strength: None,
                });
            }
        }
    }

    BluetoothStatus {
        available,
        enabled: available,
        discovering: false,
        devices,
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_bluetooth_info() -> BluetoothStatus {
    BluetoothStatus {
        available: false,
        enabled: false,
        discovering: false,
        devices: Vec::new(),
    }
}

#[cfg(target_os = "linux")]
fn extract_device_type(info: &str) -> String {
    for line in info.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Icon:") {
            let icon = trimmed.trim_start_matches("Icon:").trim();
            return match icon {
                "audio-headphones" => "Headphones".to_string(),
                "audio-headset" => "Headset".to_string(),
                "audio-speakers" | "audio-card" => "Speaker".to_string(),
                "input-keyboard" => "Keyboard".to_string(),
                "input-mouse" => "Mouse".to_string(),
                "input-gaming" => "Gamepad".to_string(),
                "phone" => "Phone".to_string(),
                "computer" => "Computer".to_string(),
                other => other.replace("audio-", "Audio "),
            };
        }
    }
    "Unknown".to_string()
}

#[cfg(target_os = "linux")]
fn extract_battery_level(info: &str) -> Option<u8> {
    for line in info.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Battery Percentage:") {
            let hex_str = trimmed
                .trim_start_matches("Battery Percentage:")
                .trim()
                .trim_start_matches("0x");
            return u8::from_str_radix(hex_str, 16).ok();
        }
    }
    None
}
