//! Process manager for native process inspection
//!
//! Provides system process listing, resource usage tracking, and the ability
//! to detect specific running applications. Useful for smart status detection,
//! gaming detection, and resource monitoring.

use serde::{Deserialize, Serialize};
use sysinfo::{ProcessesToUpdate, System};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub status: String,
    pub start_time: u64,
    pub parent_pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSummary {
    pub total_processes: usize,
    pub total_threads: usize,
    pub total_cpu_usage: f32,
    pub total_memory_bytes: u64,
    pub top_cpu: Vec<ProcessInfo>,
    pub top_memory: Vec<ProcessInfo>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppDetectionResult {
    pub app_name: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub cpu_usage: Option<f32>,
    pub memory_bytes: Option<u64>,
}

/// Get a summary of system processes with top CPU/memory consumers
#[tauri::command]
pub fn process_get_summary(top_count: Option<usize>) -> ProcessSummary {
    let top_n = top_count.unwrap_or(10);
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory_bytes: p.memory(),
            status: format!("{:?}", p.status()),
            start_time: p.start_time(),
            parent_pid: p.parent().map(|pid| pid.as_u32()),
        })
        .collect();

    let total_processes = processes.len();
    let total_cpu_usage: f32 = processes.iter().map(|p| p.cpu_usage).sum();
    let total_memory_bytes: u64 = processes.iter().map(|p| p.memory_bytes).sum();

    // Top by CPU
    processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
    let top_cpu: Vec<ProcessInfo> = processes.iter().take(top_n).cloned().collect();

    // Top by memory
    processes.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
    let top_memory: Vec<ProcessInfo> = processes.iter().take(top_n).cloned().collect();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    ProcessSummary {
        total_processes,
        total_threads: 0, // sysinfo doesn't expose thread count directly
        total_cpu_usage,
        total_memory_bytes,
        top_cpu,
        top_memory,
        timestamp: now,
    }
}

/// Search for processes by name
#[tauri::command]
pub fn process_find_by_name(name: String) -> Vec<ProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let search = name.to_lowercase();

    sys.processes()
        .values()
        .filter(|p| p.name().to_string_lossy().to_lowercase().contains(&search))
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory_bytes: p.memory(),
            status: format!("{:?}", p.status()),
            start_time: p.start_time(),
            parent_pid: p.parent().map(|pid| pid.as_u32()),
        })
        .collect()
}

/// Detect whether specific applications are running
#[tauri::command]
pub fn process_detect_apps(app_names: Vec<String>) -> Vec<AppDetectionResult> {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    app_names
        .into_iter()
        .map(|app_name| {
            let search = app_name.to_lowercase();
            let found = sys
                .processes()
                .values()
                .find(|p| p.name().to_string_lossy().to_lowercase().contains(&search));

            match found {
                Some(p) => AppDetectionResult {
                    app_name,
                    running: true,
                    pid: Some(p.pid().as_u32()),
                    cpu_usage: Some(p.cpu_usage()),
                    memory_bytes: Some(p.memory()),
                },
                None => AppDetectionResult {
                    app_name,
                    running: false,
                    pid: None,
                    cpu_usage: None,
                    memory_bytes: None,
                },
            }
        })
        .collect()
}

/// Get the total number of running processes
#[tauri::command]
pub fn process_get_count() -> usize {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    sys.processes().len()
}

/// Check if a specific process is running by exact name
#[tauri::command]
pub fn process_is_running(name: String) -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let search = name.to_lowercase();
    sys.processes()
        .values()
        .any(|p| p.name().to_string_lossy().to_lowercase().contains(&search))
}

/// Detect common communication apps for smart status
#[tauri::command]
pub fn process_detect_communication_apps() -> Vec<AppDetectionResult> {
    let apps = vec![
        "zoom".to_string(),
        "teams".to_string(),
        "slack".to_string(),
        "discord".to_string(),
        "skype".to_string(),
        "webex".to_string(),
        "google meet".to_string(),
        "obs".to_string(),
        "streamlabs".to_string(),
    ];
    process_detect_apps(apps)
}

/// Detect common gaming applications for gaming status
#[tauri::command]
pub fn process_detect_gaming_apps() -> Vec<AppDetectionResult> {
    let apps = vec![
        "steam".to_string(),
        "epic".to_string(),
        "lutris".to_string(),
        "wine".to_string(),
        "proton".to_string(),
        "retroarch".to_string(),
        "gamemode".to_string(),
    ];
    process_detect_apps(apps)
}
