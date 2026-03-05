use tauri::AppHandle;

#[derive(serde::Serialize, Clone)]
pub struct AccentColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub hex: String,
}

#[derive(serde::Serialize, Clone)]
pub struct SystemThemeInfo {
    pub is_dark_mode: bool,
    pub accent_color: Option<AccentColor>,
    pub high_contrast: bool,
    pub reduce_motion: bool,
    pub reduce_transparency: bool,
}

/// Get the system accent color
#[tauri::command]
pub async fn get_system_accent_color() -> Result<Option<AccentColor>, String> {
    #[cfg(target_os = "macos")]
    {
        // macOS: Read accent color from defaults
        let output = std::process::Command::new("defaults")
            .args(["read", "-g", "AppleAccentColor"])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // macOS accent color mapping
            let (r, g, b) = match value.as_str() {
                "-1" => (142, 142, 147), // Graphite
                "0" => (255, 59, 48),    // Red
                "1" => (255, 149, 0),    // Orange
                "2" => (255, 204, 0),    // Yellow
                "3" => (52, 199, 89),    // Green
                "4" => (0, 122, 255),    // Blue (default)
                "5" => (175, 82, 222),   // Purple
                "6" => (255, 45, 85),    // Pink
                _ => (0, 122, 255),      // Default blue
            };
            return Ok(Some(AccentColor {
                r,
                g,
                b,
                hex: format!("#{:02x}{:02x}{:02x}", r, g, b),
            }));
        }
        Ok(Some(AccentColor {
            r: 0,
            g: 122,
            b: 255,
            hex: "#007aff".to_string(),
        }))
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: Read from registry
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\DWM",
                "/v",
                "AccentColor",
            ])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            // Parse hex value from registry output
            if let Some(hex_pos) = text.find("0x") {
                let hex_str = &text[hex_pos + 2..hex_pos + 10];
                if let Ok(value) = u32::from_str_radix(hex_str.trim(), 16) {
                    // Windows stores as AABBGGRR
                    let r = (value & 0xFF) as u8;
                    let g = ((value >> 8) & 0xFF) as u8;
                    let b = ((value >> 16) & 0xFF) as u8;
                    return Ok(Some(AccentColor {
                        r,
                        g,
                        b,
                        hex: format!("#{:02x}{:02x}{:02x}", r, g, b),
                    }));
                }
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: Try GTK settings
        let output = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "accent-color"])
            .output();

        if let Ok(output) = output {
            if output.status.success() {
                let color_name = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .trim_matches('\'')
                    .to_string();
                let (r, g, b) = match color_name.as_str() {
                    "blue" => (53, 132, 228),
                    "teal" => (38, 162, 105),
                    "green" => (46, 194, 126),
                    "yellow" => (245, 194, 17),
                    "orange" => (255, 120, 0),
                    "red" => (224, 27, 36),
                    "pink" => (214, 51, 132),
                    "purple" => (145, 65, 172),
                    "slate" => (134, 138, 142),
                    _ => (53, 132, 228),
                };
                return Ok(Some(AccentColor {
                    r,
                    g,
                    b,
                    hex: format!("#{:02x}{:02x}{:02x}", r, g, b),
                }));
            }
        }
        Ok(None)
    }
}

/// Get comprehensive system theme information
#[tauri::command]
pub async fn get_system_theme_info(app: AppHandle) -> Result<SystemThemeInfo, String> {
    let accent = get_system_accent_color().await.unwrap_or(None);

    let is_dark = {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("defaults")
                .args(["read", "-g", "AppleInterfaceStyle"])
                .output();
            output
                .map(|o| String::from_utf8_lossy(&o.stdout).contains("Dark"))
                .unwrap_or(false)
        }
        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("reg")
                .args([
                    "query",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                    "/v",
                    "AppsUseLightTheme",
                ])
                .output();
            output
                .map(|o| {
                    let text = String::from_utf8_lossy(&o.stdout);
                    text.contains("0x0")
                })
                .unwrap_or(true)
        }
        #[cfg(target_os = "linux")]
        {
            let output = std::process::Command::new("gsettings")
                .args(["get", "org.gnome.desktop.interface", "color-scheme"])
                .output();
            output
                .map(|o| {
                    String::from_utf8_lossy(&o.stdout)
                        .to_lowercase()
                        .contains("dark")
                })
                .unwrap_or(true)
        }
    };

    let reduce_motion = {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("defaults")
                .args(["read", "com.apple.universalaccess", "reduceMotion"])
                .output();
            output
                .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1")
                .unwrap_or(false)
        }
        #[cfg(not(target_os = "macos"))]
        {
            false
        }
    };

    let reduce_transparency = {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("defaults")
                .args(["read", "com.apple.universalaccess", "reduceTransparency"])
                .output();
            output
                .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1")
                .unwrap_or(false)
        }
        #[cfg(not(target_os = "macos"))]
        {
            false
        }
    };

    Ok(SystemThemeInfo {
        is_dark_mode: is_dark,
        accent_color: accent,
        high_contrast: false,
        reduce_motion,
        reduce_transparency,
    })
}

/// Watch for system theme changes (emits events)
#[tauri::command]
pub async fn watch_system_theme(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut last_dark = None;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            let rt = tokio::runtime::Runtime::new().unwrap();
            if let Ok(info) = rt.block_on(get_system_theme_info(app_clone.clone())) {
                let changed = last_dark.map(|l| l != info.is_dark_mode).unwrap_or(true);
                if changed {
                    last_dark = Some(info.is_dark_mode);
                    let _ = app_clone.emit("system-theme-changed", &info);
                }
            }
        }
    });
    Ok(())
}
