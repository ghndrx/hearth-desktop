// Native file drop handling for Tauri
// Provides enhanced file drop events with metadata and thumbnail generation

use std::path::PathBuf;
use std::fs;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, Emitter};
use serde::{Serialize, Deserialize};

/// Metadata for a dropped file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DroppedFile {
    /// Full path to the file
    pub path: String,
    /// File name without path
    pub name: String,
    /// File size in bytes
    pub size: u64,
    /// File extension (lowercase, without dot)
    pub extension: Option<String>,
    /// MIME type based on extension
    pub mime_type: Option<String>,
    /// Whether file is an image
    pub is_image: bool,
    /// Whether file is a video
    pub is_video: bool,
    /// Whether file is audio
    pub is_audio: bool,
    /// Whether file is a document
    pub is_document: bool,
    /// Last modified timestamp (Unix seconds)
    pub modified: Option<u64>,
    /// Base64 thumbnail for images (small preview)
    pub thumbnail: Option<String>,
}

/// File drop event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDropEvent {
    /// Type of event: "hover", "drop", "cancel"
    pub event_type: String,
    /// List of dropped files with metadata
    pub files: Vec<DroppedFile>,
    /// Drop position (x, y) if available
    pub position: Option<(i32, i32)>,
}

/// Get MIME type from file extension
fn get_mime_type(extension: &str) -> Option<String> {
    let mime = match extension.to_lowercase().as_str() {
        // Images
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        
        // Videos
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "m4v" => "video/x-m4v",
        
        // Audio
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "opus" => "audio/opus",
        
        // Documents
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt" => "text/plain",
        "rtf" => "application/rtf",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "xml" => "application/xml",
        
        // Archives
        "zip" => "application/zip",
        "rar" => "application/vnd.rar",
        "7z" => "application/x-7z-compressed",
        "tar" => "application/x-tar",
        "gz" => "application/gzip",
        
        // Code
        "js" => "text/javascript",
        "ts" => "text/typescript",
        "html" => "text/html",
        "css" => "text/css",
        "rs" => "text/x-rust",
        "py" => "text/x-python",
        
        _ => return None,
    };
    Some(mime.to_string())
}

/// Categorize file type
fn categorize_file(extension: &str) -> (bool, bool, bool, bool) {
    let ext = extension.to_lowercase();
    let is_image = matches!(ext.as_str(), 
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif");
    let is_video = matches!(ext.as_str(), 
        "mp4" | "webm" | "mov" | "avi" | "mkv" | "m4v");
    let is_audio = matches!(ext.as_str(), 
        "mp3" | "wav" | "ogg" | "flac" | "m4a" | "aac" | "opus");
    let is_document = matches!(ext.as_str(), 
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "md" | "csv" | "json" | "xml");
    
    (is_image, is_video, is_audio, is_document)
}

/// Generate a small thumbnail for image files
fn generate_thumbnail(path: &PathBuf) -> Option<String> {
    // Only generate thumbnails for common image formats
    let extension = path.extension()?.to_str()?.to_lowercase();
    if !matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp") {
        return None;
    }
    
    // Read the file (limit to 5MB for thumbnail generation)
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() > 5 * 1024 * 1024 {
        return None;
    }
    
    // For now, just encode small images directly as base64
    // In a production app, you'd want to resize large images
    let bytes = fs::read(path).ok()?;
    if bytes.len() > 100 * 1024 {
        // Skip thumbnail for files > 100KB
        return None;
    }
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let base64_data = STANDARD.encode(&bytes);
    let mime = get_mime_type(&extension)?;
    
    Some(format!("data:{};base64,{}", mime, base64_data))
}

/// Process a file path into DroppedFile metadata
pub fn process_dropped_file(path: PathBuf) -> Option<DroppedFile> {
    let metadata = fs::metadata(&path).ok()?;
    
    // Skip directories
    if metadata.is_dir() {
        return None;
    }
    
    let name = path.file_name()?.to_str()?.to_string();
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());
    
    let mime_type = extension.as_ref()
        .and_then(|e| get_mime_type(e));
    
    let (is_image, is_video, is_audio, is_document) = extension.as_ref()
        .map(|e| categorize_file(e))
        .unwrap_or((false, false, false, false));
    
    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    // Generate thumbnail for small images
    let thumbnail = if is_image {
        generate_thumbnail(&path)
    } else {
        None
    };
    
    Some(DroppedFile {
        path: path.to_string_lossy().to_string(),
        name,
        size: metadata.len(),
        extension,
        mime_type,
        is_image,
        is_video,
        is_audio,
        is_document,
        modified,
        thumbnail,
    })
}

