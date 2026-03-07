//! Color Contrast Checker - WCAG accessibility contrast ratio calculator
//!
//! Provides tools to check color contrast ratios between foreground and
//! background colors, evaluate WCAG 2.1 compliance levels (AA/AAA),
//! and suggest accessible color alternatives.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContrastResult {
    pub foreground: String,
    pub background: String,
    pub ratio: f64,
    pub wcag_aa_normal: bool,
    pub wcag_aa_large: bool,
    pub wcag_aaa_normal: bool,
    pub wcag_aaa_large: bool,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorSuggestion {
    pub color: String,
    pub ratio: f64,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContrastHistoryEntry {
    pub id: String,
    pub foreground: String,
    pub background: String,
    pub ratio: f64,
    pub level: String,
    pub checked_at: u64,
}

pub struct ContrastCheckerManager {
    history: Mutex<Vec<ContrastHistoryEntry>>,
}

impl Default for ContrastCheckerManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn parse_hex_color(hex: &str) -> Result<(f64, f64, f64), String> {
    let hex = hex.trim_start_matches('#');
    let hex = match hex.len() {
        3 => {
            let chars: Vec<char> = hex.chars().collect();
            format!(
                "{}{}{}{}{}{}",
                chars[0], chars[0], chars[1], chars[1], chars[2], chars[2]
            )
        }
        6 => hex.to_string(),
        _ => return Err(format!("Invalid hex color: #{}", hex)),
    };

    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())? as f64 / 255.0;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())? as f64 / 255.0;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())? as f64 / 255.0;

    Ok((r, g, b))
}

fn srgb_to_linear(c: f64) -> f64 {
    if c <= 0.03928 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn relative_luminance(r: f64, g: f64, b: f64) -> f64 {
    0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)
}

fn contrast_ratio(l1: f64, l2: f64) -> f64 {
    let lighter = l1.max(l2);
    let darker = l1.min(l2);
    (lighter + 0.05) / (darker + 0.05)
}

