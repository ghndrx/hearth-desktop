use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortResult {
    pub port: u16,
    pub open: bool,
    pub service: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub host: String,
    pub ports: Vec<PortResult>,
    pub open_count: usize,
    pub scanned_count: usize,
    pub duration_ms: u64,
}

fn well_known_service(port: u16) -> &'static str {
    match port {
        20 | 21 => "FTP",
        22 => "SSH",
        23 => "Telnet",
        25 => "SMTP",
        53 => "DNS",
        80 => "HTTP",
        110 => "POP3",
        143 => "IMAP",
        443 => "HTTPS",
        445 => "SMB",
        993 => "IMAPS",
        995 => "POP3S",
        1433 => "MSSQL",
        3306 => "MySQL",
        3389 => "RDP",
        5432 => "PostgreSQL",
        5672 => "AMQP",
        6379 => "Redis",
        8080 => "HTTP-Alt",
        8443 => "HTTPS-Alt",
        9200 => "Elasticsearch",
        27017 => "MongoDB",
        _ => "",
    }
}

#[tauri::command]
pub async fn portscan_scan(
    host: Option<String>,
    ports: Option<Vec<u16>>,
    timeout_ms: Option<u64>,
) -> Result<ScanResult, String> {
    let host = host.unwrap_or_else(|| "127.0.0.1".into());
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(200));
    let start = std::time::Instant::now();

    // Only allow scanning localhost or private IPs for safety
    let is_safe = host == "127.0.0.1"
        || host == "localhost"
        || host == "::1"
        || host.starts_with("192.168.")
        || host.starts_with("10.")
        || host.starts_with("172.16.")
        || host.starts_with("172.17.")
        || host.starts_with("172.18.")
        || host.starts_with("172.19.")
        || host.starts_with("172.2")
        || host.starts_with("172.3");

    if !is_safe {
        return Err("Only localhost and private network IPs are allowed".into());
    }

    let ports_to_scan = ports.unwrap_or_else(|| {
        vec![
            21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3000, 3306, 3389, 4200,
            5000, 5432, 5672, 5900, 6379, 8000, 8080, 8443, 8888, 9090, 9200, 27017,
        ]
    });

    let mut results = Vec::new();
    for &port in &ports_to_scan {
        let addr_str = format!("{}:{}", host, port);
        let port_start = std::time::Instant::now();

        let open = match addr_str.parse::<SocketAddr>() {
            Ok(addr) => TcpStream::connect_timeout(&addr, timeout).is_ok(),
            Err(_) => {
                // Try resolving hostname
                match std::net::ToSocketAddrs::to_socket_addrs(&addr_str) {
                    Ok(mut addrs) => {
                        if let Some(addr) = addrs.next() {
                            TcpStream::connect_timeout(&addr, timeout).is_ok()
                        } else {
                            false
                        }
                    }
                    Err(_) => false,
                }
            }
        };

        results.push(PortResult {
            port,
            open,
            service: well_known_service(port).to_string(),
            latency_ms: port_start.elapsed().as_millis() as u64,
        });
    }

    let open_count = results.iter().filter(|r| r.open).count();

    Ok(ScanResult {
        host,
        ports: results,
        open_count,
        scanned_count: ports_to_scan.len(),
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn portscan_check_port(
    host: Option<String>,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<PortResult, String> {
    let host = host.unwrap_or_else(|| "127.0.0.1".into());
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(500));
    let start = std::time::Instant::now();

    let addr_str = format!("{}:{}", host, port);
    let open = match addr_str.parse::<SocketAddr>() {
        Ok(addr) => TcpStream::connect_timeout(&addr, timeout).is_ok(),
        Err(_) => false,
    };

    Ok(PortResult {
        port,
        open,
        service: well_known_service(port).to_string(),
        latency_ms: start.elapsed().as_millis() as u64,
    })
}
