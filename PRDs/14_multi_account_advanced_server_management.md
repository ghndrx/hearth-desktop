# PRD: Multi-Account and Advanced Server Management

## Overview

**Priority**: P1 (High)
**Timeline**: 8-10 weeks
**Owner**: Account Management Team

Implement comprehensive multi-account support and advanced server organization features to serve power users, community moderators, and professional users who manage multiple Discord communities, work accounts, and gaming groups.

## Problem Statement

Power users and community managers often need to access multiple Discord accounts and manage dozens of servers efficiently. Hearth Desktop currently lacks:

- Multi-account switching and simultaneous login support
- Advanced server organization with folders, categories, and custom sorting
- Server-specific settings and notification preferences
- Cross-account synchronization and unified interface
- Professional workspace management features
- Server discovery and invitation management systems

**Current Gap**: Discord's multi-account support is limited to web browser tabs or multiple app instances. Professional users resort to browser profiles or third-party tools. Hearth Desktop can provide superior native multi-account management with better performance and organization features.

## Success Metrics

- **Multi-Account Adoption**: 35% of users add a second account within 60 days
- **Server Organization**: 60% of users with 10+ servers use folder organization
- **Account Switching Speed**: <500ms average account switch time
- **Server Management Efficiency**: 40% reduction in time to find and access servers
- **Professional User Retention**: 85% retention rate for users with work/personal account separation
- **Cross-Account Feature Usage**: 50% of multi-account users use unified notifications

## User Stories

### Multi-Account Management
- **As a professional**, I want separate work and personal Discord accounts in one app
- **As a content creator**, I want to manage my streamer account and personal account simultaneously
- **As a community moderator**, I want to switch between mod accounts for different servers quickly

### Advanced Server Organization
- **As a power user**, I want to organize 50+ servers into logical folders and categories
- **As a gamer**, I want separate folders for different game communities and friend groups
- **As a professional**, I want work servers visually separated from personal servers

### Cross-Account Features
- **As a multi-account user**, I want unified notifications across all accounts
- **As a manager**, I want to see activity across work accounts in one dashboard
- **As a user**, I want consistent settings and preferences across accounts

## Technical Requirements

### Multi-Account Architecture
```rust
// Account management system
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserAccount {
    pub id: String,
    pub username: String,
    pub discriminator: String,
    pub avatar: Option<String>,
    pub email: String,
    pub token: String, // Encrypted at rest
    pub refresh_token: String,
    pub account_type: AccountType,
    pub status: UserStatus,
    pub settings: AccountSettings,
}

#[derive(Debug, Clone)]
pub enum AccountType {
    Personal,
    Work,
    Bot,
    Developer,
}

#[derive(Debug, Clone)]
pub struct AccountManager {
    active_account: Option<String>,
    accounts: HashMap<String, UserAccount>,
    session_tokens: HashMap<String, SessionToken>,
    account_profiles: HashMap<String, AccountProfile>,
}

#[tauri::command]
pub async fn add_account(token: String, account_type: AccountType) -> Result<UserAccount, String> {
    // OAuth flow for adding new account
    let account = authenticate_account(token).await?;
    store_account_securely(account.clone()).await?;
    Ok(account)
}

#[tauri::command]
pub async fn switch_account(account_id: String) -> Result<(), String> {
    // Switch active account context
    validate_account_token(&account_id).await?;
    update_active_account_context(account_id).await?;
    emit_account_switched_event().await?;
    Ok(())
}
```

### Advanced Server Organization
```typescript
interface ServerFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  servers: string[]; // Server IDs
  collapsed: boolean;
  sortOrder: number;
  accountId: string; // Account-specific folders
}

interface ServerCategory {
  id: string;
  name: string;
  description?: string;
  folders: ServerFolder[];
  servers: string[]; // Uncategorized servers
  accountId: string;
}

interface AdvancedServerManager {
  categories: ServerCategory[];
  folders: ServerFolder[];
  serverSettings: Map<string, ServerSpecificSettings>;
  quickAccess: string[]; // Pinned servers
  recentServers: string[];
  searchIndex: ServerSearchIndex;
}

interface ServerSpecificSettings {
  serverId: string;
  accountId: string;
  notifications: NotificationSettings;
  customName?: string;
  customIcon?: string;
  theme?: 'inherit' | 'light' | 'dark' | 'custom';
  soundPack?: string;
  autoJoinVoice?: boolean;
  defaultChannel?: string;
}
```

