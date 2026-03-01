<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  const dispatch = createEventDispatcher<{
    share: { target: ShareTarget; result: ShareResult };
    close: void;
    error: { message: string };
  }>();

  interface ShareItem {
    title?: string;
    text?: string;
    url?: string;
    filePaths?: string[];
  }

  interface ShareTarget {
    id: string;
    name: string;
    icon?: string;
  }

  interface ShareResult {
    success: boolean;
    error?: string;
    sharedTo?: string;
  }

  // Props
  export let isOpen = false;
  export let item: ShareItem = {};
  export let showPreview = true;

  // State
  let targets: ShareTarget[] = [];
  let loading = true;
  let sharing = false;
  let selectedTarget: ShareTarget | null = null;
  let recentTargets: string[] = [];
  let searchQuery = '';
  let shareResult: ShareResult | null = null;
  let showSuccess = false;

  // Icons mapping
  const iconMap: Record<string, string> = {
    message: '💬',
    envelope: '✉️',
    note: '📝',
    airdrop: '📡',
    clipboard: '📋',
    folder: '📁',
    wifi: '📶',
    share: '🔗',
  };

  $: filteredTargets = searchQuery
    ? targets.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : targets;

  $: sortedTargets = [...filteredTargets].sort((a, b) => {
    // Recent targets first
    const aRecent = recentTargets.indexOf(a.id);
    const bRecent = recentTargets.indexOf(b.id);
    if (aRecent >= 0 && bRecent < 0) return -1;
    if (bRecent >= 0 && aRecent < 0) return 1;
    if (aRecent >= 0 && bRecent >= 0) return aRecent - bRecent;
    return 0;
  });

  $: previewText = item.text || item.url || item.title || 'No content';
  $: truncatedPreview = previewText.length > 100 
    ? previewText.substring(0, 100) + '...' 
    : previewText;

  onMount(async () => {
    await loadTargets();
    loadRecentTargets();
    
    // Handle keyboard
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  async function loadTargets() {
    loading = true;
    try {
      targets = await invoke<ShareTarget[]>('get_share_targets');
    } catch (error) {
      console.error('Failed to load share targets:', error);
      dispatch('error', { message: 'Failed to load share options' });
    } finally {
      loading = false;
    }
  }

  function loadRecentTargets() {
    try {
      const stored = localStorage.getItem('hearth:recent-share-targets');
      if (stored) {
        recentTargets = JSON.parse(stored);
      }
    } catch {
      recentTargets = [];
    }
  }

  function saveRecentTarget(targetId: string) {
    recentTargets = [
      targetId,
      ...recentTargets.filter(id => id !== targetId)
    ].slice(0, 5);
    
    try {
      localStorage.setItem('hearth:recent-share-targets', JSON.stringify(recentTargets));
    } catch {
      // Ignore storage errors
    }
  }

  async function shareToTarget(target: ShareTarget) {
    if (sharing) return;
    
    sharing = true;
    selectedTarget = target;

    try {
      const result = await invoke<ShareResult>('share_content', {
        item: {
          title: item.title,
          text: item.text,
          url: item.url,
          file_paths: item.filePaths,
        },
        targetId: target.id,
      });

      shareResult = result;

      if (result.success) {
        saveRecentTarget(target.id);
        showSuccess = true;
        
        setTimeout(() => {
          showSuccess = false;
          dispatch('share', { target, result });
          close();
        }, 1500);
      } else {
        dispatch('error', { message: result.error || 'Share failed' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Share failed';
      dispatch('error', { message });
    } finally {
      sharing = false;
      selectedTarget = null;
    }
  }

  async function copyToClipboard() {
    const clipboardTarget = targets.find(t => t.id === 'clipboard');
    if (clipboardTarget) {
      await shareToTarget(clipboardTarget);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'c' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      copyToClipboard();
    }
  }

  function close() {
    isOpen = false;
    searchQuery = '';
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function getIcon(iconName?: string): string {
    if (!iconName) return '🔗';
    return iconMap[iconName] || '🔗';
  }
</script>

{#if isOpen}
  <div
    class="share-sheet-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-label="Share"
  >
    <div
      class="share-sheet"
      transition:fly={{ y: 50, duration: 300, easing: quintOut }}
    >
      <!-- Header -->
      <div class="share-header">
        <h2>Share</h2>
        <button class="close-btn" on:click={close} aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <!-- Preview -->
      {#if showPreview && !showSuccess}
        <div class="share-preview" transition:fade>
          <div class="preview-content">
            {#if item.title}
              <div class="preview-title">{item.title}</div>
            {/if}
            <div class="preview-text">{truncatedPreview}</div>
            {#if item.url && item.url !== item.text}
              <div class="preview-url">{item.url}</div>
            {/if}
            {#if item.filePaths && item.filePaths.length > 0}
              <div class="preview-files">
                📎 {item.filePaths.length} file{item.filePaths.length !== 1 ? 's' : ''}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Success State -->
      {#if showSuccess}
        <div class="success-state" transition:scale={{ duration: 300 }}>
          <div class="success-icon">✓</div>
          <div class="success-text">
            Shared to {shareResult?.sharedTo || 'destination'}
          </div>
        </div>
      {:else}
        <!-- Search -->
        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="Search share options..."
            bind:value={searchQuery}
            aria-label="Search share options"
          />
        </div>

        <!-- Targets Grid -->
        <div class="targets-container">
          {#if loading}
            <div class="loading-state">
              <div class="loading-spinner"></div>
              <span>Loading share options...</span>
            </div>
          {:else if sortedTargets.length === 0}
            <div class="empty-state">
              <span>No share options found</span>
            </div>
          {:else}
            <div class="targets-grid">
              {#each sortedTargets as target (target.id)}
                <button
                  class="target-btn"
                  class:selected={selectedTarget?.id === target.id}
                  class:recent={recentTargets.includes(target.id)}
                  on:click={() => shareToTarget(target)}
                  disabled={sharing}
                  aria-label={`Share to ${target.name}`}
                >
                  <div class="target-icon">
                    {getIcon(target.icon)}
                  </div>
                  <div class="target-name">{target.name}</div>
                  {#if sharing && selectedTarget?.id === target.id}
                    <div class="target-loading"></div>
                  {/if}
                  {#if recentTargets.includes(target.id)}
                    <div class="recent-badge" title="Recently used">⏱</div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button
            class="quick-action-btn"
            on:click={copyToClipboard}
            disabled={sharing}
          >
            <span class="quick-icon">📋</span>
            <span>Copy</span>
            <kbd>⌘C</kbd>
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .share-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .share-sheet {
    background: var(--bg-primary, #1e1e1e);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.3);
  }

  @media (min-width: 640px) {
    .share-sheet {
      border-radius: 16px;
      margin-bottom: 5vh;
      max-height: 70vh;
    }
  }

  .share-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .share-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: var(--bg-secondary, #333);
    border-radius: 50%;
    color: var(--text-secondary, #999);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--bg-tertiary, #444);
    color: var(--text-primary, #fff);
  }

  .share-preview {
    padding: 16px 20px;
    background: var(--bg-secondary, #252525);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .preview-content {
    border-radius: 8px;
    padding: 12px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
  }

  .preview-title {
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin-bottom: 4px;
  }

  .preview-text {
    color: var(--text-secondary, #999);
    font-size: 14px;
    line-height: 1.4;
    word-break: break-word;
  }

  .preview-url {
    margin-top: 8px;
    color: var(--accent-color, #5865f2);
    font-size: 12px;
    word-break: break-all;
  }

  .preview-files {
    margin-top: 8px;
    color: var(--text-secondary, #999);
    font-size: 13px;
  }

  .success-state {
    padding: 48px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    background: var(--success-color, #43b581);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: white;
  }

  .success-text {
    color: var(--text-primary, #fff);
    font-size: 16px;
    font-weight: 500;
  }

  .search-container {
    padding: 12px 20px;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    background: var(--bg-secondary, #252525);
    color: var(--text-primary, #fff);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    border-color: var(--accent-color, #5865f2);
  }

  .search-input::placeholder {
    color: var(--text-tertiary, #666);
  }

  .targets-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 16px;
  }

  .loading-state,
  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--text-secondary, #999);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #5865f2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .targets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .target-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    background: var(--bg-secondary, #252525);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .target-btn:hover:not(:disabled) {
    background: var(--bg-tertiary, #2a2a2a);
    border-color: var(--accent-color, #5865f2);
    transform: translateY(-2px);
  }

  .target-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .target-btn.selected {
    border-color: var(--accent-color, #5865f2);
    background: var(--accent-color-alpha, rgba(88, 101, 242, 0.1));
  }

  .target-btn.recent {
    border-color: var(--warning-color, #faa61a);
  }

  .target-icon {
    font-size: 32px;
    line-height: 1;
  }

  .target-name {
    font-size: 12px;
    color: var(--text-primary, #fff);
    text-align: center;
    line-height: 1.3;
  }

  .target-loading {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .target-loading::after {
    content: '';
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .recent-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 10px;
    opacity: 0.7;
  }

  .quick-actions {
    display: flex;
    gap: 12px;
    padding: 12px 20px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252525);
  }

  .quick-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    background: var(--bg-primary, #1e1e1e);
    color: var(--text-primary, #fff);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-action-btn:hover:not(:disabled) {
    background: var(--bg-tertiary, #2a2a2a);
    border-color: var(--accent-color, #5865f2);
  }

  .quick-action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .quick-icon {
    font-size: 16px;
  }

  kbd {
    padding: 2px 6px;
    background: var(--bg-secondary, #333);
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    color: var(--text-tertiary, #666);
  }
</style>
