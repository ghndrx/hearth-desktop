<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  const dispatch = createEventDispatcher<{
    paste: { item: ClipboardHistoryItem };
    clear: void;
    pin: { id: string; pinned: boolean };
  }>();

  interface ClipboardHistoryItem {
    id: string;
    type: 'text' | 'image' | 'file' | 'html';
    content: string;
    preview: string;
    timestamp: number;
    pinned: boolean;
    source?: string;
    size?: number;
  }

  interface PasteHistoryConfig {
    maxItems: number;
    retentionDays: number;
    enabledTypes: ('text' | 'image' | 'file' | 'html')[];
    autoCleanup: boolean;
    showPreview: boolean;
    previewMaxLength: number;
  }

  // Props
  export let maxItems: number = 100;
  export let retentionDays: number = 7;
  export let showPanel: boolean = false;
  export let compact: boolean = false;
  export let searchEnabled: boolean = true;

  // Stores
  const history = writable<ClipboardHistoryItem[]>([]);
  const searchQuery = writable<string>('');
  const selectedType = writable<string>('all');
  const isLoading = writable<boolean>(false);
  const error = writable<string | null>(null);

  // Derived stores
  const filteredHistory = derived(
    [history, searchQuery, selectedType],
    ([$history, $searchQuery, $selectedType]) => {
      let filtered = $history;

      // Filter by type
      if ($selectedType !== 'all') {
        filtered = filtered.filter(item => item.type === $selectedType);
      }

      // Filter by search query
      if ($searchQuery.trim()) {
        const query = $searchQuery.toLowerCase();
        filtered = filtered.filter(item =>
          item.preview.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query) ||
          (item.source && item.source.toLowerCase().includes(query))
        );
      }

      // Sort: pinned items first, then by timestamp
      return filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.timestamp - a.timestamp;
      });
    }
  );

  const stats = derived(history, ($history) => ({
    total: $history.length,
    text: $history.filter(i => i.type === 'text').length,
    image: $history.filter(i => i.type === 'image').length,
    file: $history.filter(i => i.type === 'file').length,
    html: $history.filter(i => i.type === 'html').length,
    pinned: $history.filter(i => i.pinned).length,
    totalSize: $history.reduce((sum, i) => sum + (i.size || i.content.length), 0),
  }));

  let unlistenClipboard: UnlistenFn | null = null;
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;
  let initialized = false;

  // Config
  const config: PasteHistoryConfig = {
    maxItems,
    retentionDays,
    enabledTypes: ['text', 'image', 'file', 'html'],
    autoCleanup: true,
    showPreview: true,
    previewMaxLength: 200,
  };

  // Generate unique ID
  function generateId(): string {
    return `clip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Create preview from content
  function createPreview(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  // Format timestamp for display
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Format size for display
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Get icon for item type
  function getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      text: '📝',
      image: '🖼️',
      file: '📁',
      html: '🌐',
    };
    return icons[type] || '📋';
  }

  // Load history from storage
  async function loadHistory(): Promise<void> {
    isLoading.set(true);
    error.set(null);

    try {
      const stored = await invoke<ClipboardHistoryItem[]>('get_clipboard_history').catch(() => null);

      if (stored && Array.isArray(stored)) {
        history.set(stored);
      } else {
        // Fallback to localStorage
        const localStored = localStorage.getItem('hearth_clipboard_history');
        if (localStored) {
          history.set(JSON.parse(localStored));
        }
      }
    } catch (err) {
      console.error('Failed to load clipboard history:', err);
      error.set('Failed to load clipboard history');
    } finally {
      isLoading.set(false);
    }
  }

  // Save history to storage
  async function saveHistory(): Promise<void> {
    const currentHistory = [...$history];

    try {
      await invoke('save_clipboard_history', { history: currentHistory }).catch(() => null);
    } catch {
      // Fallback to localStorage
      localStorage.setItem('hearth_clipboard_history', JSON.stringify(currentHistory));
    }
  }

  // Add item to history
  async function addToHistory(
    content: string,
    type: ClipboardHistoryItem['type'] = 'text',
    source?: string
  ): Promise<void> {
    if (!config.enabledTypes.includes(type)) return;

    // Check for duplicates (same content within last 5 seconds)
    const recent = $history.find(
      item =>
        item.content === content &&
        Date.now() - item.timestamp < 5000
    );
    if (recent) return;

    const newItem: ClipboardHistoryItem = {
      id: generateId(),
      type,
      content,
      preview: createPreview(content, config.previewMaxLength),
      timestamp: Date.now(),
      pinned: false,
      source,
      size: new Blob([content]).size,
    };

    history.update(h => {
      const updated = [newItem, ...h];
      // Remove oldest non-pinned items if over limit
      while (updated.length > config.maxItems) {
        const unpinnedIndex = updated.findIndex((item, idx) => !item.pinned && idx > 0);
        if (unpinnedIndex !== -1) {
          updated.splice(unpinnedIndex, 1);
        } else {
          break;
        }
      }
      return updated;
    });

    await saveHistory();
  }

  // Paste item (copy back to clipboard)
  async function pasteItem(item: ClipboardHistoryItem): Promise<void> {
    try {
      await invoke('write_clipboard', { content: item.content, contentType: item.type });

      // Move to top of history
      history.update(h => {
        const filtered = h.filter(i => i.id !== item.id);
        return [{ ...item, timestamp: Date.now() }, ...filtered];
      });

      dispatch('paste', { item });
      await saveHistory();
    } catch (err) {
      console.error('Failed to paste item:', err);
      // Fallback: use navigator.clipboard
      try {
        await navigator.clipboard.writeText(item.content);
        dispatch('paste', { item });
      } catch {
        error.set('Failed to paste item');
      }
    }
  }

  // Toggle pin status
  async function togglePin(id: string): Promise<void> {
    history.update(h =>
      h.map(item =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );

    const item = $history.find(i => i.id === id);
    if (item) {
      dispatch('pin', { id, pinned: item.pinned });
    }

    await saveHistory();
  }

  // Delete single item
  async function deleteItem(id: string): Promise<void> {
    history.update(h => h.filter(item => item.id !== id));
    await saveHistory();
  }

  // Clear all non-pinned items
  async function clearHistory(): Promise<void> {
    history.update(h => h.filter(item => item.pinned));
    dispatch('clear');
    await saveHistory();
  }

  // Cleanup old items
  async function cleanupOldItems(): Promise<void> {
    const cutoffTime = Date.now() - (config.retentionDays * 24 * 60 * 60 * 1000);

    history.update(h =>
      h.filter(item => item.pinned || item.timestamp > cutoffTime)
    );

    await saveHistory();
  }

  // Setup clipboard listener
  async function setupClipboardListener(): Promise<void> {
    try {
      unlistenClipboard = await listen<{ content: string; type: string; source?: string }>(
        'clipboard-change',
        (event) => {
          const { content, type, source } = event.payload;
          addToHistory(content, type as ClipboardHistoryItem['type'], source);
        }
      );

      // Start clipboard monitoring
      await invoke('start_clipboard_monitor').catch(() => {
        console.warn('Native clipboard monitoring not available');
      });
    } catch (err) {
      console.warn('Failed to setup clipboard listener:', err);
    }
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent): void {
    if (!showPanel) return;

    if (event.key === 'Escape') {
      showPanel = false;
      event.preventDefault();
    }

    // Ctrl/Cmd + number to quick paste
    if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
      const index = parseInt(event.key) - 1;
      const items = $filteredHistory;
      if (items[index]) {
        pasteItem(items[index]);
        event.preventDefault();
      }
    }
  }

  // Export history
  async function exportHistory(): Promise<void> {
    const data = JSON.stringify($history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipboard-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Lifecycle
  onMount(async () => {
    await loadHistory();
    await setupClipboardListener();

    // Setup auto-cleanup
    if (config.autoCleanup) {
      cleanupInterval = setInterval(cleanupOldItems, 60 * 60 * 1000); // Every hour
    }

    window.addEventListener('keydown', handleKeydown);
    initialized = true;
  });

  onDestroy(() => {
    if (unlistenClipboard) {
      unlistenClipboard();
    }
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    window.removeEventListener('keydown', handleKeydown);
  });

  // Reactive refs
  $: items = $filteredHistory;
  $: currentStats = $stats;
  $: loading = $isLoading;
  $: errorMsg = $error;
</script>

{#if showPanel}
  <div
    class="paste-history-manager"
    class:compact
    role="dialog"
    aria-label="Clipboard History"
  >
    <div class="header">
      <h3>📋 Clipboard History</h3>
      <div class="header-actions">
        <button
          class="icon-btn"
          title="Export History"
          on:click={exportHistory}
        >
          📤
        </button>
        <button
          class="icon-btn danger"
          title="Clear History"
          on:click={clearHistory}
        >
          🗑️
        </button>
        <button
          class="icon-btn"
          title="Close"
          on:click={() => (showPanel = false)}
        >
          ✕
        </button>
      </div>
    </div>

    {#if searchEnabled}
      <div class="search-bar">
        <input
          type="text"
          placeholder="Search clipboard history..."
          bind:value={$searchQuery}
          class="search-input"
        />
        <select bind:value={$selectedType} class="type-filter">
          <option value="all">All Types</option>
          <option value="text">📝 Text ({currentStats.text})</option>
          <option value="image">🖼️ Image ({currentStats.image})</option>
          <option value="file">📁 File ({currentStats.file})</option>
          <option value="html">🌐 HTML ({currentStats.html})</option>
        </select>
      </div>
    {/if}

    <div class="stats-bar">
      <span>{currentStats.total} items</span>
      <span>•</span>
      <span>{currentStats.pinned} pinned</span>
      <span>•</span>
      <span>{formatSize(currentStats.totalSize)}</span>
    </div>

    {#if errorMsg}
      <div class="error-banner">
        ⚠️ {errorMsg}
        <button on:click={() => error.set(null)}>Dismiss</button>
      </div>
    {/if}

    <div class="history-list" role="list">
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading history...</span>
        </div>
      {:else if items.length === 0}
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>No clipboard history yet</p>
          <small>Copy something to get started</small>
        </div>
      {:else}
        {#each items as item, index (item.id)}
          <div
            class="history-item"
            class:pinned={item.pinned}
            role="listitem"
            tabindex="0"
            on:click={() => pasteItem(item)}
            on:keypress={(e) => e.key === 'Enter' && pasteItem(item)}
          >
            <div class="item-icon">
              {getTypeIcon(item.type)}
            </div>
            <div class="item-content">
              <div class="item-preview">
                {item.preview}
              </div>
              <div class="item-meta">
                <span class="timestamp">{formatTimestamp(item.timestamp)}</span>
                {#if item.source}
                  <span class="source">from {item.source}</span>
                {/if}
                {#if item.size}
                  <span class="size">{formatSize(item.size)}</span>
                {/if}
              </div>
            </div>
            <div class="item-actions">
              {#if !compact && index < 9}
                <span class="shortcut-hint">⌘{index + 1}</span>
              {/if}
              <button
                class="action-btn"
                class:active={item.pinned}
                title={item.pinned ? 'Unpin' : 'Pin'}
                on:click|stopPropagation={() => togglePin(item.id)}
              >
                {item.pinned ? '📌' : '📍'}
              </button>
              <button
                class="action-btn danger"
                title="Delete"
                on:click|stopPropagation={() => deleteItem(item.id)}
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="footer">
      <small>Press Esc to close • Click item to paste</small>
    </div>
  </div>
{/if}

<style>
  .paste-history-manager {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 480px;
    max-width: 95vw;
    max-height: 80vh;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    z-index: 10000;
    overflow: hidden;
  }

  .paste-history-manager.compact {
    width: 320px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252525);
  }

  .header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 6px;
    cursor: pointer;
    border-radius: 6px;
    font-size: 14px;
    transition: background 0.15s;
  }

  .icon-btn:hover {
    background: var(--bg-hover, #333);
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .search-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .type-filter {
    padding: 8px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 13px;
    cursor: pointer;
  }

  .stats-bar {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-secondary, #888);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 13px;
  }

  .error-banner button {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--text-secondary, #888);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0 0 8px;
    font-size: 14px;
  }

  .empty-state small {
    font-size: 12px;
    opacity: 0.7;
  }

  .history-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .history-item:hover {
    background: var(--bg-hover, #2a2a2a);
  }

  .history-item:focus {
    outline: none;
    background: var(--bg-hover, #2a2a2a);
    box-shadow: inset 0 0 0 2px var(--accent-color, #3b82f6);
  }

  .history-item.pinned {
    background: rgba(59, 130, 246, 0.1);
    border-left: 3px solid var(--accent-color, #3b82f6);
  }

  .item-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-preview {
    font-size: 14px;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  .item-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary, #888);
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .history-item:hover .item-actions,
  .history-item:focus .item-actions {
    opacity: 1;
  }

  .shortcut-hint {
    font-size: 10px;
    color: var(--text-secondary, #666);
    background: var(--bg-tertiary, #333);
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.15s, background 0.15s;
  }

  .action-btn:hover {
    opacity: 1;
    background: var(--bg-tertiary, #333);
  }

  .action-btn.active {
    opacity: 1;
  }

  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #333);
    text-align: center;
  }

  .footer small {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
</style>
