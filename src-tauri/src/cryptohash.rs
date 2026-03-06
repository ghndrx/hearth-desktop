//! Crypto Hash - File and text hashing with multiple algorithms
//!
//! Provides:
//! - Hash files using SHA-256, SHA-1, MD5 via system commands
//! - Compare file hashes for integrity verification
//! - Hash history tracking

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHashResult {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub sha256: String,
    pub sha1: String,
    pub md5: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashCompareResult {
    pub file_a: String,
    pub file_b: String,
    pub match_sha256: bool,
    pub match_sha1: bool,
    pub match_md5: bool,
    pub identical: bool,
}

pub struct CryptoHashManager {
    history: Mutex<Vec<FileHashResult>>,
}

impl Default for CryptoHashManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn run_hash_command(cmd: &str, path: &str) -> Result<String, String> {
    let output = std::process::Command::new(cmd)
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

    if !output.status.success() {
        return Err(format!("{} failed: {}", cmd, String::from_utf8_lossy(&output.stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.split_whitespace().next().unwrap_or("").to_string())
}

fn hash_text_with_command(cmd: &str, text: &str) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

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
    Ok(stdout.split_whitespace().next().unwrap_or("").to_string())
}

#[tauri::command]
pub fn hash_file(
    state: State<'_, CryptoHashManager>,
    path: String,
) -> Result<FileHashResult, String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();
    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let sha256 = run_hash_command("sha256sum", &path)?;
    let sha1 = run_hash_command("sha1sum", &path)?;
    let md5 = run_hash_command("md5sum", &path)?;

    let result = FileHashResult {
        id: uuid::Uuid::new_v4().to_string(),
        file_path: path,
        file_name,
        file_size,
        sha256,
        sha1,
        md5,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.push(result.clone());
    if history.len() > 50 {
        history.remove(0);
    }

    Ok(result)
}

#[tauri::command]
pub fn hash_text(text: String, algorithm: String) -> Result<String, String> {
    let cmd = match algorithm.to_lowercase().as_str() {
        "sha256" | "sha-256" => "sha256sum",
        "sha1" | "sha-1" => "sha1sum",
        "md5" => "md5sum",
        _ => return Err(format!("Unsupported algorithm: {}", algorithm)),
    };
    hash_text_with_command(cmd, &text)
}

#[tauri::command]
pub fn hash_compare_files(
    path_a: String,
    path_b: String,
) -> Result<HashCompareResult, String> {
    let sha256_a = run_hash_command("sha256sum", &path_a)?;
    let sha256_b = run_hash_command("sha256sum", &path_b)?;
    let sha1_a = run_hash_command("sha1sum", &path_a)?;
    let sha1_b = run_hash_command("sha1sum", &path_b)?;
    let md5_a = run_hash_command("md5sum", &path_a)?;
    let md5_b = run_hash_command("md5sum", &path_b)?;

    let match_sha256 = sha256_a == sha256_b;
    let match_sha1 = sha1_a == sha1_b;
    let match_md5 = md5_a == md5_b;

    Ok(HashCompareResult {
        file_a: path_a,
        file_b: path_b,
        match_sha256,
        match_sha1,
        match_md5,
        identical: match_sha256 && match_sha1 && match_md5,
    })
}

#[tauri::command]
pub fn hash_get_history(
    state: State<'_, CryptoHashManager>,
) -> Result<Vec<FileHashResult>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}

#[tauri::command]
pub fn hash_clear_history(
    state: State<'_, CryptoHashManager>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

#[tauri::command]
pub fn hash_verify(
    path: String,
    expected_hash: String,
    algorithm: String,
) -> Result<bool, String> {
    let cmd = match algorithm.to_lowercase().as_str() {
        "sha256" | "sha-256" => "sha256sum",
        "sha1" | "sha-1" => "sha1sum",
        "md5" => "md5sum",
        _ => return Err(format!("Unsupported algorithm: {}", algorithm)),
    };

    let computed = run_hash_command(cmd, &path)?;
    Ok(computed.eq_ignore_ascii_case(expected_hash.trim()))
}
