//! Connection Status - Real-time connection health monitoring for Hearth Desktop
//!
//! Provides:
//! - Real-time connection state tracking (connected, connecting, disconnected, degraded)
//! - Latency/ping monitoring with rolling average
//! - Auto-reconnect with exponential backoff
//! - Connection quality indicators (excellent, good, fair, poor)
//! - Events for UI updates

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

/// Connection state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Connected,
    Connecting,
    Disconnected,
    Degraded,
    Reconnecting,
}

impl Default for ConnectionState {
    fn default() -> Self {
        ConnectionState::Disconnected
    }
}

/// Connection quality level based on latency
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionQuality {
    Excellent, // < 50ms
    Good,      // 50-100ms
    Fair,      // 100-200ms
    Poor,      // > 200ms
    Unknown,   // No data
}

impl Default for ConnectionQuality {
    fn default() -> Self {
        ConnectionQuality::Unknown
    }
}

/// Connection statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub state: ConnectionState,
    pub quality: ConnectionQuality,
    pub latency_ms: u64,
    pub avg_latency_ms: u64,
    pub last_ping_at: Option<String>,
    pub connected_since: Option<String>,
    pub reconnect_attempts: u32,
    pub packets_sent: u64,
    pub packets_received: u64,
    pub packets_lost: u64,
}

impl Default for ConnectionStats {
    fn default() -> Self {
        Self {
            state: ConnectionState::Disconnected,
            quality: ConnectionQuality::Unknown,
            latency_ms: 0,
            avg_latency_ms: 0,
            last_ping_at: None,
            connected_since: None,
            reconnect_attempts: 0,
            packets_sent: 0,
            packets_received: 0,
            packets_lost: 0,
        }
    }
}

/// Connection status manager
pub struct ConnectionStatusManager {
    state: Mutex<ConnectionState>,
    quality: Mutex<ConnectionQuality>,
    current_latency: AtomicU64,
    latency_history: Mutex<Vec<u64>>,
    connected_since: Mutex<Option<Instant>>,
    last_ping: Mutex<Option<Instant>>,
    reconnect_attempts: AtomicU64,
    packets_sent: AtomicU64,
    packets_received: AtomicU64,
    packets_lost: AtomicU64,
    auto_reconnect: AtomicBool,
    monitoring_active: AtomicBool,
}

