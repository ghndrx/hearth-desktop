<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { isPermissionGranted, requestPermission, sendNotification, type Options as NotificationOptions } from '@tauri-apps/plugin-notification';
  import { appDataDir } from '@tauri-apps/api/path';
  import { toast } from '$lib/stores/toast';
  
  /** Component Props */
  
  /** Whether the component should auto-request permissions on mount */
  export let autoRequestPermission = false;
  
  /** Notification preferences - can be bound for two-way updates */
  export let preferences: NotificationPreferences = {
    enabled: true,
    showPreview: true,
    groupByConversation: true,
    maxNotifications: 5,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    categories: {
      messages: true,
      mentions: true,
      directMessages: true,
      reactions: true,
      systemAlerts: true,
      updates: true
    },
    sound: {
      enabled: true,
      volume: 0.8,
      customSoundPath: null
    },
    badge: {
      enabled: true,
      showCount: true
    }
  };
  
  /** Events */
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    permissionChanged: { granted: boolean };
    notificationSent: { id: string; title: string };
    notificationClicked: { id: string; action?: string };
    preferencesChanged: NotificationPreferences;
    error: { message: string; code?: string };
  }>();
  
  /** Types */
  export interface NotificationPreferences {
    enabled: boolean;
    showPreview: boolean;
    groupByConversation: boolean;
    maxNotifications: number;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    categories: {
      messages: boolean;
      mentions: boolean;
      directMessages: boolean;
      reactions: boolean;
      systemAlerts: boolean;
      updates: boolean;
    };
    sound: {
      enabled: boolean;
      volume: number;
      customSoundPath: string | null;
    };
    badge: {
      enabled: boolean;
      showCount: boolean;
    };
  }
  
  export interface NotificationPayload {
    id?: string;
    title: string;
    body: string;
    category?: keyof NotificationPreferences['categories'];
    icon?: string;
    tag?: string;
    group?: string;
    actions?: Array<{ id: string; title: string }>;
    silent?: boolean;
    urgency?: 'low' | 'normal' | 'critical';
    data?: Record<string, unknown>;
  }
  
  interface NotificationHistoryEntry {
    id: string;
    title: string;
    body: string;
    category: string;
    timestamp: number;
    read: boolean;
  }
  
  /** State */
  let permissionGranted = false;
  let permissionChecked = false;
  let notificationHistory: NotificationHistoryEntry[] = [];
  let activeNotificationCount = 0;
  let isQuietHours = false;
  let quietHoursCheckInterval: ReturnType<typeof setInterval> | null = null;
  
  const STORAGE_KEY = 'hearth_notification_preferences';
  const HISTORY_KEY = 'hearth_notification_history';
  const MAX_HISTORY = 100;
  
  /** Lifecycle */
  onMount(async () => {
    await checkPermission();
    loadPreferences();
    loadHistory();
    startQuietHoursCheck();
    
    if (autoRequestPermission && !permissionGranted) {
      await requestNotificationPermission();
    }
  });
  
  onDestroy(() => {
    if (quietHoursCheckInterval) {
      clearInterval(quietHoursCheckInterval);
    }
  });
  
  /** Permission Management */
  async function checkPermission(): Promise<boolean> {
    try {
      permissionGranted = await isPermissionGranted();
      permissionChecked = true;
      return permissionGranted;
    } catch (error) {
      console.error('Failed to check notification permission:', error);
      dispatch('error', { message: 'Failed to check notification permission', code: 'PERMISSION_CHECK_FAILED' });
      return false;
    }
  }
  
  export async function requestNotificationPermission(): Promise<boolean> {
    try {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
      dispatch('permissionChanged', { granted: permissionGranted });
      return permissionGranted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      dispatch('error', { message: 'Failed to request notification permission', code: 'PERMISSION_REQUEST_FAILED' });
      return false;
    }
  }
  
  /** Quiet Hours Management */
  function startQuietHoursCheck() {
    checkQuietHours();
    quietHoursCheckInterval = setInterval(checkQuietHours, 60000); // Check every minute
  }
  
  function checkQuietHours() {
    if (!preferences.quietHoursEnabled) {
      isQuietHours = false;
      return;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHours, startMinutes] = preferences.quietHoursStart.split(':').map(Number);
    const [endHours, endMinutes] = preferences.quietHoursEnd.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    if (startTime <= endTime) {
      // Same day range (e.g., 09:00 - 17:00)
      isQuietHours = currentTime >= startTime && currentTime < endTime;
    } else {
      // Overnight range (e.g., 22:00 - 07:00)
      isQuietHours = currentTime >= startTime || currentTime < endTime;
    }
  }
  
  /** Notification Sending */
  export async function sendNativeNotification(payload: NotificationPayload): Promise<string | null> {
    // Check if notifications are enabled
    if (!preferences.enabled) {
      return null;
    }
    
    // Check category preferences
    if (payload.category && !preferences.categories[payload.category]) {
      return null;
    }
    
    // Check quiet hours (but allow critical notifications)
    if (isQuietHours && payload.urgency !== 'critical') {
      return null;
    }
    
    // Check permission
    if (!permissionGranted) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        dispatch('error', { message: 'Notification permission not granted', code: 'PERMISSION_DENIED' });
        return null;
      }
    }
    
    // Generate notification ID
    const notificationId = payload.id || `hearth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Build notification options
      const options: NotificationOptions = {
        title: payload.title,
        body: preferences.showPreview ? payload.body : 'New notification',
      };
      
      // Add icon if provided
      if (payload.icon) {
        options.icon = payload.icon;
      }
      
      // Handle sound
      if (payload.silent || !preferences.sound.enabled) {
        options.silent = true;
      }
      
      // Send notification via Tauri plugin
      sendNotification(options);
      
      // Also send via invoke for additional features
      await invoke('show_notification', {
        title: options.title,
        body: options.body || ''
      });
      
      // Add to history
      addToHistory({
        id: notificationId,
        title: payload.title,
        body: payload.body,
        category: payload.category || 'messages',
        timestamp: Date.now(),
        read: false
      });
      
      // Update badge count
      if (preferences.badge.enabled) {
        activeNotificationCount++;
        await updateBadgeCount();
      }
      
      dispatch('notificationSent', { id: notificationId, title: payload.title });
      
      return notificationId;
    } catch (error) {
      console.error('Failed to send notification:', error);
      dispatch('error', { message: 'Failed to send notification', code: 'SEND_FAILED' });
      return null;
    }
  }
  
  /** Convenience methods for common notification types */
  export async function notifyMessage(title: string, body: string, data?: Record<string, unknown>): Promise<string | null> {
    return sendNativeNotification({
      title,
      body,
      category: 'messages',
      urgency: 'normal',
      data
    });
  }
  
  export async function notifyMention(title: string, body: string, data?: Record<string, unknown>): Promise<string | null> {
    return sendNativeNotification({
      title,
      body,
      category: 'mentions',
      urgency: 'normal',
      data
    });
  }
  
  export async function notifyDirectMessage(from: string, message: string, data?: Record<string, unknown>): Promise<string | null> {
    return sendNativeNotification({
      title: `DM from ${from}`,
      body: message,
      category: 'directMessages',
      urgency: 'normal',
      data
    });
  }
  
  export async function notifyReaction(title: string, body: string, data?: Record<string, unknown>): Promise<string | null> {
    return sendNativeNotification({
      title,
      body,
      category: 'reactions',
      urgency: 'low',
      silent: true,
      data
    });
  }
  
  export async function notifySystem(title: string, body: string, urgency: 'low' | 'normal' | 'critical' = 'normal'): Promise<string | null> {
    return sendNativeNotification({
      title,
      body,
      category: 'systemAlerts',
      urgency
    });
  }
  
  export async function notifyUpdate(version: string, body: string): Promise<string | null> {
    return sendNativeNotification({
      title: `Update Available: ${version}`,
      body,
      category: 'updates',
      urgency: 'low'
    });
  }
  
  /** Badge Management */
  async function updateBadgeCount() {
    try {
      const count = preferences.badge.showCount ? activeNotificationCount : (activeNotificationCount > 0 ? 1 : 0);
      await invoke('set_badge_count', { count });
      await invoke('update_tray_badge', { count });
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }
  
  export async function clearBadge() {
    activeNotificationCount = 0;
    await updateBadgeCount();
  }
  
  export async function decrementBadge() {
    if (activeNotificationCount > 0) {
      activeNotificationCount--;
      await updateBadgeCount();
    }
  }
  
  /** History Management */
  function addToHistory(entry: NotificationHistoryEntry) {
    notificationHistory = [entry, ...notificationHistory].slice(0, MAX_HISTORY);
    saveHistory();
  }
  
  export function markAsRead(notificationId: string) {
    notificationHistory = notificationHistory.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    saveHistory();
  }
  
  export function markAllAsRead() {
    notificationHistory = notificationHistory.map(n => ({ ...n, read: true }));
    saveHistory();
  }
  
  export function clearHistory() {
    notificationHistory = [];
    saveHistory();
  }
  
  export function getUnreadCount(): number {
    return notificationHistory.filter(n => !n.read).length;
  }
  
  export function getHistory(): NotificationHistoryEntry[] {
    return [...notificationHistory];
  }
  
  /** Persistence */
  function loadPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        preferences = { ...preferences, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }
  
  export function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      dispatch('preferencesChanged', preferences);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }
  
  function loadHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        notificationHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load notification history:', error);
    }
  }
  
  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(notificationHistory));
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }
  
  /** Preference Updates */
  function handlePreferenceChange() {
    checkQuietHours();
    savePreferences();
  }
  
  /** Test Notification */
  export async function sendTestNotification(): Promise<void> {
    await sendNativeNotification({
      title: 'Test Notification',
      body: 'This is a test notification from Hearth!',
      category: 'systemAlerts',
      urgency: 'normal'
    });
    toast.success('Test notification sent!');
  }
</script>

<div class="native-notification-manager">
  <div class="section">
    <h3 class="section-title">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      Desktop Notifications
    </h3>
    
    <div class="permission-status" class:granted={permissionGranted}>
      <span class="status-indicator"></span>
      <span class="status-text">
        {#if !permissionChecked}
          Checking permission...
        {:else if permissionGranted}
          Notifications enabled
        {:else}
          Notifications disabled
        {/if}
      </span>
      {#if permissionChecked && !permissionGranted}
        <button class="request-btn" on:click={requestNotificationPermission}>
          Enable
        </button>
      {/if}
    </div>
  </div>
  
  <div class="section">
    <label class="toggle-row">
      <span class="label">Enable notifications</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.enabled}
        on:change={handlePreferenceChange}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Show message preview</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.showPreview}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Group by conversation</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.groupByConversation}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
  </div>
  
  <div class="section">
    <h4 class="subsection-title">Notification Categories</h4>
    
    <label class="toggle-row">
      <span class="label">Messages</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.messages}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Mentions</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.mentions}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Direct Messages</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.directMessages}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Reactions</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.reactions}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">System Alerts</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.systemAlerts}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">App Updates</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.categories.updates}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
  </div>
  
  <div class="section">
    <h4 class="subsection-title">Quiet Hours</h4>
    
    <label class="toggle-row">
      <span class="label">Enable quiet hours</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.quietHoursEnabled}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    {#if preferences.quietHoursEnabled}
      <div class="time-range">
        <label class="time-input">
          <span>From</span>
          <input 
            type="time" 
            bind:value={preferences.quietHoursStart}
            on:change={handlePreferenceChange}
            disabled={!preferences.enabled}
          />
        </label>
        <label class="time-input">
          <span>To</span>
          <input 
            type="time" 
            bind:value={preferences.quietHoursEnd}
            on:change={handlePreferenceChange}
            disabled={!preferences.enabled}
          />
        </label>
      </div>
      
      {#if isQuietHours}
        <div class="quiet-hours-active">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          Quiet hours active
        </div>
      {/if}
    {/if}
  </div>
  
  <div class="section">
    <h4 class="subsection-title">Sound</h4>
    
    <label class="toggle-row">
      <span class="label">Enable notification sound</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.sound.enabled}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    {#if preferences.sound.enabled}
      <label class="slider-row">
        <span class="label">Volume</span>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.1"
          bind:value={preferences.sound.volume}
          on:change={handlePreferenceChange}
          disabled={!preferences.enabled}
          class="slider"
        />
        <span class="value">{Math.round(preferences.sound.volume * 100)}%</span>
      </label>
    {/if}
  </div>
  
  <div class="section">
    <h4 class="subsection-title">Badge</h4>
    
    <label class="toggle-row">
      <span class="label">Show badge on dock icon</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.badge.enabled}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled}
        class="toggle"
      />
    </label>
    
    <label class="toggle-row">
      <span class="label">Show unread count</span>
      <input 
        type="checkbox" 
        bind:checked={preferences.badge.showCount}
        on:change={handlePreferenceChange}
        disabled={!preferences.enabled || !preferences.badge.enabled}
        class="toggle"
      />
    </label>
  </div>
  
  <div class="section actions">
    <button class="test-btn" on:click={sendTestNotification} disabled={!preferences.enabled || !permissionGranted}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Send Test Notification
    </button>
    
    <button class="clear-btn" on:click={clearHistory} disabled={notificationHistory.length === 0}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Clear History ({notificationHistory.length})
    </button>
  </div>
</div>

<style>
  .native-notification-manager {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
    color: var(--text-primary, #fff);
  }
  
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary, #fff);
  }
  
  .subsection-title {
    font-size: 0.9rem;
    font-weight: 500;
    margin: 0.5rem 0 0.25rem;
    color: var(--text-secondary, #b5bac1);
  }
  
  .icon {
    width: 1.25rem;
    height: 1.25rem;
  }
  
  .permission-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 0.5rem;
  }
  
  .status-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--status-offline, #80848e);
  }
  
  .permission-status.granted .status-indicator {
    background: var(--status-online, #23a559);
  }
  
  .status-text {
    flex: 1;
    font-size: 0.9rem;
  }
  
  .request-btn {
    padding: 0.375rem 0.75rem;
    background: var(--brand-primary, #5865f2);
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .request-btn:hover {
    background: var(--brand-primary-hover, #4752c4);
  }
  
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    cursor: pointer;
  }
  
  .toggle-row .label {
    font-size: 0.9rem;
    color: var(--text-primary, #fff);
  }
  
  .toggle {
    appearance: none;
    width: 2.5rem;
    height: 1.25rem;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 0.625rem;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .toggle::before {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1rem;
    height: 1rem;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle:checked {
    background: var(--brand-primary, #5865f2);
  }
  
  .toggle:checked::before {
    transform: translateX(1.25rem);
  }
  
  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .time-range {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 0;
  }
  
  .time-input {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .time-input span {
    font-size: 0.75rem;
    color: var(--text-secondary, #b5bac1);
  }
  
  .time-input input {
    padding: 0.5rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.25rem;
    color: var(--text-primary, #fff);
    font-size: 0.9rem;
  }
  
  .time-input input:disabled {
    opacity: 0.5;
  }
  
  .quiet-hours-active {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--status-idle, #f0b232);
    color: #000;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  .quiet-hours-active .icon {
    width: 1rem;
    height: 1rem;
  }
  
  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
  
  .slider-row .label {
    font-size: 0.9rem;
    min-width: 4rem;
  }
  
  .slider {
    flex: 1;
    appearance: none;
    height: 0.375rem;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 0.1875rem;
    cursor: pointer;
  }
  
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 1rem;
    height: 1rem;
    background: var(--brand-primary, #5865f2);
    border-radius: 50%;
    cursor: pointer;
  }
  
  .slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .slider-row .value {
    font-size: 0.85rem;
    color: var(--text-secondary, #b5bac1);
    min-width: 2.5rem;
    text-align: right;
  }
  
  .actions {
    flex-direction: row;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color, #3f4147);
  }
  
  .test-btn,
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }
  
  .test-btn {
    background: var(--brand-primary, #5865f2);
    color: white;
  }
  
  .test-btn:hover:not(:disabled) {
    background: var(--brand-primary-hover, #4752c4);
  }
  
  .clear-btn {
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #fff);
  }
  
  .clear-btn:hover:not(:disabled) {
    background: var(--bg-tertiary, #1e1f22);
  }
  
  .test-btn:disabled,
  .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .test-btn .icon,
  .clear-btn .icon {
    width: 1rem;
    height: 1rem;
  }
</style>
