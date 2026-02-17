use tauri::{AppHandle, Manager};

/// Capture a screenshot of the entire screen
#[tauri::command]
pub async fn capture_screenshot(app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        use std::path::PathBuf;
        
        // Get the app data directory
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        
        let screenshots_dir = app_dir.join("screenshots");
        std::fs::create_dir_all(&screenshots_dir)
            .map_err(|e| format!("Failed to create screenshots dir: {}", e))?;
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let filename = format!("screenshot_{}.png", timestamp);
        let filepath = screenshots_dir.join(&filename);
        
        // Use screencapture on macOS
        let output = Command::new("screencapture")
            .args(&["-x", filepath.to_str().unwrap()])
            .output()
            .map_err(|e| format!("Failed to capture screenshot: {}", e))?;
        
        if !output.status.success() {
            return Err("Screenshot capture failed".to_string());
        }
        
        Ok(filepath.to_string_lossy().to_string())
    }
    
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Graphics::Gdi::{GetDC, CreateCompatibleDC, CreateCompatibleBitmap, SelectObject, BitBlt, SRCCOPY, GetDIBits, BITMAPINFOHEADER, BI_RGB, DeleteObject, DeleteDC, ReleaseDC};
        use windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics;
        use windows_sys::Win32::UI::WindowsAndMessaging::{SM_CXSCREEN, SM_CYSCREEN};
        use std::path::PathBuf;
        use std::fs::File;
        use std::io::Write;
        
        unsafe {
            // Get screen dimensions
            let screen_width = GetSystemMetrics(SM_CXSCREEN);
            let screen_height = GetSystemMetrics(SM_CYSCREEN);
            
            // Get device context
            let hwnd = std::ptr::null_mut();
            let hdc_screen = GetDC(hwnd);
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            
            // Create bitmap
            let hbitmap = CreateCompatibleBitmap(hdc_screen, screen_width, screen_height);
            SelectObject(hdc_mem, hbitmap as *mut _);
            
            // Copy screen to bitmap
            BitBlt(hdc_mem, 0, 0, screen_width, screen_height, hdc_screen, 0, 0, SRCCOPY);
            
            // Get bitmap bits
            let mut bmi = BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: screen_width,
                biHeight: -screen_height, // Negative for top-down
                biPlanes: 1,
                biBitCount: 24,
                biCompression: BI_RGB,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            };
            
            let row_size = ((screen_width * 3 + 3) / 4) * 4;
            let image_size = row_size * screen_height;
            let mut buffer: Vec<u8> = vec![0; image_size as usize];
            
            GetDIBits(hdc_mem, hbitmap, 0, screen_height as u32, buffer.as_mut_ptr() as *mut _, &mut bmi as *mut _ as *mut _, 0);
            
            // Clean up GDI objects
            DeleteObject(hbitmap as *mut _);
            DeleteDC(hdc_mem);
            ReleaseDC(hwnd, hdc_screen);
            
            // Convert to PNG (simplified - in production use a proper PNG library)
            // For now, save as BMP
            let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let screenshots_dir = app_dir.join("screenshots");
            std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
            
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let filepath = screenshots_dir.join(format!("screenshot_{}.bmp", timestamp));
            let mut file = File::create(&filepath).map_err(|e| e.to_string())?;
            
            // Write BMP header
            let file_size = 54 + image_size as u32;
            let header: Vec<u8> = vec![
                0x42, 0x4D, // BM
                (file_size & 0xFF) as u8, ((file_size >> 8) & 0xFF) as u8,
                ((file_size >> 16) & 0xFF) as u8, ((file_size >> 24) & 0xFF) as u8,
                0, 0, 0, 0, // Reserved
                54, 0, 0, 0, // Offset to pixel data
                40, 0, 0, 0, // DIB header size
                (screen_width & 0xFF) as u8, ((screen_width >> 8) & 0xFF) as u8,
                ((screen_width >> 16) & 0xFF) as u8, ((screen_width >> 24) & 0xFF) as u8,
                (screen_height & 0xFF) as u8, ((screen_height >> 8) & 0xFF) as u8,
                ((screen_height >> 16) & 0xFF) as u8, ((screen_height >> 24) & 0xFF) as u8,
                1, 0, // Planes
                24, 0, // Bits per pixel
                0, 0, 0, 0, // Compression
                0, 0, 0, 0, // Image size
                0, 0, 0, 0, // X pixels per meter
                0, 0, 0, 0, // Y pixels per meter
                0, 0, 0, 0, // Colors in color table
                0, 0, 0, 0, // Important color count
            ];
            
            file.write_all(&header).map_err(|e| e.to_string())?;
            file.write_all(&buffer).map_err(|e| e.to_string())?;
            
            Ok(filepath.to_string_lossy().to_string())
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        use std::path::PathBuf;
        
        let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let screenshots_dir = app_dir.join("screenshots");
        std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let filepath = screenshots_dir.join(format!("screenshot_{}.png", timestamp));
        
        // Try gnome-screenshot first, then fallback to import (ImageMagick)
        let result = Command::new("gnome-screenshot")
            .args(&["-f", filepath.to_str().unwrap()])
            .output();
        
        if result.is_err() || !result.unwrap().status.success() {
            // Fallback to ImageMagick's import
            Command::new("import")
                .args(&["-window", "root", filepath.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Failed to capture screenshot: {}", e))?;
        }
        
        Ok(filepath.to_string_lossy().to_string())
    }
}

/// Capture a screenshot of a specific window
#[tauri::command]
pub async fn capture_window_screenshot(window_id: u64) -> Result<String, String> {
    // Platform-specific window capture
    // This is a simplified implementation
    Err("Window-specific screenshot not implemented".to_string())
}

/// Capture a screenshot of a specific region
#[tauri::command]
pub async fn capture_region_screenshot(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<String, String> {
    // Platform-specific region capture
    Err("Region screenshot not implemented".to_string())
}

/// Get the screenshots directory path
#[tauri::command]
pub fn get_screenshots_dir(app: AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_dir.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
    Ok(screenshots_dir.to_string_lossy().to_string())
}

/// List all screenshots
#[tauri::command]
pub fn list_screenshots(app: AppHandle) -> Result<Vec<ScreenshotInfo>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let screenshots_dir = app_dir.join("screenshots");
    
    if !screenshots_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut screenshots = vec![];
    
    for entry in std::fs::read_dir(&screenshots_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if let Some(ext) = path.extension() {
            if ext == "png" || ext == "jpg" || ext == "bmp" {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(created) = metadata.created() {
                        if let Ok(duration) = created.duration_since(std::time::UNIX_EPOCH) {
                            screenshots.push(ScreenshotInfo {
                                filename: path.file_name().unwrap().to_string_lossy().to_string(),
                                path: path.to_string_lossy().to_string(),
                                size: metadata.len(),
                                created_at: duration.as_secs(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Sort by creation time, newest first
    screenshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(screenshots)
}

/// Delete a screenshot
#[tauri::command]
pub fn delete_screenshot(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete screenshot: {}", e))
}

/// Screenshot information
#[derive(serde::Serialize)]
pub struct ScreenshotInfo {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub created_at: u64,
}
