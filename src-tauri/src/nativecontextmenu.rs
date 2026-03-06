use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, Window};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// The kind of a single menu entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MenuItemType {
    Normal,
    Separator,
    Checkbox,
    Submenu,
    Icon,
}

/// A single item inside a context menu template.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuItem {
    /// Unique identifier returned when the user clicks this item.
    pub id: String,
    /// Display label (ignored for separators).
    #[serde(default)]
    pub label: String,
    /// Whether the item is clickable.
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Whether a checkbox item is checked.
    #[serde(default)]
    pub checked: bool,
    /// Keyboard shortcut hint shown at the right side (display only).
    #[serde(default)]
    pub shortcut_hint: Option<String>,
    /// Base64-encoded PNG icon data (used when `item_type` is `Icon`).
    #[serde(default)]
    pub icon: Option<String>,
    /// The visual type of this entry.
    #[serde(default = "default_item_type")]
    pub item_type: MenuItemType,
    /// Child items when `item_type` is `Submenu`.
    #[serde(default)]
    pub children: Vec<MenuItem>,
}

/// A complete context-menu template that can be shown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuTemplate {
    /// Human-readable name for this template (e.g. "TextEdit").
    pub name: String,
    /// Ordered list of items.
    pub items: Vec<MenuItem>,
}

/// Pixel position where the menu should appear.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuPosition {
    pub x: f64,
    pub y: f64,
}

/// Options passed when requesting the message context menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMenuOptions {
    pub can_reply: bool,
    pub can_edit: bool,
    pub can_delete: bool,
    pub can_pin: bool,
    pub is_pinned: bool,
    pub can_react: bool,
}

impl Default for MessageMenuOptions {
    fn default() -> Self {
        Self {
            can_reply: true,
            can_edit: false,
            can_delete: false,
            can_pin: false,
            is_pinned: false,
            can_react: true,
        }
    }
}

/// Channel information for the channel context menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub channel_id: String,
    pub channel_name: String,
    pub is_muted: bool,
    pub has_unread: bool,
}

/// Payload emitted when the user selects an item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuAction {
    pub item_id: String,
    /// Extra data attached by some predefined menus (e.g. the URL for link menus).
    #[serde(default)]
    pub metadata: Option<String>,
}

/// Runtime configuration for the context-menu system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuConfig {
    /// When `true` the app will use native OS menus; otherwise custom HTML ones.
    pub use_native: bool,
    /// Enable a short open/close animation (custom menus only).
    pub animate: bool,
}

