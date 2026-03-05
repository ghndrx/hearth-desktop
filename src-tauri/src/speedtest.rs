//! Network Speed Test - Measure download/upload speeds natively
//!
//! Provides:
//! - Download speed measurement
//! - Upload speed measurement
//! - Latency measurement
//! - Speed test history
//! - Connection quality assessment

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResult {
    pub id: String,
    pub download_mbps: f64,
    pub upload_mbps: f64,
    pub latency_ms: f64,
    pub jitter_ms: f64,
    pub quality: String,
    pub server: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestState {
    pub history: Vec<SpeedTestResult>,
    pub is_running: bool,
    pub last_result: Option<SpeedTestResult>,
    pub average_download: f64,
    pub average_upload: f64,
    pub average_latency: f64,
}

impl Default for SpeedTestState {
    fn default() -> Self {
        Self {
            history: Vec::new(),
            is_running: false,
            last_result: None,
            average_download: 0.0,
            average_upload: 0.0,
            average_latency: 0.0,
        }
    }
}

pub struct SpeedTestManager {
    state: Mutex<SpeedTestState>,
}

impl Default for SpeedTestManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(SpeedTestState::default()),
        }
    }
}

fn assess_quality(download: f64, latency: f64) -> String {
    if download >= 100.0 && latency < 20.0 {
        "Excellent".to_string()
    } else if download >= 50.0 && latency < 50.0 {
        "Very Good".to_string()
    } else if download >= 25.0 && latency < 100.0 {
        "Good".to_string()
    } else if download >= 10.0 && latency < 200.0 {
        "Fair".to_string()
    } else {
        "Poor".to_string()
    }
}

fn update_averages(state: &mut SpeedTestState) {
    if state.history.is_empty() {
        return;
    }
    let count = state.history.len() as f64;
    state.average_download = state.history.iter().map(|r| r.download_mbps).sum::<f64>() / count;
    state.average_upload = state.history.iter().map(|r| r.upload_mbps).sum::<f64>() / count;
    state.average_latency = state.history.iter().map(|r| r.latency_ms).sum::<f64>() / count;
}

async fn measure_latency(url: &str) -> Result<(f64, f64), String> {
    let client = reqwest::Client::new();
    let mut latencies = Vec::new();

    for _ in 0..5 {
        let start = Instant::now();
        let _ = client
            .head(url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        latencies.push(start.elapsed().as_secs_f64() * 1000.0);
    }

    let avg = latencies.iter().sum::<f64>() / latencies.len() as f64;
    let mean = avg;
    let jitter = if latencies.len() > 1 {
        let variance =
            latencies.iter().map(|l| (l - mean).powi(2)).sum::<f64>() / (latencies.len() - 1) as f64;
        variance.sqrt()
    } else {
        0.0
    };

    Ok((avg, jitter))
}

async fn measure_download_speed(url: &str) -> Result<f64, String> {
    let client = reqwest::Client::new();
    let start = Instant::now();
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let elapsed = start.elapsed().as_secs_f64();

    if elapsed > 0.0 {
        let bits = bytes.len() as f64 * 8.0;
        Ok(bits / elapsed / 1_000_000.0)
    } else {
        Ok(0.0)
    }
}

async fn measure_upload_speed(url: &str) -> Result<f64, String> {
    let client = reqwest::Client::new();
    let payload = vec![0u8; 1_000_000]; // 1MB payload
    let start = Instant::now();
    let _ = client
        .post(url)
        .body(payload.clone())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let elapsed = start.elapsed().as_secs_f64();

    if elapsed > 0.0 {
        let bits = payload.len() as f64 * 8.0;
        Ok(bits / elapsed / 1_000_000.0)
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
pub async fn speedtest_run(
    manager: State<'_, SpeedTestManager>,
    app: AppHandle,
) -> Result<SpeedTestResult, String> {
    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        if state.is_running {
            return Err("Speed test already running".to_string());
        }
        state.is_running = true;
    }

    let _ = app.emit("speedtest-started", ());

    let test_server = "https://speed.cloudflare.com";
    let download_url = format!("{}/__down?bytes=10000000", test_server);
    let upload_url = format!("{}/__up", test_server);

    // Measure latency
    let _ = app.emit("speedtest-phase", "latency");
    let (latency, jitter) = match measure_latency(test_server).await {
        Ok(r) => r,
        Err(e) => {
            let mut state = manager.state.lock().map_err(|er| er.to_string())?;
            state.is_running = false;
            return Err(format!("Latency test failed: {}", e));
        }
    };

    // Measure download speed
    let _ = app.emit("speedtest-phase", "download");
    let download = match measure_download_speed(&download_url).await {
        Ok(s) => s,
        Err(_) => 0.0,
    };

    // Measure upload speed
    let _ = app.emit("speedtest-phase", "upload");
    let upload = match measure_upload_speed(&upload_url).await {
        Ok(s) => s,
        Err(_) => 0.0,
    };

    let quality = assess_quality(download, latency);

    let result = SpeedTestResult {
        id: uuid::Uuid::new_v4().to_string(),
        download_mbps: (download * 100.0).round() / 100.0,
        upload_mbps: (upload * 100.0).round() / 100.0,
        latency_ms: (latency * 100.0).round() / 100.0,
        jitter_ms: (jitter * 100.0).round() / 100.0,
        quality,
        server: test_server.to_string(),
        timestamp: Utc::now().to_rfc3339(),
    };

    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.is_running = false;
        state.last_result = Some(result.clone());
        state.history.push(result.clone());
        // Keep last 50 results
        if state.history.len() > 50 {
            state.history.remove(0);
        }
        update_averages(&mut state);
    }

    let _ = app.emit("speedtest-complete", &result);
    Ok(result)
}

#[tauri::command]
pub async fn speedtest_quick_latency(
    server: Option<String>,
) -> Result<f64, String> {
    let url = server.as_deref().unwrap_or("https://speed.cloudflare.com");
    let (latency, _) = measure_latency(url).await?;
    Ok((latency * 100.0).round() / 100.0)
}

#[tauri::command]
pub async fn speedtest_get_state(
    manager: State<'_, SpeedTestManager>,
) -> Result<SpeedTestState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub async fn speedtest_get_history(
    manager: State<'_, SpeedTestManager>,
) -> Result<Vec<SpeedTestResult>, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.history.clone())
}

#[tauri::command]
pub async fn speedtest_clear_history(
    manager: State<'_, SpeedTestManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.history.clear();
    state.last_result = None;
    state.average_download = 0.0;
    state.average_upload = 0.0;
    state.average_latency = 0.0;
    Ok(())
}

#[tauri::command]
pub async fn speedtest_is_running(
    manager: State<'_, SpeedTestManager>,
) -> Result<bool, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.is_running)
}
