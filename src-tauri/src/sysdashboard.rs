use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuInfo {
    pub usage_percent: f64,
    pub core_count: usize,
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f64,
    pub fs_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStats {
    pub interface_name: String,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub is_up: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSnapshot {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub disks: Vec<DiskInfo>,
    pub networks: Vec<NetworkStats>,
    pub top_processes: Vec<ProcessInfo>,
    pub uptime_seconds: u64,
    pub hostname: String,
    pub os_name: String,
    pub timestamp: i64,
}

pub struct SysDashboardManager {
    history: Mutex<Vec<DashboardSnapshot>>,
}

impl Default for SysDashboardManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn read_cpu_usage() -> f64 {
    // Read /proc/stat for a quick CPU usage estimate
    if let Ok(contents) = std::fs::read_to_string("/proc/stat") {
        if let Some(line) = contents.lines().next() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let user: u64 = parts[1].parse().unwrap_or(0);
                let nice: u64 = parts[2].parse().unwrap_or(0);
                let system: u64 = parts[3].parse().unwrap_or(0);
                let idle: u64 = parts[4].parse().unwrap_or(0);
                let total = user + nice + system + idle;
                let active = user + nice + system;
                if total > 0 {
                    return (active as f64 / total as f64) * 100.0;
                }
            }
        }
    }
    0.0
}

fn read_cpu_model() -> String {
    if let Ok(contents) = std::fs::read_to_string("/proc/cpuinfo") {
        for line in contents.lines() {
            if line.starts_with("model name") {
                if let Some(val) = line.split(':').nth(1) {
                    return val.trim().to_string();
                }
            }
        }
    }
    "Unknown CPU".into()
}

fn read_core_count() -> usize {
    std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(1)
}

fn read_memory() -> MemoryInfo {
    let mut total = 0u64;
    let mut available = 0u64;
    if let Ok(contents) = std::fs::read_to_string("/proc/meminfo") {
        for line in contents.lines() {
            if line.starts_with("MemTotal:") {
                total = parse_meminfo_kb(line) * 1024;
            } else if line.starts_with("MemAvailable:") {
                available = parse_meminfo_kb(line) * 1024;
            }
        }
    }
    let used = total.saturating_sub(available);
    let usage_percent = if total > 0 {
        (used as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    MemoryInfo {
        total_bytes: total,
        used_bytes: used,
        available_bytes: available,
        usage_percent,
    }
}

fn parse_meminfo_kb(line: &str) -> u64 {
    line.split_whitespace()
        .nth(1)
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0)
}

fn read_disks() -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    if let Ok(contents) = std::fs::read_to_string("/proc/mounts") {
        for line in contents.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 3 {
                continue;
            }
            let device = parts[0];
            let mount = parts[1];
            let fs = parts[2];
            // Only real filesystems
            if !device.starts_with("/dev/") {
                continue;
            }
            // Skip snap and loop mounts
            if device.contains("loop") || mount.starts_with("/snap") {
                continue;
            }
            // Use statvfs to get disk space
            unsafe {
                let c_path = std::ffi::CString::new(mount).unwrap_or_default();
                let mut stat: libc::statvfs = std::mem::zeroed();
                if libc::statvfs(c_path.as_ptr(), &mut stat) == 0 {
                    let total = stat.f_blocks as u64 * stat.f_frsize as u64;
                    let free = stat.f_bavail as u64 * stat.f_frsize as u64;
                    let used = total.saturating_sub(free);
                    let usage = if total > 0 {
                        (used as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };
                    disks.push(DiskInfo {
                        name: device.to_string(),
                        mount_point: mount.to_string(),
                        total_bytes: total,
                        used_bytes: used,
                        free_bytes: free,
                        usage_percent: usage,
                        fs_type: fs.to_string(),
                    });
                }
            }
        }
    }
    disks
}

fn read_networks() -> Vec<NetworkStats> {
    let mut nets = Vec::new();
    if let Ok(contents) = std::fs::read_to_string("/proc/net/dev") {
        for line in contents.lines().skip(2) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 10 {
                continue;
            }
            let iface = parts[0].trim_end_matches(':');
            if iface == "lo" {
                continue;
            }
            let rx: u64 = parts[1].parse().unwrap_or(0);
            let tx: u64 = parts[9].parse().unwrap_or(0);
            nets.push(NetworkStats {
                interface_name: iface.to_string(),
                bytes_received: rx,
                bytes_sent: tx,
                is_up: rx > 0 || tx > 0,
            });
        }
    }
    nets
}

fn read_top_processes(limit: usize) -> Vec<ProcessInfo> {
    let mut procs = Vec::new();
    if let Ok(entries) = std::fs::read_dir("/proc") {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if !name_str.chars().all(|c| c.is_ascii_digit()) {
                continue;
            }
            let pid: u32 = match name_str.parse() {
                Ok(p) => p,
                Err(_) => continue,
            };
            let comm_path = format!("/proc/{}/comm", pid);
            let proc_name = std::fs::read_to_string(&comm_path)
                .unwrap_or_default()
                .trim()
                .to_string();
            if proc_name.is_empty() {
                continue;
            }
            let statm_path = format!("/proc/{}/statm", pid);
            let mem_pages: u64 = std::fs::read_to_string(&statm_path)
                .ok()
                .and_then(|s| s.split_whitespace().nth(1)?.parse().ok())
                .unwrap_or(0);
            let page_size = 4096u64;
            procs.push(ProcessInfo {
                pid,
                name: proc_name,
                cpu_percent: 0.0, // Instantaneous CPU requires two samples
                memory_bytes: mem_pages * page_size,
            });
        }
    }
    procs.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    procs.truncate(limit);
    procs
}

fn read_uptime() -> u64 {
    std::fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|s| s.split_whitespace().next()?.parse::<f64>().ok())
        .map(|v| v as u64)
        .unwrap_or(0)
}

fn read_hostname() -> String {
    std::fs::read_to_string("/etc/hostname")
        .unwrap_or_else(|_| "unknown".into())
        .trim()
        .to_string()
}

fn read_os_name() -> String {
    if let Ok(contents) = std::fs::read_to_string("/etc/os-release") {
        for line in contents.lines() {
            if line.starts_with("PRETTY_NAME=") {
                return line
                    .trim_start_matches("PRETTY_NAME=")
                    .trim_matches('"')
                    .to_string();
            }
        }
    }
    "Linux".into()
}

#[tauri::command]
pub fn sysdash_snapshot(
    manager: tauri::State<'_, SysDashboardManager>,
) -> Result<DashboardSnapshot, String> {
    let snapshot = DashboardSnapshot {
        cpu: CpuInfo {
            usage_percent: read_cpu_usage(),
            core_count: read_core_count(),
            model_name: read_cpu_model(),
        },
        memory: read_memory(),
        disks: read_disks(),
        networks: read_networks(),
        top_processes: read_top_processes(10),
        uptime_seconds: read_uptime(),
        hostname: read_hostname(),
        os_name: read_os_name(),
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    let mut history = manager.history.lock().map_err(|e| e.to_string())?;
    history.push(snapshot.clone());
    // Keep last 60 snapshots
    let len = history.len();
    if len > 60 {
        history.drain(0..len - 60);
    }

    Ok(snapshot)
}

#[tauri::command]
pub fn sysdash_get_history(
    manager: tauri::State<'_, SysDashboardManager>,
) -> Result<Vec<DashboardSnapshot>, String> {
    let history = manager.history.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}
