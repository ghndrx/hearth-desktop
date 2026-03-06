//! Color Palette Generator - generates harmonious color palettes from a base color
//!
//! Supports complementary, analogous, triadic, split-complementary, tetradic,
//! and monochromatic harmony modes.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HslColor {
    pub h: f64,
    pub s: f64,
    pub l: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteColor {
    pub hex: String,
    pub hsl: HslColor,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Palette {
    pub mode: String,
    pub colors: Vec<PaletteColor>,
}

fn hex_to_hsl(hex: &str) -> Result<(f64, f64, f64), String> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return Err("Invalid hex color, expected 6 characters".into());
    }
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())? as f64 / 255.0;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())? as f64 / 255.0;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())? as f64 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;

    if (max - min).abs() < 1e-10 {
        return Ok((0.0, 0.0, l));
    }

    let d = max - min;
    let s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };

    let h = if (max - r).abs() < 1e-10 {
        let mut h = (g - b) / d;
        if g < b { h += 6.0; }
        h
    } else if (max - g).abs() < 1e-10 {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    };

    Ok((h * 60.0, s, l))
}

fn hsl_to_hex(h: f64, s: f64, l: f64) -> String {
    let h = ((h % 360.0) + 360.0) % 360.0;

    if s.abs() < 1e-10 {
        let v = (l * 255.0).round() as u8;
        return format!("#{:02x}{:02x}{:02x}", v, v, v);
    }

    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;

    let hue_to_rgb = |p: f64, q: f64, mut t: f64| -> f64 {
        if t < 0.0 { t += 1.0; }
        if t > 1.0 { t -= 1.0; }
        if t < 1.0 / 6.0 { return p + (q - p) * 6.0 * t; }
        if t < 1.0 / 2.0 { return q; }
        if t < 2.0 / 3.0 { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
        p
    };

    let h_norm = h / 360.0;
    let r = (hue_to_rgb(p, q, h_norm + 1.0 / 3.0) * 255.0).round() as u8;
    let g = (hue_to_rgb(p, q, h_norm) * 255.0).round() as u8;
    let b = (hue_to_rgb(p, q, h_norm - 1.0 / 3.0) * 255.0).round() as u8;

    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

fn make_color(h: f64, s: f64, l: f64, label: &str) -> PaletteColor {
    let h = ((h % 360.0) + 360.0) % 360.0;
    PaletteColor {
        hex: hsl_to_hex(h, s, l),
        hsl: HslColor { h, s, l },
        label: label.to_string(),
    }
}

fn generate_palette(hex: &str, mode: &str) -> Result<Palette, String> {
    let (h, s, l) = hex_to_hsl(hex)?;

    let colors = match mode {
        "complementary" => vec![
            make_color(h, s, l, "Base"),
            make_color(h + 180.0, s, l, "Complement"),
        ],
        "analogous" => vec![
            make_color(h - 30.0, s, l, "Analogous -30"),
            make_color(h, s, l, "Base"),
            make_color(h + 30.0, s, l, "Analogous +30"),
        ],
        "triadic" => vec![
            make_color(h, s, l, "Base"),
            make_color(h + 120.0, s, l, "Triadic +120"),
            make_color(h + 240.0, s, l, "Triadic +240"),
        ],
        "split-complementary" => vec![
            make_color(h, s, l, "Base"),
            make_color(h + 150.0, s, l, "Split +150"),
            make_color(h + 210.0, s, l, "Split +210"),
        ],
        "tetradic" => vec![
            make_color(h, s, l, "Base"),
            make_color(h + 90.0, s, l, "Tetradic +90"),
            make_color(h + 180.0, s, l, "Tetradic +180"),
            make_color(h + 270.0, s, l, "Tetradic +270"),
        ],
        "monochromatic" => vec![
            make_color(h, s, (l - 0.3).max(0.05), "Darkest"),
            make_color(h, s, (l - 0.15).max(0.05), "Dark"),
            make_color(h, s, l, "Base"),
            make_color(h, s, (l + 0.15).min(0.95), "Light"),
            make_color(h, s, (l + 0.3).min(0.95), "Lightest"),
        ],
        _ => return Err(format!("Unknown palette mode: {}", mode)),
    };

    Ok(Palette {
        mode: mode.to_string(),
        colors,
    })
}

#[tauri::command]
pub fn palette_generate(hex: String, mode: String) -> Result<Palette, String> {
    generate_palette(&hex, &mode)
}

#[tauri::command]
pub fn palette_all_modes(hex: String) -> Result<Vec<Palette>, String> {
    let modes = ["complementary", "analogous", "triadic", "split-complementary", "tetradic", "monochromatic"];
    modes.iter().map(|m| generate_palette(&hex, m)).collect()
}

#[tauri::command]
pub fn palette_hex_to_hsl(hex: String) -> Result<HslColor, String> {
    let (h, s, l) = hex_to_hsl(&hex)?;
    Ok(HslColor { h, s, l })
}
