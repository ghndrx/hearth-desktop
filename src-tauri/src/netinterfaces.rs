//! Network Interfaces - display and monitor network interface details

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    pub name: String,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub is_up: bool,
    pub interface_type: String, // "ethernet", "wifi", "loopback", "virtual"
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub mtu: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfacesInfo {
    pub interfaces: Vec<NetworkInterface>,
    pub timestamp: String,
    pub hostname: String,
    pub default_gateway: Option<String>,
}

fn classify_interface(name: &str) -> String {
    if name == "lo" {
        "loopback".into()
    } else if name.starts_with("wl") || name.starts_with("wifi") {
        "wifi".into()
    } else if name.starts_with("eth") || name.starts_with("en") {
        "ethernet".into()
    } else if name.starts_with("docker") || name.starts_with("br-") || name.starts_with("veth") || name.starts_with("virbr") {
        "virtual".into()
    } else {
        "other".into()
    }
}

fn parse_proc_net_dev() -> Vec<(String, u64, u64)> {
    let mut result = Vec::new();
    if let Ok(content) = std::fs::read_to_string("/proc/net/dev") {
        for line in content.lines().skip(2) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 10 {
                let name = parts[0].trim_end_matches(':').to_string();
                let rx = parts[1].parse::<u64>().unwrap_or(0);
                let tx = parts[9].parse::<u64>().unwrap_or(0);
                result.push((name, rx, tx));
            }
        }
    }
    result
}

fn get_ip_for_interface(name: &str) -> Option<String> {
    if let Ok(output) = Command::new("ip").args(["addr", "show", name]).output() {
        if let Ok(text) = String::from_utf8(output.stdout) {
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("inet ") && !trimmed.contains("inet6") {
                    if let Some(addr) = trimmed.split_whitespace().nth(1) {
                        return Some(addr.split('/').next().unwrap_or(addr).to_string());
                    }
                }
            }
        }
    }
    None
}

fn get_mac_for_interface(name: &str) -> Option<String> {
    let path = format!("/sys/class/net/{}/address", name);
    std::fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
}

fn get_mtu_for_interface(name: &str) -> Option<u32> {
    let path = format!("/sys/class/net/{}/mtu", name);
    std::fs::read_to_string(&path).ok().and_then(|s| s.trim().parse().ok())
}

fn is_interface_up(name: &str) -> bool {
    let path = format!("/sys/class/net/{}/operstate", name);
    std::fs::read_to_string(&path).ok().map(|s| s.trim() == "up").unwrap_or(false)
}

fn get_hostname() -> String {
    Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

fn get_default_gateway() -> Option<String> {
    if let Ok(output) = Command::new("ip").args(["route", "show", "default"]).output() {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Some(line) = text.lines().next() {
                // "default via 192.168.1.1 dev eth0"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 && parts[1] == "via" {
                    return Some(parts[2].to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn netinterfaces_scan() -> Result<NetworkInterfacesInfo, String> {
    let traffic = parse_proc_net_dev();
    let mut interfaces: Vec<NetworkInterface> = Vec::new();

    for (name, rx, tx) in &traffic {
        interfaces.push(NetworkInterface {
            name: name.clone(),
            ip_address: get_ip_for_interface(name),
            mac_address: get_mac_for_interface(name),
            is_up: is_interface_up(name),
            interface_type: classify_interface(name),
            rx_bytes: *rx,
            tx_bytes: *tx,
            mtu: get_mtu_for_interface(name),
        });
    }

    // Sort: up interfaces first, then by name
    interfaces.sort_by(|a, b| {
        b.is_up.cmp(&a.is_up).then(a.name.cmp(&b.name))
    });

    Ok(NetworkInterfacesInfo {
        interfaces,
        timestamp: chrono::Local::now().to_rfc3339(),
        hostname: get_hostname(),
        default_gateway: get_default_gateway(),
    })
}
