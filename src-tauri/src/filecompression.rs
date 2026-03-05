//! File Compression - Native zip/unzip support
//!
//! Provides:
//! - Create ZIP archives from files/directories
//! - Extract ZIP archives
//! - List archive contents
//! - Compression level control
//! - Progress reporting

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write as IoWrite};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    pub path: String,
    pub total_files: usize,
    pub total_size: u64,
    pub compressed_size: u64,
    pub entries: Vec<ArchiveEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionResult {
    pub output_path: String,
    pub total_files: usize,
    pub original_size: u64,
    pub compressed_size: u64,
    pub compression_ratio: f64,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionResult {
    pub output_dir: String,
    pub total_files: usize,
    pub total_size: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionState {
    pub total_compressed: u64,
    pub total_extracted: u64,
    pub total_bytes_saved: u64,
    pub is_busy: bool,
}

impl Default for CompressionState {
    fn default() -> Self {
        Self {
            total_compressed: 0,
            total_extracted: 0,
            total_bytes_saved: 0,
            is_busy: false,
        }
    }
}

pub struct FileCompressionManager {
    state: Mutex<CompressionState>,
}

impl Default for FileCompressionManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(CompressionState::default()),
        }
    }
}

fn collect_files(dir: &Path, base: &Path) -> Result<Vec<(PathBuf, String)>, String> {
    let mut files = Vec::new();
    if dir.is_file() {
        let name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        files.push((dir.to_path_buf(), name));
        return Ok(files);
    }

    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if path.is_dir() {
            files.extend(collect_files(&path, base)?);
        } else {
            files.push((path, rel));
        }
    }
    Ok(files)
}

#[tauri::command]
pub async fn compress_files(
    paths: Vec<String>,
    output_path: String,
    manager: State<'_, FileCompressionManager>,
    app: AppHandle,
) -> Result<CompressionResult, String> {
    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        if state.is_busy {
            return Err("Compression already in progress".to_string());
        }
        state.is_busy = true;
    }

    let start = std::time::Instant::now();
    let _ = app.emit("compression-started", &output_path);

    let file = File::create(&output_path).map_err(|e| {
        if let Ok(mut s) = manager.state.lock() {
            s.is_busy = false;
        }
        e.to_string()
    })?;

    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut total_files = 0usize;
    let mut original_size = 0u64;

    for path_str in &paths {
        let path = PathBuf::from(path_str);
        let base = path.parent().unwrap_or(&path);
        let files = collect_files(&path, base).map_err(|e| {
            if let Ok(mut s) = manager.state.lock() {
                s.is_busy = false;
            }
            e
        })?;

        for (file_path, rel_name) in files {
            if file_path.is_file() {
                let mut f = File::open(&file_path).map_err(|e| e.to_string())?;
                let metadata = f.metadata().map_err(|e| e.to_string())?;
                original_size += metadata.len();

                zip.start_file(&rel_name, options).map_err(|e| e.to_string())?;
                let mut buffer = Vec::new();
                f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                zip.write_all(&buffer).map_err(|e| e.to_string())?;

                total_files += 1;
                let _ = app.emit(
                    "compression-progress",
                    serde_json::json!({"file": rel_name, "count": total_files}),
                );
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    let compressed_size = fs::metadata(&output_path)
        .map_err(|e| e.to_string())?
        .len();

    let compression_ratio = if original_size > 0 {
        1.0 - (compressed_size as f64 / original_size as f64)
    } else {
        0.0
    };

    let duration = start.elapsed().as_millis() as u64;

    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.is_busy = false;
        state.total_compressed += 1;
        if compressed_size < original_size {
            state.total_bytes_saved += original_size - compressed_size;
        }
    }

    let result = CompressionResult {
        output_path,
        total_files,
        original_size,
        compressed_size,
        compression_ratio,
        duration_ms: duration,
    };

    let _ = app.emit("compression-complete", &result);
    Ok(result)
}

#[tauri::command]
pub async fn extract_archive(
    archive_path: String,
    output_dir: String,
    manager: State<'_, FileCompressionManager>,
    app: AppHandle,
) -> Result<ExtractionResult, String> {
    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        if state.is_busy {
            return Err("Operation already in progress".to_string());
        }
        state.is_busy = true;
    }

    let start = std::time::Instant::now();
    let _ = app.emit("extraction-started", &archive_path);

    let file = File::open(&archive_path).map_err(|e| {
        if let Ok(mut s) = manager.state.lock() {
            s.is_busy = false;
        }
        e.to_string()
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        if let Ok(mut s) = manager.state.lock() {
            s.is_busy = false;
        }
        e.to_string()
    })?;

    let output = PathBuf::from(&output_dir);
    fs::create_dir_all(&output).map_err(|e| e.to_string())?;

    let mut total_files = 0usize;
    let mut total_size = 0u64;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_path = output.join(
            entry
                .enclosed_name()
                .ok_or("Invalid entry name")?,
        );

        if entry.is_dir() {
            fs::create_dir_all(&entry_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = entry_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&entry_path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            entry.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            outfile.write_all(&buffer).map_err(|e| e.to_string())?;
            total_size += buffer.len() as u64;
            total_files += 1;

            let _ = app.emit(
                "extraction-progress",
                serde_json::json!({
                    "file": entry.name(),
                    "count": total_files,
                    "total": archive.len()
                }),
            );
        }
    }

    let duration = start.elapsed().as_millis() as u64;

    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.is_busy = false;
        state.total_extracted += 1;
    }

    let result = ExtractionResult {
        output_dir,
        total_files,
        total_size,
        duration_ms: duration,
    };

    let _ = app.emit("extraction-complete", &result);
    Ok(result)
}

#[tauri::command]
pub async fn list_archive(archive_path: String) -> Result<ArchiveInfo, String> {
    let file = File::open(&archive_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    let mut total_size = 0u64;
    let compressed_size = fs::metadata(&archive_path)
        .map_err(|e| e.to_string())?
        .len();

    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let size = entry.size();
        total_size += size;
        entries.push(ArchiveEntry {
            name: entry
                .enclosed_name()
                .map(|p| {
                    p.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default()
                })
                .unwrap_or_default(),
            path: entry.name().to_string(),
            size,
            compressed_size: entry.compressed_size(),
            is_directory: entry.is_dir(),
        });
    }

    Ok(ArchiveInfo {
        path: archive_path,
        total_files: entries.iter().filter(|e| !e.is_directory).count(),
        total_size,
        compressed_size,
        entries,
    })
}

#[tauri::command]
pub async fn compression_get_state(
    manager: State<'_, FileCompressionManager>,
) -> Result<CompressionState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub async fn compression_is_busy(
    manager: State<'_, FileCompressionManager>,
) -> Result<bool, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.is_busy)
}
