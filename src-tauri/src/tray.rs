use std::sync::{Arc, Mutex};
use image::{ImageBuffer, Rgba, RgbaImage};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
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

/// Creates a badge overlay image (red circle with white number text) scaled to the given size.
fn create_badge_image(size: u32, count: u32) -> RgbaImage {
    let mut img: RgbaImage = ImageBuffer::from_pixel(size, size, Rgba([0, 0, 0, 0]));

    let center = (size as f32 / 2.0, size as f32 / 2.0);
    let radius = size as f32 / 2.0 - 1.0;

    // Draw red circle
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center.0;
            let dy = y as f32 - center.1;
            if dx * dx + dy * dy <= radius * radius {
                img.put_pixel(x, y, Rgba([220, 38, 38, 255])); // Red-600
            }
        }
    }

    // Draw count text (simplified: white circle for digit)
    let display = if count > 9 { "9".to_string() } else { count.to_string() };
    let text_len = display.len() as u32;
    let char_width = size / 4;
    let start_x = (size - text_len * char_width) / 2;
    let char_height = size / 2;
    let start_y = (size - char_height) / 2;

    for (i, _c) in display.chars().enumerate() {
        let cx = start_x + (i as u32) * char_width + char_width / 2;
        let cy = start_y + char_height / 2;
        let cr = char_width / 2 - 1;
        for dy in 0..char_height {
            for dx in 0..char_width {
                let px = cx - char_width / 2 + dx;
                let py = cy - char_height / 2 + dy;
                if px < size && py < size {
                    let ddx = px as f32 - cx as f32;
                    let ddy = py as f32 - cy as f32;
                    if ddx * ddx + ddy * ddy <= (cr * cr) as f32 {
                        img.put_pixel(px, py, Rgba([255, 255, 255, 255])); // White
                    }
                }
            }
        }
    }

    img
}

/// Loads the default icon with an unread count badge overlaid in the bottom-right corner.
fn load_icon_with_badge<R: Runtime>(app: &AppHandle<R>, unread: u32) -> Image<'static> {
    let base_icon = match app.default_window_icon() {
        Some(icon) => icon,
        None => return Image::new_owned(vec![], 0, 0),
    };

    let width = base_icon.width();
    let height = base_icon.height();
    let rgba: &[u8] = base_icon.rgba();
    let mut icon_img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(width, height, rgba.to_vec())
            .unwrap_or_else(|| ImageBuffer::from_pixel(width, height, Rgba([0, 0, 0, 0])));

    if unread > 0 {
        // Badge size: 1/4 of icon size, minimum 16
        let badge_size = std::cmp::max(16, std::cmp::min(width, height) / 4);
        let badge = create_badge_image(badge_size, unread);

        // Overlay in bottom-right with 2px margin
        let margin = 2;
        let x_offset = width.saturating_sub(badge_size + margin);
        let y_offset = height.saturating_sub(badge_size + margin);

        image::imageops::overlay(&mut icon_img, &badge, x_offset as i64, y_offset as i64);
    }

    Image::new_owned(icon_img.into_raw(), width, height)
}

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(Mutex::new(TrayState::default()));
    app.manage(state.clone());

    let s = state.lock().unwrap();
    let menu = build_tray_menu(app, &s)?;
    let tooltip = build_tooltip(&s);
    let icon = load_icon_with_badge(app.handle(), s.unread_count);
    drop(s);

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip(&tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
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

        // Update icon with badge overlay when unread > 0
        let icon = load_icon_with_badge(app, state.unread_count);
        let _ = tray.set_icon(Some(icon));
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
