# PRD #17: File & Media Handling System

**Status**: Draft
**Priority**: P0 — Critical
**Assignee**: TBD
**Estimated effort**: 2-3 sprints
**Depends on**: Text Messaging (#01), Rich Notifications (#16)

## Problem Statement

Hearth Desktop lacks comprehensive file and media handling capabilities that are essential for modern communication apps. Discord provides seamless drag-and-drop file sharing, rich media previews, embedded media players, and sophisticated file management. Without these features, Hearth cannot compete effectively for users who need to share documents, images, videos, and other media files in their communication workflows.

## Success Criteria

- [ ] Drag-and-drop file sharing from desktop/file manager into chat
- [ ] Rich media previews for images, videos, documents, and links
- [ ] Embedded media player for audio/video files
- [ ] File upload progress tracking and management
- [ ] Automatic file optimization and compression
- [ ] Thumbnail generation for supported file types
- [ ] File download management with resume capability
- [ ] Cross-platform file handling (Windows/macOS/Linux file associations)

## Requirements

### Functional Requirements

**File Upload System**
- Drag-and-drop support from desktop, file managers, and web browsers
- Multi-file selection and batch upload capability
- File type validation and size limit enforcement
- Upload progress tracking with cancel/retry functionality
- Automatic file compression and optimization
- Custom file names and descriptions before sending
- Paste-from-clipboard support for images and files

**Media Preview System**
- **Images**: Inline thumbnails with click-to-expand modal view
- **Videos**: Embedded video player with controls (play, pause, volume, fullscreen)
- **Audio**: Inline audio player with waveform visualization
- **Documents**: PDF preview, Office document thumbnails
- **Code Files**: Syntax-highlighted code preview
- **Links**: Rich link previews with title, description, and thumbnail

**File Management**
- File download with progress tracking and resume capability
- Local file caching with size limits and cleanup
- File organization by type, date, and source
- Search functionality across all shared files
- Bulk file operations (download, delete, share)
- File history and version tracking
- External application integration (open with default app)

**Media Player Integration**
- Native video player with hardware acceleration support
- Audio player with queue management and repeat/shuffle
- Media controls integration with OS (media keys, now playing)
- Subtitle support for videos (.srt, .vtt, embedded)
- Video quality selection (480p, 720p, 1080p, original)
- Playback speed controls (0.5x - 2x)

**File Security & Validation**
- Malware scanning integration before download
- File type validation and sandboxing
- Thumbnail generation in isolated environment
- Safe preview for potentially dangerous file types
- User permission prompts for executable files
- Encrypted file storage and transmission

### Non-Functional Requirements

**Performance**
- File upload/download speeds optimized for available bandwidth
- Thumbnail generation < 500ms for standard image files
- Media preview loading < 1 second for local files
- Efficient file caching with LRU eviction policy
- Background processing for file operations without UI blocking

**Storage Management**
- Configurable local cache size limits (default 2GB)
- Automatic cache cleanup based on age and usage
- Smart compression for uploaded files
- Efficient storage format for thumbnails and previews
- Cross-platform cache location and organization

**User Experience**
- Smooth drag-and-drop visual feedback
- Clear upload/download progress indicators
- Intuitive file organization and search
- Keyboard shortcuts for common file operations
- Accessibility support for file interactions

## Technical Specification

### Architecture Overview

```
File Input Sources ←→ Upload Manager ←→ Media Processor ←→ Storage System
        ↓                   ↓               ↓               ↓
Drag/Drop Interface ←→ Progress Tracker ←→ Preview Generator ←→ Cache Manager
        ↓                   ↓               ↓               ↓
File Validation ←→ Upload Queue ←→ Thumbnail System ←→ Download Manager
```

### Core Components

**1. File Upload Manager**
```rust
pub struct FileUploadManager {
    upload_queue: UploadQueue,
    progress_tracker: ProgressTracker,
    validator: FileValidator,
    compressor: FileCompressor,
}

impl FileUploadManager {
    pub fn start_upload(&mut self, files: Vec<FileInput>, channel_id: &str) -> Result<Vec<UploadId>, Error>
    pub fn cancel_upload(&mut self, upload_id: &UploadId) -> Result<(), Error>
    pub fn get_upload_progress(&self, upload_id: &UploadId) -> Option<UploadProgress>
    pub fn handle_drag_drop(&mut self, drop_event: &DragDropEvent) -> Result<(), Error>
}
```

**2. Media Preview Generator**
```rust
pub struct MediaPreviewGenerator {
    thumbnail_cache: ThumbnailCache,
    video_processor: VideoProcessor,
    audio_analyzer: AudioAnalyzer,
    document_renderer: DocumentRenderer,
}

impl MediaPreviewGenerator {
    pub fn generate_thumbnail(&self, file: &File, size: ThumbnailSize) -> Result<Vec<u8>, Error>
    pub fn extract_video_frame(&self, video_file: &File, timestamp: f64) -> Result<Vec<u8>, Error>
    pub fn generate_audio_waveform(&self, audio_file: &File) -> Result<WaveformData, Error>
    pub fn render_document_preview(&self, document: &File) -> Result<Vec<u8>, Error>
}
```

**3. Media Player Controller**
```rust
pub struct MediaPlayerController {
    video_player: VideoPlayer,
    audio_player: AudioPlayer,
    playback_state: PlaybackState,
    media_controls: SystemMediaControls,
}

impl MediaPlayerController {
    pub fn play_video(&mut self, video_file: &File) -> Result<(), PlaybackError>
    pub fn play_audio(&mut self, audio_file: &File) -> Result<(), PlaybackError>
    pub fn seek_to(&mut self, position: f64) -> Result<(), Error>
    pub fn set_volume(&mut self, volume: f32) -> Result<(), Error>
    pub fn toggle_playback(&mut self) -> Result<(), Error>
}
```

### Data Models

```typescript
interface FileUpload {
  id: UploadId;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadProgress: number; // 0-100
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
}

interface MediaFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: UserId;
  channelId: string;
  messageId: string;
  metadata: MediaMetadata;
  thumbnails: Thumbnail[];
}

interface MediaMetadata {
  // Image metadata
  dimensions?: { width: number; height: number };
  colorSpace?: string;
  exifData?: ExifData;

  // Video metadata
  duration?: number;
  frameRate?: number;
  codec?: string;
  bitrate?: number;

  // Audio metadata
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  artist?: string;
  album?: string;
  title?: string;
}

interface ThumbnailSize {
  width: number;
  height: number;
  quality: number; // 1-100
}

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLooping: boolean;
  isMuted: boolean;
}
```

### Platform-Specific File Handling

**Windows File Integration**
```rust
use windows::Win32::UI::Shell::*;
use windows::Win32::System::Com::*;

pub struct WindowsFileHandler {
    drop_target: IDropTarget,
    shell_context: IShellWindows,
}

impl WindowsFileHandler {
    pub fn register_drop_target(&self, hwnd: HWND) -> Result<(), Error> {
        RegisterDragDrop(hwnd, &self.drop_target)?;
        Ok(())
    }

    pub fn handle_file_drop(&self, data_object: &IDataObject) -> Result<Vec<PathBuf>, Error> {
        let format = FORMATETC {
            cfFormat: CF_HDROP as u16,
            ptd: std::ptr::null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_HGLOBAL.0,
        };

        let medium = data_object.GetData(&format)?;
        let files = self.extract_file_paths_from_hdrop(medium.unionfield.hGlobal)?;
        Ok(files)
    }

    pub fn open_with_default_app(&self, file_path: &Path) -> Result<(), Error> {
        ShellExecuteW(
            None,
            w!("open"),
            &HSTRING::from(file_path.to_string_lossy()),
            None,
            None,
            SW_NORMAL,
        )?;
        Ok(())
    }
}
```

**macOS File Integration**
```rust
use cocoa::appkit::*;
use cocoa::foundation::*;

pub struct MacOSFileHandler {
    pasteboard: NSPasteboard,
}

impl MacOSFileHandler {
    pub fn handle_drag_drop(&self, dragging_info: &NSDraggingInfo) -> Result<Vec<PathBuf>, Error> {
        let pasteboard = dragging_info.dragging_pasteboard();
        let file_urls = pasteboard.property_list_for_type(NSFilenamesPboardType);

        let mut files = Vec::new();
        for url_string in file_urls.iter() {
            let path = PathBuf::from(url_string.to_string());
            files.push(path);
        }
        Ok(files)
    }

    pub fn open_with_default_app(&self, file_path: &Path) -> Result<(), Error> {
        let workspace = NSWorkspace::shared_workspace();
        let url = NSURL::file_url_with_path(&NSString::from_str(&file_path.to_string_lossy()));
        workspace.open_url(&url)?;
        Ok(())
    }
}
```

**Linux File Integration**
```rust
use gtk::prelude::*;
use gio::prelude::*;

pub struct LinuxFileHandler {
    app_info: gio::AppInfo,
}

impl LinuxFileHandler {
    pub fn handle_drag_drop(&self, selection_data: &gtk::SelectionData) -> Result<Vec<PathBuf>, Error> {
        let uri_list = selection_data.get_uris();
        let mut files = Vec::new();

        for uri in uri_list {
            if let Some(path) = gio::File::for_uri(&uri).get_path() {
                files.push(path);
            }
        }
        Ok(files)
    }

    pub fn open_with_default_app(&self, file_path: &Path) -> Result<(), Error> {
        let file = gio::File::for_path(file_path);
        let app_info = file.query_default_handler(gio::Cancellable::NONE)?;

        app_info.launch(&[file], gio::AppLaunchContext::NONE)?;
        Ok(())
    }
}
```

### Media Processing Pipeline

**Image Processing**
```rust
use image::{ImageFormat, DynamicImage};
use webp::Encoder;

pub struct ImageProcessor {
    max_dimensions: (u32, u32),
    quality_settings: QualitySettings,
}

impl ImageProcessor {
    pub fn process_image(&self, input: &[u8]) -> Result<ProcessedImage, Error> {
        let img = image::load_from_memory(input)?;

        // Generate multiple thumbnail sizes
        let thumbnails = vec![
            self.generate_thumbnail(&img, (150, 150))?,
            self.generate_thumbnail(&img, (400, 400))?,
            self.generate_thumbnail(&img, (800, 600))?,
        ];

        // Optimize original if too large
        let optimized = if img.width() > self.max_dimensions.0 || img.height() > self.max_dimensions.1 {
            self.resize_image(&img, self.max_dimensions)?
        } else {
            img
        };

        Ok(ProcessedImage {
            original: self.encode_as_webp(&optimized)?,
            thumbnails,
            metadata: self.extract_image_metadata(&img)?,
        })
    }

    fn generate_thumbnail(&self, img: &DynamicImage, size: (u32, u32)) -> Result<Vec<u8>, Error> {
        let thumb = img.thumbnail(size.0, size.1);
        self.encode_as_webp(&thumb)
    }
}
```

**Video Processing**
```rust
use ffmpeg::{Codec, format, media};

pub struct VideoProcessor {
    ffmpeg_context: ffmpeg::format::context::Input,
    thumbnail_extractor: ThumbnailExtractor,
}

impl VideoProcessor {
    pub fn process_video(&self, input_path: &Path) -> Result<ProcessedVideo, Error> {
        let context = ffmpeg::format::input(input_path)?;
        let stream = context.streams().best(media::Type::Video)
            .ok_or(Error::NoVideoStream)?;

        let metadata = VideoMetadata {
            duration: context.duration() as f64 / f64::from(ffmpeg::ffi::AV_TIME_BASE),
            width: stream.codec().width(),
            height: stream.codec().height(),
            frame_rate: stream.avg_frame_rate(),
            codec: stream.codec().id().name().to_string(),
        };

        // Extract thumbnail at 10% mark
        let thumbnail_time = metadata.duration * 0.1;
        let thumbnail = self.extract_frame_at_time(input_path, thumbnail_time)?;

        Ok(ProcessedVideo {
            metadata,
            thumbnail,
            preview_url: self.generate_preview_url(input_path)?,
        })
    }
}
```

### File Cache Management

```rust
pub struct FileCacheManager {
    cache_dir: PathBuf,
    max_cache_size: u64,
    lru_tracker: LruCache<String, CacheEntry>,
}

impl FileCacheManager {
    pub fn store_file(&mut self, key: &str, data: &[u8], metadata: &FileMetadata) -> Result<(), Error> {
        // Check if we need to cleanup space
        if self.get_cache_size() + data.len() as u64 > self.max_cache_size {
            self.cleanup_lru_entries(data.len() as u64)?;
        }

        let file_path = self.cache_dir.join(format!("{}.cache", key));
        std::fs::write(&file_path, data)?;

        self.lru_tracker.put(key.to_string(), CacheEntry {
            path: file_path,
            size: data.len() as u64,
            created: SystemTime::now(),
            metadata: metadata.clone(),
        });

        Ok(())
    }

    pub fn get_file(&mut self, key: &str) -> Option<Vec<u8>> {
        if let Some(entry) = self.lru_tracker.get(key) {
            std::fs::read(&entry.path).ok()
        } else {
            None
        }
    }

    fn cleanup_lru_entries(&mut self, space_needed: u64) -> Result<(), Error> {
        let mut freed_space = 0u64;
        let mut keys_to_remove = Vec::new();

        for (key, entry) in self.lru_tracker.iter().rev() {
            keys_to_remove.push(key.clone());
            freed_space += entry.size;

            if freed_space >= space_needed {
                break;
            }
        }

        for key in keys_to_remove {
            if let Some(entry) = self.lru_tracker.pop(&key) {
                let _ = std::fs::remove_file(&entry.path);
            }
        }

        Ok(())
    }
}
```

## Implementation Plan

### Phase 1: Core File Upload System (Sprint 1)
- Implement drag-and-drop file handling across platforms
- Build file upload manager with progress tracking
- Add basic file validation and size limits
- Create file upload UI with progress indicators
- Integrate with existing message sending system

### Phase 2: Media Preview System (Sprint 1-2)
- Implement thumbnail generation for images and documents
- Build image preview modal with zoom and navigation
- Add basic video preview with frame extraction
- Create link preview system for URLs
- Implement file type icons and metadata display

### Phase 3: Media Player Integration (Sprint 2)
- Build embedded video player with controls
- Add audio player with waveform visualization
- Implement system media controls integration
- Add subtitle support for videos
- Create playlist functionality for multiple media files

### Phase 4: Advanced File Management (Sprint 2-3)
- Implement file download manager with resume capability
- Build file cache system with LRU eviction
- Add file search and organization features
- Create bulk file operations (download, share, delete)
- Implement external application integration

### Phase 5: Optimization & Polish (Sprint 3)
- Add file compression and optimization
- Implement advanced media processing (quality selection, speed controls)
- Add security features (malware scanning, sandboxing)
- Performance optimization for large files and media
- Cross-platform testing and refinement

## Testing Strategy

**Functional Testing**
- Drag-and-drop functionality across different file types and sources
- Upload/download progress tracking and cancellation
- Media preview generation for various file formats
- Media player controls and playback quality
- File cache management and cleanup

**Performance Testing**
- Large file upload/download performance
- Thumbnail generation speed for various image sizes
- Media preview loading times
- Memory usage with large file caches
- Concurrent file operation handling

**Platform Testing**
- Windows: File associations, shell integration, drag-drop from Explorer
- macOS: Finder integration, Quick Look compatibility, drag-drop behavior
- Linux: Various file managers, desktop environment integration
- File system edge cases (special characters, long paths, permissions)

**Security Testing**
- Malicious file upload prevention
- Executable file handling and warnings
- File validation bypass attempts
- Cache security and isolation
- Privacy protection for sensitive files

## Success Metrics

- **File Sharing Adoption**: 80%+ of users regularly share files
- **Upload Performance**: < 5 seconds for 10MB files on average connections
- **Preview Generation**: < 500ms thumbnail generation for standard images
- **User Satisfaction**: 4.3+ rating for file sharing experience
- **Platform Coverage**: Full feature parity across Windows/macOS/Linux

## Risks & Mitigations

**Technical Risks**
- *Large File Performance*: Chunked uploads, background processing, progress feedback
- *Media Format Support*: Extensible codec system, graceful fallbacks
- *Cache Management*: Smart cleanup policies, user-configurable limits
- *Security Vulnerabilities*: Sandboxed processing, virus scanning integration

**User Experience Risks**
- *Complex Upload UI*: Simple drag-drop interface, clear progress indicators
- *File Organization*: Smart defaults, search functionality
- *Privacy Concerns*: Transparent caching policies, local storage options

## Related Work

- Discord: Comprehensive file sharing with previews, media players, and Nitro features
- Slack: File upload/preview system, external storage integrations
- Microsoft Teams: Office document integration, media sharing, collaborative editing
- Telegram: Large file support, media compression, cloud storage

## Future Considerations

- Cloud storage integration (Google Drive, Dropbox, OneDrive)
- Collaborative document editing and real-time sync
- Advanced media features (360° video, VR content support)
- AI-powered content recognition and tagging
- File versioning and collaborative review workflows
- Integration with productivity and creative software suites