//! System Font Preview panel backend for Hearth desktop app
//!
//! Lists system fonts, provides preview metadata, supports search,
//! categorization (serif/sans-serif/monospace/display), and favorites.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontInfo {
    pub name: String,
    pub family: String,
    pub style: String,
    pub path: String,
    pub is_monospace: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontCategory {
    pub name: String,
    pub count: usize,
}

#[derive(Default)]
pub struct FontPreviewManager {
    pub fonts: Mutex<Vec<FontInfo>>,
    pub favorites: Mutex<HashSet<String>>,
}

/// Scan standard system font directories recursively for font files.
fn scan_system_fonts() -> Vec<FontInfo> {
    let mut fonts = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    let dirs = get_font_directories();

    for dir in dirs {
        scan_directory_recursive(&dir, &mut fonts, &mut seen);
    }

    fonts.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    fonts
}

fn scan_directory_recursive(dir: &PathBuf, fonts: &mut Vec<FontInfo>, seen: &mut HashSet<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_directory_recursive(&path, fonts, seen);
            continue;
        }

        let ext = match path.extension() {
            Some(e) => e.to_string_lossy().to_lowercase(),
            None => continue,
        };

        if ext != "ttf" && ext != "otf" && ext != "ttc" && ext != "woff" && ext != "woff2" {
            continue;
        }

        let (family, style) = extract_font_info(&path);

        if family.is_empty() {
            continue;
        }

        let display_name = if style != "Regular" {
            format!("{} {}", family, style)
        } else {
            family.clone()
        };

        if seen.contains(&display_name) {
            continue;
        }
        seen.insert(display_name.clone());

        let is_mono = is_likely_monospace(&family);

        fonts.push(FontInfo {
            name: display_name,
            family,
            style,
            path: path.to_string_lossy().to_string(),
            is_monospace: is_mono,
        });
    }
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

fn extract_font_info(path: &PathBuf) -> (String, String) {
    let stem = match path.file_stem() {
        Some(s) => s.to_string_lossy().to_string(),
        None => return (String::new(), "Regular".to_string()),
    };

    // Detect style from filename
    let style = if stem.contains("-BoldItalic") || stem.contains("BoldItalic") {
        "Bold Italic".to_string()
    } else if stem.contains("-Bold") || stem.ends_with("Bold") || stem.ends_with("-bold") {
        "Bold".to_string()
    } else if stem.contains("-Italic") || stem.ends_with("Italic") || stem.ends_with("-italic") {
        "Italic".to_string()
    } else if stem.contains("-Light") || stem.ends_with("Light") {
        "Light".to_string()
    } else if stem.contains("-Medium") || stem.ends_with("Medium") {
        "Medium".to_string()
    } else if stem.contains("-Thin") || stem.ends_with("Thin") {
        "Thin".to_string()
    } else if stem.contains("-SemiBold") || stem.ends_with("SemiBold") {
        "SemiBold".to_string()
    } else if stem.contains("-ExtraBold") || stem.ends_with("ExtraBold") {
        "ExtraBold".to_string()
    } else if stem.contains("-Black") || stem.ends_with("Black") {
        "Black".to_string()
    } else {
        "Regular".to_string()
    };

    let family = stem
        .replace("-BoldItalic", "")
        .replace("-Bold", "")
        .replace("-Italic", "")
        .replace("-Light", "")
        .replace("-Medium", "")
        .replace("-Thin", "")
        .replace("-SemiBold", "")
        .replace("-ExtraBold", "")
        .replace("-Black", "")
        .replace("-Regular", "")
        .replace("BoldItalic", "")
        .replace("Bold", "")
        .replace("Italic", "")
        .replace("Light", "")
        .replace("Medium", "")
        .replace("Regular", "")
        .trim_end_matches('-')
        .trim_end_matches('_')
        .to_string();

    let family = if family.is_empty() { stem } else { family };

    (family, style)
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
        || lower.contains("jetbrains")
        || lower.contains("jet brains")
        || lower.contains("inconsolata")
        || lower.contains("menlo")
        || lower.contains("consolas")
        || lower.contains("cascadia")
        || lower.contains("source code")
        || lower.contains("iosevka")
        || lower.contains("liberation mono")
        || lower.contains("droid sans mono")
        || lower.contains("ubuntu mono")
        || lower.contains("roboto mono")
        || lower.contains("noto mono")
        || lower.contains("space mono")
        || lower.contains("anonymous")
}

