//! Text Transform - Encoding, decoding, and text manipulation utilities
//!
//! Provides:
//! - Base64 encode/decode
//! - URL encode/decode
//! - Hash generation (SHA-256, SHA-1, MD5) via system commands
//! - Case transforms (upper, lower, title, camel, snake, kebab)
//! - Character/word/line counting

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformResult {
    pub input_length: usize,
    pub output: String,
    pub output_length: usize,
    pub transform_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStats {
    pub characters: usize,
    pub characters_no_spaces: usize,
    pub words: usize,
    pub lines: usize,
    pub sentences: usize,
    pub paragraphs: usize,
    pub bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    pub algorithm: String,
    pub hash: String,
    pub input_length: usize,
}

#[tauri::command]
pub fn text_base64_encode(text: String) -> Result<TransformResult, String> {
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(text.as_bytes());
    Ok(TransformResult {
        input_length: text.len(),
        output_length: encoded.len(),
        output: encoded,
        transform_type: "base64_encode".to_string(),
    })
}

#[tauri::command]
pub fn text_base64_decode(text: String) -> Result<TransformResult, String> {
    use base64::Engine;
    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .map_err(|e| format!("Invalid Base64: {}", e))?;
    let decoded = String::from_utf8(decoded_bytes)
        .map_err(|e| format!("Decoded bytes are not valid UTF-8: {}", e))?;
    Ok(TransformResult {
        input_length: text.len(),
        output_length: decoded.len(),
        output: decoded,
        transform_type: "base64_decode".to_string(),
    })
}

#[tauri::command]
pub fn text_url_encode(text: String) -> Result<TransformResult, String> {
    let encoded: String = text
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                c.to_string()
            } else {
                let mut buf = [0u8; 4];
                c.encode_utf8(&mut buf);
                buf[..c.len_utf8()]
                    .iter()
                    .map(|b| format!("%{:02X}", b))
                    .collect()
            }
        })
        .collect();
    Ok(TransformResult {
        input_length: text.len(),
        output_length: encoded.len(),
        output: encoded,
        transform_type: "url_encode".to_string(),
    })
}

#[tauri::command]
pub fn text_url_decode(text: String) -> Result<TransformResult, String> {
    let mut result = String::new();
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                } else {
                    result.push('%');
                    result.push_str(&hex);
                }
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    Ok(TransformResult {
        input_length: text.len(),
        output_length: result.len(),
        output: result,
        transform_type: "url_decode".to_string(),
    })
}

#[tauri::command]
pub fn text_hash(text: String, algorithm: String) -> Result<HashResult, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let cmd = match algorithm.to_lowercase().as_str() {
        "sha256" | "sha-256" => "sha256sum",
        "sha1" | "sha-1" => "sha1sum",
        "md5" => "md5sum",
        _ => return Err(format!("Unsupported algorithm: {}. Use sha256, sha1, or md5", algorithm)),
    };

    let mut child = Command::new(cmd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for {}: {}", cmd, e))?;

    if !output.status.success() {
        return Err(format!("{} failed", cmd));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let hash = stdout.split_whitespace().next().unwrap_or("").to_string();

    Ok(HashResult {
        algorithm: algorithm.to_lowercase(),
        hash,
        input_length: text.len(),
    })
}

#[tauri::command]
pub fn text_transform_case(text: String, case_type: String) -> Result<TransformResult, String> {
    let output = match case_type.as_str() {
        "upper" => text.to_uppercase(),
        "lower" => text.to_lowercase(),
        "title" => text
            .split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => {
                        first.to_uppercase().to_string() + &chars.as_str().to_lowercase()
                    }
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
        "snake" => to_snake_case(&text),
        "camel" => to_camel_case(&text),
        "kebab" => to_snake_case(&text).replace('_', "-"),
        "reverse" => text.chars().rev().collect(),
        _ => return Err(format!("Unsupported case type: {}", case_type)),
    };

    Ok(TransformResult {
        input_length: text.len(),
        output_length: output.len(),
        output,
        transform_type: format!("case_{}", case_type),
    })
}

#[tauri::command]
pub fn text_get_stats(text: String) -> Result<TextStats, String> {
    let characters = text.chars().count();
    let characters_no_spaces = text.chars().filter(|c| !c.is_whitespace()).count();
    let words = text.split_whitespace().count();
    let lines = if text.is_empty() { 0 } else { text.lines().count() };
    let sentences = text
        .chars()
        .filter(|c| *c == '.' || *c == '!' || *c == '?')
        .count()
        .max(if words > 0 { 1 } else { 0 });
    let paragraphs = if text.is_empty() {
        0
    } else {
        text.split("\n\n").filter(|p| !p.trim().is_empty()).count()
    };

    Ok(TextStats {
        characters,
        characters_no_spaces,
        words,
        lines,
        sentences,
        paragraphs,
        bytes: text.len(),
    })
}

#[tauri::command]
pub fn text_get_available_transforms() -> Vec<HashMap<String, String>> {
    vec![
        transform_info("base64_encode", "Base64 Encode", "Encode text to Base64"),
        transform_info("base64_decode", "Base64 Decode", "Decode Base64 to text"),
        transform_info("url_encode", "URL Encode", "Percent-encode for URLs"),
        transform_info("url_decode", "URL Decode", "Decode percent-encoded text"),
        transform_info("upper", "UPPERCASE", "Convert to uppercase"),
        transform_info("lower", "lowercase", "Convert to lowercase"),
        transform_info("title", "Title Case", "Capitalize first letter of each word"),
        transform_info("snake", "snake_case", "Convert to snake_case"),
        transform_info("camel", "camelCase", "Convert to camelCase"),
        transform_info("kebab", "kebab-case", "Convert to kebab-case"),
        transform_info("reverse", "Reverse", "Reverse the text"),
        transform_info("sha256", "SHA-256", "Generate SHA-256 hash"),
        transform_info("sha1", "SHA-1", "Generate SHA-1 hash"),
        transform_info("md5", "MD5", "Generate MD5 hash"),
    ]
}

fn transform_info(id: &str, name: &str, desc: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("id".to_string(), id.to_string());
    map.insert("name".to_string(), name.to_string());
    map.insert("description".to_string(), desc.to_string());
    map
}

fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                let prev = s.chars().nth(i - 1).unwrap_or(' ');
                if prev.is_lowercase() || prev.is_ascii_digit() {
                    result.push('_');
                }
            }
            result.push(c.to_lowercase().next().unwrap_or(c));
        } else if c == ' ' || c == '-' {
            result.push('_');
        } else {
            result.push(c);
        }
    }
    result
}

fn to_camel_case(s: &str) -> String {
    let words: Vec<&str> = s.split(|c: char| c == '_' || c == '-' || c == ' ').collect();
    let mut result = String::new();
    for (i, word) in words.iter().enumerate() {
        if word.is_empty() {
            continue;
        }
        if i == 0 {
            result.push_str(&word.to_lowercase());
        } else {
            let mut chars = word.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_uppercase().next().unwrap_or(first));
                result.push_str(&chars.as_str().to_lowercase());
            }
        }
    }
    result
}
