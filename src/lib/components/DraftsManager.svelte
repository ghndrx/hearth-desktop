<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, slide, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import {
    getAllDrafts,
    deleteDraft,
    clearAllDrafts,
    cleanupStaleDrafts,
    restoreDraftsFromStorage,
    onDraftEvent,
    formatDraftAge,
    type Draft
  } from '$lib/api/drafts';

  // Props
  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    navigate: { channelId: string };
    restore: { channelId: string; content: string; replyTo?: string };
  }>();

  // State
  const drafts: Writable<Draft[]> = writable([]);
  const searchQuery = writable('');
  const sortBy: Writable<'newest' | 'oldest' | 'channel'> = writable('newest');
  const loading = writable(true);

  let showClearConfirm = false;
  let refreshInterval: ReturnType<typeof setInterval>;
  let unlisteners: Array<() => void> = [];

  // Derived stores
  const filteredDrafts = derived(
    [drafts, searchQuery, sortBy],
    ([$drafts, $searchQuery, $sortBy]) => {
      let result = [...$drafts];

      // Filter by search query
      if ($searchQuery) {
        const query = $searchQuery.toLowerCase();
        result = result.filter(d =>
          d.content.toLowerCase().includes(query) ||
          d.channel_id.toLowerCase().includes(query)
        );
      }

      // Sort
      switch ($sortBy) {
        case 'newest':
          result.sort((a, b) => b.updated_at - a.updated_at);
          break;
        case 'oldest':
          result.sort((a, b) => a.updated_at - b.updated_at);
          break;
        case 'channel':
          result.sort((a, b) => a.channel_id.localeCompare(b.channel_id));
          break;
      }

      return result;
    }
  );

  const draftCount = derived(drafts, $drafts => $drafts.length);
  const totalChars = derived(drafts, $drafts =>
    $drafts.reduce((sum, d) => sum + d.content.length, 0)
  );

  // Lifecycle
  onMount(async () => {
    await restoreDraftsFromStorage();
    await loadDrafts();

    // Clean up drafts older than 7 days on startup
    await cleanupStaleDrafts();
    await loadDrafts();

    // Listen for draft changes
    const unsub1 = await onDraftEvent('draft:saved', () => loadDrafts());
    const unsub2 = await onDraftEvent('draft:deleted', () => loadDrafts());
    const unsub3 = await onDraftEvent('draft:all-cleared', () => drafts.set([]));
    unlisteners = [unsub1, unsub2, unsub3];

    // Refresh timestamps periodically
    refreshInterval = setInterval(() => {
      drafts.update(d => [...d]);
    }, 60000);
  });

  onDestroy(() => {
    unlisteners.forEach(fn => fn());
    clearInterval(refreshInterval);
  });

  async function loadDrafts() {
    try {
      loading.set(true);
      const result = await getAllDrafts();
      drafts.set(result);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      loading.set(false);
    }
  }

  async function handleDelete(channelId: string) {
    await deleteDraft(channelId);
  }

  async function handleClearAll() {
    await clearAllDrafts();
    showClearConfirm = false;
  }

  function handleRestore(draft: Draft) {
    dispatch('restore', {
      channelId: draft.channel_id,
      content: draft.content,
      replyTo: draft.reply_to
    });
  }

  function handleNavigate(channelId: string) {
    dispatch('navigate', { channelId });
  }

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  function getChannelDisplay(channelId: string): string {
    // Extract a readable name from the channel ID
    // In practice, you'd look this up from your channel store
    if (channelId.startsWith('#')) return channelId;
    return '#' + channelId.replace(/^channel[-_]/, '').replace(/[-_]/g, '-');
  }
</script>

