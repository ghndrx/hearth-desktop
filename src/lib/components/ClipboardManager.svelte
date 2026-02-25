<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let maxHistoryDisplay: number = 10;
  export let showHistory: boolean = false;
  export let autoTrackCopies: boolean = true;
  
  // Types
  interface ClipboardContent {
    type: 'Text' | 'Html' | 'Image' | 'Files' | 'Empty';
    data?: string | { html: string; plain?: string } | { base64: string; width: number; height: number; format: string } | string[];
  }
  
  interface ClipboardEntry {
    id: string;
    content: ClipboardContent;
    timestamp: number;
    source?: string;
  }
  
  // State
  let history: ClipboardEntry[] = [];
  let currentContent: ClipboardContent | null = null;
  let isLoading: boolean = false;
  let error: string | null = null;
  
  // Reactive
  $: displayedHistory = history.slice(0, maxHistoryDisplay);
  
  /**
   * Copy text to clipboard
   */
  export async function copyText(text: string, trackHistory: boolean = autoTrackCopies): Promise<ClipboardEntry | null> {
    try {
      isLoading = true;
      error = null;
      
      const entry = await invoke<ClipboardEntry>('clipboard_copy_text', {
        text,
        trackHistory
      });
      
      if (trackHistory) {
        await refreshHistory();
      }
      
      dispatch('copy', { type: 'text', entry });
      return entry;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'copy', error });
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Copy HTML to clipboard with plain text fallback
   */
  export async function copyHtml(
    html: string, 
    plainText?: string,
    trackHistory: boolean = autoTrackCopies
  ): Promise<ClipboardEntry | null> {
    try {
      isLoading = true;
      error = null;
      
      const entry = await invoke<ClipboardEntry>('clipboard_copy_html', {
        html,
        plainText,
        trackHistory
      });
      
      if (trackHistory) {
        await refreshHistory();
      }
      
      dispatch('copy', { type: 'html', entry });
      return entry;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'copy', error });
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Copy image to clipboard from base64
   */
  export async function copyImage(
    base64Data: string,
    trackHistory: boolean = autoTrackCopies
  ): Promise<ClipboardEntry | null> {
    try {
      isLoading = true;
      error = null;
      
      const entry = await invoke<ClipboardEntry>('clipboard_copy_image', {
        base64Data,
        trackHistory
      });
      
      if (trackHistory) {
        await refreshHistory();
      }
      
      dispatch('copy', { type: 'image', entry });
      return entry;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'copy', error });
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Read current clipboard content
   */
  export async function read(): Promise<ClipboardContent | null> {
    try {
      isLoading = true;
      error = null;
      
      currentContent = await invoke<ClipboardContent>('clipboard_read');
      return currentContent;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'read', error });
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Refresh clipboard history
   */
  export async function refreshHistory(): Promise<void> {
    try {
      history = await invoke<ClipboardEntry[]>('clipboard_get_history', {
        limit: 100
      });
    } catch (err) {
      console.error('Failed to refresh clipboard history:', err);
    }
  }
  
  /**
   * Clear clipboard history
   */
  export async function clearHistory(): Promise<void> {
    try {
      isLoading = true;
      error = null;
      
      await invoke('clipboard_clear_history');
      history = [];
      
      dispatch('historyClear');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'clearHistory', error });
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Remove entry from history
   */
  export async function removeEntry(id: string): Promise<boolean> {
    try {
      const removed = await invoke<boolean>('clipboard_remove_entry', { id });
      
      if (removed) {
        history = history.filter(e => e.id !== id);
        dispatch('entryRemoved', { id });
      }
      
      return removed;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'removeEntry', error });
      return false;
    }
  }
  
  /**
   * Paste from history entry (sets clipboard to that content)
   */
  export async function pasteEntry(id: string): Promise<ClipboardContent | null> {
    try {
      isLoading = true;
      error = null;
      
      const content = await invoke<ClipboardContent>('clipboard_paste_entry', { id });
      
      dispatch('paste', { id, content });
      return content;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'pasteEntry', error });
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Format timestamp for display
   */
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }
  
  /**
   * Get content preview
   */
  function getPreview(content: ClipboardContent): string {
    switch (content.type) {
      case 'Text':
        const text = content.data as string;
        return text.length > 100 ? text.slice(0, 100) + '...' : text;
      case 'Html':
        const html = content.data as { html: string; plain?: string };
        const plain = html.plain || html.html.replace(/<[^>]*>/g, '');
        return plain.length > 100 ? plain.slice(0, 100) + '...' : plain;
      case 'Image':
        const img = content.data as { width: number; height: number };
        return `Image (${img.width}×${img.height})`;
      case 'Files':
        const files = content.data as string[];
        return `${files.length} file(s)`;
      default:
        return 'Empty';
    }
  }
  
  /**
   * Get content icon
   */
  function getIcon(content: ClipboardContent): string {
    switch (content.type) {
      case 'Text': return '📝';
      case 'Html': return '🌐';
      case 'Image': return '🖼️';
      case 'Files': return '📁';
      default: return '📋';
    }
  }
  
  // Lifecycle
  onMount(async () => {
    if (showHistory) {
      await refreshHistory();
    }
  });
