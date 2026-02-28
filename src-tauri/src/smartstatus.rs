// Smart Status Manager - Backend commands for automatic status detection
// Detects system state (meetings, screen sharing, music, etc.) and updates status

use tauri::command;

/// Detect if user is currently in a meeting
/// Checks for active video conferencing processes
#[command]
pub fn detect_meeting() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Check for common meeting app processes
        let meeting_apps = [
            "zoom.us", "Zoom", "ZoomShare",
            "Microsoft Teams", "Microsoft Teams Helper", "Teams",
            "Slack", "Slack Helper",
            "Google Meet",
            "Webex", "CiscoWebexStart",
            "Skype", "Skype for Business",
            "FaceTime", "FaceTimeNotificationCenter",
            "Discord",
            "GoToMeeting", "GoTo",
            "BlueJeans",
        ];
        
        // Use pgrep to check for running meeting apps
        for app in &meeting_apps {
            let output = Command::new("pgrep")
                .args(["-if", app])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    // Check if it's actually in a meeting (has video/audio active)
                    // For now, just assume presence means meeting is possible
                    log::debug!("Meeting app detected: {}", app);
                    return true;
                }
            }
        }
        
        // Check for active camera usage (indicates video call)
        let camera_check = Command::new("system_profiler")
            .args(["SPCameraDataType"])
            .output();
        
        if let Ok(output) = camera_check {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("In Use By:") {
                log::debug!("Camera in use - likely in meeting");
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Check for common meeting app processes
        let meeting_processes = [
            "zoom", "teams", "slack", "discord", "skype",
            "webex", "gotomeeting", "bluejeans", "jitsi",
        ];
        
        for process in &meeting_processes {
            let output = Command::new("pgrep")
                .args(["-i", process])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    log::debug!("Meeting app detected: {}", process);
                    return true;
                }
            }
        }
        
        // Check for active camera/video devices
        let video_check = Command::new("lsof")
            .args(["/dev/video*"])
            .output();
        
        if let Ok(output) = video_check {
            if output.status.success() && !output.stdout.is_empty() {
                log::debug!("Video device in use - likely in meeting");
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("tasklist").output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let meeting_apps = [
                "zoom.exe", "teams.exe", "slack.exe", "discord.exe",
                "skype.exe", "webexmta.exe", "g2mstart.exe",
            ];
            
            for app in &meeting_apps {
                if stdout.contains(app) {
                    log::debug!("Meeting app detected: {}", app);
                    return true;
                }
            }
        }
        
        false
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    false
}

/// Detect if screen sharing is active
#[command]
pub fn detect_screen_share() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Check for screen recording/sharing processes
        let screen_share_indicators = [
            "screencaptureui", "ScreenCaptureKit",
            "OBS", "obs",
            "zoom.us share", "ZoomShare",
            "screenshare",
            "Loom", "loom",
            "QuickTime Player",
            "Kap",
        ];
        
        for indicator in &screen_share_indicators {
            let output = Command::new("pgrep")
                .args(["-if", indicator])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    log::debug!("Screen share detected: {}", indicator);
                    return true;
                }
            }
        }
        
        // Check if screen recording permissions are being actively used
        // This is a heuristic - checking for Window Server processes sharing screen
        let output = Command::new("lsof")
            .args(["-c", "WindowServer"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("screenrecording") || stdout.contains("CGSEventRecord") {
                log::debug!("Screen recording active via WindowServer");
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Check for screen recording processes
        let screen_share_processes = [
            "obs", "simplescreenrecorder", "kazam", "peek",
            "recordmydesktop", "vokoscreen", "gnome-screencast",
        ];
        
        for process in &screen_share_processes {
            let output = Command::new("pgrep")
                .args(["-x", process])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    log::debug!("Screen share detected: {}", process);
                    return true;
                }
            }
        }
        
        // Check for PipeWire screen cast sessions
        let output = Command::new("busctl")
            .args([
                "--user",
                "call",
                "org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop",
                "org.freedesktop.DBus.Properties",
                "GetAll",
                "s",
                "org.freedesktop.portal.ScreenCast",
            ])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // If there are active sessions, screen cast is running
            if stdout.contains("session") {
                log::debug!("PipeWire screen cast session detected");
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("tasklist").output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let screen_share_apps = [
                "obs64.exe", "obs32.exe",
                "streamlabs", "xsplit",
                "nvcontainer.exe", // NVIDIA ShadowPlay
                "gamebar.exe", // Windows Game Bar
            ];
            
            for app in &screen_share_apps {
                if stdout.contains(app) {
                    log::debug!("Screen share detected: {}", app);
                    return true;
                }
            }
        }
        
        false
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    false
}

