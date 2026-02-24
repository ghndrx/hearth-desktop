<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  export let isOpen = false;
  
  interface QuickAction {
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
    action: () => void | Promise<void>;
  }
  
  interface RecentChat {
    id: string;
    name: string;
    avatar?: string;
    lastMessage?: string;
  }
  
  let searchQuery = '';
  let selectedIndex = 0;
  let searchInput: HTMLInputElement;
  let recentChats: RecentChat[] = [];
  let unlisteners: UnlistenFn[] = [];
  
  const quickActions: QuickAction[] = [
    {
      id: 'new-message',
      label: 'New Message',
      icon: '✉️',
      shortcut: '⌘N',
      action: () => dispatch('action', { type: 'new-message' })
    },
    {
      id: 'search',
      label: 'Search Messages',
      icon: '🔍',
      shortcut: '⌘F',
      action: () => dispatch('action', { type: 'search' })
    },
    {
      id: 'toggle-dnd',
      label: 'Toggle Do Not Disturb',
      icon: '🔕',
      shortcut: '⌘D',
      action: async () => {
        try {
          await invoke('toggle_dnd');
          dispatch('action', { type: 'dnd-toggled' });
        } catch (e) {
          console.error('Failed to toggle DND:', e);
        }
      }
    },
    {
      id: 'mark-all-read',
      label: 'Mark All as Read',
      icon: '✓',
      shortcut: '⌘⇧R',
      action: () => dispatch('action', { type: 'mark-all-read' })
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: '⚙️',
      shortcut: '⌘,',
      action: () => dispatch('action', { type: 'settings' })
    },
    {
      id: 'voice-call',
      label: 'Start Voice Call',
      icon: '📞',
      action: () => dispatch('action', { type: 'voice-call' })
    },
    {
      id: 'share-screen',
      label: 'Share Screen',
      icon: '🖥️',
      action: () => dispatch('action', { type: 'share-screen' })
    },
    {
      id: 'upload-file',
      label: 'Upload File',
      icon: '📎',
      shortcut: '⌘U',
      action: () => dispatch('action', { type: 'upload-file' })
    }
  ];
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  $: filteredActions = searchQuery
    ? quickActions.filter(a => 
        a.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quickActions;
  
  $: filteredChats = searchQuery
    ? recentChats.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentChats.slice(0, 5);
  
  $: allItems = [...filteredActions.map(a => ({ type: 'action' as const, data: a })), 
                  ...filteredChats.map(c => ({ type: 'chat' as const, data: c }))];
  
  $: if (selectedIndex >= allItems.length) {
    selectedIndex = Math.max(0, allItems.length - 1);
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, allItems.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        executeSelected();
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  }
  
  function executeSelected() {
    const item = allItems[selectedIndex];
    if (!item) return;
    
    if (item.type === 'action') {
      item.data.action();
    } else {
      dispatch('action', { type: 'open-chat', chatId: item.data.id });
    }
    close();
  }
  
  function close() {
    isOpen = false;
    searchQuery = '';
    selectedIndex = 0;
    dispatch('close');
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }
  
  async function loadRecentChats() {
    try {
      // This would be replaced with actual API call
      recentChats = [
        { id: '1', name: 'General', lastMessage: 'Hey everyone!' },
        { id: '2', name: 'Team Updates', lastMessage: 'New release coming...' },
        { id: '3', name: 'Random', lastMessage: 'Anyone seen the...' }
      ];
    } catch (e) {
      console.error('Failed to load recent chats:', e);
    }
  }
  
  onMount(async () => {
    await loadRecentChats();
    
    // Listen for tray quick action trigger
    const unlisten = await listen('quick-actions-open', () => {
      isOpen = true;
    });
    unlisteners.push(unlisten);
  });
  
  onDestroy(() => {
    unlisteners.forEach(fn => fn());
  });
  
  $: if (isOpen && searchInput) {
    setTimeout(() => searchInput?.focus(), 50);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="backdrop"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 150 }}
  >
    <div 
      class="panel"
      transition:fly={{ y: -20, duration: 200 }}
    >
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="search-input"
        />
        <kbd class="escape-hint">ESC</kbd>
      </div>
      
      <div class="results">
        {#if filteredActions.length > 0}
          <div class="section">
            <div class="section-header">Quick Actions</div>
            {#each filteredActions as action, i}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div 
                class="item"
                class:selected={selectedIndex === i}
                on:click={() => { selectedIndex = i; executeSelected(); }}
                on:mouseenter={() => selectedIndex = i}
              >
                <span class="item-icon">{action.icon}</span>
                <span class="item-label">{action.label}</span>
                {#if action.shortcut}
                  <kbd class="item-shortcut">{action.shortcut}</kbd>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        
        {#if filteredChats.length > 0}
          <div class="section">
            <div class="section-header">Recent Chats</div>
            {#each filteredChats as chat, i}
              {@const itemIndex = filteredActions.length + i}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div 
                class="item"
                class:selected={selectedIndex === itemIndex}
                on:click={() => { selectedIndex = itemIndex; executeSelected(); }}
                on:mouseenter={() => selectedIndex = itemIndex}
              >
                <span class="item-avatar">
                  {#if chat.avatar}
                    <img src={chat.avatar} alt={chat.name} />
                  {:else}
                    <span class="avatar-placeholder">{chat.name[0]}</span>
                  {/if}
                </span>
                <div class="item-content">
                  <span class="item-label">{chat.name}</span>
                  {#if chat.lastMessage}
                    <span class="item-preview">{chat.lastMessage}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        
        {#if allItems.length === 0}
          <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <span class="empty-text">No results found</span>
          </div>
        {/if}
      </div>
      
      <div class="footer">
        <span class="hint"><kbd>↑↓</kbd> Navigate</span>
        <span class="hint"><kbd>↵</kbd> Select</span>
        <span class="hint"><kbd>ESC</kbd> Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }
  
  .panel {
    width: 100%;
    max-width: 560px;
    background: var(--bg-primary, #1e1e1e);
    border-radius: 12px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    border: 1px solid var(--border-color, #333);
  }
  
  .search-container {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #333);
    gap: 12px;
  }
  
  .search-icon {
    font-size: 18px;
    opacity: 0.6;
  }
  
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 16px;
    color: var(--text-primary, #fff);
  }
  
  .search-input::placeholder {
    color: var(--text-muted, #888);
  }
  
  .escape-hint {
    padding: 4px 8px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted, #888);
  }
  
  .results {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .section {
    padding: 8px 0;
  }
  
  .section-header {
    padding: 8px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }
  
  .item {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    cursor: pointer;
    gap: 12px;
    transition: background 0.1s;
  }
  
  .item:hover,
  .item.selected {
    background: var(--bg-hover, #2a2a2a);
  }
  
  .item.selected {
    background: var(--accent-color, #5865f2);
  }
  
  .item-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }
  
  .item-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, #2a2a2a);
  }
  
  .item-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  
  .item-label {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary, #fff);
  }
  
  .item-preview {
    font-size: 12px;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .item-shortcut {
    padding: 4px 8px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted, #888);
  }
  
  .selected .item-shortcut {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #fff);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    gap: 12px;
  }
  
  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
  }
  
  .empty-text {
    color: var(--text-muted, #888);
    font-size: 14px;
  }
  
  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #1a1a1a);
  }
  
  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted, #888);
  }
  
  .hint kbd {
    padding: 2px 6px;
    background: var(--bg-primary, #2a2a2a);
    border-radius: 4px;
    font-size: 10px;
  }
</style>
