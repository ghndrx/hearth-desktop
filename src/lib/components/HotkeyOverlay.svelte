<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  interface HotkeyHint {
    key: string;
    description: string;
    category: 'navigation' | 'messaging' | 'media' | 'general';
    modifiers?: string[];
  }

  // Props
  export let triggerKey: string = 'Control';
  export let holdDuration: number = 500;
  export let enabled: boolean = true;

  // State
  let visible = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let activeCategory: string = 'all';

  // Hotkey definitions
  const hotkeys: HotkeyHint[] = [
    // Navigation
    { key: 'K', description: 'Quick Switcher', category: 'navigation', modifiers: ['Ctrl'] },
    { key: 'Tab', description: 'Switch Channels', category: 'navigation', modifiers: ['Alt'] },
    { key: 'F', description: 'Search', category: 'navigation', modifiers: ['Ctrl'] },
    { key: '↑/↓', description: 'Navigate Servers', category: 'navigation', modifiers: ['Ctrl', 'Alt'] },
    { key: 'Home', description: 'Jump to Top', category: 'navigation', modifiers: ['Ctrl'] },
    { key: 'End', description: 'Jump to Bottom', category: 'navigation', modifiers: ['Ctrl'] },

    // Messaging
    { key: 'Enter', description: 'Send Message', category: 'messaging' },
    { key: 'E', description: 'Edit Last Message', category: 'messaging', modifiers: ['Ctrl'] },
    { key: 'R', description: 'Reply to Message', category: 'messaging', modifiers: ['Ctrl'] },
    { key: 'U', description: 'Upload File', category: 'messaging', modifiers: ['Ctrl'] },
    { key: 'P', description: 'Pin Message', category: 'messaging', modifiers: ['Ctrl', 'Shift'] },
    { key: 'Delete', description: 'Delete Message', category: 'messaging' },

    // Media
    { key: 'M', description: 'Toggle Mute', category: 'media', modifiers: ['Ctrl', 'Shift'] },
    { key: 'D', description: 'Toggle Deafen', category: 'media', modifiers: ['Ctrl', 'Shift'] },
    { key: 'V', description: 'Toggle Video', category: 'media', modifiers: ['Ctrl', 'Shift'] },
    { key: 'S', description: 'Share Screen', category: 'media', modifiers: ['Ctrl', 'Shift'] },
    { key: 'Space', description: 'Push-to-Talk', category: 'media' },

    // General
    { key: ',', description: 'Open Settings', category: 'general', modifiers: ['Ctrl'] },
    { key: '?', description: 'Show Shortcuts', category: 'general', modifiers: ['Ctrl'] },
    { key: '+', description: 'Zoom In', category: 'general', modifiers: ['Ctrl'] },
    { key: '-', description: 'Zoom Out', category: 'general', modifiers: ['Ctrl'] },
    { key: '0', description: 'Reset Zoom', category: 'general', modifiers: ['Ctrl'] },
    { key: 'N', description: 'New Window', category: 'general', modifiers: ['Ctrl', 'Shift'] },
  ];

  const categoryLabels: Record<string, string> = {
    all: 'All Shortcuts',
    navigation: 'Navigation',
    messaging: 'Messaging',
    media: 'Media & Voice',
    general: 'General',
  };

  const categoryIcons: Record<string, string> = {
    navigation: '🧭',
    messaging: '💬',
    media: '🎙️',
    general: '⚙️',
  };

  $: filteredHotkeys = activeCategory === 'all'
    ? hotkeys
    : hotkeys.filter(h => h.category === activeCategory);

  $: groupedHotkeys = filteredHotkeys.reduce((acc, hotkey) => {
    if (!acc[hotkey.category]) {
      acc[hotkey.category] = [];
    }
    acc[hotkey.category].push(hotkey);
    return acc;
  }, {} as Record<string, HotkeyHint[]>);

  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled) return;

    if (e.key === triggerKey && !visible && !holdTimer) {
      holdTimer = setTimeout(() => {
        visible = true;
        holdTimer = null;
      }, holdDuration);
    }

    // Allow Escape to close
    if (e.key === 'Escape' && visible) {
      visible = false;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === triggerKey) {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      visible = false;
    }
  }

  function formatModifiers(modifiers?: string[]): string {
    if (!modifiers || modifiers.length === 0) return '';
    return modifiers.join(' + ') + ' + ';
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    if (holdTimer) clearTimeout(holdTimer);
  });
</script>