</script>

{#if showHistory}
  <div class="clipboard-manager">
    <div class="clipboard-header">
      <h3>📋 Clipboard History</h3>
      {#if history.length > 0}
        <button 
          class="clear-button"
          on:click={clearHistory}
          disabled={isLoading}
        >
          Clear All
        </button>
      {/if}
    </div>
    
    {#if error}
      <div class="clipboard-error">
        ⚠️ {error}
      </div>
    {/if}
    
    {#if isLoading}
      <div class="clipboard-loading">
        <span class="spinner"></span>
        Loading...
      </div>
    {:else if displayedHistory.length === 0}
      <div class="clipboard-empty">
        No clipboard history yet
      </div>
    {:else}
      <ul class="clipboard-list">
        {#each displayedHistory as entry (entry.id)}
          <li class="clipboard-entry">
            <button 
              class="entry-content"
              on:click={() => pasteEntry(entry.id)}
              title="Click to paste"
            >
              <span class="entry-icon">{getIcon(entry.content)}</span>
              <span class="entry-preview">{getPreview(entry.content)}</span>
              <span class="entry-time">{formatTime(entry.timestamp)}</span>
            </button>
            <button 
              class="entry-remove"
              on:click|stopPropagation={() => removeEntry(entry.id)}
              title="Remove from history"
            >
              ✕
            </button>
          </li>
        {/each}
      </ul>
      
      {#if history.length > maxHistoryDisplay}
        <div class="clipboard-more">
          +{history.length - maxHistoryDisplay} more entries
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .clipboard-manager {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    max-width: 400px;
    font-size: 14px;
  }
  
  .clipboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .clipboard-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .clear-button {
    background: transparent;
    border: 1px solid var(--border-color, #40444b);
    color: var(--text-muted, #8e9297);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }
  
  .clear-button:hover:not(:disabled) {
    background: var(--bg-hover, #40444b);
    color: var(--text-primary, #fff);
  }
  
  .clear-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .clipboard-error {
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
    color: var(--error-text, #ed4245);
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 12px;
    font-size: 13px;
  }
  
  .clipboard-loading,
  .clipboard-empty {
    text-align: center;
    color: var(--text-muted, #8e9297);
    padding: 20px;
  }
  
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--text-muted, #8e9297);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .clipboard-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .clipboard-entry {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-tertiary, #36393f);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .entry-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }
  
  .entry-content:hover {
    background: var(--bg-hover, #40444b);
  }
  
  .entry-icon {
    flex-shrink: 0;
    font-size: 16px;
  }
  
  .entry-preview {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  
  .entry-time {
    flex-shrink: 0;
    color: var(--text-muted, #8e9297);
    font-size: 11px;
  }
  
  .entry-remove {
    background: transparent;
    border: none;
    color: var(--text-muted, #8e9297);
    padding: 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }
  
  .entry-remove:hover {
    color: var(--error-text, #ed4245);
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
  }
  
  .clipboard-more {
    text-align: center;
    color: var(--text-muted, #8e9297);
    font-size: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #40444b);
    margin-top: 8px;
  }
</style>
