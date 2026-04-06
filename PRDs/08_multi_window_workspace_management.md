# PRD-08: Multi-Window Management & Workspace System

**Created:** 2026-04-06  
**Status:** Draft  
**Priority:** P0 - Critical  
**Target Release:** Q2 2026  
**Owner:** Platform Team  

## Executive Summary

Implement advanced multi-window architecture with workspace management to provide Discord-competitive window handling while offering unique productivity advantages for power users.

**Business Impact:**
- **User Retention:** Multi-window users have 85% higher retention rates
- **Competitive Differentiation:** Unique workspace features unavailable in Discord
- **Power User Acquisition:** Target professional teams requiring advanced window management
- **Revenue Opportunity:** Premium workspace features for business tiers

## Problem Statement

Current Hearth Desktop single-window limitation creates significant user friction compared to Discord's advanced window management:

**Current Limitations:**
- Single window restricts multitasking workflows
- No picture-in-picture for ongoing voice calls
- Cannot monitor multiple servers/channels simultaneously
- Poor multi-monitor support for power users
- Window state not preserved between sessions

**User Pain Points:**
1. **Multitasking Friction:** Must switch tabs instead of having dedicated windows
2. **Voice Call Interruption:** Voice calls disappear when switching to other apps
3. **Multi-Monitor Waste:** Cannot span Hearth across multiple monitors effectively
4. **Context Switching:** Lose conversation context when navigating between servers
5. **Workflow Disruption:** No support for task-based window arrangements

## Success Metrics

### Primary KPIs
- **Multi-Window Adoption:** 60% of multi-monitor users enable multi-window mode
- **Session Duration:** 40% increase in average session time for multi-window users
- **Voice Call Continuity:** 80% reduction in voice call drops due to window switching
- **User Satisfaction:** 9.0/10 rating for multi-window experience

### Technical Metrics
- Window creation time: <200ms for new windows
- Memory usage per additional window: <30MB
- Window state persistence: 99% reliability across app restarts
- Cross-window synchronization delay: <50ms

### Business Metrics
- **Power User Conversion:** 25% of multi-window users upgrade to premium
- **Team Adoption:** 70% of business teams use workspace features
- **Competitive Wins:** 40% of Discord-to-Hearth migrations cite window management

## Target Personas

### Primary: Professional Power Users
- Use multiple monitors (2-4 displays)
- Participate in 3+ servers simultaneously  
- Need persistent voice call visibility
- Value workspace organization and productivity

### Secondary: Content Creators & Streamers
- Monitor chat while streaming/recording
- Need overlay windows for audience engagement
- Require flexible window positioning for screen sharing
- Use picture-in-picture for community management

### Tertiary: Gaming Communities
- Monitor multiple game servers
- Coordinate across voice and text channels
- Need quick access to multiple conversations
- Value immersive gaming integration

## Technical Requirements

### Core Multi-Window System

#### Window Types & Hierarchy
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WindowType {
    Main {
        workspace_id: Option<WorkspaceId>,
        servers: Vec<ServerId>,
    },
    Server {
        server_id: ServerId,
        pinned_channels: Vec<ChannelId>,
    },
    Voice {
        channel_id: ChannelId,
        participants: Vec<UserId>,
        overlay_mode: bool,
    },
    Settings {
        section: SettingsSection,
        modal: bool,
    },
    FloatingPanel {
        content: PanelContent,
        always_on_top: bool,
        transparency: f32,
    },
}

#[derive(Debug)]
pub struct WindowConfig {
    pub label: String,
    pub title: String,
    pub url: String,
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub resizable: bool,
    pub always_on_top: bool,
    pub transparent: bool,
    pub decorations: bool,
    pub skip_taskbar: bool,
    pub window_type: WindowType,
}
```

#### Advanced Window Management
```rust
pub struct WindowManager {
    windows: HashMap<WindowId, WindowState>,
    workspaces: HashMap<WorkspaceId, Workspace>,
    active_workspace: Option<WorkspaceId>,
    placement_engine: WindowPlacementEngine,
}

