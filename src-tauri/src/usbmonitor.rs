//! USB device monitoring and detection
//!
//! Provides system-level USB device discovery and monitoring by reading
//! from platform-specific sources (/sys/bus/usb on Linux, system_profiler
//! on macOS, PowerShell on Windows). Tracks connected USB devices and
//! emits change events to the frontend.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDevice {
    pub vendor_id: String,
    pub product_id: String,
    pub vendor_name: String,
    pub product_name: String,
    pub serial_number: Option<String>,
    pub bus_number: Option<String>,
    pub device_class: String,
    pub speed: Option<String>,
}

/// Get list of connected USB devices
#[tauri::command]
pub fn usb_get_devices() -> Result<Vec<UsbDevice>, String> {
    Ok(get_usb_devices())
}

/// Get the number of connected USB devices
#[tauri::command]
pub fn usb_get_device_count() -> Result<usize, String> {
    Ok(get_usb_devices().len())
}

/// Check if the USB monitor is currently running
#[tauri::command]
pub fn usb_is_monitoring() -> bool {
    MONITOR_RUNNING.load(Ordering::Relaxed)
}

/// Start monitoring USB device changes
#[tauri::command]
pub fn usb_start_monitor(app: AppHandle, interval_secs: Option<u64>) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let interval = interval_secs.unwrap_or(5).max(2);
    let mut previous_devices: Vec<UsbDevice> = Vec::new();

    tauri::async_runtime::spawn(async move {
        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

            let current_devices = get_usb_devices();

            // Detect newly connected devices
            for device in &current_devices {
                let was_present = previous_devices
                    .iter()
                    .any(|d| d.vendor_id == device.vendor_id && d.product_id == device.product_id && d.bus_number == device.bus_number);

                if !was_present {
                    let _ = app.emit("usb:connected", device);
                }
            }

            // Detect removed devices
            for prev_device in &previous_devices {
                let still_present = current_devices
                    .iter()
                    .any(|d| d.vendor_id == prev_device.vendor_id && d.product_id == prev_device.product_id && d.bus_number == prev_device.bus_number);

                if !still_present {
                    let _ = app.emit("usb:disconnected", prev_device);
                }
            }

            let _ = app.emit("usb:devices", &current_devices);
            previous_devices = current_devices;
        }

        log::info!("USB monitor stopped");
    });

    Ok(())
}

/// Stop monitoring USB devices
#[tauri::command]
pub fn usb_stop_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

// Platform-specific USB device detection

#[cfg(target_os = "linux")]
fn get_usb_devices() -> Vec<UsbDevice> {
    use std::fs;
    use std::path::Path;

    let mut devices = Vec::new();
    let usb_devices_path = Path::new("/sys/bus/usb/devices");

    let entries = match fs::read_dir(usb_devices_path) {
        Ok(entries) => entries,
        Err(_) => return devices,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        // Only look at actual USB device directories (e.g., 1-1, 2-1.3), skip interfaces (e.g., 1-1:1.0)
        let name = entry.file_name().to_string_lossy().to_string();
        if name.contains(':') || name.starts_with("usb") {
            continue;
        }

        // Must have idVendor to be a real device
        let vendor_id_path = path.join("idVendor");
        if !vendor_id_path.exists() {
            continue;
        }

        let vendor_id = read_sysfs_file(&path, "idVendor");
        let product_id = read_sysfs_file(&path, "idProduct");

        if vendor_id.is_empty() || product_id.is_empty() {
            continue;
        }

        let vendor_name = read_sysfs_file(&path, "manufacturer");
        let product_name = read_sysfs_file(&path, "product");
        let serial_number = {
            let s = read_sysfs_file(&path, "serial");
            if s.is_empty() { None } else { Some(s) }
        };
        let bus_number = {
            let s = read_sysfs_file(&path, "busnum");
            if s.is_empty() { None } else { Some(s) }
        };
        let device_class = read_sysfs_file(&path, "bDeviceClass");
        let speed = {
            let s = read_sysfs_file(&path, "speed");
            if s.is_empty() {
                None
            } else {
                Some(format!("{} Mbps", s))
            }
        };

        devices.push(UsbDevice {
            vendor_id,
            product_id,
            vendor_name: if vendor_name.is_empty() { "Unknown".to_string() } else { vendor_name },
            product_name: if product_name.is_empty() { "Unknown USB Device".to_string() } else { product_name },
            serial_number,
            bus_number,
            device_class: classify_device(&device_class),
            speed,
        });
    }

    devices
}

