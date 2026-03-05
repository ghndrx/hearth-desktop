//! System font manager for Hearth desktop app
//!
//! Lists system fonts and allows users to select custom fonts
//! for the chat interface, code blocks, and UI elements.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontInfo {
    pub family: String,
    pub style: String,
    pub path: Option<String>,
    pub is_monospace: bool,
    pub is_system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontPreferences {
    pub chat_font: String,
    pub code_font: String,
    pub ui_font: String,
    pub chat_font_size: f32,
    pub code_font_size: f32,
    pub ui_font_size: f32,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub custom_css: Option<String>,
}

impl Default for FontPreferences {
    fn default() -> Self {
        Self {
            chat_font: "system-ui".to_string(),
            code_font: "monospace".to_string(),
            ui_font: "system-ui".to_string(),
            chat_font_size: 14.0,
            code_font_size: 13.0,
            ui_font_size: 14.0,
            line_height: 1.5,
            letter_spacing: 0.0,
            custom_css: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct FontCategory {
    pub name: String,
    pub fonts: Vec<FontInfo>,
}

pub struct FontManagerState {
    pub preferences: Mutex<FontPreferences>,
    pub system_fonts: Mutex<Vec<FontInfo>>,
}

impl Default for FontManagerState {
    fn default() -> Self {
        Self {
            preferences: Mutex::new(FontPreferences::default()),
            system_fonts: Mutex::new(Vec::new()),
        }
    }
}

/// Scan system font directories for installed fonts
fn scan_system_fonts() -> Vec<FontInfo> {
    let mut fonts = Vec::new();
    let mut seen_families: HashMap<String, bool> = HashMap::new();

    let font_dirs = get_font_directories();

    for dir in font_dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if ext == "ttf" || ext == "otf" || ext == "ttc" || ext == "woff" || ext == "woff2" {
                        if let Some(family) = extract_font_family(&path) {
                            if !seen_families.contains_key(&family) {
                                let is_mono = is_likely_monospace(&family);
                                seen_families.insert(family.clone(), is_mono);
                                fonts.push(FontInfo {
                                    family,
                                    style: "Regular".to_string(),
                                    path: Some(path.to_string_lossy().to_string()),
                                    is_monospace: is_mono,
                                    is_system: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    fonts
}

fn get_font_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "linux")]
    {
        dirs.push(PathBuf::from("/usr/share/fonts"));
        dirs.push(PathBuf::from("/usr/local/share/fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(format!("{}/.local/share/fonts", home)));
            dirs.push(PathBuf::from(format!("{}/.fonts", home)));
        }
    }

    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/System/Library/Fonts"));
        dirs.push(PathBuf::from("/Library/Fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(format!("{}/Library/Fonts", home)));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(windir) = std::env::var("WINDIR") {
            dirs.push(PathBuf::from(format!("{}\\Fonts", windir)));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(format!(
                "{}\\Microsoft\\Windows\\Fonts",
                local
            )));
        }
    }

    dirs
}

fn extract_font_family(path: &PathBuf) -> Option<String> {
    let stem = path.file_stem()?.to_string_lossy().to_string();
    // Clean up common suffixes
    let family = stem
        .replace("-Regular", "")
        .replace("-Bold", "")
        .replace("-Italic", "")
        .replace("-Light", "")
        .replace("-Medium", "")
        .replace("-Thin", "")
        .replace("-Black", "")
        .replace("-ExtraBold", "")
        .replace("-SemiBold", "")
        .replace("Regular", "")
        .replace("Bold", "")
        .replace("Italic", "")
        .trim_end_matches('-')
        .to_string();

    if family.is_empty() {
        return Some(stem);
    }
    Some(family)
}

fn is_likely_monospace(family: &str) -> bool {
    let lower = family.to_lowercase();
    lower.contains("mono")
        || lower.contains("code")
        || lower.contains("courier")
        || lower.contains("console")
        || lower.contains("terminal")
        || lower.contains("fixed")
        || lower.contains("hack")
        || lower.contains("fira code")
        || lower.contains("jet brains")
        || lower.contains("jetbrains")
        || lower.contains("inconsolata")
        || lower.contains("menlo")
        || lower.contains("consolas")
        || lower.contains("cascadia")
        || lower.contains("source code")
        || lower.contains("iosevka")
}

#[tauri::command]
pub fn font_list_system(
    state: State<'_, FontManagerState>,
) -> Result<Vec<FontInfo>, String> {
    let mut cached = state.system_fonts.lock().map_err(|e| e.to_string())?;
    if cached.is_empty() {
        *cached = scan_system_fonts();
    }
    Ok(cached.clone())
}

#[tauri::command]
pub fn font_list_monospace(
    state: State<'_, FontManagerState>,
) -> Result<Vec<FontInfo>, String> {
    let mut cached = state.system_fonts.lock().map_err(|e| e.to_string())?;
    if cached.is_empty() {
        *cached = scan_system_fonts();
    }
    Ok(cached.iter().filter(|f| f.is_monospace).cloned().collect())
}

#[tauri::command]
pub fn font_get_categories(
    state: State<'_, FontManagerState>,
) -> Result<Vec<FontCategory>, String> {
    let mut cached = state.system_fonts.lock().map_err(|e| e.to_string())?;
    if cached.is_empty() {
        *cached = scan_system_fonts();
    }

    let mono: Vec<FontInfo> = cached.iter().filter(|f| f.is_monospace).cloned().collect();
    let sans: Vec<FontInfo> = cached.iter().filter(|f| !f.is_monospace).cloned().collect();

    Ok(vec![
        FontCategory {
            name: "Monospace".to_string(),
            fonts: mono,
        },
        FontCategory {
            name: "Sans-serif / Serif".to_string(),
            fonts: sans,
        },
    ])
}

#[tauri::command]
pub fn font_get_preferences(
    state: State<'_, FontManagerState>,
) -> Result<FontPreferences, String> {
    let prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    Ok(prefs.clone())
}

#[tauri::command]
pub fn font_set_preferences(
    state: State<'_, FontManagerState>,
    preferences: FontPreferences,
) -> Result<(), String> {
    let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    *prefs = preferences;
    Ok(())
}

#[tauri::command]
pub fn font_get_css(
    state: State<'_, FontManagerState>,
) -> Result<String, String> {
    let prefs = state.preferences.lock().map_err(|e| e.to_string())?;
    let css = format!(
        r#":root {{
  --font-chat: '{}', system-ui, sans-serif;
  --font-code: '{}', monospace;
  --font-ui: '{}', system-ui, sans-serif;
  --font-size-chat: {}px;
  --font-size-code: {}px;
  --font-size-ui: {}px;
  --line-height: {};
  --letter-spacing: {}em;
}}"#,
        prefs.chat_font,
        prefs.code_font,
        prefs.ui_font,
        prefs.chat_font_size,
        prefs.code_font_size,
        prefs.ui_font_size,
        prefs.line_height,
        prefs.letter_spacing,
    );

    if let Some(ref custom) = prefs.custom_css {
        Ok(format!("{}\n{}", css, custom))
    } else {
        Ok(css)
    }
}

#[tauri::command]
pub fn font_refresh_cache(
    state: State<'_, FontManagerState>,
) -> Result<usize, String> {
    let mut cached = state.system_fonts.lock().map_err(|e| e.to_string())?;
    *cached = scan_system_fonts();
    Ok(cached.len())
}

#[tauri::command]
pub fn font_search(
    state: State<'_, FontManagerState>,
    query: String,
) -> Result<Vec<FontInfo>, String> {
    let mut cached = state.system_fonts.lock().map_err(|e| e.to_string())?;
    if cached.is_empty() {
        *cached = scan_system_fonts();
    }
    let lower = query.to_lowercase();
    Ok(cached
        .iter()
        .filter(|f| f.family.to_lowercase().contains(&lower))
        .cloned()
        .collect())
}
