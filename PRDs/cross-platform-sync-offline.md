# PRD: Cross-Platform Data Synchronization & Offline Mode

**Document Status:** Draft
**Priority:** P0 (Critical)
**Target Release:** Q3 2026
**Owner:** Platform Infrastructure Team
**Stakeholders:** Product, Engineering, Mobile Team, Infrastructure

## Problem Statement

Hearth Desktop currently lacks sophisticated offline capabilities and cross-platform data synchronization, representing **30% parity** with Discord's seamless multi-device experience. While basic mobile sync is planned, Discord's advanced offline message caching, seamless device handoffs, background sync, and persistent state management across web/desktop/mobile create a unified experience that Hearth Desktop cannot match. This gap severely impacts user retention and multi-device usage patterns.

**Current Limitations:**
- No offline message browsing or caching
- Missing cross-device state synchronization (read status, typing indicators, presence)
- No seamless voice/video call handoffs between devices
- Limited background synchronization when app is closed
- Missing conflict resolution for multi-device edits
- No smart caching for images, files, and media

**Competitive Gap:**
Discord provides seamless 3-device sync with 30-day message history offline. Hearth has basic online-only functionality.

## Success Metrics

**Primary KPIs:**
- 80% of users successfully use Hearth on 2+ devices within 60 days
- 70% reduction in "message not found" errors during offline periods
- 90% user satisfaction for cross-device experience
- 50% increase in engagement during commute/travel periods

**Technical Metrics:**
- Message sync latency <3 seconds between devices
- Offline message cache of 7-14 days of recent activity
- Background sync completes within 30 seconds of network restoration
- Cross-device state synchronization <1 second
- 99.9% data consistency across devices

## User Stories

### Multi-Device Workflows

**As a mobile-first user, I want to:**
- Read my recent message history while offline on commute
- See exactly where I left off when switching from mobile to desktop
- Have my read status sync automatically between devices
- Continue voice calls seamlessly when switching devices
- Access cached images and files without internet connection

**As a remote worker, I want to:**
- Switch from laptop to phone for calls without interruption
- Have my presence and status sync across all devices
- Access important message history during internet outages
- Edit drafts started on one device and finish on another
- Receive consistent notifications across all logged-in devices

### Offline & Background Sync

**As a frequent traveler, I want to:**
- Browse recent conversations while on airplane mode
- Catch up on missed messages when connection is restored
- Have media files available offline for important conversations
- Queue messages to send when network becomes available
- Access cached voice messages and recordings offline

**As a power user, I want to:**
- Control how much data is cached locally for offline access
- Manage sync priorities for different servers and channels
- Resolve conflicts when the same message is edited on multiple devices
- Export conversation history for backup purposes
- Monitor sync status and troubleshoot connection issues

## Technical Requirements

### Core Synchronization Engine

**1. Multi-Device State Manager**
```rust
// src-tauri/src/sync_engine.rs
pub struct SyncEngine {
    device_id: DeviceId,
    sync_state: SyncState,
    conflict_resolver: ConflictResolver,
    cache_manager: CacheManager,
    background_sync: BackgroundSyncManager,
}

pub struct SyncState {
    message_cursors: HashMap<ChannelId, MessageCursor>,
    read_states: HashMap<ChannelId, ReadState>,
    typing_states: HashMap<UserId, TypingState>,
    presence_states: HashMap<UserId, PresenceState>,
    draft_states: HashMap<ChannelId, DraftState>,
}

#[derive(Serialize, Deserialize)]
pub struct MessageCursor {
    last_message_id: MessageId,
    last_read_id: MessageId,
    last_sync_timestamp: i64,
}
```

**2. Offline Cache System**
```typescript
// src/lib/cache/offline-cache.ts
interface OfflineCache {
  messages: MessageCache;
  media: MediaCache;
  users: UserCache;
  servers: ServerCache;
  settings: SettingsCache;
}

class MessageCache {
  async cacheMessages(channelId: string, messages: Message[], ttl: number): Promise<void>;
  async getCachedMessages(channelId: string, limit?: number): Promise<Message[]>;
  async clearExpiredMessages(): Promise<void>;
  async getOfflineAvailability(channelId: string): Promise<OfflineAvailability>;
}

interface OfflineAvailability {
  messageCount: number;
  oldestMessage: Date;
  newestMessage: Date;
  mediaFilesAvailable: number;
  estimatedSize: number;
}
```