/// Detect if music is currently playing
#[command]
pub fn detect_music_playing() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Check Apple Music / iTunes
        let script = r#"
            tell application "System Events"
                if exists process "Music" then
                    tell application "Music"
                        if player state is playing then
                            return true
                        end if
                    end tell
                end if
                if exists process "Spotify" then
                    tell application "Spotify"
                        if player state is playing then
                            return true
                        end if
                    end tell
                end if
            end tell
            return false
        "#;
        
        let output = Command::new("osascript")
            .args(["-e", script])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
            if stdout == "true" {
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Check MPRIS (Media Player Remote Interfacing Specification)
        let output = Command::new("dbus-send")
            .args([
                "--print-reply",
                "--dest=org.freedesktop.DBus",
                "/org/freedesktop/DBus",
                "org.freedesktop.DBus.ListNames",
            ])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("org.mpris.MediaPlayer2") {
                // Check if any player is actually playing
                let players: Vec<&str> = stdout
                    .lines()
                    .filter(|l| l.contains("org.mpris.MediaPlayer2"))
                    .collect();
                
                for player_line in players {
                    // Extract player name
                    if let Some(player) = player_line.split('"').nth(1) {
                        let status_output = Command::new("dbus-send")
                            .args([
                                "--print-reply",
                                &format!("--dest={}", player),
                                "/org/mpris/MediaPlayer2",
                                "org.freedesktop.DBus.Properties.Get",
                                "string:org.mpris.MediaPlayer2.Player",
                                "string:PlaybackStatus",
                            ])
                            .output();
                        
                        if let Ok(output) = status_output {
                            let stdout = String::from_utf8_lossy(&output.stdout);
                            if stdout.contains("Playing") {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        false
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, check for common music players
        use std::process::Command;
        
        let output = Command::new("tasklist").output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let music_players = [
                "spotify.exe", "itunes.exe", "music.ui.exe",
                "groove.exe", "foobar2000.exe", "winamp.exe",
                "musicbee.exe", "aimp.exe", "vlc.exe",
            ];
            
            for player in &music_players {
                if stdout.contains(player) {
                    // Player is running, but we can't easily check if playing
                    // For now, assume running means playing
                    return true;
                }
            }
        }
        
        false
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    false
}

/// Detect if a game is running
#[command]
pub fn detect_gaming() -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Check for GPU-intensive fullscreen applications
        // On macOS, this is harder to detect reliably
        
        // Check if any app is in fullscreen mode and using significant GPU
        let output = Command::new("pmset")
            .args(["-g", "assertions"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // High GPU usage or game center activity
            if stdout.contains("PreventUserIdleDisplaySleep") {
                return true;
            }
        }
        
        // Check for common game launchers/engines
        let game_processes = [
            "Steam", "steam_osx",
            "Epic Games Launcher",
            "Unity", "UnityPlayer",
            "Metal", "GameCenter",
        ];
        
        for process in &game_processes {
            let output = Command::new("pgrep")
                .args(["-if", process])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    return true;
                }
            }
        }
        
        false
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Check for game launchers and common game processes
        let game_processes = [
            "steam", "steamwebhelper",
            "lutris", "heroic",
            "wine", "proton",
            "gamemode", "gamemoded",
        ];
        
        for process in &game_processes {
            let output = Command::new("pgrep")
                .args(["-i", process])
                .output();
            
            if let Ok(output) = output {
                if output.status.success() && !output.stdout.is_empty() {
                    return true;
                }
            }
        }
        
        // Check for GameMode
        let gamemode_check = Command::new("gamemoded")
            .args(["--status"])
            .output();
        
        if let Ok(output) = gamemode_check {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("active") {
                return true;
            }
        }
        
        false
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("tasklist").output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let game_launchers = [
                "steam.exe", "steamwebhelper.exe",
                "epicgameslauncher.exe",
                "gog galaxy.exe", "galaxy.exe",
                "origin.exe", "eadesktop.exe",
                "battle.net.exe", "blizzard.exe",
                "ubisoft connect.exe", "uplay.exe",
                "gameoverlay.exe", "gamemodule.exe",
            ];
            
            for launcher in &game_launchers {
                if stdout.contains(launcher) {
                    return true;
                }
            }
            
            // Check for Xbox Game Bar / Game Mode
            if stdout.contains("gamebar.exe") || stdout.contains("gamebarftsvc.exe") {
                return true;
            }
        }
        
        false
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    false
}

/// Get the system idle time in seconds
#[command]
pub fn get_idle_time() -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Use ioreg to get HIDIdleTime (in nanoseconds)
        let output = Command::new("ioreg")
            .args(["-c", "IOHIDSystem", "-d", "4"])
            .output()
            .map_err(|e| e.to_string())?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // Parse HIDIdleTime from output
        for line in stdout.lines() {
            if line.contains("HIDIdleTime") {
                // Extract the number
                if let Some(num_str) = line.split('=').nth(1) {
                    let cleaned = num_str.trim().trim_matches(|c| c == '"' || c == ' ');
                    if let Ok(nanos) = cleaned.parse::<u64>() {
                        return Ok(nanos / 1_000_000_000); // Convert to seconds
                    }
                }
            }
        }
        
        Err("Could not determine idle time".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Try xprintidle first (X11)
        let output = Command::new("xprintidle").output();
        
        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(millis) = stdout.trim().parse::<u64>() {
                    return Ok(millis / 1000); // Convert to seconds
                }
            }
        }
        
        // Fallback: check /proc for input device activity
        // This is less accurate but works without xprintidle
        Err("Could not determine idle time (install xprintidle for accurate detection)".to_string())
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, we'd use GetLastInputInfo from user32
        // For simplicity, return an error suggesting frontend-based detection
        Err("Use frontend-based idle detection on Windows".to_string())
    }
    
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    Err("Idle time detection not supported on this platform".to_string())
}

/// Set the user's status (broadcast to the application)
/// This is called by the frontend SmartStatusManager when status changes
#[command]
pub fn set_user_status(
    status: String,
    message: Option<String>,
    emoji: Option<String>,
) -> Result<(), String> {
    log::info!(
        "User status updated: {} - {:?} {:?}",
        status,
        message,
        emoji
    );
    
    // In a real implementation, this would:
    // 1. Update the user's presence in the chat backend
    // 2. Broadcast to other users
    // 3. Update the system tray icon/tooltip
    
    // For now, just log the status change
    // The frontend handles the actual status display
    
    Ok(())
}
