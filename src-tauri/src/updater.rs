use log::{info, warn, error};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

/// Information about an available update
#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

/// Progress information during download
#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: Option<f64>,
}

/// Check for updates and return info if available
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    info!("Checking for updates...");
    
    let updater = app.updater().map_err(|e| {
        error!("Failed to get updater: {}", e);
        e.to_string()
    })?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            let current_version = env!("CARGO_PKG_VERSION").to_string();
            let info = UpdateInfo {
                version: update.version.clone(),
                current_version,
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            };
            info!("Update available: {} -> {}", info.current_version, info.version);
            Ok(Some(info))
        }
        Ok(None) => {
            info!("No updates available");
            Ok(None)
        }
        Err(e) => {
            warn!("Failed to check for updates: {}", e);
            Err(e.to_string())
        }
    }
}

/// Download and install the available update
#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    info!("Starting update download...");
    
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    let update = updater.check().await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;
    
    let app_handle = app.clone();
    
    // Download with progress reporting
    let mut downloaded = 0u64;
    let total = update.download_size;
    
    let bytes = update.download(
        |chunk_len, content_len| {
            downloaded += chunk_len as u64;
            let progress = UpdateProgress {
                downloaded,
                total: content_len,
                percent: content_len.map(|t| (downloaded as f64 / t as f64) * 100.0),
            };
            // Emit progress event to frontend
            let _ = app_handle.emit("update:progress", progress);
        },
        || {
            // Download complete callback
            info!("Update download complete");
        },
    ).await.map_err(|e| {
        error!("Failed to download update: {}", e);
        e.to_string()
    })?;
    
    info!("Downloaded {} bytes, installing...", bytes.len());
    
    // Emit installing event
    let _ = app.emit("update:installing", ());
    
    // Install the update - this will restart the app
    update.install(bytes).map_err(|e| {
        error!("Failed to install update: {}", e);
        e.to_string()
    })?;
    
    // Request app restart
    info!("Update installed, restarting...");
    app.restart();
}

/// Check for updates on startup (silent check, only notifies if update available)
pub async fn check_updates_on_startup(app: AppHandle) {
    // Wait a few seconds after startup before checking
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    
    info!("Performing startup update check...");
    
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            warn!("Updater not available: {}", e);
            return;
        }
    };
    
    match updater.check().await {
        Ok(Some(update)) => {
            let current_version = env!("CARGO_PKG_VERSION").to_string();
            let info = UpdateInfo {
                version: update.version.clone(),
                current_version,
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            };
            
            info!("Update available on startup: {}", info.version);
            
            // Emit event to frontend
            let _ = app.emit("update:available", info);
        }
        Ok(None) => {
            info!("No updates available on startup check");
        }
        Err(e) => {
            // Silent failure on startup - don't bother user
            warn!("Startup update check failed: {}", e);
        }
    }
}
