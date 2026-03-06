use tauri::AppHandle;
use std::path::PathBuf;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileDialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(serde::Serialize)]
pub struct SelectedFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

/// Open a file picker dialog and return selected file paths.
/// Note: tauri::dialog / tauri_plugin_dialog is not available. This uses a
/// platform fallback (zenity on Linux, osascript on macOS, PowerShell on Windows).
#[tauri::command]
pub async fn open_file_dialog(
    _app: AppHandle,
    title: Option<String>,
    _filters: Option<Vec<FileDialogFilter>>,
    multiple: Option<bool>,
    _default_path: Option<String>,
) -> Result<Vec<SelectedFile>, String> {
    let title_str = title.unwrap_or_else(|| "Open File".to_string());

    #[cfg(target_os = "linux")]
    let paths: Vec<PathBuf> = {
        let mut args = vec![
            "--file-selection".to_string(),
            format!("--title={}", title_str),
        ];
        if multiple.unwrap_or(false) {
            args.push("--multiple".to_string());
            args.push("--separator=|".to_string());
        }
        let output = std::process::Command::new("zenity")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to open file dialog: {}", e))?;
        if !output.status.success() {
            return Ok(Vec::new());
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .trim()
            .split('|')
            .filter(|s| !s.is_empty())
            .map(|s| PathBuf::from(s))
            .collect()
    };

    #[cfg(target_os = "macos")]
    let paths: Vec<PathBuf> = {
        let script = if multiple.unwrap_or(false) {
            format!(
                "osascript -e 'set theFiles to choose file with prompt \"{}\" with multiple selections allowed' -e 'set output to \"\"' -e 'repeat with f in theFiles' -e 'set output to output & POSIX path of f & \"|\"' -e 'end repeat' -e 'return output'",
                title_str
            )
        } else {
            format!(
                "osascript -e 'POSIX path of (choose file with prompt \"{}\")'",
                title_str
            )
        };
        let output = std::process::Command::new("sh")
            .args(["-c", &script])
            .output()
            .map_err(|e| format!("Failed to open file dialog: {}", e))?;
        if !output.status.success() {
            return Ok(Vec::new());
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .trim()
            .split('|')
            .filter(|s| !s.is_empty())
            .map(|s| PathBuf::from(s))
            .collect()
    };

    #[cfg(target_os = "windows")]
    let paths: Vec<PathBuf> = {
        let _ = title_str;
        let _ = multiple;
        // Minimal fallback
        return Err("File dialog not available without tauri-plugin-dialog".to_string());
    };

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    let paths: Vec<PathBuf> = {
        return Err("File dialog not supported on this platform".to_string());
    };

    let mut results = Vec::new();
    for path_buf in paths {
        let metadata = std::fs::metadata(&path_buf).map_err(|e| e.to_string())?;
        results.push(SelectedFile {
            name: path_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: path_buf.to_string_lossy().to_string(),
            size: metadata.len(),
        });
    }

    Ok(results)
}

/// Open a save file dialog and return the selected path.
#[tauri::command]
pub async fn save_file_dialog(
    _app: AppHandle,
    title: Option<String>,
    default_name: Option<String>,
    _filters: Option<Vec<FileDialogFilter>>,
    _default_path: Option<String>,
) -> Result<Option<String>, String> {
    let title_str = title.unwrap_or_else(|| "Save File".to_string());
    let _default = default_name.unwrap_or_default();

    #[cfg(target_os = "linux")]
    {
        let mut args = vec![
            "--file-selection".to_string(),
            "--save".to_string(),
            format!("--title={}", title_str),
        ];
        if !_default.is_empty() {
            args.push(format!("--filename={}", _default));
        }
        let output = std::process::Command::new("zenity")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to open save dialog: {}", e))?;
        if !output.status.success() {
            return Ok(None);
        }
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }
        return Ok(Some(path));
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "osascript -e 'POSIX path of (choose file name with prompt \"{}\" default name \"{}\")'",
            title_str, _default
        );
        let output = std::process::Command::new("sh")
            .args(["-c", &script])
            .output()
            .map_err(|e| format!("Failed to open save dialog: {}", e))?;
        if !output.status.success() {
            return Ok(None);
        }
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }
        return Ok(Some(path));
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        Err("Save dialog not available without tauri-plugin-dialog".to_string())
    }
}

/// Write content to a file (used after save dialog)
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

/// Write binary content to a file
#[tauri::command]
pub async fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())
}

/// Read file as bytes
#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Get file metadata
#[tauri::command]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(FileMetadata {
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        modified: metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
    })
}

#[derive(serde::Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<u64>,
}

/// Open a folder picker dialog
#[tauri::command]
pub async fn pick_folder_dialog(
    _app: AppHandle,
    title: Option<String>,
    _default_path: Option<String>,
) -> Result<Option<String>, String> {
    let title_str = title.unwrap_or_else(|| "Select Folder".to_string());

    #[cfg(target_os = "linux")]
    {
        let title_arg = format!("--title={}", title_str);
        let output = std::process::Command::new("zenity")
            .args(["--file-selection", "--directory", &title_arg])
            .output()
            .map_err(|e| format!("Failed to open folder dialog: {}", e))?;
        if !output.status.success() {
            return Ok(None);
        }
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }
        return Ok(Some(path));
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "osascript -e 'POSIX path of (choose folder with prompt \"{}\")'",
            title_str
        );
        let output = std::process::Command::new("sh")
            .args(["-c", &script])
            .output()
            .map_err(|e| format!("Failed to open folder dialog: {}", e))?;
        if !output.status.success() {
            return Ok(None);
        }
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }
        return Ok(Some(path));
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        Err("Folder dialog not available without tauri-plugin-dialog".to_string())
    }
}
