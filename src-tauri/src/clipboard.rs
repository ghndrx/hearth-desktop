// Native clipboard management with rich content support
use tauri::{command, AppHandle, Manager};
use arboard::{Clipboard, ImageData};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::sync::Mutex;
use image::{DynamicImage, ImageFormat, GenericImageView};
use std::io::Cursor;

/// Clipboard content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ClipboardContent {
    Text(String),
    Html { html: String, plain: Option<String> },
    Image { base64: String, width: u32, height: u32, format: String },
    Files(Vec<String>),
    Empty,
}

/// Clipboard history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content: ClipboardContent,
    pub timestamp: i64,
    pub source: Option<String>,
}

/// Clipboard state manager
pub struct ClipboardState {
    history: Vec<ClipboardEntry>,
    max_history: usize,
    clipboard: Option<Clipboard>,
}

impl ClipboardState {
    pub fn new(max_history: usize) -> Self {
        let clipboard = Clipboard::new().ok();
        Self {
            history: Vec::new(),
            max_history,
            clipboard,
        }
    }

    pub fn add_entry(&mut self, content: ClipboardContent, source: Option<String>) -> ClipboardEntry {
        let entry = ClipboardEntry {
            id: uuid::Uuid::new_v4().to_string(),
            content,
            timestamp: chrono::Utc::now().timestamp_millis(),
            source,
        };
        
        self.history.insert(0, entry.clone());
        
        // Trim history if needed
        if self.history.len() > self.max_history {
            self.history.truncate(self.max_history);
        }
        
        entry
    }

    pub fn get_history(&self, limit: usize) -> Vec<ClipboardEntry> {
        self.history.iter().take(limit).cloned().collect()
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    pub fn remove_entry(&mut self, id: &str) -> bool {
        let len_before = self.history.len();
        self.history.retain(|e| e.id != id);
        self.history.len() < len_before
    }
}

/// Copy text to clipboard
#[command]
pub async fn clipboard_copy_text(
    app: AppHandle,
    text: String,
    track_history: Option<bool>,
) -> Result<ClipboardEntry, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    
    let state = app.state::<Mutex<ClipboardState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    let entry = if track_history.unwrap_or(true) {
        state.add_entry(ClipboardContent::Text(text), Some("copy".to_string()))
    } else {
        ClipboardEntry {
            id: "temp".to_string(),
            content: ClipboardContent::Text("".to_string()),
            timestamp: chrono::Utc::now().timestamp_millis(),
            source: None,
        }
    };
    
    Ok(entry)
}

/// Copy HTML with fallback text to clipboard
#[command]
pub async fn clipboard_copy_html(
    app: AppHandle,
    html: String,
    plain_text: Option<String>,
    track_history: Option<bool>,
) -> Result<ClipboardEntry, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    
    // Set HTML content (with plain text fallback)
    let fallback = plain_text.clone().unwrap_or_else(|| {
        // Strip HTML tags for plain text fallback
        html.replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n")
            .replace("</p>", "\n")
            .replace("</div>", "\n")
            .split('<')
            .filter_map(|s| s.split('>').nth(1))
            .collect::<Vec<_>>()
            .join("")
    });
    
    clipboard.set_text(&fallback).map_err(|e| e.to_string())?;
    
    let state = app.state::<Mutex<ClipboardState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    let entry = if track_history.unwrap_or(true) {
        state.add_entry(
            ClipboardContent::Html { html, plain: plain_text },
            Some("copy_html".to_string()),
        )
    } else {
        ClipboardEntry {
            id: "temp".to_string(),
            content: ClipboardContent::Empty,
            timestamp: chrono::Utc::now().timestamp_millis(),
            source: None,
        }
    };
    
    Ok(entry)
}

