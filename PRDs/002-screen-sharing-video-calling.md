# PRD-002: Screen Sharing & Video Calling

## Overview
**Priority:** P0 (Critical)
**Estimated Effort:** 8-10 weeks
**Status:** Design Phase

## Problem Statement
Hearth Desktop currently only supports audio communication, missing essential video calling and screen sharing capabilities that are standard in modern communication platforms. This significantly limits its utility for remote work, gaming, educational content, and social interaction compared to Discord.

## Success Metrics
- **Feature Adoption:** 60% of voice users enable video within first month
- **Screen Share Usage:** 30% of voice sessions include screen sharing
- **Session Quality:** >95% of video calls maintain stable connection for full duration
- **Performance:** Video calls support up to 25 concurrent participants
- **User Satisfaction:** 4.5+ star rating for video call quality in user feedback

## User Stories

### Video Calling
- **As a user**, I want to enable my camera during voice calls so others can see me
- **As a user**, I want to see other participants' video feeds so I can have face-to-face conversations
- **As a user**, I want to toggle my camera on/off during calls so I can control my privacy
- **As a user**, I want picture-in-picture video mode so I can multitask while staying connected

### Screen Sharing
- **As a user**, I want to share my entire screen so I can show my desktop to others
- **As a user**, I want to share specific application windows so I can control what others see
- **As a user**, I want to share browser tabs so I can present web content
- **As a user**, I want to control screen sharing permissions so I can maintain security

### Advanced Features
- **As a user**, I want to stream content to a channel (Go Live) so I can broadcast to many viewers
- **As a user**, I want to annotate during screen sharing so I can highlight important information
- **As a user**, I want to record video calls so I can reference them later
- **As a user**, I want noise suppression during video calls so my audio is clear

## Technical Requirements

### Video Calling Infrastructure
- **WebRTC Video Streams:** Support for multiple simultaneous video feeds
- **Video Codec Support:** VP8, VP9, H.264 for broad compatibility
- **Adaptive Bitrate:** Automatically adjust quality based on network conditions
- **Video Controls:** Camera toggle, quality selection, virtual backgrounds

### Screen Capture System
- **Platform-Specific APIs:**
  - Windows: Desktop Duplication API / Graphics Capture API
  - macOS: ScreenCaptureKit / CGDisplayStream
  - Linux: X11 XRandR / Wayland screen capture
- **Application Window Capture:** Enumerate and capture specific windows
- **Browser Tab Capture:** Chrome/Edge tab capture API integration

### Tauri Integration
- **Native Permissions:** Camera and screen capture permission handling
- **System APIs:** Access to platform-specific capture mechanisms
- **Performance Optimization:** Native processing for video encoding/decoding
- **Security:** Sandboxed capture with user consent workflows

## Implementation Plan

### Phase 1: Basic Video Calling (Weeks 1-4)
1. **Video Infrastructure Setup**
   - Extend existing WebRTC infrastructure for video streams
   - Implement video track management in WebRTCConnectionManager
   - Add camera enumeration and selection APIs

2. **Camera Integration**
   - Camera device discovery via Tauri APIs
   - Video preview component with controls
   - Camera permission handling across platforms

3. **Multi-Participant Video UI**
   - Grid layout for multiple video feeds
   - Adaptive layout based on participant count
   - Video quality indicators and controls

4. **Video Call Controls**
   - Camera toggle functionality
   - Video quality selection (720p/1080p)
   - Picture-in-picture mode implementation

### Phase 2: Screen Sharing (Weeks 5-7)
1. **Screen Capture Backend**
   - Tauri plugin for cross-platform screen capture
   - Desktop and window enumeration APIs
   - Permission request workflows

2. **Screen Share Selection UI**
   - Screen/window picker interface
   - Live preview thumbnails
   - Audio capture toggle for system audio

3. **Screen Share Streaming**
   - Screen capture integration with WebRTC
   - Efficient encoding for screen content
   - Real-time cursor highlight and annotation

### Phase 3: Advanced Features (Weeks 8-10)
1. **Go Live Streaming**
   - Broadcast mode for 1-to-many streaming
   - Viewer count and chat overlay
   - Stream quality optimization

2. **Recording & Virtual Backgrounds**
   - Local video call recording
   - Virtual background processing
   - Noise suppression enhancement

3. **Performance & Optimization**
   - GPU acceleration where available
   - Bandwidth optimization algorithms
   - Battery usage optimization for laptops

## Technical Architecture

### Screen Capture Plugin (Rust)
```rust
// src-tauri/src/screen_capture.rs
pub struct ScreenCaptureManager {
    active_capture: Option<CaptureSession>,
    available_sources: Vec<CaptureSource>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureSource {
    id: String,
    name: String,
    source_type: SourceType, // Screen, Window, Tab
    thumbnail: Option<Vec<u8>>,
}
```

