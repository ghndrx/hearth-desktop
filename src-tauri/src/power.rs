use tauri::{AppHandle, Manager};
use std::sync::atomic::{AtomicBool, Ordering};

static PREVENTING_SLEEP: AtomicBool = AtomicBool::new(false);

/// Prevent the system from going to sleep
/// Useful during voice calls or screen sharing
#[tauri::command]
pub fn prevent_sleep() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Use caffeinate on macOS to prevent sleep
        // Note: In a real implementation, you'd want to track the PID to kill it later
        // For now, we use a simple approach with assertion
        let output = Command::new("caffeinate")
            .args(&["-d", "-i", "-s", "-u", "-t", "1"])
            .output()
            .map_err(|e| format!("Failed to prevent sleep: {}", e))?;
        
        if !output.status.success() {
            return Err("Failed to prevent sleep: caffeinate command failed".to_string());
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Power::{SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED, ES_DISPLAY_REQUIRED};
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, we would use dbus to call systemd-logind or similar
        // For now, this is a placeholder
        use std::process::Command;
        let _ = Command::new("systemctl")
            .args(&["--user", "inhibit", "--what=handle-lid-switch:sleep:idle", "--who=Hearth", "--why=Voice call in progress", "--mode=block"])
            .spawn()
            .map_err(|e| format!("Failed to prevent sleep: {}", e))?;
    }
    
    PREVENTING_SLEEP.store(true, Ordering::Relaxed);
    Ok(())
}

/// Allow the system to sleep again
#[tauri::command]
pub fn allow_sleep() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, caffeinate with -t 1 only prevents sleep for 1 second
        // For a persistent prevent, you'd need to run caffeinate in the background
        // and kill it when allowing sleep. This is simplified for the example.
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Power::{SetThreadExecutionState, ES_CONTINUOUS};
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, the inhibition process would need to be killed
        // This is a placeholder implementation
    }
    
    PREVENTING_SLEEP.store(false, Ordering::Relaxed);
    Ok(())
}

/// Check if sleep is currently being prevented
#[tauri::command]
pub fn is_sleep_prevented() -> bool {
    PREVENTING_SLEEP.load(Ordering::Relaxed)
}

/// Get system power/battery status
#[tauri::command]
pub fn get_power_status() -> Result<PowerStatus, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("pmset")
            .args(&["-g", "batt"])
            .output()
            .map_err(|e| format!("Failed to get power status: {}", e))?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // Parse the pmset output
        // Example: "Now drawing from 'Battery Power' -InternalBattery-0 (id=xxx) 85%; discharging; 4:12 remaining present: true"
        let is_ac = output_str.contains("AC Power");
        let is_charging = output_str.contains("charging;");
        
        // Extract battery percentage
        let percentage = output_str
            .split('%')
            .next()
            .and_then(|s| s.rsplit(' ').next())
            .and_then(|s| s.parse::<i32>().ok())
            .map(|p| p as u8);
        
        // Extract time remaining
        let time_remaining = if output_str.contains("no estimate") {
            None
        } else {
            output_str
                .split("remaining")
                .next()
                .and_then(|s| s.rsplit(';').next())
                .map(|s| s.trim().to_string())
        };
        
        Ok(PowerStatus {
            is_ac_power: is_ac,
            is_charging: is_charging && !is_ac,
            battery_percentage: percentage,
            time_remaining,
            is_power_save_mode: false, // macOS doesn't expose this easily
        })
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
        
        unsafe {
            let mut status: SYSTEM_POWER_STATUS = std::mem::zeroed();
            if GetSystemPowerStatus(&mut status) == 0 {
                return Err("Failed to get power status".to_string());
            }
            
            let is_ac = status.ACLineStatus == 1;
            let is_charging = status.BatteryFlag & 8 != 0; // Charging bit
            let percentage = if status.BatteryLifePercent != 255 {
                Some(status.BatteryLifePercent)
            } else {
                None
            };
            
            let time_remaining = if status.BatteryLifeTime != 0xFFFFFFFF {
                let hours = status.BatteryLifeTime / 3600;
                let minutes = (status.BatteryLifeTime % 3600) / 60;
                Some(format!("{}:{:02}", hours, minutes))
            } else {
                None
            };
            
            Ok(PowerStatus {
                is_ac_power: is_ac,
                is_charging,
                battery_percentage: percentage,
                time_remaining,
                is_power_save_mode: false,
            })
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        
        // Read from sysfs
        let power_supply_path = "/sys/class/power_supply/";
        
        // Find battery
        let entries = fs::read_dir(power_supply_path)
            .map_err(|e| format!("Failed to read power supply: {}", e))?;
        
        let mut battery_found = false;
        let mut is_ac = false;
        let mut is_charging = false;
        let mut percentage = None;
        let mut time_remaining = None;
        
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            
            if name_str.starts_with("BAT") {
                battery_found = true;
                
                // Read status
                if let Ok(status) = fs::read_to_string(path.join("status")) {
                    let status = status.trim();
                    is_charging = status == "Charging";
                }
                
                // Read capacity
                if let Ok(capacity) = fs::read_to_string(path.join("capacity")) {
                    percentage = capacity.trim().parse::<u8>().ok();
                }
                
                // Read time to empty/full
                if let Ok(time) = fs::read_to_string(path.join("time_to_empty_now")) {
                    if let Ok(seconds) = time.trim().parse::<u64>() {
                        let hours = seconds / 3600;
                        let mins = (seconds % 3600) / 60;
                        time_remaining = Some(format!("{}:{:02}", hours, mins));
                    }
                }
            }
            
            if name_str.starts_with("AC") || name_str.starts_with("ADP") {
                if let Ok(online) = fs::read_to_string(path.join("online")) {
                    is_ac = online.trim() == "1";
                }
            }
        }
        
        if !battery_found {
            return Ok(PowerStatus {
                is_ac_power: true,
                is_charging: false,
                battery_percentage: None,
                time_remaining: None,
                is_power_save_mode: false,
            });
        }
        
        Ok(PowerStatus {
            is_ac_power: is_ac,
            is_charging,
            battery_percentage: percentage,
            time_remaining,
            is_power_save_mode: false,
        })
    }
}

/// Power status information
#[derive(serde::Serialize)]
pub struct PowerStatus {
    pub is_ac_power: bool,
    pub is_charging: bool,
    pub battery_percentage: Option<u8>,
    pub time_remaining: Option<String>,
    pub is_power_save_mode: bool,
}
