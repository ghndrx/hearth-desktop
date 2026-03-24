use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

#[derive(Debug, Clone)]
pub struct TrayState {
    pub muted: bool,
    pub deafened: bool,
    pub unread_count: u32,
    pub minimize_to_tray: bool,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            muted: false,
            deafened: false,
            unread_count: 0,
            minimize_to_tray: true,
        }
    }
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(Mutex::new(TrayState::default()));
    app.manage(state.clone());

    let s = state.lock().unwrap();
    let menu = build_tray_menu(app, &s)?;
    let tooltip = build_tooltip(&s);
    drop(s);

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip(&tooltip)
        .menu(&menu)
        .menu_on_left_click(false)
        .id("main")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id().as_ref());
        })
        .build(app)?;

    Ok(())
}

fn build_tooltip(state: &TrayState) -> String {
    if state.unread_count > 0 {
        format!("Hearth — {} unread", state.unread_count)
    } else {
        "Hearth".to_string()
    }
}

fn build_tray_menu<R: Runtime>(
    app: &impl Manager<R>,
    state: &TrayState,
) -> Result<tauri::menu::Menu<R>, Box<dyn std::error::Error>> {
    let mute_label = if state.muted { "Unmute" } else { "Mute" };
    let deafen_label = if state.deafened {
        "Undeafen"
    } else {
        "Deafen"
    };

    let status_label = if state.unread_count > 0 {
        format!("{} unread message{}", state.unread_count, if state.unread_count == 1 { "" } else { "s" })
    } else {
        "No unread messages".to_string()
    };

    let status_item = MenuItemBuilder::with_id("status", &status_label)
        .enabled(false)
        .build(app)?;
    let mute_item = MenuItemBuilder::with_id("mute", mute_label).build(app)?;
    let deafen_item = MenuItemBuilder::with_id("deafen", deafen_label).build(app)?;
    let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Hearth").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&mute_item)
        .item(&deafen_item)
        .separator()
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    Ok(menu)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "mute" => {
            let state = app.state::<Arc<Mutex<TrayState>>>();
            let mut s = state.lock().unwrap();
            s.muted = !s.muted;
            let _ = app.emit("tray-mute-toggle", s.muted);
            rebuild_tray(app, &s);
        }
        "deafen" => {
            let state = app.state::<Arc<Mutex<TrayState>>>();
            let mut s = state.lock().unwrap();
            s.deafened = !s.deafened;
            if s.deafened {
                s.muted = true;
            }
            let _ = app.emit("tray-deafen-toggle", s.deafened);
            let _ = app.emit("tray-mute-toggle", s.muted);
            rebuild_tray(app, &s);
        }
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

/// Rebuild both the tray menu and tooltip to reflect current state.
fn rebuild_tray<R: Runtime>(app: &AppHandle<R>, state: &TrayState) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(app, state) {
            let _ = tray.set_menu(Some(menu));
        }
        let _ = tray.set_tooltip(Some(&build_tooltip(state)));
    }
}

/// Called from commands to update unread count and refresh tray.
pub fn update_unread<R: Runtime>(app: &AppHandle<R>, count: u32) {
    let state = app.state::<Arc<Mutex<TrayState>>>();
    let mut s = state.lock().unwrap();
    s.unread_count = count;
    rebuild_tray(app, &s);
}

/// Called from commands to check if minimize-to-tray is enabled.
pub fn should_minimize_to_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    let state = app.state::<Arc<Mutex<TrayState>>>();
    let s = state.lock().unwrap();
    s.minimize_to_tray
}

/// Called from commands to toggle minimize-to-tray setting.
pub fn set_minimize_to_tray<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    let state = app.state::<Arc<Mutex<TrayState>>>();
    let mut s = state.lock().unwrap();
    s.minimize_to_tray = enabled;
}
