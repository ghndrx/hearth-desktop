use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub percent: f32,
    pub is_charging: bool,
    pub power_source: String,
    pub time_to_empty_mins: Option<u64>,
    pub time_to_full_mins: Option<u64>,
    pub cycle_count: Option<u32>,
    pub health_percent: Option<f32>,
    pub voltage_v: Option<f32>,
    pub energy_wh: Option<f32>,
    pub energy_full_wh: Option<f32>,
    pub energy_rate_w: Option<f32>,
    pub technology: Option<String>,
    pub timestamp_ms: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn battery_poll() -> Result<BatteryInfo, String> {
    // Read battery info from /sys/class/power_supply on Linux
    let bat_path = std::path::Path::new("/sys/class/power_supply/BAT0");
    let bat1_path = std::path::Path::new("/sys/class/power_supply/BAT1");

    let base = if bat_path.exists() {
        bat_path
    } else if bat1_path.exists() {
        bat1_path
    } else {
        return Ok(BatteryInfo {
            percent: 100.0,
            is_charging: false,
            power_source: "AC".into(),
            time_to_empty_mins: None,
            time_to_full_mins: None,
            cycle_count: None,
            health_percent: None,
            voltage_v: None,
            energy_wh: None,
            energy_full_wh: None,
            energy_rate_w: None,
            technology: None,
            timestamp_ms: now_ms(),
        });
    };

    let read_str = |name: &str| -> Option<String> {
        std::fs::read_to_string(base.join(name))
            .ok()
            .map(|s| s.trim().to_string())
    };

    let read_u64 = |name: &str| -> Option<u64> {
        read_str(name).and_then(|s| s.parse::<u64>().ok())
    };

    let status = read_str("status").unwrap_or_default();
    let is_charging = status == "Charging" || status == "Full";
    let power_source = if is_charging { "AC" } else { "Battery" }.to_string();

    let capacity = read_str("capacity")
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0);

    let energy_now = read_u64("energy_now"); // microWh
    let energy_full = read_u64("energy_full");
    let energy_full_design = read_u64("energy_full_design");
    let power_now = read_u64("power_now"); // microW
    let voltage_now = read_u64("voltage_now"); // microV
    let cycle_count = read_u64("cycle_count").map(|c| c as u32);
    let technology = read_str("technology");

    // Also try charge_now/charge_full for charge-based batteries
    let (energy_now, energy_full, energy_full_design, power_now) = if energy_now.is_some() {
        (energy_now, energy_full, energy_full_design, power_now)
    } else {
        let charge_now = read_u64("charge_now");
        let charge_full = read_u64("charge_full");
        let charge_full_design = read_u64("charge_full_design");
        let current_now = read_u64("current_now");
        let v = voltage_now.unwrap_or(1_000_000) as f64 / 1_000_000.0;
        (
            charge_now.map(|c| (c as f64 * v) as u64),
            charge_full.map(|c| (c as f64 * v) as u64),
            charge_full_design.map(|c| (c as f64 * v) as u64),
            current_now.map(|c| (c as f64 * v) as u64),
        )
    };

    let energy_wh = energy_now.map(|e| (e as f32) / 1_000_000.0);
    let energy_full_wh = energy_full.map(|e| (e as f32) / 1_000_000.0);
    let energy_rate_w = power_now.map(|p| (p as f32) / 1_000_000.0);
    let voltage_v = voltage_now.map(|v| (v as f32) / 1_000_000.0);

    let health_percent = match (energy_full, energy_full_design) {
        (Some(full), Some(design)) if design > 0 => {
            Some(((full as f64 / design as f64) * 100.0) as f32)
        }
        _ => None,
    };

    // Estimate time remaining
    let time_to_empty_mins = if !is_charging {
        match (energy_now, power_now) {
            (Some(en), Some(pn)) if pn > 0 => Some((en as f64 / pn as f64 * 60.0) as u64),
            _ => None,
        }
    } else {
        None
    };

    let time_to_full_mins = if is_charging {
        match (energy_now, energy_full, power_now) {
            (Some(en), Some(ef), Some(pn)) if pn > 0 && ef > en => {
                Some(((ef - en) as f64 / pn as f64 * 60.0) as u64)
            }
            _ => None,
        }
    } else {
        None
    };

    Ok(BatteryInfo {
        percent: capacity.clamp(0.0, 100.0),
        is_charging,
        power_source,
        time_to_empty_mins,
        time_to_full_mins,
        cycle_count,
        health_percent: health_percent.map(|h| (h * 10.0).round() / 10.0),
        voltage_v: voltage_v.map(|v| (v * 100.0).round() / 100.0),
        energy_wh: energy_wh.map(|e| (e * 100.0).round() / 100.0),
        energy_full_wh: energy_full_wh.map(|e| (e * 100.0).round() / 100.0),
        energy_rate_w: energy_rate_w.map(|r| (r * 100.0).round() / 100.0),
        technology,
        timestamp_ms: now_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_battery_poll_runs() {
        // Should succeed even without a real battery (returns AC fallback)
        let result = battery_poll();
        assert!(result.is_ok());
    }
}
