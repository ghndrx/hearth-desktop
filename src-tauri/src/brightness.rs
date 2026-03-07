use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrightnessInfo {
    pub current: u32,
    pub max: u32,
    pub percent: f32,
    pub device: String,
    pub timestamp_ms: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn find_backlight_dir() -> Option<std::path::PathBuf> {
    let base = std::path::Path::new("/sys/class/backlight");
    if !base.exists() {
        return None;
    }
    // Prefer intel_backlight, then any available
    let preferred = ["intel_backlight", "amdgpu_bl0", "acpi_video0"];
    for name in &preferred {
        let p = base.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    // Fall back to first available
    std::fs::read_dir(base)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .next()
}

fn read_val(path: &std::path::Path) -> Option<u32> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

#[tauri::command]
pub fn brightness_get() -> Result<BrightnessInfo, String> {
    let dir = find_backlight_dir()
        .ok_or_else(|| "No backlight device found".to_string())?;

    let device = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    let current = read_val(&dir.join("brightness"))
        .ok_or_else(|| "Cannot read current brightness".to_string())?;
    let max = read_val(&dir.join("max_brightness"))
        .ok_or_else(|| "Cannot read max brightness".to_string())?;

    let percent = if max > 0 {
        ((current as f64 / max as f64) * 100.0).round() as f32
    } else {
        0.0
    };

    Ok(BrightnessInfo {
        current,
        max,
        percent,
        device,
        timestamp_ms: now_ms(),
    })
}

#[tauri::command]
pub fn brightness_set(percent: f32) -> Result<BrightnessInfo, String> {
    let dir = find_backlight_dir()
        .ok_or_else(|| "No backlight device found".to_string())?;

    let max = read_val(&dir.join("max_brightness"))
        .ok_or_else(|| "Cannot read max brightness".to_string())?;

    let clamped = percent.clamp(1.0, 100.0);
    let target = ((clamped as f64 / 100.0) * max as f64).round() as u32;
    let target = target.max(1); // never set to 0

    std::fs::write(dir.join("brightness"), target.to_string())
        .map_err(|e| format!("Cannot set brightness (may need permissions): {}", e))?;

    let actual = read_val(&dir.join("brightness")).unwrap_or(target);
    let actual_pct = if max > 0 {
        ((actual as f64 / max as f64) * 100.0).round() as f32
    } else {
        0.0
    };

    let device = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    Ok(BrightnessInfo {
        current: actual,
        max,
        percent: actual_pct,
        device,
        timestamp_ms: now_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brightness_get_returns_result() {
        // Should return Ok or Err depending on whether backlight exists
        let _result = brightness_get();
    }
}
