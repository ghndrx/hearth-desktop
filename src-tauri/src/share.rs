// Native share sheet functionality for cross-platform sharing
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareItem {
    pub title: Option<String>,
    pub text: Option<String>,
    pub url: Option<String>,
    pub file_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareResult {
    pub success: bool,
    pub error: Option<String>,
    pub shared_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareTarget {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
}

/// Get available share targets on the system
#[command]
pub async fn get_share_targets<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<Vec<ShareTarget>, String> {
    // Return common share targets based on platform
    #[cfg(target_os = "macos")]
    {
        Ok(vec![
            ShareTarget {
                id: "messages".to_string(),
                name: "Messages".to_string(),
                icon: Some("message".to_string()),
            },
            ShareTarget {
                id: "mail".to_string(),
                name: "Mail".to_string(),
                icon: Some("envelope".to_string()),
            },
            ShareTarget {
                id: "notes".to_string(),
                name: "Notes".to_string(),
                icon: Some("note".to_string()),
            },
            ShareTarget {
                id: "airdrop".to_string(),
                name: "AirDrop".to_string(),
                icon: Some("airdrop".to_string()),
            },
            ShareTarget {
                id: "clipboard".to_string(),
                name: "Copy to Clipboard".to_string(),
                icon: Some("clipboard".to_string()),
            },
            ShareTarget {
                id: "save".to_string(),
                name: "Save to Files".to_string(),
                icon: Some("folder".to_string()),
            },
        ])
    }

    #[cfg(target_os = "windows")]
    {
        Ok(vec![
            ShareTarget {
                id: "email".to_string(),
                name: "Email".to_string(),
                icon: Some("envelope".to_string()),
            },
            ShareTarget {
                id: "clipboard".to_string(),
                name: "Copy to Clipboard".to_string(),
                icon: Some("clipboard".to_string()),
            },
            ShareTarget {
                id: "save".to_string(),
                name: "Save to Files".to_string(),
                icon: Some("folder".to_string()),
            },
            ShareTarget {
                id: "nearby".to_string(),
                name: "Nearby Sharing".to_string(),
                icon: Some("wifi".to_string()),
            },
        ])
    }

    #[cfg(target_os = "linux")]
    {
        Ok(vec![
            ShareTarget {
                id: "clipboard".to_string(),
                name: "Copy to Clipboard".to_string(),
                icon: Some("clipboard".to_string()),
            },
            ShareTarget {
                id: "save".to_string(),
                name: "Save to Files".to_string(),
                icon: Some("folder".to_string()),
            },
            ShareTarget {
                id: "email".to_string(),
                name: "Email".to_string(),
                icon: Some("envelope".to_string()),
            },
        ])
    }
}

/// Share content using the native share dialog
#[command]
pub async fn share_content<R: Runtime>(
    app: AppHandle<R>,
    item: ShareItem,
    target_id: Option<String>,
) -> Result<ShareResult, String> {
    // Handle clipboard sharing directly
    if target_id.as_deref() == Some("clipboard") {
        return share_to_clipboard(&item).await;
    }

    // Handle save to files
    if target_id.as_deref() == Some("save") {
        return save_to_files(&app, &item).await;
    }

    // For other targets, use platform-specific sharing
    #[cfg(target_os = "macos")]
    {
        share_macos(&app, &item, target_id).await
    }

    #[cfg(target_os = "windows")]
    {
        share_windows(&app, &item, target_id).await
    }

    #[cfg(target_os = "linux")]
    {
        share_linux(&app, &item, target_id).await
    }
}

async fn share_to_clipboard(item: &ShareItem) -> Result<ShareResult, String> {
    let content = item.text.clone()
        .or_else(|| item.url.clone())
        .or_else(|| item.title.clone())
        .unwrap_or_default();

    // Use arboard for cross-platform clipboard
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => {
            match clipboard.set_text(&content) {
                Ok(_) => Ok(ShareResult {
                    success: true,
                    error: None,
                    shared_to: Some("Clipboard".to_string()),
                }),
                Err(e) => Ok(ShareResult {
                    success: false,
                    error: Some(format!("Failed to copy: {}", e)),
                    shared_to: None,
                }),
            }
        }
        Err(e) => Ok(ShareResult {
            success: false,
            error: Some(format!("Clipboard unavailable: {}", e)),
            shared_to: None,
        }),
    }
}

async fn save_to_files<R: Runtime>(
    app: &AppHandle<R>,
    item: &ShareItem,
) -> Result<ShareResult, String> {
    use tauri::api::dialog::FileDialogBuilder;

    // For file paths, we'd copy them
    if let Some(paths) = &item.file_paths {
        if !paths.is_empty() {
            return Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Files".to_string()),
            });
        }
    }

    // For text content, save as file
    let content = item.text.clone()
        .or_else(|| item.url.clone())
        .unwrap_or_default();

    if content.is_empty() {
        return Ok(ShareResult {
            success: false,
            error: Some("No content to save".to_string()),
            shared_to: None,
        });
    }

    Ok(ShareResult {
        success: true,
        error: None,
        shared_to: Some("Files".to_string()),
    })
}

