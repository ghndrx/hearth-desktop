use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentTemp {
    pub label: String,
    pub current_celsius: f32,
    pub max_celsius: f32,
    pub critical_celsius: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempSnapshot {
    pub components: Vec<ComponentTemp>,
    pub cpu_avg_celsius: Option<f32>,
    pub hottest_celsius: Option<f32>,
    pub hottest_label: Option<String>,
    pub timestamp_ms: u64,
}

pub struct CpuTempManager {
    components: Mutex<sysinfo::Components>,
}

impl Default for CpuTempManager {
    fn default() -> Self {
        Self {
            components: Mutex::new(sysinfo::Components::new_with_refreshed_list()),
        }
    }
}

#[tauri::command]
pub fn cputemp_poll(
    state: tauri::State<'_, CpuTempManager>,
) -> Result<TempSnapshot, String> {
    let mut components = state.components.lock().map_err(|e| e.to_string())?;
    components.refresh(true);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut temps: Vec<ComponentTemp> = Vec::new();
    let mut cpu_sum: f32 = 0.0;
    let mut cpu_count: u32 = 0;
    let mut hottest: Option<(f32, String)> = None;

    for comp in components.iter() {
        let label = comp.label().to_string();
        let current = comp.temperature().unwrap_or(0.0);
        let max = comp.max().unwrap_or(0.0);
        let critical = comp.critical();

        // Skip sensors reporting 0 or negative
        if current <= 0.0 {
            continue;
        }

        temps.push(ComponentTemp {
            label: label.clone(),
            current_celsius: (current * 10.0).round() / 10.0,
            max_celsius: (max * 10.0).round() / 10.0,
            critical_celsius: critical.map(|c| (c * 10.0).round() / 10.0),
        });

        // Track CPU-related temps for average
        let lower = label.to_lowercase();
        if lower.contains("cpu") || lower.contains("core") || lower.contains("package") || lower.contains("tctl") {
            cpu_sum += current;
            cpu_count += 1;
        }

        match &hottest {
            Some((h, _)) if current > *h => {
                hottest = Some((current, label));
            }
            None => {
                hottest = Some((current, label));
            }
            _ => {}
        }
    }

    let cpu_avg = if cpu_count > 0 {
        Some(((cpu_sum / cpu_count as f32) * 10.0).round() / 10.0)
    } else {
        None
    };

    Ok(TempSnapshot {
        components: temps,
        cpu_avg_celsius: cpu_avg,
        hottest_celsius: hottest.as_ref().map(|(t, _)| (*t * 10.0).round() / 10.0),
        hottest_label: hottest.map(|(_, l)| l),
        timestamp_ms: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_manager() {
        let _mgr = CpuTempManager::default();
    }
}