/// Copy image to clipboard from base64
#[command]
pub async fn clipboard_copy_image(
    app: AppHandle,
    base64_data: String,
    track_history: Option<bool>,
) -> Result<ClipboardEntry, String> {
    // Decode base64 image
    let image_bytes = STANDARD.decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Load image to get dimensions
    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    
    let (width, height) = img.dimensions();
    let rgba = img.to_rgba8();
    
    // Create arboard image data
    let image_data = ImageData {
        width: width as usize,
        height: height as usize,
        bytes: rgba.into_raw().into(),
    };
    
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_image(image_data).map_err(|e| e.to_string())?;
    
    let state = app.state::<Mutex<ClipboardState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    let entry = if track_history.unwrap_or(true) {
        state.add_entry(
            ClipboardContent::Image {
                base64: base64_data,
                width,
                height,
                format: "png".to_string(),
            },
            Some("copy_image".to_string()),
        )
    } else {
        ClipboardEntry {
            id: "temp".to_string(),
            content: ClipboardContent::Empty,
            timestamp: chrono::Utc::now().timestamp_millis(),
            source: None,
        }
    };
    
    Ok(entry)
}

/// Read current clipboard content
#[command]
pub async fn clipboard_read() -> Result<ClipboardContent, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    
    // Try to get image first
    if let Ok(image) = clipboard.get_image() {
        // Convert to PNG base64
        let img = DynamicImage::ImageRgba8(
            image::RgbaImage::from_raw(
                image.width as u32,
                image.height as u32,
                image.bytes.into_owned(),
            )
            .ok_or("Failed to create image buffer")?
        );
        
        let mut buffer = Cursor::new(Vec::new());
        img.write_to(&mut buffer, ImageFormat::Png)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        
        let base64 = STANDARD.encode(buffer.into_inner());
        
        return Ok(ClipboardContent::Image {
            base64,
            width: image.width as u32,
            height: image.height as u32,
            format: "png".to_string(),
        });
    }
    
    // Try to get text
    if let Ok(text) = clipboard.get_text() {
        if !text.is_empty() {
            return Ok(ClipboardContent::Text(text));
        }
    }
    
    Ok(ClipboardContent::Empty)
}

/// Get clipboard history
#[command]
pub async fn clipboard_get_history(
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<ClipboardEntry>, String> {
    let state = app.state::<Mutex<ClipboardState>>();
    let state = state.lock().map_err(|e| e.to_string())?;
    
    Ok(state.get_history(limit.unwrap_or(50)))
}

/// Clear clipboard history
#[command]
pub async fn clipboard_clear_history(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<ClipboardState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    state.clear_history();
    Ok(())
}

/// Remove entry from clipboard history
#[command]
pub async fn clipboard_remove_entry(
    app: AppHandle,
    id: String,
) -> Result<bool, String> {
    let state = app.state::<Mutex<ClipboardState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    
    Ok(state.remove_entry(&id))
}

/// Paste from clipboard history entry
#[command]
pub async fn clipboard_paste_entry(
    app: AppHandle,
    id: String,
) -> Result<ClipboardContent, String> {
    let state = app.state::<Mutex<ClipboardState>>();
    let state = state.lock().map_err(|e| e.to_string())?;
    
    let entry = state.history.iter()
        .find(|e| e.id == id)
        .ok_or("Entry not found")?;
    
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    
    match &entry.content {
        ClipboardContent::Text(text) => {
            clipboard.set_text(text).map_err(|e| e.to_string())?;
        }
        ClipboardContent::Html { html: _, plain } => {
            if let Some(text) = plain {
                clipboard.set_text(text).map_err(|e| e.to_string())?;
            }
        }
        ClipboardContent::Image { base64, .. } => {
            let bytes = STANDARD.decode(base64)
                .map_err(|e| format!("Failed to decode base64: {}", e))?;
            let img = image::load_from_memory(&bytes)
                .map_err(|e| format!("Failed to load image: {}", e))?;
            let rgba = img.to_rgba8();
            let (w, h) = img.dimensions();
            
            let image_data = ImageData {
                width: w as usize,
                height: h as usize,
                bytes: rgba.into_raw().into(),
            };
            clipboard.set_image(image_data).map_err(|e| e.to_string())?;
        }
        _ => {}
    }
    
    Ok(entry.content.clone())
}

/// Initialize clipboard state
pub fn init_clipboard_state(max_history: usize) -> Mutex<ClipboardState> {
    Mutex::new(ClipboardState::new(max_history))
}