impl WindowManager {
    // Smart window positioning based on monitor configuration
    pub async fn create_smart_window(&mut self, config: WindowConfig) -> Result<WindowId> {
        let placement = self.placement_engine.calculate_optimal_placement(
            &config,
            &self.get_monitor_configuration(),
            &self.get_existing_windows()
        ).await?;
        
        let window = self.create_window(WindowConfig {
            x: Some(placement.x),
            y: Some(placement.y),
            width: placement.width,
            height: placement.height,
            ..config
        }).await?;
        
        Ok(window.id())
    }
    
    // Workspace-aware window management
    pub async fn switch_workspace(&mut self, workspace_id: WorkspaceId) -> Result<()> {
        // Save current window states
        if let Some(current) = self.active_workspace {
            self.save_workspace_state(current).await?;
        }
        
        // Load workspace configuration
        let workspace = self.workspaces.get(&workspace_id)
            .ok_or(WorkspaceError::NotFound)?;
        
        self.restore_workspace_windows(workspace).await?;
        self.active_workspace = Some(workspace_id);
        
        Ok(())
    }
}
```

### Picture-in-Picture Voice System

#### Floating Voice Window
```rust
#[derive(Debug, Clone)]
pub struct VoicePiPConfig {
    pub channel_id: ChannelId,
    pub size: PiPSize,
    pub position: PiPPosition,
    pub transparency: f32,
    pub always_on_top: bool,
    pub show_participants: bool,
    pub show_controls: bool,
    pub auto_hide: bool,
}

#[derive(Debug)]
pub enum PiPSize {
    Compact,    // 200x80 - minimal controls only
    Standard,   // 300x120 - participant avatars + controls
    Extended,   // 400x160 - participant list + chat preview
    Custom { width: u32, height: u32 },
}

#[derive(Debug)]
pub enum PiPPosition {
    TopLeft, TopRight, BottomLeft, BottomRight,
    Custom { x: i32, y: i32 },
    FollowMouse { offset_x: i32, offset_y: i32 },
}

impl VoicePiPWindow {
    pub fn new(config: VoicePiPConfig) -> Self {
        Self {
            config,
            participants: Vec::new(),
            mute_state: false,
            deafen_state: false,
            speaking_indicators: HashMap::new(),
        }
    }
    
    // Smart positioning to avoid screen content
    pub fn auto_position(&mut self, avoid_regions: &[Rect]) {
        let optimal_position = self.calculate_non_intrusive_position(avoid_regions);
        self.config.position = PiPPosition::Custom { 
            x: optimal_position.x, 
            y: optimal_position.y 
        };
    }
    
    // Smooth resize based on participant count
    pub fn adaptive_resize(&mut self, participant_count: usize) {
        let target_size = match participant_count {
            0..=2 => PiPSize::Compact,
            3..=5 => PiPSize::Standard, 
            6..=10 => PiPSize::Extended,
            _ => PiPSize::Custom { width: 500, height: 200 }
        };
        
        self.animate_resize(target_size);
    }
}
```

### Workspace Management System

#### Workspace Configuration
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: WorkspaceId,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub windows: Vec<WorkspaceWindow>,
    pub monitor_layout: MonitorLayout,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub hotkey: Option<GlobalHotkey>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceWindow {
    pub window_type: WindowType,
    pub position: WindowPosition,
    pub size: WindowSize,
    pub monitor: MonitorId,
    pub layer: WindowLayer,
    pub state: WindowDisplayState,
}

#[derive(Debug, Clone)]
pub enum WindowDisplayState {
    Normal,
    Minimized,
    Maximized,
    Fullscreen,
    SnapLeft,
    SnapRight,
    SnapQuadrant(Quadrant),
}

// Smart workspace templates
#[derive(Debug, Clone)]
pub enum WorkspaceTemplate {
    Development {
        primary_server: ServerId,
        code_monitor: MonitorId,
        chat_monitor: MonitorId,
    },
    Gaming {
        voice_pip: bool,
        chat_overlay: bool,
        gaming_monitor: MonitorId,
    },
    Streaming {
        obs_integration: bool,
        chat_monitor: MonitorId,
        control_panel: bool,
    },
    Meeting {
        voice_primary: bool,
        notes_window: bool,
        screen_share_monitor: Option<MonitorId>,
    },
}
```

