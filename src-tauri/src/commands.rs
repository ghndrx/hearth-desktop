use tauri_plugin_notification::NotificationExt;
use serde::{Deserialize, Serialize};
use screenshots::Screen;

/// Get the application version
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set the dock/taskbar badge count (unread messages)
#[tauri::command]
pub async fn set_badge_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if count > 0 {
                window.set_badge_count(Some(count as i64)).map_err(|e| e.to_string())?;
            } else {
                window.set_badge_count(None).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Represents a source that can be screen shared (display or window)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareSource {
    pub id: String,
    pub name: String,
    pub source_type: String, // "display" or "window"
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub is_primary: Option<bool>,
}

/// Enumerate all available screen sharing sources (displays and windows)
#[tauri::command]
pub async fn enumerate_sources() -> Result<Vec<ShareSource>, String> {
    let mut sources = Vec::new();

    // Enumerate displays/screens
    match Screen::all() {
        Ok(screens) => {
            for (index, screen) in screens.iter().enumerate() {
                let display = screen.display_info;
                sources.push(ShareSource {
                    id: format!("display_{}", index),
                    name: format!("Display {} ({}x{})", index + 1, display.width, display.height),
                    source_type: "display".to_string(),
                    width: Some(display.width),
                    height: Some(display.height),
                    is_primary: Some(display.is_primary),
                });
            }
        }
        Err(e) => {
            eprintln!("Failed to enumerate screens: {}", e);
        }
    }

    // Enumerate windows (platform-specific)
    let windows = enumerate_windows().await?;
    sources.extend(windows);

    Ok(sources)
}

/// Platform-specific window enumeration
#[cfg(target_os = "windows")]
async fn enumerate_windows() -> Result<Vec<ShareSource>, String> {
    use windows::{
        core::PCWSTR,
        Win32::Foundation::{BOOL, HWND, LPARAM},
        Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
        },
    };
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    let windows: Arc<Mutex<Vec<ShareSource>>> = Arc::new(Mutex::new(Vec::new()));
    let windows_clone = Arc::clone(&windows);

    unsafe {
        EnumWindows(
            Some(enum_windows_proc),
            LPARAM(&*windows_clone as *const _ as isize),
        )
        .map_err(|e| format!("Failed to enumerate windows: {}", e))?;
    }

    let result = windows.lock().unwrap().clone();
    Ok(result)
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
    };

    if IsWindowVisible(hwnd).as_bool() {
        let title_len = GetWindowTextLengthW(hwnd) + 1;
        if title_len > 1 {
            let mut title: Vec<u16> = vec![0; title_len as usize];
            let len = GetWindowTextW(hwnd, &mut title);
            if len > 0 {
                let title = String::from_utf16_lossy(&title[..len as usize]);
                if !title.trim().is_empty() {
                    let windows = lparam.0 as *const std::sync::Mutex<Vec<ShareSource>>;
                    if let Some(windows) = windows.as_ref() {
                        if let Ok(mut windows) = windows.lock() {
                            windows.push(ShareSource {
                                id: format!("window_{}", hwnd.0),
                                name: title,
                                source_type: "window".to_string(),
                                width: None,
                                height: None,
                                is_primary: None,
                            });
                        }
                    }
                }
            }
        }
    }
    BOOL::from(true)
}

#[cfg(target_os = "linux")]
async fn enumerate_windows() -> Result<Vec<ShareSource>, String> {
    use x11::xlib::*;
    use std::ffi::CStr;
    use std::ptr;

    let mut windows = Vec::new();

    unsafe {
        let display = XOpenDisplay(ptr::null());
        if display.is_null() {
            return Err("Failed to open X display".to_string());
        }

        let root = XDefaultRootWindow(display);
        let mut children_return: *mut Window = ptr::null_mut();
        let mut nchildren_return: u32 = 0;
        let mut parent_return: Window = 0;
        let mut root_return: Window = 0;

        if XQueryTree(
            display,
            root,
            &mut root_return,
            &mut parent_return,
            &mut children_return,
            &mut nchildren_return,
        ) != 0 && !children_return.is_null()
        {
            let children = std::slice::from_raw_parts(children_return, nchildren_return as usize);

            for &window in children {
                let mut window_name: *mut i8 = ptr::null_mut();
                if XFetchName(display, window, &mut window_name) != 0 && !window_name.is_null() {
                    let name = CStr::from_ptr(window_name).to_string_lossy().to_string();
                    if !name.trim().is_empty() {
                        windows.push(ShareSource {
                            id: format!("window_{}", window),
                            name,
                            source_type: "window".to_string(),
                            width: None,
                            height: None,
                            is_primary: None,
                        });
                    }
                    XFree(window_name as *mut _);
                }
            }

            XFree(children_return as *mut _);
        }

        XCloseDisplay(display);
    }

    Ok(windows)
}

#[cfg(target_os = "macos")]
async fn enumerate_windows() -> Result<Vec<ShareSource>, String> {
    use core_graphics::window::{kCGWindowListOptionOnScreenOnly, CGWindowListCopyWindowInfo};
    use core_foundation::{
        array::{CFArrayGetCount, CFArrayGetValueAtIndex},
        base::{CFType, TCFType},
        dictionary::{CFDictionary, CFDictionaryRef},
        string::{CFString, CFStringRef},
    };
    use std::ptr;

    let mut windows = Vec::new();

    unsafe {
        let window_list = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, 0);
        if window_list.is_null() {
            return Err("Failed to get window list".to_string());
        }

        let count = CFArrayGetCount(window_list);

        for i in 0..count {
            let window_info = CFArrayGetValueAtIndex(window_list, i) as CFDictionaryRef;
            let window_dict = CFDictionary::wrap_under_get_rule(window_info);

            let name_key = CFString::from_static_string("kCGWindowName");
            if let Some(window_name) = window_dict.find(name_key.as_CFTypeRef()) {
                let window_name = window_name.downcast::<CFString>().unwrap();
                let name = window_name.to_string();

                if !name.trim().is_empty() {
                    windows.push(ShareSource {
                        id: format!("window_{}", i),
                        name,
                        source_type: "window".to_string(),
                        width: None,
                        height: None,
                        is_primary: None,
                    });
                }
            }
        }
    }

    Ok(windows)
}
