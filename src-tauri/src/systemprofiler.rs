use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub name: String,
    pub vendor: String,
    pub brand: String,
    pub frequency_mhz: u64,
    pub core_count: usize,
    pub usage_percent: f32,
    pub per_core_usage: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    pub name: String,
    pub kernel_version: String,
    pub os_version: String,
    pub hostname: String,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProfile {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub os: OsInfo,
    pub timestamp: u64,
}

pub struct SystemProfilerManager {
    sys: Mutex<System>,
}

impl Default for SystemProfilerManager {
    fn default() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        Self {
            sys: Mutex::new(sys),
        }
    }
}

fn now_epoch() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[tauri::command]
pub fn systemprofiler_poll(
    manager: tauri::State<'_, SystemProfilerManager>,
) -> Result<SystemProfile, String> {
    let mut sys = manager.sys.lock().map_err(|e| e.to_string())?;
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpus = sys.cpus();
    let global_usage: f32 = if cpus.is_empty() {
        0.0
    } else {
        cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
    };

    let first_cpu = cpus.first();
    let cpu = CpuInfo {
        name: first_cpu.map(|c| c.name().to_string()).unwrap_or_default(),
        vendor: first_cpu
            .map(|c| c.vendor_id().to_string())
            .unwrap_or_default(),
        brand: first_cpu
            .map(|c| c.brand().to_string())
            .unwrap_or_default(),
        frequency_mhz: first_cpu.map(|c| c.frequency()).unwrap_or(0),
        core_count: cpus.len(),
        usage_percent: global_usage,
        per_core_usage: cpus.iter().map(|c| c.cpu_usage()).collect(),
    };

    let total = sys.total_memory();
    let used = sys.used_memory();
    let memory = MemoryInfo {
        total_bytes: total,
        used_bytes: used,
        available_bytes: sys.available_memory(),
        swap_total_bytes: sys.total_swap(),
        swap_used_bytes: sys.used_swap(),
        usage_percent: if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        },
    };

    let os = OsInfo {
        name: System::name().unwrap_or_else(|| "Unknown".into()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".into()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".into()),
        uptime_secs: System::uptime(),
    };

    Ok(SystemProfile {
        cpu,
        memory,
        os,
        timestamp: now_epoch(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_manager() {
        let _mgr = SystemProfilerManager::default();
    }
}