### Cross-Account Synchronization
```rust
#[derive(Debug)]
pub struct CrossAccountSync {
    sync_settings: bool,
    sync_themes: bool,
    sync_shortcuts: bool,
    sync_notifications: bool,
    primary_account: Option<String>,
}

#[tauri::command]
pub async fn sync_account_settings(
    from_account: String,
    to_accounts: Vec<String>,
    sync_config: CrossAccountSync,
) -> Result<(), String> {
    let source_settings = get_account_settings(&from_account).await?;

    for target_account in to_accounts {
        if sync_config.sync_settings {
            apply_settings_to_account(&target_account, &source_settings.general).await?;
        }
        if sync_config.sync_themes {
            apply_theme_to_account(&target_account, &source_settings.theme).await?;
        }
        // Additional sync operations...
    }

    Ok(())
}

pub struct UnifiedNotificationManager {
    account_notifications: HashMap<String, Vec<Notification>>,
    cross_account_rules: Vec<NotificationRule>,
    unified_queue: VecDeque<UnifiedNotification>,
}

#[derive(Debug)]
pub struct UnifiedNotification {
    pub id: String,
    pub account_id: String,
    pub server_id: String,
    pub channel_id: String,
    pub message: String,
    pub priority: NotificationPriority,
    pub timestamp: SystemTime,
    pub actions: Vec<NotificationAction>,
}
```

## User Interface Design

### Account Switcher Interface
```svelte
<script lang="ts">
  import { accountStore } from '$lib/stores/accounts';
  import { fade, fly } from 'svelte/transition';

  let showAccountSwitcher = false;
  let accounts = $accountStore.accounts;
  let activeAccount = $accountStore.activeAccount;

  async function switchAccount(accountId: string) {
    await invoke('switch_account', { accountId });
    showAccountSwitcher = false;
  }

  async function addAccount() {
    // Trigger OAuth flow for new account
    await invoke('start_account_oauth');
  }
</script>

<div class="account-switcher">
  <button
    class="active-account-btn"
    on:click={() => showAccountSwitcher = !showAccountSwitcher}
  >
    <Avatar src={activeAccount.avatar} size={32} />
    <span class="account-name">{activeAccount.username}</span>
    <ChevronDownIcon />
  </button>

  {#if showAccountSwitcher}
    <div class="account-dropdown" transition:fly={{ y: -10 }}>
      <div class="account-section">
        <h4>Switch Account</h4>
        {#each accounts as account (account.id)}
          <button
            class="account-option"
            class:active={account.id === activeAccount.id}
            on:click={() => switchAccount(account.id)}
          >
            <Avatar src={account.avatar} size={24} />
            <div class="account-info">
              <span class="username">{account.username}</span>
              <span class="account-type">{account.accountType}</span>
            </div>
            <StatusIndicator status={account.status} />
          </button>
        {/each}
      </div>

      <div class="account-actions">
        <button class="add-account-btn" on:click={addAccount}>
          <PlusIcon />
          Add Account
        </button>
        <button class="manage-accounts-btn">
          <SettingsIcon />
          Manage Accounts
        </button>
      </div>
    </div>
  {/if}
</div>
```