{#if visible}
  <div
    class="hotkey-overlay"
    role="dialog"
    aria-label="Keyboard shortcuts"
    transition:fade={{ duration: 150 }}
  >
    <div class="overlay-backdrop" />
    
    <div class="overlay-content" transition:scale={{ duration: 200, start: 0.95 }}>
      <header class="overlay-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <p class="hint">Release {triggerKey} to close</p>
      </header>

      <nav class="category-tabs" role="tablist">
        <button
          class="category-tab"
          class:active={activeCategory === 'all'}
          on:click={() => activeCategory = 'all'}
          role="tab"
          aria-selected={activeCategory === 'all'}
        >
          All
        </button>
        {#each Object.keys(categoryIcons) as cat}
          <button
            class="category-tab"
            class:active={activeCategory === cat}
            on:click={() => activeCategory = cat}
            role="tab"
            aria-selected={activeCategory === cat}
          >
            {categoryIcons[cat]} {categoryLabels[cat]}
          </button>
        {/each}
      </nav>

      <div class="hotkey-list">
        {#each Object.entries(groupedHotkeys) as [category, hints]}
          <div class="hotkey-group">
            {#if activeCategory === 'all'}
              <h3 class="group-title">
                {categoryIcons[category]} {categoryLabels[category]}
              </h3>
            {/if}
            <div class="hotkey-grid">
              {#each hints as hint}
                <div class="hotkey-item">
                  <kbd class="hotkey-keys">
                    {#if hint.modifiers}
                      {#each hint.modifiers as mod}
                        <span class="modifier">{mod}</span>
                        <span class="separator">+</span>
                      {/each}
                    {/if}
                    <span class="key">{hint.key}</span>
                  </kbd>
                  <span class="hotkey-desc">{hint.description}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <footer class="overlay-footer">
        <span class="tip">💡 Tip: Press <kbd>Ctrl + ?</kbd> to see shortcuts anytime</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .hotkey-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
  }

  .overlay-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
  }

  .overlay-content {
    position: relative;
    background: var(--bg-primary, #1e1e1e);
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .overlay-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color, #333);
    text-align: center;
  }

  .overlay-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .overlay-header .hint {
    margin: 8px 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
  }

  .category-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    background: var(--bg-secondary, #2a2a2a);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .category-tab {
    flex-shrink: 0;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .category-tab:hover {
    background: var(--bg-hover, #333);
    color: var(--text-primary, #fff);
  }

  .category-tab.active {
    background: var(--accent-color, #5865f2);
    color: #fff;
  }

  .hotkey-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
  }

  .hotkey-group {
    margin-bottom: 20px;
  }

  .hotkey-group:last-child {
    margin-bottom: 0;
  }

  .group-title {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .hotkey-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .hotkey-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 8px;
    transition: background 0.15s ease;
  }

  .hotkey-item:hover {
    background: var(--bg-hover, #333);
  }

  .hotkey-keys {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    font-size: 0.75rem;
    background: transparent;
  }

  .modifier, .key {
    padding: 4px 8px;
    background: var(--bg-tertiary, #3a3a3a);
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-weight: 600;
    min-width: 24px;
    text-align: center;
    box-shadow: 0 2px 0 var(--border-color, #222);
  }

  .separator {
    color: var(--text-secondary, #666);
    font-weight: 400;
  }

  .hotkey-desc {
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    flex: 1;
  }

  .overlay-footer {
    padding: 12px 24px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #2a2a2a);
    text-align: center;
  }

  .tip {
    font-size: 0.8125rem;
    color: var(--text-secondary, #888);
  }

  .tip kbd {
    padding: 2px 6px;
    background: var(--bg-tertiary, #3a3a3a);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .overlay-content {
      width: 95%;
      max-height: 85vh;
    }

    .hotkey-grid {
      grid-template-columns: 1fr;
    }

    .category-tabs {
      justify-content: flex-start;
    }
  }

  /* Dark mode is default, but support light */
  :global(.light-theme) .overlay-content {
    background: #fff;
  }

  :global(.light-theme) .overlay-header,
  :global(.light-theme) .category-tabs,
  :global(.light-theme) .overlay-footer {
    border-color: #e5e5e5;
    background: #f5f5f5;
  }

  :global(.light-theme) .hotkey-item {
    background: #f5f5f5;
  }

  :global(.light-theme) .hotkey-item:hover {
    background: #eee;
  }

  :global(.light-theme) .modifier,
  :global(.light-theme) .key {
    background: #fff;
    border-color: #ddd;
    box-shadow: 0 2px 0 #ccc;
    color: #333;
  }
</style>