impl Default for ContextMenuConfig {
    fn default() -> Self {
        Self {
            use_native: true,
            animate: true,
        }
    }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Managed Tauri state for context menus.
pub struct ContextMenuManager {
    pub config: Mutex<ContextMenuConfig>,
    pub last_action: Mutex<Option<ContextMenuAction>>,
}

impl Default for ContextMenuManager {
    fn default() -> Self {
        Self {
            config: Mutex::new(ContextMenuConfig::default()),
            last_action: Mutex::new(None),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn default_true() -> bool {
    true
}

fn default_item_type() -> MenuItemType {
    MenuItemType::Normal
}

fn separator() -> MenuItem {
    MenuItem {
        id: String::new(),
        label: String::new(),
        enabled: false,
        checked: false,
        shortcut_hint: None,
        icon: None,
        item_type: MenuItemType::Separator,
        children: Vec::new(),
    }
}

fn normal(id: &str, label: &str, shortcut: Option<&str>) -> MenuItem {
    MenuItem {
        id: id.into(),
        label: label.into(),
        enabled: true,
        checked: false,
        shortcut_hint: shortcut.map(Into::into),
        icon: None,
        item_type: MenuItemType::Normal,
        children: Vec::new(),
    }
}

fn checkbox(id: &str, label: &str, checked: bool) -> MenuItem {
    MenuItem {
        id: id.into(),
        label: label.into(),
        enabled: true,
        checked,
        shortcut_hint: None,
        icon: None,
        item_type: MenuItemType::Checkbox,
        children: Vec::new(),
    }
}

fn submenu(id: &str, label: &str, children: Vec<MenuItem>) -> MenuItem {
    MenuItem {
        id: id.into(),
        label: label.into(),
        enabled: true,
        checked: false,
        shortcut_hint: None,
        icon: None,
        item_type: MenuItemType::Submenu,
        children,
    }
}

// ---------------------------------------------------------------------------
// Predefined templates
// ---------------------------------------------------------------------------

fn text_edit_template(has_selection: bool) -> MenuTemplate {
    MenuTemplate {
        name: "TextEdit".into(),
        items: vec![
            MenuItem { enabled: has_selection, ..normal("cut", "Cut", Some("Ctrl+X")) },
            MenuItem { enabled: has_selection, ..normal("copy", "Copy", Some("Ctrl+C")) },
            normal("paste", "Paste", Some("Ctrl+V")),
            separator(),
            normal("select_all", "Select All", Some("Ctrl+A")),
        ],
    }
}

fn message_template(opts: &MessageMenuOptions) -> MenuTemplate {
    let mut items = Vec::new();

    if opts.can_reply {
        items.push(normal("reply", "Reply", Some("R")));
    }
    if opts.can_edit {
        items.push(normal("edit", "Edit Message", Some("E")));
    }
    if opts.can_delete {
        items.push(normal("delete", "Delete Message", None));
    }

    items.push(separator());

    if opts.can_pin {
        if opts.is_pinned {
            items.push(normal("unpin", "Unpin Message", None));
        } else {
            items.push(normal("pin", "Pin Message", None));
        }
    }

    if opts.can_react {
        items.push(submenu(
            "react",
            "Add Reaction",
            vec![
                normal("react_thumbsup", "Thumbs Up", None),
                normal("react_heart", "Heart", None),
                normal("react_laugh", "Laugh", None),
                normal("react_surprised", "Surprised", None),
                normal("react_sad", "Sad", None),
                normal("react_angry", "Angry", None),
                separator(),
                normal("react_custom", "More Reactions...", None),
            ],
        ));
    }

    items.push(separator());
    items.push(normal("copy_text", "Copy Text", Some("Ctrl+C")));
    items.push(normal("copy_link", "Copy Message Link", None));

    MenuTemplate {
        name: "Message".into(),
        items,
    }
}

fn image_template() -> MenuTemplate {
    MenuTemplate {
        name: "Image".into(),
        items: vec![
            normal("save_image", "Save Image As...", Some("Ctrl+S")),
            normal("copy_image", "Copy Image", None),
            separator(),
            normal("open_image", "Open in Browser", None),
            normal("copy_image_link", "Copy Image Link", None),
        ],
    }
}

fn link_template(url: &str) -> MenuTemplate {
    // url is stashed in metadata when the action fires; the label shows a truncated version.
    let display_url = if url.len() > 50 {
        format!("{}...", &url[..47])
    } else {
        url.to_string()
    };

    MenuTemplate {
        name: "Link".into(),
        items: vec![
            normal("open_link", &format!("Open Link: {}", display_url), None),
            normal("copy_link_url", "Copy Link Address", None),
            separator(),
            normal("open_link_incognito", "Open in Incognito / Private Window", None),
        ],
    }
}

fn channel_template(info: &ChannelInfo) -> MenuTemplate {
    MenuTemplate {
        name: "Channel".into(),
        items: vec![
            checkbox("mute_channel", "Mute Channel", info.is_muted),
            normal("mark_read", "Mark as Read", None),
            separator(),
            normal("channel_settings", "Channel Settings", None),
            normal("channel_notifications", "Notification Settings", None),
            separator(),
            normal("invite_to_channel", "Invite People", None),
            normal("copy_channel_link", "Copy Channel Link", None),
        ],
    }
}

// ---------------------------------------------------------------------------
// Internal: build a tauri menu and show it on the window
// ---------------------------------------------------------------------------

fn build_and_show_menu(
    window: &Window,
    template: &MenuTemplate,
    position: &MenuPosition,
    metadata: Option<String>,
) -> Result<(), String> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder, CheckMenuItemBuilder};

    let app = window.app_handle();

    fn add_items_to_builder<'a>(
        builder: MenuBuilder<'a, tauri::Wry, AppHandle>,
        items: &[MenuItem],
        app: &'a AppHandle,
    ) -> Result<MenuBuilder<'a, tauri::Wry, AppHandle>, String> {
        let mut b = builder;
        for item in items {
            match item.item_type {
                MenuItemType::Separator => {
                    let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
                    b = b.item(&sep);
                }
                MenuItemType::Normal | MenuItemType::Icon => {
                    let label = if let Some(ref hint) = item.shortcut_hint {
                        format!("{}    {}", item.label, hint)
                    } else {
                        item.label.clone()
                    };
                    let mi = MenuItemBuilder::with_id(&item.id, &label)
                        .enabled(item.enabled)
                        .build(app)
                        .map_err(|e| e.to_string())?;
                    b = b.item(&mi);
                }
                MenuItemType::Checkbox => {
                    let mi = CheckMenuItemBuilder::new(&item.label)
                        .id(&item.id)
                        .enabled(item.enabled)
                        .checked(item.checked)
                        .build(app)
                        .map_err(|e| e.to_string())?;
                    b = b.item(&mi);
                }
                MenuItemType::Submenu => {
                    let mut sub = SubmenuBuilder::with_id(app, &item.id, &item.label);
                    for child in &item.children {
                        match child.item_type {
                            MenuItemType::Separator => {
                                let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
                                sub = sub.item(&sep);
                            }
                            MenuItemType::Checkbox => {
                                let ci = CheckMenuItemBuilder::new(&child.label)
                                    .id(&child.id)
                                    .enabled(child.enabled)
                                    .checked(child.checked)
                                    .build(app)
                                    .map_err(|e| e.to_string())?;
                                sub = sub.item(&ci);
                            }
                            _ => {
                                let label = if let Some(ref hint) = child.shortcut_hint {
                                    format!("{}    {}", child.label, hint)
                                } else {
                                    child.label.clone()
                                };
                                let ci = MenuItemBuilder::with_id(&child.id, &label)
                                    .enabled(child.enabled)
                                    .build(app)
                                    .map_err(|e| e.to_string())?;
                                sub = sub.item(&ci);
                            }
                        }
                    }
                    let built = sub.build().map_err(|e| e.to_string())?;
                    b = b.item(&built);
                }
            }
        }
        Ok(b)
    }

