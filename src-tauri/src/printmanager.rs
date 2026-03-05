use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintJob {
    pub id: String,
    pub title: String,
    pub content_type: PrintContentType,
    pub status: PrintJobStatus,
    pub created_at: DateTime<Utc>,
    pub page_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrintContentType {
    ChatMessages,
    ChannelHistory,
    DirectMessages,
    SearchResults,
    UserProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrintJobStatus {
    Queued,
    Printing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintSettings {
    pub paper_size: String,
    pub orientation: String,
    pub margins: PrintMargins,
    pub include_avatars: bool,
    pub include_timestamps: bool,
    pub include_reactions: bool,
    pub theme: PrintTheme,
    pub font_size: u32,
    pub header_text: Option<String>,
    pub footer_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintMargins {
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrintTheme {
    Light,
    Dark,
    HighContrast,
}

impl Default for PrintSettings {
    fn default() -> Self {
        Self {
            paper_size: "A4".to_string(),
            orientation: "portrait".to_string(),
            margins: PrintMargins {
                top: 20.0,
                bottom: 20.0,
                left: 15.0,
                right: 15.0,
            },
            include_avatars: true,
            include_timestamps: true,
            include_reactions: false,
            theme: PrintTheme::Light,
            font_size: 12,
            header_text: None,
            footer_text: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintPreview {
    pub html: String,
    pub estimated_pages: u32,
    pub settings: PrintSettings,
}

#[derive(Debug, Default)]
pub struct PrintManagerState {
    pub jobs: Mutex<Vec<PrintJob>>,
    pub settings: Mutex<PrintSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintRequest {
    pub title: String,
    pub content_type: PrintContentType,
    pub html_content: String,
    pub settings: Option<PrintSettings>,
}

#[tauri::command]
pub fn print_get_settings(
    state: tauri::State<'_, PrintManagerState>,
) -> Result<PrintSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn print_update_settings(
    state: tauri::State<'_, PrintManagerState>,
    settings: PrintSettings,
) -> Result<PrintSettings, String> {
    let mut current = state.settings.lock().map_err(|e| e.to_string())?;
    *current = settings.clone();
    Ok(settings)
}

#[tauri::command]
pub fn print_generate_preview(
    content_html: String,
    settings: Option<PrintSettings>,
) -> Result<PrintPreview, String> {
    let settings = settings.unwrap_or_default();
    let line_count = content_html.matches("<br").count()
        + content_html.matches("<div").count()
        + content_html.matches("<p").count();
    let lines_per_page = match settings.font_size {
        s if s <= 10 => 60,
        s if s <= 12 => 50,
        s if s <= 14 => 42,
        _ => 35,
    };
    let estimated_pages = std::cmp::max(1, (line_count / lines_per_page) + 1) as u32;

    let theme_css = match settings.theme {
        PrintTheme::Light => "body { background: #fff; color: #1a1a1a; }",
        PrintTheme::Dark => "body { background: #2b2d31; color: #dbdee1; }",
        PrintTheme::HighContrast => "body { background: #000; color: #fff; }",
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
<style>
@page {{
    size: {paper} {orientation};
    margin: {mt}mm {mr}mm {mb}mm {ml}mm;
}}
{theme}
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: {fs}pt; }}
.message {{ padding: 4px 0; border-bottom: 1px solid #e0e0e0; }}
.author {{ font-weight: 600; }}
.timestamp {{ color: #72767d; font-size: 0.8em; }}
.avatar {{ width: 32px; height: 32px; border-radius: 50%; margin-right: 8px; }}
@media print {{ .no-print {{ display: none; }} }}
</style>
</head>
<body>
{header}
{content}
{footer}
</body>
</html>"#,
        paper = settings.paper_size,
        orientation = settings.orientation,
        mt = settings.margins.top,
        mr = settings.margins.right,
        mb = settings.margins.bottom,
        ml = settings.margins.left,
        theme = theme_css,
        fs = settings.font_size,
        header = settings.header_text.as_deref().map(|h| format!("<header><h2>{}</h2></header>", h)).unwrap_or_default(),
        content = content_html,
        footer = settings.footer_text.as_deref().map(|f| format!("<footer><p>{}</p></footer>", f)).unwrap_or_default(),
    );

    Ok(PrintPreview {
        html,
        estimated_pages,
        settings,
    })
}

#[tauri::command]
pub fn print_create_job(
    state: tauri::State<'_, PrintManagerState>,
    title: String,
    content_type: PrintContentType,
) -> Result<PrintJob, String> {
    let job = PrintJob {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        content_type,
        status: PrintJobStatus::Queued,
        created_at: Utc::now(),
        page_count: None,
    };
    let mut jobs = state.jobs.lock().map_err(|e| e.to_string())?;
    jobs.push(job.clone());
    Ok(job)
}

#[tauri::command]
pub fn print_get_jobs(
    state: tauri::State<'_, PrintManagerState>,
) -> Result<Vec<PrintJob>, String> {
    let jobs = state.jobs.lock().map_err(|e| e.to_string())?;
    Ok(jobs.clone())
}

#[tauri::command]
pub fn print_cancel_job(
    state: tauri::State<'_, PrintManagerState>,
    job_id: String,
) -> Result<bool, String> {
    let mut jobs = state.jobs.lock().map_err(|e| e.to_string())?;
    if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
        job.status = PrintJobStatus::Cancelled;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn print_clear_jobs(
    state: tauri::State<'_, PrintManagerState>,
) -> Result<(), String> {
    let mut jobs = state.jobs.lock().map_err(|e| e.to_string())?;
    jobs.retain(|j| matches!(j.status, PrintJobStatus::Queued | PrintJobStatus::Printing));
    Ok(())
}

#[tauri::command]
pub fn print_export_pdf(
    content_html: String,
    output_path: String,
    settings: Option<PrintSettings>,
) -> Result<String, String> {
    let settings = settings.unwrap_or_default();
    let preview = print_generate_preview(content_html, Some(settings))?;
    std::fs::write(&output_path, preview.html.as_bytes())
        .map_err(|e| format!("Failed to write PDF: {}", e))?;
    Ok(output_path)
}