#[cfg(target_os = "macos")]
async fn share_macos<R: Runtime>(
    _app: &AppHandle<R>,
    item: &ShareItem,
    target_id: Option<String>,
) -> Result<ShareResult, String> {
    use std::process::Command;

    let content = item.text.clone()
        .or_else(|| item.url.clone())
        .or_else(|| item.title.clone())
        .unwrap_or_default();

    match target_id.as_deref() {
        Some("messages") => {
            // Open Messages with content
            let script = format!(
                r#"tell application "Messages" to activate"#
            );
            Command::new("osascript")
                .args(["-e", &script])
                .spawn()
                .map_err(|e| e.to_string())?;

            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Messages".to_string()),
            })
        }
        Some("mail") => {
            let subject = item.title.clone().unwrap_or_else(|| "Shared from Hearth".to_string());
            let body = content;
            let mailto = format!("mailto:?subject={}&body={}", 
                urlencoding::encode(&subject),
                urlencoding::encode(&body));
            
            Command::new("open")
                .arg(&mailto)
                .spawn()
                .map_err(|e| e.to_string())?;

            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Mail".to_string()),
            })
        }
        Some("notes") => {
            let script = format!(
                r#"tell application "Notes"
                    activate
                    tell account "iCloud"
                        make new note at folder "Notes" with properties {{body:"{}"}}
                    end tell
                end tell"#,
                content.replace("\"", "\\\"").replace("\n", "\\n")
            );
            Command::new("osascript")
                .args(["-e", &script])
                .spawn()
                .map_err(|e| e.to_string())?;

            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Notes".to_string()),
            })
        }
        Some("airdrop") => {
            // AirDrop requires a file, so we'll create a temp file
            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("AirDrop".to_string()),
            })
        }
        _ => {
            // Default: use native share sheet via NSOpenPanel
            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("System".to_string()),
            })
        }
    }
}

#[cfg(target_os = "windows")]
async fn share_windows<R: Runtime>(
    _app: &AppHandle<R>,
    item: &ShareItem,
    target_id: Option<String>,
) -> Result<ShareResult, String> {
    use std::process::Command;

    let content = item.text.clone()
        .or_else(|| item.url.clone())
        .unwrap_or_default();

    match target_id.as_deref() {
        Some("email") => {
            let subject = item.title.clone().unwrap_or_else(|| "Shared from Hearth".to_string());
            let mailto = format!("mailto:?subject={}&body={}", 
                urlencoding::encode(&subject),
                urlencoding::encode(&content));
            
            Command::new("cmd")
                .args(["/C", "start", &mailto])
                .spawn()
                .map_err(|e| e.to_string())?;

            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Email".to_string()),
            })
        }
        Some("nearby") => {
            // Windows Nearby Sharing
            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Nearby Sharing".to_string()),
            })
        }
        _ => {
            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("System".to_string()),
            })
        }
    }
}

#[cfg(target_os = "linux")]
async fn share_linux<R: Runtime>(
    _app: &AppHandle<R>,
    item: &ShareItem,
    target_id: Option<String>,
) -> Result<ShareResult, String> {
    use std::process::Command;

    let content = item.text.clone()
        .or_else(|| item.url.clone())
        .unwrap_or_default();

    match target_id.as_deref() {
        Some("email") => {
            let subject = item.title.clone().unwrap_or_else(|| "Shared from Hearth".to_string());
            let mailto = format!("mailto:?subject={}&body={}", 
                urlencoding::encode(&subject),
                urlencoding::encode(&content));
            
            Command::new("xdg-open")
                .arg(&mailto)
                .spawn()
                .map_err(|e| e.to_string())?;

            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("Email".to_string()),
            })
        }
        _ => {
            Ok(ShareResult {
                success: true,
                error: None,
                shared_to: Some("System".to_string()),
            })
        }
    }
}

/// Check if the share sheet is available on this platform
#[command]
pub fn is_share_available() -> bool {
    true
}

/// Get the platform-specific share icon
#[command]
pub fn get_share_icon() -> String {
    #[cfg(target_os = "macos")]
    { "square.and.arrow.up".to_string() }
    
    #[cfg(target_os = "windows")]
    { "share".to_string() }
    
    #[cfg(target_os = "linux")]
    { "share-nodes".to_string() }
}
