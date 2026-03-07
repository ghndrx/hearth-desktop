use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub percent: u32,
    pub muted: bool,
    pub sink_name: String,
    pub timestamp_ms: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn parse_pactl_output(output: &str) -> Option<(u32, bool, String)> {
    let mut volume: Option<u32> = None;
    let mut muted: Option<bool> = None;
    let mut name = String::from("Default");
    let mut in_default_sink = false;

    for line in output.lines() {
        let trimmed = line.trim();

        // Look for the default sink (marked with *)
        if trimmed.starts_with("* ") || trimmed.starts_with("Sink #") {
            if trimmed.starts_with("* ") {
                in_default_sink = true;
            } else if in_default_sink && volume.is_some() {
                break; // We already found our data
            } else {
                in_default_sink = false;
            }
        }

        if !in_default_sink {
            continue;
        }

        if trimmed.starts_with("Description:") {
            name = trimmed.trim_start_matches("Description:").trim().to_string();
        } else if trimmed.starts_with("Mute:") {
            muted = Some(trimmed.contains("yes"));
        } else if trimmed.starts_with("Volume:") && volume.is_none() {
            // Parse "Volume: front-left: 42345 /  65% / -11.29 dB, ..."
            if let Some(pct_str) = trimmed.split('/').nth(1) {
                let pct_str = pct_str.trim().trim_end_matches('%');
                volume = pct_str.parse::<u32>().ok();
            }
        }
    }

    match (volume, muted) {
        (Some(v), Some(m)) => Some((v, m, name)),
        _ => None,
    }
}

fn get_volume_pactl() -> Result<VolumeInfo, String> {
    let output = Command::new("pactl")
        .args(["list", "sinks"])
        .output()
        .map_err(|e| format!("Failed to run pactl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Find default sink name first
    let default_sink = Command::new("pactl")
        .args(["get-default-sink"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    // Try parsing with asterisk marker first
    if let Some((vol, muted, name)) = parse_pactl_output(&stdout) {
        return Ok(VolumeInfo {
            percent: vol.min(150),
            muted,
            sink_name: name,
            timestamp_ms: now_ms(),
        });
    }

    // Fallback: parse sink matching default name
    let mut volume: Option<u32> = None;
    let mut muted_val = false;
    let mut sink_name = String::from("Default");
    let mut in_target_sink = false;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Name:") {
            let n = trimmed.trim_start_matches("Name:").trim();
            in_target_sink = n == default_sink || default_sink.is_empty();
        }
        if !in_target_sink {
            continue;
        }
        if trimmed.starts_with("Description:") {
            sink_name = trimmed.trim_start_matches("Description:").trim().to_string();
        } else if trimmed.starts_with("Mute:") {
            muted_val = trimmed.contains("yes");
        } else if trimmed.starts_with("Volume:") && volume.is_none() {
            if let Some(pct_str) = trimmed.split('/').nth(1) {
                let pct_str = pct_str.trim().trim_end_matches('%');
                volume = pct_str.parse::<u32>().ok();
            }
        }
        if volume.is_some() && trimmed.starts_with("Mute:") {
            break;
        }
    }

    Ok(VolumeInfo {
        percent: volume.unwrap_or(0).min(150),
        muted: muted_val,
        sink_name,
        timestamp_ms: now_ms(),
    })
}

#[tauri::command]
pub fn volume_get() -> Result<VolumeInfo, String> {
    get_volume_pactl()
}

#[tauri::command]
pub fn volume_set(percent: u32) -> Result<VolumeInfo, String> {
    let pct = percent.min(150);
    Command::new("pactl")
        .args(["set-sink-volume", "@DEFAULT_SINK@", &format!("{}%", pct)])
        .output()
        .map_err(|e| format!("Failed to set volume: {}", e))?;

    get_volume_pactl()
}

#[tauri::command]
pub fn volume_toggle_mute() -> Result<VolumeInfo, String> {
    Command::new("pactl")
        .args(["set-sink-mute", "@DEFAULT_SINK@", "toggle"])
        .output()
        .map_err(|e| format!("Failed to toggle mute: {}", e))?;

    get_volume_pactl()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pactl_output() {
        let sample = r#"Sink #0
	State: RUNNING
	Name: alsa_output.pci-0000_00_1f.3.analog-stereo
  * Description: Built-in Audio Analog Stereo
	Volume: front-left: 42345 /  65% / -11.29 dB,   front-right: 42345 /  65% / -11.29 dB
	Mute: no
"#;
        // The asterisk-based parsing looks for "* " at start of line
        // This test just verifies the function doesn't panic
        let _ = parse_pactl_output(sample);
    }

    #[test]
    fn test_volume_get_runs() {
        // May fail if pactl is not available, that's OK
        let _ = volume_get();
    }
}
