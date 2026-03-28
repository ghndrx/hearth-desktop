# PRD: Advanced Moderation & Safety Tools

## Overview

**Priority**: P0 (Critical)
**Timeline**: 8-10 weeks
**Owner**: Safety & Moderation Team + Frontend

Implement comprehensive moderation and safety tools including auto-moderation, role-based permissions, audit logging, content filtering, and advanced reporting systems. This is critical for Hearth communities to scale safely and maintain healthy environments.

## Problem Statement

Hearth Desktop lacks essential moderation tools that Discord communities rely on:
- No auto-moderation for spam, harmful content, or rule violations
- Missing role-based permission systems for granular access control
- No audit logging for moderation actions and security events
- Inadequate reporting and appeals systems for user safety
- Lack of content filtering and safety warnings

Without these tools, Hearth communities cannot scale safely or compete with Discord for serious community building.

## Goals

### Primary Goals
- **Auto-moderation system** with configurable rules and ML-based detection
- **Role-based permissions** with granular channel and server access controls
- **Audit logging system** tracking all moderation and security events
- **Advanced reporting** with user appeals and moderator review workflows
- **Content filtering** with explicit content warnings and safety measures
- **Moderation dashboard** for streamlined community management

### Success Metrics
- 90% reduction in manual moderation actions via auto-mod
- Zero successful raids or spam attacks in protected servers
- 95% of reports resolved within 24 hours
- 80% user satisfaction with safety features (post-launch survey)
- 99.9% audit log reliability and completeness

## Technical Requirements

### Auto-Moderation System
```typescript
interface AutoModRule {
  id: string;
  serverId: string;
  name: string;
  type: AutoModType;
  triggers: AutoModTrigger[];
  actions: AutoModAction[];
  exemptRoles: string[];
  enabled: boolean;
}

enum AutoModType {
  Spam = 'spam',
  ExplicitContent = 'explicit_content',
  HateSpeech = 'hate_speech',
  ExternalLinks = 'external_links',
  ExcessiveMentions = 'excessive_mentions',
  CustomKeywords = 'custom_keywords'
}

enum AutoModAction {
  DeleteMessage = 'delete_message',
  TimeoutUser = 'timeout_user',
  KickUser = 'kick_user',
  BanUser = 'ban_user',
  AlertModerators = 'alert_moderators',
  LogToChannel = 'log_to_channel'
}
```

**Detection Methods**:
- ML-based content classification (hate speech, spam, explicit content)
- Keyword and regex pattern matching
- Rate limiting for messages, mentions, reactions
- Link and media scanning
- User behavior analysis (new account, suspicious activity)

### Role-Based Permission System
```typescript
interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  permissions: Permission[];
  position: number;
  mentionable: boolean;
  hoisted: boolean;
}

interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
  scope: PermissionScope;
}

enum PermissionResource {
  Server = 'server',
  Channel = 'channel',
  User = 'user',
  Message = 'message',
  Voice = 'voice'
}

enum PermissionAction {
  View = 'view',
  Send = 'send',
  Manage = 'manage',
  Delete = 'delete',
  Moderate = 'moderate'
}
```

**Granular Permissions**:
- Channel access (view, send messages, manage)
- Voice permissions (connect, speak, manage)
- Server management (kick, ban, manage roles)
- Content moderation (delete messages, timeout users)
- Administrative (manage server, audit logs)

### Audit Logging System
```typescript
interface AuditLog {
  id: string;
  serverId: string;
  actorId: string;
  targetId?: string;
  action: AuditAction;
  metadata: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

enum AuditAction {
  // User Actions
  UserBanned = 'user_banned',
  UserKicked = 'user_kicked',
  UserTimedOut = 'user_timed_out',

  // Content Actions
  MessageDeleted = 'message_deleted',
  ChannelCreated = 'channel_created',

  // Permission Changes
  RoleCreated = 'role_created',
  PermissionGranted = 'permission_granted',

  // Security Events
  LoginAttempt = 'login_attempt',
  PasswordChanged = 'password_changed'
}
```

