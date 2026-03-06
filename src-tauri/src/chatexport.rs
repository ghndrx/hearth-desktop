use serde::{Deserialize, Serialize};
use std::io::Write;

#[derive(Deserialize)]
pub struct ExportMessage {
    pub author: String,
    pub content: String,
    pub timestamp: String,
    pub attachments: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct ExportRequest {
    pub channel_name: String,
    pub server_name: String,
    pub messages: Vec<ExportMessage>,
    pub format: String, // "txt", "html", "json", "csv"
}

#[derive(Serialize)]
pub struct ExportResult {
    pub path: String,
    pub size: u64,
    pub message_count: usize,
}

/// Export chat messages to a file
#[tauri::command]
pub async fn export_chat(
    _app: tauri::AppHandle,
    request: ExportRequest,
) -> Result<ExportResult, String> {
    let extension = match request.format.as_str() {
        "html" => "html",
        "json" => "json",
        "csv" => "csv",
        _ => "txt",
    };

    let default_name = format!(
        "{}-{}.{}",
        request.server_name.replace(' ', "-").to_lowercase(),
        request.channel_name.replace(' ', "-").to_lowercase(),
        extension
    );

    // Use platform save dialog (tauri::dialog is not available in Tauri v2
    // without tauri-plugin-dialog)
    let path: std::path::PathBuf = {
        #[cfg(target_os = "linux")]
        {
            let filename_arg = format!("--filename={}", default_name);
            let output = std::process::Command::new("zenity")
                .args([
                    "--file-selection",
                    "--save",
                    "--title=Export Chat History",
                    &filename_arg as &str,
                ])
                .output()
                .map_err(|e| format!("Failed to open save dialog: {}", e))?;
            if !output.status.success() {
                return Err("Export cancelled".to_string());
            }
            std::path::PathBuf::from(String::from_utf8_lossy(&output.stdout).trim())
        }
        #[cfg(target_os = "macos")]
        {
            let script = format!(
                "osascript -e 'POSIX path of (choose file name with prompt \"Export Chat History\" default name \"{}\")'",
                default_name
            );
            let output = std::process::Command::new("sh")
                .args(["-c", &script])
                .output()
                .map_err(|e| format!("Failed to open save dialog: {}", e))?;
            if !output.status.success() {
                return Err("Export cancelled".to_string());
            }
            std::path::PathBuf::from(String::from_utf8_lossy(&output.stdout).trim())
        }
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            // Fallback: save to downloads directory
            let downloads = dirs::download_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            downloads.join(&default_name)
        }
    };

    let content = match request.format.as_str() {
        "html" => format_html(&request),
        "json" => format_json(&request)?,
        "csv" => format_csv(&request),
        _ => format_text(&request),
    };

    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;

    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let count = request.messages.len();

    Ok(ExportResult {
        path: path.to_string_lossy().to_string(),
        size: metadata.len(),
        message_count: count,
    })
}

fn format_text(req: &ExportRequest) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "Chat Export: #{} in {}\n",
        req.channel_name, req.server_name
    ));
    out.push_str(&format!("Exported: {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S")));
    out.push_str(&"=".repeat(60));
    out.push('\n');
    out.push('\n');

    for msg in &req.messages {
        out.push_str(&format!("[{}] {}: {}\n", msg.timestamp, msg.author, msg.content));
        if let Some(attachments) = &msg.attachments {
            for att in attachments {
                out.push_str(&format!("  [Attachment: {}]\n", att));
            }
        }
    }
    out
}

fn format_html(req: &ExportRequest) -> String {
    let mut out = String::new();
    out.push_str("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n");
    out.push_str("<meta charset=\"utf-8\">\n");
    out.push_str(&format!(
        "<title>#{} - {}</title>\n",
        req.channel_name, req.server_name
    ));
    out.push_str("<style>\n");
    out.push_str("body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1e1f22; color: #dbdee1; max-width: 900px; margin: 0 auto; padding: 20px; }\n");
    out.push_str("h1 { color: #f2f3f5; border-bottom: 1px solid #3f4147; padding-bottom: 10px; }\n");
    out.push_str(".message { padding: 4px 16px; display: flex; gap: 12px; }\n");
    out.push_str(".message:hover { background: #2e3035; }\n");
    out.push_str(".timestamp { color: #949ba4; font-size: 12px; min-width: 65px; }\n");
    out.push_str(".author { color: #f2f3f5; font-weight: 600; }\n");
    out.push_str(".content { color: #dbdee1; }\n");
    out.push_str(".attachment { color: #00a8fc; font-size: 13px; }\n");
    out.push_str("</style>\n</head>\n<body>\n");
    out.push_str(&format!(
        "<h1>#{} in {}</h1>\n",
        req.channel_name, req.server_name
    ));
    out.push_str(&format!(
        "<p style=\"color:#949ba4\">Exported {} messages on {}</p>\n",
        req.messages.len(),
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    ));

    for msg in &req.messages {
        out.push_str("<div class=\"message\">\n");
        out.push_str(&format!("  <span class=\"timestamp\">{}</span>\n", msg.timestamp));
        out.push_str(&format!(
            "  <div><span class=\"author\">{}</span> <span class=\"content\">{}</span>",
            msg.author,
            html_escape(&msg.content)
        ));
        if let Some(attachments) = &msg.attachments {
            for att in attachments {
                out.push_str(&format!(
                    "<br><span class=\"attachment\">[Attachment: {}]</span>",
                    html_escape(att)
                ));
            }
        }
        out.push_str("</div>\n</div>\n");
    }

    out.push_str("</body>\n</html>");
    out
}

fn format_json(req: &ExportRequest) -> Result<String, String> {
    #[derive(Serialize)]
    struct JsonExport<'a> {
        channel: &'a str,
        server: &'a str,
        exported_at: String,
        message_count: usize,
        messages: &'a [ExportMessage],
    }

    let export = JsonExport {
        channel: &req.channel_name,
        server: &req.server_name,
        exported_at: chrono::Local::now().to_rfc3339(),
        message_count: req.messages.len(),
        messages: &req.messages,
    };

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

fn format_csv(req: &ExportRequest) -> String {
    let mut out = String::new();
    out.push_str("Timestamp,Author,Content,Attachments\n");
    for msg in &req.messages {
        let attachments = msg
            .attachments
            .as_ref()
            .map(|a| a.join("; "))
            .unwrap_or_default();
        out.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\"\n",
            csv_escape(&msg.timestamp),
            csv_escape(&msg.author),
            csv_escape(&msg.content),
            csv_escape(&attachments)
        ));
    }
    out
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn csv_escape(s: &str) -> String {
    s.replace('"', "\"\"")
}

// Implement Serialize for ExportMessage so we can use it in JSON export
impl Serialize for ExportMessage {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("ExportMessage", 4)?;
        state.serialize_field("author", &self.author)?;
        state.serialize_field("content", &self.content)?;
        state.serialize_field("timestamp", &self.timestamp)?;
        state.serialize_field("attachments", &self.attachments)?;
        state.end()
    }
}
