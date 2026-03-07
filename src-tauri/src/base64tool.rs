//! Base64 Tool - Encode and decode Base64 with native Rust
//!
//! Provides:
//! - Standard Base64 encoding/decoding (RFC 4648)
//! - URL-safe Base64 variant
//! - File-to-Base64 conversion
//! - Size statistics

use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Base64Result {
    pub output: String,
    pub input_size: usize,
    pub output_size: usize,
}

#[tauri::command]
pub fn base64_encode(text: String, url_safe: Option<bool>) -> Base64Result {
    let input_size = text.len();
    let output = if url_safe.unwrap_or(false) {
        general_purpose::URL_SAFE.encode(text.as_bytes())
    } else {
        general_purpose::STANDARD.encode(text.as_bytes())
    };
    let output_size = output.len();

    Base64Result {
        output,
        input_size,
        output_size,
    }
}

#[tauri::command]
pub fn base64_decode(encoded: String, url_safe: Option<bool>) -> Result<Base64Result, String> {
    let input_size = encoded.len();
    let clean = encoded.trim().replace('\n', "").replace('\r', "");

    let bytes = if url_safe.unwrap_or(false) {
        general_purpose::URL_SAFE.decode(&clean)
    } else {
        general_purpose::STANDARD.decode(&clean)
    }
    .map_err(|e| format!("Invalid Base64: {}", e))?;

    let output = String::from_utf8(bytes.clone())
        .unwrap_or_else(|_| format!("[binary data: {} bytes]", bytes.len()));
    let output_size = output.len();

    Ok(Base64Result {
        output,
        input_size,
        output_size,
    })
}

#[tauri::command]
pub fn base64_encode_file(path: String, url_safe: Option<bool>) -> Result<Base64Result, String> {
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let input_size = data.len();
    let output = if url_safe.unwrap_or(false) {
        general_purpose::URL_SAFE.encode(&data)
    } else {
        general_purpose::STANDARD.encode(&data)
    };
    let output_size = output.len();

    Ok(Base64Result {
        output,
        input_size,
        output_size,
    })
}

#[tauri::command]
pub fn base64_validate(encoded: String) -> bool {
    let clean = encoded.trim().replace('\n', "").replace('\r', "");
    general_purpose::STANDARD.decode(&clean).is_ok()
        || general_purpose::URL_SAFE.decode(&clean).is_ok()
}
