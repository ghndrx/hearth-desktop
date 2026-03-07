use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UptimeInfo {
    pub uptime_seconds: u64,
    pub boot_timestamp: u64,
    pub load_avg_1: f64,
    pub load_avg_5: f64,
    pub load_avg_15: f64,
    pub total_memory_mb: u64,
    pub used_memory_mb: u64,
    pub memory_percent: f64,
    pub cpu_count: usize,
    pub hostname: String,
    pub os_name: String,
}

pub struct UptimeMonitorManager {
    sys: Mutex<sysinfo::System>,
}

impl Default for UptimeMonitorManager {
    fn default() -> Self {
        let mut sys = sysinfo::System::new();
        sys.refresh_memory();
        Self {
            sys: Mutex::new(sys),
        }
    }
}

#[tauri::command]
pub fn uptime_get_info(
    state: tauri::State<'_, UptimeMonitorManager>,
) -> Result<UptimeInfo, String> {
    let mut sys = state.sys.lock().map_err(|e| e.to_string())?;
    sys.refresh_memory();

    let boot_time = sysinfo::System::boot_time();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let uptime_seconds = now.saturating_sub(boot_time);

    let load_avg = sysinfo::System::load_average();

    let total_mem = sys.total_memory() / (1024 * 1024);
    let used_mem = sys.used_memory() / (1024 * 1024);
    let mem_percent = if total_mem > 0 {
        (used_mem as f64 / total_mem as f64) * 100.0
    } else {
        0.0
    };

    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());
    let os_name = format!(
        "{} {}",
        sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string()),
        sysinfo::System::os_version().unwrap_or_else(|| String::new())
    );

    Ok(UptimeInfo {
        uptime_seconds,
        boot_timestamp: boot_time,
        load_avg_1: load_avg.one,
        load_avg_5: load_avg.five,
        load_avg_15: load_avg.fifteen,
        total_memory_mb: total_mem,
        used_memory_mb: used_mem,
        memory_percent: (mem_percent * 10.0).round() / 10.0,
        cpu_count: sys.cpus().len().max(1),
        hostname,
        os_name: os_name.trim().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_manager() {
        let mgr = UptimeMonitorManager::default();
        let sys = mgr.sys.lock().unwrap();
        assert!(sys.total_memory() > 0);
    }
}
