# PRD-15: Native OS Integration & File Handling System

**Epic**: Desktop Platform Parity
**Priority**: P0 (Critical)
**Timeline**: 8 weeks
**Owner**: Desktop Platform Team

## Problem Statement

Hearth Desktop currently lacks native OS integration features that Discord users expect from a desktop application. Users coming from Discord are accustomed to OS-native file handling, drag-and-drop, platform-specific shortcuts, and deep system integration. Without these features, Hearth Desktop feels like a web app rather than a native desktop experience.

**Current Pain Points:**
- No drag-and-drop file sharing capability
- Missing OS-native file dialogs and previews
- Lack of platform-specific integrations (Windows Jump Lists, macOS Touch Bar, Linux D-Bus)
- No file association registration for Hearth links
- Poor clipboard integration with rich content

## Objectives

### Primary Goals
- Implement comprehensive drag-and-drop file handling across all platforms
- Build native file system integration with OS dialogs and associations
- Create platform-specific features for Windows, macOS, and Linux
- Establish rich clipboard integration for seamless content sharing

### Success Metrics
- 95% of file uploads use drag-and-drop (vs manual file picker)
- <2 seconds file preview generation for images/videos <50MB
- 100% file association success rate for hearth:// protocol links
- Platform-specific features active on 80%+ of respective OS users

## Detailed Requirements

### 1. Universal File Handling

#### 1.1 Drag-and-Drop System
```rust
// Tauri file drop integration
#[tauri::command]
async fn handle_file_drop(files: Vec<String>, target_channel: String) -> Result<(), String> {
    // Multi-file upload with progress tracking
    // Image/video thumbnail generation
    // Automatic file type detection and handling
}
```

**Features:**
- Multi-file drag-and-drop from OS file manager
- Real-time upload progress with cancel capability
- Automatic thumbnail generation for media files
- Drag target highlighting in UI
- File validation and size limits with clear feedback

#### 1.2 Native File Dialogs
```rust
// OS-native file selection
use tauri_plugin_dialog::{DialogBuilder, FileFilter};

#[tauri::command]
async fn open_file_dialog(filters: Vec<FileFilter>) -> Result<Vec<String>, String> {
    // Cross-platform native file dialog
    // Multiple file selection
    // Custom file type filters
}
```

**Implementation:**
- Replace web-based file input with native OS dialogs
- Support for multiple file selection and custom filters
- Recent locations and bookmark integration
- Preview pane integration where available (macOS/Windows)

### 2. Platform-Specific Integrations

#### 2.1 Windows Integration
```rust
// Windows-specific features
use windows::Win32::UI::Shell::{ITaskbarList4, TBPFLAG};

async fn setup_windows_integration() {
    // Taskbar progress indication for file uploads
    // Jump List with recent channels/servers
    // Thumbnail toolbar with voice controls
    // Windows 11 snap layouts support
}
```

**Windows Features:**
- **Jump Lists**: Recent channels, quick actions, pinned servers
- **Taskbar Integration**: Progress indicators, thumbnail previews, overlay icons
- **Protocol Association**: hearth:// protocol registration
- **Context Menu**: "Share with Hearth" in Windows Explorer
- **Notification Actions**: Reply, join, mute from Action Center

#### 2.2 macOS Integration
```rust
// macOS-specific features
use cocoa::appkit::{NSApp, NSApplication, NSMenu};

async fn setup_macos_integration() {
    // Touch Bar dynamic controls
    // Spotlight integration
    // Services menu integration
    // Handoff/Continuity support
}
```

**macOS Features:**
- **Touch Bar Controls**: Mute, deafen, PTT, channel switcher
- **Spotlight Integration**: Search channels/users from Spotlight
- **Services Menu**: Share selected text/files to Hearth
- **Menu Bar Extras**: Status display in menu bar
- **Accessibility**: VoiceOver and assistive technology support

#### 2.3 Linux Integration
```rust
// Linux desktop environment integration
use dbus::{Connection, BusType, Message};

async fn setup_linux_integration() {
    // D-Bus service registration
    // Desktop notification daemon integration
    // MPRIS media control interface
    // XDG portal compliance
}
```

**Linux Features:**
- **D-Bus Integration**: System service communication
- **Desktop Entry**: Proper .desktop file with actions
- **MPRIS Support**: Media player interface for status
- **Notification Daemon**: Desktop-specific notification support
- **XDG Compliance**: File associations, default applications

### 3. Rich Clipboard Integration

