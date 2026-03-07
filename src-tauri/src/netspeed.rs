//! Network Speed Monitor - Real-time upload/download speed tracking
//!
//! Monitors network interface traffic and calculates current throughput
//! with rolling history for sparkline visualization.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::Networks;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetSpeedSnapshot {
    pub download_bytes_per_sec: u64,
    pub upload_bytes_per_sec: u64,
    pub total_received: u64,
    pub total_transmitted: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetSpeedState {
    pub current: NetSpeedSnapshot,
    pub history: Vec<NetSpeedSnapshot>,
    pub peak_download: u64,
    pub peak_upload: u64,
    pub session_downloaded: u64,
    pub session_uploaded: u64,
}

impl Default for NetSpeedState {
    fn default() -> Self {
        Self {
            current: NetSpeedSnapshot {
                download_bytes_per_sec: 0,
                upload_bytes_per_sec: 0,
                total_received: 0,
                total_transmitted: 0,
                timestamp: now_ms(),
            },
            history: Vec::new(),
            peak_download: 0,
            peak_upload: 0,
            session_downloaded: 0,
            session_uploaded: 0,
        }
    }
}

pub struct NetSpeedManager {
    state: Mutex<NetSpeedState>,
    prev_received: Mutex<u64>,
    prev_transmitted: Mutex<u64>,
    prev_timestamp: Mutex<u64>,
    networks: Mutex<Networks>,
}

impl Default for NetSpeedManager {
    fn default() -> Self {
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);
        let (rx, tx) = sum_network_bytes(&networks);
        let now = now_ms();
        Self {
            state: Mutex::new(NetSpeedState::default()),
            prev_received: Mutex::new(rx),
            prev_transmitted: Mutex::new(tx),
            prev_timestamp: Mutex::new(now),
            networks: Mutex::new(networks),
        }
    }
}

const MAX_HISTORY: usize = 60;

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn sum_network_bytes(networks: &Networks) -> (u64, u64) {
    let mut rx = 0u64;
    let mut tx = 0u64;
    for (_name, data) in networks.iter() {
        rx += data.total_received();
        tx += data.total_transmitted();
    }
    (rx, tx)
}

#[tauri::command]
pub fn netspeed_poll(
    manager: tauri::State<'_, NetSpeedManager>,
) -> Result<NetSpeedState, String> {
    let mut networks = manager.networks.lock().map_err(|e| e.to_string())?;
    networks.refresh(true);
    let (rx, tx) = sum_network_bytes(&networks);
    let now = now_ms();

    let mut prev_rx = manager.prev_received.lock().map_err(|e| e.to_string())?;
    let mut prev_tx = manager.prev_transmitted.lock().map_err(|e| e.to_string())?;
    let mut prev_ts = manager.prev_timestamp.lock().map_err(|e| e.to_string())?;

    let elapsed_ms = now.saturating_sub(*prev_ts).max(1);
    let elapsed_sec = elapsed_ms as f64 / 1000.0;

    let dl_bytes = rx.saturating_sub(*prev_rx);
    let ul_bytes = tx.saturating_sub(*prev_tx);
    let dl_per_sec = (dl_bytes as f64 / elapsed_sec) as u64;
    let ul_per_sec = (ul_bytes as f64 / elapsed_sec) as u64;

    *prev_rx = rx;
    *prev_tx = tx;
    *prev_ts = now;

    let snapshot = NetSpeedSnapshot {
        download_bytes_per_sec: dl_per_sec,
        upload_bytes_per_sec: ul_per_sec,
        total_received: rx,
        total_transmitted: tx,
        timestamp: now,
    };

    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.current = snapshot.clone();
    state.history.push(snapshot);
    if state.history.len() > MAX_HISTORY {
        state.history.remove(0);
    }
    if dl_per_sec > state.peak_download {
        state.peak_download = dl_per_sec;
    }
    if ul_per_sec > state.peak_upload {
        state.peak_upload = ul_per_sec;
    }
    state.session_downloaded += dl_bytes;
    state.session_uploaded += ul_bytes;

    Ok(state.clone())
}

#[tauri::command]
pub fn netspeed_get_state(
    manager: tauri::State<'_, NetSpeedManager>,
) -> Result<NetSpeedState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub fn netspeed_reset(
    manager: tauri::State<'_, NetSpeedManager>,
) -> Result<NetSpeedState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.history.clear();
    state.peak_download = 0;
    state.peak_upload = 0;
    state.session_downloaded = 0;
    state.session_uploaded = 0;
    Ok(state.clone())
}