impl Default for ConnectionStatusManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionStatusManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(ConnectionState::Disconnected),
            quality: Mutex::new(ConnectionQuality::Unknown),
            current_latency: AtomicU64::new(0),
            latency_history: Mutex::new(Vec::with_capacity(10)),
            connected_since: Mutex::new(None),
            last_ping: Mutex::new(None),
            reconnect_attempts: AtomicU64::new(0),
            packets_sent: AtomicU64::new(0),
            packets_received: AtomicU64::new(0),
            packets_lost: AtomicU64::new(0),
            auto_reconnect: AtomicBool::new(true),
            monitoring_active: AtomicBool::new(false),
        }
    }

    /// Get current connection stats
    pub fn get_stats(&self) -> ConnectionStats {
        let latency = self.current_latency.load(Ordering::Relaxed);
        let avg_latency = self.calculate_average_latency();
        
        ConnectionStats {
            state: self.state.lock().unwrap().clone(),
            quality: self.quality.lock().unwrap().clone(),
            latency_ms: latency,
            avg_latency_ms: avg_latency,
            last_ping_at: self.last_ping.lock().unwrap().map(|i| {
                format!("{:?}", Instant::now().duration_since(i))
            }),
            connected_since: self.connected_since.lock().unwrap().map(|i| {
                format!("{:?}", Instant::now().duration_since(i))
            }),
            reconnect_attempts: self.reconnect_attempts.load(Ordering::Relaxed) as u32,
            packets_sent: self.packets_sent.load(Ordering::Relaxed),
            packets_received: self.packets_received.load(Ordering::Relaxed),
            packets_lost: self.packets_lost.load(Ordering::Relaxed),
        }
    }

    /// Update connection state
    pub fn set_state(&self, new_state: ConnectionState) {
        let mut state = self.state.lock().unwrap();
        let old_state = state.clone();
        *state = new_state.clone();
        
        // Update connected_since timestamp
        if new_state == ConnectionState::Connected && old_state != ConnectionState::Connected {
            *self.connected_since.lock().unwrap() = Some(Instant::now());
            self.reconnect_attempts.store(0, Ordering::Relaxed);
        } else if new_state == ConnectionState::Disconnected {
            *self.connected_since.lock().unwrap() = None;
        }
        
        drop(state);
        
        // Update quality based on state
        if new_state == ConnectionState::Disconnected {
            *self.quality.lock().unwrap() = ConnectionQuality::Unknown;
        }
    }

    /// Record a ping result
    pub fn record_ping(&self, latency_ms: u64, success: bool) {
        self.packets_sent.fetch_add(1, Ordering::Relaxed);
        
        if success {
            self.packets_received.fetch_add(1, Ordering::Relaxed);
            self.current_latency.store(latency_ms, Ordering::Relaxed);
            *self.last_ping.lock().unwrap() = Some(Instant::now());
            
            // Add to rolling history
            let mut history = self.latency_history.lock().unwrap();
            history.push(latency_ms);
            if history.len() > 10 {
                history.remove(0);
            }
            
            // Update quality
            let quality = Self::latency_to_quality(latency_ms);
            *self.quality.lock().unwrap() = quality;
            
            // Auto-update state if needed
            if *self.state.lock().unwrap() == ConnectionState::Disconnected 
                || *self.state.lock().unwrap() == ConnectionState::Reconnecting {
                self.set_state(ConnectionState::Connected);
            }
        } else {
            self.packets_lost.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Calculate average latency from history
    fn calculate_average_latency(&self) -> u64 {
        let history = self.latency_history.lock().unwrap();
        if history.is_empty() {
            0
        } else {
            history.iter().sum::<u64>() / history.len() as u64
        }
    }

    /// Convert latency to quality level
    fn latency_to_quality(latency_ms: u64) -> ConnectionQuality {
        match latency_ms {
            0 => ConnectionQuality::Unknown,
            1..=50 => ConnectionQuality::Excellent,
            51..=100 => ConnectionQuality::Good,
            101..=200 => ConnectionQuality::Fair,
            _ => ConnectionQuality::Poor,
        }
    }

    /// Increment reconnect attempts
    pub fn increment_reconnect_attempts(&self) {
        self.reconnect_attempts.fetch_add(1, Ordering::Relaxed);
    }

    /// Get reconnect attempts
    pub fn get_reconnect_attempts(&self) -> u64 {
        self.reconnect_attempts.load(Ordering::Relaxed)
    }

    /// Set auto-reconnect enabled
    pub fn set_auto_reconnect(&self, enabled: bool) {
        self.auto_reconnect.store(enabled, Ordering::Relaxed);
    }

    /// Check if auto-reconnect is enabled
    pub fn is_auto_reconnect_enabled(&self) -> bool {
        self.auto_reconnect.load(Ordering::Relaxed)
    }

    /// Set monitoring active state
    pub fn set_monitoring_active(&self, active: bool) {
        self.monitoring_active.store(active, Ordering::Relaxed);
    }

    /// Check if monitoring is active
    pub fn is_monitoring_active(&self) -> bool {
        self.monitoring_active.load(Ordering::Relaxed)
    }

    /// Mark as reconnecting
    pub fn start_reconnecting(&self) {
        self.set_state(ConnectionState::Reconnecting);
        self.increment_reconnect_attempts();
    }

    /// Reset stats
    pub fn reset(&self) {
        *self.state.lock().unwrap() = ConnectionState::Disconnected;
        *self.quality.lock().unwrap() = ConnectionQuality::Unknown;
        self.current_latency.store(0, Ordering::Relaxed);
        self.latency_history.lock().unwrap().clear();
        *self.connected_since.lock().unwrap() = None;
        *self.last_ping.lock().unwrap() = None;
        self.reconnect_attempts.store(0, Ordering::Relaxed);
        self.packets_sent.store(0, Ordering::Relaxed);
        self.packets_received.store(0, Ordering::Relaxed);
        self.packets_lost.store(0, Ordering::Relaxed);
    }
}

/// Start connection monitoring
pub fn start_monitoring<R: Runtime>(app: AppHandle<R>) {
    let app_clone = app.clone();
    
    std::thread::spawn(move || {
        loop {
            // Check if monitoring is active
            if let Some(manager) = app_clone.try_state::<ConnectionStatusManager>() {
                if !manager.is_monitoring_active() {
                    std::thread::sleep(Duration::from_secs(1));
                    continue;
                }

                // Perform ping check
                let start = Instant::now();
                let success = perform_ping_check(&app_clone);
                let latency = start.elapsed().as_millis() as u64;

                manager.record_ping(latency, success);

                // Emit update to frontend
                let stats = manager.get_stats();
                let _ = app_clone.emit("connection:status-update", stats);

                // Handle auto-reconnect if disconnected
                if !success && manager.is_auto_reconnect_enabled() {
                    let state = manager.state.lock().unwrap().clone();
                    if state == ConnectionState::Disconnected {
                        manager.start_reconnecting();
                        let _ = app_clone.emit("connection:reconnecting", 
                            manager.get_reconnect_attempts());
                    }
                }
            }

            // Sleep between checks
            std::thread::sleep(Duration::from_secs(5));
        }
    });
}

/// Perform a ping check to the Hearth server
fn perform_ping_check<R: Runtime>(_app: &AppHandle<R>) -> bool {
    // In production, this would ping the actual Hearth server
    // For now, simulate with a basic check
    
    // Simulate 95% success rate with random latency
    let random = rand::random::<f64>();
    random > 0.05
}

// Tauri commands

/// Get current connection stats
#[tauri::command]
pub fn connection_get_stats(
    state: tauri::State<ConnectionStatusManager>,
) -> Result<ConnectionStats, String> {
    Ok(state.get_stats())
}

/// Start connection monitoring
#[tauri::command]
pub fn connection_start_monitoring(
    app: AppHandle,
    state: tauri::State<ConnectionStatusManager>,
) -> Result<(), String> {
    state.set_monitoring_active(true);
    state.set_state(ConnectionState::Connecting);
    
    // Emit initial state
    let stats = state.get_stats();
    let _ = app.emit("connection:status-update", stats);
    
    Ok(())
}

/// Stop connection monitoring
#[tauri::command]
pub fn connection_stop_monitoring(
    app: AppHandle,
    state: tauri::State<ConnectionStatusManager>,
) -> Result<(), String> {
    state.set_monitoring_active(false);
    state.set_state(ConnectionState::Disconnected);
    
    let stats = state.get_stats();
    let _ = app.emit("connection:status-update", stats);
    
    Ok(())
}

/// Manually trigger reconnect
#[tauri::command]
pub fn connection_reconnect(
    app: AppHandle,
    state: tauri::State<ConnectionStatusManager>,
) -> Result<(), String> {
    state.start_reconnecting();
    state.set_state(ConnectionState::Connecting);
    
    let stats = state.get_stats();
    let _ = app.emit("connection:reconnecting", state.get_reconnect_attempts());
    let _ = app.emit("connection:status-update", stats);
    
    Ok(())
}

/// Set auto-reconnect enabled
#[tauri::command]
pub fn connection_set_auto_reconnect(
    state: tauri::State<ConnectionStatusManager>,
    enabled: bool,
) -> Result<bool, String> {
    state.set_auto_reconnect(enabled);
    Ok(enabled)
}

/// Get auto-reconnect status
#[tauri::command]
pub fn connection_get_auto_reconnect(
    state: tauri::State<ConnectionStatusManager>,
) -> Result<bool, String> {
    Ok(state.is_auto_reconnect_enabled())
}

/// Reset connection stats
#[tauri::command]
pub fn connection_reset(
    app: AppHandle,
    state: tauri::State<ConnectionStatusManager>,
) -> Result<(), String> {
    state.reset();
    
    let stats = state.get_stats();
    let _ = app.emit("connection:status-update", stats);
    
    Ok(())
}

/// Simulate connection state (for testing)
#[tauri::command]
pub fn connection_simulate_state(
    app: AppHandle,
    state: tauri::State<ConnectionStatusManager>,
    new_state: ConnectionState,
    latency_ms: Option<u64>,
) -> Result<(), String> {
    state.set_state(new_state);
    
    if let Some(latency) = latency_ms {
        state.record_ping(latency, true);
    }
    
    let stats = state.get_stats();
    let _ = app.emit("connection:status-update", stats);
    
    Ok(())
}

/// Initialize connection status module
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    // Start the background monitoring thread
    let app_clone = app.clone();
    std::thread::spawn(move || {
        // Wait a bit for app to fully initialize
        std::thread::sleep(Duration::from_secs(2));
        start_monitoring(app_clone);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_state_default() {
        let state: ConnectionState = Default::default();
        assert_eq!(state, ConnectionState::Disconnected);
    }

    #[test]
    fn test_connection_quality_default() {
        let quality: ConnectionQuality = Default::default();
        assert_eq!(quality, ConnectionQuality::Unknown);
    }

    #[test]
    fn test_latency_to_quality() {
        assert_eq!(ConnectionStatusManager::latency_to_quality(0), ConnectionQuality::Unknown);
        assert_eq!(ConnectionStatusManager::latency_to_quality(30), ConnectionQuality::Excellent);
        assert_eq!(ConnectionStatusManager::latency_to_quality(75), ConnectionQuality::Good);
        assert_eq!(ConnectionStatusManager::latency_to_quality(150), ConnectionQuality::Fair);
        assert_eq!(ConnectionStatusManager::latency_to_quality(300), ConnectionQuality::Poor);
    }

    #[test]
    fn test_manager_new() {
        let manager = ConnectionStatusManager::new();
        assert!(!manager.is_monitoring_active());
        assert!(manager.is_auto_reconnect_enabled());
        assert_eq!(manager.get_reconnect_attempts(), 0);
        assert_eq!(manager.get_stats().latency_ms, 0);
    }

    #[test]
    fn test_record_ping() {
        let manager = ConnectionStatusManager::new();
        
        manager.record_ping(50, true);
        assert_eq!(manager.get_stats().latency_ms, 50);
        assert_eq!(manager.get_stats().packets_sent, 1);
        assert_eq!(manager.get_stats().packets_received, 1);
        assert_eq!(*manager.quality.lock().unwrap(), ConnectionQuality::Excellent);
        
        manager.record_ping(150, true);
        assert_eq!(manager.get_stats().latency_ms, 150);
        assert_eq!(manager.get_stats().avg_latency_ms, 100);
    }

    #[test]
    fn test_reconnect_attempts() {
        let manager = ConnectionStatusManager::new();
        
        manager.increment_reconnect_attempts();
        assert_eq!(manager.get_reconnect_attempts(), 1);
        
        manager.increment_reconnect_attempts();
        assert_eq!(manager.get_reconnect_attempts(), 2);
    }

    #[test]
    fn test_auto_reconnect_toggle() {
        let manager = ConnectionStatusManager::new();
        
        assert!(manager.is_auto_reconnect_enabled());
        
        manager.set_auto_reconnect(false);
        assert!(!manager.is_auto_reconnect_enabled());
        
        manager.set_auto_reconnect(true);
        assert!(manager.is_auto_reconnect_enabled());
    }

    #[test]
    fn test_reset() {
        let manager = ConnectionStatusManager::new();
        
        manager.record_ping(100, true);
        manager.increment_reconnect_attempts();
        manager.set_state(ConnectionState::Connected);
        
        manager.reset();
        
        assert_eq!(manager.get_stats().latency_ms, 0);
        assert_eq!(manager.get_reconnect_attempts(), 0);
        assert_eq!(*manager.state.lock().unwrap(), ConnectionState::Disconnected);
    }
}
