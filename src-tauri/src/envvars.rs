//! Environment Variables Inspector
//!
//! Provides commands to list, search, and inspect system environment variables.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
    pub is_path: bool,
    pub path_entries: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVarSummary {
    pub total: usize,
    pub vars: Vec<EnvVar>,
}

fn is_path_var(key: &str) -> bool {
    let k = key.to_uppercase();
    k == "PATH" || k == "LD_LIBRARY_PATH" || k == "MANPATH"
        || k == "PKG_CONFIG_PATH" || k == "PYTHONPATH"
        || k == "NODE_PATH" || k == "CLASSPATH"
        || k == "DYLD_LIBRARY_PATH" || k == "DYLD_FALLBACK_LIBRARY_PATH"
        || k.ends_with("_PATH") || k.ends_with("_DIRS")
}

fn to_env_var(key: String, value: String) -> EnvVar {
    let is_path = is_path_var(&key);
    let path_entries = if is_path {
        let sep = if cfg!(windows) { ';' } else { ':' };
        Some(value.split(sep).map(|s| s.to_string()).collect())
    } else {
        None
    };
    EnvVar { key, value, is_path, path_entries }
}

/// Get all environment variables sorted by key
#[tauri::command]
pub fn env_get_all() -> EnvVarSummary {
    let mut vars: Vec<EnvVar> = std::env::vars()
        .map(|(k, v)| to_env_var(k, v))
        .collect();
    vars.sort_by(|a, b| a.key.to_lowercase().cmp(&b.key.to_lowercase()));
    let total = vars.len();
    EnvVarSummary { total, vars }
}

/// Search environment variables by key or value substring (case-insensitive)
#[tauri::command]
pub fn env_search(query: String) -> EnvVarSummary {
    let q = query.to_lowercase();
    let mut vars: Vec<EnvVar> = std::env::vars()
        .filter(|(k, v)| k.to_lowercase().contains(&q) || v.to_lowercase().contains(&q))
        .map(|(k, v)| to_env_var(k, v))
        .collect();
    vars.sort_by(|a, b| a.key.to_lowercase().cmp(&b.key.to_lowercase()));
    let total = vars.len();
    EnvVarSummary { total, vars }
}

/// Get a single environment variable by exact key
#[tauri::command]
pub fn env_get(key: String) -> Option<EnvVar> {
    std::env::var(&key).ok().map(|v| to_env_var(key, v))
}

/// Get environment variable categories/groups
#[tauri::command]
pub fn env_get_categories() -> HashMap<String, Vec<EnvVar>> {
    let mut categories: HashMap<String, Vec<EnvVar>> = HashMap::new();

    for (k, v) in std::env::vars() {
        let category = categorize_var(&k);
        categories.entry(category).or_default().push(to_env_var(k, v));
    }

    for vars in categories.values_mut() {
        vars.sort_by(|a, b| a.key.to_lowercase().cmp(&b.key.to_lowercase()));
    }

    categories
}

fn categorize_var(key: &str) -> String {
    let k = key.to_uppercase();
    if is_path_var(key) {
        "Paths".to_string()
    } else if k.starts_with("XDG_") {
        "XDG".to_string()
    } else if k.starts_with("LC_") || k == "LANG" || k == "LANGUAGE" {
        "Locale".to_string()
    } else if k.starts_with("SSH_") || k.starts_with("GPG_") {
        "Security".to_string()
    } else if k == "HOME" || k == "USER" || k == "LOGNAME" || k == "SHELL"
        || k == "TERM" || k == "DISPLAY" || k == "WAYLAND_DISPLAY"
        || k == "DESKTOP_SESSION" || k == "SESSION_MANAGER"
    {
        "System".to_string()
    } else if k.starts_with("DBUS_") || k.starts_with("GTK_") || k.starts_with("QT_") {
        "Desktop".to_string()
    } else if k.starts_with("NODE_") || k.starts_with("NPM_") || k.starts_with("RUST")
        || k.starts_with("CARGO") || k.starts_with("PYTHON") || k.starts_with("JAVA")
        || k.starts_with("GO") || k == "EDITOR" || k == "VISUAL"
    {
        "Development".to_string()
    } else {
        "Other".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_get_all_returns_vars() {
        let summary = env_get_all();
        assert!(summary.total > 0);
        assert_eq!(summary.total, summary.vars.len());
    }

    #[test]
    fn test_path_detection() {
        assert!(is_path_var("PATH"));
        assert!(is_path_var("LD_LIBRARY_PATH"));
        assert!(!is_path_var("HOME"));
    }

    #[test]
    fn test_categorize() {
        assert_eq!(categorize_var("PATH"), "Paths");
        assert_eq!(categorize_var("HOME"), "System");
        assert_eq!(categorize_var("XDG_CONFIG_HOME"), "XDG");
        assert_eq!(categorize_var("LC_ALL"), "Locale");
        assert_eq!(categorize_var("NODE_ENV"), "Development");
    }
}
