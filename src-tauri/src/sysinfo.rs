//! System information module for native system details
//!
//! Provides Tauri commands to fetch OS, CPU, memory, and runtime information.

use serde::{Deserialize, Serialize};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};
use tauri::command;

/// CPU information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    /// CPU brand/name
    pub name: String,
    /// Number of physical cores
    pub physical_cores: usize,
    /// Number of logical cores (threads)
    pub logical_cores: usize,
    /// CPU frequency in MHz
    pub frequency_mhz: u64,
    /// Current CPU usage percentage
    pub usage_percent: f32,
}

/// Memory information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    /// Total physical memory in bytes
    pub total_bytes: u64,
    /// Used memory in bytes
    pub used_bytes: u64,
    /// Available memory in bytes
    pub available_bytes: u64,
    /// Memory usage percentage
    pub usage_percent: f32,
    /// Total swap in bytes
    pub swap_total_bytes: u64,
    /// Used swap in bytes
    pub swap_used_bytes: u64,
}

/// Operating system information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    /// OS name (e.g., "Ubuntu", "Windows 11", "macOS")
    pub name: String,
    /// OS version
    pub version: String,
    /// Kernel version
    pub kernel_version: String,
    /// System hostname
    pub hostname: String,
    /// System architecture (e.g., "x86_64", "aarch64")
    pub arch: String,
    /// System uptime in seconds
    pub uptime_seconds: u64,
}

/// Application runtime information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    /// Tauri version
    pub tauri_version: String,
    /// App version from Cargo.toml
    pub app_version: String,
    /// Rust target triple
    pub target_triple: String,
    /// Debug or release build
    pub build_type: String,
}

/// Complete system information bundle
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: OsInfo,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub runtime: RuntimeInfo,
}

/// Get operating system information
#[command]
pub fn get_os_info() -> OsInfo {
    OsInfo {
        name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        arch: std::env::consts::ARCH.to_string(),
        uptime_seconds: System::uptime(),
    }
}

/// Get CPU information with current usage
#[command]
pub fn get_cpu_info() -> CpuInfo {
    let mut sys = System::new_with_specifics(
        RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
    );
    
    // Sleep briefly to get accurate CPU usage
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_all();
    
    let cpu_count = sys.cpus().len();
    let first_cpu = sys.cpus().first();
    
    CpuInfo {
        name: first_cpu
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string()),
        physical_cores: sys.physical_core_count().unwrap_or(cpu_count),
        logical_cores: cpu_count,
        frequency_mhz: first_cpu.map(|c| c.frequency()).unwrap_or(0),
        usage_percent: sys.global_cpu_usage(),
    }
}

/// Get memory information
#[command]
pub fn get_memory_info() -> MemoryInfo {
    let mut sys = System::new_with_specifics(
        RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
    );
    sys.refresh_memory();
    
    let total = sys.total_memory();
    let used = sys.used_memory();
    let available = sys.available_memory();
    let swap_total = sys.total_swap();
    let swap_used = sys.used_swap();
    
    MemoryInfo {
        total_bytes: total,
        used_bytes: used,
        available_bytes: available,
        usage_percent: if total > 0 {
            (used as f32 / total as f32) * 100.0
        } else {
            0.0
        },
        swap_total_bytes: swap_total,
        swap_used_bytes: swap_used,
    }
}

/// Get application runtime information
#[command]
pub fn get_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        tauri_version: tauri::VERSION.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        target_triple: env!("TARGET").to_string(),
        build_type: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
    }
}

/// Get complete system information bundle
#[command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: get_os_info(),
        cpu: get_cpu_info(),
        memory: get_memory_info(),
        runtime: get_runtime_info(),
    }
}

/// Format bytes into human-readable string
pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format uptime into human-readable string
pub fn format_uptime(seconds: u64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;

    if days > 0 {
        format!("{}d {}h {}m", days, hours, minutes)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1536), "1.50 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }

    #[test]
    fn test_format_uptime() {
        assert_eq!(format_uptime(59), "0m");
        assert_eq!(format_uptime(60), "1m");
        assert_eq!(format_uptime(3660), "1h 1m");
        assert_eq!(format_uptime(90061), "1d 1h 1m");
    }

    #[test]
    fn test_get_os_info() {
        let info = get_os_info();
        assert!(!info.name.is_empty() || info.name == "Unknown");
        assert!(!info.arch.is_empty());
    }

    #[test]
    fn test_get_memory_info() {
        let info = get_memory_info();
        assert!(info.total_bytes > 0);
        assert!(info.usage_percent >= 0.0 && info.usage_percent <= 100.0);
    }

    #[test]
    fn test_get_runtime_info() {
        let info = get_runtime_info();
        assert!(!info.tauri_version.is_empty());
        assert!(!info.app_version.is_empty());
    }
}