fn is_likely_serif(family: &str) -> bool {
    let lower = family.to_lowercase();
    (lower.contains("serif") && !lower.contains("sans"))
        || lower.contains("times")
        || lower.contains("georgia")
        || lower.contains("garamond")
        || lower.contains("palatino")
        || lower.contains("baskerville")
        || lower.contains("bodoni")
        || lower.contains("cambria")
        || lower.contains("caslon")
        || lower.contains("didot")
        || lower.contains("minion")
        || lower.contains("book antiqua")
        || lower.contains("noto serif")
        || lower.contains("liberation serif")
        || lower.contains("droid serif")
        || lower.contains("playfair")
        || lower.contains("merriweather")
        || lower.contains("lora")
        || lower.contains("crimson")
}

fn is_likely_display(family: &str) -> bool {
    let lower = family.to_lowercase();
    lower.contains("display")
        || lower.contains("decorative")
        || lower.contains("handwrit")
        || lower.contains("script")
        || lower.contains("cursive")
        || lower.contains("brush")
        || lower.contains("comic")
        || lower.contains("fantasy")
        || lower.contains("graffiti")
        || lower.contains("calligraph")
        || lower.contains("ornament")
        || lower.contains("stencil")
        || lower.contains("poster")
        || lower.contains("headline")
}

fn categorize_font(info: &FontInfo) -> &'static str {
    if info.is_monospace {
        "monospace"
    } else if is_likely_serif(&info.family) {
        "serif"
    } else if is_likely_display(&info.family) {
        "display"
    } else {
        "sans-serif"
    }
}

/// Ensure the font cache is populated, returning a clone of all fonts.
fn ensure_fonts(state: &State<'_, FontPreviewManager>) -> Result<Vec<FontInfo>, String> {
    let mut cached = state.fonts.lock().map_err(|e| e.to_string())?;
    if cached.is_empty() {
        *cached = scan_system_fonts();
    }
    Ok(cached.clone())
}

#[tauri::command]
pub fn fontpreview_get_fonts(
    state: State<'_, FontPreviewManager>,
) -> Result<Vec<FontInfo>, String> {
    ensure_fonts(&state)
}

#[tauri::command]
pub fn fontpreview_search_fonts(
    state: State<'_, FontPreviewManager>,
    query: String,
) -> Result<Vec<FontInfo>, String> {
    let fonts = ensure_fonts(&state)?;
    let lower = query.to_lowercase();
    Ok(fonts
        .into_iter()
        .filter(|f| {
            f.name.to_lowercase().contains(&lower)
                || f.family.to_lowercase().contains(&lower)
                || f.style.to_lowercase().contains(&lower)
        })
        .collect())
}

#[tauri::command]
pub fn fontpreview_get_font_count(
    state: State<'_, FontPreviewManager>,
) -> Result<usize, String> {
    let fonts = ensure_fonts(&state)?;
    Ok(fonts.len())
}

#[tauri::command]
pub fn fontpreview_get_font_categories(
    state: State<'_, FontPreviewManager>,
) -> Result<Vec<FontCategory>, String> {
    let fonts = ensure_fonts(&state)?;

    let mut serif_count = 0usize;
    let mut sans_count = 0usize;
    let mut mono_count = 0usize;
    let mut display_count = 0usize;

    for font in &fonts {
        match categorize_font(font) {
            "serif" => serif_count += 1,
            "sans-serif" => sans_count += 1,
            "monospace" => mono_count += 1,
            "display" => display_count += 1,
            _ => sans_count += 1,
        }
    }

    Ok(vec![
        FontCategory {
            name: "serif".to_string(),
            count: serif_count,
        },
        FontCategory {
            name: "sans-serif".to_string(),
            count: sans_count,
        },
        FontCategory {
            name: "monospace".to_string(),
            count: mono_count,
        },
        FontCategory {
            name: "display".to_string(),
            count: display_count,
        },
    ])
}

#[tauri::command]
pub fn fontpreview_get_favorites(
    state: State<'_, FontPreviewManager>,
) -> Result<Vec<String>, String> {
    let favs = state.favorites.lock().map_err(|e| e.to_string())?;
    let mut list: Vec<String> = favs.iter().cloned().collect();
    list.sort();
    Ok(list)
}

#[tauri::command]
pub fn fontpreview_add_favorite(
    state: State<'_, FontPreviewManager>,
    font_name: String,
) -> Result<bool, String> {
    let mut favs = state.favorites.lock().map_err(|e| e.to_string())?;
    Ok(favs.insert(font_name))
}

#[tauri::command]
pub fn fontpreview_remove_favorite(
    state: State<'_, FontPreviewManager>,
    font_name: String,
) -> Result<bool, String> {
    let mut favs = state.favorites.lock().map_err(|e| e.to_string())?;
    Ok(favs.remove(&font_name))
}
