//! Auto File Organizer for Hearth Desktop
//!
//! Categorizes and organizes downloaded/received files into folders by type.
//! Uses in-memory state with serde for configuration and history tracking.
//! Supports rules by extension, undo operations, dry-run previews, and statistics.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// File categories for organization
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileCategory {
    Images,
    Documents,
    Videos,
    Audio,
    Archives,
    Code,
    Other,
}

impl FileCategory {
    pub fn folder_name(&self) -> &'static str {
        match self {
            FileCategory::Images => "Images",
            FileCategory::Documents => "Documents",
            FileCategory::Videos => "Videos",
            FileCategory::Audio => "Audio",
            FileCategory::Archives => "Archives",
            FileCategory::Code => "Code",
            FileCategory::Other => "Other",
        }
    }
}

/// A rule mapping a file extension to a category
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizeRule {
    pub extension: String,
    pub category: FileCategory,
}

/// A record of an organized file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizedFile {
    pub id: String,
    pub original_path: String,
    pub new_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub category: FileCategory,
    pub organized_at: u64,
}

/// Configuration for the file organizer
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOrganizerConfig {
    pub enabled: bool,
    pub source_directory: String,
    pub target_directory: String,
}

impl Default for FileOrganizerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            source_directory: String::new(),
            target_directory: String::new(),
        }
    }
}

/// Statistics about organized files
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizerStats {
    pub total_organized: usize,
    pub total_size: u64,
    pub by_category: HashMap<String, CategoryStats>,
}

/// Per-category statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStats {
    pub count: usize,
    pub total_size: u64,
}

/// The main file organizer manager holding all state
pub struct FileOrganizerManager {
    rules: Mutex<Vec<OrganizeRule>>,
    history: Mutex<Vec<OrganizedFile>>,
    config: Mutex<FileOrganizerConfig>,
}

impl FileOrganizerManager {
    pub fn new() -> Self {
        Self {
            rules: Mutex::new(Self::default_rules()),
            history: Mutex::new(Vec::new()),
            config: Mutex::new(FileOrganizerConfig::default()),
        }
    }

    fn default_rules() -> Vec<OrganizeRule> {
        let mappings: Vec<(&str, FileCategory)> = vec![
            // Images
            ("jpg", FileCategory::Images),
            ("jpeg", FileCategory::Images),
            ("png", FileCategory::Images),
            ("gif", FileCategory::Images),
            ("webp", FileCategory::Images),
            ("bmp", FileCategory::Images),
            ("svg", FileCategory::Images),
            ("ico", FileCategory::Images),
            ("tiff", FileCategory::Images),
            // Documents
            ("pdf", FileCategory::Documents),
            ("doc", FileCategory::Documents),
            ("docx", FileCategory::Documents),
            ("txt", FileCategory::Documents),
            ("rtf", FileCategory::Documents),
            ("odt", FileCategory::Documents),
            ("xls", FileCategory::Documents),
            ("xlsx", FileCategory::Documents),
            ("csv", FileCategory::Documents),
            ("ppt", FileCategory::Documents),
            ("pptx", FileCategory::Documents),
            ("md", FileCategory::Documents),
            // Videos
            ("mp4", FileCategory::Videos),
            ("avi", FileCategory::Videos),
            ("mkv", FileCategory::Videos),
            ("mov", FileCategory::Videos),
            ("wmv", FileCategory::Videos),
            ("webm", FileCategory::Videos),
            ("flv", FileCategory::Videos),
            // Audio
            ("mp3", FileCategory::Audio),
            ("wav", FileCategory::Audio),
            ("flac", FileCategory::Audio),
            ("ogg", FileCategory::Audio),
            ("aac", FileCategory::Audio),
            ("wma", FileCategory::Audio),
            ("m4a", FileCategory::Audio),
            // Archives
            ("zip", FileCategory::Archives),
            ("tar", FileCategory::Archives),
            ("gz", FileCategory::Archives),
            ("rar", FileCategory::Archives),
            ("7z", FileCategory::Archives),
            ("bz2", FileCategory::Archives),
            ("xz", FileCategory::Archives),
            // Code
            ("rs", FileCategory::Code),
            ("ts", FileCategory::Code),
            ("js", FileCategory::Code),
            ("py", FileCategory::Code),
            ("java", FileCategory::Code),
            ("c", FileCategory::Code),
            ("cpp", FileCategory::Code),
            ("h", FileCategory::Code),
            ("go", FileCategory::Code),
            ("rb", FileCategory::Code),
            ("swift", FileCategory::Code),
            ("kt", FileCategory::Code),
            ("html", FileCategory::Code),
            ("css", FileCategory::Code),
            ("json", FileCategory::Code),
            ("xml", FileCategory::Code),
            ("yaml", FileCategory::Code),
            ("yml", FileCategory::Code),
            ("toml", FileCategory::Code),
            ("sh", FileCategory::Code),
        ];

        mappings
            .into_iter()
            .map(|(ext, cat)| OrganizeRule {
                extension: ext.to_string(),
                category: cat,
            })
            .collect()
    }

