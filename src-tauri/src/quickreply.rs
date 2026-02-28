//! Quick Reply Templates Manager
//!
//! Provides persistent storage for user-defined quick reply templates
//! with categories, variables, and usage statistics.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the quick replies data file path
fn get_quickreply_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("quick-replies.json")
}

/// Load quick reply templates from storage
#[tauri::command]
pub fn quickreply_load(app: AppHandle) -> Result<String, String> {
    let path = get_quickreply_path(&app);
    
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read quick replies: {}", e))
    } else {
        // Return empty structure if file doesn't exist
        Ok(r#"{"templates":[],"categories":[]}"#.to_string())
    }
}

/// Save quick reply templates to storage
#[tauri::command]
pub fn quickreply_save(app: AppHandle, data: String) -> Result<(), String> {
    let path = get_quickreply_path(&app);
    
    // Validate JSON before saving
    serde_json::from_str::<serde_json::Value>(&data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    fs::write(&path, data).map_err(|e| format!("Failed to save quick replies: {}", e))
}

/// Get quick reply storage statistics
#[tauri::command]
pub fn quickreply_stats(app: AppHandle) -> Result<String, String> {
    let path = get_quickreply_path(&app);
    
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read quick replies: {}", e))?;
        
        let data: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse quick replies: {}", e))?;
        
        let template_count = data.get("templates")
            .and_then(|t| t.as_array())
            .map(|a| a.len())
            .unwrap_or(0);
        
        let category_count = data.get("categories")
            .and_then(|c| c.as_array())
            .map(|a| a.len())
            .unwrap_or(0);
        
        let stats = serde_json::json!({
            "templateCount": template_count,
            "categoryCount": category_count,
            "fileSizeBytes": path.metadata().map(|m| m.len()).unwrap_or(0),
            "path": path.to_string_lossy()
        });
        
        Ok(stats.to_string())
    } else {
        Ok(r#"{"templateCount":0,"categoryCount":0,"fileSizeBytes":0}"#.to_string())
    }
}

/// Clear all quick reply templates
#[tauri::command]
pub fn quickreply_clear(app: AppHandle) -> Result<(), String> {
    let path = get_quickreply_path(&app);
    
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to clear quick replies: {}", e))
    } else {
        Ok(())
    }
}

/// Export quick replies to a specific path
#[tauri::command]
pub fn quickreply_export(app: AppHandle, export_path: String) -> Result<(), String> {
    let source = get_quickreply_path(&app);
    
    if source.exists() {
        fs::copy(&source, &export_path)
            .map_err(|e| format!("Failed to export quick replies: {}", e))?;
        Ok(())
    } else {
        Err("No quick replies to export".to_string())
    }
}

/// Import quick replies from a specific path (merges with existing)
#[tauri::command]
pub fn quickreply_import(app: AppHandle, import_path: String) -> Result<String, String> {
    let dest = get_quickreply_path(&app);
    
    // Read import file
    let import_content = fs::read_to_string(&import_path)
        .map_err(|e| format!("Failed to read import file: {}", e))?;
    
    let import_data: serde_json::Value = serde_json::from_str(&import_content)
        .map_err(|e| format!("Invalid import JSON: {}", e))?;
    
    // If we have existing data, merge them
    if dest.exists() {
        let existing_content = fs::read_to_string(&dest)
            .map_err(|e| format!("Failed to read existing data: {}", e))?;
        
        let mut existing: serde_json::Value = serde_json::from_str(&existing_content)
            .map_err(|e| format!("Failed to parse existing data: {}", e))?;
        
        // Merge templates
        if let (Some(existing_templates), Some(import_templates)) = (
            existing.get_mut("templates").and_then(|t| t.as_array_mut()),
            import_data.get("templates").and_then(|t| t.as_array())
        ) {
            // Get existing template names for deduplication
            let existing_names: std::collections::HashSet<String> = existing_templates
                .iter()
                .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                .map(|s| s.to_lowercase())
                .collect();
            
            let mut imported_count = 0;
            for template in import_templates {
                if let Some(name) = template.get("name").and_then(|n| n.as_str()) {
                    if !existing_names.contains(&name.to_lowercase()) {
                        existing_templates.push(template.clone());
                        imported_count += 1;
                    }
                }
            }
            
            // Save merged data
            let merged = serde_json::to_string(&existing)
                .map_err(|e| format!("Failed to serialize merged data: {}", e))?;
            
            fs::write(&dest, &merged)
                .map_err(|e| format!("Failed to save merged data: {}", e))?;
            
            return Ok(serde_json::json!({
                "imported": imported_count,
                "skipped": import_templates.len() - imported_count
            }).to_string());
        }
    }
    
    // No existing data, just copy the import
    fs::write(&dest, import_content)
        .map_err(|e| format!("Failed to save imported data: {}", e))?;
    
    let count = import_data.get("templates")
        .and_then(|t| t.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    
    Ok(serde_json::json!({
        "imported": count,
        "skipped": 0
    }).to_string())
}
