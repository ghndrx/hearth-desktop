<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, fly, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  // Types
  export interface ActivityItem {
    id: string;
    type: ActivityType;
    title: string;
    description?: string;
    timestamp: Date;
    icon?: string;
    metadata?: Record<string, unknown>;
    channel?: string;
    user?: {
      id: string;
      name: string;
      avatar?: string;
    };
    isRead?: boolean;
    isPinned?: boolean;
  }
  
  export type ActivityType = 
    | 'message'
    | 'mention'
    | 'reaction'
    | 'join'
    | 'leave'
    | 'upload'
    | 'download'
    | 'settings_change'
    | 'notification'
    | 'error'
    | 'system';
  
  export interface ActivityFilter {
    types?: ActivityType[];
    startDate?: Date;
    endDate?: Date;
    searchQuery?: string;
    showPinnedOnly?: boolean;
    showUnreadOnly?: boolean;
  }
  
  // Props
  export let maxItems: number = 100;
  export let groupByDate: boolean = true;
  export let showFilters: boolean = true;
  export let compact: boolean = false;
  export let persistActivities: boolean = true;
  export let storageKey: string = 'hearth-activity-timeline';
  
  // Dispatcher
  const dispatch = createEventDispatcher<{
    activityClick: ActivityItem;
    activityPin: ActivityItem;
    activityDelete: ActivityItem;
    activitiesClear: void;
    filterChange: ActivityFilter;
  }>();
  
  // Stores
  const activities: Writable<ActivityItem[]> = writable([]);
  const currentFilter: Writable<ActivityFilter> = writable({});
  const isLoading: Writable<boolean> = writable(false);
  const selectedActivityId: Writable<string | null> = writable(null);
  
  // Derived stores
  const filteredActivities = derived(
    [activities, currentFilter],
    ([$activities, $filter]) => {
      let result = [...$activities];
      
      // Filter by types
      if ($filter.types && $filter.types.length > 0) {
        result = result.filter(a => $filter.types!.includes(a.type));
      }
      
      // Filter by date range
      if ($filter.startDate) {
        result = result.filter(a => a.timestamp >= $filter.startDate!);
      }
      if ($filter.endDate) {
        result = result.filter(a => a.timestamp <= $filter.endDate!);
      }
      
      // Filter by search query
      if ($filter.searchQuery) {
        const query = $filter.searchQuery.toLowerCase();
        result = result.filter(a => 
          a.title.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.user?.name.toLowerCase().includes(query)
        );
      }
      
      // Filter pinned only
      if ($filter.showPinnedOnly) {
        result = result.filter(a => a.isPinned);
      }
      
      // Filter unread only
      if ($filter.showUnreadOnly) {
        result = result.filter(a => !a.isRead);
      }
      
      // Sort by timestamp (newest first)
      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return result.slice(0, maxItems);
    }
  );
  
  const groupedActivities = derived(filteredActivities, ($filtered) => {
    if (!groupByDate) {
      return [{ date: null, items: $filtered }];
    }
    
    const groups: Map<string, ActivityItem[]> = new Map();
    
    for (const activity of $filtered) {
      const dateKey = formatDateKey(activity.timestamp);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(activity);
    }
    
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items
    }));
  });
  
  const activityStats = derived(activities, ($activities) => {
    const stats = {
      total: $activities.length,
      unread: $activities.filter(a => !a.isRead).length,
      pinned: $activities.filter(a => a.isPinned).length,
      byType: {} as Record<ActivityType, number>
    };
    
    for (const activity of $activities) {
      stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
    }
    
    return stats;
  });
  
  // Utility functions
  function formatDateKey(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (activityDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else if (now.getTime() - activityDate.getTime() < 7 * 86400000) {
      return date.toLocaleDateString(undefined, { weekday: 'long' });
    } else {
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
      });
    }
  }
  
  function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatTime(date);
  }
  
  function generateId(): string {
    return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  function getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      message: '💬',
      mention: '@',
      reaction: '👍',
      join: '👋',
      leave: '🚪',
      upload: '📤',
      download: '📥',
      settings_change: '⚙️',
      notification: '🔔',
      error: '❌',
      system: '🖥️'
    };
    return icons[type] || '📌';
  }
  
  function getActivityColor(type: ActivityType): string {
    const colors: Record<ActivityType, string> = {
      message: 'bg-blue-500',
      mention: 'bg-yellow-500',
      reaction: 'bg-pink-500',
      join: 'bg-green-500',
      leave: 'bg-gray-500',
      upload: 'bg-purple-500',
      download: 'bg-indigo-500',
      settings_change: 'bg-slate-500',
      notification: 'bg-orange-500',
      error: 'bg-red-500',
      system: 'bg-cyan-500'
    };
    return colors[type] || 'bg-gray-400';
  }
  
  // Public API methods
  export function addActivity(activity: Omit<ActivityItem, 'id' | 'timestamp'> & { timestamp?: Date }): ActivityItem {
    const newActivity: ActivityItem = {
      ...activity,
      id: generateId(),
      timestamp: activity.timestamp || new Date(),
      isRead: activity.isRead ?? false,
      isPinned: activity.isPinned ?? false
    };
    
    activities.update(current => {
      const updated = [newActivity, ...current];
      if (updated.length > maxItems * 2) {
        // Keep extra buffer before trimming
        return updated.slice(0, maxItems * 1.5);
      }
      return updated;
    });
    
    saveToStorage();
    return newActivity;
  }
  
  export function removeActivity(id: string): void {
    activities.update(current => current.filter(a => a.id !== id));
    saveToStorage();
  }
  
  export function clearActivities(): void {
    activities.set([]);
    saveToStorage();
    dispatch('activitiesClear');
  }
  
  export function markAsRead(id: string): void {
    activities.update(current => 
      current.map(a => a.id === id ? { ...a, isRead: true } : a)
    );
    saveToStorage();
  }
  
  export function markAllAsRead(): void {
    activities.update(current => 
      current.map(a => ({ ...a, isRead: true }))
    );
    saveToStorage();
  }
  
  export function togglePin(id: string): void {
    let pinnedActivity: ActivityItem | undefined;
    activities.update(current => 
      current.map(a => {
        if (a.id === id) {
          pinnedActivity = { ...a, isPinned: !a.isPinned };
          return pinnedActivity;
        }
        return a;
      })
    );
    if (pinnedActivity) {
      dispatch('activityPin', pinnedActivity);
    }
    saveToStorage();
  }
  
  export function setFilter(filter: ActivityFilter): void {
    currentFilter.set(filter);
    dispatch('filterChange', filter);
  }
  
  export function getActivities(): ActivityItem[] {
    let result: ActivityItem[] = [];
    activities.subscribe(a => result = a)();
    return result;
  }
  
  // Persistence
  function saveToStorage(): void {
    if (!persistActivities || typeof localStorage === 'undefined') return;
    
    try {
      const data = getActivities().map(a => ({
        ...a,
        timestamp: a.timestamp.toISOString()
      }));
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save activities to storage:', error);
    }
  }
  
  function loadFromStorage(): void {
    if (!persistActivities || typeof localStorage === 'undefined') return;
    
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        const restored = parsed.map((a: Record<string, unknown>) => ({
          ...a,
          timestamp: new Date(a.timestamp as string)
        })) as ActivityItem[];
        activities.set(restored);
      }
    } catch (error) {
      console.warn('Failed to load activities from storage:', error);
    }
  }
  
  // Event handlers
  function handleActivityClick(activity: ActivityItem): void {
    selectedActivityId.set(activity.id);
    markAsRead(activity.id);
    dispatch('activityClick', activity);
  }
  
  function handleDeleteActivity(event: Event, activity: ActivityItem): void {
    event.stopPropagation();
    removeActivity(activity.id);
    dispatch('activityDelete', activity);
  }
  
  function handlePinActivity(event: Event, activity: ActivityItem): void {
    event.stopPropagation();
    togglePin(activity.id);
  }
  
  // Filter UI state
  let showFilterPanel = false;
  let searchQuery = '';
  let selectedTypes: ActivityType[] = [];
  
  const activityTypes: ActivityType[] = [
    'message', 'mention', 'reaction', 'join', 'leave',
    'upload', 'download', 'settings_change', 'notification', 'error', 'system'
  ];
  
  function applyFilters(): void {
    setFilter({
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      searchQuery: searchQuery || undefined
    });
  }
  
  function clearFilters(): void {
    searchQuery = '';
    selectedTypes = [];
    setFilter({});
  }
  
  function toggleTypeFilter(type: ActivityType): void {
    if (selectedTypes.includes(type)) {
      selectedTypes = selectedTypes.filter(t => t !== type);
    } else {
      selectedTypes = [...selectedTypes, type];
    }
    applyFilters();
  }
  
  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      selectedActivityId.set(null);
      showFilterPanel = false;
    }
  }
  
  // Lifecycle
  onMount(() => {
    loadFromStorage();
    window.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });
  
  // Reactive search
  $: if (searchQuery !== undefined) {
    applyFilters();
  }
