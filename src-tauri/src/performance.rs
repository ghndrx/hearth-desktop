//! Performance monitoring for the Hearth desktop app
//!
//! This module provides native performance metrics including:
//! - Memory usage (heap, resident set size)
//! - App uptime
//! - Process CPU usage
//! - System resource snapshot

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;
use once_cell::sync::Lazy;

/// App start time for uptime calculation
static APP_START: Lazy<Instant> = Lazy::new(Instant::now);

/// Last CPU measurement time
static LAST_CPU_TIME: AtomicU64 = AtomicU64::new(0);
static LAST_MEASURE_TIME: AtomicU64 = AtomicU64::new(0);

/// Performance metrics snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Memory usage formatted (e.g., "45.2 MB")
    pub memory_formatted: String,
    /// Resident set size in bytes (actual physical memory used)
    pub rss_bytes: u64,
    /// RSS formatted
    pub rss_formatted: String,
    /// Virtual memory size in bytes
    pub virtual_bytes: u64,
    /// Virtual memory formatted
    pub virtual_formatted: String,
    /// App uptime in seconds
    pub uptime_seconds: u64,
    /// Uptime formatted (e.g., "2h 15m")
    pub uptime_formatted: String,
    /// Process CPU usage percentage (0-100, can exceed 100 on multi-core)
    pub cpu_percent: f32,
    /// Number of threads
    pub thread_count: u32,
    /// Timestamp of measurement (Unix ms)
    pub timestamp: u64,
}

/// Memory usage details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    /// Heap/allocated memory in bytes
    pub heap_bytes: u64,
    /// Resident set size
    pub rss_bytes: u64,
    /// Virtual memory
    pub virtual_bytes: u64,
    /// Peak memory usage
    pub peak_bytes: u64,
}

/// Format bytes to human-readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format seconds to human-readable duration
fn format_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}

/// Get current performance metrics
#[tauri::command]
pub fn get_performance_metrics() -> PerformanceMetrics {
    let memory = get_memory_usage();
    let uptime = APP_START.elapsed().as_secs();
    let cpu = get_cpu_usage();
    let threads = get_thread_count();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    PerformanceMetrics {
        memory_bytes: memory.heap_bytes,
        memory_formatted: format_bytes(memory.heap_bytes),
        rss_bytes: memory.rss_bytes,
        rss_formatted: format_bytes(memory.rss_bytes),
        virtual_bytes: memory.virtual_bytes,
        virtual_formatted: format_bytes(memory.virtual_bytes),
        uptime_seconds: uptime,
        uptime_formatted: format_duration(uptime),
        cpu_percent: cpu,
        thread_count: threads,
        timestamp: now,
    }
}

/// Get memory usage details
#[tauri::command]
pub fn get_perf_memory_info() -> MemoryInfo {
    get_memory_usage()
}

/// Get app uptime
#[tauri::command]
pub fn get_app_uptime() -> (u64, String) {
    let seconds = APP_START.elapsed().as_secs();
    (seconds, format_duration(seconds))
}

// =============================================================================
// Platform-specific implementations
// =============================================================================

#[cfg(target_os = "linux")]
fn get_memory_usage() -> MemoryInfo {
    use std::fs;

    let mut info = MemoryInfo {
        heap_bytes: 0,
        rss_bytes: 0,
        virtual_bytes: 0,
        peak_bytes: 0,
    };

    // Read from /proc/self/statm for memory info
    if let Ok(statm) = fs::read_to_string("/proc/self/statm") {
        let parts: Vec<&str> = statm.split_whitespace().collect();
        if parts.len() >= 2 {
            let page_size = 4096u64; // Standard page size
            // parts[0] = total program size (VmSize)
            // parts[1] = resident set size (VmRSS)
            info.virtual_bytes = parts[0].parse::<u64>().unwrap_or(0) * page_size;
            info.rss_bytes = parts[1].parse::<u64>().unwrap_or(0) * page_size;
        }
    }

    // Read from /proc/self/status for more detailed info
    if let Ok(status) = fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if line.starts_with("VmData:") || line.starts_with("VmHWM:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let kb = parts[1].parse::<u64>().unwrap_or(0);
                    if line.starts_with("VmData:") {
                        info.heap_bytes = kb * 1024;
                    } else if line.starts_with("VmHWM:") {
                        info.peak_bytes = kb * 1024;
                    }
                }
            }
        }
    }

    // Use RSS as heap if we couldn't get heap specifically
    if info.heap_bytes == 0 {
        info.heap_bytes = info.rss_bytes;
    }

    info
}

#[cfg(target_os = "macos")]
fn get_memory_usage() -> MemoryInfo {
    use std::process::Command;

    let mut info = MemoryInfo {
        heap_bytes: 0,
        rss_bytes: 0,
        virtual_bytes: 0,
        peak_bytes: 0,
    };

    // Use ps to get memory info for current process
    let pid = std::process::id();
    let output = Command::new("ps")
        .args(["-o", "rss=,vsz=", "-p", &pid.to_string()])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            let parts: Vec<&str> = text.split_whitespace().collect();
            if parts.len() >= 2 {
                // ps reports in KB
                info.rss_bytes = parts[0].parse::<u64>().unwrap_or(0) * 1024;
                info.virtual_bytes = parts[1].parse::<u64>().unwrap_or(0) * 1024;
                info.heap_bytes = info.rss_bytes;
            }
        }
    }

    info
}

