<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fly, fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';
  
  /** Component Props */
  
  /** Maximum number of notifications to keep in history */
  export let maxHistory = 100;
  
  /** Whether to show timestamps relative to now */
  export let relativeTime = true;
  
  /** Auto-dismiss read notifications after this many ms (0 = never) */
  export let autoDismissReadMs = 0;
  
  /** Whether to group notifications by source/category */
  export let groupByCategory = true;
  
  /** Whether the panel is currently visible */
  export let visible = true;
  
  /** Filter by category (null = show all) */
  export let categoryFilter: string | null = null;
  
  /** Events */
  const dispatch = createEventDispatcher<{
    notificationClick: { notification: NotificationHistoryItem };
    notificationDismiss: { id: string };
    notificationDismissAll: void;
    markAllRead: void;
    historyCleared: void;
  }>();
  
  /** Types */
  interface NotificationHistoryItem {
    id: string;
    title: string;
    body: string;
    category: NotificationCategory;
    timestamp: Date;
    read: boolean;
    dismissed: boolean;
    icon?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }
  
  type NotificationCategory = 
    | 'message'
    | 'mention'
    | 'direct_message'
    | 'reaction'
    | 'system'
    | 'update'
    | 'reminder'
    | 'achievement';
  
  interface GroupedNotifications {
    category: NotificationCategory;
    label: string;
    icon: string;
    notifications: NotificationHistoryItem[];
    unreadCount: number;
  }
  
  /** State */
  let notifications: NotificationHistoryItem[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedNotificationId: string | null = null;
  let searchQuery = '';
  let sortOrder: 'newest' | 'oldest' | 'unread' = 'newest';
  
  /** Category metadata */
  const categoryMeta: Record<NotificationCategory, { label: string; icon: string; color: string }> = {
    message: { label: 'Messages', icon: '💬', color: 'bg-blue-500' },
    mention: { label: 'Mentions', icon: '@', color: 'bg-yellow-500' },
    direct_message: { label: 'Direct Messages', icon: '✉️', color: 'bg-purple-500' },
    reaction: { label: 'Reactions', icon: '👍', color: 'bg-pink-500' },
    system: { label: 'System', icon: '⚙️', color: 'bg-gray-500' },
    update: { label: 'Updates', icon: '🔄', color: 'bg-green-500' },
    reminder: { label: 'Reminders', icon: '⏰', color: 'bg-orange-500' },
    achievement: { label: 'Achievements', icon: '🏆', color: 'bg-amber-500' }
  };
  
  /** Computed */
  $: filteredNotifications = filterNotifications(notifications, categoryFilter, searchQuery);
  $: sortedNotifications = sortNotifications(filteredNotifications, sortOrder);
  $: groupedNotifications = groupByCategory ? groupNotificationsByCategory(sortedNotifications) : null;
  $: unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
  $: totalCount = notifications.filter(n => !n.dismissed).length;
  
  /** Load notification history from storage */
  async function loadHistory(): Promise<void> {
    loading = true;
    error = null;
    
    try {
      const history = await invoke<NotificationHistoryItem[]>('get_notification_history', {
        limit: maxHistory
      });
      
      notifications = history.map(n => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }));
    } catch (e) {
      // Fallback to localStorage if Tauri command not available
      try {
        const stored = localStorage.getItem('notification_history');
        if (stored) {
          const parsed = JSON.parse(stored) as NotificationHistoryItem[];
          notifications = parsed.map(n => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
        }
      } catch {
        error = 'Failed to load notification history';
      }
    } finally {
      loading = false;
    }
  }
  
  /** Save history to storage */
  async function saveHistory(): Promise<void> {
    try {
      await invoke('save_notification_history', { 
        history: notifications.slice(0, maxHistory)
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem('notification_history', JSON.stringify(notifications.slice(0, maxHistory)));
    }
  }
  
  /** Add a new notification to history */
  export function addNotification(notification: Omit<NotificationHistoryItem, 'id' | 'timestamp' | 'read' | 'dismissed'>): string {
    const id = crypto.randomUUID();
    const newNotification: NotificationHistoryItem = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
      dismissed: false
    };
    
    notifications = [newNotification, ...notifications].slice(0, maxHistory);
    saveHistory();
    
    return id;
  }
  
  /** Mark a notification as read */
  export function markAsRead(id: string): void {
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1 && !notifications[index].read) {
      notifications[index] = { ...notifications[index], read: true };
      notifications = [...notifications];
      saveHistory();
      
      if (autoDismissReadMs > 0) {
        setTimeout(() => dismissNotification(id), autoDismissReadMs);
      }
    }
  }
  
  /** Mark all notifications as read */
  export function markAllAsRead(): void {
    notifications = notifications.map(n => ({ ...n, read: true }));
    saveHistory();
    dispatch('markAllRead');
  }
  
  /** Dismiss a notification */
  export function dismissNotification(id: string): void {
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index] = { ...notifications[index], dismissed: true };
      notifications = [...notifications];
      saveHistory();
      dispatch('notificationDismiss', { id });
    }
  }
  
  /** Dismiss all notifications */
  export function dismissAll(): void {
    notifications = notifications.map(n => ({ ...n, dismissed: true }));
    saveHistory();
    dispatch('notificationDismissAll');
  }
  
  /** Clear entire history */
  export function clearHistory(): void {
    notifications = [];
    saveHistory();
    dispatch('historyCleared');
  }
  
  /** Handle notification click */
  function handleNotificationClick(notification: NotificationHistoryItem): void {
    selectedNotificationId = notification.id;
    markAsRead(notification.id);
    dispatch('notificationClick', { notification });
    
    if (notification.actionUrl) {
      // Navigate or open URL
      window.open(notification.actionUrl, '_blank');
    }
  }
  
  /** Filter notifications */
  function filterNotifications(
    items: NotificationHistoryItem[],
    category: string | null,
    query: string
  ): NotificationHistoryItem[] {
    return items.filter(n => {
      if (n.dismissed) return false;
      if (category && n.category !== category) return false;
      if (query) {
        const q = query.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
      }
      return true;
    });
  }
  
  /** Sort notifications */
  function sortNotifications(
    items: NotificationHistoryItem[],
    order: 'newest' | 'oldest' | 'unread'
  ): NotificationHistoryItem[] {
    const sorted = [...items];
    switch (order) {
      case 'newest':
        return sorted.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      case 'oldest':
        return sorted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      case 'unread':
        return sorted.sort((a, b) => {
          if (a.read === b.read) return b.timestamp.getTime() - a.timestamp.getTime();
          return a.read ? 1 : -1;
        });
    }
  }
  
  /** Group notifications by category */
  function groupNotificationsByCategory(items: NotificationHistoryItem[]): GroupedNotifications[] {
    const groups = new Map<NotificationCategory, NotificationHistoryItem[]>();
    
    for (const item of items) {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    
    return Array.from(groups.entries()).map(([category, notifs]) => ({
      category,
      label: categoryMeta[category].label,
      icon: categoryMeta[category].icon,
      notifications: notifs,
      unreadCount: notifs.filter(n => !n.read).length
    }));
  }
  
  /** Format relative time */
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return date.toLocaleDateString();
  }
  
  /** Format absolute time */
  function formatAbsoluteTime(date: Date): string {
    return date.toLocaleString();
  }
  
  /** Listen for new notifications */
  let unlistenNotification: (() => void) | null = null;
  
  onMount(async () => {
    await loadHistory();
    
    // Listen for new notifications from the Tauri backend
    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenNotification = await listen<NotificationHistoryItem>('notification_received', (event) => {
        addNotification(event.payload);
      });
    } catch {
      // Event listening not available
    }
  });
  
  onDestroy(() => {
    unlistenNotification?.();
  });