    fn categorize(&self, file_path: &str) -> FileCategory {
        let ext = std::path::Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let rules = self.rules.lock().unwrap();
        for rule in rules.iter() {
            if rule.extension.to_lowercase() == ext {
                return rule.category.clone();
            }
        }
        FileCategory::Other
    }
}

impl Default for FileOrganizerManager {
    fn default() -> Self {
        Self::new()
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn generate_id() -> String {
    format!("{:x}", now_ms() ^ (std::process::id() as u64))
}

// --- Tauri Commands ---

#[tauri::command]
pub fn organizer_get_config(
    state: State<'_, FileOrganizerManager>,
) -> Result<FileOrganizerConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn organizer_set_config(
    state: State<'_, FileOrganizerManager>,
    config: FileOrganizerConfig,
) -> Result<FileOrganizerConfig, String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    Ok(config)
}

#[tauri::command]
pub fn organizer_categorize_file(
    state: State<'_, FileOrganizerManager>,
    file_path: String,
) -> Result<FileCategory, String> {
    Ok(state.categorize(&file_path))
}

#[tauri::command]
pub fn organizer_organize_file(
    state: State<'_, FileOrganizerManager>,
    file_path: String,
    target_dir: String,
) -> Result<OrganizedFile, String> {
    let source = std::path::Path::new(&file_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", file_path));
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(&source)
        .map(|m| m.len())
        .unwrap_or(0);

    let category = state.categorize(&file_path);
    let category_dir = std::path::Path::new(&target_dir).join(category.folder_name());
    std::fs::create_dir_all(&category_dir).map_err(|e| {
        format!("Failed to create directory {}: {}", category_dir.display(), e)
    })?;

    let dest = category_dir.join(&file_name);
    let dest_str = dest.to_string_lossy().to_string();

    // Handle name collision by appending a number
    let final_dest = if dest.exists() {
        let stem = source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        let mut counter = 1u32;
        loop {
            let new_name = if ext.is_empty() {
                format!("{}_{}", stem, counter)
            } else {
                format!("{}_{}.{}", stem, counter, ext)
            };
            let candidate = category_dir.join(&new_name);
            if !candidate.exists() {
                break candidate;
            }
            counter += 1;
        }
    } else {
        dest
    };

    let final_dest_str = final_dest.to_string_lossy().to_string();
    std::fs::rename(&source, &final_dest).or_else(|_| {
        // rename can fail across mount points; fall back to copy+delete
        std::fs::copy(&source, &final_dest)
            .and_then(|_| std::fs::remove_file(&source))
            .map_err(|e| format!("Failed to move file: {}", e))
    }).map_err(|e| format!("Failed to move file from {} to {}: {}", file_path, final_dest_str, e))?;

    let organized = OrganizedFile {
        id: generate_id(),
        original_path: file_path,
        new_path: final_dest_str,
        file_name,
        file_size,
        category,
        organized_at: now_ms(),
    };

    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.push(organized.clone());

    Ok(organized)
}

#[tauri::command]
pub fn organizer_organize_directory(
    state: State<'_, FileOrganizerManager>,
    source_dir: String,
    target_dir: String,
) -> Result<Vec<OrganizedFile>, String> {
    let dir = std::path::Path::new(&source_dir);
    if !dir.is_dir() {
        return Err(format!("Source is not a directory: {}", source_dir));
    }

    let entries: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .collect();

    let mut results = Vec::new();

    for entry in entries {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        let category = state.categorize(&path_str);
        let category_dir = std::path::Path::new(&target_dir).join(category.folder_name());
        if let Err(e) = std::fs::create_dir_all(&category_dir) {
            eprintln!("Failed to create dir {}: {}", category_dir.display(), e);
            continue;
        }

        let dest = category_dir.join(&file_name);
        let final_dest = if dest.exists() {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let mut counter = 1u32;
            loop {
                let new_name = if ext.is_empty() {
                    format!("{}_{}", stem, counter)
                } else {
                    format!("{}_{}.{}", stem, counter, ext)
                };
                let candidate = category_dir.join(&new_name);
                if !candidate.exists() {
                    break candidate;
                }
                counter += 1;
            }
        } else {
            dest
        };

        let final_dest_str = final_dest.to_string_lossy().to_string();
        let move_result = std::fs::rename(&path, &final_dest).or_else(|_| {
            std::fs::copy(&path, &final_dest)
                .and_then(|_| std::fs::remove_file(&path))
                .map_err(|e| e.to_string())
        });

        if move_result.is_err() {
            eprintln!("Failed to move {}", path_str);
            continue;
        }

        let organized = OrganizedFile {
            id: generate_id(),
            original_path: path_str,
            new_path: final_dest_str,
            file_name,
            file_size,
            category,
            organized_at: now_ms(),
        };

        let mut history = state.history.lock().unwrap();
        history.push(organized.clone());
        drop(history);

        results.push(organized);
    }

    Ok(results)
}

#[tauri::command]
pub fn organizer_get_history(
    state: State<'_, FileOrganizerManager>,
) -> Result<Vec<OrganizedFile>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}

#[tauri::command]
pub fn organizer_undo_last(
    state: State<'_, FileOrganizerManager>,
) -> Result<Option<OrganizedFile>, String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;

