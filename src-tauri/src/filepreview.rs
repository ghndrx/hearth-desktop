//! Native File Preview - Preview files with metadata extraction
//!
//! Provides:
//! - File type detection and preview categorization
//! - Image thumbnail generation and resizing
//! - Text/code file reading with line limits
//! - Archive content listing
//! - Hex dump viewing for binary files
//! - EXIF/metadata extraction
//! - System file icon retrieval

use base64::Engine;
use image::{DynamicImage, GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum PreviewType {
    Image,
    Video,
    Audio,
    Text,
    Code,
    Pdf,
    Archive,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub mime_type: String,
    pub preview_type: PreviewType,
    pub dimensions: Option<ImageDimensions>,
    pub duration: Option<f64>,
    pub line_count: Option<usize>,
    pub entries: Option<Vec<ArchiveEntryInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntryInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextContent {
    pub content: String,
    pub line_count: usize,
    pub truncated: bool,
    pub encoding: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDataResult {
    pub base64: String,
    pub width: u32,
    pub height: u32,
    pub original_width: u32,
    pub original_height: u32,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexDumpResult {
    pub offset: u64,
    pub length: usize,
    pub hex_lines: Vec<HexLine>,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexLine {
    pub offset: String,
    pub hex: String,
    pub ascii: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub accessed: Option<String>,
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub mime_type: String,
    pub preview_type: PreviewType,
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileIconResult {
    pub base64: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedTypes {
    pub image: Vec<String>,
    pub video: Vec<String>,
    pub audio: Vec<String>,
    pub text: Vec<String>,
    pub code: Vec<String>,
    pub pdf: Vec<String>,
    pub archive: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewManagerState {
    pub total_previews: u64,
    pub thumbnail_cache_size: usize,
}

impl Default for PreviewManagerState {
    fn default() -> Self {
        Self {
            total_previews: 0,
            thumbnail_cache_size: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

pub struct FilePreviewManager {
    state: Mutex<PreviewManagerState>,
    thumbnail_cache: Mutex<HashMap<String, ThumbnailResult>>,
}

impl Default for FilePreviewManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(PreviewManagerState::default()),
            thumbnail_cache: Mutex::new(HashMap::new()),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mov"];
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "flac"];
const TEXT_EXTENSIONS: &[&str] = &["txt", "md", "json", "yaml", "yml", "toml", "xml", "csv"];
const CODE_EXTENSIONS: &[&str] = &["rs", "js", "ts", "py", "html", "css", "svelte", "jsx", "tsx", "vue", "go", "rb", "java", "c", "cpp", "h", "hpp", "sh", "bash", "zsh"];
const PDF_EXTENSIONS: &[&str] = &["pdf"];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "tar", "gz", "tgz", "tar.gz"];

fn get_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn classify_file(ext: &str) -> PreviewType {
    if IMAGE_EXTENSIONS.contains(&ext) {
        PreviewType::Image
    } else if VIDEO_EXTENSIONS.contains(&ext) {
        PreviewType::Video
    } else if AUDIO_EXTENSIONS.contains(&ext) {
        PreviewType::Audio
    } else if TEXT_EXTENSIONS.contains(&ext) {
        PreviewType::Text
    } else if CODE_EXTENSIONS.contains(&ext) {
        PreviewType::Code
    } else if PDF_EXTENSIONS.contains(&ext) {
        PreviewType::Pdf
    } else if ARCHIVE_EXTENSIONS.contains(&ext) {
        PreviewType::Archive
    } else {
        PreviewType::Unknown
    }
}

fn extension_to_mime(ext: &str) -> String {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "yaml" | "yml" => "application/x-yaml",
        "toml" => "application/toml",
        "xml" => "application/xml",
        "csv" => "text/csv",
        "rs" => "text/x-rust",
        "js" => "text/javascript",
        "ts" => "text/typescript",
        "py" => "text/x-python",
        "html" => "text/html",
        "css" => "text/css",
        "svelte" => "text/x-svelte",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" | "tgz" => "application/gzip",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn count_lines(path: &Path) -> Result<usize, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    Ok(reader.lines().count())
}

fn get_image_dimensions(path: &Path) -> Result<ImageDimensions, String> {
    let img = image::open(path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    Ok(ImageDimensions {
        width: w,
        height: h,
    })
}

fn resize_image(img: &DynamicImage, max_w: u32, max_h: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    if w <= max_w && h <= max_h {
        return img.clone();
    }
    let ratio_w = max_w as f64 / w as f64;
    let ratio_h = max_h as f64 / h as f64;
    let ratio = ratio_w.min(ratio_h);
    let new_w = (w as f64 * ratio).max(1.0) as u32;
    let new_h = (h as f64 * ratio).max(1.0) as u32;
    img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3)
}

fn image_to_base64_png(img: &DynamicImage) -> Result<String, String> {
    let mut buffer = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buffer, ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buffer.into_inner()))
}

fn list_zip_entries(path: &Path) -> Result<Vec<ArchiveEntryInfo>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        entries.push(ArchiveEntryInfo {
            name: entry
                .enclosed_name()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
                .unwrap_or_default(),
            path: entry.name().to_string(),
            size: entry.size(),
            compressed_size: entry.compressed_size(),
            is_directory: entry.is_dir(),
        });
    }
    Ok(entries)
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn preview_get_info(
    path: String,
    manager: State<'_, FilePreviewManager>,
) -> Result<PreviewInfo, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext = get_extension(&path);
    let preview_type = classify_file(&ext);
    let mime_type = extension_to_mime(&ext);

    let dimensions = if preview_type == PreviewType::Image {
        get_image_dimensions(&file_path).ok()
    } else {
        None
    };

    let line_count = if preview_type == PreviewType::Text || preview_type == PreviewType::Code {
        count_lines(&file_path).ok()
    } else {
        None
    };

    let entries = if preview_type == PreviewType::Archive && ext == "zip" {
        list_zip_entries(&file_path).ok()
    } else {
        None
    };

    // Update stats
    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.total_previews += 1;
    }

    Ok(PreviewInfo {
        file_path: path,
        file_name,
        file_size: metadata.len(),
        mime_type,
        preview_type,
        dimensions,
        duration: None, // Duration requires media parsing libraries
        line_count,
        entries,
    })
}

#[tauri::command]
pub async fn preview_get_thumbnail(
    manager: State<'_, FilePreviewManager>,
    path: String,
    size: Option<u32>,
) -> Result<ThumbnailResult, String> {
    let thumb_size = size.unwrap_or(256);
    let cache_key = format!("{}:{}", path, thumb_size);

    // Check cache
    {
        let cache = manager.thumbnail_cache.lock().map_err(|e| e.to_string())?;
        if let Some(cached) = cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }

    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let ext = get_extension(&path);
    let preview_type = classify_file(&ext);

    if preview_type != PreviewType::Image {
        return Err("Thumbnails only supported for image files".to_string());
    }

    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    let thumbnail = resize_image(&img, thumb_size, thumb_size);
    let (w, h) = thumbnail.dimensions();
    let base64_data = image_to_base64_png(&thumbnail)?;

    let result = ThumbnailResult {
        base64: base64_data,
        width: w,
        height: h,
        format: "png".to_string(),
    };

    // Update cache
    {
        let mut cache = manager.thumbnail_cache.lock().map_err(|e| e.to_string())?;
        cache.insert(cache_key, result.clone());
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.thumbnail_cache_size = cache.len();
    }

    Ok(result)
}

#[tauri::command]
pub async fn preview_read_text(
    path: String,
    max_lines: Option<usize>,
) -> Result<TextContent, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let limit = max_lines.unwrap_or(500);
    let file = File::open(&file_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    let mut lines_collected = Vec::new();
    let mut total_lines = 0usize;
    let mut truncated = false;

    for line_result in reader.lines() {
        let line = line_result.map_err(|e| e.to_string())?;
        total_lines += 1;
        if total_lines <= limit {
            lines_collected.push(line);
        } else {
            truncated = true;
        }
    }

    Ok(TextContent {
        content: lines_collected.join("\n"),
        line_count: total_lines,
        truncated,
        encoding: "utf-8".to_string(),
    })
}

#[tauri::command]
pub async fn preview_list_archive(path: String) -> Result<Vec<ArchiveEntryInfo>, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let ext = get_extension(&path);
    if ext == "zip" {
        list_zip_entries(&file_path)
    } else {
        Err(format!(
            "Archive listing not supported for .{} files (only .zip supported)",
            ext
        ))
    }
}

#[tauri::command]
pub async fn preview_get_image_data(
    path: String,
    max_width: Option<u32>,
    max_height: Option<u32>,
) -> Result<ImageDataResult, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    let (orig_w, orig_h) = img.dimensions();

    let mw = max_width.unwrap_or(1920);
    let mh = max_height.unwrap_or(1080);
    let resized = resize_image(&img, mw, mh);
    let (w, h) = resized.dimensions();

    let base64_data = image_to_base64_png(&resized)?;

    Ok(ImageDataResult {
        base64: base64_data,
        width: w,
        height: h,
        original_width: orig_w,
        original_height: orig_h,
        format: "png".to_string(),
    })
}

#[tauri::command]
pub async fn preview_is_supported(path: String) -> Result<bool, String> {
    let ext = get_extension(&path);
    let ptype = classify_file(&ext);
    Ok(ptype != PreviewType::Unknown)
}

#[tauri::command]
pub async fn preview_get_supported_types() -> Result<SupportedTypes, String> {
    Ok(SupportedTypes {
        image: IMAGE_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        video: VIDEO_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        audio: AUDIO_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        text: TEXT_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        code: CODE_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        pdf: PDF_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        archive: ARCHIVE_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
    })
}

#[tauri::command]
pub async fn preview_get_file_icon(path: String) -> Result<FileIconResult, String> {
    // Generate a simple colored icon based on file type
    let ext = get_extension(&path);
    let preview_type = classify_file(&ext);

    // Create a 32x32 colored icon representing the file type
    let color: [u8; 3] = match preview_type {
        PreviewType::Image => [88, 101, 242],    // #5865f2 blue
        PreviewType::Video => [237, 66, 69],      // red
        PreviewType::Audio => [87, 242, 135],     // green
        PreviewType::Text => [254, 231, 92],      // yellow
        PreviewType::Code => [235, 69, 158],      // pink
        PreviewType::Pdf => [237, 66, 69],        // red
        PreviewType::Archive => [88, 101, 242],   // blue
        PreviewType::Unknown => [148, 155, 164],  // gray
    };

    let mut img_buf = image::RgbaImage::new(32, 32);
    for pixel in img_buf.pixels_mut() {
        *pixel = image::Rgba([color[0], color[1], color[2], 255]);
    }

    // Draw a simple file shape (lighter inner region)
    for y in 4..28 {
        for x in 6..26 {
            let is_fold = x > 18 && y < 10;
            if !is_fold {
                img_buf.put_pixel(
                    x,
                    y,
                    image::Rgba([
                        color[0].saturating_add(60),
                        color[1].saturating_add(60),
                        color[2].saturating_add(60),
                        255,
                    ]),
                );
            }
        }
    }

    let dynamic = DynamicImage::ImageRgba8(img_buf);
    let base64_data = image_to_base64_png(&dynamic)?;

    Ok(FileIconResult {
        base64: base64_data,
        format: "png".to_string(),
    })
}

#[tauri::command]
pub async fn preview_extract_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext = get_extension(&path);
    let preview_type = classify_file(&ext);
    let mime_type = extension_to_mime(&ext);

    let created = metadata
        .created()
        .ok()
        .and_then(|t| {
            let datetime: chrono::DateTime<chrono::Utc> = t.into();
            Some(datetime.to_rfc3339())
        });

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| {
            let datetime: chrono::DateTime<chrono::Utc> = t.into();
            Some(datetime.to_rfc3339())
        });

    let accessed = metadata
        .accessed()
        .ok()
        .and_then(|t| {
            let datetime: chrono::DateTime<chrono::Utc> = t.into();
            Some(datetime.to_rfc3339())
        });

    let is_readonly = metadata.permissions().readonly();

    #[cfg(unix)]
    let is_hidden = file_name.starts_with('.');
    #[cfg(not(unix))]
    let is_hidden = false;

    let mut extra = HashMap::new();

    // Add image-specific metadata
    if preview_type == PreviewType::Image {
        if let Ok(dims) = get_image_dimensions(&file_path) {
            extra.insert("width".to_string(), dims.width.to_string());
            extra.insert("height".to_string(), dims.height.to_string());
            extra.insert(
                "megapixels".to_string(),
                format!("{:.1}", (dims.width as f64 * dims.height as f64) / 1_000_000.0),
            );
        }
        if let Ok(fmt) = ImageFormat::from_path(&file_path) {
            extra.insert("imageFormat".to_string(), format!("{:?}", fmt));
        }
    }

    // Add text-specific metadata
    if preview_type == PreviewType::Text || preview_type == PreviewType::Code {
        if let Ok(lc) = count_lines(&file_path) {
            extra.insert("lineCount".to_string(), lc.to_string());
        }
    }

    // Add archive-specific metadata
    if preview_type == PreviewType::Archive && ext == "zip" {
        if let Ok(entries) = list_zip_entries(&file_path) {
            let file_count = entries.iter().filter(|e| !e.is_directory).count();
            let dir_count = entries.iter().filter(|e| e.is_directory).count();
            let total_uncompressed: u64 = entries.iter().map(|e| e.size).sum();
            extra.insert("fileCount".to_string(), file_count.to_string());
            extra.insert("directoryCount".to_string(), dir_count.to_string());
            extra.insert("uncompressedSize".to_string(), total_uncompressed.to_string());
        }
    }

    extra.insert("extension".to_string(), ext);

    Ok(FileMetadata {
        file_path: path,
        file_name,
        file_size: metadata.len(),
        created,
        modified,
        accessed,
        is_readonly,
        is_hidden,
        mime_type,
        preview_type,
        extra,
    })
}

