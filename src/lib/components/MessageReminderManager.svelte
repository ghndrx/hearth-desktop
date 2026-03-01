<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

  const dispatch = createEventDispatcher();

  interface Reminder {
    id: string;
    messageId: string;
    messageContent: string;
    channelId: string;
    channelName: string;
    serverId?: string;
    serverName?: string;
    authorName: string;
    authorAvatar?: string;
    reminderTime: number;
    createdAt: number;
    note?: string;
    recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
    snoozedCount: number;
    status: 'pending' | 'triggered' | 'snoozed' | 'dismissed';
  }

  interface QuickTime {
    label: string;
    minutes: number;
    icon: string;
  }

  // Props
  export let isOpen = false;
  export let messageId: string = '';
  export let messageContent: string = '';
  export let channelId: string = '';
  export let channelName: string = '';
  export let serverId: string = '';
  export let serverName: string = '';
  export let authorName: string = '';
  export let authorAvatar: string = '';

  // State
  let reminders: Reminder[] = [];
  let activeTab: 'create' | 'list' | 'history' = 'create';
  let selectedQuickTime: QuickTime | null = null;
  let customDateTime = '';
  let reminderNote = '';
  let recurringOption: 'none' | 'daily' | 'weekly' | 'monthly' = 'none';
  let searchQuery = '';
  let filterStatus: 'all' | 'pending' | 'triggered' | 'snoozed' = 'all';
  let sortBy: 'time' | 'created' | 'channel' = 'time';
  let showConfirmDelete = false;
  let reminderToDelete: string | null = null;
  let checkInterval: ReturnType<typeof setInterval> | null = null;

  const quickTimes: QuickTime[] = [
    { label: 'In 20 min', minutes: 20, icon: '⏰' },
    { label: 'In 1 hour', minutes: 60, icon: '🕐' },
    { label: 'In 3 hours', minutes: 180, icon: '🕒' },
    { label: 'Tomorrow 9 AM', minutes: -1, icon: '🌅' },
    { label: 'Tomorrow 6 PM', minutes: -2, icon: '🌆' },
    { label: 'Next Monday 9 AM', minutes: -3, icon: '📅' },
    { label: 'Custom...', minutes: 0, icon: '📆' },
  ];

  const snoozeOptions = [
    { label: '5 minutes', minutes: 5 },
    { label: '15 minutes', minutes: 15 },
    { label: '30 minutes', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '3 hours', minutes: 180 },
    { label: 'Tomorrow', minutes: 1440 },
  ];

  // Computed values
  $: filteredReminders = reminders
    .filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          r.messageContent.toLowerCase().includes(query) ||
          r.channelName.toLowerCase().includes(query) ||
          r.authorName.toLowerCase().includes(query) ||
          (r.note && r.note.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'time':
          return a.reminderTime - b.reminderTime;
        case 'created':
          return b.createdAt - a.createdAt;
        case 'channel':
          return a.channelName.localeCompare(b.channelName);
        default:
          return 0;
      }
    });

  $: pendingCount = reminders.filter(r => r.status === 'pending').length;
  $: snoozedCount = reminders.filter(r => r.status === 'snoozed').length;
  $: historyCount = reminders.filter(r => r.status === 'triggered' || r.status === 'dismissed').length;

  onMount(async () => {
    await loadReminders();
    startReminderChecker();
    
    // Set default custom date/time to 1 hour from now
    const now = new Date();
    now.setHours(now.getHours() + 1);
    customDateTime = formatDateTimeLocal(now);
  });

  onDestroy(() => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
  });

  function formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function calculateReminderTime(quickTime: QuickTime): number {
    const now = new Date();
    
    if (quickTime.minutes > 0) {
      return now.getTime() + quickTime.minutes * 60 * 1000;
    }
    
    switch (quickTime.minutes) {
      case -1: // Tomorrow 9 AM
        const tomorrow9am = new Date(now);
        tomorrow9am.setDate(tomorrow9am.getDate() + 1);
        tomorrow9am.setHours(9, 0, 0, 0);
        return tomorrow9am.getTime();
      
      case -2: // Tomorrow 6 PM
        const tomorrow6pm = new Date(now);
        tomorrow6pm.setDate(tomorrow6pm.getDate() + 1);
        tomorrow6pm.setHours(18, 0, 0, 0);
        return tomorrow6pm.getTime();
      
      case -3: // Next Monday 9 AM
        const nextMonday = new Date(now);
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
        nextMonday.setHours(9, 0, 0, 0);
        return nextMonday.getTime();
      
      default:
        return now.getTime();
    }
  }

  async function loadReminders() {
    try {
      const stored = localStorage.getItem('hearth_message_reminders');
      if (stored) {
        reminders = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
      reminders = [];
    }
  }

  async function saveReminders() {
    try {
      localStorage.setItem('hearth_message_reminders', JSON.stringify(reminders));
    } catch (error) {
      console.error('Failed to save reminders:', error);
    }
  }

  function startReminderChecker() {
    checkInterval = setInterval(async () => {
      const now = Date.now();
      let hasChanges = false;

      for (const reminder of reminders) {
        if ((reminder.status === 'pending' || reminder.status === 'snoozed') && reminder.reminderTime <= now) {
          await triggerReminder(reminder);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await saveReminders();
      }
    }, 10000); // Check every 10 seconds
  }

  async function triggerReminder(reminder: Reminder) {
    reminder.status = 'triggered';

    // Send native notification
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        sendNotification({
          title: `⏰ Reminder: ${reminder.channelName}`,
          body: `${reminder.authorName}: ${reminder.messageContent.slice(0, 100)}${reminder.messageContent.length > 100 ? '...' : ''}`,
        });
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    // Handle recurring reminders
    if (reminder.recurring && reminder.recurring !== 'none') {
      const newReminder = { ...reminder };
      newReminder.id = generateId();
      newReminder.status = 'pending';
      newReminder.createdAt = Date.now();
      newReminder.snoozedCount = 0;

      switch (reminder.recurring) {
        case 'daily':
          newReminder.reminderTime = reminder.reminderTime + 24 * 60 * 60 * 1000;
          break;
        case 'weekly':
          newReminder.reminderTime = reminder.reminderTime + 7 * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          const nextDate = new Date(reminder.reminderTime);
          nextDate.setMonth(nextDate.getMonth() + 1);
          newReminder.reminderTime = nextDate.getTime();
          break;
      }

      reminders = [...reminders, newReminder];
    }

    dispatch('reminderTriggered', { reminder });
  }

  function generateId(): string {
    return `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async function createReminder() {
    if (!selectedQuickTime && !customDateTime) return;

    let reminderTime: number;
    
    if (selectedQuickTime && selectedQuickTime.minutes !== 0) {
      reminderTime = calculateReminderTime(selectedQuickTime);
    } else if (customDateTime) {
      reminderTime = new Date(customDateTime).getTime();
    } else {
      return;
    }

    const newReminder: Reminder = {
      id: generateId(),
      messageId,
      messageContent,
      channelId,
      channelName,
      serverId,
      serverName,
      authorName,
      authorAvatar,
      reminderTime,
      createdAt: Date.now(),
      note: reminderNote || undefined,
      recurring: recurringOption,
      snoozedCount: 0,
      status: 'pending',
    };

    reminders = [...reminders, newReminder];
    await saveReminders();

    // Reset form
    selectedQuickTime = null;
    reminderNote = '';
    recurringOption = 'none';

    dispatch('reminderCreated', { reminder: newReminder });
    
    // Switch to list view
    activeTab = 'list';
  }

  async function snoozeReminder(reminderId: string, minutes: number) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    reminder.reminderTime = Date.now() + minutes * 60 * 1000;
    reminder.status = 'snoozed';
    reminder.snoozedCount++;

    reminders = [...reminders];
    await saveReminders();

    dispatch('reminderSnoozed', { reminder, minutes });
  }

  async function dismissReminder(reminderId: string) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    reminder.status = 'dismissed';
    reminders = [...reminders];
    await saveReminders();

    dispatch('reminderDismissed', { reminder });
  }

  function confirmDelete(reminderId: string) {
    reminderToDelete = reminderId;
    showConfirmDelete = true;
  }

  async function deleteReminder() {
    if (!reminderToDelete) return;

    const deleted = reminders.find(r => r.id === reminderToDelete);
    reminders = reminders.filter(r => r.id !== reminderToDelete);
    await saveReminders();

    showConfirmDelete = false;
    reminderToDelete = null;

    if (deleted) {
      dispatch('reminderDeleted', { reminder: deleted });
    }
  }

  async function clearHistory() {
    reminders = reminders.filter(r => r.status === 'pending' || r.status === 'snoozed');
    await saveReminders();
  }

  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (absDiff < 60000) return 'Just now';
      if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}m ago`;
      if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}h ago`;
      return `${Math.floor(absDiff / 86400000)}d ago`;
    }

    if (diff < 60000) return 'In <1 min';
    if (diff < 3600000) return `In ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `In ${Math.floor(diff / 3600000)} hours`;
    return `In ${Math.floor(diff / 86400000)} days`;
  }

  function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function selectQuickTime(qt: QuickTime) {
    if (qt.minutes === 0) {
      selectedQuickTime = qt;
    } else {
      selectedQuickTime = qt;
    }
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  function goToMessage(reminder: Reminder) {
    dispatch('goToMessage', {
      messageId: reminder.messageId,
      channelId: reminder.channelId,
      serverId: reminder.serverId,
    });
  }
</script>

{#if isOpen}
  <div
    class="reminder-overlay"
    on:click|self={close}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="reminder-title"
    tabindex="-1"
  >
    <div class="reminder-panel">
      <header class="reminder-header">
        <h2 id="reminder-title">⏰ Message Reminders</h2>
        <button class="close-btn" on:click={close} aria-label="Close">✕</button>
      </header>

      <nav class="tab-nav" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'create'}
          class:active={activeTab === 'create'}
          on:click={() => (activeTab = 'create')}
        >
          ➕ Create
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'list'}
          class:active={activeTab === 'list'}
          on:click={() => (activeTab = 'list')}
        >
          📋 Active
          {#if pendingCount + snoozedCount > 0}
            <span class="badge">{pendingCount + snoozedCount}</span>
          {/if}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          class:active={activeTab === 'history'}
          on:click={() => (activeTab = 'history')}
        >
          📜 History
          {#if historyCount > 0}
            <span class="badge secondary">{historyCount}</span>
          {/if}
        </button>
      </nav>

      <div class="tab-content">
        {#if activeTab === 'create'}
          <div class="create-tab">
            {#if messageContent}
              <div class="message-preview">
                <div class="preview-header">
                  {#if authorAvatar}
                    <img src={authorAvatar} alt="" class="avatar" />
                  {:else}
                    <div class="avatar-placeholder">👤</div>
                  {/if}
                  <div class="preview-info">
                    <span class="author-name">{authorName}</span>
                    <span class="channel-info">#{channelName}</span>
                  </div>
                </div>
                <p class="preview-content">{messageContent.slice(0, 200)}{messageContent.length > 200 ? '...' : ''}</p>
              </div>
            {/if}

            <div class="quick-times">
              <h3>Remind me</h3>
              <div class="quick-time-grid">
                {#each quickTimes as qt}
                  <button
                    class="quick-time-btn"
                    class:selected={selectedQuickTime === qt}
                    on:click={() => selectQuickTime(qt)}
                  >
                    <span class="qt-icon">{qt.icon}</span>
                    <span class="qt-label">{qt.label}</span>
                  </button>
                {/each}
              </div>
            </div>

            {#if selectedQuickTime?.minutes === 0}
              <div class="custom-datetime">
                <label for="custom-dt">Custom date & time</label>
                <input
                  type="datetime-local"
                  id="custom-dt"
                  bind:value={customDateTime}
                  min={formatDateTimeLocal(new Date())}
                />
              </div>
            {/if}

            <div class="reminder-options">
              <div class="option-group">
                <label for="reminder-note">Add a note (optional)</label>
                <input
                  type="text"
                  id="reminder-note"
                  bind:value={reminderNote}
                  placeholder="Why do you need to remember this?"
                  maxlength="200"
                />
              </div>

              <div class="option-group">
                <label for="recurring">Recurring</label>
                <select id="recurring" bind:value={recurringOption}>
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <button
              class="create-btn"
              on:click={createReminder}
              disabled={!selectedQuickTime && !customDateTime}
            >
              ⏰ Set Reminder
            </button>
          </div>

        {:else if activeTab === 'list'}
          <div class="list-tab">
            <div class="list-controls">
              <input
                type="search"
                placeholder="Search reminders..."
                bind:value={searchQuery}
                class="search-input"
              />
              <select bind:value={filterStatus} class="filter-select">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="snoozed">Snoozed</option>
              </select>
              <select bind:value={sortBy} class="sort-select">
                <option value="time">By Time</option>
                <option value="created">By Created</option>
                <option value="channel">By Channel</option>
              </select>
            </div>

            <div class="reminder-list">
              {#each filteredReminders.filter(r => r.status === 'pending' || r.status === 'snoozed') as reminder (reminder.id)}
                <div class="reminder-card" class:snoozed={reminder.status === 'snoozed'}>
                  <div class="reminder-time">
                    <span class="relative-time">{formatRelativeTime(reminder.reminderTime)}</span>
                    <span class="absolute-time">{formatDateTime(reminder.reminderTime)}</span>
                    {#if reminder.status === 'snoozed'}
                      <span class="snoozed-badge">💤 Snoozed ({reminder.snoozedCount}x)</span>
                    {/if}
                    {#if reminder.recurring && reminder.recurring !== 'none'}
                      <span class="recurring-badge">🔁 {reminder.recurring}</span>
                    {/if}
                  </div>

                  <div class="reminder-content">
                    <div class="reminder-meta">
                      <span class="channel">#{reminder.channelName}</span>
                      <span class="author">from {reminder.authorName}</span>
                    </div>
                    <p class="message-preview-text">
                      {reminder.messageContent.slice(0, 100)}{reminder.messageContent.length > 100 ? '...' : ''}
                    </p>
                    {#if reminder.note}
                      <p class="reminder-note">📝 {reminder.note}</p>
                    {/if}
                  </div>

                  <div class="reminder-actions">
                    <button class="action-btn go" on:click={() => goToMessage(reminder)} title="Go to message">
                      📍
                    </button>
                    <div class="snooze-dropdown">
                      <button class="action-btn snooze" title="Snooze">💤</button>
                      <div class="snooze-menu">
                        {#each snoozeOptions as option}
                          <button on:click={() => snoozeReminder(reminder.id, option.minutes)}>
                            {option.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                    <button class="action-btn dismiss" on:click={() => dismissReminder(reminder.id)} title="Mark done">
                      ✓
                    </button>
                    <button class="action-btn delete" on:click={() => confirmDelete(reminder.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
              {:else}
                <div class="empty-state">
                  <span class="empty-icon">⏰</span>
                  <p>No active reminders</p>
                  <button on:click={() => (activeTab = 'create')}>Create one</button>
                </div>
              {/each}
            </div>
          </div>

        {:else if activeTab === 'history'}
          <div class="history-tab">
            <div class="history-header">
              <span>{historyCount} completed reminder{historyCount !== 1 ? 's' : ''}</span>
              {#if historyCount > 0}
                <button class="clear-history-btn" on:click={clearHistory}>Clear history</button>
              {/if}
            </div>

            <div class="reminder-list">
              {#each filteredReminders.filter(r => r.status === 'triggered' || r.status === 'dismissed') as reminder (reminder.id)}
                <div class="reminder-card history">
                  <div class="reminder-time">
                    <span class="status-badge" class:triggered={reminder.status === 'triggered'}>
                      {reminder.status === 'triggered' ? '🔔 Triggered' : '✓ Dismissed'}
                    </span>
                    <span class="absolute-time">{formatDateTime(reminder.reminderTime)}</span>
                  </div>

                  <div class="reminder-content">
                    <div class="reminder-meta">
                      <span class="channel">#{reminder.channelName}</span>
                      <span class="author">from {reminder.authorName}</span>
                    </div>
                    <p class="message-preview-text">
                      {reminder.messageContent.slice(0, 100)}{reminder.messageContent.length > 100 ? '...' : ''}
                    </p>
                  </div>

                  <div class="reminder-actions">
                    <button class="action-btn go" on:click={() => goToMessage(reminder)} title="Go to message">
                      📍
                    </button>
                    <button class="action-btn delete" on:click={() => confirmDelete(reminder.id)} title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
              {:else}
                <div class="empty-state">
                  <span class="empty-icon">📜</span>
                  <p>No reminder history</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showConfirmDelete}
  <div class="confirm-overlay" on:click|self={() => (showConfirmDelete = false)} role="dialog" aria-modal="true">
    <div class="confirm-dialog">
      <h3>Delete Reminder?</h3>
      <p>This action cannot be undone.</p>
      <div class="confirm-actions">
        <button class="cancel-btn" on:click={() => (showConfirmDelete = false)}>Cancel</button>
        <button class="delete-confirm-btn" on:click={deleteReminder}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reminder-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .reminder-panel {
    background: var(--bg-primary, #1e1e2e);
    border-radius: 12px;
    width: 480px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color, #313244);
    overflow: hidden;
  }

  .reminder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .reminder-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary, #cdd6f4);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted, #6c7086);
    cursor: pointer;
    font-size: 1.25rem;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-hover, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .tab-nav {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    background: var(--bg-secondary, #181825);
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .tab-nav button {
    flex: 1;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text-muted, #6c7086);
    cursor: pointer;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .tab-nav button:hover {
    background: var(--bg-hover, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .tab-nav button.active {
    background: var(--accent, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .badge {
    background: var(--accent, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge.secondary {
    background: var(--text-muted, #6c7086);
    color: var(--bg-primary, #1e1e2e);
  }

  .tab-nav button.active .badge {
    background: var(--bg-primary, #1e1e2e);
    color: var(--accent, #cba6f7);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Create Tab */
  .create-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message-preview {
    background: var(--bg-secondary, #181825);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #313244);
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-hover, #313244);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }

  .preview-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .author-name {
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.875rem;
  }

  .channel-info {
    color: var(--text-muted, #6c7086);
    font-size: 0.75rem;
  }

  .preview-content {
    margin: 0;
    color: var(--text-secondary, #a6adc8);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .quick-times h3 {
    margin: 0 0 12px 0;
    font-size: 0.875rem;
    color: var(--text-muted, #6c7086);
    font-weight: 500;
  }

  .quick-time-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .quick-time-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.875rem;
  }

  .quick-time-btn:hover {
    background: var(--bg-hover, #313244);
    border-color: var(--accent, #cba6f7);
  }

  .quick-time-btn.selected {
    background: var(--accent, #cba6f7);
    border-color: var(--accent, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .qt-icon {
    font-size: 1rem;
  }

  .custom-datetime {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .custom-datetime label {
    font-size: 0.875rem;
    color: var(--text-muted, #6c7086);
  }

  .custom-datetime input {
    padding: 10px 12px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.875rem;
  }

  .custom-datetime input:focus {
    outline: none;
    border-color: var(--accent, #cba6f7);
  }

  .reminder-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .option-group label {
    font-size: 0.875rem;
    color: var(--text-muted, #6c7086);
  }

  .option-group input,
  .option-group select {
    padding: 10px 12px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.875rem;
  }

  .option-group input:focus,
  .option-group select:focus {
    outline: none;
    border-color: var(--accent, #cba6f7);
  }

  .create-btn {
    padding: 12px;
    background: var(--accent, #cba6f7);
    border: none;
    border-radius: 8px;
    color: var(--bg-primary, #1e1e2e);
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .create-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* List Tab */
  .list-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .list-controls {
    display: flex;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent, #cba6f7);
  }

  .filter-select,
  .sort-select {
    padding: 8px 10px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .reminder-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .reminder-card {
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: all 0.15s;
  }

  .reminder-card:hover {
    border-color: var(--accent, #cba6f7);
  }

  .reminder-card.snoozed {
    border-left: 3px solid var(--yellow, #f9e2af);
  }

  .reminder-card.history {
    opacity: 0.7;
  }

  .reminder-time {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .relative-time {
    font-weight: 600;
    color: var(--accent, #cba6f7);
    font-size: 0.9375rem;
  }

  .absolute-time {
    color: var(--text-muted, #6c7086);
    font-size: 0.8125rem;
  }

  .snoozed-badge,
  .recurring-badge {
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg-hover, #313244);
    color: var(--text-secondary, #a6adc8);
  }

  .status-badge {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--green, #a6e3a1);
  }

  .status-badge.triggered {
    color: var(--blue, #89b4fa);
  }

  .reminder-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reminder-meta {
    display: flex;
    gap: 8px;
    font-size: 0.8125rem;
  }

  .channel {
    color: var(--blue, #89b4fa);
    font-weight: 500;
  }

  .author {
    color: var(--text-muted, #6c7086);
  }

  .message-preview-text {
    margin: 0;
    color: var(--text-secondary, #a6adc8);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .reminder-note {
    margin: 0;
    color: var(--yellow, #f9e2af);
    font-size: 0.8125rem;
    font-style: italic;
  }

  .reminder-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .action-btn {
    padding: 6px 10px;
    background: var(--bg-hover, #313244);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  .action-btn:hover {
    filter: brightness(1.2);
  }

  .action-btn.go:hover {
    background: var(--blue, #89b4fa);
  }

  .action-btn.dismiss:hover {
    background: var(--green, #a6e3a1);
  }

  .action-btn.delete:hover {
    background: var(--red, #f38ba8);
  }

  .snooze-dropdown {
    position: relative;
  }

  .snooze-menu {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 0;
    background: var(--bg-primary, #1e1e2e);
    border: 1px solid var(--border-color, #313244);
    border-radius: 8px;
    padding: 6px;
    margin-bottom: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }

  .snooze-dropdown:hover .snooze-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .snooze-menu button {
    padding: 8px 10px;
    background: transparent;
    border: none;
    color: var(--text-primary, #cdd6f4);
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.8125rem;
    text-align: left;
    white-space: nowrap;
  }

  .snooze-menu button:hover {
    background: var(--bg-hover, #313244);
  }

  /* History Tab */
  .history-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text-muted, #6c7086);
    font-size: 0.875rem;
  }

  .clear-history-btn {
    padding: 6px 12px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.15s;
  }

  .clear-history-btn:hover {
    background: var(--red, #f38ba8);
    border-color: var(--red, #f38ba8);
    color: var(--bg-primary, #1e1e2e);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    color: var(--text-muted, #6c7086);
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9375rem;
  }

  .empty-state button {
    padding: 8px 16px;
    background: var(--accent, #cba6f7);
    border: none;
    border-radius: 6px;
    color: var(--bg-primary, #1e1e2e);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .empty-state button:hover {
    filter: brightness(1.1);
  }

  /* Confirm Dialog */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .confirm-dialog {
    background: var(--bg-primary, #1e1e2e);
    border: 1px solid var(--border-color, #313244);
    border-radius: 12px;
    padding: 20px;
    min-width: 280px;
    text-align: center;
  }

  .confirm-dialog h3 {
    margin: 0 0 8px 0;
    color: var(--text-primary, #cdd6f4);
  }

  .confirm-dialog p {
    margin: 0 0 16px 0;
    color: var(--text-muted, #6c7086);
    font-size: 0.875rem;
  }

  .confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .cancel-btn {
    padding: 8px 16px;
    background: var(--bg-secondary, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: var(--bg-hover, #313244);
  }

  .delete-confirm-btn {
    padding: 8px 16px;
    background: var(--red, #f38ba8);
    border: none;
    border-radius: 6px;
    color: var(--bg-primary, #1e1e2e);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-confirm-btn:hover {
    filter: brightness(1.1);
  }
</style>