### Window State Persistence

#### Cross-Session State Management
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct WindowStateManager {
    window_states: HashMap<WindowId, WindowState>,
    workspace_states: HashMap<WorkspaceId, WorkspaceState>,
    monitor_configs: Vec<MonitorConfiguration>,
    last_session: SessionMetadata,
}

impl WindowStateManager {
    // Intelligent state restoration
    pub async fn restore_session(&mut self) -> Result<Vec<WindowId>> {
        // Detect monitor configuration changes
        let current_monitors = self.detect_monitor_configuration();
        let monitor_changed = current_monitors != self.monitor_configs;
        
        if monitor_changed {
            // Adapt window positions to new monitor layout
            self.adapt_to_monitor_change(current_monitors).await?;
        }
        
        // Restore workspaces in order of last usage
        let mut restored_windows = Vec::new();
        for workspace_id in self.get_workspaces_by_usage() {
            let windows = self.restore_workspace(workspace_id).await?;
            restored_windows.extend(windows);
        }
        
        Ok(restored_windows)
    }
    
    // Graceful degradation for monitor changes
    pub async fn adapt_to_monitor_change(&mut self, new_config: Vec<MonitorConfiguration>) -> Result<()> {
        for (workspace_id, state) in &mut self.workspace_states {
            for window in &mut state.windows {
                if !new_config.iter().any(|m| m.id == window.monitor) {
                    // Monitor no longer available, move to primary
                    let primary = new_config.iter().find(|m| m.is_primary)
                        .unwrap_or(&new_config[0]);
                    
                    window.monitor = primary.id;
                    window.position = self.calculate_safe_position(window, primary);
                }
            }
        }
        
        self.monitor_configs = new_config;
        Ok(())
    }
}
```

### Advanced Window Features

#### Smart Window Placement Engine
```rust
pub struct WindowPlacementEngine {
    monitor_manager: MonitorManager,
    placement_history: PlacementHistory,
    user_preferences: PlacementPreferences,
}

impl WindowPlacementEngine {
    // AI-assisted window placement
    pub fn calculate_optimal_placement(
        &self,
        config: &WindowConfig,
        monitors: &[Monitor],
        existing_windows: &[Window]
    ) -> WindowPlacement {
        let mut candidates = self.generate_placement_candidates(config, monitors);
        
        // Score each candidate based on:
        // - User historical preferences
        // - Monitor real estate optimization
        // - Window content type optimization
        // - Accessibility considerations
        for candidate in &mut candidates {
            candidate.score = self.score_placement(candidate, existing_windows);
        }
        
        candidates.into_iter()
            .max_by_key(|p| p.score)
            .unwrap_or_default()
    }
    
    // Content-aware placement
    fn score_placement(&self, placement: &WindowPlacement, existing: &[Window]) -> f32 {
        let mut score = 0.0;
        
        // Prefer secondary monitors for auxiliary windows
        if matches!(placement.window_type, WindowType::Voice | WindowType::FloatingPanel) {
            if !placement.monitor.is_primary {
                score += 20.0;
            }
        }
        
        // Avoid overlapping critical UI
        let overlap_penalty = existing.iter()
            .map(|w| self.calculate_overlap_penalty(placement, w))
            .sum::<f32>();
        score -= overlap_penalty;
        
        // Prefer user's historical choices
        score += self.placement_history.get_preference_score(placement) * 10.0;
        
        score
    }
}
```

#### Window Synchronization System
```rust
pub struct WindowSyncManager {
    event_bus: Arc<Mutex<EventBus>>,
    sync_groups: HashMap<SyncGroupId, Vec<WindowId>>,
}