/// Handle file drop events and emit to frontend
pub fn handle_file_drop(app: &AppHandle, paths: Vec<PathBuf>, position: Option<(i32, i32)>) {
    let files: Vec<DroppedFile> = paths
        .into_iter()
        .filter_map(process_dropped_file)
        .collect();
    
    if files.is_empty() {
        return;
    }
    
    let event = FileDropEvent {
        event_type: "drop".to_string(),
        files,
        position,
    };
    
    // Emit to all windows
    let _ = app.emit("native-file-drop", &event);
}

/// Handle file hover events (files being dragged over window)
pub fn handle_file_hover(app: &AppHandle, paths: Vec<PathBuf>, position: Option<(i32, i32)>) {
    let file_count = paths.len();
    
    // For hover, we only send minimal info (no thumbnails)
    let files: Vec<DroppedFile> = paths
        .into_iter()
        .filter_map(|path| {
            let name = path.file_name()?.to_str()?.to_string();
            let extension = path.extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase());
            
            let (is_image, is_video, is_audio, is_document) = extension.as_ref()
                .map(|e| categorize_file(e))
                .unwrap_or((false, false, false, false));
            
            Some(DroppedFile {
                path: path.to_string_lossy().to_string(),
                name,
                size: 0, // Don't read metadata during hover
                extension: extension.clone(),
                mime_type: extension.and_then(|e| get_mime_type(&e)),
                is_image,
                is_video,
                is_audio,
                is_document,
                modified: None,
                thumbnail: None,
            })
        })
        .collect();
    
    let event = FileDropEvent {
        event_type: "hover".to_string(),
        files,
        position,
    };
    
    let _ = app.emit("native-file-drop", &event);
}

/// Handle file drop cancel (drag left window)
pub fn handle_file_cancel(app: &AppHandle) {
    let event = FileDropEvent {
        event_type: "cancel".to_string(),
        files: vec![],
        position: None,
    };
    
    let _ = app.emit("native-file-drop", &event);
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Read file contents as base64 (for small files)
#[tauri::command]
pub async fn read_file_as_base64(path: String, max_size_mb: Option<u32>) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let path = PathBuf::from(&path);
    let max_size = max_size_mb.unwrap_or(10) as u64 * 1024 * 1024;
    
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    if metadata.len() > max_size {
        return Err(format!(
            "File too large: {} bytes (max {} MB)",
            metadata.len(),
            max_size / (1024 * 1024)
        ));
    }
    
    let bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let extension = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());
    
    let mime = extension
        .and_then(|e| get_mime_type(&e))
        .unwrap_or_else(|| "application/octet-stream".to_string());
    
    let base64_data = STANDARD.encode(&bytes);
    
    Ok(format!("data:{};base64,{}", mime, base64_data))
}

/// Get thumbnail for a file path
#[tauri::command]
pub async fn get_file_thumbnail(path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&path);
    Ok(generate_thumbnail(&path))
}

/// Validate dropped files against criteria
#[tauri::command]
pub fn validate_dropped_files(
    paths: Vec<String>,
    max_file_size: Option<u64>,
    max_files: Option<usize>,
    allowed_types: Option<Vec<String>>,
) -> Result<ValidationResult, String> {
    let max_size = max_file_size.unwrap_or(25 * 1024 * 1024); // 25MB default
    let max_count = max_files.unwrap_or(10);
    
    let mut valid_files: Vec<DroppedFile> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    
    if paths.len() > max_count {
        errors.push(format!("Too many files. Maximum {} allowed.", max_count));
    }
    
    for path_str in paths.into_iter().take(max_count) {
        let path = PathBuf::from(&path_str);
        
        // Check if file exists
        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => {
                errors.push(format!("File not found: {}", path_str));
                continue;
            }
        };
        
        // Skip directories
        if metadata.is_dir() {
            errors.push(format!("Cannot upload directory: {}", path_str));
            continue;
        }
        
        // Check file size
        if metadata.len() > max_size {
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&path_str);
            errors.push(format!(
                "{} is too large ({:.1} MB). Max size: {:.1} MB",
                name,
                metadata.len() as f64 / (1024.0 * 1024.0),
                max_size as f64 / (1024.0 * 1024.0)
            ));
            continue;
        }
        
        // Check file type if restrictions specified
        if let Some(ref allowed) = allowed_types {
            let extension = path.extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase());
            
            let is_allowed = extension.as_ref()
                .map(|ext| allowed.iter().any(|a| {
                    a.to_lowercase() == *ext || 
                    a.to_lowercase() == format!(".{}", ext)
                }))
                .unwrap_or(false);
            
            if !is_allowed {
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&path_str);
                errors.push(format!("{}: File type not allowed", name));
                continue;
            }
        }
        
        // File passed validation
        if let Some(dropped) = process_dropped_file(path) {
            valid_files.push(dropped);
        }
    }
    
    Ok(ValidationResult {
        valid_files,
        errors,
    })
}

/// Validation result structure
#[derive(Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid_files: Vec<DroppedFile>,
    pub errors: Vec<String>,
}