**3. Background Synchronization**
```rust
// src-tauri/src/background_sync.rs
pub struct BackgroundSyncManager {
    sync_queue: VecDeque<SyncTask>,
    is_syncing: AtomicBool,
    sync_interval: Duration,
    priority_channels: HashSet<ChannelId>,
}

#[derive(Debug, Clone)]
pub struct SyncTask {
    pub task_type: SyncTaskType,
    pub priority: SyncPriority,
    pub created_at: SystemTime,
    pub retry_count: u32,
    pub channel_id: Option<ChannelId>,
}

pub enum SyncTaskType {
    MessageHistory(ChannelId, MessageCursor),
    ReadStateSync(HashMap<ChannelId, ReadState>),
    PresenceUpdate(UserId, PresenceState),
    MediaDownload(MediaId, Priority),
    ConflictResolution(ConflictId),
}
```

**4. Cross-Device State Sync**
```svelte
<!-- src/lib/components/SyncIndicator.svelte -->
<script>
  import { syncStore } from '$lib/stores/syncStore';
  import { onMount } from 'svelte';

  let syncStatus = 'idle';
  let lastSyncTime = null;
  let pendingChanges = 0;

  onMount(() => {
    const unsubscribe = syncStore.subscribe(state => {
      syncStatus = state.status;
      lastSyncTime = state.lastSync;
      pendingChanges = state.pendingChanges;
    });

    return unsubscribe;
  });
</script>

<div class="sync-indicator" class:syncing={syncStatus === 'syncing'}>
  {#if syncStatus === 'offline'}
    <span class="status offline">📴 Offline</span>
  {:else if syncStatus === 'syncing'}
    <span class="status syncing">🔄 Syncing...</span>
  {:else if pendingChanges > 0}
    <span class="status pending">⏳ {pendingChanges} pending</span>
  {:else}
    <span class="status synced">✅ Synced</span>
  {/if}
</div>
```

### Conflict Resolution System

**1. Multi-Device Edit Conflicts**
```typescript
// src/lib/sync/conflict-resolution.ts
interface ConflictResolver {
  resolveMessageEdit(conflict: MessageEditConflict): Promise<Resolution>;
  resolvePresenceConflict(conflict: PresenceConflict): Promise<Resolution>;
  resolveDraftConflict(conflict: DraftConflict): Promise<Resolution>;
}

interface MessageEditConflict {
  messageId: string;
  originalContent: string;
  deviceAEdit: EditOperation;
  deviceBEdit: EditOperation;
  timestamp: Date;
}

enum ResolutionStrategy {
  LastWriterWins,
  UserChoice,
  MergeChanges,
  CreateDuplicate,
}
```

**2. Smart Merge Algorithm**
```rust
// src-tauri/src/conflict_resolution.rs
pub struct ConflictResolver {
    strategy: ResolutionStrategy,
    user_preferences: UserConflictPreferences,
}

impl ConflictResolver {
    pub fn resolve_message_conflict(&self, conflict: &MessageConflict) -> Resolution {
        match self.strategy {
            ResolutionStrategy::LastWriterWins => self.apply_last_writer_wins(conflict),
            ResolutionStrategy::UserChoice => self.prompt_user_choice(conflict),
            ResolutionStrategy::MergeChanges => self.attempt_smart_merge(conflict),
            ResolutionStrategy::CreateDuplicate => self.create_conflict_duplicate(conflict),
        }
    }

    fn attempt_smart_merge(&self, conflict: &MessageConflict) -> Resolution {
        // Implement operational transformation for text merging
        let merged_content = operational_transform::merge(
            &conflict.original_content,
            &conflict.device_a_changes,
            &conflict.device_b_changes,
        );

        Resolution::Merged(merged_content)
    }
}
```

### Offline-First Architecture

**1. Local Database Layer**
```sql
-- SQLite schema for offline caching
CREATE TABLE cached_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    edited_timestamp INTEGER,
    cached_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    INDEX idx_channel_timestamp (channel_id, timestamp),
    INDEX idx_expires (expires_at)
);

CREATE TABLE sync_cursors (
    channel_id TEXT PRIMARY KEY,
    last_message_id TEXT NOT NULL,
    last_read_id TEXT,
    last_sync_timestamp INTEGER NOT NULL
);

CREATE TABLE cached_media (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    cached_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    expires_at INTEGER
);
```

**2. Intelligent Caching Strategy**
```typescript
// src/lib/cache/cache-strategy.ts
class CacheStrategy {
  private priorities = {
    pinned: 10,
    recent: 8,
    frequently_accessed: 6,
    mentions: 9,
    direct_messages: 8,
    server_messages: 4,
  };

  async decideCachePriority(message: Message, context: CacheContext): Promise<number> {
    let priority = this.priorities.server_messages;

    if (message.mentions?.includes(context.currentUserId)) {
      priority = Math.max(priority, this.priorities.mentions);
    }

    if (message.channelType === 'dm') {
      priority = Math.max(priority, this.priorities.direct_messages);
    }

    if (context.isRecent(message.timestamp, Duration.fromDays(7))) {
      priority = Math.max(priority, this.priorities.recent);
    }

    return priority;
  }
}
```