fn wcag_level(ratio: f64) -> String {
    if ratio >= 7.0 {
        "AAA".to_string()
    } else if ratio >= 4.5 {
        "AA".to_string()
    } else if ratio >= 3.0 {
        "AA Large".to_string()
    } else {
        "Fail".to_string()
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn linear_to_srgb(c: f64) -> f64 {
    if c <= 0.0031308 {
        12.92 * c
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

fn color_to_hex(r: f64, g: f64, b: f64) -> String {
    let r = (r.clamp(0.0, 1.0) * 255.0).round() as u8;
    let g = (g.clamp(0.0, 1.0) * 255.0).round() as u8;
    let b = (b.clamp(0.0, 1.0) * 255.0).round() as u8;
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

#[tauri::command]
pub fn contrast_check(
    state: State<'_, ContrastCheckerManager>,
    foreground: String,
    background: String,
) -> Result<ContrastResult, String> {
    let (fr, fg, fb) = parse_hex_color(&foreground)?;
    let (br, bg, bb) = parse_hex_color(&background)?;

    let l1 = relative_luminance(fr, fg, fb);
    let l2 = relative_luminance(br, bg, bb);
    let ratio = contrast_ratio(l1, l2);
    let ratio = (ratio * 100.0).round() / 100.0;

    let level = wcag_level(ratio);

    let result = ContrastResult {
        foreground: foreground.clone(),
        background: background.clone(),
        ratio,
        wcag_aa_normal: ratio >= 4.5,
        wcag_aa_large: ratio >= 3.0,
        wcag_aaa_normal: ratio >= 7.0,
        wcag_aaa_large: ratio >= 4.5,
        level: level.clone(),
    };

    // Add to history
    if let Ok(mut history) = state.history.lock() {
        let entry = ContrastHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            foreground,
            background,
            ratio,
            level,
            checked_at: now_ms(),
        };
        history.push(entry);
        if history.len() > 50 {
            history.remove(0);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn contrast_suggest(
    foreground: String,
    background: String,
    target_level: Option<String>,
) -> Result<Vec<ColorSuggestion>, String> {
    let (fr, fg, fb) = parse_hex_color(&foreground)?;
    let (br, bg, bb) = parse_hex_color(&background)?;

    let target_ratio = match target_level.as_deref().unwrap_or("AA") {
        "AAA" => 7.0,
        "AA" => 4.5,
        "AA Large" => 3.0,
        _ => 4.5,
    };

    let bg_lum = relative_luminance(br, bg, bb);
    let mut suggestions = Vec::new();

    // Try darkening and lightening the foreground
    for step in 1..=20 {
        let factor = step as f64 * 0.05;

        // Darken
        let dr = (fr * (1.0 - factor)).max(0.0);
        let dg = (fg * (1.0 - factor)).max(0.0);
        let db = (fb * (1.0 - factor)).max(0.0);
        let dark_lum = relative_luminance(dr, dg, db);
        let dark_ratio = contrast_ratio(dark_lum, bg_lum);

        if dark_ratio >= target_ratio {
            let hex = color_to_hex(dr, dg, db);
            let ratio = (dark_ratio * 100.0).round() / 100.0;
            suggestions.push(ColorSuggestion {
                color: hex,
                ratio,
                level: wcag_level(ratio),
            });
            break;
        }

        // Lighten
        let lr = fr + (1.0 - fr) * factor;
        let lg = fg + (1.0 - fg) * factor;
        let lb = fb + (1.0 - fb) * factor;
        let light_lum = relative_luminance(lr, lg, lb);
        let light_ratio = contrast_ratio(light_lum, bg_lum);

        if light_ratio >= target_ratio {
            let hex = color_to_hex(lr, lg, lb);
            let ratio = (light_ratio * 100.0).round() / 100.0;
            suggestions.push(ColorSuggestion {
                color: hex,
                ratio,
                level: wcag_level(ratio),
            });
            break;
        }
    }

    // Always suggest pure black and white as options
    let black_ratio = contrast_ratio(0.0, bg_lum);
    let white_ratio = contrast_ratio(1.0, bg_lum);

    suggestions.push(ColorSuggestion {
        color: "#000000".to_string(),
        ratio: (black_ratio * 100.0).round() / 100.0,
        level: wcag_level(black_ratio),
    });
    suggestions.push(ColorSuggestion {
        color: "#ffffff".to_string(),
        ratio: (white_ratio * 100.0).round() / 100.0,
        level: wcag_level(white_ratio),
    });

    // Sort by ratio descending, take top 5
    suggestions.sort_by(|a, b| b.ratio.partial_cmp(&a.ratio).unwrap_or(std::cmp::Ordering::Equal));
    suggestions.truncate(5);

    Ok(suggestions)
}

#[tauri::command]
pub fn contrast_get_history(
    state: State<'_, ContrastCheckerManager>,
) -> Result<Vec<ContrastHistoryEntry>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    let mut entries = history.clone();
    entries.reverse();
    Ok(entries)
}

#[tauri::command]
pub fn contrast_clear_history(
    state: State<'_, ContrastCheckerManager>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

#[tauri::command]
pub fn contrast_parse_color(color: String) -> Result<String, String> {
    // Normalize color to hex
    let trimmed = color.trim();

    // Already hex
    if trimmed.starts_with('#') {
        let (r, g, b) = parse_hex_color(trimmed)?;
        return Ok(color_to_hex(r, g, b));
    }

    // Try rgb(r, g, b)
    if trimmed.starts_with("rgb(") && trimmed.ends_with(')') {
        let inner = &trimmed[4..trimmed.len() - 1];
        let parts: Vec<&str> = inner.split(',').collect();
        if parts.len() == 3 {
            let r: u8 = parts[0].trim().parse().map_err(|_| "Invalid red value")?;
            let g: u8 = parts[1].trim().parse().map_err(|_| "Invalid green value")?;
            let b: u8 = parts[2].trim().parse().map_err(|_| "Invalid blue value")?;
            return Ok(format!("#{:02x}{:02x}{:02x}", r, g, b));
        }
    }

    // Try named colors
    let named = match trimmed.to_lowercase().as_str() {
        "black" => "#000000",
        "white" => "#ffffff",
        "red" => "#ff0000",
        "green" => "#008000",
        "blue" => "#0000ff",
        "yellow" => "#ffff00",
        "cyan" => "#00ffff",
        "magenta" => "#ff00ff",
        "gray" | "grey" => "#808080",
        "orange" => "#ffa500",
        "purple" => "#800080",
        "pink" => "#ffc0cb",
        _ => return Err(format!("Unrecognized color: {}", trimmed)),
    };

    Ok(named.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contrast_black_white() {
        let (r, g, b) = parse_hex_color("#000000").unwrap();
        let l_black = relative_luminance(r, g, b);

        let (r, g, b) = parse_hex_color("#ffffff").unwrap();
        let l_white = relative_luminance(r, g, b);

        let ratio = contrast_ratio(l_black, l_white);
        assert!((ratio - 21.0).abs() < 0.1);
    }

    #[test]
    fn test_wcag_levels() {
        assert_eq!(wcag_level(21.0), "AAA");
        assert_eq!(wcag_level(7.0), "AAA");
        assert_eq!(wcag_level(5.0), "AA");
        assert_eq!(wcag_level(3.5), "AA Large");
        assert_eq!(wcag_level(2.0), "Fail");
    }

    #[test]
    fn test_parse_shorthand_hex() {
        let (r, g, b) = parse_hex_color("#fff").unwrap();
        assert!((r - 1.0).abs() < 0.01);
        assert!((g - 1.0).abs() < 0.01);
        assert!((b - 1.0).abs() < 0.01);
    }
}
