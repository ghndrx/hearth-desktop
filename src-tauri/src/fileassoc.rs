use serde::{Deserialize, Serialize};
use tauri::Manager;

/// Represents a file opened via OS file association
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssociatedFile {
    /// Full path to the file
    pub path: String,
    /// File name (without directory)
    pub name: String,
    /// File extension (lowercase, without dot)
    pub extension: Option<String>,
    /// MIME type of the file
    pub mime_type: Option<String>,
    /// File size in bytes
    pub size: u64,
}

/// Supported file types for association
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAssociation {
    /// File extension (without dot)
    pub extension: String,
    /// MIME type
    pub mime_type: String,
    /// Human-readable description
    pub description: String,
    /// Whether this association is currently registered
    pub registered: bool,
}

/// Get the list of file types Hearth can handle
#[tauri::command]
pub fn get_supported_file_associations() -> Vec<FileAssociation> {
    vec![
        FileAssociation {
            extension: "hearth".into(),
            mime_type: "application/x-hearth".into(),
            description: "Hearth Chat Export".into(),
            registered: true,
        },
        FileAssociation {
            extension: "hearthkey".into(),
            mime_type: "application/x-hearth-key".into(),
            description: "Hearth Encryption Key".into(),
            registered: true,
        },
        FileAssociation {
            extension: "hearthbackup".into(),
            mime_type: "application/x-hearth-backup".into(),
            description: "Hearth Chat Backup".into(),
            registered: true,
        },
    ]
}

/// Handle a file opened via OS file association
#[tauri::command]
pub async fn handle_associated_file(app: tauri::AppHandle, path: String) -> Result<AssociatedFile, String> {
    let file_path = std::path::PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());

    let mime_type = extension.as_deref().map(|ext| match ext {
        "hearth" => "application/x-hearth",
        "hearthkey" => "application/x-hearth-key",
        "hearthbackup" => "application/x-hearth-backup",
        "png" | "jpg" | "jpeg" | "gif" | "webp" => "image/*",
        "mp4" | "webm" | "mov" => "video/*",
        "mp3" | "ogg" | "wav" | "flac" => "audio/*",
        "pdf" => "application/pdf",
        "txt" | "md" => "text/plain",
        _ => "application/octet-stream",
    }).map(|s| s.to_string());

    let associated_file = AssociatedFile {
        path: path.clone(),
        name,
        extension,
        mime_type,
        size: metadata.len(),
    };

    // Emit event to frontend so it can handle the file
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("file-association-open", &associated_file);
        // Ensure window is visible and focused
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(associated_file)
}

/// Import a .hearth chat export file
#[tauri::command]
pub async fn import_chat_export(path: String) -> Result<ChatExportInfo, String> {
    let file_path = std::path::PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Parse the export file (JSON format)
    let export: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid export file format: {}", e))?;

    let channel_name = export.get("channel_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Channel")
        .to_string();

    let message_count = export.get("messages")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let exported_at = export.get("exported_at")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let server_name = export.get("server_name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(ChatExportInfo {
        path,
        channel_name,
        server_name,
        message_count,
        exported_at,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatExportInfo {
    pub path: String,
    pub channel_name: String,
    pub server_name: Option<String>,
    pub message_count: usize,
    pub exported_at: String,
}

/// Handle file association arguments passed at app launch
pub fn handle_launch_files(app: &tauri::AppHandle, args: &[String]) {
    for arg in args {
        let path = std::path::PathBuf::from(arg);
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            match ext.to_lowercase().as_str() {
                "hearth" | "hearthkey" | "hearthbackup" => {
                    if path.exists() {
                        if let Some(window) = app.get_webview_window("main") {
                            let file = AssociatedFile {
                                path: arg.clone(),
                                name: path.file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string(),
                                extension: Some(ext.to_lowercase()),
                                mime_type: Some(format!("application/x-hearth-{}", ext.to_lowercase())),
                                size: std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
                            };
                            let _ = window.emit("file-association-open", &file);
                        }
                    }
                }
                _ => {}
            }
        }
    }
}
