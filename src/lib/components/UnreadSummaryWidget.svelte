<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fade, fly, scale } from 'svelte/transition';
  import { spring } from 'svelte/motion';

  interface UnreadItem {
    id: string;
    name: string;
    type: 'server' | 'dm' | 'channel';
    unreadCount: number;
    mentionCount: number;
    iconUrl?: string;
    lastMessagePreview?: string;
    lastMessageTime?: string;
    priority: 'normal' | 'high' | 'urgent';
  }

  interface UnreadSummary {
    totalUnread: number;
    totalMentions: number;
    items: UnreadItem[];
    lastUpdated: string;
  }

  // Props
  export let maxItems = 10;
  export let showPreview = true;
  export let autoRefreshInterval = 30000; // 30 seconds
  export let compact = false;
  export let groupByType = true;
  export let animateChanges = true;

  const dispatch = createEventDispatcher<{
    itemClick: { item: UnreadItem };
    markAllRead: void;
    refresh: void;
    error: { message: string };
  }>();

  // State
  let summary: UnreadSummary | null = null;
  let loading = true;
  let error: string | null = null;
  let expanded = false;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let lastRefresh = Date.now();

  // Animated counters
  const totalUnreadSpring = spring(0, { stiffness: 0.1, damping: 0.4 });
  const totalMentionsSpring = spring(0, { stiffness: 0.1, damping: 0.4 });

  // Computed
  $: groupedItems = groupByType ? groupItemsByType(summary?.items || []) : { all: summary?.items || [] };
  $: hasUrgent = summary?.items.some(item => item.priority === 'urgent') || false;
  $: hasMentions = (summary?.totalMentions || 0) > 0;

  function groupItemsByType(items: UnreadItem[]): Record<string, UnreadItem[]> {
    if (!groupByType) return { all: items };
    
    return items.reduce((acc, item) => {
      const key = item.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, UnreadItem[]>);
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'server': return 'Servers';
      case 'dm': return 'Direct Messages';
      case 'channel': return 'Channels';
      default: return 'All';
    }
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'server': return '🏠';
      case 'dm': return '💬';
      case 'channel': return '#️⃣';
      default: return '📬';
    }
  }

  function getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      default: return 'priority-normal';
    }
  }

  function formatTime(timestamp: string | undefined): string {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  function truncatePreview(text: string | undefined, maxLength = 50): string {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  async function fetchUnreadSummary(): Promise<void> {
    try {
      loading = true;
      error = null;
      
      const result = await invoke<UnreadSummary>('get_unread_summary', {
        maxItems
      });
      
      summary = result;
      lastRefresh = Date.now();
      
      if (animateChanges) {
        totalUnreadSpring.set(result.totalUnread);
        totalMentionsSpring.set(result.totalMentions);
      }
      
      dispatch('refresh');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to fetch unread summary';
      dispatch('error', { message: error });
    } finally {
      loading = false;
    }
  }

  async function markAllAsRead(): Promise<void> {
    try {
      await invoke('mark_all_as_read');
      summary = {
        ...summary!,
        totalUnread: 0,
        totalMentions: 0,
        items: []
      };
      totalUnreadSpring.set(0);
      totalMentionsSpring.set(0);
      dispatch('markAllRead');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to mark all as read';
      dispatch('error', { message: error });
    }
  }

  async function handleItemClick(item: UnreadItem): Promise<void> {
    dispatch('itemClick', { item });
    
    try {
      await invoke('navigate_to_unread', {
        itemId: item.id,
        itemType: item.type
      });
    } catch (err) {
      console.error('Navigation failed:', err);
    }
  }

  function toggleExpanded(): void {
    expanded = !expanded;
  }

  function startAutoRefresh(): void {
    if (autoRefreshInterval > 0) {
      refreshTimer = setInterval(fetchUnreadSummary, autoRefreshInterval);
    }
  }

  function stopAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  onMount(() => {
    fetchUnreadSummary();
    startAutoRefresh();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });
</script>

<div 
  class="unread-summary-widget"
  class:compact
  class:expanded
  class:has-urgent={hasUrgent}
  class:has-mentions={hasMentions}
>
  <!-- Header / Summary Bar -->
  <button 
    class="summary-header"
    on:click={toggleExpanded}
    aria-expanded={expanded}
    aria-label="Unread messages summary"
  >
    <div class="summary-icon">
      {#if loading}
        <span class="loading-spinner">⏳</span>
      {:else if hasUrgent}
        <span class="pulse">🔔</span>
      {:else if hasMentions}
        <span>💬</span>
      {:else if (summary?.totalUnread || 0) > 0}
        <span>📬</span>
      {:else}
        <span>✅</span>
      {/if}
    </div>
    
    <div class="summary-counts">
      {#if animateChanges}
        <span class="unread-count" class:has-unreads={$totalUnreadSpring > 0}>
          {Math.round($totalUnreadSpring)} unread
        </span>
        {#if $totalMentionsSpring > 0}
          <span class="mention-count" in:scale>
            @{Math.round($totalMentionsSpring)}
          </span>
        {/if}
      {:else}
        <span class="unread-count" class:has-unreads={(summary?.totalUnread || 0) > 0}>
          {summary?.totalUnread || 0} unread
        </span>
        {#if (summary?.totalMentions || 0) > 0}
          <span class="mention-count">
            @{summary?.totalMentions}
          </span>
        {/if}
      {/if}
    </div>
    
    <div class="expand-indicator" class:rotated={expanded}>
      ▼
    </div>
  </button>

  <!-- Expanded Panel -->
  {#if expanded}
    <div class="summary-panel" transition:fly={{ y: -10, duration: 200 }}>
      {#if error}
        <div class="error-message" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
          <button on:click={fetchUnreadSummary} class="retry-btn">Retry</button>
        </div>
      {:else if loading && !summary}
        <div class="loading-state">
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
        </div>
      {:else if !summary || summary.items.length === 0}
        <div class="empty-state">
          <span class="empty-icon">🎉</span>
          <span class="empty-text">All caught up!</span>
        </div>
      {:else}
        <div class="items-list">
          {#each Object.entries(groupedItems) as [type, items] (type)}
            {#if groupByType && type !== 'all'}
              <div class="type-header">
                <span class="type-icon">{getTypeIcon(type)}</span>
                <span class="type-label">{getTypeLabel(type)}</span>
                <span class="type-count">{items.length}</span>
              </div>
            {/if}
            
            {#each items.slice(0, maxItems) as item (item.id)}
              <button
                class="unread-item {getPriorityClass(item.priority)}"
                on:click={() => handleItemClick(item)}
                in:fade={{ duration: 150 }}
              >
                <div class="item-icon">
                  {#if item.iconUrl}
                    <img src={item.iconUrl} alt="" class="item-avatar" />
                  {:else}
                    <span class="item-placeholder">{item.name.charAt(0)}</span>
                  {/if}
                </div>
                
                <div class="item-content">
                  <div class="item-header">
                    <span class="item-name">{item.name}</span>
                    {#if item.lastMessageTime}
                      <span class="item-time">{formatTime(item.lastMessageTime)}</span>
                    {/if}
                  </div>
                  
                  {#if showPreview && item.lastMessagePreview}
                    <div class="item-preview">
                      {truncatePreview(item.lastMessagePreview)}
                    </div>
                  {/if}
                </div>
                
                <div class="item-badges">
                  {#if item.unreadCount > 0}
                    <span class="badge unread-badge">{item.unreadCount}</span>
                  {/if}
                  {#if item.mentionCount > 0}
                    <span class="badge mention-badge">@{item.mentionCount}</span>
                  {/if}
                </div>
              </button>
            {/each}
          {/each}
        </div>
        
        <div class="panel-actions">
          <button class="action-btn refresh-btn" on:click={fetchUnreadSummary} disabled={loading}>
            <span class:spinning={loading}>🔄</span>
            Refresh
          </button>
          <button 
            class="action-btn mark-read-btn" 
            on:click={markAllAsRead}
            disabled={(summary?.totalUnread || 0) === 0}
          >
            <span>✓</span>
            Mark all read
          </button>
        </div>
        
        <div class="last-refresh">
          Updated {formatTime(new Date(lastRefresh).toISOString())}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .unread-summary-widget {
    --widget-bg: var(--bg-secondary, #2f3136);
    --widget-border: var(--border-color, #202225);
    --text-primary: var(--text-color, #dcddde);
    --text-secondary: var(--text-muted, #72767d);
    --accent-color: var(--brand-color, #5865f2);
    --urgent-color: #ed4245;
    --mention-color: #faa61a;
    --success-color: #3ba55c;
    
    position: relative;
    background: var(--widget-bg);
    border: 1px solid var(--widget-border);
    border-radius: 8px;
    overflow: hidden;
    font-family: var(--font-family, system-ui, -apple-system, sans-serif);
    user-select: none;
  }

  .unread-summary-widget.compact {
    border-radius: 4px;
  }

  .unread-summary-widget.has-urgent {
    border-color: var(--urgent-color);
    box-shadow: 0 0 10px rgba(237, 66, 69, 0.3);
  }

  .unread-summary-widget.has-mentions:not(.has-urgent) {
    border-color: var(--mention-color);
  }

  .summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .summary-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .compact .summary-header {
    padding: 6px 8px;
    gap: 6px;
  }

  .summary-icon {
    font-size: 1.2em;
    line-height: 1;
  }

  .loading-spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  .pulse {
    display: inline-block;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }

  .summary-counts {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9em;
  }

  .unread-count {
    color: var(--text-secondary);
  }

  .unread-count.has-unreads {
    color: var(--text-primary);
    font-weight: 500;
  }

  .mention-count {
    background: var(--urgent-color);
    color: white;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 0.8em;
    font-weight: 600;
  }

  .expand-indicator {
    font-size: 0.7em;
    color: var(--text-secondary);
    transition: transform 0.2s ease;
  }

  .expand-indicator.rotated {
    transform: rotate(180deg);
  }

  .summary-panel {
    border-top: 1px solid var(--widget-border);
    max-height: 400px;
    overflow-y: auto;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    color: var(--urgent-color);
    font-size: 0.85em;
  }

  .retry-btn {
    margin-left: auto;
    padding: 4px 8px;
    background: var(--urgent-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
  }

  .loading-state {
    padding: 12px;
  }

  .skeleton-item {
    height: 40px;
    margin-bottom: 8px;
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.05) 0%,
      rgba(255,255,255,0.1) 50%,
      rgba(255,255,255,0.05) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 2em;
  }

  .empty-text {
    font-size: 0.9em;
  }

  .items-list {
    padding: 8px 0;
  }

  .type-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .type-count {
    margin-left: auto;
    background: rgba(255,255,255,0.1);
    padding: 1px 6px;
    border-radius: 10px;
  }

  .unread-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.15s ease;
    text-align: left;
  }

  .unread-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .unread-item.priority-urgent {
    background: rgba(237, 66, 69, 0.1);
  }

  .unread-item.priority-urgent:hover {
    background: rgba(237, 66, 69, 0.15);
  }

  .unread-item.priority-high {
    background: rgba(250, 166, 26, 0.1);
  }

  .item-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .item-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .item-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--accent-color);
    color: white;
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.9em;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .item-name {
    font-weight: 500;
    font-size: 0.9em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-time {
    font-size: 0.75em;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .item-preview {
    font-size: 0.8em;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .item-badges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.75em;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
  }

  .unread-badge {
    background: var(--text-secondary);
    color: white;
  }

  .mention-badge {
    background: var(--urgent-color);
    color: white;
  }

  .panel-actions {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--widget-border);
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255,255,255,0.05);
    border: none;
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.85em;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  .last-refresh {
    text-align: center;
    font-size: 0.7em;
    color: var(--text-secondary);
    padding: 6px;
  }
</style>
</script>