#[tauri::command]
pub async fn preview_get_hex_dump(
    path: String,
    offset: Option<u64>,
    length: Option<usize>,
) -> Result<HexDumpResult, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let total_size = fs::metadata(&file_path).map_err(|e| e.to_string())?.len();
    let start_offset = offset.unwrap_or(0);
    let read_length = length.unwrap_or(256).min(4096); // Cap at 4KB per request

    let mut file = File::open(&file_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(start_offset))
        .map_err(|e| e.to_string())?;

    let mut buffer = vec![0u8; read_length];
    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(bytes_read);

    let mut hex_lines = Vec::new();
    for chunk_start in (0..bytes_read).step_by(16) {
        let chunk_end = (chunk_start + 16).min(bytes_read);
        let chunk = &buffer[chunk_start..chunk_end];

        let offset_str = format!("{:08X}", start_offset as usize + chunk_start);

        let hex_parts: Vec<String> = chunk.iter().map(|b| format!("{:02X}", b)).collect();
        let mut hex_str = String::new();
        for (i, h) in hex_parts.iter().enumerate() {
            if i > 0 && i % 8 == 0 {
                hex_str.push(' ');
            }
            if i > 0 {
                hex_str.push(' ');
            }
            hex_str.push_str(h);
        }
        // Pad to full width if short line
        let expected_len = 16 * 3 - 1 + 1; // "XX " * 16 - trailing space + middle gap
        while hex_str.len() < expected_len {
            hex_str.push(' ');
        }

        let ascii_str: String = chunk
            .iter()
            .map(|&b| {
                if b >= 0x20 && b <= 0x7E {
                    b as char
                } else {
                    '.'
                }
            })
            .collect();

        hex_lines.push(HexLine {
            offset: offset_str,
            hex: hex_str,
            ascii: ascii_str,
        });
    }

    Ok(HexDumpResult {
        offset: start_offset,
        length: bytes_read,
        hex_lines,
        total_size,
    })
}