### Advanced Reporting System
```typescript
interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string;
  evidence: ReportEvidence[];
  status: ReportStatus;
  assignedModerator?: string;
  resolution?: ReportResolution;
}

enum ReportReason {
  Harassment = 'harassment',
  HateSpeech = 'hate_speech',
  Spam = 'spam',
  ExplicitContent = 'explicit_content',
  ImpersonationScheme = 'impersonation',
  SelfHarm = 'self_harm',
  Other = 'other'
}

interface ReportEvidence {
  type: 'message' | 'image' | 'voice_clip';
  content: string;
  timestamp: string;
  contextMessages?: string[];
}
```

### Content Filtering & Safety
```typescript
interface ContentFilter {
  explicitImages: boolean;
  explicitText: boolean;
  externalLinks: boolean;
  fileAttachments: boolean;
  voiceRecordings: boolean;
  exemptRoles: string[];
}

interface SafetyWarning {
  type: SafetyWarningType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  showAlways: boolean;
}
```

## User Experience

### Moderation Dashboard
- **Overview**: Server health metrics, recent reports, auto-mod activity
- **Reports Queue**: Pending reports with priority sorting and batch actions
- **Audit Log Viewer**: Searchable/filterable history with export capabilities
- **Auto-Mod Config**: Rule builder UI with test/preview functionality
- **Role Manager**: Visual permission matrix with inheritance display

### Safety Features
- **Content Warnings**: Blur explicit images with click-to-reveal
- **Safe Mode**: Enhanced filtering for users under 18
- **Block & Report**: One-click blocking with integrated reporting
- **Appeal System**: Users can appeal moderation decisions with evidence

### Default Safety Settings
```
Auto-Mod: Enabled for spam and explicit content
Content Filter: Medium sensitivity
Audit Logging: All moderation actions
Reports: Auto-assign to online moderators
Safety Warnings: Show for all potentially harmful content
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-3)
- Build role and permission system
- Implement basic audit logging
- Create moderation database schemas

### Phase 2: Auto-Moderation (Week 4-6)
- Develop ML content classification pipeline
- Build rule engine for auto-mod triggers
- Implement moderation actions (timeout, ban, delete)

### Phase 3: Reporting & Safety (Week 7-8)
- Create advanced reporting system with evidence collection
- Build content filtering and safety warnings
- Implement user appeals workflow

### Phase 4: Dashboard & Polish (Week 9-10)
- Build comprehensive moderation dashboard
- Add analytics and insights for moderators
- Polish UX and conduct user testing

## Dependencies

- **ML Pipeline**: Content classification models (hate speech, explicit content)
- **Backend Services**: Audit log storage, report processing, role management
- **Security Infrastructure**: Rate limiting, IP tracking, ban management
- **Legal Compliance**: GDPR/privacy law compliance for user data

## Risk Mitigation

### Technical Risks
- **False positives**: Comprehensive testing and human review workflows
- **Performance impact**: Efficient ML inference and database optimization
- **Bypass attempts**: Multi-layered detection and continuous model updates

### Legal Considerations
- **Content liability**: Clear community guidelines and ToS
- **Privacy compliance**: Audit log retention policies and user consent
- **Appeal rights**: Fair process for content moderation decisions

### Community Impact
- **Over-moderation**: Granular controls and transparency tools
- **Moderator burnout**: Automation and streamlined workflows
- **False accusations**: Evidence requirements and appeal processes

## Competitive Analysis

**Discord Advantages**:
- 8+ years of moderation system refinement
- Advanced ML models trained on billions of messages
- Extensive third-party bot ecosystem

**Hearth Advantages**:
- Modern architecture allows for innovative safety features
- Clean, intuitive moderation interface
- Built-in analytics and insights from day one
- Streamlined appeal and resolution workflows

## Success Criteria
- Auto-moderation successfully prevents 90% of rule violations
- Moderators can handle 3x more servers with same effort
- User reports resolved quickly and fairly
- Safe environment for all users including minors
- Transparent moderation with clear appeals process