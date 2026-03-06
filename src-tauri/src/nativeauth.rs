use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use std::sync::RwLock;
use once_cell::sync::Lazy;

/// Native authentication support using OS keychain/credential store
/// Wraps platform-specific secure storage for tokens and credentials

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeychainEntry {
    pub service: String,
    pub account: String,
    pub label: Option<String>,
}

/// Result of a biometric authentication attempt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiometricResult {
    pub success: bool,
    pub method: String,
    pub error: Option<String>,
}

/// Supported biometric methods on this platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiometricCapabilities {
    pub available: bool,
    pub methods: Vec<String>,
}

const SERVICE_NAME: &str = "io.hearth.desktop";

/// Store a credential in the OS keychain
#[tauri::command]
pub fn keychain_set(key: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Use security CLI to add/update keychain item
        let _ = Command::new("security")
            .args([
                "delete-generic-password",
                "-s", SERVICE_NAME,
                "-a", &key,
            ])
            .output();

        let output = Command::new("security")
            .args([
                "add-generic-password",
                "-s", SERVICE_NAME,
                "-a", &key,
                "-w", &value,
                "-U",
            ])
            .output()
            .map_err(|e| format!("Failed to store credential: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Keychain store failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Use secret-tool (libsecret) for GNOME Keyring / KDE Wallet
        let label_arg = format!("Hearth: {}", key);
        let output = Command::new("secret-tool")
            .args([
                "store",
                "--label", &label_arg,
                "service", SERVICE_NAME,
                "account", &key,
            ])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                if let Some(ref mut stdin) = child.stdin {
                    stdin.write_all(value.as_bytes())?;
                }
                child.wait_with_output()
            })
            .map_err(|e| format!("Failed to store credential: {}", e))?;

        if !output.status.success() {
            return Err("Keychain store failed - is gnome-keyring or kwallet running?".to_string());
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Use cmdkey for Windows Credential Manager
        let target = format!("{}:{}", SERVICE_NAME, key);
        let arg_generic = format!("/generic:{}", target);
        let arg_user = format!("/user:{}", key);
        let arg_pass = format!("/pass:{}", value);
        let output = Command::new("cmdkey")
            .args([&arg_generic, &arg_user, &arg_pass])
            .output()
            .map_err(|e| format!("Failed to store credential: {}", e))?;

        if !output.status.success() {
            return Err("Windows Credential Manager store failed".to_string());
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Keychain not supported on this platform".to_string())
    }
}

/// Retrieve a credential from the OS keychain
#[tauri::command]
pub fn keychain_get(key: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("security")
            .args([
                "find-generic-password",
                "-s", SERVICE_NAME,
                "-a", &key,
                "-w",
            ])
            .output()
            .map_err(|e| format!("Failed to read credential: {}", e))?;

        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let output = Command::new("secret-tool")
            .args([
                "lookup",
                "service", SERVICE_NAME,
                "account", &key,
            ])
            .output()
            .map_err(|e| format!("Failed to read credential: {}", e))?;

        if output.status.success() {
            let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        } else {
            Ok(None)
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let target = format!("{}:{}", SERVICE_NAME, key);
        let arg_list = format!("/list:{}", target);
        let output = Command::new("cmdkey")
            .args([&arg_list])
            .output()
            .map_err(|e| format!("Failed to read credential: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains(&target) {
                // cmdkey doesn't expose passwords directly; need CredRead API
                // For now, indicate the entry exists
                Ok(Some("[stored]".to_string()))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Keychain not supported on this platform".to_string())
    }
}

/// Delete a credential from the OS keychain
#[tauri::command]
pub fn keychain_delete(key: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("security")
            .args([
                "delete-generic-password",
                "-s", SERVICE_NAME,
                "-a", &key,
            ])
            .output()
            .map_err(|e| format!("Failed to delete credential: {}", e))?;

        if !output.status.success() {
            // Not found is ok
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("could not be found") {
                return Err(format!("Failed to delete: {}", stderr));
            }
        }
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let _ = Command::new("secret-tool")
            .args([
                "clear",
                "service", SERVICE_NAME,
                "account", &key,
            ])
            .output();
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let target = format!("{}:{}", SERVICE_NAME, key);
        let arg_delete = format!("/delete:{}", target);
        let _ = Command::new("cmdkey")
            .args([&arg_delete])
            .output();
        Ok(())
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Keychain not supported on this platform".to_string())
    }
}

/// Check what biometric authentication methods are available
#[tauri::command]
pub fn keychain_biometric_available() -> BiometricCapabilities {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Check for Touch ID via bioutil
        let output = Command::new("bioutil")
            .args(["-r", "-s"])
            .output();

        let touch_id = output
            .map(|o| o.status.success())
            .unwrap_or(false);

        BiometricCapabilities {
            available: touch_id,
            methods: if touch_id {
                vec!["touchid".to_string()]
            } else {
                vec![]
            },
        }
    }

    #[cfg(target_os = "windows")]
    {
        BiometricCapabilities {
            available: false,
            methods: vec![],
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Check for fprintd (fingerprint daemon)
        let fprintd = Command::new("fprintd-list")
            .arg("")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        BiometricCapabilities {
            available: fprintd,
            methods: if fprintd {
                vec!["fingerprint".to_string()]
            } else {
                vec![]
            },
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        BiometricCapabilities {
            available: false,
            methods: vec![],
        }
    }
}

/// List all keychain entries for Hearth
#[tauri::command]
pub fn keychain_list() -> Result<Vec<KeychainEntry>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("security")
            .args(["find-generic-password", "-s", SERVICE_NAME, "-g"])
            .output();

        // security CLI doesn't easily list all entries; return empty for now
        Ok(vec![])
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(vec![])
    }
}