#[cfg(target_os = "windows")]
fn get_memory_usage() -> MemoryInfo {
    use std::process::Command;

    let mut info = MemoryInfo {
        heap_bytes: 0,
        rss_bytes: 0,
        virtual_bytes: 0,
        peak_bytes: 0,
    };

    let pid = std::process::id();
    let ps_cmd = format!(
        r#"
        $p = Get-Process -Id {}
        @{{
            WorkingSet = $p.WorkingSet64
            VirtualMemory = $p.VirtualMemorySize64
            PeakWorkingSet = $p.PeakWorkingSet64
            PrivateMemory = $p.PrivateMemorySize64
        }} | ConvertTo-Json
        "#,
        pid
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_cmd])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                info.rss_bytes = json["WorkingSet"].as_u64().unwrap_or(0);
                info.virtual_bytes = json["VirtualMemory"].as_u64().unwrap_or(0);
                info.peak_bytes = json["PeakWorkingSet"].as_u64().unwrap_or(0);
                info.heap_bytes = json["PrivateMemory"].as_u64().unwrap_or(0);
            }
        }
    }

    info
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_memory_usage() -> MemoryInfo {
    MemoryInfo {
        heap_bytes: 0,
        rss_bytes: 0,
        virtual_bytes: 0,
        peak_bytes: 0,
    }
}

// =============================================================================
// CPU usage
// =============================================================================

#[cfg(target_os = "linux")]
fn get_cpu_usage() -> f32 {
    use std::fs;

    // Read /proc/self/stat for CPU times
    if let Ok(stat) = fs::read_to_string("/proc/self/stat") {
        let parts: Vec<&str> = stat.split_whitespace().collect();
        if parts.len() >= 15 {
            // parts[13] = utime (user mode jiffies)
            // parts[14] = stime (kernel mode jiffies)
            let utime = parts[13].parse::<u64>().unwrap_or(0);
            let stime = parts[14].parse::<u64>().unwrap_or(0);
            let total_time = utime + stime;

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let last_time = LAST_CPU_TIME.load(Ordering::Relaxed);
            let last_measure = LAST_MEASURE_TIME.load(Ordering::Relaxed);

            if last_measure > 0 && now > last_measure {
                let time_delta = (now - last_measure) as f32 / 1000.0; // seconds
                let cpu_delta = (total_time - last_time) as f32 / 100.0; // jiffies to seconds
                
                LAST_CPU_TIME.store(total_time, Ordering::Relaxed);
                LAST_MEASURE_TIME.store(now, Ordering::Relaxed);

                if time_delta > 0.0 {
                    return (cpu_delta / time_delta) * 100.0;
                }
            } else {
                LAST_CPU_TIME.store(total_time, Ordering::Relaxed);
                LAST_MEASURE_TIME.store(now, Ordering::Relaxed);
            }
        }
    }

    0.0
}

#[cfg(target_os = "macos")]
fn get_cpu_usage() -> f32 {
    use std::process::Command;

    let pid = std::process::id();
    let output = Command::new("ps")
        .args(["-o", "%cpu=", "-p", &pid.to_string()])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.trim().parse::<f32>().unwrap_or(0.0);
        }
    }

    0.0
}

#[cfg(target_os = "windows")]
fn get_cpu_usage() -> f32 {
    use std::process::Command;

    let pid = std::process::id();
    let ps_cmd = format!(r#"(Get-Process -Id {}).CPU"#, pid);
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_cmd])
        .output();

    // Windows CPU property is cumulative, so we need to calculate delta
    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            let total_time = (text.trim().parse::<f64>().unwrap_or(0.0) * 1000.0) as u64;
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let last_time = LAST_CPU_TIME.load(Ordering::Relaxed);
            let last_measure = LAST_MEASURE_TIME.load(Ordering::Relaxed);

            if last_measure > 0 && now > last_measure && total_time > last_time {
                let time_delta = (now - last_measure) as f32;
                let cpu_delta = (total_time - last_time) as f32;

                LAST_CPU_TIME.store(total_time, Ordering::Relaxed);
                LAST_MEASURE_TIME.store(now, Ordering::Relaxed);

                if time_delta > 0.0 {
                    return (cpu_delta / time_delta) * 100.0;
                }
            } else {
                LAST_CPU_TIME.store(total_time, Ordering::Relaxed);
                LAST_MEASURE_TIME.store(now, Ordering::Relaxed);
            }
        }
    }

    0.0
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_cpu_usage() -> f32 {
    0.0
}

// =============================================================================
// Thread count
// =============================================================================

#[cfg(target_os = "linux")]
fn get_thread_count() -> u32 {
    use std::fs;

    if let Ok(status) = fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if line.starts_with("Threads:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    return parts[1].parse().unwrap_or(1);
                }
            }
        }
    }
    1
}

#[cfg(target_os = "macos")]
fn get_thread_count() -> u32 {
    use std::process::Command;

    let pid = std::process::id();
    let output = Command::new("ps")
        .args(["-M", "-p", &pid.to_string()])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            // Count lines minus header
            return (text.lines().count() as u32).saturating_sub(1).max(1);
        }
    }
    1
}

#[cfg(target_os = "windows")]
fn get_thread_count() -> u32 {
    use std::process::Command;

    let pid = std::process::id();
    let ps_cmd = format!(r#"(Get-Process -Id {}).Threads.Count"#, pid);
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_cmd])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            return text.trim().parse().unwrap_or(1);
        }
    }
    1
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_thread_count() -> u32 {
    1
}