### Server Organization Interface
```svelte
<script lang="ts">
  import { serverStore } from '$lib/stores/servers';
  import { dndzone } from 'svelte-dnd-action';

  let serverFolders = $serverStore.folders;
  let isCreatingFolder = false;
  let newFolderName = '';

  function handleDndConsider(e: CustomEvent) {
    serverFolders = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent) {
    serverFolders = e.detail.items;
    // Save new folder order
    invoke('update_folder_order', { folders: serverFolders });
  }

  function createFolder() {
    invoke('create_server_folder', {
      name: newFolderName,
      accountId: $accountStore.activeAccount.id
    });
    isCreatingFolder = false;
    newFolderName = '';
  }
</script>

<div class="server-sidebar">
  <div class="account-header">
    <AccountSwitcher />
  </div>

  <div class="server-organization">
    <!-- Quick Access Servers -->
    <div class="quick-access">
      <h4>Quick Access</h4>
      {#each $serverStore.quickAccess as serverId (serverId)}
        <ServerIcon {serverId} pinned={true} />
      {/each}
    </div>

    <!-- Organized Folders -->
    <div
      class="folder-list"
      use:dndzone={{ items: serverFolders }}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
    >
      {#each serverFolders as folder (folder.id)}
        <ServerFolder {folder} />
      {/each}
    </div>

    <!-- Uncategorized Servers -->
    <div class="uncategorized-servers">
      <h4>Other Servers</h4>
      {#each $serverStore.uncategorized as serverId (serverId)}
        <ServerIcon {serverId} />
      {/each}
    </div>

    <!-- Create Folder Button -->
    {#if isCreatingFolder}
      <div class="create-folder-input">
        <input
          bind:value={newFolderName}
          placeholder="Folder name"
          on:keydown={(e) => e.key === 'Enter' && createFolder()}
        />
        <button on:click={createFolder}>Create</button>
        <button on:click={() => isCreatingFolder = false}>Cancel</button>
      </div>
    {:else}
      <button
        class="create-folder-btn"
        on:click={() => isCreatingFolder = true}
      >
        <FolderPlusIcon />
        Create Folder
      </button>
    {/if}
  </div>
</div>
```

### Unified Notifications Dashboard
```svelte
<script lang="ts">
  import { notificationStore } from '$lib/stores/notifications';
  import { accountStore } from '$lib/stores/accounts';

  let notifications = $notificationStore.unified;
  let selectedAccounts = new Set($accountStore.accounts.map(a => a.id));

  $: filteredNotifications = notifications.filter(n =>
    selectedAccounts.has(n.accountId)
  );

  function markAsRead(notificationId: string) {
    invoke('mark_notification_read', { notificationId });
  }

  function markAllRead(accountId?: string) {
    invoke('mark_all_notifications_read', { accountId });
  }
</script>

<div class="notifications-dashboard">
  <div class="notification-header">
    <h2>All Notifications</h2>
    <div class="account-filters">
      {#each $accountStore.accounts as account (account.id)}
        <label class="account-filter">
          <input
            type="checkbox"
            bind:group={selectedAccounts}
            value={account.id}
          />
          <Avatar src={account.avatar} size={16} />
          {account.username}
        </label>
      {/each}
    </div>
    <button on:click={() => markAllRead()}>Mark All Read</button>
  </div>

  <div class="notification-list">
    {#each filteredNotifications as notification (notification.id)}
      <div class="notification-item" class:unread={!notification.read}>
        <div class="notification-account">
          <Avatar src={notification.account.avatar} size={20} />
        </div>
        <div class="notification-content">
          <div class="notification-header">
            <span class="server-name">{notification.serverName}</span>
            <span class="channel-name">#{notification.channelName}</span>
            <span class="timestamp">{formatTime(notification.timestamp)}</span>
          </div>
          <div class="notification-message">
            {notification.message}
          </div>
        </div>
        <div class="notification-actions">
          <button on:click={() => markAsRead(notification.id)}>
            Mark Read
          </button>
          <button on:click={() => navigateToMessage(notification)}>
            Jump to Message
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
```

## Implementation Phases

### Phase 1: Multi-Account Foundation (3 weeks)
- OAuth integration for multiple account authentication
- Secure token storage and account management
- Basic account switching with context isolation
- Account profile management UI

### Phase 2: Server Organization System (2 weeks)
- Folder and category creation/management
- Drag-and-drop server organization
- Server-specific settings and customization
- Quick access and recent servers functionality

### Phase 3: Cross-Account Features (2 weeks)
- Unified notification system across accounts
- Settings synchronization between accounts
- Cross-account search and discovery
- Account-specific status and presence management

### Phase 4: Advanced Management Features (2-3 weeks)
- Professional workspace organization
- Bulk server management operations
- Advanced notification rules and filtering
- Server discovery and invitation management
- Analytics and usage insights per account

## Security and Privacy Considerations

