//! Native Image Optimizer - Compress and resize images before upload
//!
//! Provides:
//! - Image compression with quality control
//! - Resize to target dimensions
//! - Format conversion (PNG, JPEG, WebP)
//! - Batch optimization
//! - Size estimation

use image::{DynamicImage, ImageFormat, GenericImageView};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeResult {
    pub original_size: u64,
    pub optimized_size: u64,
    pub compression_ratio: f64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub output_path: Option<String>,
    pub base64_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeOptions {
    pub quality: Option<u8>,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub format: Option<String>,
    pub output_path: Option<String>,
    pub return_base64: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size_bytes: u64,
    pub color_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub total_original_size: u64,
    pub total_optimized_size: u64,
    pub results: Vec<BatchItemResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchItemResult {
    pub path: String,
    pub success: bool,
    pub result: Option<OptimizeResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerState {
    pub total_optimized: u64,
    pub total_bytes_saved: u64,
    pub default_quality: u8,
    pub default_max_width: u32,
    pub default_max_height: u32,
    pub preferred_format: String,
}

impl Default for OptimizerState {
    fn default() -> Self {
        Self {
            total_optimized: 0,
            total_bytes_saved: 0,
            default_quality: 85,
            default_max_width: 1920,
            default_max_height: 1080,
            preferred_format: "jpeg".to_string(),
        }
    }
}

pub struct ImageOptimizerManager {
    state: Mutex<OptimizerState>,
}

impl Default for ImageOptimizerManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(OptimizerState::default()),
        }
    }
}

fn get_format(name: &str) -> ImageFormat {
    match name.to_lowercase().as_str() {
        "png" => ImageFormat::Png,
        "webp" => ImageFormat::WebP,
        "gif" => ImageFormat::Gif,
        "bmp" => ImageFormat::Bmp,
        _ => ImageFormat::Jpeg,
    }
}

fn format_name(fmt: ImageFormat) -> String {
    match fmt {
        ImageFormat::Png => "png".to_string(),
        ImageFormat::Jpeg => "jpeg".to_string(),
        ImageFormat::WebP => "webp".to_string(),
        ImageFormat::Gif => "gif".to_string(),
        ImageFormat::Bmp => "bmp".to_string(),
        _ => "unknown".to_string(),
    }
}

fn resize_image(img: &DynamicImage, max_w: u32, max_h: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    if w <= max_w && h <= max_h {
        return img.clone();
    }
    let ratio_w = max_w as f64 / w as f64;
    let ratio_h = max_h as f64 / h as f64;
    let ratio = ratio_w.min(ratio_h);
    let new_w = (w as f64 * ratio) as u32;
    let new_h = (h as f64 * ratio) as u32;
    img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3)
}

#[tauri::command]
pub async fn image_get_info(path: String) -> Result<ImageInfo, String> {
    let file_path = PathBuf::from(&path);
    let metadata = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let fmt = image::ImageFormat::from_path(&file_path)
        .map(|f| format_name(f))
        .unwrap_or_else(|_| "unknown".to_string());
    let color = format!("{:?}", img.color());

    Ok(ImageInfo {
        path,
        width: w,
        height: h,
        format: fmt,
        size_bytes: metadata.len(),
        color_type: color,
    })
}

#[tauri::command]
pub async fn image_optimize(
    path: String,
    options: Option<OptimizeOptions>,
    manager: State<'_, ImageOptimizerManager>,
    app: AppHandle,
) -> Result<OptimizeResult, String> {
    let opts = options.unwrap_or(OptimizeOptions {
        quality: None,
        max_width: None,
        max_height: None,
        format: None,
        output_path: None,
        return_base64: None,
    });

    let file_path = PathBuf::from(&path);
    let original_size = std::fs::metadata(&file_path)
        .map_err(|e| e.to_string())?
        .len();

    let img = image::open(&file_path).map_err(|e| e.to_string())?;

    let quality = opts.quality.unwrap_or(85);
    let max_w = opts.max_width.unwrap_or(1920);
    let max_h = opts.max_height.unwrap_or(1080);
    let target_fmt = opts
        .format
        .as_deref()
        .map(get_format)
        .unwrap_or(ImageFormat::Jpeg);

    let resized = resize_image(&img, max_w, max_h);
    let (w, h) = resized.dimensions();

    let mut buffer = Cursor::new(Vec::new());
    match target_fmt {
        ImageFormat::Jpeg => {
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
            resized
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        _ => {
            resized
                .write_to(&mut buffer, target_fmt)
                .map_err(|e| e.to_string())?;
        }
    }

    let optimized_data = buffer.into_inner();
    let optimized_size = optimized_data.len() as u64;
    let compression_ratio = if original_size > 0 {
        1.0 - (optimized_size as f64 / original_size as f64)
    } else {
        0.0
    };

    let output_path = if let Some(out) = opts.output_path {
        std::fs::write(&out, &optimized_data).map_err(|e| e.to_string())?;
        Some(out)
    } else {
        None
    };

    let base64_data = if opts.return_base64.unwrap_or(false) {
        Some(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &optimized_data,
        ))
    } else {
        None
    };

    // Update stats
    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.total_optimized += 1;
        if optimized_size < original_size {
            state.total_bytes_saved += original_size - optimized_size;
        }
    }

    let result = OptimizeResult {
        original_size,
        optimized_size,
        compression_ratio,
        width: w,
        height: h,
        format: format_name(target_fmt),
        output_path,
        base64_data,
    };

    let _ = app.emit("image-optimized", &result);
    Ok(result)
}

