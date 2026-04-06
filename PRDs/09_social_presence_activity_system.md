# PRD-09: Social Presence & Activity System

**Created:** 2026-04-06  
**Status:** Draft  
**Priority:** P1 - High  
**Target Release:** Q3 2026  
**Owner:** Social Features Team  

## Executive Summary

Implement comprehensive social presence and activity tracking system to match Discord's social engagement features while providing unique privacy-focused and self-hosted advantages.

**Business Impact:**
- **User Engagement:** Rich presence increases daily active users by 30-45%
- **Social Network Effects:** Activity feeds drive friend connections and server growth
- **Competitive Parity:** Matches Discord's core social features that drive retention
- **Community Building:** Enhanced social features strengthen server communities

## Problem Statement

Current Hearth Desktop lacks sophisticated social features that modern chat users expect:

**Missing Social Features:**
- Basic presence only (online/offline) without rich status
- No activity tracking or sharing capabilities  
- Limited friend interaction and discovery features
- No social feeds or activity timelines
- Missing game/application integration for shared experiences

**User Pain Points:**
1. **Social Isolation:** Friends can't see what users are doing or how to engage
2. **Discovery Problems:** Hard to find common interests or activities with other users
3. **Community Disconnect:** No shared activities or events to build community
4. **Status Limitation:** Can't express current mood, activity, or availability
5. **Engagement Drops:** Less reason to stay connected when not actively chatting

## Success Metrics

### Primary KPIs
- **Rich Presence Adoption:** 70% of users set custom status within first week
- **Activity Engagement:** 45% of users interact with friend activity feeds daily
- **Social Connections:** 25% increase in friend requests and connections
- **Session Stickiness:** 35% increase in time spent browsing vs. just chatting

### Social Metrics
- **Status Update Frequency:** Average 2.5 status changes per user per day
- **Activity Feed Engagement:** 60% of users check friend activities daily
- **Cross-Server Discovery:** 40% of new server joins from friend activity
- **Community Events:** 30% of servers host regular social events

### Business Metrics
- **User Retention:** 20% improvement in 30-day retention
- **Network Growth:** 15% increase in friend connections per user
- **Server Growth:** 25% increase in server membership through social discovery

## Target Personas

### Primary: Social Community Members
- Active in 3-5 servers with overlapping friend groups
- Share interests in gaming, streaming, or creative activities
- Value social connection and community building
- Want to discover new content and activities through friends

### Secondary: Content Creators & Influencers  
- Build audience through activity sharing
- Need rich presence for brand/content promotion
- Value activity analytics and community insights
- Want tools for audience engagement and growth

### Tertiary: Professional Teams
- Need presence awareness for team coordination
- Share work-related activities and availability
- Value integrated workflow status and project updates
- Need privacy controls for professional vs. personal sharing

## Technical Requirements

### Rich Presence System

