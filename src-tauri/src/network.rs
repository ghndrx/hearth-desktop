//! Network monitoring for the Hearth desktop app
//!
//! Provides connectivity detection and network change events:
//! - Online/offline status detection
//! - Network interface enumeration
//! - Periodic connectivity polling with event emission
//! - Latency measurement to a target host

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

static IS_ONLINE: AtomicBool = AtomicBool::new(true);
static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

/// Network status snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    /// Whether the system appears to be online
    pub is_online: bool,
    /// Network type hint (wifi, ethernet, unknown)
    pub network_type: String,
    /// Detected network interfaces
    pub interfaces: Vec<NetworkInterface>,
}

/// A detected network interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub is_up: bool,
    pub ip_addresses: Vec<String>,
}

/// Latency measurement result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyResult {
    pub host: String,
    pub latency_ms: Option<u64>,
    pub reachable: bool,
}

/// Get current network status
#[tauri::command]
pub fn get_network_status() -> NetworkStatus {
    let interfaces = get_interfaces();
    let online = !interfaces.is_empty() && interfaces.iter().any(|i| i.is_up && !i.ip_addresses.is_empty());

    IS_ONLINE.store(online, Ordering::Relaxed);

    let network_type = detect_network_type(&interfaces);

    NetworkStatus {
        is_online: online,
        network_type,
        interfaces,
    }
}

/// Check if system is currently online
#[tauri::command]
pub fn is_online() -> bool {
    IS_ONLINE.load(Ordering::Relaxed)
}

/// Measure latency to a host via TCP connect
#[tauri::command]
pub async fn measure_latency(host: String) -> Result<LatencyResult, String> {
    use std::net::ToSocketAddrs;
    use std::time::Instant;

    let addr_str = if host.contains(':') {
        host.clone()
    } else {
        format!("{}:443", host)
    };

    let addr = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolution failed: {}", e))?
        .next()
        .ok_or_else(|| "No address resolved".to_string())?;

    let start = Instant::now();
    match tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(addr),
    )
    .await
    {
        Ok(Ok(_stream)) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok(LatencyResult {
                host,
                latency_ms: Some(elapsed),
                reachable: true,
            })
        }
        _ => Ok(LatencyResult {
            host,
            latency_ms: None,
            reachable: false,
        }),
    }
}

/// Start background network monitoring that emits events on change
#[tauri::command]
pub fn start_network_monitor(app: AppHandle) -> Result<(), String> {
    if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    tauri::async_runtime::spawn(async move {
        let mut last_online = IS_ONLINE.load(Ordering::Relaxed);

        loop {
            if !MONITOR_RUNNING.load(Ordering::Relaxed) {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            let status = get_network_status();
            let current_online = status.is_online;

            if current_online != last_online {
                log::info!(
                    "Network status changed: {} -> {}",
                    if last_online { "online" } else { "offline" },
                    if current_online { "online" } else { "offline" }
                );

                let _ = app.emit("network:status-changed", &status);
                last_online = current_online;
            }
        }

        log::info!("Network monitor stopped");
    });

    Ok(())
}

/// Stop the background network monitor
#[tauri::command]
pub fn stop_network_monitor() -> Result<(), String> {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

// =============================================================================
// Platform-specific helpers
// =============================================================================

#[cfg(target_os = "linux")]
fn get_interfaces() -> Vec<NetworkInterface> {
    use std::fs;

    let mut interfaces = Vec::new();

    if let Ok(entries) = fs::read_dir("/sys/class/net") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip loopback
            if name == "lo" {
                continue;
            }

            let operstate_path = format!("/sys/class/net/{}/operstate", name);
            let is_up = fs::read_to_string(&operstate_path)
                .map(|s| s.trim() == "up")
                .unwrap_or(false);

            // Get IP addresses via ip command
            let ip_addresses = get_ip_addresses_linux(&name);

            interfaces.push(NetworkInterface {
                name,
                is_up,
                ip_addresses,
            });
        }
    }

    interfaces
}

#[cfg(target_os = "linux")]
fn get_ip_addresses_linux(iface: &str) -> Vec<String> {
    use std::process::Command;

    let output = Command::new("ip")
        .args(["-o", "-4", "addr", "show", iface])
        .output();

    let mut addrs = Vec::new();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            // Format: 2: eth0    inet 192.168.1.100/24 ...
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 && parts[2] == "inet" {
                if let Some(ip) = parts[3].split('/').next() {
                    addrs.push(ip.to_string());
                }
            }
        }
    }

    addrs
}

#[cfg(target_os = "macos")]
fn get_interfaces() -> Vec<NetworkInterface> {
    use std::process::Command;

    let mut interfaces = Vec::new();

    let output = Command::new("ifconfig").output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        let mut current_name = String::new();
        let mut current_up = false;
        let mut current_ips = Vec::new();

        for line in text.lines() {
            if !line.starts_with('\t') && !line.starts_with(' ') && line.contains(':') {
                // Save previous interface
                if !current_name.is_empty() && current_name != "lo0" {
                    interfaces.push(NetworkInterface {
                        name: current_name.clone(),
                        is_up: current_up,
                        ip_addresses: current_ips.clone(),
                    });
                }

                current_name = line.split(':').next().unwrap_or("").to_string();
                current_up = line.contains("UP");
                current_ips = Vec::new();
            } else if line.contains("inet ") && !line.contains("inet6") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    current_ips.push(parts[1].to_string());
                }
            }
        }

        // Don't forget last interface
        if !current_name.is_empty() && current_name != "lo0" {
            interfaces.push(NetworkInterface {
                name: current_name,
                is_up: current_up,
                ip_addresses: current_ips,
            });
        }
    }

    interfaces
}

#[cfg(target_os = "windows")]
fn get_interfaces() -> Vec<NetworkInterface> {
    use std::process::Command;

    let mut interfaces = Vec::new();

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -or $_.Status -eq 'Disconnected' } | ForEach-Object { $name = $_.Name; $status = $_.Status; $ips = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress) -join ','; "$name|$status|$ips" }"#,
        ])
        .output();

    if let Ok(output) = output {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                let ip_addresses: Vec<String> = parts[2]
                    .split(',')
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .collect();

                interfaces.push(NetworkInterface {
                    name: parts[0].to_string(),
                    is_up: parts[1] == "Up",
                    ip_addresses,
                });
            }
        }
    }

    interfaces
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn get_interfaces() -> Vec<NetworkInterface> {
    Vec::new()
}

fn detect_network_type(interfaces: &[NetworkInterface]) -> String {
    for iface in interfaces {
        if !iface.is_up || iface.ip_addresses.is_empty() {
            continue;
        }
        let name = iface.name.to_lowercase();
        if name.starts_with("wl") || name.contains("wifi") || name.contains("wi-fi") {
            return "wifi".to_string();
        }
        if name.starts_with("eth") || name.starts_with("en") || name.contains("ethernet") {
            return "ethernet".to_string();
        }
    }
    "unknown".to_string()
}