{#if isOpen}
  <div
    class="drafts-manager"
    transition:fly={{ x: 300, duration: 200 }}
  >
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <h2>Drafts</h2>
        <span class="count">{$draftCount}</span>
      </div>
      <div class="header-actions">
        {#if $draftCount > 0}
          <button
            class="icon-btn"
            on:click={() => showClearConfirm = true}
            title="Clear all drafts"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        {/if}
        <button class="icon-btn close-btn" on:click={() => dispatch('close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search drafts..."
        bind:value={$searchQuery}
      />
    </div>

    <!-- Controls -->
    <div class="controls">
      <span class="stats">
        {$totalChars} characters across {$draftCount} draft{$draftCount !== 1 ? 's' : ''}
      </span>
      <select bind:value={$sortBy} class="sort-select">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="channel">By channel</option>
      </select>
    </div>

    <!-- Drafts list -->
    <div class="drafts-list">
      {#if $loading}
        <div class="empty-state" transition:fade>
          <div class="loading-spinner" />
          <p>Loading drafts...</p>
        </div>
      {:else if $filteredDrafts.length === 0}
        <div class="empty-state" transition:fade>
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <h3>No drafts</h3>
          <p>
            {$searchQuery
              ? 'No drafts match your search.'
              : 'Unsent messages will be auto-saved here so you never lose your work.'}
          </p>
        </div>
      {:else}
        {#each $filteredDrafts as draft (draft.channel_id)}
          <div
            class="draft-item"
            transition:fade={{ duration: 150 }}
            animate:flip={{ duration: 200 }}
          >
            <div class="draft-header">
              <button class="channel-link" on:click={() => handleNavigate(draft.channel_id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 11a9 9 0 0 1 9 9" />
                  <path d="M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1" />
                </svg>
                {getChannelDisplay(draft.channel_id)}
              </button>
              <div class="draft-actions">
                <button
                  class="action-btn restore"
                  on:click={() => handleRestore(draft)}
                  title="Restore draft"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1,4 1,10 7,10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
                <button
                  class="action-btn delete"
                  on:click={() => handleDelete(draft.channel_id)}
                  title="Delete draft"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="draft-content" on:click={() => handleRestore(draft)}>
              <p>{truncate(draft.content, 200)}</p>
            </div>

            {#if draft.reply_to}
              <div class="draft-reply">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9,17 4,12 9,7" />
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                </svg>
                <span>Replying to message</span>
              </div>
            {/if}

            {#if draft.attachments.length > 0}
              <div class="draft-attachments">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span>{draft.attachments.length} attachment{draft.attachments.length !== 1 ? 's' : ''}</span>
              </div>
            {/if}

            <div class="draft-meta">
              <span class="age">{formatDraftAge(draft.updated_at)}</span>
              <span class="chars">{draft.content.length} chars</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<!-- Clear confirmation dialog -->
{#if showClearConfirm}
  <div class="modal-overlay" transition:fade on:click={() => showClearConfirm = false}>
    <div class="modal" on:click|stopPropagation transition:fly={{ y: 20 }}>
      <h3>Clear All Drafts</h3>
      <p class="modal-description">
        Are you sure you want to delete all {$draftCount} draft{$draftCount !== 1 ? 's' : ''}?
        This action cannot be undone.
      </p>
      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => showClearConfirm = false}>Cancel</button>
        <button class="btn-danger" on:click={handleClearAll}>Delete All</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .drafts-manager {
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    max-width: 100%;
    height: 100vh;
    background: var(--bg-primary, #1e1e2e);
    border-left: 1px solid var(--border-color, #313244);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title .icon {
    width: 24px;
    height: 24px;
    color: var(--accent-color, #cba6f7);
  }

  .header-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .count {
    background: var(--bg-secondary, #313244);
    color: var(--text-secondary, #a6adc8);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-secondary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
  }

  .search-bar {
    position: relative;
    padding: 12px 16px;
  }

  .search-icon {
    position: absolute;
    left: 28px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--text-secondary, #a6adc8);
  }

  .search-bar input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    background: var(--bg-secondary, #313244);
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-bar input:focus {
    border-color: var(--accent-color, #cba6f7);
  }

  .search-bar input::placeholder {
    color: var(--text-secondary, #a6adc8);
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 12px;
    gap: 12px;
  }

  .stats {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }

  .sort-select {
    padding: 6px 12px;
    background: var(--bg-secondary, #313244);
    border: none;
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 13px;
    cursor: pointer;
  }

  .drafts-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-secondary, #a6adc8);
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--text-primary, #cdd6f4);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--bg-secondary, #313244);
    border-top-color: var(--accent-color, #cba6f7);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .draft-item {
    background: var(--bg-secondary, #313244);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 10px;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .draft-item:hover {
    border-color: var(--border-color, #45475a);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .draft-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .channel-link {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--accent-color, #cba6f7);
    font-size: 13px;
    font-weight: 500;
    padding: 2px 0;
    transition: opacity 0.2s;
  }

  .channel-link:hover {
    opacity: 0.8;
  }

  .channel-link svg {
    width: 14px;
    height: 14px;
  }

  .draft-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .draft-item:hover .draft-actions {
    opacity: 1;
  }

  .action-btn {
    background: transparent;
    border: none;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-tertiary, #45475a);
    color: var(--text-primary, #cdd6f4);
  }

  .action-btn.restore:hover {
    color: var(--accent-color, #cba6f7);
  }

  .action-btn.delete:hover {
    color: #f38ba8;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .draft-content {
    cursor: pointer;
  }

  .draft-content p {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary, #cdd6f4);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .draft-reply {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--bg-tertiary, #45475a);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }

  .draft-reply svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .draft-attachments {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }

  .draft-attachments svg {
    width: 12px;
    height: 12px;
  }

  .draft-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .modal {
    background: var(--bg-primary, #1e1e2e);
    border-radius: 12px;
    padding: 24px;
    width: 360px;
    max-width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal h3 {
    margin: 0 0 12px;
    font-size: 18px;
    color: var(--text-primary, #cdd6f4);
  }

  .modal-description {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text-secondary, #a6adc8);
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .btn-secondary,
  .btn-danger {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: var(--bg-secondary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary, #45475a);
  }

  .btn-danger {
    background: #f38ba8;
    color: #1e1e2e;
  }

  .btn-danger:hover {
    filter: brightness(1.1);
  }
</style>
