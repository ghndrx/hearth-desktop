//! Proxy settings management for Hearth desktop app
//!
//! Allows users to configure HTTP/HTTPS/SOCKS proxy settings
//! for the app's network connections.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub proxy_type: ProxyType,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub requires_auth: bool,
    pub bypass_list: Vec<String>,
    pub auto_detect: bool,
    pub pac_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProxyType {
    Http,
    Https,
    Socks4,
    Socks5,
    System,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            proxy_type: ProxyType::System,
            host: String::new(),
            port: 8080,
            username: None,
            requires_auth: false,
            bypass_list: vec![
                "localhost".to_string(),
                "127.0.0.1".to_string(),
                "::1".to_string(),
            ],
            auto_detect: true,
            pac_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProxyTestResult {
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub ip_address: Option<String>,
}

pub struct ProxyState {
    pub config: Mutex<ProxyConfig>,
}

impl Default for ProxyState {
    fn default() -> Self {
        Self {
            config: Mutex::new(ProxyConfig::default()),
        }
    }
}

#[tauri::command]
pub fn proxy_get_config(state: State<'_, ProxyState>) -> Result<ProxyConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn proxy_set_config(
    state: State<'_, ProxyState>,
    config: ProxyConfig,
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

#[tauri::command]
pub fn proxy_get_url(state: State<'_, ProxyState>) -> Result<Option<String>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.enabled {
        return Ok(None);
    }

    let scheme = match config.proxy_type {
        ProxyType::Http => "http",
        ProxyType::Https => "https",
        ProxyType::Socks4 => "socks4",
        ProxyType::Socks5 => "socks5",
        ProxyType::System => return Ok(None),
    };

    let auth = if config.requires_auth {
        if let Some(ref user) = config.username {
            format!("{}@", user)
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    Ok(Some(format!("{}://{}{}:{}", scheme, auth, config.host, config.port)))
}

#[tauri::command]
pub async fn proxy_test_connection(
    state: State<'_, ProxyState>,
) -> Result<ProxyTestResult, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?.clone();

    if !config.enabled || config.host.is_empty() {
        return Ok(ProxyTestResult {
            success: false,
            latency_ms: None,
            error: Some("Proxy is not configured".to_string()),
            ip_address: None,
        });
    }

    let start = std::time::Instant::now();

    // Try to connect through the proxy
    let client_builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10));

    let proxy_url = format!(
        "{}://{}:{}",
        match config.proxy_type {
            ProxyType::Http => "http",
            ProxyType::Https => "https",
            ProxyType::Socks5 => "socks5",
            _ => "http",
        },
        config.host,
        config.port
    );

    let client = match reqwest::Proxy::all(&proxy_url) {
        Ok(proxy) => match client_builder.proxy(proxy).build() {
            Ok(c) => c,
            Err(e) => {
                return Ok(ProxyTestResult {
                    success: false,
                    latency_ms: None,
                    error: Some(format!("Failed to create client: {}", e)),
                    ip_address: None,
                });
            }
        },
        Err(e) => {
            return Ok(ProxyTestResult {
                success: false,
                latency_ms: None,
                error: Some(format!("Invalid proxy URL: {}", e)),
                ip_address: None,
            });
        }
    };

    match client.get("https://httpbin.org/ip").send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            let ip = resp
                .json::<serde_json::Value>()
                .await
                .ok()
                .and_then(|v| v.get("origin").and_then(|o| o.as_str().map(String::from)));

            Ok(ProxyTestResult {
                success: true,
                latency_ms: Some(latency),
                error: None,
                ip_address: ip,
            })
        }
        Err(e) => Ok(ProxyTestResult {
            success: false,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            error: Some(format!("Connection failed: {}", e)),
            ip_address: None,
        }),
    }
}

#[tauri::command]
pub fn proxy_is_enabled(state: State<'_, ProxyState>) -> Result<bool, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.enabled)
}

#[tauri::command]
pub fn proxy_toggle(state: State<'_, ProxyState>) -> Result<bool, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.enabled = !config.enabled;
    Ok(config.enabled)
}

#[tauri::command]
pub fn proxy_add_bypass(
    state: State<'_, ProxyState>,
    host: String,
) -> Result<Vec<String>, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.bypass_list.contains(&host) {
        config.bypass_list.push(host);
    }
    Ok(config.bypass_list.clone())
}

#[tauri::command]
pub fn proxy_remove_bypass(
    state: State<'_, ProxyState>,
    host: String,
) -> Result<Vec<String>, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.bypass_list.retain(|h| h != &host);
    Ok(config.bypass_list.clone())
}
