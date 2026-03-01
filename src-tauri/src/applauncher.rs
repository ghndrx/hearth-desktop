// Application Launcher - Search and launch installed applications
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub launch_count: u32,
    pub last_launched: Option<i64>,
}

pub struct AppLauncherState {
    apps: Mutex<Vec<InstalledApp>>,
    launch_history: Mutex<HashMap<String, u32>>,
}

impl Default for AppLauncherState {
    fn default() -> Self {
        Self {
            apps: Mutex::new(Vec::new()),
            launch_history: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn scan_installed_apps(
    state: State<'_, AppLauncherState>,
) -> Result<Vec<InstalledApp>, String> {
    let apps = discover_applications()?;
    
    // Update launch counts from history
    let history = state.launch_history.lock().map_err(|e| e.to_string())?;
    let apps_with_counts: Vec<InstalledApp> = apps
        .into_iter()
        .map(|mut app| {
            if let Some(&count) = history.get(&app.path) {
                app.launch_count = count;
            }
            app
        })
        .collect();
    
    // Cache the apps
    let mut cached = state.apps.lock().map_err(|e| e.to_string())?;
    *cached = apps_with_counts.clone();
    
    Ok(apps_with_counts)
}

#[tauri::command]
pub async fn search_apps(
    query: String,
    state: State<'_, AppLauncherState>,
) -> Result<Vec<InstalledApp>, String> {
    let apps = state.apps.lock().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();
    
    let mut results: Vec<InstalledApp> = apps
        .iter()
        .filter(|app| {
            app.name.to_lowercase().contains(&query_lower)
                || app.category.as_ref().map_or(false, |c| c.to_lowercase().contains(&query_lower))
        })
        .cloned()
        .collect();
    
    // Sort by launch count (most used first), then by name
    results.sort_by(|a, b| {
        b.launch_count.cmp(&a.launch_count)
            .then_with(|| a.name.cmp(&b.name))
    });
    
    Ok(results)
}

#[tauri::command]
pub async fn launch_app(
    app_path: String,
    state: State<'_, AppLauncherState>,
) -> Result<bool, String> {
    // Update launch count
    {
        let mut history = state.launch_history.lock().map_err(|e| e.to_string())?;
        let count = history.entry(app_path.clone()).or_insert(0);
        *count += 1;
    }
    
    // Launch the application
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg(&app_path)
            .spawn()
            .map_err(|e| format!("Failed to launch app: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &app_path])
            .spawn()
            .map_err(|e| format!("Failed to launch app: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&app_path)
            .spawn()
            .map_err(|e| format!("Failed to launch app: {}", e))?;
    }
    
    Ok(true)
}

#[tauri::command]
pub async fn get_recent_apps(
    limit: usize,
    state: State<'_, AppLauncherState>,
) -> Result<Vec<InstalledApp>, String> {
    let apps = state.apps.lock().map_err(|e| e.to_string())?;
    
    let mut sorted: Vec<InstalledApp> = apps
        .iter()
        .filter(|app| app.launch_count > 0)
        .cloned()
        .collect();
    
    sorted.sort_by(|a, b| b.launch_count.cmp(&a.launch_count));
    sorted.truncate(limit);
    
    Ok(sorted)
}

fn discover_applications() -> Result<Vec<InstalledApp>, String> {
    let mut apps = Vec::new();
    
    #[cfg(target_os = "macos")]
    {
        let app_dirs = vec![
            "/Applications",
            "/System/Applications",
            &format!("{}/Applications", std::env::var("HOME").unwrap_or_default()),
        ];
        
        for dir in app_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |ext| ext == "app") {
                        if let Some(name) = path.file_stem() {
                            apps.push(InstalledApp {
                                name: name.to_string_lossy().to_string(),
                                path: path.to_string_lossy().to_string(),
                                icon: None,
                                category: detect_category(&path),
                                launch_count: 0,
                                last_launched: None,
                            });
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let desktop_dirs = vec![
            "/usr/share/applications",
            "/usr/local/share/applications",
            &format!("{}/.local/share/applications", std::env::var("HOME").unwrap_or_default()),
        ];
        
        for dir in desktop_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |ext| ext == "desktop") {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Some(app) = parse_desktop_file(&content, &path) {
                                apps.push(app);
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Scan Start Menu shortcuts
        if let Ok(appdata) = std::env::var("APPDATA") {
            let start_menu = PathBuf::from(&appdata)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs");
            scan_windows_shortcuts(&start_menu, &mut apps);
        }
        
        // Scan Program Files
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            scan_windows_executables(&PathBuf::from(program_files), &mut apps, 2);
        }
    }
    
    // Remove duplicates by path
    apps.sort_by(|a, b| a.path.cmp(&b.path));
    apps.dedup_by(|a, b| a.path == b.path);
    
    Ok(apps)
}

#[cfg(target_os = "macos")]
fn detect_category(path: &PathBuf) -> Option<String> {
    let name = path.file_stem()?.to_string_lossy().to_lowercase();
    
    if name.contains("browser") || name.contains("safari") || name.contains("chrome") || name.contains("firefox") {
        Some("Internet".to_string())
    } else if name.contains("mail") || name.contains("outlook") {
        Some("Communication".to_string())
    } else if name.contains("photo") || name.contains("image") || name.contains("preview") {
        Some("Graphics".to_string())
    } else if name.contains("music") || name.contains("spotify") || name.contains("audio") {
        Some("Music".to_string())
    } else if name.contains("video") || name.contains("vlc") || name.contains("player") {
        Some("Video".to_string())
    } else if name.contains("code") || name.contains("xcode") || name.contains("terminal") {
        Some("Development".to_string())
    } else if name.contains("settings") || name.contains("preferences") || name.contains("system") {
        Some("System".to_string())
    } else {
        None
    }
}

#[cfg(target_os = "linux")]
fn parse_desktop_file(content: &str, path: &PathBuf) -> Option<InstalledApp> {
    let mut name = None;
    let mut exec = None;
    let mut icon = None;
    let mut category = None;
    let mut no_display = false;
    
    for line in content.lines() {
        if line.starts_with("Name=") && name.is_none() {
            name = Some(line.trim_start_matches("Name=").to_string());
        } else if line.starts_with("Exec=") {
            exec = Some(line.trim_start_matches("Exec=").split_whitespace().next()?.to_string());
        } else if line.starts_with("Icon=") {
            icon = Some(line.trim_start_matches("Icon=").to_string());
        } else if line.starts_with("Categories=") {
            category = line.trim_start_matches("Categories=")
                .split(';')
                .next()
                .map(|s| s.to_string());
        } else if line.starts_with("NoDisplay=true") {
            no_display = true;
        }
    }
    
    if no_display {
        return None;
    }
    
    Some(InstalledApp {
        name: name?,
        path: exec.unwrap_or_else(|| path.to_string_lossy().to_string()),
        icon,
        category,
        launch_count: 0,
        last_launched: None,
    })
}

#[cfg(target_os = "windows")]
fn scan_windows_shortcuts(dir: &PathBuf, apps: &mut Vec<InstalledApp>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_windows_shortcuts(&path, apps);
            } else if path.extension().map_or(false, |ext| ext == "lnk") {
                if let Some(name) = path.file_stem() {
                    apps.push(InstalledApp {
                        name: name.to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        icon: None,
                        category: None,
                        launch_count: 0,
                        last_launched: None,
                    });
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn scan_windows_executables(dir: &PathBuf, apps: &mut Vec<InstalledApp>, depth: usize) {
    if depth == 0 {
        return;
    }
    
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_windows_executables(&path, apps, depth - 1);
            } else if path.extension().map_or(false, |ext| ext == "exe") {
                if let Some(name) = path.file_stem() {
                    let name_str = name.to_string_lossy();
                    // Skip installers and uninstallers
                    if !name_str.to_lowercase().contains("unins") 
                        && !name_str.to_lowercase().contains("setup") {
                        apps.push(InstalledApp {
                            name: name_str.to_string(),
                            path: path.to_string_lossy().to_string(),
                            icon: None,
                            category: None,
                            launch_count: 0,
                            last_launched: None,
                        });
                    }
                }
            }
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn detect_category(_path: &PathBuf) -> Option<String> {
    None
}
