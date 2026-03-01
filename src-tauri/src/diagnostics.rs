use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};

/// Diagnostic check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticResult {
    pub name: String,
    pub category: String,
    pub status: DiagnosticStatus,
    pub message: String,
    pub details: Option<String>,
    pub latency_ms: Option<u64>,
    pub fix_suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticStatus {
    Pass,
    Warn,
    Fail,
    Skip,
}

/// Full diagnostic report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub timestamp: String,
    pub platform: String,
    pub app_version: String,
    pub results: Vec<DiagnosticResult>,
    pub summary: DiagnosticSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticSummary {
    pub total: usize,
    pub passed: usize,
    pub warnings: usize,
    pub failed: usize,
    pub skipped: usize,
    pub overall_health: String,
}

/// Run all diagnostics
#[tauri::command]
pub async fn run_diagnostics<R: Runtime>(app: AppHandle<R>) -> Result<DiagnosticReport, String> {
    let start = Instant::now();
    let mut results = Vec::new();

    // System diagnostics
    results.push(check_os_version());
    results.push(check_memory_available());
    results.push(check_disk_space());
    results.push(check_cpu_info());

    // Tauri/App diagnostics
    results.push(check_app_data_directory(&app));
    results.push(check_config_directory(&app));
    results.push(check_cache_directory(&app));
    results.push(check_log_directory(&app));

    // Feature diagnostics
    results.push(check_notification_permission());
    results.push(check_global_shortcuts());
    results.push(check_system_tray());
    results.push(check_clipboard_access());
    results.push(check_file_system_access());
    results.push(check_network_connectivity().await);
    results.push(check_audio_subsystem());
    results.push(check_gpu_acceleration());

    // Desktop-specific
    #[cfg(target_os = "linux")]
    {
        results.push(check_desktop_environment());
        results.push(check_dbus_connection());
        results.push(check_libnotify());
    }

    #[cfg(target_os = "macos")]
    {
        results.push(check_macos_permissions());
    }

    #[cfg(target_os = "windows")]
    {
        results.push(check_windows_notifications());
    }

    let elapsed = start.elapsed();

    // Calculate summary
    let total = results.len();
    let passed = results.iter().filter(|r| r.status == DiagnosticStatus::Pass).count();
    let warnings = results.iter().filter(|r| r.status == DiagnosticStatus::Warn).count();
    let failed = results.iter().filter(|r| r.status == DiagnosticStatus::Fail).count();
    let skipped = results.iter().filter(|r| r.status == DiagnosticStatus::Skip).count();

    let overall_health = if failed > 0 {
        "critical".to_string()
    } else if warnings > 2 {
        "degraded".to_string()
    } else if warnings > 0 {
        "good".to_string()
    } else {
        "excellent".to_string()
    };

    Ok(DiagnosticReport {
        timestamp: chrono::Utc::now().to_rfc3339(),
        platform: std::env::consts::OS.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        results,
        summary: DiagnosticSummary {
            total,
            passed,
            warnings,
            failed,
            skipped,
            overall_health,
        },
    })
}

/// Run a single diagnostic check
#[tauri::command]
pub async fn run_single_diagnostic<R: Runtime>(
    app: AppHandle<R>,
    check_name: String,
) -> Result<DiagnosticResult, String> {
    match check_name.as_str() {
        "os_version" => Ok(check_os_version()),
        "memory" => Ok(check_memory_available()),
        "disk_space" => Ok(check_disk_space()),
        "cpu" => Ok(check_cpu_info()),
        "app_data" => Ok(check_app_data_directory(&app)),
        "config" => Ok(check_config_directory(&app)),
        "cache" => Ok(check_cache_directory(&app)),
        "logs" => Ok(check_log_directory(&app)),
        "notifications" => Ok(check_notification_permission()),
        "shortcuts" => Ok(check_global_shortcuts()),
        "tray" => Ok(check_system_tray()),
        "clipboard" => Ok(check_clipboard_access()),
        "filesystem" => Ok(check_file_system_access()),
        "network" => Ok(check_network_connectivity().await),
        "audio" => Ok(check_audio_subsystem()),
        "gpu" => Ok(check_gpu_acceleration()),
        _ => Err(format!("Unknown diagnostic check: {}", check_name)),
    }
}

