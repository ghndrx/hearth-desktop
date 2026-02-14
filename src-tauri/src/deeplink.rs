use tauri::{AppHandle, Manager, Runtime};
use serde::{Deserialize, Serialize};

/// Parsed deep link data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepLinkPayload {
    /// The action type (chat, room, invite, settings)
    pub action: String,
    /// The target ID (room id, user id, etc.)
    pub target: Option<String>,
    /// Additional parameters
    pub params: std::collections::HashMap<String, String>,
}

/// Parse a hearth:// URL into a DeepLinkPayload
/// 
/// Supported formats:
/// - hearth://chat/:userId - Open DM with user
/// - hearth://room/:roomId - Open a room
/// - hearth://invite/:code - Accept an invite
/// - hearth://settings - Open settings
/// - hearth://settings/:section - Open specific settings section
pub fn parse_deep_link(url: &str) -> Option<DeepLinkPayload> {
    let url = url.trim();
    
    // Must start with hearth://
    if !url.starts_with("hearth://") {
        return None;
    }

    let path = &url[9..]; // Remove "hearth://"
    let mut parts: Vec<&str> = path.split('?').collect();
    let path_part = parts.remove(0);
    
    // Parse query params
    let mut params = std::collections::HashMap::new();
    if !parts.is_empty() {
        let query = parts.join("?");
        for pair in query.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                params.insert(
                    urlencoding::decode(key).unwrap_or_default().to_string(),
                    urlencoding::decode(value).unwrap_or_default().to_string(),
                );
            }
        }
    }

    // Parse path
    let segments: Vec<&str> = path_part.split('/').filter(|s| !s.is_empty()).collect();
    
    if segments.is_empty() {
        return None;
    }

    let action = segments[0].to_string();
    let target = segments.get(1).map(|s| s.to_string());

    Some(DeepLinkPayload {
        action,
        target,
        params,
    })
}

/// Handle a deep link by emitting to the frontend
pub fn handle_deep_link<R: Runtime>(app: &AppHandle<R>, url: &str) {
    if let Some(payload) = parse_deep_link(url) {
        log::info!("Handling deep link: {:?}", payload);
        
        // Show and focus the window
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
            
            // Emit the deep link event to frontend
            let _ = window.emit("deeplink", payload);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_chat_link() {
        let payload = parse_deep_link("hearth://chat/user123").unwrap();
        assert_eq!(payload.action, "chat");
        assert_eq!(payload.target, Some("user123".to_string()));
    }

    #[test]
    fn test_parse_room_link() {
        let payload = parse_deep_link("hearth://room/abc-def-ghi").unwrap();
        assert_eq!(payload.action, "room");
        assert_eq!(payload.target, Some("abc-def-ghi".to_string()));
    }

    #[test]
    fn test_parse_invite_link() {
        let payload = parse_deep_link("hearth://invite/ABCD1234?ref=email").unwrap();
        assert_eq!(payload.action, "invite");
        assert_eq!(payload.target, Some("ABCD1234".to_string()));
        assert_eq!(payload.params.get("ref"), Some(&"email".to_string()));
    }

    #[test]
    fn test_parse_settings_link() {
        let payload = parse_deep_link("hearth://settings").unwrap();
        assert_eq!(payload.action, "settings");
        assert_eq!(payload.target, None);
    }

    #[test]
    fn test_parse_settings_section() {
        let payload = parse_deep_link("hearth://settings/notifications").unwrap();
        assert_eq!(payload.action, "settings");
        assert_eq!(payload.target, Some("notifications".to_string()));
    }
}
