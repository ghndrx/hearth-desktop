# PRD #12: Native File Integration System

**Status:** Not Started
**Priority:** P0 (Critical)
**Effort:** 3-4 weeks
**Epic:** Desktop Parity with Discord

## Problem Statement

Hearth Desktop lacks native file handling capabilities that Discord users expect:
- No drag & drop for files/images into chat channels
- No clipboard integration for auto-pasting screenshots
- No native file dialogs for attachment uploads
- No file association handling for opening Hearth links/files

This creates a significant UX gap vs Discord and forces users to rely on manual file uploads through web interfaces.

## Success Criteria

1. **Drag & Drop**: Users can drag files, images, and folders from file explorer into chat channels
2. **Clipboard Integration**: Auto-paste images from clipboard with Ctrl+V
3. **Native Dialogs**: System file picker opens when clicking "attach file" button
4. **File Preview**: Inline preview for images, documents before sending
5. **Progress Tracking**: Upload progress indicator with cancel option
6. **File Association**: Register `.hearth` files to open in Hearth Desktop
7. **Deep Linking**: Handle `hearth://` URLs for direct navigation

## Requirements

### Functional Requirements

**F-FILE-01**: File Drag & Drop Support
- Detect file drag over chat input area
- Show visual drop zone indicator
- Accept multiple file types: images (jpg, png, gif, webp), documents (pdf, txt, md), archives (zip, tar)
- File size validation (max 25MB per file, max 10 files per drop)
- Auto-generate thumbnail previews for images

**F-FILE-02**: Clipboard Integration
- Intercept Ctrl+V in chat input
- Detect clipboard content type (image, text, files)
- Auto-paste images with preview modal
- Support clipboard file paths (copied from file explorer)
- Preserve image metadata and quality

**F-FILE-03**: Native File Dialogs
- System file picker integration via `tauri-plugin-dialog`
- Multi-file selection support
- File type filtering by context (images only, documents, etc.)
- Remember last used directory per session
- Cross-platform consistency (Windows Explorer, macOS Finder, Linux file managers)

**F-FILE-04**: File Upload Processing
- Chunked upload for large files (1MB chunks)
- Upload progress with bytes transferred/total
- Pause/resume capability
- Upload queue management (max 5 concurrent uploads)
- Error handling with retry logic (max 3 attempts)

**F-FILE-05**: File Association & Deep Linking
- Register `hearth://` protocol handler during installation
- Handle URLs: `hearth://server/channel`, `hearth://invite/code`, `hearth://user/profile`
- Register `.hearth` file extension for backup/export files
- Auto-launch app when opening associated files
- Protocol validation and security checks

### Non-Functional Requirements

**NF-FILE-01**: Performance
- File preview generation under 200ms for images under 5MB
- Upload throughput of at least 1MB/s on broadband connections
- Memory usage under 100MB during file operations
- No UI blocking during file processing

**NF-FILE-02**: Security
- Validate file types against whitelist (prevent .exe, .bat, .sh uploads)
- Scan file headers for actual type vs extension
- Sanitize file names (remove special characters, path traversal)
- Quarantine suspicious files before upload

**NF-FILE-03**: Accessibility
- Keyboard navigation for file dialogs (Tab, Enter, Escape)
- Screen reader announcements for drag & drop operations
- High contrast mode support for drop zones
- Alt text generation for uploaded images

## Technical Architecture

### Backend Components (Tauri/Rust)

```rust
// src-tauri/src/file_handler.rs
#[tauri::command]
async fn open_file_dialog(filters: Vec<FileFilter>) -> Result<Vec<PathBuf>, String>

#[tauri::command]
async fn validate_file(path: String) -> Result<FileValidation, String>

#[tauri::command]
async fn register_protocol_handler() -> Result<(), String>

#[tauri::command]
async fn get_file_preview(path: String) -> Result<FilePreview, String>
```

### Frontend Components (Svelte)

```typescript
// src/lib/components/FileUpload/
- FileDropZone.svelte         # Drag & drop overlay
- FilePreviewModal.svelte     # Preview before upload
- FileUploadProgress.svelte   # Progress indicators
- ClipboardHandler.svelte     # Clipboard paste logic
```

### Dependencies

**Tauri Plugins:**
- `tauri-plugin-dialog` - Native file dialogs
- `tauri-plugin-clipboard` - Clipboard access
- `tauri-plugin-fs` - File system operations

**Rust Crates:**
- `mime_guess` - File type detection
- `image` - Image thumbnail generation
- `tokio-fs` - Async file operations
- `reqwest` - HTTP upload client

## Implementation Plan

### Phase 1: Foundation (Week 1)
- Add required Tauri plugins to Cargo.toml
- Implement basic file validation and type detection
- Create FileDropZone component with visual feedback
- Add file drag & drop event listeners

### Phase 2: Core Features (Week 2-3)
- Implement native file dialog integration
- Add clipboard paste handling with image support
- Build file preview modal with thumbnail generation
- Create upload progress tracking system

### Phase 3: Advanced Features (Week 3-4)
- Protocol handler registration (`hearth://`)
- File association for `.hearth` extension
- Chunked upload with pause/resume
- Error handling and retry logic

### Phase 4: Polish & Testing (Week 4)
- Accessibility improvements (keyboard nav, screen readers)
- Cross-platform testing (Windows, macOS, Linux)
- Security hardening (file type validation, sanitization)
- Performance optimization (memory usage, upload speed)

## Testing Strategy

### Unit Tests
- File type validation logic
- File size and count limits
- Protocol URL parsing
- Thumbnail generation for various image formats

### Integration Tests
- End-to-end drag & drop workflow
- Clipboard paste with various content types
- File dialog interaction across platforms
- Upload progress tracking with simulated network conditions

### Manual Testing
- Cross-platform file dialog behavior
- Large file upload (25MB) with progress tracking
- Protocol handler installation and URL handling
- Accessibility with screen readers and keyboard-only navigation

## Security Considerations

**File Type Restrictions:**
- Whitelist approach: Only allow safe file types
- Header validation: Check actual file content vs extension
- Size limits: 25MB per file, 100MB total per message

**Protocol Handler Security:**
- URL validation with regex patterns
- Origin verification for deep links
- Rate limiting for protocol invocations

**Upload Security:**
- Client-side pre-validation before server upload
- Virus scanning integration (future consideration)
- File content sanitization for document types

## Dependencies & Blockers

**Dependencies:**
- Text messaging system (PRD #01) - needs chat input component
- Server API integration - file upload endpoints
- WebRTC pipeline - for file sharing during voice calls

**External Blockers:**
- Hearth backend API file upload implementation
- CDN/storage configuration for file hosting
- Authentication system for secure file access

## Success Metrics

**User Experience Metrics:**
- File upload success rate > 95%
- Average upload time < 5 seconds for 5MB file
- User adoption rate > 60% within first month

**Technical Metrics:**
- Memory usage during file operations < 100MB
- File validation accuracy > 99.9%
- Protocol handler registration success > 95%

**Competitive Parity Metrics:**
- Feature comparison score vs Discord file handling: 90%+
- User satisfaction rating for file operations: 4.5/5

---

**Related PRDs:** #01 (Text Messaging), #13 (System Tray), #14 (Game Integration)
**Technical Dependencies:** Tauri 2 plugins, Hearth backend API