#[cfg(target_os = "linux")]
fn read_sysfs_file(dir: &std::path::Path, filename: &str) -> String {
    std::fs::read_to_string(dir.join(filename))
        .unwrap_or_default()
        .trim()
        .to_string()
}

#[cfg(target_os = "macos")]
fn get_usb_devices() -> Vec<UsbDevice> {
    use std::process::Command;

    let output = Command::new("system_profiler")
        .args(["SPUSBDataType", "-json"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let mut devices = Vec::new();

    if let Some(json_str) = output {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if let Some(usb_data) = json.get("SPUSBDataType").and_then(|v| v.as_array()) {
                for entry in usb_data {
                    collect_macos_usb_devices(entry, &mut devices);
                }
            }
        }
    }

    devices
}

#[cfg(target_os = "macos")]
fn collect_macos_usb_devices(value: &serde_json::Value, devices: &mut Vec<UsbDevice>) {
    // Check if this entry is a USB device (has vendor_id)
    if let Some(vendor_id) = value.get("vendor_id").and_then(|v| v.as_str()) {
        let product_id = value
            .get("product_id")
            .and_then(|v| v.as_str())
            .unwrap_or("0000")
            .to_string();

        let product_name = value
            .get("_name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown USB Device")
            .to_string();

        let vendor_name = value
            .get("manufacturer")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();

        let serial_number = value
            .get("serial_num")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let speed = value
            .get("device_speed")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        devices.push(UsbDevice {
            vendor_id: vendor_id.to_string(),
            product_id,
            vendor_name,
            product_name,
            serial_number,
            bus_number: None,
            device_class: "USB Device".to_string(),
            speed,
        });
    }

    // Recurse into sub-items
    if let Some(items) = value.get("_items").and_then(|v| v.as_array()) {
        for item in items {
            collect_macos_usb_devices(item, devices);
        }
    }
}

#[cfg(target_os = "windows")]
fn get_usb_devices() -> Vec<UsbDevice> {
    use std::process::Command;

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"Get-PnpDevice -Class USB -Status OK -ErrorAction SilentlyContinue |
               Select-Object FriendlyName, InstanceId, Manufacturer, Status |
               ConvertTo-Json"#,
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let mut devices = Vec::new();

    if let Some(json_str) = output {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let items = match &json {
                serde_json::Value::Array(arr) => arr.clone(),
                obj @ serde_json::Value::Object(_) => vec![obj.clone()],
                _ => Vec::new(),
            };

            for item in items {
                let friendly_name = item
                    .get("FriendlyName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown USB Device")
                    .to_string();

                let manufacturer = item
                    .get("Manufacturer")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();

                let instance_id = item
                    .get("InstanceId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // Try to extract VID/PID from instance ID (e.g., USB\VID_1234&PID_5678\...)
                let (vendor_id, product_id) = parse_windows_instance_id(&instance_id);

                devices.push(UsbDevice {
                    vendor_id,
                    product_id,
                    vendor_name: manufacturer,
                    product_name: friendly_name,
                    serial_number: None,
                    bus_number: None,
                    device_class: "USB Device".to_string(),
                    speed: None,
                });
            }
        }
    }

    devices
}

#[cfg(target_os = "windows")]
fn parse_windows_instance_id(instance_id: &str) -> (String, String) {
    let upper = instance_id.to_uppercase();
    let vendor_id = upper
        .find("VID_")
        .map(|i| upper[i + 4..].chars().take(4).collect::<String>())
        .unwrap_or_else(|| "0000".to_string());
    let product_id = upper
        .find("PID_")
        .map(|i| upper[i + 4..].chars().take(4).collect::<String>())
        .unwrap_or_else(|| "0000".to_string());
    (vendor_id, product_id)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_usb_devices() -> Vec<UsbDevice> {
    Vec::new()
}

fn classify_device(device_class: &str) -> String {
    match device_class {
        "09" => "Hub".to_string(),
        "03" => "HID (Keyboard/Mouse)".to_string(),
        "08" => "Mass Storage".to_string(),
        "01" => "Audio".to_string(),
        "02" => "Communications".to_string(),
        "06" => "Imaging".to_string(),
        "07" => "Printer".to_string(),
        "0e" | "0E" => "Video".to_string(),
        "e0" | "E0" => "Wireless".to_string(),
        "ef" | "EF" => "Miscellaneous".to_string(),
        "ff" | "FF" => "Vendor Specific".to_string(),
        "00" => "Per-Interface".to_string(),
        _ => "Unknown".to_string(),
    }
}
