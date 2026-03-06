use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, Clone)]
pub struct InputMethodInfo {
    pub id: String,
    pub name: String,
    pub language: String,
    pub layout: String,
}

/// Get the current keyboard layout / input method
#[tauri::command]
pub async fn get_current_input_method() -> Result<InputMethodInfo, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("defaults")
            .args(["read", "com.apple.HIToolbox", "AppleCurrentKeyboardLayoutInputSourceID"])
            .output()
            .map_err(|e| e.to_string())?;

        let id = String::from_utf8_lossy(&output.stdout).trim().to_string();

        // Parse the input source ID (e.g., "com.apple.keylayout.US")
        let name = id
            .split('.')
            .last()
            .unwrap_or("Unknown")
            .to_string();

        let language = if name.contains("US") || name.contains("ABC") {
            "en".to_string()
        } else if name.contains("German") {
            "de".to_string()
        } else if name.contains("French") {
            "fr".to_string()
        } else if name.contains("Japanese") || name.contains("Kana") {
            "ja".to_string()
        } else if name.contains("Chinese") || name.contains("Pinyin") {
            "zh".to_string()
        } else if name.contains("Korean") {
            "ko".to_string()
        } else {
            "unknown".to_string()
        };

        Ok(InputMethodInfo {
            id,
            name,
            language,
            layout: "qwerty".to_string(),
        })
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args(["-Command", "Get-WinUserLanguageList | Select-Object -First 1 -ExpandProperty LanguageTag"])
            .output()
            .map_err(|e| e.to_string())?;

        let lang_tag = String::from_utf8_lossy(&output.stdout).trim().to_string();

        Ok(InputMethodInfo {
            id: lang_tag.clone(),
            name: lang_tag.clone(),
            language: lang_tag.split('-').next().unwrap_or("en").to_string(),
            layout: "unknown".to_string(),
        })
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("setxkbmap")
            .args(["-query"])
            .output()
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout);
        let layout = text
            .lines()
            .find(|l| l.starts_with("layout:"))
            .map(|l| l.split_whitespace().nth(1).unwrap_or("us"))
            .unwrap_or("us")
            .to_string();

        let variant = text
            .lines()
            .find(|l| l.starts_with("variant:"))
            .map(|l| l.split_whitespace().nth(1).unwrap_or(""))
            .unwrap_or("")
            .to_string();

        Ok(InputMethodInfo {
            id: format!("{}:{}", layout, variant),
            name: layout.clone(),
            language: layout.clone(),
            layout: variant,
        })
    }
}

/// List all available input methods / keyboard layouts
#[tauri::command]
pub async fn list_input_methods() -> Result<Vec<InputMethodInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        // Use AppleScript to list input sources
        let output = std::process::Command::new("defaults")
            .args(["read", "com.apple.HIToolbox", "AppleEnabledInputSources"])
            .output()
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout);
        let mut methods = Vec::new();

        // Parse plist-style output for input source names
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.contains("KeyboardLayout Name") {
                if let Some(name) = trimmed.split('=').nth(1) {
                    let name = name.trim().trim_matches(';').trim().trim_matches('"').to_string();
                    methods.push(InputMethodInfo {
                        id: format!("com.apple.keylayout.{}", name),
                        name: name.clone(),
                        language: "unknown".to_string(),
                        layout: name,
                    });
                }
            }
        }

        if methods.is_empty() {
            methods.push(InputMethodInfo {
                id: "com.apple.keylayout.US".to_string(),
                name: "US".to_string(),
                language: "en".to_string(),
                layout: "qwerty".to_string(),
            });
        }

        Ok(methods)
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args(["-Command", "Get-WinUserLanguageList | ForEach-Object { $_.LanguageTag }"])
            .output()
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout);
        let methods: Vec<InputMethodInfo> = text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| {
                let tag = l.trim().to_string();
                InputMethodInfo {
                    id: tag.clone(),
                    name: tag.clone(),
                    language: tag.split('-').next().unwrap_or("en").to_string(),
                    layout: "unknown".to_string(),
                }
            })
            .collect();

        Ok(methods)
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("localectl")
            .args(["list-x11-keymap-layouts"])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                let methods: Vec<InputMethodInfo> = text
                    .lines()
                    .take(50) // Limit to first 50
                    .filter(|l| !l.trim().is_empty())
                    .map(|l| {
                        let layout = l.trim().to_string();
                        InputMethodInfo {
                            id: layout.clone(),
                            name: layout.clone(),
                            language: layout.clone(),
                            layout: layout,
                        }
                    })
                    .collect();
                Ok(methods)
            }
            _ => Ok(vec![InputMethodInfo {
                id: "us".to_string(),
                name: "US".to_string(),
                language: "en".to_string(),
                layout: "qwerty".to_string(),
            }]),
        }
    }
}

/// Watch for input method changes and emit events
#[tauri::command]
pub async fn watch_input_method(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut last_id = String::new();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let rt = tokio::runtime::Runtime::new().unwrap();
            if let Ok(info) = rt.block_on(get_current_input_method()) {
                if info.id != last_id {
                    last_id = info.id.clone();
                    let _ = app_clone.emit("input-method-changed", &info);
                }
            }
        }
    });
    Ok(())
}