</script>

{#if visible}
  <div 
    class="notification-history-panel flex flex-col h-full bg-gray-900 text-white rounded-lg overflow-hidden"
    role="region"
    aria-label="Notification History"
    transition:fly={{ y: 20, duration: 200 }}
  >
    <!-- Header -->
    <header class="flex items-center justify-between p-4 border-b border-gray-700">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold">Notifications</h2>
        {#if unreadCount > 0}
          <span class="px-2 py-0.5 text-xs font-medium bg-blue-600 rounded-full">
            {unreadCount} new
          </span>
        {/if}
      </div>
      
      <div class="flex items-center gap-2">
        {#if unreadCount > 0}
          <button
            class="px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            on:click={markAllAsRead}
            aria-label="Mark all as read"
          >
            Mark all read
          </button>
        {/if}
        
        <button
          class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          on:click={dismissAll}
          aria-label="Dismiss all notifications"
          title="Dismiss all"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
    
    <!-- Search and filters -->
    <div class="p-3 border-b border-gray-700 space-y-2">
      <div class="relative">
        <input
          type="text"
          placeholder="Search notifications..."
          class="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
          bind:value={searchQuery}
        />
        <svg 
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          class="px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors {categoryFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
          on:click={() => categoryFilter = null}
        >
          All ({totalCount})
        </button>
        
        {#each Object.entries(categoryMeta) as [cat, meta]}
          {@const count = notifications.filter(n => n.category === cat && !n.dismissed).length}
          {#if count > 0}
            <button
              class="px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors {categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
              on:click={() => categoryFilter = cat}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          {/if}
        {/each}
      </div>
      
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">Sort:</span>
        <select
          class="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          bind:value={sortOrder}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="unread">Unread first</option>
        </select>
      </div>
    </div>
    
    <!-- Notification list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500"></div>
        </div>
      {:else if error}
        <div class="p-4 text-center text-red-400">
          <p>{error}</p>
          <button
            class="mt-2 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            on:click={loadHistory}
          >
            Retry
          </button>
        </div>
      {:else if sortedNotifications.length === 0}
        <div class="flex flex-col items-center justify-center h-48 text-gray-400">
          <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p class="text-sm">No notifications</p>
          {#if searchQuery || categoryFilter}
            <p class="text-xs mt-1">Try adjusting your filters</p>
          {/if}
        </div>
      {:else if groupByCategory && groupedNotifications}
        {#each groupedNotifications as group (group.category)}
          <div class="border-b border-gray-700 last:border-b-0" transition:slide={{ duration: 200 }}>
            <div class="px-4 py-2 bg-gray-800 sticky top-0 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm">{group.icon}</span>
                <span class="text-sm font-medium">{group.label}</span>
              </div>
              {#if group.unreadCount > 0}
                <span class="text-xs text-blue-400">{group.unreadCount} unread</span>
              {/if}
            </div>
            
            {#each group.notifications as notification (notification.id)}
              <button
                class="w-full px-4 py-3 flex gap-3 hover:bg-gray-800 transition-colors text-left {!notification.read ? 'bg-gray-800/50' : ''} {selectedNotificationId === notification.id ? 'ring-1 ring-blue-500' : ''}"
                on:click={() => handleNotificationClick(notification)}
                animate:flip={{ duration: 200, easing: quintOut }}
              >
                {#if notification.icon}
                  <img 
                    src={notification.icon} 
                    alt="" 
                    class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                {:else}
                  <div class="w-10 h-10 rounded-full {categoryMeta[notification.category].color} flex items-center justify-center flex-shrink-0">
                    <span class="text-lg">{categoryMeta[notification.category].icon}</span>
                  </div>
                {/if}
                
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-sm font-medium truncate {!notification.read ? 'text-white' : 'text-gray-300'}">
                      {notification.title}
                    </h3>
                    <span class="text-xs text-gray-500 whitespace-nowrap" title={formatAbsoluteTime(notification.timestamp)}>
                      {relativeTime ? formatRelativeTime(notification.timestamp) : formatAbsoluteTime(notification.timestamp)}
                    </span>
                  </div>
                  <p class="text-sm text-gray-400 truncate mt-0.5">{notification.body}</p>
                </div>
                
                {#if !notification.read}
                  <div class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
      {:else}
        {#each sortedNotifications as notification (notification.id)}
          <button
            class="w-full px-4 py-3 flex gap-3 hover:bg-gray-800 border-b border-gray-700 last:border-b-0 transition-colors text-left {!notification.read ? 'bg-gray-800/50' : ''} {selectedNotificationId === notification.id ? 'ring-1 ring-blue-500' : ''}"
            on:click={() => handleNotificationClick(notification)}
            animate:flip={{ duration: 200, easing: quintOut }}
            transition:fade={{ duration: 150 }}
          >
            {#if notification.icon}
              <img 
                src={notification.icon} 
                alt="" 
                class="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-10 h-10 rounded-full {categoryMeta[notification.category].color} flex items-center justify-center flex-shrink-0">
                <span class="text-lg">{categoryMeta[notification.category].icon}</span>
              </div>
            {/if}
            
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-sm font-medium truncate {!notification.read ? 'text-white' : 'text-gray-300'}">
                  {notification.title}
                </h3>
                <span class="text-xs text-gray-500 whitespace-nowrap" title={formatAbsoluteTime(notification.timestamp)}>
                  {relativeTime ? formatRelativeTime(notification.timestamp) : formatAbsoluteTime(notification.timestamp)}
                </span>
              </div>
              <p class="text-sm text-gray-400 truncate mt-0.5">{notification.body}</p>
              <span class="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
                {categoryMeta[notification.category].icon} {categoryMeta[notification.category].label}
              </span>
            </div>
            
            {#if !notification.read}
              <div class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
    
    <!-- Footer -->
    {#if notifications.length > 0}
      <footer class="p-3 border-t border-gray-700 flex items-center justify-between">
        <span class="text-xs text-gray-500">
          {totalCount} notification{totalCount !== 1 ? 's' : ''}
        </span>
        <button
          class="text-xs text-red-400 hover:text-red-300 transition-colors"
          on:click={clearHistory}
        >
          Clear history
        </button>
      </footer>
    {/if}
  </div>
{/if}

<style>
  .notification-history-panel {
    min-height: 300px;
    max-height: 600px;
  }
  
  /* Custom scrollbar */
  .notification-history-panel ::-webkit-scrollbar {
    width: 6px;
  }
  
  .notification-history-panel ::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .notification-history-panel ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  .notification-history-panel ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
