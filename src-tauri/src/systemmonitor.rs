//! Real-time system health monitoring
//!
//! Provides a background monitor that periodically samples system-wide
//! resource usage (CPU, memory, disk) and emits events to the frontend.
//! This enables the SystemUsageMonitor component to show live metrics
//! without polling from JavaScript.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use sysinfo::System;
use tauri::{AppHandle, Emitter};

static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

/// System-wide resource snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealthSnapshot {
    /// Overall CPU usage percentage (0-100)
    pub cpu_usage: f32,
    /// Per-core CPU usage percentages
    pub cpu_per_core: Vec<f32>,
    /// Number of logical CPU cores
    pub cpu_cores: usize,
    /// Total physical memory in bytes
    pub memory_total: u64,
    /// Used memory in bytes
    pub memory_used: u64,
    /// Memory usage percentage (0-100)
    pub memory_percent: f32,
    /// Total swap in bytes
    pub swap_total: u64,
    /// Used swap in bytes
    pub swap_used: u64,
    /// Available disk space on the main volume (bytes)
    pub disk_available: u64,
    /// Total disk space on the main volume (bytes)
    pub disk_total: u64,
    /// Disk usage percentage (0-100)
    pub disk_percent: f32,
    /// System load averages (1m, 5m, 15m) — Unix only, zeroes on Windows
    pub load_average: [f64; 3],
    /// System uptime in seconds
    pub system_uptime: u64,
    /// Timestamp of this snapshot (Unix ms)
    pub timestamp: u64,
}

/// Get a one-shot system health snapshot
#[tauri::command]
pub fn get_system_health() -> SystemHealthSnapshot {
    take_snapshot()
}

/// Start the background system health monitor
///
/// Emits `system:health` events every `interval_secs` seconds.
#[tauri::command]
pub fn start_system_monitor(app: AppHandle, interval_secs: Option<u64>) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    let interval = interval_secs.unwrap_or(10).max(3); // Minimum 3 seconds

    tauri::async_runtime::spawn(async move {
        let mut sys = System::new_all();

        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

            // Refresh measurements
            sys.refresh_cpu_all();
            sys.refresh_memory();

            let snapshot = take_snapshot_with_sys(&sys);
            let _ = app.emit("system:health", &snapshot);
        }

        log::info!("System health monitor stopped");
    });

    Ok(())
}

/// Stop the background system health monitor
#[tauri::command]
pub fn stop_system_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

/// Check if the system monitor is currently running
#[tauri::command]
pub fn is_system_monitor_running() -> bool {
    MONITOR_RUNNING.load(Ordering::Relaxed)
}

/// Take a snapshot using a fresh System instance (for one-shot calls)
fn take_snapshot() -> SystemHealthSnapshot {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    take_snapshot_with_sys(&sys)
}

/// Take a snapshot using an existing (already-refreshed) System instance
fn take_snapshot_with_sys(sys: &System) -> SystemHealthSnapshot {
    let cpu_per_core: Vec<f32> = sys.cpus().iter().map(|cpu| cpu.cpu_usage()).collect();
    let cpu_usage = if cpu_per_core.is_empty() {
        0.0
    } else {
        cpu_per_core.iter().sum::<f32>() / cpu_per_core.len() as f32
    };

    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_percent = if memory_total > 0 {
        (memory_used as f32 / memory_total as f32) * 100.0
    } else {
        0.0
    };

    let swap_total = sys.total_swap();
    let swap_used = sys.used_swap();

    // Disk info — use the largest/root volume
    let (disk_available, disk_total) = get_primary_disk_info();
    let disk_percent = if disk_total > 0 {
        ((disk_total - disk_available) as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };

    let load_avg = System::load_average();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    SystemHealthSnapshot {
        cpu_usage,
        cpu_per_core,
        cpu_cores: sys.cpus().len(),
        memory_total,
        memory_used,
        memory_percent,
        swap_total,
        swap_used,
        disk_available,
        disk_total,
        disk_percent,
        load_average: [load_avg.one, load_avg.five, load_avg.fifteen],
        system_uptime: System::uptime(),
        timestamp: now,
    }
}

/// Get disk info for the primary/largest volume
fn get_primary_disk_info() -> (u64, u64) {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mut best_total = 0u64;
    let mut best_available = 0u64;

    for disk in disks.list() {
        let total = disk.total_space();
        if total > best_total {
            best_total = total;
            best_available = disk.available_space();
        }
    }

    (best_available, best_total)
}