#[tauri::command]
pub async fn image_optimize_batch(
    paths: Vec<String>,
    options: Option<OptimizeOptions>,
    manager: State<'_, ImageOptimizerManager>,
    app: AppHandle,
) -> Result<BatchResult, String> {
    let mut results = Vec::new();
    let mut total_original = 0u64;
    let mut total_optimized = 0u64;
    let mut succeeded = 0usize;
    let mut failed = 0usize;

    for path in &paths {
        match image_optimize_single(path, &options, &manager).await {
            Ok(result) => {
                total_original += result.original_size;
                total_optimized += result.optimized_size;
                succeeded += 1;
                results.push(BatchItemResult {
                    path: path.clone(),
                    success: true,
                    result: Some(result),
                    error: None,
                });
            }
            Err(e) => {
                failed += 1;
                results.push(BatchItemResult {
                    path: path.clone(),
                    success: false,
                    result: None,
                    error: Some(e),
                });
            }
        }
    }

    let batch = BatchResult {
        total: paths.len(),
        succeeded,
        failed,
        total_original_size: total_original,
        total_optimized_size: total_optimized,
        results,
    };

    let _ = app.emit("image-batch-complete", &batch);
    Ok(batch)
}

async fn image_optimize_single(
    path: &str,
    options: &Option<OptimizeOptions>,
    manager: &State<'_, ImageOptimizerManager>,
) -> Result<OptimizeResult, String> {
    let opts = options.as_ref();
    let file_path = PathBuf::from(path);
    let original_size = std::fs::metadata(&file_path)
        .map_err(|e| e.to_string())?
        .len();
    let img = image::open(&file_path).map_err(|e| e.to_string())?;

    let quality = opts.and_then(|o| o.quality).unwrap_or(85);
    let max_w = opts.and_then(|o| o.max_width).unwrap_or(1920);
    let max_h = opts.and_then(|o| o.max_height).unwrap_or(1080);
    let target_fmt = opts
        .and_then(|o| o.format.as_deref())
        .map(get_format)
        .unwrap_or(ImageFormat::Jpeg);

    let resized = resize_image(&img, max_w, max_h);
    let (w, h) = resized.dimensions();

    let mut buffer = Cursor::new(Vec::new());
    match target_fmt {
        ImageFormat::Jpeg => {
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
            resized
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        _ => {
            resized
                .write_to(&mut buffer, target_fmt)
                .map_err(|e| e.to_string())?;
        }
    }

    let optimized_data = buffer.into_inner();
    let optimized_size = optimized_data.len() as u64;
    let compression_ratio = if original_size > 0 {
        1.0 - (optimized_size as f64 / original_size as f64)
    } else {
        0.0
    };

    {
        let mut state = manager.state.lock().map_err(|e| e.to_string())?;
        state.total_optimized += 1;
        if optimized_size < original_size {
            state.total_bytes_saved += original_size - optimized_size;
        }
    }

    Ok(OptimizeResult {
        original_size,
        optimized_size,
        compression_ratio,
        width: w,
        height: h,
        format: format_name(target_fmt),
        output_path: None,
        base64_data: None,
    })
}

#[tauri::command]
pub async fn image_estimate_size(
    path: String,
    quality: Option<u8>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    format: Option<String>,
) -> Result<OptimizeResult, String> {
    let file_path = PathBuf::from(&path);
    let original_size = std::fs::metadata(&file_path)
        .map_err(|e| e.to_string())?
        .len();
    let img = image::open(&file_path).map_err(|e| e.to_string())?;

    let q = quality.unwrap_or(85);
    let mw = max_width.unwrap_or(1920);
    let mh = max_height.unwrap_or(1080);
    let fmt = format.as_deref().map(get_format).unwrap_or(ImageFormat::Jpeg);

    let resized = resize_image(&img, mw, mh);
    let (w, h) = resized.dimensions();

    let mut buffer = Cursor::new(Vec::new());
    match fmt {
        ImageFormat::Jpeg => {
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, q);
            resized
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        _ => {
            resized
                .write_to(&mut buffer, fmt)
                .map_err(|e| e.to_string())?;
        }
    }

    let estimated_size = buffer.into_inner().len() as u64;
    let compression_ratio = if original_size > 0 {
        1.0 - (estimated_size as f64 / original_size as f64)
    } else {
        0.0
    };

    Ok(OptimizeResult {
        original_size,
        optimized_size: estimated_size,
        compression_ratio,
        width: w,
        height: h,
        format: format_name(fmt),
        output_path: None,
        base64_data: None,
    })
}

#[tauri::command]
pub async fn image_get_optimizer_stats(
    manager: State<'_, ImageOptimizerManager>,
) -> Result<OptimizerState, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

#[tauri::command]
pub async fn image_set_defaults(
    quality: Option<u8>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    format: Option<String>,
    manager: State<'_, ImageOptimizerManager>,
) -> Result<OptimizerState, String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    if let Some(q) = quality {
        state.default_quality = q;
    }
    if let Some(w) = max_width {
        state.default_max_width = w;
    }
    if let Some(h) = max_height {
        state.default_max_height = h;
    }
    if let Some(f) = format {
        state.preferred_format = f;
    }
    Ok(state.clone())
}
