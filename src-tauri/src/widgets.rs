//! Widget bar backend commands
//!
//! Provides lightweight system stats and utility functions for the
//! AppWidgetsBar component - quick notes, system metrics, weather.

use serde::{Deserialize, Serialize};
use sysinfo::{Disks, System};

/// Lightweight system stats for widget display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSystemStats {
    /// CPU usage percentage (0-100)
    pub cpu_usage: f64,
    /// Memory usage percentage (0-100)
    pub memory_usage: f64,
    /// Total memory in MB
    pub memory_total: u64,
    /// Used memory in MB
    pub memory_used: u64,
    /// Disk usage percentage (0-100)
    pub disk_usage: f64,
}

/// Weather data for widget display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetWeatherData {
    /// Temperature in Fahrenheit
    pub temp: i32,
    /// Weather condition text
    pub condition: String,
    /// Weather emoji icon
    pub icon: String,
    /// Location name
    pub location: String,
}

/// Get lightweight system stats for the widget bar
#[tauri::command]
pub fn get_widget_system_stats() -> WidgetSystemStats {
    let mut sys = System::new_all();
    sys.refresh_all();

    // CPU usage (need to refresh twice for accurate reading)
    std::thread::sleep(std::time::Duration::from_millis(100));
    sys.refresh_cpu_all();
    let cpu_usage = sys.global_cpu_usage() as f64;

    // Memory
    let memory_total = sys.total_memory() / (1024 * 1024); // bytes to MB
    let memory_used = sys.used_memory() / (1024 * 1024);
    let memory_usage = if memory_total > 0 {
        (memory_used as f64 / memory_total as f64) * 100.0
    } else {
        0.0
    };

    // Disk (use first mounted disk, typically root)
    let disks = Disks::new_with_refreshed_list();
    let (disk_total, disk_available) = disks
        .iter()
        .find(|d| d.mount_point().to_string_lossy() == "/")
        .or_else(|| disks.iter().next())
        .map(|d| (d.total_space(), d.available_space()))
        .unwrap_or((0, 0));

    let disk_usage = if disk_total > 0 {
        ((disk_total - disk_available) as f64 / disk_total as f64) * 100.0
    } else {
        0.0
    };

    WidgetSystemStats {
        cpu_usage,
        memory_usage,
        memory_total,
        memory_used,
        disk_usage,
    }
}

/// Get weather data for the widget bar
/// Note: This is a placeholder - in production, integrate with a weather API
#[tauri::command]
pub fn get_widget_weather() -> WidgetWeatherData {
    // Placeholder weather data
    // In a real implementation, this would call a weather API
    WidgetWeatherData {
        temp: 72,
        condition: "Partly Cloudy".to_string(),
        icon: "⛅".to_string(),
        location: "Local".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_widget_system_stats() {
        let stats = get_widget_system_stats();
        assert!(stats.cpu_usage >= 0.0 && stats.cpu_usage <= 100.0);
        assert!(stats.memory_usage >= 0.0 && stats.memory_usage <= 100.0);
        assert!(stats.memory_total > 0);
    }

    #[test]
    fn test_get_widget_weather() {
        let weather = get_widget_weather();
        assert!(!weather.condition.is_empty());
        assert!(!weather.icon.is_empty());
    }
}
