use serde::{Deserialize, Serialize};
use std::net::ToSocketAddrs;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsResult {
    pub hostname: String,
    pub addresses: Vec<String>,
    pub record_count: usize,
    pub elapsed_ms: u64,
    pub timestamp: String,
}

pub struct DnsLookupManager {
    history: Mutex<Vec<DnsResult>>,
}

impl Default for DnsLookupManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn dns_lookup(
    manager: tauri::State<'_, DnsLookupManager>,
    hostname: String,
) -> Result<DnsResult, String> {
    let hostname = hostname.trim().to_string();
    if hostname.is_empty() {
        return Err("Hostname cannot be empty".into());
    }

    // Validate hostname format (basic check)
    if hostname.contains(' ') || hostname.contains("..") {
        return Err("Invalid hostname format".into());
    }

    let addr = format!("{}:0", hostname);
    let start = std::time::Instant::now();

    let addresses: Vec<String> = addr
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolution failed: {}", e))?
        .map(|a| a.ip().to_string())
        .collect();

    let elapsed_ms = start.elapsed().as_millis() as u64;

    if addresses.is_empty() {
        return Err("No DNS records found".into());
    }

    // Deduplicate addresses
    let mut unique: Vec<String> = addresses;
    unique.sort();
    unique.dedup();

    let result = DnsResult {
        hostname: hostname.clone(),
        record_count: unique.len(),
        addresses: unique,
        elapsed_ms,
        timestamp: chrono::Local::now().to_rfc3339(),
    };

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn dns_reverse_lookup(
    hostname: String,
) -> Result<Vec<String>, String> {
    let ip: std::net::IpAddr = hostname
        .trim()
        .parse()
        .map_err(|e| format!("Invalid IP address: {}", e))?;

    let addr = std::net::SocketAddr::new(ip, 0);

    // Reverse lookup via socket addr isn't directly supported in std,
    // so we return the IP canonical form and PTR-style name
    let mut results = vec![ip.to_string()];

    // Generate PTR record name
    match ip {
        std::net::IpAddr::V4(v4) => {
            let octets = v4.octets();
            results.push(format!(
                "{}.{}.{}.{}.in-addr.arpa",
                octets[3], octets[2], octets[1], octets[0]
            ));
        }
        std::net::IpAddr::V6(v6) => {
            let segments = v6.segments();
            let nibbles: Vec<String> = segments
                .iter()
                .rev()
                .flat_map(|s| {
                    let bytes = s.to_be_bytes();
                    vec![
                        format!("{:x}", bytes[1] & 0x0f),
                        format!("{:x}", (bytes[1] >> 4) & 0x0f),
                        format!("{:x}", bytes[0] & 0x0f),
                        format!("{:x}", (bytes[0] >> 4) & 0x0f),
                    ]
                })
                .collect();
            results.push(format!("{}.ip6.arpa", nibbles.join(".")));
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn dns_get_history(
    manager: tauri::State<'_, DnsLookupManager>,
) -> Result<Vec<DnsResult>, String> {
    let history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    Ok(history.clone())
}

#[tauri::command]
pub fn dns_clear_history(
    manager: tauri::State<'_, DnsLookupManager>,
) -> Result<(), String> {
    let mut history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    history.clear();
    Ok(())
}
