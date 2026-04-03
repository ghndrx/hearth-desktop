use tauri_plugin_notification::NotificationExt;
use sysinfo::{System, ProcessExt, SystemExt, Pid};

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set the dock/taskbar badge count (unread messages)
#[tauri::command]
pub async fn set_badge_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if count > 0 {
                window.set_badge_count(Some(count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Get system information for presence monitoring
#[tauri::command]
pub async fn get_system_info() -> Result<serde_json::Value, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let info = serde_json::json!({
        "total_memory": sys.total_memory(),
        "used_memory": sys.used_memory(),
        "total_swap": sys.total_swap(),
        "used_swap": sys.used_swap(),
        "cpu_count": sys.cpus().len(),
        "system_name": sys.name(),
        "kernel_version": sys.kernel_version(),
        "os_version": sys.os_version(),
        "host_name": sys.host_name(),
    });

    Ok(info)
}

/// Get active processes for presence detection
#[tauri::command]
pub async fn get_active_processes() -> Result<Vec<serde_json::Value>, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();

    let processes: Vec<serde_json::Value> = sys.processes()
        .iter()
        .map(|(pid, process)| {
            serde_json::json!({
                "pid": pid.as_u32(),
                "name": process.name(),
                "cpu_usage": process.cpu_usage(),
                "memory": process.memory(),
                "disk_usage": {
                    "read_bytes": process.disk_usage().read_bytes,
                    "written_bytes": process.disk_usage().written_bytes,
                },
                "start_time": process.start_time(),
                "run_time": process.run_time(),
            })
        })
        .collect();

    Ok(processes)
}

/// Check if a specific process is running by name
#[tauri::command]
pub async fn is_process_running(process_name: String) -> Result<bool, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();

    let is_running = sys.processes()
        .values()
        .any(|process| process.name().to_lowercase().contains(&process_name.to_lowercase()));

    Ok(is_running)
}

/// Get process details by PID
#[tauri::command]
pub async fn get_process_by_pid(pid: u32) -> Result<Option<serde_json::Value>, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();

    if let Some(process) = sys.process(Pid::from_u32(pid)) {
        let process_info = serde_json::json!({
            "pid": pid,
            "name": process.name(),
            "cpu_usage": process.cpu_usage(),
            "memory": process.memory(),
            "disk_usage": {
                "read_bytes": process.disk_usage().read_bytes,
                "written_bytes": process.disk_usage().written_bytes,
            },
            "start_time": process.start_time(),
            "run_time": process.run_time(),
            "status": process.status(),
            "parent": process.parent().map(|p| p.as_u32()),
            "environ": process.environ(),
            "cmd": process.cmd(),
            "exe": process.exe(),
            "cwd": process.cwd(),
        });
        Ok(Some(process_info))
    } else {
        Ok(None)
    }
}
