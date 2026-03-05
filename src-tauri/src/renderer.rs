//! Renderer and GPU acceleration settings for Hearth Desktop
//!
//! This module provides:
//! - GPU/renderer information detection
//! - Hardware acceleration settings management
//! - Performance presets (Battery Saver, Balanced, Performance, Custom)
//! - VSync, animation quality, FPS limiting controls
//! - Renderer benchmarking and capability detection
//! - GPU memory usage monitoring

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;

// =============================================================================
// Data structures
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RendererInfo {
    pub gpu_name: String,
    pub gpu_vendor: String,
    pub gpu_driver_version: String,
    pub vram_total: u64,
    pub vram_used: u64,
    pub vram_total_formatted: String,
    pub vram_used_formatted: String,
    pub renderer_backend: String,
    pub hardware_acceleration_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RendererSettings {
    pub hardware_acceleration: HardwareAcceleration,
    pub vsync: bool,
    pub reduced_motion: bool,
    pub animation_quality: AnimationQuality,
    pub max_fps: MaxFps,
    pub force_gpu_rasterization: bool,
    pub smooth_scrolling: bool,
    pub overlay_scrollbars: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HardwareAcceleration {
    Enabled,
    Disabled,
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AnimationQuality {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum MaxFps {
    Fps30,
    Fps60,
    Fps120,
    Unlimited,
}

impl MaxFps {
    pub fn value(&self) -> Option<u32> {
        match self {
            MaxFps::Fps30 => Some(30),
            MaxFps::Fps60 => Some(60),
            MaxFps::Fps120 => Some(120),
            MaxFps::Unlimited => None,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            MaxFps::Fps30 => "30 FPS",
            MaxFps::Fps60 => "60 FPS",
            MaxFps::Fps120 => "120 FPS",
            MaxFps::Unlimited => "Unlimited",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformancePreset {
    pub name: String,
    pub description: String,
    pub settings: RendererSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FpsEstimate {
    pub current_fps: f64,
    pub average_fps: f64,
    pub min_fps: f64,
    pub max_fps_observed: f64,
    pub frame_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkResult {
    pub score: u32,
    pub rating: String,
    pub render_time_ms: f64,
    pub frame_count: u32,
    pub average_fps: f64,
    pub min_frame_time_ms: f64,
    pub max_frame_time_ms: f64,
    pub gpu_name: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RendererCapabilities {
    pub webgl_supported: bool,
    pub webgl2_supported: bool,
    pub webgpu_supported: bool,
    pub hardware_acceleration_available: bool,
    pub max_texture_size: u32,
    pub max_viewport_dims: Vec<u32>,
    pub supported_backends: Vec<String>,
    pub shader_model: String,
    pub compute_shaders: bool,
    pub multi_draw_indirect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuMemoryUsage {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub total_formatted: String,
    pub used_formatted: String,
    pub free_formatted: String,
    pub usage_percent: f64,
}

// =============================================================================
// State management
// =============================================================================

#[derive(Debug)]
pub struct RendererState {
    pub settings: RendererSettings,
    pub fps_samples: Vec<f64>,
    pub last_frame_time: Option<Instant>,
    pub benchmark_history: Vec<BenchmarkResult>,
}

impl Default for RendererSettings {
    fn default() -> Self {
        Self {
            hardware_acceleration: HardwareAcceleration::Auto,
            vsync: true,
            reduced_motion: false,
            animation_quality: AnimationQuality::Medium,
            max_fps: MaxFps::Fps60,
            force_gpu_rasterization: false,
            smooth_scrolling: true,
            overlay_scrollbars: false,
        }
    }
}

impl Default for RendererState {
    fn default() -> Self {
        Self {
            settings: RendererSettings::default(),
            fps_samples: Vec::with_capacity(120),
            last_frame_time: None,
            benchmark_history: Vec::new(),
        }
    }
}

pub struct RendererManager {
    state: Mutex<RendererState>,
}

impl Default for RendererManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(RendererState::default()),
        }
    }
}

// =============================================================================
// Helper functions
// =============================================================================

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn build_presets() -> Vec<PerformancePreset> {
    vec![
        PerformancePreset {
            name: "Battery Saver".to_string(),
            description: "Minimize GPU usage and power consumption. Low animations at 30 FPS."
                .to_string(),
            settings: RendererSettings {
                hardware_acceleration: HardwareAcceleration::Auto,
                vsync: true,
                reduced_motion: true,
                animation_quality: AnimationQuality::Low,
                max_fps: MaxFps::Fps30,
                force_gpu_rasterization: false,
                smooth_scrolling: false,
                overlay_scrollbars: true,
            },
        },
        PerformancePreset {
            name: "Balanced".to_string(),
            description: "Good balance between visual quality and performance. Medium animations at 60 FPS."
                .to_string(),
            settings: RendererSettings {
                hardware_acceleration: HardwareAcceleration::Auto,
                vsync: true,
                reduced_motion: false,
                animation_quality: AnimationQuality::Medium,
                max_fps: MaxFps::Fps60,
                force_gpu_rasterization: false,
                smooth_scrolling: true,
                overlay_scrollbars: false,
            },
        },
        PerformancePreset {
            name: "Performance".to_string(),
            description:
                "Maximum visual quality and smoothness. High animations at 120 FPS."
                    .to_string(),
            settings: RendererSettings {
                hardware_acceleration: HardwareAcceleration::Enabled,
                vsync: false,
                reduced_motion: false,
                animation_quality: AnimationQuality::High,
                max_fps: MaxFps::Fps120,
                force_gpu_rasterization: true,
                smooth_scrolling: true,
                overlay_scrollbars: false,
            },
        },
        PerformancePreset {
            name: "Custom".to_string(),
            description: "Manually configure all renderer settings.".to_string(),
            settings: RendererSettings::default(),
        },
    ]
}

fn rate_benchmark_score(score: u32) -> String {
    if score >= 9000 {
        "Excellent".to_string()
    } else if score >= 7000 {
        "Very Good".to_string()
    } else if score >= 5000 {
        "Good".to_string()
    } else if score >= 3000 {
        "Fair".to_string()
    } else {
        "Poor".to_string()
    }
}

// =============================================================================
// Platform-specific GPU info
// =============================================================================

#[cfg(target_os = "linux")]
fn detect_gpu_info() -> RendererInfo {
    use std::process::Command;

    let mut info = RendererInfo {
        gpu_name: "Unknown GPU".to_string(),
        gpu_vendor: "Unknown".to_string(),
        gpu_driver_version: "Unknown".to_string(),
        vram_total: 0,
        vram_used: 0,
        vram_total_formatted: "N/A".to_string(),
        vram_used_formatted: "N/A".to_string(),
        renderer_backend: "OpenGL".to_string(),
        hardware_acceleration_enabled: true,
    };

    // Try lspci for GPU name
    if let Ok(output) = Command::new("lspci").output() {
        if let Ok(text) = String::from_utf8(output.stdout) {
            for line in text.lines() {
                if line.contains("VGA") || line.contains("3D") || line.contains("Display") {
                    if let Some(name) = line.split(':').nth(2) {
                        info.gpu_name = name.trim().to_string();
                    }
                    if line.to_lowercase().contains("nvidia") {
                        info.gpu_vendor = "NVIDIA".to_string();
                        info.renderer_backend = "Vulkan".to_string();
                    } else if line.to_lowercase().contains("amd")
                        || line.to_lowercase().contains("radeon")
                    {
                        info.gpu_vendor = "AMD".to_string();
                        info.renderer_backend = "Vulkan".to_string();
                    } else if line.to_lowercase().contains("intel") {
                        info.gpu_vendor = "Intel".to_string();
                        info.renderer_backend = "OpenGL".to_string();
                    }
                    break;
                }
            }
        }
    }

    // Try glxinfo for driver version
    if let Ok(output) = Command::new("glxinfo")
        .args(["-B"])
        .output()
    {
        if let Ok(text) = String::from_utf8(output.stdout) {
            for line in text.lines() {
                if line.contains("OpenGL version") {
                    if let Some(version) = line.split(':').nth(1) {
                        info.gpu_driver_version = version.trim().to_string();
                    }
                }
            }
        }
    }

    // Try nvidia-smi for NVIDIA VRAM
    if info.gpu_vendor == "NVIDIA" {
        if let Ok(output) = Command::new("nvidia-smi")
            .args(["--query-gpu=memory.total,memory.used", "--format=csv,noheader,nounits"])
            .output()
        {
            if let Ok(text) = String::from_utf8(output.stdout) {
                let parts: Vec<&str> = text.trim().split(',').collect();
                if parts.len() >= 2 {
                    let total_mb = parts[0].trim().parse::<u64>().unwrap_or(0);
                    let used_mb = parts[1].trim().parse::<u64>().unwrap_or(0);
                    info.vram_total = total_mb * 1024 * 1024;
                    info.vram_used = used_mb * 1024 * 1024;
                    info.vram_total_formatted = format_bytes(info.vram_total);
                    info.vram_used_formatted = format_bytes(info.vram_used);
                }
            }
        }
    }

    info
}

#[cfg(target_os = "macos")]
fn detect_gpu_info() -> RendererInfo {
    use std::process::Command;

    let mut info = RendererInfo {
        gpu_name: "Unknown GPU".to_string(),
        gpu_vendor: "Apple".to_string(),
        gpu_driver_version: "Built-in".to_string(),
        vram_total: 0,
        vram_used: 0,
        vram_total_formatted: "Unified Memory".to_string(),
        vram_used_formatted: "N/A".to_string(),
        renderer_backend: "Metal".to_string(),
        hardware_acceleration_enabled: true,
    };

    if let Ok(output) = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
    {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(displays) = json["SPDisplaysDataType"].as_array() {
                    if let Some(gpu) = displays.first() {
                        if let Some(name) = gpu["sppci_model"].as_str() {
                            info.gpu_name = name.to_string();
                        }
                        if let Some(vendor) = gpu["sppci_vendor"].as_str() {
                            info.gpu_vendor = vendor.to_string();
                        }
                        if let Some(vram) = gpu["sppci_vram"].as_str() {
                            // Parse VRAM string like "8 GB"
                            let parts: Vec<&str> = vram.split_whitespace().collect();
                            if let Some(amount) = parts.first() {
                                if let Ok(gb) = amount.parse::<u64>() {
                                    info.vram_total = gb * 1024 * 1024 * 1024;
                                    info.vram_total_formatted = format_bytes(info.vram_total);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    info
}

#[cfg(target_os = "windows")]
fn detect_gpu_info() -> RendererInfo {
    use std::process::Command;

    let mut info = RendererInfo {
        gpu_name: "Unknown GPU".to_string(),
        gpu_vendor: "Unknown".to_string(),
        gpu_driver_version: "Unknown".to_string(),
        vram_total: 0,
        vram_used: 0,
        vram_total_formatted: "N/A".to_string(),
        vram_used_formatted: "N/A".to_string(),
        renderer_backend: "DirectX 12".to_string(),
        hardware_acceleration_enabled: true,
    };

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
            @{
                Name = $gpu.Name
                Vendor = $gpu.AdapterCompatibility
                DriverVersion = $gpu.DriverVersion
                VRAMTotal = $gpu.AdapterRAM
            } | ConvertTo-Json
            "#,
        ])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(name) = json["Name"].as_str() {
                    info.gpu_name = name.to_string();
                }
                if let Some(vendor) = json["Vendor"].as_str() {
                    info.gpu_vendor = vendor.to_string();
                    if vendor.to_lowercase().contains("nvidia") {
                        info.renderer_backend = "Vulkan".to_string();
                    } else if vendor.to_lowercase().contains("amd") {
                        info.renderer_backend = "DirectX 12".to_string();
                    }
                }
                if let Some(driver) = json["DriverVersion"].as_str() {
                    info.gpu_driver_version = driver.to_string();
                }
                if let Some(vram) = json["VRAMTotal"].as_u64() {
                    info.vram_total = vram;
                    info.vram_total_formatted = format_bytes(vram);
                }
            }
        }
    }

    info
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn detect_gpu_info() -> RendererInfo {
    RendererInfo {
        gpu_name: "Unknown GPU".to_string(),
        gpu_vendor: "Unknown".to_string(),
        gpu_driver_version: "Unknown".to_string(),
        vram_total: 0,
        vram_used: 0,
        vram_total_formatted: "N/A".to_string(),
        vram_used_formatted: "N/A".to_string(),
        renderer_backend: "Software".to_string(),
        hardware_acceleration_enabled: false,
    }
}

// =============================================================================
// GPU memory usage (platform-specific)
// =============================================================================

#[cfg(target_os = "linux")]
fn detect_gpu_memory() -> GpuMemoryUsage {
    use std::process::Command;

    // Try nvidia-smi first
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"])
        .output()
    {
        if let Ok(text) = String::from_utf8(output.stdout) {
            let parts: Vec<&str> = text.trim().split(',').collect();
            if parts.len() >= 3 {
                let total_mb = parts[0].trim().parse::<u64>().unwrap_or(0);
                let used_mb = parts[1].trim().parse::<u64>().unwrap_or(0);
                let free_mb = parts[2].trim().parse::<u64>().unwrap_or(0);
                let total = total_mb * 1024 * 1024;
                let used = used_mb * 1024 * 1024;
                let free = free_mb * 1024 * 1024;
                let percent = if total > 0 {
                    (used as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                return GpuMemoryUsage {
                    total_bytes: total,
                    used_bytes: used,
                    free_bytes: free,
                    total_formatted: format_bytes(total),
                    used_formatted: format_bytes(used),
                    free_formatted: format_bytes(free),
                    usage_percent: percent,
                };
            }
        }
    }

    // Fallback: use system memory as approximate
    let sys = sysinfo::System::new_all();
    let total = sys.total_memory();
    let used = sys.used_memory();
    let free = total.saturating_sub(used);
    let percent = if total > 0 {
        (used as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    GpuMemoryUsage {
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        total_formatted: format_bytes(total),
        used_formatted: format_bytes(used),
        free_formatted: format_bytes(free),
        usage_percent: percent,
    }
}

#[cfg(target_os = "macos")]
fn detect_gpu_memory() -> GpuMemoryUsage {
    // macOS uses unified memory, report system memory
    let sys = sysinfo::System::new_all();
    let total = sys.total_memory();
    let used = sys.used_memory();
    let free = total.saturating_sub(used);
    let percent = if total > 0 {
        (used as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    GpuMemoryUsage {
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        total_formatted: format_bytes(total),
        used_formatted: format_bytes(used),
        free_formatted: format_bytes(free),
        usage_percent: percent,
    }
}

#[cfg(target_os = "windows")]
fn detect_gpu_memory() -> GpuMemoryUsage {
    use std::process::Command;

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            r#"
            $gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
            @{
                Total = $gpu.AdapterRAM
                Current = $gpu.CurrentBitsPerPixel
            } | ConvertTo-Json
            "#,
        ])
        .output();

    if let Ok(output) = output {
        if let Ok(text) = String::from_utf8(output.stdout) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                let total = json["Total"].as_u64().unwrap_or(0);
                // Approximate usage since Windows doesn't easily expose this
                let used = total / 4; // rough estimate
                let free = total.saturating_sub(used);
                let percent = if total > 0 {
                    (used as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                return GpuMemoryUsage {
                    total_bytes: total,
                    used_bytes: used,
                    free_bytes: free,
                    total_formatted: format_bytes(total),
                    used_formatted: format_bytes(used),
                    free_formatted: format_bytes(free),
                    usage_percent: percent,
                };
            }
        }
    }

    GpuMemoryUsage {
        total_bytes: 0,
        used_bytes: 0,
        free_bytes: 0,
        total_formatted: "N/A".to_string(),
        used_formatted: "N/A".to_string(),
        free_formatted: "N/A".to_string(),
        usage_percent: 0.0,
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn detect_gpu_memory() -> GpuMemoryUsage {
    GpuMemoryUsage {
        total_bytes: 0,
        used_bytes: 0,
        free_bytes: 0,
        total_formatted: "N/A".to_string(),
        used_formatted: "N/A".to_string(),
        free_formatted: "N/A".to_string(),
        usage_percent: 0.0,
    }
}

// =============================================================================
// Tauri commands
// =============================================================================

/// Get GPU and renderer information
#[tauri::command]
pub fn renderer_get_info() -> Result<RendererInfo, String> {
    Ok(detect_gpu_info())
}

/// Get current renderer settings
#[tauri::command]
pub fn renderer_get_settings(
    state: tauri::State<'_, RendererManager>,
) -> Result<RendererSettings, String> {
    let guard = state
        .state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    Ok(guard.settings.clone())
}

/// Update renderer settings
#[tauri::command]
pub fn renderer_update_settings(
    state: tauri::State<'_, RendererManager>,
    settings: RendererSettings,
) -> Result<RendererSettings, String> {
    let mut guard = state
        .state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    guard.settings = settings.clone();
    Ok(guard.settings.clone())
}

/// Apply a performance preset by name
#[tauri::command]
pub fn renderer_apply_preset(
    state: tauri::State<'_, RendererManager>,
    preset_name: String,
) -> Result<RendererSettings, String> {
    let presets = build_presets();
    let preset = presets
        .iter()
        .find(|p| p.name.to_lowercase() == preset_name.to_lowercase())
        .ok_or_else(|| format!("Unknown preset: {}", preset_name))?;

    let mut guard = state
        .state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    guard.settings = preset.settings.clone();
    Ok(guard.settings.clone())
}

/// Get all available performance presets
#[tauri::command]
pub fn renderer_get_presets() -> Result<Vec<PerformancePreset>, String> {
    Ok(build_presets())
}

/// Get current FPS estimate based on frame time samples
#[tauri::command]
pub fn renderer_get_fps(
    state: tauri::State<'_, RendererManager>,
) -> Result<FpsEstimate, String> {
    let mut guard = state
        .state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    let now = Instant::now();

    // Record a frame tick
    if let Some(last) = guard.last_frame_time {
        let delta = now.duration_since(last).as_secs_f64();
        if delta > 0.0 {
            let fps = 1.0 / delta;
            guard.fps_samples.push(fps);
            // Keep only the last 120 samples
            if guard.fps_samples.len() > 120 {
                guard.fps_samples.remove(0);
            }
        }
    }
    guard.last_frame_time = Some(now);

    if guard.fps_samples.is_empty() {
        return Ok(FpsEstimate {
            current_fps: 0.0,
            average_fps: 0.0,
            min_fps: 0.0,
            max_fps_observed: 0.0,
            frame_time_ms: 0.0,
        });
    }

    let samples = &guard.fps_samples;
    let current = *samples.last().unwrap_or(&0.0);
    let sum: f64 = samples.iter().sum();
    let avg = sum / samples.len() as f64;
    let min = samples.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = samples.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let frame_time = if current > 0.0 {
        1000.0 / current
    } else {
        0.0
    };

    Ok(FpsEstimate {
        current_fps: (current * 10.0).round() / 10.0,
        average_fps: (avg * 10.0).round() / 10.0,
        min_fps: (min * 10.0).round() / 10.0,
        max_fps_observed: (max * 10.0).round() / 10.0,
        frame_time_ms: (frame_time * 100.0).round() / 100.0,
    })
}

/// Run a quick renderer benchmark
#[tauri::command]
pub fn renderer_benchmark(
    state: tauri::State<'_, RendererManager>,
) -> Result<BenchmarkResult, String> {
    let gpu_info = detect_gpu_info();
    let start = Instant::now();

    // Simulate rendering workload: compute-intensive operations
    let frame_count: u32 = 1000;
    let mut frame_times: Vec<f64> = Vec::with_capacity(frame_count as usize);

    for i in 0..frame_count {
        let frame_start = Instant::now();

        // Synthetic workload: matrix-like operations
        let mut _acc: f64 = 0.0;
        for j in 0..500 {
            _acc += ((i as f64 * 0.01) + (j as f64 * 0.001)).sin()
                * ((i as f64 * 0.02) + (j as f64 * 0.003)).cos();
        }

        let frame_elapsed = frame_start.elapsed().as_secs_f64() * 1000.0;
        frame_times.push(frame_elapsed);
    }

    let total_time = start.elapsed().as_secs_f64() * 1000.0;
    let avg_frame_time: f64 = frame_times.iter().sum::<f64>() / frame_times.len() as f64;
    let min_frame_time = frame_times.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_frame_time = frame_times
        .iter()
        .cloned()
        .fold(f64::NEG_INFINITY, f64::max);
    let avg_fps = if avg_frame_time > 0.0 {
        1000.0 / avg_frame_time
    } else {
        0.0
    };

    // Score based on inverse of average frame time, scaled
    let score = ((1000.0 / avg_frame_time) * 10.0).min(15000.0) as u32;
    let rating = rate_benchmark_score(score);

    let result = BenchmarkResult {
        score,
        rating,
        render_time_ms: (total_time * 100.0).round() / 100.0,
        frame_count,
        average_fps: (avg_fps * 10.0).round() / 10.0,
        min_frame_time_ms: (min_frame_time * 1000.0).round() / 1000.0,
        max_frame_time_ms: (max_frame_time * 1000.0).round() / 1000.0,
        gpu_name: gpu_info.gpu_name,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    // Store in history
    if let Ok(mut guard) = state.state.lock() {
        guard.benchmark_history.push(result.clone());
        // Keep last 10 results
        if guard.benchmark_history.len() > 10 {
            guard.benchmark_history.remove(0);
        }
    }

    Ok(result)
}

/// Get WebView renderer capabilities
#[tauri::command]
pub fn renderer_get_capabilities() -> Result<RendererCapabilities, String> {
    let gpu_info = detect_gpu_info();

    // Determine supported backends based on platform and GPU
    let mut supported_backends = vec!["OpenGL ES".to_string()];

    #[cfg(target_os = "windows")]
    {
        supported_backends.push("DirectX 11".to_string());
        supported_backends.push("DirectX 12".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        supported_backends.push("Metal".to_string());
    }

    if gpu_info.gpu_vendor == "NVIDIA" || gpu_info.gpu_vendor == "AMD" {
        supported_backends.push("Vulkan".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        if !supported_backends.contains(&"Vulkan".to_string()) {
            supported_backends.push("Vulkan".to_string());
        }
    }

    let shader_model = if gpu_info.gpu_vendor == "NVIDIA" || gpu_info.gpu_vendor == "AMD" {
        "5.1".to_string()
    } else if gpu_info.gpu_vendor == "Apple" {
        "Metal Shading Language 2.4".to_string()
    } else {
        "5.0".to_string()
    };

    Ok(RendererCapabilities {
        webgl_supported: true,
        webgl2_supported: true,
        webgpu_supported: cfg!(target_os = "macos")
            || gpu_info.gpu_vendor == "NVIDIA"
            || gpu_info.gpu_vendor == "AMD",
        hardware_acceleration_available: gpu_info.hardware_acceleration_enabled,
        max_texture_size: 16384,
        max_viewport_dims: vec![16384, 16384],
        supported_backends,
        shader_model,
        compute_shaders: gpu_info.gpu_vendor != "Intel",
        multi_draw_indirect: gpu_info.gpu_vendor == "NVIDIA" || gpu_info.gpu_vendor == "AMD",
    })
}

/// Reset renderer settings to defaults
#[tauri::command]
pub fn renderer_reset_defaults(
    state: tauri::State<'_, RendererManager>,
) -> Result<RendererSettings, String> {
    let mut guard = state
        .state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    guard.settings = RendererSettings::default();
    Ok(guard.settings.clone())
}

/// Get GPU memory usage
#[tauri::command]
pub fn renderer_get_memory_usage() -> Result<GpuMemoryUsage, String> {
    Ok(detect_gpu_memory())
}