#### 3.1 Advanced Clipboard Support
```rust
use tauri_plugin_clipboard::{ClipboardManager, ClipboardKind};

#[tauri::command]
async fn handle_clipboard_paste() -> Result<ClipboardContent, String> {
    // Support for multiple clipboard formats
    // Rich text with formatting preservation
    // Image paste with automatic upload
    // File path resolution for local files
}
```

**Clipboard Features:**
- **Rich Text Pasting**: Preserve formatting from other applications
- **Image Clipboard**: Direct paste of screenshots and copied images
- **File Reference Pasting**: Handle copied file paths and file objects
- **Cross-Platform Support**: Consistent behavior across all platforms
- **Format Detection**: Automatic content type detection and handling

### 4. File Association & Protocol Handling

#### 4.1 Protocol Registration
```rust
// hearth:// protocol handling
#[tauri::command]
async fn register_protocol_handler() -> Result<(), String> {
    // Register hearth:// protocol with OS
    // Handle deep links to channels/servers/users
    // Support for invitation links and sharing URLs
}
```

**Protocol Features:**
- **Deep Linking**: hearth://channel/123, hearth://server/456/channel/789
- **Invitation Handling**: Auto-join servers from browser links
- **Share URL Generation**: Create shareable links to conversations
- **Security**: Prompt before joining servers/channels from external links

## Technical Architecture

### Core Dependencies
```toml
# Cargo.toml additions
tauri-plugin-dialog = "2"
tauri-plugin-clipboard = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"

# Platform-specific crates
[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.54", features = ["Win32_UI_Shell", "Win32_System_Registry"] }

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"

[target.'cfg(target_os = "linux")'.dependencies]
dbus = "0.9"
freedesktop_entry_parser = "1.2"
```

### File Handling Pipeline
```typescript
// Frontend file handling
class FileHandler {
  async handleDrop(files: FileList, targetChannel: string) {
    // Validate files and show preview
    // Generate thumbnails for media
    // Upload with progress tracking
    // Insert file references in chat
  }

  async pasteClipboard() {
    // Detect clipboard content type
    // Handle images, text, files appropriately
    // Provide upload confirmation UI
  }
}
```

## User Experience

### File Upload Flow
1. **Drag Initiation**: User drags files from OS file manager
2. **Drop Zone Highlight**: Target channel highlights with upload affordance
3. **File Preview**: Thumbnail grid with file names and sizes
4. **Upload Confirmation**: "Upload 3 files to #general?" with cancel option
5. **Progress Tracking**: Individual file progress with overall completion
6. **Chat Integration**: Files appear in chat with rich previews

### Platform Integration UX
- **Windows**: Right-click any file → "Share with Hearth" → channel selector
- **macOS**: Select text → Services → "Send to Hearth Channel"
- **Linux**: Files auto-open with Hearth when registered for hearth:// protocol

## Implementation Plan

### Phase 1: Core File Handling (3 weeks)
- Basic drag-and-drop implementation
- Native file dialog integration
- File upload pipeline with progress tracking
- Cross-platform testing

### Phase 2: Platform Integrations (3 weeks)
- Windows Jump Lists and taskbar integration
- macOS Touch Bar and Services menu
- Linux D-Bus and desktop entry setup
- Protocol registration across platforms

### Phase 3: Advanced Features (2 weeks)
- Rich clipboard integration
- File association and deep linking
- Context menu integrations
- Performance optimization and testing

## Success Criteria

### Functional Requirements
- [ ] Drag-and-drop works for all file types <100MB
- [ ] Native file dialogs replace web-based inputs
- [ ] Platform-specific features active on each OS
- [ ] hearth:// protocol opens correct channels/servers
- [ ] Clipboard paste handles images, text, and files correctly

### Performance Requirements
- [ ] File upload initiation <500ms after drop
- [ ] Thumbnail generation <2s for images <10MB
- [ ] Platform integration features load <1s on app startup
- [ ] Memory usage increase <50MB for file handling features

### Quality Requirements
- [ ] Zero crashes during file operations across platforms
- [ ] Consistent UX patterns following OS design guidelines
- [ ] Accessibility compliance for all new UI elements
- [ ] Security: File validation prevents malicious uploads

## Competitive Analysis

**Discord Advantages:**
- Mature file handling with excellent drag-and-drop UX
- Strong platform integration across Windows/macOS/Linux
- Robust protocol handling for discord:// links
- Rich clipboard support with formatting preservation

**Hearth Desktop Opportunities:**
- **Superior Performance**: Native Rust vs Electron for file operations
- **Better Security**: More granular file validation and processing
- **Enhanced Preview**: Faster thumbnail generation with native processing
- **Cleaner Integration**: Less invasive OS integration options

This PRD establishes Hearth Desktop as a true native application with file handling and OS integration that matches or exceeds Discord's capabilities.