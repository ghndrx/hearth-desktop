use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Serialize, Clone)]
pub struct IdleInfo {
    /// Current idle time in seconds
    pub idle_seconds: u64,
    /// Whether the system is currently idle (based on threshold)
    pub is_idle: bool,
    /// Platform-specific implementation used
    pub platform: String,
}

/// Default idle threshold in seconds (5 minutes)
const DEFAULT_IDLE_THRESHOLD: u64 = 300;

/// Get the current system idle time
pub fn get_idle_time() -> Result<IdleInfo, String> {
    let idle_seconds = get_platform_idle_time()?;
    let platform = get_platform_name();

    Ok(IdleInfo {
        idle_seconds,
        is_idle: idle_seconds >= DEFAULT_IDLE_THRESHOLD,
        platform,
    })
}

/// Get the current system idle time with custom threshold
pub fn get_idle_time_with_threshold(threshold_seconds: u64) -> Result<IdleInfo, String> {
    let idle_seconds = get_platform_idle_time()?;
    let platform = get_platform_name();

    Ok(IdleInfo {
        idle_seconds,
        is_idle: idle_seconds >= threshold_seconds,
        platform,
    })
}

#[cfg(target_os = "windows")]
fn get_platform_idle_time() -> Result<u64, String> {
    use windows::{
        Win32::Foundation::HWND,
        Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
        Win32::System::Threading::GetTickCount,
    };

    unsafe {
        let mut last_input_info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };

        let result = GetLastInputInfo(&mut last_input_info);
        if result.as_bool() {
            let current_tick_count = GetTickCount();
            let idle_time_ms = current_tick_count - last_input_info.dwTime;
            Ok((idle_time_ms / 1000) as u64)
        } else {
            Err("Failed to get last input info on Windows".to_string())
        }
    }
}

#[cfg(target_os = "macos")]
fn get_platform_idle_time() -> Result<u64, String> {
    use core_graphics::{
        event::{CGEventSource, CGEventSourceStateID, CGEventType},
        event_source::CGEventSourceRef,
    };

    unsafe {
        let event_source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
            .map_err(|_| "Failed to create CGEventSource")?;

        let idle_time = CGEventSource::seconds_since_last_event_type(
            CGEventSourceStateID::CombinedSessionState,
            CGEventType::Null,
        );

        Ok(idle_time as u64)
    }
}

#[cfg(target_os = "linux")]
fn get_platform_idle_time() -> Result<u64, String> {
    use x11::xlib;
    use x11::xss;

    unsafe {
        let display = xlib::XOpenDisplay(std::ptr::null());
        if display.is_null() {
            return Err("Failed to open X11 display".to_string());
        }

        let mut screen_saver_info = xss::XScreenSaverInfo {
            window: 0,
            state: 0,
            kind: 0,
            til_or_since: 0,
            idle: 0,
            eventMask: 0,
        };

        let root = xlib::XDefaultRootWindow(display);
        let result = xss::XScreenSaverQueryInfo(display, root, &mut screen_saver_info);

        xlib::XCloseDisplay(display);

        if result != 0 {
            Ok((screen_saver_info.idle / 1000) as u64)
        } else {
            Err("Failed to query XScreenSaver info".to_string())
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn get_platform_idle_time() -> Result<u64, String> {
    Err("Idle time detection not implemented for this platform".to_string())
}

fn get_platform_name() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_idle_time() {
        let result = get_idle_time();
        assert!(result.is_ok());

        let info = result.unwrap();
        assert!(info.idle_seconds >= 0);
        assert!(!info.platform.is_empty());

        println!("Idle time: {} seconds, Platform: {}", info.idle_seconds, info.platform);
    }

    #[test]
    fn test_get_idle_time_with_threshold() {
        let result = get_idle_time_with_threshold(60);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert!(info.idle_seconds >= 0);

        // Test with very high threshold - should not be idle
        let result_high = get_idle_time_with_threshold(999999);
        assert!(result_high.is_ok());
        assert!(!result_high.unwrap().is_idle);

        // Test with zero threshold - should always be idle
        let result_zero = get_idle_time_with_threshold(0);
        assert!(result_zero.is_ok());
        assert!(result_zero.unwrap().is_idle);
    }

    #[test]
    fn test_platform_name() {
        let platform = get_platform_name();
        assert!(platform == "windows" || platform == "macos" || platform == "linux" || platform == "unknown");
    }
}