# PRD: Screen Sharing and Rich Media System

## Overview

**Priority**: P1 (High)
**Timeline**: 6-8 weeks
**Owner**: Media/WebRTC Team

Implement comprehensive screen sharing, video calling, and rich media features to match Discord's collaboration capabilities while leveraging Tauri's native performance advantages.

## Problem Statement

Hearth Desktop currently only supports basic voice communication. Modern communication platforms require screen sharing, video calls, and rich media support for effective collaboration and community engagement.

**Current Gap**: Discord has mature screen sharing (application/full screen), video calling, Go Live streaming, and rich media embeds. Hearth Desktop lacks these visual collaboration features entirely.

## Success Metrics

- **Screen Share Adoption**: 40% of voice sessions include screen sharing
- **Video Call Usage**: 60% of 1:1 conversations use video
- **Performance**: Screen sharing at 30+ FPS with <200ms latency
- **Quality**: 1080p screen sharing and video calling support

## User Stories

### Screen Sharing
- As a user, I want to share my screen during voice calls so I can show content to others
- As a user, I want to choose specific applications to share so I can maintain privacy
- As a user, I want to share system audio so others can hear my applications
- As a user, I want to control screen share quality so I can optimize for bandwidth

### Video Calling
- As a user, I want video calling in voice channels so I can see other participants
- As a user, I want camera controls so I can manage my appearance and privacy
- As a user, I want video layouts (grid, speaker view) so I can organize the interface
- As a user, I want picture-in-picture mode so I can multitask during calls

### Rich Media
- As a user, I want to drag-drop files into chat so I can easily share content
- As a user, I want image/video previews so I can see media without downloading
- As a user, I want GIF support so I can express myself with animations
- As a user, I want link previews so I can see content before clicking

## Technical Requirements

### Frontend (Svelte/TypeScript)

- **Screen Capture Interface**
  - Application/screen picker modal
  - Preview window for selected content
  - Quality and framerate controls
  - Audio sharing toggle

- **Video Call Management**
  - Video grid layout system
  - Individual video controls (mute, hide)
  - Camera device selection
  - Video quality adjustment
  - Picture-in-picture mode

- **Media Display Components**
  - Image/video lightbox viewer
  - GIF player with controls
  - Link preview cards
  - File attachment viewer
  - Media gallery for channels

- **Control Overlays**
  - Screen share toolbar
  - Video call controls overlay
  - Media playback controls
  - Zoom and pan for shared content

### Backend Integration

- **WebRTC Enhancement**
  - Screen capture stream management
  - Video codec negotiation (VP8, H.264)
  - Adaptive bitrate control
  - Multi-stream support for screen + camera

- **Media Processing**
  - Image/video thumbnail generation
  - File type validation and processing
  - Media compression and optimization
  - Metadata extraction for previews

- **Streaming Infrastructure**
  - Screen share session management
  - Quality adaptation based on network
  - Recording capability (future)
  - Bandwidth monitoring and optimization

### Native Features (Tauri)

- **Screen Capture**
  - Native screen enumeration
  - Application window detection
  - High-performance screen capture
  - System permission handling

- **Media Access**
  - Camera device enumeration
  - Audio input/output control
  - Media file system integration
  - Hardware acceleration support

- **Performance Optimization**
  - Native media decoding
  - GPU-accelerated rendering
  - Memory-efficient streaming
  - Background processing for media

## Technical Specifications

### Screen Sharing API

```typescript
interface ScreenCaptureOptions {
  sourceId: string;
  sourceType: 'screen' | 'window' | 'application';
  audio: boolean;
  cursor: boolean;
  frameRate: number; // 15, 30, 60
  resolution: 'auto' | '720p' | '1080p';
}

interface ScreenShareSession {
  id: string;
  userId: string;
  channelId: string;
  options: ScreenCaptureOptions;
  stream: MediaStream;
  startTime: Date;
  viewers: string[];
}
```

### Video Call System

```typescript
interface VideoCallState {
  participants: VideoParticipant[];
  layout: 'grid' | 'speaker' | 'sidebar';
  localVideo: boolean;
  localAudio: boolean;
  screenShare?: ScreenShareSession;
}

interface VideoParticipant {
  userId: string;
  username: string;
  stream?: MediaStream;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isSpeaking: boolean;
}
```