</script>

<div 
  class="activity-timeline"
  class:compact
  role="log"
  aria-label="Activity Timeline"
  aria-live="polite"
>
  <!-- Header -->
  <div class="timeline-header">
    <div class="header-title">
      <h2>Activity Timeline</h2>
      {#if $activityStats.unread > 0}
        <span class="unread-badge" transition:fade={{ duration: 150 }}>
          {$activityStats.unread}
        </span>
      {/if}
    </div>
    
    <div class="header-actions">
      {#if $activityStats.unread > 0}
        <button
          class="action-btn"
          on:click={markAllAsRead}
          title="Mark all as read"
          aria-label="Mark all activities as read"
        >
          ✓
        </button>
      {/if}
      
      {#if showFilters}
        <button
          class="action-btn"
          class:active={showFilterPanel}
          on:click={() => showFilterPanel = !showFilterPanel}
          title="Toggle filters"
          aria-expanded={showFilterPanel}
          aria-controls="filter-panel"
        >
          🔍
        </button>
      {/if}
      
      {#if $activities.length > 0}
        <button
          class="action-btn danger"
          on:click={clearActivities}
          title="Clear all activities"
          aria-label="Clear all activities"
        >
          🗑️
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Filter Panel -->
  {#if showFilters && showFilterPanel}
    <div 
      id="filter-panel"
      class="filter-panel"
      transition:slide={{ duration: 200, easing: quintOut }}
    >
      <div class="search-box">
        <input
          type="text"
          placeholder="Search activities..."
          bind:value={searchQuery}
          aria-label="Search activities"
        />
        {#if searchQuery}
          <button 
            class="clear-search"
            on:click={() => searchQuery = ''}
            aria-label="Clear search"
          >
            ×
          </button>
        {/if}
      </div>
      
      <div class="type-filters">
        <span class="filter-label">Filter by type:</span>
        <div class="type-chips">
          {#each activityTypes as type}
            <button
              class="type-chip"
              class:selected={selectedTypes.includes(type)}
              on:click={() => toggleTypeFilter(type)}
              aria-pressed={selectedTypes.includes(type)}
            >
              <span class="chip-icon">{getActivityIcon(type)}</span>
              <span class="chip-label">{type.replace('_', ' ')}</span>
            </button>
          {/each}
        </div>
      </div>
      
      {#if selectedTypes.length > 0 || searchQuery}
        <button class="clear-filters" on:click={clearFilters}>
          Clear filters
        </button>
      {/if}
    </div>
  {/if}
  
  <!-- Activity List -->
  <div class="timeline-content" role="list">
    {#if $isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Loading activities...</span>
      </div>
    {:else if $groupedActivities.length === 0 || $groupedActivities[0].items.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No activities to show</p>
        {#if searchQuery || selectedTypes.length > 0}
          <button class="reset-btn" on:click={clearFilters}>
            Reset filters
          </button>
        {/if}
      </div>
    {:else}
      {#each $groupedActivities as group (group.date || 'all')}
        {#if groupByDate && group.date}
          <div class="date-header" role="heading" aria-level={3}>
            {group.date}
          </div>
        {/if}
        
        {#each group.items as activity (activity.id)}
          <div
            class="activity-item"
            class:unread={!activity.isRead}
            class:pinned={activity.isPinned}
            class:selected={$selectedActivityId === activity.id}
            role="listitem"
            tabindex="0"
            on:click={() => handleActivityClick(activity)}
            on:keypress={(e) => e.key === 'Enter' && handleActivityClick(activity)}
            in:fly={{ x: -20, duration: 200, easing: quintOut }}
            out:fade={{ duration: 150 }}
          >
            <div class="activity-icon {getActivityColor(activity.type)}">
              {activity.icon || getActivityIcon(activity.type)}
            </div>
            
            <div class="activity-content">
              <div class="activity-header">
                <span class="activity-title">{activity.title}</span>
                <span class="activity-time" title={activity.timestamp.toLocaleString()}>
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
              
              {#if activity.description && !compact}
                <p class="activity-description">{activity.description}</p>
              {/if}
              
              {#if activity.user && !compact}
                <div class="activity-user">
                  {#if activity.user.avatar}
                    <img 
                      src={activity.user.avatar} 
                      alt="" 
                      class="user-avatar"
                    />
                  {/if}
                  <span class="user-name">{activity.user.name}</span>
                </div>
              {/if}
              
              {#if activity.channel && !compact}
                <span class="activity-channel">#{activity.channel}</span>
              {/if}
            </div>
            
            <div class="activity-actions">
              <button
                class="item-action"
                class:active={activity.isPinned}
                on:click={(e) => handlePinActivity(e, activity)}
                title={activity.isPinned ? 'Unpin' : 'Pin'}
                aria-label={activity.isPinned ? 'Unpin activity' : 'Pin activity'}
              >
                📌
              </button>
              <button
                class="item-action danger"
                on:click={(e) => handleDeleteActivity(e, activity)}
                title="Delete"
                aria-label="Delete activity"
              >
                ×
              </button>
            </div>
          </div>
        {/each}
      {/each}
    {/if}
  </div>
  
  <!-- Stats Footer -->
  {#if !compact && $activities.length > 0}
    <div class="timeline-footer">
      <span class="stat">
        {$activityStats.total} total
      </span>
      {#if $activityStats.pinned > 0}
        <span class="stat">
          📌 {$activityStats.pinned} pinned
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .activity-timeline {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    border-radius: 8px;
    overflow: hidden;
    color: var(--text-primary, #e4e4e7);
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary, #16162a);
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }
  
  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-title h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .unread-badge {
    background: var(--accent-color, #6366f1);
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .action-btn {
    background: transparent;
    border: none;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.15s;
  }
  
  .action-btn:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
  }
  
  .action-btn.active {
    background: var(--accent-color, #6366f1);
  }
  
  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .filter-panel {
    padding: 12px 16px;
    background: var(--bg-tertiary, #12122a);
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }
  
  .search-box {
    position: relative;
    margin-bottom: 12px;
  }
  
  .search-box input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    background: var(--input-bg, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 6px;
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
  }
  
  .search-box input:focus {
    outline: none;
    border-color: var(--accent-color, #6366f1);
  }
  
  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted, #71717a);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
  }
  
  .type-filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .filter-label {
    font-size: 12px;
    color: var(--text-muted, #71717a);
  }
  
  .type-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .type-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--chip-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 12px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
  }
  
  .type-chip:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
  }
  
  .type-chip.selected {
    background: var(--accent-color, #6366f1);
    border-color: var(--accent-color, #6366f1);
  }
  
  .chip-icon {
    font-size: 12px;
  }
  
  .chip-label {
    text-transform: capitalize;
  }
  
  .clear-filters {
    margin-top: 12px;
    background: transparent;
    border: none;
    color: var(--accent-color, #6366f1);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 0;
  }
  
  .clear-filters:hover {
    text-decoration: underline;
  }
  
  .timeline-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--text-muted, #71717a);
    text-align: center;
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #2d2d44);
    border-top-color: var(--accent-color, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .reset-btn {
    margin-top: 12px;
    padding: 6px 12px;
    background: var(--accent-color, #6366f1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 12px;
  }
  
  .date-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #71717a);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .activity-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    margin-bottom: 4px;
    background: var(--item-bg, rgba(255, 255, 255, 0.02));
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .activity-item:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.05));
  }
  
  .activity-item.unread {
    background: var(--unread-bg, rgba(99, 102, 241, 0.1));
    border-left: 3px solid var(--accent-color, #6366f1);
  }
  
  .activity-item.pinned {
    background: var(--pinned-bg, rgba(234, 179, 8, 0.1));
  }
  
  .activity-item.selected {
    background: var(--selected-bg, rgba(99, 102, 241, 0.2));
  }
  
  .activity-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 14px;
  }
  
  .activity-content {
    flex: 1;
    min-width: 0;
  }
  
  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  
  .activity-title {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
  }
  
  .activity-time {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted, #71717a);
  }
  
  .activity-description {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
    line-height: 1.4;
  }
  
  .activity-user {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }
  
  .user-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }
  
  .user-name {
    font-size: 11px;
    color: var(--text-muted, #71717a);
  }
  
  .activity-channel {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 6px;
    background: var(--chip-bg, rgba(255, 255, 255, 0.05));
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted, #71717a);
  }
  
  .activity-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  
  .activity-item:hover .activity-actions {
    opacity: 1;
  }
  
  .item-action {
    background: transparent;
    border: none;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.6;
    transition: all 0.15s;
  }
  
  .item-action:hover {
    opacity: 1;
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
  }
  
  .item-action.active {
    opacity: 1;
  }
  
  .item-action.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .timeline-footer {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: var(--bg-secondary, #16162a);
    border-top: 1px solid var(--border-color, #2d2d44);
    font-size: 11px;
    color: var(--text-muted, #71717a);
  }
  
  /* Compact mode */
  .compact .activity-item {
    padding: 8px;
  }
  
  .compact .activity-icon {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  .compact .activity-title {
    font-size: 12px;
  }
  
  /* Color classes */
  .bg-blue-500 { background: #3b82f6; }
  .bg-yellow-500 { background: #eab308; }
  .bg-pink-500 { background: #ec4899; }
  .bg-green-500 { background: #22c55e; }
  .bg-gray-500 { background: #6b7280; }
  .bg-purple-500 { background: #a855f7; }
  .bg-indigo-500 { background: #6366f1; }
  .bg-slate-500 { background: #64748b; }
  .bg-orange-500 { background: #f97316; }
  .bg-red-500 { background: #ef4444; }
  .bg-cyan-500 { background: #06b6d4; }
  
  /* Scrollbar */
  .timeline-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .timeline-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .timeline-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
  }
  
  .timeline-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.2));
  }
</style>