### Video Component (Svelte)
```typescript
// src/lib/components/VideoCall.svelte
interface VideoParticipant {
  userId: string;
  stream: MediaStream;
  isScreenShare: boolean;
  isSpeaking: boolean;
  isVideoEnabled: boolean;
}
```

### WebRTC Extensions
```typescript
// src/lib/voice/VideoManager.ts
class VideoManager {
  async enableCamera(): Promise<MediaStream>;
  async startScreenShare(sourceId: string): Promise<MediaStream>;
  async enableVirtualBackground(enabled: boolean): Promise<void>;
}
```

## Platform-Specific Considerations

### Windows
- **Desktop Duplication API** for efficient screen capture
- **Windows.Graphics.Capture** for modern applications
- **WASAPI** for system audio capture
- **DirectShow** for camera enumeration

### macOS
- **ScreenCaptureKit** (macOS 12.3+) for high-performance capture
- **CGDisplayStream** fallback for older versions
- **AVCaptureDevice** for camera management
- **Core Audio** for system audio

### Linux
- **PipeWire** for modern Wayland screen capture
- **X11 XRandR** for X11 environments
- **V4L2** for camera device management
- **PulseAudio/ALSA** for audio capture

## Performance Requirements

### Video Quality Targets
- **720p30:** Minimum quality for group calls
- **1080p30:** Standard quality for smaller groups
- **1080p60:** Premium quality for screen sharing
- **4K30:** Optional for high-end hardware

### Network Optimization
- **Adaptive Bitrate:** 100 kbps - 2 Mbps per video stream
- **Quality Scaling:** Automatic downgrade during poor network conditions
- **Bandwidth Sharing:** Fair allocation among multiple participants

### Hardware Requirements
- **CPU Usage:** <25% for 1080p30 encoding/decoding
- **Memory Usage:** <200MB additional for video features
- **GPU Acceleration:** Utilize hardware encoders when available

## Security & Privacy

### Permission Management
- **Granular Permissions:** Separate controls for camera, screen, and audio
- **Visual Indicators:** Clear UI indicators when sharing/recording
- **One-Time Consent:** Require explicit approval for each screen share session

### Data Protection
- **End-to-End Encryption:** Encrypt video streams using SRTP
- **No Cloud Storage:** All video data remains peer-to-peer
- **Recording Consent:** Explicit consent from all participants before recording

## Competitive Analysis

### Discord Parity Target: 80%
**Target Features:**
- 1-to-1 and group video calling ✓
- Screen sharing (full screen + window) ✓
- Go Live streaming to channels ✓
- Picture-in-picture mode ✓
- Camera controls and effects ✓

**Advanced Features (Future):**
- Stage channels for presentations
- Noise suppression (enhanced)
- Virtual backgrounds (AI-powered)
- Real-time collaboration tools

## Risk Mitigation

### Technical Risks
- **Cross-Platform Compatibility:** Extensive testing on all three platforms
- **Performance Issues:** Profiling and optimization throughout development
- **Browser WebView Limitations:** Fallback strategies for WebView constraints

### User Experience Risks
- **Privacy Concerns:** Clear consent workflows and visual indicators
- **Bandwidth Usage:** Automatic quality adjustment and usage warnings
- **Hardware Compatibility:** Graceful degradation for older systems

## Testing Strategy

### Automated Testing
- **Unit Tests:** Core video/screen capture functionality
- **Integration Tests:** WebRTC connection establishment
- **Performance Tests:** CPU/memory usage under various scenarios

### Manual Testing
- **Cross-Platform Testing:** Windows 10/11, macOS 12+, Ubuntu 20.04+
- **Hardware Testing:** Various camera models and screen configurations
- **Network Testing:** Different bandwidth and latency conditions

## Success Criteria
- [ ] Enable/disable camera during voice calls with <1 second delay
- [ ] Share full screen or specific windows with 60 FPS capability
- [ ] Support up to 25 concurrent video participants
- [ ] Maintain <200ms latency for video streams on local networks
- [ ] Picture-in-picture mode for video calls while using other apps
- [ ] Cross-platform compatibility (Windows, macOS, Linux)
- [ ] Hardware acceleration utilization where available
- [ ] Bandwidth usage <2 Mbps per 1080p30 stream
- [ ] Screen capture works with all major applications
- [ ] Privacy controls clearly visible when sharing/recording

## Future Enhancements
- **AI-Powered Features:** Automatic framing, noise suppression, background blur
- **Collaboration Tools:** Real-time annotation and cursor sharing
- **Recording & Playback:** Cloud storage integration for recorded sessions
- **Mobile Compatibility:** Consistent experience across desktop and mobile
- **Accessibility:** Screen reader support and high contrast modes