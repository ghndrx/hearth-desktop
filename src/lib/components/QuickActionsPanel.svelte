<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  // Panel state
  let isOpen = false;
  let searchQuery = '';
  let selectedIndex = 0;
  let inputElement: HTMLInputElement;

  // Action categories
  interface QuickAction {
    id: string;
    label: string;
    description?: string;
    icon: string;
    category: 'navigation' | 'window' | 'settings' | 'tools' | 'help';
    shortcut?: string;
    action: () => void;
  }

  // Define all available actions
  const allActions: QuickAction[] = [
    // Navigation
    {
      id: 'nav-home',
      label: 'Go to Home',
      description: 'Navigate to the home screen',
      icon: '🏠',
      category: 'navigation',
      shortcut: 'Ctrl+H',
      action: () => dispatch('action', { type: 'navigate', target: 'home' })
    },
    {
      id: 'nav-sessions',
      label: 'Open Sessions',
      description: 'View and manage chat sessions',
      icon: '💬',
      category: 'navigation',
      action: () => dispatch('action', { type: 'navigate', target: 'sessions' })
    },
    {
      id: 'nav-settings',
      label: 'Open Settings',
      description: 'Configure app preferences',
      icon: '⚙️',
      category: 'navigation',
      shortcut: 'Ctrl+,',
      action: () => dispatch('action', { type: 'navigate', target: 'settings' })
    },

    // Window actions
    {
      id: 'window-minimize',
      label: 'Minimize Window',
      description: 'Minimize to system tray',
      icon: '➖',
      category: 'window',
      action: () => dispatch('action', { type: 'window', command: 'minimize' })
    },
    {
      id: 'window-maximize',
      label: 'Toggle Maximize',
      description: 'Maximize or restore window',
      icon: '⬜',
      category: 'window',
      action: () => dispatch('action', { type: 'window', command: 'maximize' })
    },
    {
      id: 'window-minimode',
      label: 'Toggle Mini Mode',
      description: 'Switch to compact floating window',
      icon: '📌',
      category: 'window',
      shortcut: 'Ctrl+M',
      action: () => dispatch('action', { type: 'window', command: 'minimode' })
    },
    {
      id: 'window-fullscreen',
      label: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      icon: '📺',
      category: 'window',
      shortcut: 'F11',
      action: () => dispatch('action', { type: 'window', command: 'fullscreen' })
    },
    {
      id: 'window-snap-left',
      label: 'Snap Window Left',
      description: 'Snap window to left half of screen',
      icon: '⬅️',
      category: 'window',
      action: () => dispatch('action', { type: 'window', command: 'snap-left' })
    },
    {
      id: 'window-snap-right',
      label: 'Snap Window Right',
      description: 'Snap window to right half of screen',
      icon: '➡️',
      category: 'window',
      action: () => dispatch('action', { type: 'window', command: 'snap-right' })
    },

    // Tools
    {
      id: 'tools-notes',
      label: 'Open Quick Notes',
      description: 'Open floating notes panel',
      icon: '📝',
      category: 'tools',
      shortcut: 'Ctrl+N',
      action: () => dispatch('action', { type: 'tools', command: 'notes' })
    },
    {
      id: 'tools-record',
      label: 'Start Screen Recording',
      description: 'Record screen or window',
      icon: '🔴',
      category: 'tools',
      action: () => dispatch('action', { type: 'tools', command: 'record' })
    },
    {
      id: 'tools-print',
      label: 'Print Chat',
      description: 'Print or export current chat',
      icon: '🖨️',
      category: 'tools',
      shortcut: 'Ctrl+P',
      action: () => dispatch('action', { type: 'tools', command: 'print' })
    },
    {
      id: 'tools-search',
      label: 'Search Messages',
      description: 'Search through chat history',
      icon: '🔍',
      category: 'tools',
      shortcut: 'Ctrl+F',
      action: () => dispatch('action', { type: 'tools', command: 'search' })
    },
    {
      id: 'tools-clear-cache',
      label: 'Clear Cache',
      description: 'Clear app cache and temporary data',
      icon: '🧹',
      category: 'tools',
      action: () => dispatch('action', { type: 'tools', command: 'clear-cache' })
    },

    // Settings shortcuts
    {
      id: 'settings-theme',
      label: 'Toggle Dark Mode',
      description: 'Switch between light and dark theme',
      icon: '🌙',
      category: 'settings',
      shortcut: 'Ctrl+Shift+T',
      action: () => dispatch('action', { type: 'settings', command: 'toggle-theme' })
    },
    {
      id: 'settings-notifications',
      label: 'Toggle Notifications',
      description: 'Enable or disable notifications',
      icon: '🔔',
      category: 'settings',
      action: () => dispatch('action', { type: 'settings', command: 'toggle-notifications' })
    },
    {
      id: 'settings-sounds',
      label: 'Toggle Sounds',
      description: 'Enable or disable sound alerts',
      icon: '🔊',
      category: 'settings',
      action: () => dispatch('action', { type: 'settings', command: 'toggle-sounds' })
    },
    {
      id: 'settings-focus',
      label: 'Toggle Focus Mode',
      description: 'Enter distraction-free mode',
      icon: '🎯',
      category: 'settings',
      shortcut: 'Ctrl+Shift+F',
      action: () => dispatch('action', { type: 'settings', command: 'focus-mode' })
    },

    // Help
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: '⌨️',
      category: 'help',
      shortcut: 'Ctrl+/',
      action: () => dispatch('action', { type: 'help', command: 'shortcuts' })
    },
    {
      id: 'help-docs',
      label: 'View Documentation',
      description: 'Open Hearth documentation',
      icon: '📚',
      category: 'help',
      action: () => dispatch('action', { type: 'help', command: 'docs' })
    },
    {
      id: 'help-about',
      label: 'About Hearth',
      description: 'View version and app info',
      icon: 'ℹ️',
      category: 'help',
      action: () => dispatch('action', { type: 'help', command: 'about' })
    },
    {
      id: 'help-updates',
      label: 'Check for Updates',
      description: 'Check if updates are available',
      icon: '🔄',
      category: 'help',
      action: () => dispatch('action', { type: 'help', command: 'updates' })
    }
  ];

  // Filter actions based on search query
  $: filteredActions = searchQuery.trim() === ''
    ? allActions
    : allActions.filter(action => {
        const query = searchQuery.toLowerCase();
        return (
          action.label.toLowerCase().includes(query) ||
          action.description?.toLowerCase().includes(query) ||
          action.category.toLowerCase().includes(query)
        );
      });

  // Group actions by category
  $: groupedActions = filteredActions.reduce((groups, action) => {
    if (!groups[action.category]) {
      groups[action.category] = [];
    }
    groups[action.category].push(action);
    return groups;
  }, {} as Record<string, QuickAction[]>);

  // Get flat list for keyboard navigation
  $: flatActions = filteredActions;

  // Reset selection when filtered actions change
  $: if (filteredActions) {
    selectedIndex = Math.min(selectedIndex, filteredActions.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;
  }

  // Category labels
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    window: 'Window',
    settings: 'Settings',
    tools: 'Tools',
    help: 'Help'
  };

  // Open the panel
  export function open() {
    isOpen = true;
    searchQuery = '';
    selectedIndex = 0;
    setTimeout(() => inputElement?.focus(), 50);
  }

  // Close the panel
  export function close() {
    isOpen = false;
    searchQuery = '';
  }

  // Toggle the panel
  export function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  // Execute selected action
  function executeAction(action: QuickAction) {
    action.action();
    close();
  }

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) {
      // Global shortcut to open: Ctrl/Cmd + K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        open();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;

      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, flatActions.length - 1);
        scrollToSelected();
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;

      case 'Enter':
        event.preventDefault();
        if (flatActions[selectedIndex]) {
          executeAction(flatActions[selectedIndex]);
        }
        break;

      case 'Tab':
        event.preventDefault();
        if (event.shiftKey) {
          selectedIndex = Math.max(selectedIndex - 1, 0);
        } else {
          selectedIndex = Math.min(selectedIndex + 1, flatActions.length - 1);
        }
        scrollToSelected();
        break;
    }
  }

  // Scroll to keep selected item visible
  function scrollToSelected() {
    const selected = document.querySelector('.quick-action-item.selected');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Click outside to close
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (isOpen && !target.closest('.quick-actions-panel')) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('click', handleClickOutside);
  });