    let builder = MenuBuilder::new(app);
    let builder = add_items_to_builder(builder, &template.items, app)?;
    let menu = builder.build().map_err(|e: tauri::Error| e.to_string())?;

    // Clone values for the closure
    let win = window.clone();
    let meta = metadata.clone();

    window
        .on_menu_event(move |_window, event| {
            let action = ContextMenuAction {
                item_id: event.id().0.clone(),
                metadata: meta.clone(),
            };
            let _ = win.emit("context-menu-action", &action);
        });

    window
        .popup_menu(&menu)
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Show a native context menu built from an arbitrary template.
#[tauri::command]
pub async fn show_context_menu(
    window: Window,
    template: MenuTemplate,
    position: MenuPosition,
) -> Result<(), String> {
    build_and_show_menu(&window, &template, &position, None)
}

/// Show the standard text-editing context menu (cut / copy / paste / select all).
#[tauri::command]
pub async fn show_text_edit_menu(
    window: Window,
    position: MenuPosition,
    has_selection: bool,
) -> Result<(), String> {
    let template = text_edit_template(has_selection);
    build_and_show_menu(&window, &template, &position, None)
}

/// Show a context menu for a chat message.
#[tauri::command]
pub async fn show_message_menu(
    window: Window,
    position: MenuPosition,
    message_options: MessageMenuOptions,
) -> Result<(), String> {
    let template = message_template(&message_options);
    build_and_show_menu(&window, &template, &position, None)
}

/// Show a context menu for an image.
#[tauri::command]
pub async fn show_image_menu(
    window: Window,
    position: MenuPosition,
) -> Result<(), String> {
    let template = image_template();
    build_and_show_menu(&window, &template, &position, None)
}

/// Show a context menu for a hyperlink.
#[tauri::command]
pub async fn show_link_menu(
    window: Window,
    position: MenuPosition,
    url: String,
) -> Result<(), String> {
    let template = link_template(&url);
    build_and_show_menu(&window, &template, &position, Some(url))
}

/// Show a context menu for a channel in the sidebar.
#[tauri::command]
pub async fn show_channel_menu(
    window: Window,
    position: MenuPosition,
    channel_info: ChannelInfo,
) -> Result<(), String> {
    let template = channel_template(&channel_info);
    let meta = serde_json::to_string(&channel_info).ok();
    build_and_show_menu(&window, &template, &position, meta)
}

/// Return all predefined menu templates so the frontend can inspect them.
#[tauri::command]
pub async fn get_predefined_templates() -> Result<Vec<MenuTemplate>, String> {
    Ok(vec![
        text_edit_template(true),
        message_template(&MessageMenuOptions::default()),
        image_template(),
        link_template("https://example.com"),
        channel_template(&ChannelInfo {
            channel_id: "example".into(),
            channel_name: "general".into(),
            is_muted: false,
            has_unread: false,
        }),
    ])
}

/// Get the current context-menu configuration.
#[tauri::command]
pub async fn contextmenu_get_config(
    state: State<'_, ContextMenuManager>,
) -> Result<ContextMenuConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

/// Update the context-menu configuration.
#[tauri::command]
pub async fn contextmenu_set_config(
    state: State<'_, ContextMenuManager>,
    config: ContextMenuConfig,
) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}
