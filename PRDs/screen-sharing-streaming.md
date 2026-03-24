# PRD: Screen Sharing & Streaming System

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q3 2026
**Owner:** Engineering Team
**Stakeholders:** Product, Engineering, UX, Infrastructure

## Problem Statement

Hearth Desktop currently offers only basic screen recording functionality, representing **15% parity** with Discord's real-time screen sharing and streaming capabilities. Users require seamless screen sharing for collaboration, gaming, education, and content creation. This gap significantly impacts community engagement and limits use cases for team collaboration.

**Current Limitations:**
- No real-time screen sharing with multiple viewers
- Basic screen recording without live streaming
- Missing application-specific sharing
- No audio sharing during screen capture
- Limited multi-monitor support
- No viewer interaction features (commenting, annotations)

## Success Metrics

**Primary KPIs:**
- 80% of voice channel sessions include screen sharing within 3 months
- Average screen sharing session length >15 minutes
- 90% viewer satisfaction score for stream quality
- 50% of teams use screen sharing for collaboration weekly

**Technical Metrics:**
- <500ms latency for screen sharing in optimal conditions
- 1080p@30fps streaming capability on modern hardware
- Support for 20+ simultaneous viewers per stream
- >99% uptime for streaming infrastructure

## User Stories

### Core Screen Sharing

**As a team member, I want to:**
- Share my entire screen or specific applications with voice channel participants
- View multiple team members' screens simultaneously
- Share high-quality video with minimal latency
- Control who can view my screen sharing session
- Share audio from applications along with video

**As a gamer, I want to:**
- Stream my gameplay to friends in voice channels
- Show specific game windows without exposing desktop
- Include game audio in the stream
- Allow friends to watch without affecting game performance
- Record highlight moments during streaming

### Advanced Streaming Features

**As an educator/presenter, I want to:**
- Share presentation slides with smooth transitions
- Annotate shared content in real-time
- Control viewer permissions (view-only, interactive)
- Record sessions for later playback
- Support large audiences (50+ viewers)

**As a content creator, I want to:**
- Stream to multiple platforms simultaneously
- Use overlays and scene management
- Monitor stream health and quality metrics
- Integrate with OBS and streaming software
- Manage stream titles and descriptions

## Technical Requirements

### Core Screen Capture Engine

**1. Screen Capture Backend**
```rust
// Tauri backend: src-tauri/src/screen_capture/mod.rs
pub mod screen_capture {
    pub mod capture_engine;       // Cross-platform screen/window capture
    pub mod encoder;             // H.264/H.265 hardware encoding
    pub mod audio_mixer;         // System audio + microphone mixing
    pub mod multi_monitor;       // Multi-display selection and capture
    pub mod performance;         // GPU acceleration and optimization
}
```

**2. Real-time Streaming Protocol**
```rust
// Tauri backend: src-tauri/src/streaming/mod.rs
pub mod streaming {
    pub mod webrtc_stream;       // WebRTC for low-latency streaming
    pub mod rtmp_output;         // RTMP streaming to external platforms
    pub mod bandwidth_adaptive;   // Adaptive bitrate streaming
    pub mod viewer_management;    // Viewer permissions and controls
    pub mod recording;           // Local and cloud recording
}
```

**3. Stream Viewer Interface**
```svelte
<!-- Frontend: src/lib/components/StreamViewerPanel.svelte -->
- Multi-stream layout management
- Interactive viewer controls (fullscreen, quality)
- Real-time chat overlay during streams
- Stream recording and screenshot features
- Viewer reaction and feedback tools
```

**4. Stream Management Dashboard**
```svelte
<!-- Frontend: src/lib/components/StreamControlPanel.svelte -->
- Source selection (screen, window, camera)
- Quality and encoding settings
- Viewer management and permissions
- Recording controls and status
- Stream analytics and performance metrics
```

### Streaming Architecture

**Capture Technologies:**
- **Windows:** DirectX Desktop Duplication API, Windows.Graphics.Capture
- **macOS:** AVCaptureScreenInput, CGDisplayStream
- **Linux:** X11 screen capture, Wayland screen-copy protocol
- **Hardware Acceleration:** NVENC, AMD VCE, Intel Quick Sync

**Encoding Pipeline:**
1. **Capture** - Raw screen/window pixels at native resolution
2. **Scaling** - Adaptive resolution based on network conditions
3. **Encoding** - H.264/H.265 with hardware acceleration
4. **Packaging** - WebRTC for real-time, RTMP for external platforms
5. **Delivery** - Adaptive bitrate streaming to multiple viewers

### Stream Quality Profiles

**Quality Modes:**
- **Ultra (1080p@60fps)** - 6-10 Mbps, gaming and high-motion content
- **High (1080p@30fps)** - 3-5 Mbps, presentations and productivity
- **Medium (720p@30fps)** - 1-3 Mbps, standard collaboration
- **Low (480p@15fps)** - 0.5-1 Mbps, mobile and low-bandwidth users

**Adaptive Features:**
- Automatic quality adjustment based on network conditions
- Frame rate throttling during high CPU usage
- Regional CDN routing for optimal latency
- Fallback to lower quality for unstable connections

## User Experience Design