#### Advanced Status Management
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RichPresence {
    pub user_id: UserId,
    pub status: PresenceStatus,
    pub custom_status: Option<CustomStatus>,
    pub activity: Option<Activity>,
    pub timestamps: PresenceTimestamps,
    pub privacy_level: PrivacyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PresenceStatus {
    Online,
    Idle,
    DoNotDisturb,
    Invisible,
    Custom(String),  // "In a meeting", "Streaming", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomStatus {
    pub emoji: Option<String>,
    pub text: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub auto_clear_on: Vec<AutoClearTrigger>,
}

#[derive(Debug)]
pub enum AutoClearTrigger {
    AfterTime(Duration),
    OnStatusChange(PresenceStatus),
    OnActivity(ActivityType),
    OnKeyboardInput,
    OnApplicationFocus(String),
}

// Rich activity detection and display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub activity_type: ActivityType,
    pub name: String,
    pub details: Option<String>,
    pub state: Option<String>,
    pub timestamps: Option<ActivityTimestamps>,
    pub assets: Option<ActivityAssets>,
    pub party: Option<ActivityParty>,
    pub secrets: Option<ActivitySecrets>,
    pub instance: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityType {
    Playing,         // Games and applications
    Streaming,       // Live streaming
    Listening,       // Music, podcasts
    Watching,        // Videos, streams
    Competing,       // Competitive games
    Creating,        // Art, coding, writing
    Learning,        // Tutorials, courses
    Working,         // Professional activities
    Custom(String),  // User-defined activities
}
```

#### Smart Activity Detection
```rust
pub struct ActivityDetector {
    detectors: Vec<Box<dyn ActivityDetectorTrait>>,
    user_preferences: ActivityPreferences,
    privacy_filter: PrivacyFilter,
}

impl ActivityDetector {
    // Multi-source activity detection
    pub async fn detect_current_activity(&self) -> Option<Activity> {
        let mut detected_activities = Vec::new();
        
        // Process detection
        if let Some(process_activity) = self.detect_from_processes().await {
            detected_activities.push(process_activity);
        }
        
        // Media detection (Spotify, browser tabs, etc.)
        if let Some(media_activity) = self.detect_media_activity().await {
            detected_activities.push(media_activity);
        }
        
        // System status (screensaver, locked, presenting)
        if let Some(system_activity) = self.detect_system_state().await {
            detected_activities.push(system_activity);
        }
        
        // Calendar integration
        if let Some(calendar_activity) = self.detect_calendar_activity().await {
            detected_activities.push(calendar_activity);
        }
        
        // Prioritize and select best activity
        self.select_primary_activity(detected_activities)
    }
    
    // Game-specific rich presence
    pub async fn detect_game_activity(&self, process_name: &str) -> Option<Activity> {
        match self.get_game_integration(process_name) {
            Some(integration) => {
                // Rich presence from game API
                integration.get_rich_presence().await
            },
            None => {
                // Generic game detection
                Some(Activity {
                    activity_type: ActivityType::Playing,
                    name: self.get_friendly_name(process_name),
                    details: None,
                    state: None,
                    timestamps: Some(ActivityTimestamps::now()),
                    ..Default::default()
                })
            }
        }
    }
}

// Privacy-aware activity sharing
pub struct PrivacyFilter {
    user_settings: PrivacySettings,
    blocked_applications: HashSet<String>,
    time_restrictions: HashMap<TimeRange, PrivacyLevel>,
}

impl PrivacyFilter {
    pub fn should_share_activity(&self, activity: &Activity) -> bool {
        // Check application blocklist
        if self.blocked_applications.contains(&activity.name) {
            return false;
        }
        
        // Check time-based restrictions
        if let Some(restriction) = self.get_current_time_restriction() {
            return restriction.allows_activity_sharing();
        }
        
        // Check activity type preferences
        self.user_settings.activity_sharing.get(&activity.activity_type)
            .unwrap_or(&true)
    }
}
```

### Social Activity Feed System

#### Activity Feed Architecture
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityFeed {
    pub user_id: UserId,
    pub activities: Vec<ActivityEvent>,
    pub last_updated: DateTime<Utc>,
    pub privacy_scope: FeedPrivacyScope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: ActivityEventId,
    pub user_id: UserId,
    pub event_type: ActivityEventType,
    pub activity: Activity,
    pub timestamp: DateTime<Utc>,
    pub context: ActivityContext,
    pub interactions: ActivityInteractions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityEventType {
    Started(Activity),           // Started playing/watching/listening
    Achievement(Achievement),    // Game achievement, milestone reached
    Joined(CommunityEvent),      // Joined voice chat, server event
    Created(CreatedContent),     // Shared art, code, music
    Completed(Accomplishment),   // Finished game, project, course
    Milestone(Milestone),        // Anniversaries, streaks, levels
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityInteractions {
    pub likes: u32,
    pub comments: Vec<ActivityComment>,
    pub shares: u32,
    pub reactions: HashMap<String, u32>,  // emoji -> count
}

// Intelligent feed curation
pub struct FeedCurator {
    user_preferences: FeedPreferences,
    friend_graph: FriendGraph,
    engagement_history: EngagementHistory,
}

impl FeedCurator {
    // Curate personalized activity feed
    pub async fn curate_feed(&self, user_id: UserId, limit: usize) -> Vec<ActivityEvent> {
        let mut candidates = self.get_activity_candidates(user_id).await;
        
        // Score activities based on relevance
        for activity in &mut candidates {
            activity.relevance_score = self.calculate_relevance_score(user_id, activity);
        }
        
        // Filter and sort by relevance
        candidates.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        candidates.into_iter().take(limit).collect()
    }
    
    fn calculate_relevance_score(&self, user_id: UserId, event: &ActivityEvent) -> f32 {
        let mut score = 0.0;
        
        // Friend closeness (mutual friends, interaction frequency)
        score += self.friend_graph.get_closeness(user_id, event.user_id) * 30.0;
        
        // Shared interests (similar games, activities)
        score += self.calculate_interest_overlap(user_id, event) * 25.0;
        
        // Recency (newer activities score higher)
        let hours_ago = (Utc::now() - event.timestamp).num_hours() as f32;
        score += (24.0 - hours_ago.min(24.0)) * 2.0;
        
        // Activity type preference
        score += self.get_activity_type_preference(user_id, &event.event_type) * 15.0;
        
        // Social proof (likes, comments from mutual friends)
        score += self.calculate_social_proof(user_id, event) * 10.0;
        
        score
    }
}
```

### Friend Activity & Discovery

#### Enhanced Friend System
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Friend {
    pub user_id: UserId,
    pub friendship_status: FriendshipStatus,
    pub relationship_type: RelationshipType,
    pub shared_servers: Vec<ServerId>,
    pub activity_visibility: ActivityVisibility,
    pub notification_preferences: FriendNotificationPreferences,
    pub friendship_metadata: FriendshipMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    Friend,
    BestFriend,
    Acquaintance,
    Teammate,
    Family,
    Blocked,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendshipMetadata {
    pub friendship_date: DateTime<Utc>,
    pub shared_activities: Vec<ActivityType>,
    pub interaction_frequency: InteractionLevel,
    pub mutual_friends: Vec<UserId>,
    pub activity_streak: Option<ActivityStreak>,
}

// Friend activity notifications and suggestions
pub struct FriendActivityManager {
    notification_service: NotificationService,
    suggestion_engine: ActivitySuggestionEngine,
}

impl FriendActivityManager {
    // Suggest activities based on friend behavior
    pub async fn suggest_activities(&self, user_id: UserId) -> Vec<ActivitySuggestion> {
        let friends = self.get_user_friends(user_id).await;
        let mut suggestions = Vec::new();
        
        // Friends playing similar games
        let game_suggestions = self.suggest_games_from_friends(&friends).await;
        suggestions.extend(game_suggestions);
        
        // Popular activities in shared servers
        let server_suggestions = self.suggest_server_activities(user_id, &friends).await;
        suggestions.extend(server_suggestions);
        
        // Trending activities among friend network
        let trending_suggestions = self.suggest_trending_activities(&friends).await;
        suggestions.extend(trending_suggestions);
        
        suggestions.sort_by_key(|s| s.relevance_score);
        suggestions
    }
    
    // Smart friend activity notifications
    pub async fn process_friend_activity(&self, event: ActivityEvent) -> Result<()> {
        let friends = self.get_friends_of_user(event.user_id).await;
        
        for friend in friends {
            if self.should_notify_friend(friend.user_id, &event).await {
                self.send_activity_notification(friend.user_id, &event).await?;
            }
        }
        
        Ok(())
    }
    
    async fn should_notify_friend(&self, friend_id: UserId, event: &ActivityEvent) -> bool {
        // Check notification preferences
        let prefs = self.get_friend_notification_preferences(friend_id, event.user_id).await;
        if !prefs.activity_notifications_enabled {
            return false;
        }
        
        // Check activity type preferences
        if !prefs.notify_for_activity_type(&event.event_type) {
            return false;
        }
        
        // Check if friend is currently active
        let friend_presence = self.get_user_presence(friend_id).await;
        if matches!(friend_presence.status, PresenceStatus::DoNotDisturb | PresenceStatus::Invisible) {
            return false;
        }
        
        // Rate limiting to prevent spam
        if self.has_recent_notification(friend_id, event.user_id).await {
            return false;
        }
        
        true
    }
}
```

### Community Events & Social Features

#### Server Social Events
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialEvent {
    pub id: EventId,
    pub server_id: ServerId,
    pub creator_id: UserId,
    pub event_type: EventType,
    pub title: String,
    pub description: Option<String>,
    pub scheduled_time: DateTime<Utc>,
    pub duration: Option<Duration>,
    pub location: EventLocation,
    pub attendees: Vec<EventAttendee>,
    pub max_attendees: Option<u32>,
    pub privacy: EventPrivacy,
    pub activities: Vec<EventActivity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    VoiceHangout,
    GameNight { games: Vec<String> },
    MovieWatch { movie: String, streaming_service: Option<String> },
    StudySession { subject: String, voice_channel: ChannelId },
    CreativeStream { activity: CreativeActivity },
    Tournament { game: String, bracket_type: BracketType },
    Celebration { occasion: String },
    Custom { category: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventAttendee {
    pub user_id: UserId,
    pub rsvp_status: RsvpStatus,
    pub rsvp_time: DateTime<Utc>,
    pub role: EventRole,
    pub notifications_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RsvpStatus {
    Going,
    Maybe,
    NotGoing,
    Invited,
}

// Event recommendation engine
pub struct EventRecommendationEngine {
    user_history: HashMap<UserId, UserEventHistory>,
    server_analytics: HashMap<ServerId, ServerEventAnalytics>,
}

impl EventRecommendationEngine {
    pub async fn recommend_events(&self, user_id: UserId) -> Vec<EventRecommendation> {
        let user_history = self.user_history.get(&user_id).unwrap_or_default();
        let user_interests = self.extract_user_interests(&user_history);
        
        let mut recommendations = Vec::new();
        
        // Events from user's servers
        for server_id in self.get_user_servers(user_id).await {
            let server_events = self.get_upcoming_server_events(server_id).await;
            for event in server_events {
                if self.matches_user_interests(&event, &user_interests) {
                    recommendations.push(EventRecommendation::from_event(event));
                }
            }
        }
        
        // Friend events user might be interested in
        let friend_events = self.get_friend_events(user_id).await;
        recommendations.extend(friend_events);
        
        // Suggested new events to create
        let creation_suggestions = self.suggest_event_creation(user_id, &user_interests).await;
        recommendations.extend(creation_suggestions);
        
        recommendations.sort_by_key(|r| r.relevance_score);
        recommendations
    }
}
```

### Privacy & Control System

#### Granular Privacy Controls
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialPrivacySettings {
    pub activity_sharing: ActivitySharingSettings,
    pub presence_visibility: PresenceVisibilitySettings,  
    pub friend_discovery: FriendDiscoverySettings,
    pub event_participation: EventParticipationSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivitySharingSettings {
    pub default_share_level: ShareLevel,
    pub activity_type_overrides: HashMap<ActivityType, ShareLevel>,
    pub application_overrides: HashMap<String, ShareLevel>,
    pub time_based_restrictions: Vec<TimeBasedRestriction>,
    pub server_specific_settings: HashMap<ServerId, ShareLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShareLevel {
    Public,           // All friends can see
    Friends,          // Only friends can see
    BestFriends,      // Only best friends can see  
    ServerMembers,    // Only shared server members can see
    Nobody,           // Private, no sharing
    Custom(Vec<UserId>), // Specific users only
}

// Privacy-preserving analytics
pub struct PrivacyPreservingAnalytics {
    aggregation_engine: AggregationEngine,
    anonymization_pipeline: AnonymizationPipeline,
}

impl PrivacyPreservingAnalytics {
    // Generate insights without exposing individual data
    pub async fn generate_community_insights(&self, server_id: ServerId) -> CommunityInsights {
        let raw_data = self.collect_anonymized_data(server_id).await;
        let aggregated = self.aggregation_engine.process(raw_data);
        
        CommunityInsights {
            popular_activities: aggregated.top_activities,
            peak_activity_times: aggregated.activity_patterns,
            community_interests: aggregated.interest_clusters,
            growth_metrics: aggregated.growth_trends,
            // No individual user data exposed
        }
    }
}
```

## Implementation Plan

### Phase 1: Rich Presence Foundation (Weeks 1-3)

#### Sprint 1: Core Presence System
- [ ] Enhanced presence status with custom messages
- [ ] Activity detection framework
- [ ] Basic game/application detection
- [ ] Privacy controls for activity sharing

#### Sprint 2: Activity Detection
- [ ] Process-based activity detection
- [ ] Media player integration (Spotify, browser)
- [ ] Calendar integration for meeting status
- [ ] Smart activity prioritization

#### Sprint 3: Social Status Features
- [ ] Custom status with emoji and expiration
- [ ] Auto-clear triggers for status
- [ ] Activity history and trends
- [ ] Cross-platform activity sync

### Phase 2: Social Activity Feed (Weeks 4-6)

#### Sprint 4: Activity Feed Core
- [ ] Activity event data model
- [ ] Feed generation and curation
- [ ] Activity interaction system (likes, comments)
- [ ] Friend activity notifications

#### Sprint 5: Discovery & Recommendations
- [ ] Friend activity suggestion engine
- [ ] Shared interest discovery
- [ ] Activity-based friend recommendations
- [ ] Cross-server activity discovery

#### Sprint 6: Social Engagement
- [ ] Activity reactions and comments
- [ ] Activity sharing and forwards
- [ ] Friend activity notifications
- [ ] Social proof and trending activities

### Phase 3: Community Events (Weeks 7-9)

#### Sprint 7: Event System Core
- [ ] Social event creation and management
- [ ] RSVP system with notifications
- [ ] Event types and templates
- [ ] Event discovery and search

#### Sprint 8: Event Features
- [ ] Event recommendation engine
- [ ] Recurring events and series
- [ ] Event integration with voice channels
- [ ] Cross-server event promotion

#### Sprint 9: Advanced Social Features
- [ ] Community challenges and achievements
- [ ] Social activity streaks and milestones
- [ ] Friend group management
- [ ] Social analytics and insights

### Phase 4: Polish & Integration (Weeks 10-12)

#### Sprint 10: Performance & Privacy
- [ ] Privacy-preserving analytics
- [ ] Performance optimization for social features
- [ ] Data retention and cleanup policies
- [ ] Advanced privacy controls

#### Sprint 11: Platform Integration
- [ ] Rich presence in system tray
- [ ] Platform-specific social features
- [ ] Third-party integration APIs
- [ ] Social widget for websites

#### Sprint 12: Launch Preparation
- [ ] User onboarding for social features
- [ ] Community management tools
- [ ] Analytics dashboard for server owners
- [ ] Beta testing and feedback integration

## User Experience Design

### Rich Presence Display
```
User Profile Card:
┌─────────────────────────────────┐
│ 👤 Alice Johnson              │
│ 🎮 Playing Rocket League       │
│ 🏆 Ranked Match - Diamond II   │ 
│ ⏱️ 23 minutes                  │
│ 💬 "Anyone want to queue up?"  │
│ ──────────────────────────────  │
│ 🟢 Online • 🎧 In Voice       │
└─────────────────────────────────┘
```

### Activity Feed Interface
```
Friend Activity Feed:
┌─────────────────────────────────┐
│ 🎮 Bob started playing CS2      │
│    "New operation is live!"     │
│    👍 3  💬 1  🔄 Share        │
│ ──────────────────────────────  │
│ 🎵 Carol is listening to        │
│    "Bohemian Rhapsody" - Queen  │
│    ❤️ 5  💬 2                  │
│ ──────────────────────────────  │
│ 🎉 Dave achieved Level 50!      │
│    In World of Warcraft         │
│    🎊 8  💬 4  🔄 Share        │
└─────────────────────────────────┘
```

### Event Creation Flow
```
Create Event Wizard:
Step 1: Event Type
[🎮 Game Night] [🎬 Movie Watch] [🎤 Hangout]
[🎨 Creative] [📚 Study] [🏆 Tournament] [✨ Custom]

Step 2: Details
Event Name: [Spring Tournament     ]
Date & Time: [2026-04-15] [7:00 PM]
Duration: [2 hours]
Max Attendees: [16]

Step 3: Location  
Voice Channel: [#general-voice ▼]
Game/Activity: [Rocket League  ▼]
Additional Notes: [Bring your A-game!]

[Create Event] [Save as Template]
```

## Competitive Analysis

### Discord Advantages
- Mature Rich Presence API with 500+ game integrations
- Large existing social network effect
- Established activity sharing patterns
- Advanced game streaming integration

### Hearth Opportunities
- **Privacy-First:** Local activity processing, no tracking
- **Self-Hosted:** Complete user control over social data
- **Customization:** Open source allows community extensions
- **Professional Focus:** Better privacy controls for work contexts

### Feature Parity Goals
- ✅ **Rich Presence:** Custom status, activity detection, game integration
- ✅ **Activity Feeds:** Friend activity timeline with interactions
- ✅ **Social Events:** Community event creation and management
- 🎯 **Enhanced Privacy:** Granular sharing controls Discord lacks
- 🎯 **Professional Mode:** Work-appropriate social features

## Success Criteria

### MVP Success Criteria
- [ ] 70% of active users set custom presence within first week
- [ ] 45% daily engagement with friend activity feeds
- [ ] 30% of servers create social events monthly
- [ ] <100ms latency for presence updates
- [ ] 95% user satisfaction with privacy controls

### Full Success Criteria
- [ ] 85% adoption of rich presence features
- [ ] 60% daily activity feed engagement
- [ ] 50% of servers host regular events
- [ ] 25% increase in friend connections per user
- [ ] Industry-leading privacy controls for social features

This comprehensive social presence and activity system will create a vibrant, engaging community experience while maintaining Hearth's privacy-first philosophy and providing unique advantages over Discord's approach.