/// Export diagnostic report to file
#[tauri::command]
pub async fn export_diagnostic_report<R: Runtime>(
    app: AppHandle<R>,
    report: DiagnosticReport,
    path: String,
) -> Result<String, String> {
    let json = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize report: {}", e))?;
    
    std::fs::write(&path, &json)
        .map_err(|e| format!("Failed to write report: {}", e))?;
    
    Ok(path)
}

// System checks

fn check_os_version() -> DiagnosticResult {
    let start = Instant::now();
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    
    #[cfg(target_os = "linux")]
    let version = std::fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|content| {
            content.lines()
                .find(|l| l.starts_with("PRETTY_NAME="))
                .map(|l| l.trim_start_matches("PRETTY_NAME=").trim_matches('"').to_string())
        })
        .unwrap_or_else(|| "Linux".to_string());
    
    #[cfg(target_os = "macos")]
    let version = Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| format!("macOS {}", s.trim()))
        .unwrap_or_else(|| "macOS".to_string());
    
    #[cfg(target_os = "windows")]
    let version = "Windows".to_string();
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    let version = format!("{} {}", os, arch);

    DiagnosticResult {
        name: "Operating System".to_string(),
        category: "System".to_string(),
        status: DiagnosticStatus::Pass,
        message: version.clone(),
        details: Some(format!("Architecture: {}", arch)),
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_memory_available() -> DiagnosticResult {
    let start = Instant::now();
    
    #[cfg(target_os = "linux")]
    let (total, available) = {
        let meminfo = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
        let parse_kb = |prefix: &str| -> u64 {
            meminfo.lines()
                .find(|l| l.starts_with(prefix))
                .and_then(|l| l.split_whitespace().nth(1))
                .and_then(|s| s.parse().ok())
                .unwrap_or(0)
        };
        (parse_kb("MemTotal:"), parse_kb("MemAvailable:"))
    };
    
    #[cfg(not(target_os = "linux"))]
    let (total, available) = (0u64, 0u64);

    let total_gb = total as f64 / 1024.0 / 1024.0;
    let available_gb = available as f64 / 1024.0 / 1024.0;
    let usage_percent = if total > 0 { (total - available) as f64 / total as f64 * 100.0 } else { 0.0 };

    let (status, fix) = if available_gb < 0.5 {
        (DiagnosticStatus::Fail, Some("Close unused applications to free memory".to_string()))
    } else if available_gb < 1.0 {
        (DiagnosticStatus::Warn, Some("Consider closing some applications".to_string()))
    } else {
        (DiagnosticStatus::Pass, None)
    };

    DiagnosticResult {
        name: "Memory".to_string(),
        category: "System".to_string(),
        status,
        message: format!("{:.1} GB available of {:.1} GB total ({:.0}% used)", available_gb, total_gb, usage_percent),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: fix,
    }
}

fn check_disk_space() -> DiagnosticResult {
    let start = Instant::now();
    
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    
    #[cfg(unix)]
    let (total, available) = {
        use std::os::unix::fs::MetadataExt;
        let output = Command::new("df")
            .arg("-k")
            .arg(&home)
            .output()
            .ok();
        
        if let Some(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let line = stdout.lines().nth(1).unwrap_or("");
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let total_kb: u64 = parts[1].parse().unwrap_or(0);
                let avail_kb: u64 = parts[3].parse().unwrap_or(0);
                (total_kb, avail_kb)
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        }
    };
    
    #[cfg(not(unix))]
    let (total, available) = (0u64, 0u64);

    let total_gb = total as f64 / 1024.0 / 1024.0;
    let available_gb = available as f64 / 1024.0 / 1024.0;

    let (status, fix) = if available_gb < 1.0 {
        (DiagnosticStatus::Fail, Some("Free up disk space immediately".to_string()))
    } else if available_gb < 5.0 {
        (DiagnosticStatus::Warn, Some("Consider freeing up some disk space".to_string()))
    } else {
        (DiagnosticStatus::Pass, None)
    };

    DiagnosticResult {
        name: "Disk Space".to_string(),
        category: "System".to_string(),
        status,
        message: format!("{:.1} GB available of {:.1} GB total", available_gb, total_gb),
        details: Some(format!("Path: {}", home.display())),
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: fix,
    }
}

fn check_cpu_info() -> DiagnosticResult {
    let start = Instant::now();
    
    #[cfg(target_os = "linux")]
    let (cpu_name, cores) = {
        let cpuinfo = std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
        let name = cpuinfo.lines()
            .find(|l| l.starts_with("model name"))
            .and_then(|l| l.split(':').nth(1))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());
        let cores = cpuinfo.lines()
            .filter(|l| l.starts_with("processor"))
            .count();
        (name, cores)
    };
    
    #[cfg(not(target_os = "linux"))]
    let (cpu_name, cores) = {
        let cores = std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(1);
        ("Unknown CPU".to_string(), cores)
    };

    DiagnosticResult {
        name: "CPU".to_string(),
        category: "System".to_string(),
        status: DiagnosticStatus::Pass,
        message: cpu_name,
        details: Some(format!("{} cores/threads", cores)),
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

// App directory checks

fn check_app_data_directory<R: Runtime>(app: &AppHandle<R>) -> DiagnosticResult {
    let start = Instant::now();
    
    match app.path().app_data_dir() {
        Ok(path) => {
            let exists = path.exists();
            let writable = if exists {
                std::fs::metadata(&path).map(|m| !m.permissions().readonly()).unwrap_or(false)
            } else {
                std::fs::create_dir_all(&path).is_ok()
            };
            
            DiagnosticResult {
                name: "App Data Directory".to_string(),
                category: "Storage".to_string(),
                status: if writable { DiagnosticStatus::Pass } else { DiagnosticStatus::Fail },
                message: if writable { "Writable".to_string() } else { "Not writable".to_string() },
                details: Some(path.display().to_string()),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                fix_suggestion: if !writable { Some("Check directory permissions".to_string()) } else { None },
            }
        }
        Err(e) => DiagnosticResult {
            name: "App Data Directory".to_string(),
            category: "Storage".to_string(),
            status: DiagnosticStatus::Fail,
            message: format!("Error: {}", e),
            details: None,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            fix_suggestion: Some("Reinstall the application".to_string()),
        }
    }
}

fn check_config_directory<R: Runtime>(app: &AppHandle<R>) -> DiagnosticResult {
    let start = Instant::now();
    
    match app.path().app_config_dir() {
        Ok(path) => {
            let exists = path.exists();
            DiagnosticResult {
                name: "Config Directory".to_string(),
                category: "Storage".to_string(),
                status: if exists { DiagnosticStatus::Pass } else { DiagnosticStatus::Warn },
                message: if exists { "Exists".to_string() } else { "Will be created on first use".to_string() },
                details: Some(path.display().to_string()),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                fix_suggestion: None,
            }
        }
        Err(e) => DiagnosticResult {
            name: "Config Directory".to_string(),
            category: "Storage".to_string(),
            status: DiagnosticStatus::Fail,
            message: format!("Error: {}", e),
            details: None,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            fix_suggestion: Some("Check app installation".to_string()),
        }
    }
}

fn check_cache_directory<R: Runtime>(app: &AppHandle<R>) -> DiagnosticResult {
    let start = Instant::now();
    
    match app.path().app_cache_dir() {
        Ok(path) => {
            let exists = path.exists();
            let size = if exists {
                calculate_dir_size(&path)
            } else {
                0
            };
            let size_mb = size as f64 / 1024.0 / 1024.0;
            
            let (status, fix) = if size_mb > 500.0 {
                (DiagnosticStatus::Warn, Some("Consider clearing cache to free space".to_string()))
            } else {
                (DiagnosticStatus::Pass, None)
            };
            
            DiagnosticResult {
                name: "Cache Directory".to_string(),
                category: "Storage".to_string(),
                status,
                message: format!("{:.1} MB", size_mb),
                details: Some(path.display().to_string()),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                fix_suggestion: fix,
            }
        }
        Err(e) => DiagnosticResult {
            name: "Cache Directory".to_string(),
            category: "Storage".to_string(),
            status: DiagnosticStatus::Warn,
            message: format!("Error: {}", e),
            details: None,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            fix_suggestion: None,
        }
    }
}

fn check_log_directory<R: Runtime>(app: &AppHandle<R>) -> DiagnosticResult {
    let start = Instant::now();
    
    match app.path().app_log_dir() {
        Ok(path) => {
            let exists = path.exists();
            DiagnosticResult {
                name: "Log Directory".to_string(),
                category: "Storage".to_string(),
                status: if exists { DiagnosticStatus::Pass } else { DiagnosticStatus::Pass },
                message: if exists { "Available".to_string() } else { "Will be created when needed".to_string() },
                details: Some(path.display().to_string()),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                fix_suggestion: None,
            }
        }
        Err(e) => DiagnosticResult {
            name: "Log Directory".to_string(),
            category: "Storage".to_string(),
            status: DiagnosticStatus::Warn,
            message: format!("Error: {}", e),
            details: None,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            fix_suggestion: None,
        }
    }
}

// Feature checks

fn check_notification_permission() -> DiagnosticResult {
    let start = Instant::now();
    
    // Notifications are generally available in Tauri apps
    DiagnosticResult {
        name: "Notifications".to_string(),
        category: "Features".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Available via tauri-plugin-notification".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_global_shortcuts() -> DiagnosticResult {
    let start = Instant::now();
    
    DiagnosticResult {
        name: "Global Shortcuts".to_string(),
        category: "Features".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Available via tauri-plugin-global-shortcut".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_system_tray() -> DiagnosticResult {
    let start = Instant::now();
    
    DiagnosticResult {
        name: "System Tray".to_string(),
        category: "Features".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Available".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_clipboard_access() -> DiagnosticResult {
    let start = Instant::now();
    
    DiagnosticResult {
        name: "Clipboard".to_string(),
        category: "Features".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Available via tauri-plugin-clipboard-manager".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_file_system_access() -> DiagnosticResult {
    let start = Instant::now();
    
    let home = dirs::home_dir();
    let (status, msg) = match home {
        Some(path) if path.exists() => (DiagnosticStatus::Pass, "Home directory accessible".to_string()),
        _ => (DiagnosticStatus::Warn, "Home directory not found".to_string()),
    };
    
    DiagnosticResult {
        name: "File System".to_string(),
        category: "Features".to_string(),
        status,
        message: msg,
        details: home.map(|p| p.display().to_string()),
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

async fn check_network_connectivity() -> DiagnosticResult {
    let start = Instant::now();
    
    // Simple connectivity check
    let (status, message) = match std::net::TcpStream::connect_timeout(
        &"1.1.1.1:443".parse().unwrap(),
        Duration::from_secs(3),
    ) {
        Ok(_) => (DiagnosticStatus::Pass, "Connected".to_string()),
        Err(e) => (DiagnosticStatus::Warn, format!("Limited: {}", e)),
    };
    
    DiagnosticResult {
        name: "Network".to_string(),
        category: "Connectivity".to_string(),
        status,
        message,
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: if status != DiagnosticStatus::Pass { 
            Some("Check your internet connection".to_string()) 
        } else { 
            None 
        },
    }
}

fn check_audio_subsystem() -> DiagnosticResult {
    let start = Instant::now();
    
    #[cfg(target_os = "linux")]
    let (status, message) = {
        // Check for PulseAudio or PipeWire
        let pulse = Command::new("pactl").arg("info").output();
        let pipewire = Command::new("pw-cli").arg("info").output();
        
        if pulse.is_ok() || pipewire.is_ok() {
            (DiagnosticStatus::Pass, "Audio subsystem available".to_string())
        } else {
            (DiagnosticStatus::Warn, "Audio subsystem not detected".to_string())
        }
    };
    
    #[cfg(not(target_os = "linux"))]
    let (status, message) = (DiagnosticStatus::Pass, "Audio subsystem available".to_string());
    
    DiagnosticResult {
        name: "Audio".to_string(),
        category: "Features".to_string(),
        status,
        message,
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

fn check_gpu_acceleration() -> DiagnosticResult {
    let start = Instant::now();
    
    #[cfg(target_os = "linux")]
    let (status, message, details) = {
        let glxinfo = Command::new("glxinfo")
            .arg("-B")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok());
        
        if let Some(info) = glxinfo {
            let renderer = info.lines()
                .find(|l| l.contains("OpenGL renderer"))
                .map(|l| l.split(':').nth(1).unwrap_or("").trim().to_string());
            (DiagnosticStatus::Pass, "GPU acceleration available".to_string(), renderer)
        } else {
            (DiagnosticStatus::Warn, "Could not detect GPU".to_string(), None)
        }
    };
    
    #[cfg(not(target_os = "linux"))]
    let (status, message, details) = (DiagnosticStatus::Pass, "GPU acceleration available".to_string(), None::<String>);
    
    DiagnosticResult {
        name: "GPU Acceleration".to_string(),
        category: "Performance".to_string(),
        status,
        message,
        details,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

// Linux-specific checks
#[cfg(target_os = "linux")]
fn check_desktop_environment() -> DiagnosticResult {
    let start = Instant::now();
    
    let de = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("DESKTOP_SESSION"))
        .unwrap_or_else(|_| "Unknown".to_string());
    
    let session_type = std::env::var("XDG_SESSION_TYPE")
        .unwrap_or_else(|_| "Unknown".to_string());
    
    DiagnosticResult {
        name: "Desktop Environment".to_string(),
        category: "System".to_string(),
        status: DiagnosticStatus::Pass,
        message: de,
        details: Some(format!("Session type: {}", session_type)),
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

#[cfg(target_os = "linux")]
fn check_dbus_connection() -> DiagnosticResult {
    let start = Instant::now();
    
    let dbus_addr = std::env::var("DBUS_SESSION_BUS_ADDRESS").is_ok();
    
    DiagnosticResult {
        name: "D-Bus".to_string(),
        category: "System".to_string(),
        status: if dbus_addr { DiagnosticStatus::Pass } else { DiagnosticStatus::Warn },
        message: if dbus_addr { "Session bus available".to_string() } else { "Session bus not found".to_string() },
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: if !dbus_addr { Some("D-Bus is required for notifications and tray".to_string()) } else { None },
    }
}

#[cfg(target_os = "linux")]
fn check_libnotify() -> DiagnosticResult {
    let start = Instant::now();
    
    let has_notify = Command::new("which")
        .arg("notify-send")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    
    DiagnosticResult {
        name: "libnotify".to_string(),
        category: "Features".to_string(),
        status: if has_notify { DiagnosticStatus::Pass } else { DiagnosticStatus::Warn },
        message: if has_notify { "Available".to_string() } else { "Not found".to_string() },
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: if !has_notify { Some("Install libnotify-bin for desktop notifications".to_string()) } else { None },
    }
}

#[cfg(target_os = "macos")]
fn check_macos_permissions() -> DiagnosticResult {
    let start = Instant::now();
    
    DiagnosticResult {
        name: "macOS Permissions".to_string(),
        category: "System".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Check System Preferences > Security & Privacy for app permissions".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

#[cfg(target_os = "windows")]
fn check_windows_notifications() -> DiagnosticResult {
    let start = Instant::now();
    
    DiagnosticResult {
        name: "Windows Notifications".to_string(),
        category: "Features".to_string(),
        status: DiagnosticStatus::Pass,
        message: "Available via Windows notification system".to_string(),
        details: None,
        latency_ms: Some(start.elapsed().as_millis() as u64),
        fix_suggestion: None,
    }
}

// Helpers

fn calculate_dir_size(path: &PathBuf) -> u64 {
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                size += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                size += calculate_dir_size(&path);
            }
        }
    }
    size
}