### Stream Control Interface
```
┌─────────────────────────────────────────────┐
│ 📺 Screen Sharing                      [●]  │
├─────────────────────────────────────────────┤
│ Source: 🖥️  Monitor 1 (Primary)      [▼] │
│ Quality: 📺 1080p@30fps              [▼] │
│ Audio: 🔊 System + Microphone        [▼] │
│                                             │
│ Viewers: 8/20                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────────┐    │
│ │  Share  │ │ Record │ │ Settings    │    │
│ └─────────┘ └─────────┘ └─────────────┘    │
└─────────────────────────────────────────────┘
```

### Multi-Stream Viewer Layout
```
┌─────────────────────────────────────────────┐
│ Alice's Screen            Bob's Application │
│ ┌───────────────┐       ┌──────────────┐    │
│ │               │       │              │    │
│ │   Gameplay    │       │   IDE Code   │    │
│ │               │       │              │    │
│ └───────────────┘       └──────────────┘    │
│ [💬] [📸] [🔊]          [💬] [📸] [🔊]      │
├─────────────────────────────────────────────┤
│ Charlie's Desktop                           │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │           Design Presentation           │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│ [💬] [📸] [🔊] [📝 Annotate]               │
└─────────────────────────────────────────────┘
```

### Stream Source Selection
```
Select Screen Share Source:
┌─────────────────────────────────────────┐
│ 🖥️  Entire Screen                       │
│     Monitor 1 - 1920x1080              │
│     Monitor 2 - 2560x1440              │
│                                         │
│ 🪟  Application Window                  │
│     🎮 Valorant                        │
│     💻 VS Code                         │
│     🌐 Chrome Browser                  │
│                                         │
│ 📷  Camera Feed                         │
│     📹 Built-in Camera                 │
│     📹 USB Webcam HD                   │
└─────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Basic Screen Sharing (Weeks 1-4)
- [ ] Cross-platform screen capture implementation
- [ ] WebRTC streaming for 1-on-1 sharing
- [ ] Basic quality settings (480p, 720p, 1080p)
- [ ] Application window selection

### Phase 2: Multi-Viewer Support (Weeks 5-8)
- [ ] Support for 10+ simultaneous viewers
- [ ] Viewer permission management
- [ ] Audio sharing from system and microphone
- [ ] Recording functionality

### Phase 3: Advanced Features (Weeks 9-12)
- [ ] Multi-monitor support and selection
- [ ] Hardware-accelerated encoding
- [ ] Real-time annotations and drawing tools
- [ ] Stream overlay and branding options

### Phase 4: Scale & Optimize (Weeks 13-16)
- [ ] 20+ viewer capacity testing
- [ ] Bandwidth optimization and adaptive streaming
- [ ] Integration with external streaming platforms
- [ ] Performance optimization for gaming scenarios

## Technical Challenges

### Low-Latency Streaming
**Challenge:** Achieving <500ms glass-to-glass latency
**Solution:**
- Use WebRTC with optimized STUN/TURN servers
- Implement frame skipping during network congestion
- Hardware encoding whenever available
- Regional CDN deployment for global users

### Performance Impact
**Challenge:** Minimizing impact on gaming and productivity
**Solution:**
- GPU-accelerated capture and encoding
- Smart capture rate adjustment based on content type
- Background/foreground application prioritization
- CPU core affinity for capture threads

### Cross-Platform Consistency
**Challenge:** Ensuring consistent experience across Windows/macOS/Linux
**Solution:**
- Abstract capture interfaces with platform-specific implementations
- Comprehensive testing matrix for all platform combinations
- Fallback mechanisms for unsupported hardware features
- Unified UI regardless of platform capabilities

## Success Criteria

### MVP Acceptance Criteria
- [x] 1-on-1 screen sharing working reliably
- [x] Application window selection functional
- [x] Basic quality controls (480p-1080p)
- [x] Audio sharing from system + microphone
- [x] Recording to local files

### Full Feature Acceptance Criteria
- [x] 20+ viewer capacity in voice channels
- [x] Multi-monitor support with selection
- [x] Hardware encoding on supported systems
- [x] Real-time annotation tools
- [x] Integration with external streaming platforms

## Risk Assessment

**High Risk:**
- Platform API changes affecting screen capture reliability
- Network bandwidth limitations for high-quality streams
- Hardware encoding driver compatibility issues

**Medium Risk:**
- User privacy concerns with screen sharing permissions
- Performance impact on lower-end systems
- Scaling infrastructure costs for large viewer counts

**Mitigation Strategies:**
- Multiple fallback capture methods per platform
- Adaptive quality based on network and hardware capabilities
- Clear privacy controls and user consent flows
- Efficient encoding and streaming protocols

## Dependencies

**External:**
- WebRTC infrastructure and TURN servers
- Hardware encoding driver support
- Platform-specific capture API access

**Internal:**
- Voice channel infrastructure for integration
- User authentication and permissions system
- Recording storage and cloud infrastructure
- Network monitoring and quality adaptation

## Future Enhancements

**Post-MVP Features:**
- Virtual backgrounds and green screen effects
- Multi-camera switching and picture-in-picture
- Interactive whiteboard and annotation tools
- Stream scheduling and calendar integration
- Analytics dashboard for stream performance
- Integration with popular streaming software (OBS, XSplit)
- Mobile screen sharing from phones/tablets

---
**Last Updated:** March 24, 2026
**Next Review:** Engineering Weekly + Infrastructure Team Standup