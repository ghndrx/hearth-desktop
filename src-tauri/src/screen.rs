use serde::{Deserialize, Serialize};
use nokhwa::CaptureDeviceEnum;
use nokhwa::Backend;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    pub name: String,
    pub source_type: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

impl From<nokhwa::utils::Source> for Source {
    fn from(source: nokhwa::utils::Source) -> Self {
        let source_type = match source.device_type() {
            nokhwa::DeviceType::SourceScreen => "screen",
            nokhwa::DeviceType::SourceWindow => "window",
            nokhwa::DeviceType::SourceCamera => "camera",
            _ => "unknown",
        };
        
        let resolution = source.resolution();
        Source {
            id: source.id(),
            name: source.name().to_string(),
            source_type: source_type.to_string(),
            width: Some(resolution.width()),
            height: Some(resolution.height()),
        }
    }
}

#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<Source>, String> {
    let enumator = CaptureDeviceEnum::new();
    enumator
        .capture_devices(Backend::XCap)
        .map(|sources| sources.into_iter().map(Source::from).collect())
        .map_err(|e| e.to_string())
}
