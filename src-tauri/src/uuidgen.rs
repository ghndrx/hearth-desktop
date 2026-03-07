//! UUID Generator - Generate and manage UUIDs in various formats

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UuidResult {
    pub uuid: String,
    pub format: String,
    pub version: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum UuidFormat {
    Standard,
    Uppercase,
    NoDashes,
    Braces,
    Urn,
}

impl UuidFormat {
    pub fn format_uuid(&self, uuid: &Uuid) -> String {
        match self {
            UuidFormat::Standard => uuid.to_string(),
            UuidFormat::Uppercase => uuid.to_string().to_uppercase(),
            UuidFormat::NoDashes => uuid.simple().to_string(),
            UuidFormat::Braces => format!("{{{}}}", uuid),
            UuidFormat::Urn => uuid.urn().to_string(),
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            UuidFormat::Standard => "standard",
            UuidFormat::Uppercase => "uppercase",
            UuidFormat::NoDashes => "no-dashes",
            UuidFormat::Braces => "braces",
            UuidFormat::Urn => "urn",
        }
    }
}

pub struct UuidGenManager {
    history: Mutex<Vec<UuidResult>>,
}

impl Default for UuidGenManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn make_result(uuid: &Uuid, format: UuidFormat) -> UuidResult {
    UuidResult {
        uuid: format.format_uuid(uuid),
        format: format.label().into(),
        version: "v4".into(),
        timestamp: chrono::Local::now().to_rfc3339(),
    }
}

#[tauri::command]
pub fn uuid_generate(
    manager: tauri::State<'_, UuidGenManager>,
    format: Option<String>,
) -> Result<UuidResult, String> {
    let fmt = match format.as_deref() {
        Some("uppercase") => UuidFormat::Uppercase,
        Some("no-dashes") => UuidFormat::NoDashes,
        Some("braces") => UuidFormat::Braces,
        Some("urn") => UuidFormat::Urn,
        _ => UuidFormat::Standard,
    };

    let uuid = Uuid::new_v4();
    let result = make_result(&uuid, fmt);

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn uuid_generate_batch(
    manager: tauri::State<'_, UuidGenManager>,
    count: Option<u32>,
    format: Option<String>,
) -> Result<Vec<UuidResult>, String> {
    let count = count.unwrap_or(5).min(100);
    let fmt = match format.as_deref() {
        Some("uppercase") => UuidFormat::Uppercase,
        Some("no-dashes") => UuidFormat::NoDashes,
        Some("braces") => UuidFormat::Braces,
        Some("urn") => UuidFormat::Urn,
        _ => UuidFormat::Standard,
    };

    let results: Vec<UuidResult> = (0..count)
        .map(|_| make_result(&Uuid::new_v4(), fmt))
        .collect();

    if let Ok(mut history) = manager.history.lock() {
        for r in results.iter().rev() {
            history.insert(0, r.clone());
        }
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn uuid_validate(input: String) -> Result<bool, String> {
    Ok(Uuid::parse_str(input.trim()).is_ok())
}

#[tauri::command]
pub fn uuid_get_history(
    manager: tauri::State<'_, UuidGenManager>,
) -> Result<Vec<UuidResult>, String> {
    let history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    Ok(history.clone())
}

#[tauri::command]
pub fn uuid_clear_history(
    manager: tauri::State<'_, UuidGenManager>,
) -> Result<(), String> {
    let mut history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    history.clear();
    Ok(())
}