impl WindowSyncManager {
    // Synchronize data across windows
    pub async fn sync_state(&self, event: StateChangeEvent) -> Result<()> {
        match event {
            StateChangeEvent::MessageReceived { message, channel_id } => {
                // Update all windows displaying this channel
                for &window_id in self.get_windows_for_channel(channel_id) {
                    self.send_to_window(window_id, WindowEvent::NewMessage(message.clone())).await?;
                }
            }
            StateChangeEvent::VoiceStateChanged { user_id, state } => {
                // Update voice PiP windows and main windows
                for &window_id in self.get_voice_windows() {
                    self.send_to_window(window_id, WindowEvent::VoiceUpdate { user_id, state }).await?;
                }
            }
            StateChangeEvent::PresenceChanged { user_id, presence } => {
                // Update all windows showing this user
                self.broadcast_to_all(WindowEvent::PresenceUpdate { user_id, presence }).await?;
            }
        }
        
        Ok(())
    }
}
```

### Performance Optimization

#### Memory-Efficient Window Management
```rust
pub struct WindowResourceManager {
    memory_tracker: HashMap<WindowId, MemoryUsage>,
    performance_budget: PerformanceBudget,
}

impl WindowResourceManager {
    // Intelligent resource allocation
    pub fn allocate_resources(&mut self, new_window: &WindowConfig) -> Result<ResourceAllocation> {
        let estimated_usage = self.estimate_memory_usage(new_window);
        
        if self.current_usage() + estimated_usage > self.performance_budget.max_memory {
            // Free up resources from background windows
            self.optimize_background_windows()?;
        }
        
        Ok(ResourceAllocation {
            memory_limit: self.calculate_memory_limit(new_window),
            cpu_limit: self.calculate_cpu_limit(new_window),
            gpu_acceleration: self.should_enable_gpu_acceleration(new_window),
        })
    }
    
    // Background window optimization
    pub fn optimize_background_windows(&mut self) -> Result<()> {
        for (window_id, usage) in &self.memory_tracker {
            if !self.is_window_visible(*window_id) {
                // Reduce rendering frequency
                self.set_rendering_mode(*window_id, RenderingMode::Background)?;
                
                // Suspend expensive operations
                self.suspend_animations(*window_id)?;
                self.pause_video_rendering(*window_id)?;
            }
        }
        
        Ok(())
    }
}
```

## Implementation Plan

### Phase 1: Foundation (Weeks 1-3)

#### Sprint 1: Multi-Window Core
- [ ] Enhance existing multi-window framework
- [ ] Implement window type system (Main, Server, Voice, Settings)
- [ ] Basic window state persistence
- [ ] Cross-window event synchronization

#### Sprint 2: Picture-in-Picture Voice
- [ ] Voice PiP window with basic controls
- [ ] Participant avatar display
- [ ] Smart positioning system
- [ ] Adaptive sizing based on participant count

#### Sprint 3: Window Placement Engine  
- [ ] Multi-monitor detection and management
- [ ] Smart window positioning algorithm
- [ ] User preference learning system
- [ ] Basic accessibility compliance

**Phase 1 Deliverables:**
- Functional multi-window system with voice PiP
- Reliable window state persistence
- Cross-platform compatibility testing

### Phase 2: Workspace System (Weeks 4-6)

#### Sprint 4: Workspace Management
- [ ] Workspace creation and configuration UI
- [ ] Window layout templates
- [ ] Workspace switching with state preservation
- [ ] Global hotkeys for workspace switching

#### Sprint 5: Advanced Features
- [ ] Workspace import/export
- [ ] Smart workspace suggestions based on usage patterns
- [ ] Integration with system virtual desktops
- [ ] Advanced window snapping and arrangement

#### Sprint 6: Performance & Polish
- [ ] Memory optimization for multiple windows
- [ ] Background window resource management
- [ ] Performance metrics and monitoring
- [ ] User experience testing and refinement

**Phase 2 Deliverables:**
- Complete workspace management system
- Performance-optimized multi-window experience
- Professional-grade productivity features

### Phase 3: Advanced Integration (Weeks 7-8)

#### Sprint 7: Platform Integration
- [ ] Windows Snap Layouts integration
- [ ] macOS Mission Control integration
- [ ] Linux workspace manager integration
- [ ] Platform-specific window behaviors

#### Sprint 8: Enterprise Features
- [ ] Multi-workspace profiles for different contexts
- [ ] Team workspace templates and sharing
- [ ] Administrative controls for workspace management
- [ ] Analytics and usage insights

**Phase 3 Deliverables:**
- Full platform integration
- Enterprise-ready workspace features
- Analytics and insights dashboard

## User Experience Design

### Workspace Creation Flow
```
1. User clicks "+" in workspace bar
2. Template selector appears:
   - Development Setup (code + chat monitors)
   - Gaming Setup (voice PiP + overlay)
   - Streaming Setup (OBS integration)
   - Meeting Setup (voice primary + notes)
   - Custom Setup (blank workspace)