</script>

{#if isOpen}
  <div class="quick-actions-overlay" transition:fade={{ duration: 150 }}>
    <div 
      class="quick-actions-panel"
      transition:fly={{ y: -20, duration: 200 }}
      role="dialog"
      aria-label="Quick Actions"
    >
      <!-- Search input -->
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input
          bind:this={inputElement}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="search-input"
          aria-label="Search actions"
          autocomplete="off"
          spellcheck="false"
        />
        <kbd class="escape-hint">ESC</kbd>
      </div>

      <!-- Actions list -->
      <div class="actions-list" role="listbox">
        {#if flatActions.length === 0}
          <div class="no-results">
            <span class="no-results-icon">🔍</span>
            <p>No actions found for "{searchQuery}"</p>
          </div>
        {:else}
          {#each Object.entries(groupedActions) as [category, actions], categoryIndex}
            <div class="category-group">
              <div class="category-label">{categoryLabels[category] || category}</div>
              {#each actions as action, actionIndex}
                {@const globalIndex = flatActions.findIndex(a => a.id === action.id)}
                <button
                  class="quick-action-item"
                  class:selected={globalIndex === selectedIndex}
                  role="option"
                  aria-selected={globalIndex === selectedIndex}
                  on:click={() => executeAction(action)}
                  on:mouseenter={() => selectedIndex = globalIndex}
                >
                  <span class="action-icon">{action.icon}</span>
                  <div class="action-content">
                    <span class="action-label">{action.label}</span>
                    {#if action.description}
                      <span class="action-description">{action.description}</span>
                    {/if}
                  </div>
                  {#if action.shortcut}
                    <kbd class="action-shortcut">{action.shortcut}</kbd>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="panel-footer">
        <span class="hint">
          <kbd>↑</kbd><kbd>↓</kbd> to navigate
          <kbd>↵</kbd> to select
          <kbd>esc</kbd> to close
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-actions-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    padding-top: 15vh;
    z-index: 9999;
  }

  .quick-actions-panel {
    width: 100%;
    max-width: 560px;
    max-height: 70vh;
    background: var(--panel-bg, #1e1e2e);
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border-color, #313244);
  }

  .search-container {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #313244);
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
    color: var(--text-color, #cdd6f4);
  }

  .search-input::placeholder {
    color: var(--text-muted, #6c7086);
  }

  .escape-hint {
    padding: 4px 8px;
    background: var(--kbd-bg, #313244);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted, #6c7086);
  }

  .actions-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .category-group {
    margin-bottom: 8px;
  }

  .category-label {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #6c7086);
    letter-spacing: 0.05em;
  }

  .quick-action-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .quick-action-item:hover,
  .quick-action-item.selected {
    background: var(--hover-bg, #313244);
  }

  .action-icon {
    font-size: 20px;
    width: 32px;
    text-align: center;
  }

  .action-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color, #cdd6f4);
  }

  .action-description {
    font-size: 12px;
    color: var(--text-muted, #6c7086);
  }

  .action-shortcut {
    padding: 4px 8px;
    background: var(--kbd-bg, #313244);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted, #6c7086);
    font-family: monospace;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: var(--text-muted, #6c7086);
    gap: 8px;
  }

  .no-results-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .panel-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #313244);
    background: var(--footer-bg, #181825);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted, #6c7086);
  }

  .hint kbd {
    padding: 2px 6px;
    background: var(--kbd-bg, #313244);
    border-radius: 4px;
    font-size: 10px;
    font-family: monospace;
  }

  /* Scrollbar styling */
  .actions-list::-webkit-scrollbar {
    width: 6px;
  }

  .actions-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .actions-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, #45475a);
    border-radius: 3px;
  }

  .actions-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, #585b70);
  }
</style>
