use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Color representation with multiple formats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorValue {
    pub hex: String,
    pub rgb: RgbColor,
    pub hsl: HslColor,
    pub hsv: HsvColor,
    pub timestamp: i64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RgbColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HslColor {
    pub h: f32,
    pub s: f32,
    pub l: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsvColor {
    pub h: f32,
    pub s: f32,
    pub v: f32,
}

/// Color picker state management
pub struct ColorPickerState {
    pub history: Mutex<Vec<ColorValue>>,
    pub favorites: Mutex<Vec<ColorValue>>,
    pub max_history: usize,
}

impl Default for ColorPickerState {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
            favorites: Mutex::new(Vec::new()),
            max_history: 50,
        }
    }
}

/// Convert RGB to HEX string
fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

/// Convert RGB to HSL
fn rgb_to_hsl(r: u8, g: u8, b: u8) -> HslColor {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;

    if max == min {
        return HslColor { h: 0.0, s: 0.0, l };
    }

    let d = max - min;
    let s = if l > 0.5 {
        d / (2.0 - max - min)
    } else {
        d / (max + min)
    };

    let h = if max == r {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if max == g {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };

    HslColor {
        h: h * 360.0,
        s: s * 100.0,
        l: l * 100.0,
    }
}

/// Convert RGB to HSV
fn rgb_to_hsv(r: u8, g: u8, b: u8) -> HsvColor {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let v = max;
    let d = max - min;

    let s = if max == 0.0 { 0.0 } else { d / max };

    let h = if max == min {
        0.0
    } else if max == r {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if max == g {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };

    HsvColor {
        h: h * 360.0,
        s: s * 100.0,
        v: v * 100.0,
    }
}

/// Create ColorValue from RGB
fn create_color_value(r: u8, g: u8, b: u8, a: u8) -> ColorValue {
    ColorValue {
        hex: rgb_to_hex(r, g, b),
        rgb: RgbColor { r, g, b, a },
        hsl: rgb_to_hsl(r, g, b),
        hsv: rgb_to_hsv(r, g, b),
        timestamp: chrono::Utc::now().timestamp_millis(),
        label: None,
    }
}

/// Pick color from screen at cursor position
#[tauri::command]
pub async fn pick_color_at_cursor(
    app: AppHandle,
    state: State<'_, ColorPickerState>,
) -> Result<ColorValue, String> {
    #[cfg(target_os = "macos")]
    {
        // Use macOS color picker or screen capture
        let output = std::process::Command::new("osascript")
            .args([
                "-e",
                r#"
                use framework "AppKit"
                use framework "Foundation"
                
                set mouseLoc to current application's NSEvent's mouseLocation()
                set screenHeight to (current application's NSScreen's mainScreen()'s frame()'s |size|()'s height) as integer
                
                set captureX to (mouseLoc's x as integer)
                set captureY to (screenHeight - (mouseLoc's y as integer))
                
                set captureRect to current application's CGRectMake(captureX, captureY, 1, 1)
                set imageRef to current application's CGWindowListCreateImage(captureRect, (current application's kCGWindowListOptionOnScreenOnly), (current application's kCGNullWindowID), (current application's kCGWindowImageDefault))
                
                set bitmapRep to current application's NSBitmapImageRep's alloc()'s initWithCGImage:imageRef
                set pixelColor to bitmapRep's colorAtX:0 y:0
                
                set redValue to ((pixelColor's redComponent()) * 255) as integer
                set greenValue to ((pixelColor's greenComponent()) * 255) as integer
                set blueValue to ((pixelColor's blueComponent()) * 255) as integer
                
                return (redValue as text) & "," & (greenValue as text) & "," & (blueValue as text)
                "#,
            ])
            .output()
            .map_err(|e| format!("Failed to pick color: {}", e))?;

        if !output.status.success() {
            return Err("Color picking failed".to_string());
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result.split(',').collect();
        
        if parts.len() != 3 {
            return Err("Invalid color data".to_string());
        }

        let r: u8 = parts[0].parse().map_err(|_| "Invalid red value")?;
        let g: u8 = parts[1].parse().map_err(|_| "Invalid green value")?;
        let b: u8 = parts[2].parse().map_err(|_| "Invalid blue value")?;

        let color = create_color_value(r, g, b, 255);
        
        // Add to history
        if let Ok(mut history) = state.history.lock() {
            history.insert(0, color.clone());
            if history.len() > state.max_history {
                history.truncate(state.max_history);
            }
        }

        // Emit color picked event
        let _ = app.emit("color-picked", &color);

        return Ok(color);
    }

    #[cfg(target_os = "windows")]
    {
        let script = r#"
        Add-Type @"
        using System;
        using System.Drawing;
        using System.Runtime.InteropServices;
        public class ColorPicker {
            [DllImport("user32.dll")]
            public static extern bool GetCursorPos(out POINT lpPoint);
            [DllImport("user32.dll")]
            public static extern IntPtr GetDC(IntPtr hwnd);
            [DllImport("user32.dll")]
            public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
            [DllImport("gdi32.dll")]
            public static extern uint GetPixel(IntPtr hdc, int nXPos, int nYPos);
            [StructLayout(LayoutKind.Sequential)]
            public struct POINT { public int X; public int Y; }
            public static string GetColorAtCursor() {
                POINT p;
                GetCursorPos(out p);
                IntPtr hdc = GetDC(IntPtr.Zero);
                uint pixel = GetPixel(hdc, p.X, p.Y);
                ReleaseDC(IntPtr.Zero, hdc);
                int r = (int)(pixel & 0xFF);
                int g = (int)((pixel >> 8) & 0xFF);
                int b = (int)((pixel >> 16) & 0xFF);
                return r + "," + g + "," + b;
            }
        }
"@
        [ColorPicker]::GetColorAtCursor()
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to pick color: {}", e))?;

        if !output.status.success() {
            return Err("Color picking failed".to_string());
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result.split(',').collect();
        
        if parts.len() != 3 {
            return Err("Invalid color data".to_string());
        }

        let r: u8 = parts[0].parse().map_err(|_| "Invalid red value")?;
        let g: u8 = parts[1].parse().map_err(|_| "Invalid green value")?;
        let b: u8 = parts[2].parse().map_err(|_| "Invalid blue value")?;

        let color = create_color_value(r, g, b, 255);
        
        if let Ok(mut history) = state.history.lock() {
            history.insert(0, color.clone());
            if history.len() > state.max_history {
                history.truncate(state.max_history);
            }
        }

        let _ = app.emit("color-picked", &color);

        return Ok(color);
    }

    #[cfg(target_os = "linux")]
    {
        // Try using xdotool + import or scrot for color picking
        let output = std::process::Command::new("sh")
            .args([
                "-c",
                r#"
                eval $(xdotool getmouselocation --shell)
                import -window root -crop 1x1+$X+$Y txt:- | grep -oP '\(\K[0-9,]+(?=\))'
                "#,
            ])
            .output()
            .map_err(|e| format!("Failed to pick color: {}", e))?;

        if !output.status.success() {
            return Err("Color picking failed - ensure xdotool and imagemagick are installed".to_string());
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result.split(',').collect();
        
        if parts.len() < 3 {
            return Err("Invalid color data".to_string());
        }

        let r: u8 = parts[0].parse().map_err(|_| "Invalid red value")?;
        let g: u8 = parts[1].parse().map_err(|_| "Invalid green value")?;
        let b: u8 = parts[2].parse().map_err(|_| "Invalid blue value")?;

        let color = create_color_value(r, g, b, 255);
        
        if let Ok(mut history) = state.history.lock() {
            history.insert(0, color.clone());
            if history.len() > state.max_history {
                history.truncate(state.max_history);
            }
        }

        let _ = app.emit("color-picked", &color);

        return Ok(color);
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

/// Parse color from string (HEX, RGB, HSL formats)
#[tauri::command]
pub fn parse_color(input: String) -> Result<ColorValue, String> {
    let input = input.trim();
    
    // HEX format (#RGB, #RRGGBB, #RRGGBBAA)
    if input.starts_with('#') {
        let hex = input.trim_start_matches('#');
        let (r, g, b, a) = match hex.len() {
            3 => {
                let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).map_err(|_| "Invalid hex")?;
                let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).map_err(|_| "Invalid hex")?;
                let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).map_err(|_| "Invalid hex")?;
                (r, g, b, 255u8)
            }
            6 => {
                let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid hex")?;
                let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid hex")?;
                let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid hex")?;
                (r, g, b, 255u8)
            }
            8 => {
                let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid hex")?;
                let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid hex")?;
                let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid hex")?;
                let a = u8::from_str_radix(&hex[6..8], 16).map_err(|_| "Invalid hex")?;
                (r, g, b, a)
            }
            _ => return Err("Invalid hex format".to_string()),
        };
        return Ok(create_color_value(r, g, b, a));
    }
    
    // RGB format: rgb(r, g, b) or rgba(r, g, b, a)
    if input.starts_with("rgb") {
        let values: String = input.chars().filter(|c| c.is_numeric() || *c == ',' || *c == '.').collect();
        let parts: Vec<&str> = values.split(',').collect();
        
        if parts.len() < 3 {
            return Err("Invalid RGB format".to_string());
        }
        
        let r: u8 = parts[0].parse().map_err(|_| "Invalid red value")?;
        let g: u8 = parts[1].parse().map_err(|_| "Invalid green value")?;
        let b: u8 = parts[2].parse().map_err(|_| "Invalid blue value")?;
        let a: u8 = if parts.len() > 3 {
            (parts[3].parse::<f32>().unwrap_or(1.0) * 255.0) as u8
        } else {
            255
        };
        
        return Ok(create_color_value(r, g, b, a));
    }
    
    Err("Unrecognized color format".to_string())
}

/// Get color history
#[tauri::command]
pub fn get_color_history(state: State<'_, ColorPickerState>) -> Vec<ColorValue> {
    state.history.lock().map(|h| h.clone()).unwrap_or_default()
}

/// Clear color history
#[tauri::command]
pub fn clear_color_history(state: State<'_, ColorPickerState>) -> Result<(), String> {
    if let Ok(mut history) = state.history.lock() {
        history.clear();
        Ok(())
    } else {
        Err("Failed to clear history".to_string())
    }
}

/// Add color to favorites
#[tauri::command]
pub fn add_color_to_favorites(
    color: ColorValue,
    state: State<'_, ColorPickerState>,
) -> Result<(), String> {
    if let Ok(mut favorites) = state.favorites.lock() {
        // Check if already exists
        if !favorites.iter().any(|c| c.hex == color.hex) {
            favorites.push(color);
        }
        Ok(())
    } else {
        Err("Failed to add to favorites".to_string())
    }
}

/// Remove color from favorites
#[tauri::command]
pub fn remove_color_from_favorites(
    hex: String,
    state: State<'_, ColorPickerState>,
) -> Result<(), String> {
    if let Ok(mut favorites) = state.favorites.lock() {
        favorites.retain(|c| c.hex != hex);
        Ok(())
    } else {
        Err("Failed to remove from favorites".to_string())
    }
}

/// Get favorite colors
#[tauri::command]
pub fn get_favorite_colors(state: State<'_, ColorPickerState>) -> Vec<ColorValue> {
    state.favorites.lock().map(|f| f.clone()).unwrap_or_default()
}

/// Copy color to clipboard in specified format
#[tauri::command]
pub async fn copy_color_to_clipboard(
    color: ColorValue,
    format: String,
) -> Result<(), String> {
    let text = match format.to_lowercase().as_str() {
        "hex" => color.hex,
        "rgb" => format!("rgb({}, {}, {})", color.rgb.r, color.rgb.g, color.rgb.b),
        "rgba" => format!(
            "rgba({}, {}, {}, {})",
            color.rgb.r, color.rgb.g, color.rgb.b,
            color.rgb.a as f32 / 255.0
        ),
        "hsl" => format!(
            "hsl({:.0}, {:.0}%, {:.0}%)",
            color.hsl.h, color.hsl.s, color.hsl.l
        ),
        "hsv" => format!(
            "hsv({:.0}, {:.0}%, {:.0}%)",
            color.hsv.h, color.hsv.s, color.hsv.v
        ),
        _ => color.hex,
    };

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                if let Some(stdin) = child.stdin.as_mut() {
                    stdin.write_all(text.as_bytes())?;
                }
                child.wait()
            });
    }

    #[cfg(target_os = "windows")]
    {
        let cmd_arg = format!("echo {} | clip", text);
        let _ = std::process::Command::new("cmd")
            .args(["/C", &cmd_arg])
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        let sh_arg = format!("echo -n '{}' | xclip -selection clipboard", text);
        let _ = std::process::Command::new("sh")
            .args(["-c", &sh_arg])
            .output();
    }

    Ok(())
}

/// Generate color palette from base color
#[tauri::command]
pub fn generate_color_palette(hex: String, palette_type: String) -> Result<Vec<ColorValue>, String> {
    let base = parse_color(hex)?;
    let mut palette = vec![base.clone()];
    
    match palette_type.as_str() {
        "complementary" => {
            // Add complementary color (opposite on color wheel)
            let comp_h = (base.hsl.h + 180.0) % 360.0;
            let (r, g, b) = hsl_to_rgb(comp_h, base.hsl.s, base.hsl.l);
            palette.push(create_color_value(r, g, b, 255));
        }
        "triadic" => {
            // Add two colors 120° apart
            for offset in [120.0, 240.0] {
                let h = (base.hsl.h + offset) % 360.0;
                let (r, g, b) = hsl_to_rgb(h, base.hsl.s, base.hsl.l);
                palette.push(create_color_value(r, g, b, 255));
            }
        }
        "analogous" => {
            // Add colors 30° apart
            for offset in [-30.0, 30.0] {
                let h = (base.hsl.h + offset + 360.0) % 360.0;
                let (r, g, b) = hsl_to_rgb(h, base.hsl.s, base.hsl.l);
                palette.push(create_color_value(r, g, b, 255));
            }
        }
        "shades" => {
            // Generate darker shades
            for i in 1..=4 {
                let l = (base.hsl.l - (i as f32 * 15.0)).max(0.0);
                let (r, g, b) = hsl_to_rgb(base.hsl.h, base.hsl.s, l);
                palette.push(create_color_value(r, g, b, 255));
            }
        }
        "tints" => {
            // Generate lighter tints
            for i in 1..=4 {
                let l = (base.hsl.l + (i as f32 * 15.0)).min(100.0);
                let (r, g, b) = hsl_to_rgb(base.hsl.h, base.hsl.s, l);
                palette.push(create_color_value(r, g, b, 255));
            }
        }
        _ => return Err("Unknown palette type".to_string()),
    }
    
    Ok(palette)
}

/// Convert HSL to RGB
fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (u8, u8, u8) {
    let s = s / 100.0;
    let l = l / 100.0;
    
    if s == 0.0 {
        let v = (l * 255.0) as u8;
        return (v, v, v);
    }
    
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let h = h / 360.0;
    
    let hue_to_rgb = |p: f32, q: f32, mut t: f32| -> f32 {
        if t < 0.0 { t += 1.0; }
        if t > 1.0 { t -= 1.0; }
        if t < 1.0 / 6.0 { return p + (q - p) * 6.0 * t; }
        if t < 1.0 / 2.0 { return q; }
        if t < 2.0 / 3.0 { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
        p
    };
    
    let r = (hue_to_rgb(p, q, h + 1.0 / 3.0) * 255.0) as u8;
    let g = (hue_to_rgb(p, q, h) * 255.0) as u8;
    let b = (hue_to_rgb(p, q, h - 1.0 / 3.0) * 255.0) as u8;
    
    (r, g, b)
}
