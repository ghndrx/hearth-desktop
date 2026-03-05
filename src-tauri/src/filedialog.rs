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

/// Open a file picker dialog and return selected file paths
#[tauri::command]
pub async fn open_file_dialog(
    app: AppHandle,
    title: Option<String>,
    filters: Option<Vec<FileDialogFilter>>,
    multiple: Option<bool>,
    default_path: Option<String>,
) -> Result<Vec<SelectedFile>, String> {
    use tauri::dialog::FileDialogBuilder;

    let mut builder = FileDialogBuilder::new(&app);

    if let Some(t) = title {
        builder = builder.set_title(&t);
    }

    if let Some(path) = default_path {
        builder = builder.set_directory(PathBuf::from(path));
    }

    if let Some(ref filter_list) = filters {
        for filter in filter_list {
            let exts: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(&filter.name, &exts);
        }
    }

    let (tx, rx) = std::sync::mpsc::channel();

    if multiple.unwrap_or(false) {
        builder.pick_files(move |paths| {
            let _ = tx.send(paths.unwrap_or_default());
        });
    } else {
        let tx_clone = tx.clone();
        builder.pick_file(move |path| {
            let _ = tx_clone.send(path.map(|p| vec![p]).unwrap_or_default());
        });
    }

    let paths = rx.recv().map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for path in paths {
        let path_buf = path.into_path().map_err(|e| e.to_string())?;
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

/// Open a save file dialog and return the selected path
#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    title: Option<String>,
    default_name: Option<String>,
    filters: Option<Vec<FileDialogFilter>>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri::dialog::FileDialogBuilder;

    let mut builder = FileDialogBuilder::new(&app);

    if let Some(t) = title {
        builder = builder.set_title(&t);
    }

    if let Some(name) = default_name {
        builder = builder.set_file_name(&name);
    }

    if let Some(path) = default_path {
        builder = builder.set_directory(PathBuf::from(path));
    }

    if let Some(ref filter_list) = filters {
        for filter in filter_list {
            let exts: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(&filter.name, &exts);
        }
    }

    let (tx, rx) = std::sync::mpsc::channel();
    builder.save_file(move |path| {
        let _ = tx.send(path);
    });

    let path = rx.recv().map_err(|e| e.to_string())?;
    Ok(path.map(|p| p.into_path().ok()).flatten().map(|p| p.to_string_lossy().to_string()))
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
    app: AppHandle,
    title: Option<String>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri::dialog::FileDialogBuilder;

    let mut builder = FileDialogBuilder::new(&app);

    if let Some(t) = title {
        builder = builder.set_title(&t);
    }

    if let Some(path) = default_path {
        builder = builder.set_directory(PathBuf::from(path));
    }

    let (tx, rx) = std::sync::mpsc::channel();
    builder.pick_folder(move |path| {
        let _ = tx.send(path);
    });

    let path = rx.recv().map_err(|e| e.to_string())?;
    Ok(path.map(|p| p.into_path().ok()).flatten().map(|p| p.to_string_lossy().to_string()))
}
