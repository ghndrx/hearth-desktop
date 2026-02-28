use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use once_cell::sync::Lazy;
use tauri::AppHandle;

/// Tracks network bandwidth usage for the current session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthStats {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub session_start: u64,
    pub peak_download_rate: u64,
    pub peak_upload_rate: u64,
    pub current_download_rate: u64,
    pub current_upload_rate: u64,
}

static BYTES_SENT: AtomicU64 = AtomicU64::new(0);
static BYTES_RECEIVED: AtomicU64 = AtomicU64::new(0);
static PEAK_DOWN: AtomicU64 = AtomicU64::new(0);
static PEAK_UP: AtomicU64 = AtomicU64::new(0);
static CURRENT_DOWN: AtomicU64 = AtomicU64::new(0);
static CURRENT_UP: AtomicU64 = AtomicU64::new(0);

static SESSION_START: Lazy<u64> = Lazy::new(|| {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
});

static MONITOR_RUNNING: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Record bytes sent (called from frontend when sending messages/uploads)
#[tauri::command]
pub fn bandwidth_record_sent(bytes: u64) {
    BYTES_SENT.fetch_add(bytes, Ordering::Relaxed);
}

/// Record bytes received (called from frontend when receiving messages/downloads)
#[tauri::command]
pub fn bandwidth_record_received(bytes: u64) {
    BYTES_RECEIVED.fetch_add(bytes, Ordering::Relaxed);
}

/// Get current bandwidth statistics
#[tauri::command]
pub fn bandwidth_get_stats() -> BandwidthStats {
    let _ = *SESSION_START; // ensure initialized
    BandwidthStats {
        bytes_sent: BYTES_SENT.load(Ordering::Relaxed),
        bytes_received: BYTES_RECEIVED.load(Ordering::Relaxed),
        session_start: *SESSION_START,
        peak_download_rate: PEAK_DOWN.load(Ordering::Relaxed),
        peak_upload_rate: PEAK_UP.load(Ordering::Relaxed),
        current_download_rate: CURRENT_DOWN.load(Ordering::Relaxed),
        current_upload_rate: CURRENT_UP.load(Ordering::Relaxed),
    }
}

/// Reset bandwidth counters
#[tauri::command]
pub fn bandwidth_reset() {
    BYTES_SENT.store(0, Ordering::Relaxed);
    BYTES_RECEIVED.store(0, Ordering::Relaxed);
    PEAK_DOWN.store(0, Ordering::Relaxed);
    PEAK_UP.store(0, Ordering::Relaxed);
    CURRENT_DOWN.store(0, Ordering::Relaxed);
    CURRENT_UP.store(0, Ordering::Relaxed);
}

/// Start the system-level bandwidth monitor that reads from /proc/net/dev (Linux)
/// or netstat (macOS/Windows) to track rates
#[tauri::command]
pub fn bandwidth_start_monitor(app: AppHandle) -> Result<(), String> {
    if MONITOR_RUNNING.load(Ordering::Relaxed) {
        return Ok(());
    }
    MONITOR_RUNNING.store(true, Ordering::Relaxed);

    tauri::async_runtime::spawn(async move {
        let mut prev_rx: u64 = 0;
        let mut prev_tx: u64 = 0;
        let mut first = true;

        while MONITOR_RUNNING.load(Ordering::Relaxed) {
            if let Ok((rx, tx)) = read_system_bytes() {
                if !first {
                    let dl_rate = rx.saturating_sub(prev_rx);
                    let ul_rate = tx.saturating_sub(prev_tx);
                    CURRENT_DOWN.store(dl_rate, Ordering::Relaxed);
                    CURRENT_UP.store(ul_rate, Ordering::Relaxed);

                    let peak_dl = PEAK_DOWN.load(Ordering::Relaxed);
                    if dl_rate > peak_dl {
                        PEAK_DOWN.store(dl_rate, Ordering::Relaxed);
                    }
                    let peak_ul = PEAK_UP.load(Ordering::Relaxed);
                    if ul_rate > peak_ul {
                        PEAK_UP.store(ul_rate, Ordering::Relaxed);
                    }
                }
                prev_rx = rx;
                prev_tx = tx;
                first = false;
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });

    Ok(())
}

/// Stop the bandwidth monitor
#[tauri::command]
pub fn bandwidth_stop_monitor() {
    MONITOR_RUNNING.store(false, Ordering::Relaxed);
}

/// Read total bytes rx/tx from the OS
fn read_system_bytes() -> Result<(u64, u64), String> {
    #[cfg(target_os = "linux")]
    {
        let contents = std::fs::read_to_string("/proc/net/dev")
            .map_err(|e| e.to_string())?;
        let mut total_rx: u64 = 0;
        let mut total_tx: u64 = 0;

        for line in contents.lines().skip(2) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 10 {
                let iface = parts[0].trim_end_matches(':');
                if iface == "lo" {
                    continue;
                }
                if let Ok(rx) = parts[1].parse::<u64>() {
                    total_rx += rx;
                }
                if let Ok(tx) = parts[9].parse::<u64>() {
                    total_tx += tx;
                }
            }
        }
        Ok((total_rx, total_tx))
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("netstat")
            .args(["-ib"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut total_rx: u64 = 0;
        let mut total_tx: u64 = 0;

        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 7 && parts[0] != "lo0" {
                if let Ok(rx) = parts[6].parse::<u64>() {
                    total_rx += rx;
                }
                if parts.len() >= 10 {
                    if let Ok(tx) = parts[9].parse::<u64>() {
                        total_tx += tx;
                    }
                }
            }
        }
        Ok((total_rx, total_tx))
    }

    #[cfg(target_os = "windows")]
    {
        // Use sysinfo crate for cross-platform network stats
        use sysinfo::Networks;
        let networks = Networks::new_with_refreshed_list();
        let mut total_rx: u64 = 0;
        let mut total_tx: u64 = 0;
        for (_name, data) in &networks {
            total_rx += data.total_received();
            total_tx += data.total_transmitted();
        }
        Ok((total_rx, total_tx))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Bandwidth monitoring not supported on this platform".to_string())
    }
}