### Rich Media Support

```typescript
interface MediaAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  thumbnail?: string;
  metadata: MediaMetadata;
}

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type: 'website' | 'image' | 'video' | 'audio';
}
```

## Implementation Phases

### Phase 1: Screen Sharing Foundation (3 weeks)
- Native screen enumeration and capture
- Basic screen share in voice channels
- Application/screen selection UI
- WebRTC stream integration

### Phase 2: Video Calling (2 weeks)
- Camera access and video streams
- Multi-participant video support
- Basic video layout management
- Video quality controls

### Phase 3: Rich Media (2 weeks)
- File drag-drop and upload
- Image/video preview system
- Link preview generation
- GIF support and playback

### Phase 4: Advanced Features (1 week)
- Picture-in-picture mode
- Audio sharing for screen capture
- Advanced video layouts
- Performance optimizations

## Performance Requirements

- **Screen Sharing**: 30 FPS at 1080p with <200ms latency
- **Video Calls**: Support 25 participants with grid layout
- **File Processing**: Image thumbnails generated in <1s
- **Memory Usage**: <100MB additional for video features

## Platform-Specific Features

### Windows
- DirectX screen capture for performance
- Windows.Graphics.Capture API integration
- Hardware encoder support (NVENC, QuickSync)
- Taskbar preview integration

### macOS
- ScreenCaptureKit for privacy compliance
- Metal performance shaders
- Control Center integration
- Continuity Camera support

### Linux
- X11 and Wayland capture support
- PipeWire integration
- VA-API hardware acceleration
- Portal-based screen capture

## Security and Privacy

### Screen Sharing Security
- Application isolation and sandboxing
- Screen capture permission prompts
- Watermark/indicator for shared content
- Automatic stop on screensaver/lock

### Media Security
- File type validation and scanning
- Size limits and virus checking
- Secure media URL generation
- EXIF data stripping from images

### Privacy Controls
- Camera/mic permission granularity
- Background blur and virtual backgrounds
- Private screen areas exclusion
- Recording notification system

## Dependencies

- **WebRTC Infrastructure**: Enhanced signaling for multi-stream
- **Media Storage**: File hosting and CDN for attachments
- **Transcoding Service**: Video/image optimization
- **System Permissions**: Camera, microphone, screen capture access

## Risks and Mitigations

### Technical Risks
- **Cross-Platform Screen Capture Complexity**
  - *Mitigation*: Use Tauri's platform-specific APIs and fallbacks
- **Performance with Multiple Video Streams**
  - *Mitigation*: Implement adaptive quality and hardware acceleration
- **WebRTC Compatibility Issues**
  - *Mitigation*: Extensive testing across browser/OS combinations

### User Experience Risks
- **Complex Permission Requirements**
  - *Mitigation*: Clear onboarding and permission explanation
- **High Bandwidth Usage**
  - *Mitigation*: Adaptive quality and user-controllable settings

## Success Criteria

### MVP Definition
- Screen sharing (full screen and application windows)
- Basic video calling with up to 10 participants
- Image/video file sharing with previews
- System audio sharing for screen capture

### Full Feature Success
- 1080p screen sharing at 60 FPS
- 25+ participant video calls with grid layout
- Rich link previews and embed support
- Picture-in-picture and advanced layouts
- Hardware acceleration on all platforms

## Competitive Analysis

### vs Discord Media Features
- **Matching**: Screen sharing, video calls, file sharing, link previews
- **Exceeding**: Performance (native capture), lower latency, better quality
- **Missing**: Go Live streaming, advanced video effects, YouTube integration

### Differentiation Opportunities
- **Native Performance**: Leverage Tauri for better screen capture performance
- **Quality**: Higher framerate and resolution options
- **Privacy**: More granular sharing controls and privacy features
- **Integration**: Better OS integration for media workflows

## Future Enhancements

- **Live Streaming**: Go Live feature for voice channels
- **Recording**: Call and screen share recording capabilities
- **Virtual Backgrounds**: AI-powered background replacement
- **Collaborative Features**: Shared whiteboard and annotation tools
- **Gaming Integration**: Game capture optimization and overlays