    if let Some(last) = history.pop() {
        let new_path = std::path::Path::new(&last.new_path);
        let original_path = std::path::Path::new(&last.original_path);

        if new_path.exists() {
            // Ensure original directory exists
            if let Some(parent) = original_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }

            std::fs::rename(new_path, original_path).or_else(|_| {
                std::fs::copy(new_path, original_path)
                    .and_then(|_| std::fs::remove_file(new_path))
                    .map_err(|e| e.to_string())
            }).map_err(|e| format!("Failed to undo: {}", e))?;

            Ok(Some(last))
        } else {
            // File no longer at new path, can't undo
            Err(format!(
                "Cannot undo: file no longer exists at {}",
                last.new_path
            ))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn organizer_get_stats(
    state: State<'_, FileOrganizerManager>,
) -> Result<OrganizerStats, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;

    let mut by_category: HashMap<String, CategoryStats> = HashMap::new();
    let mut total_size: u64 = 0;

    for file in history.iter() {
        total_size += file.file_size;
        let cat_name = file.category.folder_name().to_string();
        let entry = by_category.entry(cat_name).or_insert(CategoryStats {
            count: 0,
            total_size: 0,
        });
        entry.count += 1;
        entry.total_size += file.file_size;
    }

    Ok(OrganizerStats {
        total_organized: history.len(),
        total_size,
        by_category,
    })
}

#[tauri::command]
pub fn organizer_add_rule(
    state: State<'_, FileOrganizerManager>,
    extension: String,
    category: FileCategory,
) -> Result<OrganizeRule, String> {
    let mut rules = state.rules.lock().map_err(|e| e.to_string())?;
    let ext = extension.to_lowercase().trim_start_matches('.').to_string();

    // Remove existing rule for this extension if present
    rules.retain(|r| r.extension != ext);

    let rule = OrganizeRule {
        extension: ext,
        category,
    };
    rules.push(rule.clone());
    Ok(rule)
}

#[tauri::command]
pub fn organizer_remove_rule(
    state: State<'_, FileOrganizerManager>,
    extension: String,
) -> Result<bool, String> {
    let mut rules = state.rules.lock().map_err(|e| e.to_string())?;
    let ext = extension.to_lowercase().trim_start_matches('.').to_string();
    let before = rules.len();
    rules.retain(|r| r.extension != ext);
    Ok(rules.len() < before)
}

#[tauri::command]
pub fn organizer_get_rules(
    state: State<'_, FileOrganizerManager>,
) -> Result<Vec<OrganizeRule>, String> {
    let rules = state.rules.lock().map_err(|e| e.to_string())?;
    Ok(rules.clone())
}

#[tauri::command]
pub fn organizer_set_enabled(
    state: State<'_, FileOrganizerManager>,
    enabled: bool,
) -> Result<bool, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.enabled = enabled;
    Ok(config.enabled)
}

#[tauri::command]
pub fn organizer_preview_organize(
    state: State<'_, FileOrganizerManager>,
    source_dir: String,
) -> Result<Vec<OrganizedFile>, String> {
    let dir = std::path::Path::new(&source_dir);
    if !dir.is_dir() {
        return Err(format!("Source is not a directory: {}", source_dir));
    }

    let config = state.config.lock().map_err(|e| e.to_string())?;
    let target_dir = if config.target_directory.is_empty() {
        source_dir.clone()
    } else {
        config.target_directory.clone()
    };
    drop(config);

    let entries: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .collect();

    let mut previews = Vec::new();

    for entry in entries {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        let category = state.categorize(&path_str);
        let dest = std::path::Path::new(&target_dir)
            .join(category.folder_name())
            .join(&file_name);

        previews.push(OrganizedFile {
            id: generate_id(),
            original_path: path_str,
            new_path: dest.to_string_lossy().to_string(),
            file_name,
            file_size,
            category,
            organized_at: now_ms(),
        });
    }

    Ok(previews)
}
