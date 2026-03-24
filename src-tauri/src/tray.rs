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
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            muted: false,
            deafened: false,
        }
    }
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(Mutex::new(TrayState::default()));
    app.manage(state.clone());

    let menu = build_tray_menu(app, &state.lock().unwrap())?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hearth")
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

    let mute_item = MenuItemBuilder::with_id("mute", mute_label).build(app)?;
    let deafen_item = MenuItemBuilder::with_id("deafen", deafen_label).build(app)?;
    let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Hearth").build(app)?;

    let menu = MenuBuilder::new(app)
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
            rebuild_tray_menu(app, &s);
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
            rebuild_tray_menu(app, &s);
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

fn rebuild_tray_menu<R: Runtime>(app: &AppHandle<R>, state: &TrayState) {
    if let Ok(menu) = build_tray_menu(app, state) {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}
