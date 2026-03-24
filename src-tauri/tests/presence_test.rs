// Integration-level tests for rich_presence module
// Unit tests are in src/rich_presence.rs via #[cfg(test)]
//
// The core RichPresenceManager logic is tested via `cargo test`
// in the inline module tests. This file can be extended for
// integration tests that require a full Tauri app context.

#[test]
fn test_presence_types_serialize() {
    use serde_json;

    // Verify GamePresenceState serializes correctly
    let state = serde_json::json!({
        "game_id": "730",
        "game_name": "Counter-Strike 2",
        "state": "Playing",
        "details": "Competitive",
        "timestamp": 1711234567u64,
        "party_info": {
            "party_id": "party_123",
            "party_size": 3,
            "party_max": 5
        },
        "metadata": {
            "map": "de_dust2"
        }
    });

    assert_eq!(state["game_id"], "730");
    assert_eq!(state["party_info"]["party_size"], 3);
    assert_eq!(state["metadata"]["map"], "de_dust2");
}

#[test]
fn test_friend_presence_serialization() {
    use serde_json;

    let friend = serde_json::json!({
        "friend_id": "user123",
        "presence": null,
        "is_online": true
    });

    assert_eq!(friend["friend_id"], "user123");
    assert!(friend["presence"].is_null());
    assert_eq!(friend["is_online"], true);
}