## Implementation Plan

### Phase 1: Core Sync Infrastructure (Weeks 1-6)
- [ ] Implement device identification and registration
- [ ] Create basic message sync between devices
- [ ] Build read state synchronization
- [ ] Add presence state sync
- [ ] Implement basic conflict detection

### Phase 2: Offline Caching (Weeks 7-12)
- [ ] Design and implement local SQLite cache
- [ ] Add message history caching with TTL
- [ ] Implement media file caching
- [ ] Create cache management interface
- [ ] Add offline message browsing

### Phase 3: Background Sync (Weeks 13-18)
- [ ] Build background sync queue system
- [ ] Implement incremental sync algorithms
- [ ] Add network state awareness
- [ ] Create sync priority management
- [ ] Add sync progress indicators

### Phase 4: Conflict Resolution (Weeks 19-24)
- [ ] Implement operational transformation for text edits
- [ ] Create user-facing conflict resolution UI
- [ ] Add smart merge algorithms
- [ ] Build conflict history tracking
- [ ] Add resolution strategy preferences

### Phase 5: Advanced Features (Weeks 25-30)
- [ ] Add device handoff for voice calls
- [ ] Implement draft synchronization
- [ ] Create typing indicator sync
- [ ] Build advanced cache analytics
- [ ] Add data export and backup features

## Synchronization Scenarios

### Critical Sync Events
1. **Message Read Status** - Instant sync when messages are read
2. **Typing Indicators** - Real-time sync with 5-second timeout
3. **Presence Changes** - Immediate sync of online/away/busy status
4. **Voice Call State** - Sub-second sync for call join/leave events
5. **Draft Messages** - Periodic sync every 10 seconds while editing

### Background Sync Priorities
1. **P0 - Critical** - Direct messages, mentions, pinned messages
2. **P1 - High** - Active channel messages, voice channel updates
3. **P2 - Medium** - Server messages, emoji reactions
4. **P3 - Low** - Historical messages, media thumbnails

### Offline Capabilities
1. **Message History** - 7-14 days of cached messages per channel
2. **Media Files** - Smart caching based on usage patterns
3. **User Profiles** - Cache friend and server member information
4. **Server Structure** - Channel lists, permissions, roles
5. **Search Index** - Local search across cached content

## Success Criteria

### MVP Acceptance Criteria
- [ ] Messages sync between desktop and mobile within 5 seconds
- [ ] Read status updates consistently across devices
- [ ] Basic offline message browsing works for recent conversations
- [ ] Presence changes reflect on all devices immediately
- [ ] Network interruptions don't cause data loss

### Full Feature Acceptance Criteria
- [ ] Seamless voice call handoffs between devices
- [ ] 14-day offline message cache with intelligent management
- [ ] Conflict resolution handles complex multi-device scenarios
- [ ] Background sync completes without user intervention
- [ ] Advanced caching saves 80% bandwidth on repeated visits

## Risk Assessment

**High Risk:**
- Data inconsistency across devices during network partitions
- Conflict resolution complexity for simultaneous edits
- Storage space consumption on mobile devices

**Medium Risk:**
- Sync performance impact on battery life
- Cache invalidation complexity
- Network bandwidth consumption for background sync

**Mitigation Strategies:**
- Comprehensive testing with network simulation
- User-configurable cache limits and priorities
- Intelligent background sync scheduling
- Robust conflict detection and resolution algorithms
- Performance monitoring and optimization

## Platform Considerations

### Mobile Constraints
- Limited storage space for message cache
- Battery optimization for background sync
- Data usage awareness and Wi-Fi preference
- Push notification integration for sync events

### Desktop Advantages
- Larger cache storage capacity
- Always-on background sync capability
- Better network connectivity and stability
- Advanced debugging and monitoring tools

## Dependencies

**External:**
- SQLite for local caching
- Network state detection libraries
- Background task scheduling APIs
- Cross-platform file system access

**Internal:**
- WebSocket message infrastructure
- Authentication and device management
- Push notification system
- Media processing pipeline

## Competitive Analysis

**Discord Advantages:**
- Mature sync infrastructure with years of optimization
- Proven conflict resolution at massive scale
- Sophisticated offline caching algorithms
- Strong cross-platform consistency

**Hearth Opportunities:**
- Modern sync algorithms and techniques
- Native performance advantages for caching
- Opportunity for better user control over sync
- Advanced conflict resolution UX

## Future Enhancements

**Post-MVP Features:**
- AI-powered cache optimization
- Cross-device clipboard synchronization
- Shared draft editing with real-time collaboration
- Advanced backup and restore capabilities
- Sync analytics and optimization recommendations
- End-to-end encrypted sync for private messages

---
**Last Updated:** March 24, 2026
**Next Review:** Weekly Infrastructure Review