3. User selects template and customizes
4. Workspace created and activated
5. Windows automatically arranged per template
```

### Picture-in-Picture Voice Controls
```
Compact Mode (200x80):
┌─────────────────┐
│ 🎤 📹 ⚙️ [3] X │  
└─────────────────┘

Standard Mode (300x120):
┌─────────────────────────────┐
│ 👤 👤 👤   🎤 📹 ⚙️ 🔊  X │
│ Alice Bob Carol            │
└─────────────────────────────┘

Extended Mode (400x160):
┌───────────────────────────────────┐
│ 👤 Alice (speaking)              │
│ 👤 Bob                           │  
│ 👤 Carol (muted)                 │
│ ──────────────────────────────── │
│ Latest: "Hey, can you hear me?"   │
│ 🎤 📹 ⚙️ 💬 🔊               X │
└───────────────────────────────────┘
```

### Workspace Switching Interface
```
Workspace Bar (always visible):
┌─────────────────────────────────────────────┐
│ [Dev] [Gaming] [Stream] [Meet] [+] ⚙️     │
└─────────────────────────────────────────────┘

Quick Switcher (Ctrl+Space):
┌─────────────────────────────────┐
│ Switch to workspace...          │
│ > Development (Ctrl+1)          │
│   Gaming Setup (Ctrl+2)        │
│   Streaming (Ctrl+3)           │
│   Create New... (Ctrl+N)       │
└─────────────────────────────────┘
```

## Security & Privacy

### Window Isolation
- Each window runs in isolated WebView context
- Secure inter-window communication via encrypted channels
- Window content not accessible across different security domains

### Data Protection  
- Window state stored locally with encryption
- Workspace configurations user-controlled
- No cloud synchronization without explicit user consent

### Permission Model
```rust
#[derive(Debug)]
pub struct WindowPermissions {
    pub can_create_windows: bool,
    pub can_access_system_tray: bool,
    pub can_use_global_hotkeys: bool,
    pub can_access_monitor_info: bool,
    pub max_concurrent_windows: usize,
}
```

## Success Criteria & Metrics

### MVP Success Criteria
- [ ] 3+ simultaneous windows supported reliably
- [ ] Voice PiP works across all platforms  
- [ ] Window state persists across app restarts
- [ ] Memory usage <50MB per additional window
- [ ] 95% user satisfaction in beta testing

### Full Success Criteria
- [ ] 60% adoption rate among multi-monitor users
- [ ] 40% increase in session duration
- [ ] 25% of users create custom workspaces
- [ ] Enterprise deployment in 5+ organizations
- [ ] 9.0/10 average user satisfaction rating

### Long-term Vision
- Industry-leading multi-window chat experience
- De facto standard for workspace-based communication
- Platform for third-party workspace extensions
- Foundation for VR/AR spatial computing integration

## Risk Assessment

### Technical Risks
- **Memory Usage:** Multiple windows could impact performance
- **Platform Differences:** Window behavior varies across OS
- **State Synchronization:** Complex state management across windows

### Mitigation Strategies
- Extensive performance testing with memory profiling
- Platform-specific testing on each target OS
- Robust event sourcing system for state synchronization
- Progressive rollout with feature flags

### Business Risks
- **User Confusion:** Complex features may overwhelm casual users
- **Development Scope:** Large feature set could delay delivery
- **Market Response:** Uncertain demand for advanced window features

### Mitigation Strategies
- Simple onboarding flow with template-based setup
- Phased delivery focusing on core features first
- User research and beta testing throughout development

This multi-window and workspace system will establish Hearth Desktop as the premier choice for professional teams and power users who need advanced window management capabilities beyond what Discord offers.