### Token Security
```rust
use aes_gcm::{Aes256Gcm, Key, Nonce};
use keyring::Entry;

pub struct SecureTokenStorage {
    keyring: Entry,
    cipher: Aes256Gcm,
}

impl SecureTokenStorage {
    pub fn store_account_token(&self, account_id: &str, token: &str) -> Result<(), String> {
        let encrypted_token = self.encrypt_token(token)?;
        self.keyring.set_password(&encrypted_token)
            .map_err(|e| format!("Failed to store token: {}", e))?;
        Ok(())
    }

    pub fn retrieve_account_token(&self, account_id: &str) -> Result<String, String> {
        let encrypted_token = self.keyring.get_password()
            .map_err(|e| format!("Failed to retrieve token: {}", e))?;
        self.decrypt_token(&encrypted_token)
    }

    fn encrypt_token(&self, token: &str) -> Result<String, String> {
        // AES-256-GCM encryption implementation
        Ok(encrypted_token)
    }
}
```

### Account Isolation
- Complete session isolation between accounts
- Separate local storage and cache per account
- Account-specific network connections and WebSocket sessions
- Cross-account data sharing only with explicit user consent

### Privacy Controls
- Per-account privacy settings and data sharing preferences
- Optional cross-account analytics with full user control
- Account-specific logging and audit trails
- Secure account linking and unlinking processes

## Performance Optimization

### Memory Management
```rust
pub struct AccountContextManager {
    active_contexts: HashMap<String, AccountContext>,
    inactive_contexts: LruCache<String, SerializedAccountContext>,
    max_active_contexts: usize, // Default: 3
}

impl AccountContextManager {
    pub async fn switch_to_account(&mut self, account_id: String) -> Result<(), String> {
        // Serialize and cache current context if needed
        if self.active_contexts.len() >= self.max_active_contexts {
            let lru_account = self.find_least_recently_used()?;
            self.serialize_and_cache_context(lru_account).await?;
        }

        // Load target account context
        if let Some(cached_context) = self.inactive_contexts.get(&account_id) {
            self.deserialize_context(account_id, cached_context).await?;
        } else {
            self.load_fresh_context(account_id).await?;
        }

        Ok(())
    }
}
```

### Network Efficiency
- Shared connection pooling where appropriate
- Account-specific request queuing and rate limiting
- Optimized WebSocket management for multiple accounts
- Efficient caching strategies per account context

## Integration with Existing Systems

### Voice System Integration
```rust
pub struct MultiAccountVoiceManager {
    account_voice_states: HashMap<String, VoiceConnectionState>,
    active_voice_account: Option<String>,
}

impl MultiAccountVoiceManager {
    pub async fn join_voice_channel(
        &mut self,
        account_id: String,
        channel_id: String,
    ) -> Result<(), String> {
        // Disconnect from other account's voice if needed
        if let Some(current_account) = &self.active_voice_account {
            if *current_account != account_id {
                self.disconnect_voice(*current_account).await?;
            }
        }

        // Join voice on target account
        self.connect_voice(account_id, channel_id).await?;
        self.active_voice_account = Some(account_id);
        Ok(())
    }
}
```

### Message System Integration
- Account-specific message caching and synchronization
- Cross-account message search with privacy controls
- Unified message composition with account selection
- Account-specific message formatting and emoji preferences

## Success Metrics and Analytics

### Usage Analytics (Privacy-Respecting)
- Number of accounts per user (anonymized)
- Account switching frequency and patterns
- Server organization effectiveness metrics
- Cross-account feature adoption rates
- Performance impact measurements per account

### User Experience Metrics
- Account switching speed and success rates
- Server discovery and organization efficiency
- Notification management effectiveness
- Multi-account workflow productivity gains

## Competitive Advantages

### Over Discord
- **Native Multi-Account**: Superior to browser tab management
- **Advanced Organization**: More flexible than Discord's limited folder system
- **Performance**: Native app efficiency vs multiple Discord instances
- **Unified Experience**: Cross-account features Discord lacks

### Over Third-Party Solutions
- **Native Integration**: No browser extensions or external tools needed
- **Security**: Secure token storage vs browser-based solutions
- **Performance**: Single native app vs multiple processes
- **Feature Integration**: Deep integration with voice, notifications, and system features

## Future Roadmap

### Advanced Multi-Account Features (Post-Launch)
- AI-powered account switching based on context and usage patterns
- Enterprise account management with SSO integration
- Advanced analytics dashboard for community managers
- Cross-platform account synchronization
- API access for third-party account management tools
- Integration with external services (Slack, Teams, etc.)

This comprehensive multi-account and server management system positions Hearth Desktop as the premier native Discord alternative for power users, professionals, and community managers who need advanced organization and efficiency features.