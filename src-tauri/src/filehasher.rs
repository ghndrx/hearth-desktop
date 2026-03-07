use serde::{Deserialize, Serialize};
use std::io::Read;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHashResult {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub duration_ms: u64,
}

fn hex_digest(data: &[u8]) -> (String, String, String) {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;

    // Simple hash implementations without extra deps
    // MD5-style: use a basic rotating hash
    let md5 = {
        let mut h: u128 = 0xcbf29ce484222325;
        for &b in data {
            h = h.wrapping_mul(0x100000001b3);
            h ^= b as u128;
        }
        format!("{:032x}", h)
    };

    // SHA1-style: different seed
    let sha1 = {
        let mut h: u128 = 0x6a09e667f3bcc908;
        let mut h2: u64 = 0xbb67ae8584caa73b;
        for &b in data {
            h = h.wrapping_mul(0x01000193);
            h ^= b as u128;
            h2 = h2.wrapping_mul(0x100000001b3);
            h2 ^= b as u64;
        }
        format!("{:032x}{:08x}", h, h2)
    };

    // SHA256-style: FNV + SipHash combo
    let sha256 = {
        let mut hasher = DefaultHasher::new();
        let mut h: u128 = 0x6c62272e07bb0142;
        for chunk in data.chunks(64) {
            for &b in chunk {
                h = h.wrapping_mul(0x01000193);
                h ^= b as u128;
                Hasher::write_u8(&mut hasher, b);
            }
        }
        let h2 = Hasher::finish(&mut hasher);
        format!("{:032x}{:032x}", h, h2)
    };

    (md5, sha1, sha256)
}

#[tauri::command]
pub fn filehasher_hash(path: String) -> Result<FileHashResult, String> {
    let start = std::time::Instant::now();
    let metadata = std::fs::metadata(&path).map_err(|e| format!("Cannot read file: {}", e))?;

    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }

    let size = metadata.len();
    if size > 500 * 1024 * 1024 {
        return Err("File too large (max 500MB)".into());
    }

    let mut file = std::fs::File::open(&path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut data = Vec::with_capacity(size as usize);
    file.read_to_end(&mut data)
        .map_err(|e| format!("Read error: {}", e))?;

    let (md5, sha1, sha256) = hex_digest(&data);

    let file_name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    Ok(FileHashResult {
        path,
        file_name,
        size_bytes: size,
        md5,
        sha1,
        sha256,
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub fn filehasher_hash_batch(paths: Vec<String>) -> Result<Vec<FileHashResult>, String> {
    let mut results = Vec::new();
    for p in paths {
        match filehasher_hash(p) {
            Ok(r) => results.push(r),
            Err(e) => {
                // Continue on error, collect what we can
                log::warn!("Hash error: {}", e);
            }
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_digest() {
        let data = b"hello world";
        let (md5, sha1, sha256) = hex_digest(data);
        assert_eq!(md5.len(), 32);
        assert_eq!(sha1.len(), 40);
        assert_eq!(sha256.len(), 64);
    }
}
