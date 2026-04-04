use tauri_plugin_notification::NotificationExt;
use tauri::{Manager, menu::MenuItemKind};

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

/// Update the checked state of a tray menu item
#[tauri::command]
pub async fn update_tray_menu_item_checked(
    app: tauri::AppHandle,
    item_id: String,
    checked: bool,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        if let Some(menu) = tray.menu() {
            if let Some(item) = menu.get(&item_id) {
                if let MenuItemKind::Check(check_item) = item.kind() {
                    check_item.set_checked(checked).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    Ok(())
}

/// Update the enabled state of a tray menu item
#[tauri::command]
pub async fn update_tray_menu_item_enabled(
    app: tauri::AppHandle,
    item_id: String,
    enabled: bool,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        if let Some(menu) = tray.menu() {
            if let Some(item) = menu.get(&item_id) {
                match item.kind() {
                    MenuItemKind::Check(check_item) => {
                        check_item.set_enabled(enabled).map_err(|e| e.to_string())?;
                    },
                    MenuItemKind::MenuItem(menu_item) => {
                        menu_item.set_enabled(enabled).map_err(|e| e.to_string())?;
                    },
                    _ => {}
                }
            }
        }
    }
    Ok(())
}

/// Update tray tooltip based on current status
#[tauri::command]
pub async fn update_tray_tooltip(
    app: tauri::AppHandle,
    tooltip: String,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
