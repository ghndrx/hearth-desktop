//! Startup Boot Manager - monitor and manage system startup applications

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub name: String,
    pub path: String,
    pub enabled: bool,
    pub source: String, // "autostart", "systemd", "xdg"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootStats {
    pub items: Vec<StartupItem>,
    pub total_count: u32,
    pub enabled_count: u32,
    pub last_boot_time: Option<String>,
    pub uptime_seconds: u64,
}

pub struct BootManager {
    cache: Mutex<Option<BootStats>>,
}

impl Default for BootManager {
    fn default() -> Self {
        Self { cache: Mutex::new(None) }
    }
}

fn get_uptime_seconds() -> u64 {
    if let Ok(output) = Command::new("cat").arg("/proc/uptime").output() {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Some(secs_str) = text.split_whitespace().next() {
                return secs_str.parse::<f64>().unwrap_or(0.0) as u64;
            }
        }
    }
    0
}

fn get_last_boot_time() -> Option<String> {
    if let Ok(output) = Command::new("who").arg("-b").output() {
        if let Ok(text) = String::from_utf8(output.stdout) {
            let trimmed = text.trim();
            if let Some(idx) = trimmed.find("boot") {
                return Some(trimmed[idx + 4..].trim().to_string());
            }
        }
    }
    None
}

fn scan_autostart_dir() -> Vec<StartupItem> {
    let mut items = Vec::new();

    // Check XDG autostart directories
    let autostart_dirs = vec![
        dirs::config_dir().map(|d| d.join("autostart")),
        Some(std::path::PathBuf::from("/etc/xdg/autostart")),
    ];

    for dir_opt in autostart_dirs {
        if let Some(dir) = dir_opt {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("desktop") {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            let name = content.lines()
                                .find(|l| l.starts_with("Name="))
                                .map(|l| l[5..].to_string())
                                .unwrap_or_else(|| path.file_stem().unwrap_or_default().to_string_lossy().to_string());
                            let hidden = content.lines()
                                .find(|l| l.starts_with("Hidden="))
                                .map(|l| l[7..].trim() == "true")
                                .unwrap_or(false);

                            items.push(StartupItem {
                                name,
                                path: path.to_string_lossy().to_string(),
                                enabled: !hidden,
                                source: if dir.starts_with("/etc") { "system".into() } else { "user".into() },
                            });
                        }
                    }
                }
            }
        }
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

#[tauri::command]
pub fn boot_scan(manager: tauri::State<'_, BootManager>) -> Result<BootStats, String> {
    let items = scan_autostart_dir();
    let enabled_count = items.iter().filter(|i| i.enabled).count() as u32;
    let total_count = items.len() as u32;
    let stats = BootStats {
        items,
        total_count,
        enabled_count,
        last_boot_time: get_last_boot_time(),
        uptime_seconds: get_uptime_seconds(),
    };
    let mut cache = manager.cache.lock().map_err(|e| e.to_string())?;
    *cache = Some(stats.clone());
    Ok(stats)
}

#[tauri::command]
pub fn boot_get_uptime() -> Result<u64, String> {
    Ok(get_uptime_seconds())
}
