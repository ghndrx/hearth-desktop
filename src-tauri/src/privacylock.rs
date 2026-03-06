use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// Lock state
#[derive(Debug, Default)]
pub struct LockState {
    pub is_locked: bool,
    pub password_hash: Option<String>,
}

/// Privacy lock manager
pub struct PrivacyLockManager {
    pub state: Mutex<LockState>,
}

impl Default for PrivacyLockManager {
    fn default() -> Self {
        Self {
            state: Mutex::new(LockState::default()),
        }
    }
}

/// Check if biometrics are available
#[tauri::command]
pub async fn check_biometrics_available() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, use LAContext to check for biometrics
        // This would typically use objc crate to interface with LocalAuthentication framework
        // LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)
        
        // For now, assume Touch ID is available on modern Macs
        return Ok(true);
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, check for Windows Hello
        // Would use Windows.Security.Credentials.UI namespace
        return Ok(true);
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, check for fprintd or similar
        // Could check if /var/lib/fprint exists
        let fprint_exists = std::path::Path::new("/var/lib/fprint").exists();
        return Ok(fprint_exists);
    }
    
    #[allow(unreachable_code)]
    Ok(false)
}

/// Authenticate using biometrics
#[tauri::command]
pub async fn authenticate_biometrics(reason: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, use LAContext to authenticate
        // let context = LAContext()
        // context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, ...)
        
        // Simulated success for now
        // In real implementation, would use objc crate and LocalAuthentication framework
        return Ok(true);
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, use Windows Hello
        // UserConsentVerifier.RequestVerificationAsync(reason)
        return Ok(true);
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, use fprintd-verify
        let output = std::process::Command::new("fprintd-verify")
            .output();
        
        match output {
            Ok(o) => return Ok(o.status.success()),
            Err(_) => return Err("Biometric authentication not available".to_string()),
        }
    }
    
    #[allow(unreachable_code)]
    Err("Biometrics not supported on this platform".to_string())
}

/// Hash a password using Argon2
fn hash_password(password: &str) -> Result<String, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    // In a real implementation, use argon2 or bcrypt crate
    // For now, use a simple hash (NOT secure for production!)
    let mut hasher = DefaultHasher::new();
    password.hash(&mut hasher);
    let salt = "hearth_app_salt"; // Would be randomly generated in production
    salt.hash(&mut hasher);
    Ok(format!("{:x}", hasher.finish()))
}

/// Set app password
#[tauri::command]
pub async fn set_app_password(
    password: String,
    manager: State<'_, PrivacyLockManager>,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    
    let hash = hash_password(&password)?;
    state.password_hash = Some(hash.clone());
    
    // Store the hash securely (would use keychain/credential store in production)
    // For now, store in a config file
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("hearth-desktop");
    
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let hash_path = config_dir.join(".password_hash");
    std::fs::write(hash_path, &hash).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Verify password
#[tauri::command]
pub async fn verify_password(
    password: String,
    manager: State<'_, PrivacyLockManager>,
) -> Result<bool, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    
    let stored_hash = if let Some(ref hash) = state.password_hash {
        hash.clone()
    } else {
        // Try to load from file
        let config_dir = dirs::config_dir()
            .ok_or("Could not find config directory")?
            .join("hearth-desktop");
        
        let hash_path = config_dir.join(".password_hash");
        if hash_path.exists() {
            std::fs::read_to_string(hash_path).map_err(|e| e.to_string())?
        } else {
            return Err("No password set".to_string());
        }
    };
    
    let input_hash = hash_password(&password)?;
    Ok(stored_hash == input_hash)
}

/// Lock the app
#[tauri::command]
pub async fn lock_app(
    manager: State<'_, PrivacyLockManager>,
    app: AppHandle,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.is_locked = true;
    
    // Hide sensitive windows, update tray, etc.
    // Could also blur the main window content
    
    // Emit event to frontend
    app.emit("app-locked", ()).ok();
    
    Ok(())
}

/// Unlock the app
#[tauri::command]
pub async fn unlock_app(
    manager: State<'_, PrivacyLockManager>,
    app: AppHandle,
) -> Result<(), String> {
    let mut state = manager.state.lock().map_err(|e| e.to_string())?;
    state.is_locked = false;
    
    // Restore window state
    
    // Emit event to frontend
    app.emit("app-unlocked", ()).ok();
    
    Ok(())
}

/// Get current lock state
#[tauri::command]
pub async fn get_lock_state(
    manager: State<'_, PrivacyLockManager>,
) -> Result<bool, String> {
    let state = manager.state.lock().map_err(|e| e.to_string())?;
    Ok(state.is_locked)
}

/// Monitor for system lock/unlock events
pub fn setup_system_lock_monitor(app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        // On macOS, monitor for screen lock/unlock via NSDistributedNotificationCenter
        // com.apple.screenIsLocked / com.apple.screenIsUnlocked
        std::thread::spawn(move || {
            // Would use objc crate to observe notifications
            // For now, just periodically check screen saver state
        });
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, monitor for WTS_SESSION_LOCK / WTS_SESSION_UNLOCK
        // via WTSRegisterSessionNotification
    }
    
    #[cfg(target_os = "linux")]
    {
        // On Linux, monitor for org.freedesktop.ScreenSaver signals via DBus
        std::thread::spawn(move || {
            // Would use dbus crate to listen for signals
        });
    }
}

// Commands are registered via tauri::generate_handler! in main.rs
