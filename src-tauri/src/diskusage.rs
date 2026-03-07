//! Disk Usage Monitor - Native filesystem space tracking for Hearth Desktop
//!
//! Provides:
//! - Get disk/partition usage stats (total, used, free, percentage)
//! - List all mounted volumes/partitions
//! - Track disk usage over time with alerts

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageSummary {
    pub disks: Vec<DiskInfo>,
    pub total_space: u64,
    pub total_used: u64,
    pub total_free: u64,
    pub overall_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskAlert {
    pub id: String,
    pub mount_point: String,
    pub threshold: f64,
    pub current_percent: f64,
    pub created_at: String,
}

pub struct DiskUsageManager {
    alerts: Mutex<Vec<DiskAlert>>,
    threshold: Mutex<f64>,
}

impl Default for DiskUsageManager {
    fn default() -> Self {
        Self {
            alerts: Mutex::new(Vec::new()),
            threshold: Mutex::new(90.0),
        }
    }
}

#[tauri::command]
pub fn disk_get_usage() -> Result<DiskUsageSummary, String> {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mut disk_infos = Vec::new();
    let mut total_space: u64 = 0;
    let mut total_used: u64 = 0;

    for disk in disks.list() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total.saturating_sub(available);
        let percent = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        disk_infos.push(DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            fs_type: disk.file_system().to_string_lossy().to_string(),
            total_bytes: total,
            used_bytes: used,
            free_bytes: available,
            usage_percent: (percent * 10.0).round() / 10.0,
        });

        total_space += total;
        total_used += used;
    }

    let total_free = total_space.saturating_sub(total_used);
    let overall = if total_space > 0 {
        (total_used as f64 / total_space as f64) * 100.0
    } else {
        0.0
    };

    Ok(DiskUsageSummary {
        disks: disk_infos,
        total_space,
        total_used,
        total_free,
        overall_percent: (overall * 10.0).round() / 10.0,
    })
}

#[tauri::command]
pub fn disk_get_info(path: String) -> Result<DiskInfo, String> {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let target = std::path::Path::new(&path);

    // Find the disk that contains the given path (longest mount point match)
    let mut best_match: Option<DiskInfo> = None;
    let mut best_len = 0;

    for disk in disks.list() {
        let mp = disk.mount_point();
        if target.starts_with(mp) {
            let mp_len = mp.to_string_lossy().len();
            if mp_len > best_len {
                let total = disk.total_space();
                let available = disk.available_space();
                let used = total.saturating_sub(available);
                let percent = if total > 0 {
                    (used as f64 / total as f64) * 100.0
                } else {
                    0.0
                };

                best_match = Some(DiskInfo {
                    name: disk.name().to_string_lossy().to_string(),
                    mount_point: mp.to_string_lossy().to_string(),
                    fs_type: disk.file_system().to_string_lossy().to_string(),
                    total_bytes: total,
                    used_bytes: used,
                    free_bytes: available,
                    usage_percent: (percent * 10.0).round() / 10.0,
                });
                best_len = mp_len;
            }
        }
    }

    best_match.ok_or_else(|| format!("No disk found for path: {}", path))
}

#[tauri::command]
pub fn disk_get_threshold(
    state: State<'_, DiskUsageManager>,
) -> Result<f64, String> {
    let threshold = state.threshold.lock().map_err(|e| e.to_string())?;
    Ok(*threshold)
}

#[tauri::command]
pub fn disk_set_threshold(
    state: State<'_, DiskUsageManager>,
    threshold: f64,
) -> Result<(), String> {
    let threshold_val = threshold.max(50.0).min(99.0);
    let mut t = state.threshold.lock().map_err(|e| e.to_string())?;
    *t = threshold_val;
    Ok(())
}

#[tauri::command]
pub fn disk_check_alerts(
    state: State<'_, DiskUsageManager>,
) -> Result<Vec<DiskAlert>, String> {
    use sysinfo::Disks;

    let threshold = {
        let t = state.threshold.lock().map_err(|e| e.to_string())?;
        *t
    };

    let disks = Disks::new_with_refreshed_list();
    let mut new_alerts = Vec::new();

    for disk in disks.list() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total.saturating_sub(available);
        let percent = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        if percent >= threshold {
            new_alerts.push(DiskAlert {
                id: uuid::Uuid::new_v4().to_string(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                threshold,
                current_percent: (percent * 10.0).round() / 10.0,
                created_at: chrono::Utc::now().to_rfc3339(),
            });
        }
    }

    let mut alerts = state.alerts.lock().map_err(|e| e.to_string())?;
    *alerts = new_alerts.clone();
    Ok(new_alerts)
}

#[tauri::command]
pub fn disk_clear_alerts(
    state: State<'_, DiskUsageManager>,
) -> Result<(), String> {
    let mut alerts = state.alerts.lock().map_err(|e| e.to_string())?;
    alerts.clear();
    Ok(())
}
