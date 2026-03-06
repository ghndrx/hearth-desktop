//! Network Diagnostics - Ping, DNS lookup, and connection testing for Hearth Desktop
//!
//! Provides:
//! - Ping hosts with round-trip time measurement
//! - DNS resolution with timing
//! - Port connectivity testing
//! - Network route information

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    pub host: String,
    pub ip: String,
    pub rtt_ms: f64,
    pub ttl: u32,
    pub success: bool,
    pub error: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsResult {
    pub hostname: String,
    pub addresses: Vec<String>,
    pub resolve_time_ms: f64,
    pub success: bool,
    pub error: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortCheckResult {
    pub host: String,
    pub port: u16,
    pub open: bool,
    pub response_time_ms: f64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagHistory {
    pub pings: Vec<PingResult>,
    pub dns_lookups: Vec<DnsResult>,
}

pub struct NetworkDiagManager {
    history: Mutex<DiagHistory>,
}

impl Default for NetworkDiagManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(DiagHistory {
                pings: Vec::new(),
                dns_lookups: Vec::new(),
            }),
        }
    }
}

#[tauri::command]
pub async fn netdiag_ping(
    state: State<'_, NetworkDiagManager>,
    host: String,
) -> Result<PingResult, String> {
    let start = std::time::Instant::now();

    // Use system ping command for cross-platform compatibility
    let output = tokio::process::Command::new("ping")
        .args({
            #[cfg(target_os = "windows")]
            { vec!["-n", "1", "-w", "3000", &host] }
            #[cfg(not(target_os = "windows"))]
            { vec!["-c", "1", "-W", "3", &host] }
        })
        .output()
        .await
        .map_err(|e| format!("Failed to execute ping: {}", e))?;

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let success = output.status.success();

    // Extract IP and TTL from output
    let ip = extract_ip_from_ping(&stdout).unwrap_or_else(|| host.clone());
    let ttl = extract_ttl_from_ping(&stdout).unwrap_or(0);
    let rtt = extract_rtt_from_ping(&stdout).unwrap_or(elapsed);

    let result = PingResult {
        host: host.clone(),
        ip,
        rtt_ms: (rtt * 100.0).round() / 100.0,
        ttl,
        success,
        error: if success { None } else { Some(String::from_utf8_lossy(&output.stderr).to_string()) },
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    // Store in history
    if let Ok(mut history) = state.history.lock() {
        history.pings.push(result.clone());
        if history.pings.len() > 100 {
            history.pings.remove(0);
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn netdiag_dns_lookup(
    state: State<'_, NetworkDiagManager>,
    hostname: String,
) -> Result<DnsResult, String> {
    let start = std::time::Instant::now();

    let result = tokio::net::lookup_host(format!("{}:0", hostname)).await;
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    let dns_result = match result {
        Ok(addrs) => {
            let addresses: Vec<String> = addrs.map(|a| a.ip().to_string()).collect();
            DnsResult {
                hostname: hostname.clone(),
                addresses,
                resolve_time_ms: (elapsed * 100.0).round() / 100.0,
                success: true,
                error: None,
                timestamp: chrono::Utc::now().to_rfc3339(),
            }
        }
        Err(e) => DnsResult {
            hostname: hostname.clone(),
            addresses: Vec::new(),
            resolve_time_ms: (elapsed * 100.0).round() / 100.0,
            success: false,
            error: Some(e.to_string()),
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
    };

    if let Ok(mut history) = state.history.lock() {
        history.dns_lookups.push(dns_result.clone());
        if history.dns_lookups.len() > 100 {
            history.dns_lookups.remove(0);
        }
    }

    Ok(dns_result)
}

#[tauri::command]
pub async fn netdiag_check_port(
    host: String,
    port: u16,
) -> Result<PortCheckResult, String> {
    let start = std::time::Instant::now();
    let addr = format!("{}:{}", host, port);

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await;

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    match result {
        Ok(Ok(_stream)) => Ok(PortCheckResult {
            host,
            port,
            open: true,
            response_time_ms: (elapsed * 100.0).round() / 100.0,
            error: None,
        }),
        Ok(Err(e)) => Ok(PortCheckResult {
            host,
            port,
            open: false,
            response_time_ms: (elapsed * 100.0).round() / 100.0,
            error: Some(e.to_string()),
        }),
        Err(_) => Ok(PortCheckResult {
            host,
            port,
            open: false,
            response_time_ms: (elapsed * 100.0).round() / 100.0,
            error: Some("Connection timed out".to_string()),
        }),
    }
}

#[tauri::command]
pub fn netdiag_get_history(
    state: State<'_, NetworkDiagManager>,
) -> Result<DiagHistory, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}

#[tauri::command]
pub fn netdiag_clear_history(
    state: State<'_, NetworkDiagManager>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.pings.clear();
    history.dns_lookups.clear();
    Ok(())
}

// Helper functions to parse ping output
fn extract_ip_from_ping(output: &str) -> Option<String> {
    // Look for IP in parentheses like "PING host (1.2.3.4)"
    if let Some(start) = output.find('(') {
        if let Some(end) = output[start..].find(')') {
            let ip = &output[start + 1..start + end];
            if ip.contains('.') || ip.contains(':') {
                return Some(ip.to_string());
            }
        }
    }
    None
}

fn extract_ttl_from_ping(output: &str) -> Option<u32> {
    let lower = output.to_lowercase();
    if let Some(pos) = lower.find("ttl=") {
        let after = &output[pos + 4..];
        let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        return num.parse().ok();
    }
    None
}

fn extract_rtt_from_ping(output: &str) -> Option<f64> {
    let lower = output.to_lowercase();
    // Linux: "time=X.XX ms"
    if let Some(pos) = lower.find("time=") {
        let after = &output[pos + 5..];
        let num: String = after.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
        return num.parse().ok();
    }
    None
}
