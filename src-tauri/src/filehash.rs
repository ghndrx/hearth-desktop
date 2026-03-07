//! File Hash Verifier - Compute and verify file hashes for integrity checking
//!
//! Provides:
//! - Compute MD5, SHA-1, SHA-256, SHA-512 hashes for any file via system utilities
//! - Verify a file against an expected hash with auto-detection
//! - Compare two files for identical content
//! - History tracking of recent hash computations

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub md5: Option<String>,
    pub sha1: Option<String>,
    pub sha256: Option<String>,
    pub sha512: Option<String>,
    pub duration_ms: u64,
    pub computed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashVerifyResult {
    pub matches: bool,
    pub expected: String,
    pub actual: String,
    pub algorithm: String,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCompareResult {
    pub path1: String,
    pub path2: String,
    pub name1: String,
    pub name2: String,
    pub size1: u64,
    pub size2: u64,
    pub identical: bool,
    pub md5_match: bool,
    pub sha256_match: bool,
}

#[derive(Default)]
pub struct FileHashManager {
    history: Mutex<Vec<HashResult>>,
}

fn run_hash_cmd(cmd: &str, path: &str) -> Result<String, String> {
    let output = std::process::Command::new(cmd)
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

    if !output.status.success() {
        return Err(format!(
            "{} failed: {}",
            cmd,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.split_whitespace().next().unwrap_or("").to_string())
}

fn algorithm_to_cmd(algo: &str) -> Result<&'static str, String> {
    match algo.to_lowercase().as_str() {
        "md5" => Ok("md5sum"),
        "sha1" | "sha-1" => Ok("sha1sum"),
        "sha256" | "sha-256" => Ok("sha256sum"),
        "sha512" | "sha-512" => Ok("sha512sum"),
        _ => Err(format!("Unsupported algorithm: {}", algo)),
    }
}

fn detect_algorithm(hash: &str) -> Option<String> {
    match hash.trim().len() {
        32 => Some("md5".to_string()),
        40 => Some("sha1".to_string()),
        64 => Some("sha256".to_string()),
        128 => Some("sha512".to_string()),
        _ => None,
    }
}

fn file_name_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub fn filehash_compute(
    state: State<'_, FileHashManager>,
    path: String,
    algorithms: Vec<String>,
) -> Result<HashResult, String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata =
        std::fs::metadata(file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let file_size = metadata.len();
    let file_name = file_name_from_path(&path);

    let start = std::time::Instant::now();

    // Determine which algorithms to compute (default to all if empty)
    let algos: Vec<String> = if algorithms.is_empty() {
        vec![
            "md5".to_string(),
            "sha1".to_string(),
            "sha256".to_string(),
            "sha512".to_string(),
        ]
    } else {
        algorithms
            .iter()
            .map(|a| a.to_lowercase())
            .collect()
    };

    let mut md5 = None;
    let mut sha1 = None;
    let mut sha256 = None;
    let mut sha512 = None;

    for algo in &algos {
        match algo.as_str() {
            "md5" => md5 = Some(run_hash_cmd("md5sum", &path)?),
            "sha1" | "sha-1" => sha1 = Some(run_hash_cmd("sha1sum", &path)?),
            "sha256" | "sha-256" => sha256 = Some(run_hash_cmd("sha256sum", &path)?),
            "sha512" | "sha-512" => sha512 = Some(run_hash_cmd("sha512sum", &path)?),
            _ => return Err(format!("Unsupported algorithm: {}", algo)),
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;

    let result = HashResult {
        id: uuid::Uuid::new_v4().to_string(),
        file_path: path,
        file_name,
        file_size,
        md5,
        sha1,
        sha256,
        sha512,
        duration_ms,
        computed_at: chrono::Utc::now().to_rfc3339(),
    };

    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.push(result.clone());
    // Keep last 100 entries
    if history.len() > 100 {
        history.remove(0);
    }

    Ok(result)
}

#[tauri::command]
pub fn filehash_verify(
    path: String,
    expected_hash: String,
    algorithm: Option<String>,
) -> Result<HashVerifyResult, String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let expected_trimmed = expected_hash.trim().to_lowercase();

    // Auto-detect algorithm if not provided
    let algo = match algorithm {
        Some(a) if !a.is_empty() => a.to_lowercase(),
        _ => detect_algorithm(&expected_trimmed)
            .ok_or_else(|| "Could not auto-detect algorithm from hash length. Please specify the algorithm.".to_string())?,
    };

    let cmd = algorithm_to_cmd(&algo)?;
    let actual = run_hash_cmd(cmd, &path)?.to_lowercase();
    let matches = actual == expected_trimmed;

    let file_name = file_name_from_path(&path);

    Ok(HashVerifyResult {
        matches,
        expected: expected_trimmed,
        actual,
        algorithm: algo,
        file_path: path,
        file_name,
    })
}

#[tauri::command]
pub fn filehash_get_history(
    state: State<'_, FileHashManager>,
) -> Result<Vec<HashResult>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}

#[tauri::command]
pub fn filehash_clear_history(
    state: State<'_, FileHashManager>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

#[tauri::command]
pub fn filehash_compare_files(
    path1: String,
    path2: String,
) -> Result<FileCompareResult, String> {
    let p1 = std::path::Path::new(&path1);
    let p2 = std::path::Path::new(&path2);

    if !p1.exists() {
        return Err(format!("File not found: {}", path1));
    }
    if !p2.exists() {
        return Err(format!("File not found: {}", path2));
    }

    let meta1 = std::fs::metadata(p1).map_err(|e| e.to_string())?;
    let meta2 = std::fs::metadata(p2).map_err(|e| e.to_string())?;

    let name1 = file_name_from_path(&path1);
    let name2 = file_name_from_path(&path2);

    let md5_1 = run_hash_cmd("md5sum", &path1)?;
    let md5_2 = run_hash_cmd("md5sum", &path2)?;
    let sha256_1 = run_hash_cmd("sha256sum", &path1)?;
    let sha256_2 = run_hash_cmd("sha256sum", &path2)?;

    let md5_match = md5_1 == md5_2;
    let sha256_match = sha256_1 == sha256_2;

    Ok(FileCompareResult {
        path1,
        path2,
        name1,
        name2,
        size1: meta1.len(),
        size2: meta2.len(),
        identical: md5_match && sha256_match,
        md5_match,
        sha256_match,
    })
}
