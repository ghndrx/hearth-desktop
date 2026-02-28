<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { writable, derived, type Writable, type Readable } from 'svelte/store';

  // Types
  interface TabItem {
    id: string;
    type: 'channel' | 'dm' | 'thread' | 'panel' | 'workspace';
    title: string;
    subtitle?: string;
    icon?: string;
    iconUrl?: string;
    unreadCount?: number;
    lastAccessed: number;
    serverId?: string;
    serverName?: string;
    color?: string;
  }

  interface TabGroup {
    id: string;
    label: string;
    items: TabItem[];
  }

  // Props
  export let isOpen: boolean = false;
  export let recentTabs: TabItem[] = [];
  export let maxVisibleItems: number = 9;
  export let groupByServer: boolean = true;
  export let showPreview: boolean = true;
  export let cycleDirection: 'forward' | 'backward' = 'forward';
  export let hotkey: string = 'Tab';
  export let modifierKey: 'ctrl' | 'alt' | 'meta' = 'ctrl';

  const dispatch = createEventDispatcher<{
    select: { item: TabItem };
    close: void;
    navigate: { direction: 'up' | 'down' | 'left' | 'right' };
    pin: { item: TabItem };
    closeTab: { item: TabItem };
  }>();

  // State
  const selectedIndex: Writable<number> = writable(cycleDirection === 'forward' ? 1 : -1);
  const searchQuery: Writable<string> = writable('');
  const showSearch: Writable<boolean> = writable(false);
  const pinnedTabs: Writable<Set<string>> = writable(new Set());
  const hoveredIndex: Writable<number | null> = writable(null);

  // Internal state
  let containerRef: HTMLElement;
  let searchInputRef: HTMLInputElement;
  let modifierHeld = false;
  let lastSwitchTime = 0;

  // Filtered and sorted items
  const filteredItems: Readable<TabItem[]> = derived(
    [searchQuery, pinnedTabs],
    ([$searchQuery, $pinnedTabs]) => {
      let items = [...recentTabs];
      
      // Filter by search query
      if ($searchQuery.trim()) {
        const query = $searchQuery.toLowerCase();
        items = items.filter(item => 
          item.title.toLowerCase().includes(query) ||
          (item.subtitle?.toLowerCase().includes(query)) ||
          (item.serverName?.toLowerCase().includes(query))
        );
      }

      // Sort: pinned first, then by last accessed
      items.sort((a, b) => {
        const aPinned = $pinnedTabs.has(a.id);
        const bPinned = $pinnedTabs.has(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return b.lastAccessed - a.lastAccessed;
      });

      return items.slice(0, maxVisibleItems);
    }
  );

  // Grouped items for display
  const groupedItems: Readable<TabGroup[]> = derived(filteredItems, ($filteredItems) => {
    if (!groupByServer) {
      return [{
        id: 'all',
        label: 'Recent',
        items: $filteredItems
      }];
    }

    const groups = new Map<string, TabItem[]>();
    const pinnedGroup: TabItem[] = [];
    const directMessages: TabItem[] = [];

    $filteredItems.forEach(item => {
      if ($pinnedTabs.has(item.id)) {
        pinnedGroup.push(item);
      } else if (item.type === 'dm') {
        directMessages.push(item);
      } else if (item.serverId) {
        const existing = groups.get(item.serverId) || [];
        existing.push(item);
        groups.set(item.serverId, existing);
      } else {
        const existing = groups.get('other') || [];
        existing.push(item);
        groups.set('other', existing);
      }
    });

    const result: TabGroup[] = [];

    if (pinnedGroup.length > 0) {
      result.push({ id: 'pinned', label: '📌 Pinned', items: pinnedGroup });
    }

    if (directMessages.length > 0) {
      result.push({ id: 'dms', label: '💬 Direct Messages', items: directMessages });
    }

    groups.forEach((items, serverId) => {
      const serverName = items[0]?.serverName || 'Other';
      result.push({ id: serverId, label: serverName, items });
    });

    return result;
  });

  // Flat list for keyboard navigation
  const flatItems: Readable<TabItem[]> = derived(groupedItems, ($groupedItems) => {
    return $groupedItems.flatMap(group => group.items);
  });

  // Get icon for tab type
  function getTypeIcon(type: TabItem['type']): string {
    const icons: Record<TabItem['type'], string> = {
      channel: '#',
      dm: '👤',
      thread: '🧵',
      panel: '📋',
      workspace: '🏠'
    };
    return icons[type] || '📄';
  }

  // Format relative time
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  // Handle keyboard navigation
  function handleKeyDown(event: KeyboardEvent) {
    if (!isOpen) {
      // Check for hotkey to open
      const isModifierPressed = 
        (modifierKey === 'ctrl' && event.ctrlKey) ||
        (modifierKey === 'alt' && event.altKey) ||
        (modifierKey === 'meta' && event.metaKey);

      if (isModifierPressed && event.key === hotkey) {
        event.preventDefault();
        openSwitcher(event.shiftKey ? 'backward' : 'forward');
        return;
      }
      return;
    }

    const items = $flatItems;
    const currentIndex = $selectedIndex;

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        if (event.shiftKey) {
          selectedIndex.update(i => (i - 1 + items.length) % items.length);
        } else {
          selectedIndex.update(i => (i + 1) % items.length);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex.update(i => (i - 1 + items.length) % items.length);
        dispatch('navigate', { direction: 'up' });
        break;

      case 'ArrowDown':
        event.preventDefault();
        selectedIndex.update(i => (i + 1) % items.length);
        dispatch('navigate', { direction: 'down' });
        break;

      case 'ArrowLeft':
        event.preventDefault();
        dispatch('navigate', { direction: 'left' });
        break;

      case 'ArrowRight':
        event.preventDefault();
        dispatch('navigate', { direction: 'right' });
        break;

      case 'Enter':
        event.preventDefault();
        selectCurrentItem();
        break;

      case 'Escape':
        event.preventDefault();
        closeSwitcher();
        break;

      case 'p':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          togglePinCurrentItem();
        }
        break;

      case 'w':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          closeCurrentTab();
        }
        break;

      case '/':
        if (!$showSearch) {
          event.preventDefault();
          showSearch.set(true);
          requestAnimationFrame(() => searchInputRef?.focus());
        }
        break;

      default:
        // Start search on alphanumeric input
        if (!$showSearch && event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
          showSearch.set(true);
          searchQuery.set(event.key);
          requestAnimationFrame(() => searchInputRef?.focus());
        }
        break;
    }
  }

  // Handle modifier key release (commit selection)
  function handleKeyUp(event: KeyboardEvent) {
    if (!isOpen) return;

    const isModifierReleased =
      (modifierKey === 'ctrl' && event.key === 'Control') ||
      (modifierKey === 'alt' && event.key === 'Alt') ||
      (modifierKey === 'meta' && event.key === 'Meta');

    if (isModifierReleased && modifierHeld) {
      modifierHeld = false;
      selectCurrentItem();
    }
  }

  // Open the switcher
  function openSwitcher(direction: 'forward' | 'backward') {
    isOpen = true;
    modifierHeld = true;
    cycleDirection = direction;
    selectedIndex.set(direction === 'forward' ? 0 : $flatItems.length - 1);
    lastSwitchTime = Date.now();
    
    // Move to next item if opening with tab
    if ($flatItems.length > 1) {
      selectedIndex.set(direction === 'forward' ? 1 : $flatItems.length - 2);
    }
  }

  // Close the switcher
  function closeSwitcher() {
    isOpen = false;
    searchQuery.set('');
    showSearch.set(false);
    hoveredIndex.set(null);
    dispatch('close');
  }

  // Select the current item
  function selectCurrentItem() {
    const items = $flatItems;
    const index = $selectedIndex;
    
    if (index >= 0 && index < items.length) {
      const item = items[index];
      dispatch('select', { item });
      
      // Update last accessed time
      const tabIndex = recentTabs.findIndex(t => t.id === item.id);
      if (tabIndex >= 0) {
        recentTabs[tabIndex] = { ...item, lastAccessed: Date.now() };
      }
    }
    
    closeSwitcher();
  }

  // Toggle pin on current item
  function togglePinCurrentItem() {
    const items = $flatItems;
    const index = $selectedIndex;
    
    if (index >= 0 && index < items.length) {
      const item = items[index];
      pinnedTabs.update(pins => {
        const newPins = new Set(pins);
        if (newPins.has(item.id)) {
          newPins.delete(item.id);
        } else {
          newPins.add(item.id);
        }
        return newPins;
      });
      dispatch('pin', { item });
    }
  }

  // Close current tab
  function closeCurrentTab() {
    const items = $flatItems;
    const index = $selectedIndex;
    
    if (index >= 0 && index < items.length) {
      const item = items[index];
      dispatch('closeTab', { item });
      
      // Remove from recent tabs
      const tabIndex = recentTabs.findIndex(t => t.id === item.id);
      if (tabIndex >= 0) {
        recentTabs.splice(tabIndex, 1);
        recentTabs = recentTabs; // Trigger reactivity
      }

      // Adjust selection
      if (index >= items.length - 1) {
        selectedIndex.update(i => Math.max(0, i - 1));
      }
    }
  }

  // Handle item click
  function handleItemClick(item: TabItem, index: number) {
    selectedIndex.set(index);
    selectCurrentItem();
  }

  // Handle item hover
  function handleItemHover(index: number) {
    hoveredIndex.set(index);
    selectedIndex.set(index);
  }

  // Calculate item position in flat list
  function getFlatIndex(item: TabItem): number {
    return $flatItems.findIndex(t => t.id === item.id);
  }

  // Lifecycle
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Focus container when opened
    if (isOpen && containerRef) {
      containerRef.focus();
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  });

  // Reactive focus management
  $: if (isOpen && containerRef) {
    containerRef.focus();
  }

  // Reset selection when search changes
  $: if ($searchQuery) {
    selectedIndex.set(0);
  }

  // Store subscriptions
  let pinnedTabsValue: Set<string>;
  $: pinnedTabs.subscribe(v => pinnedTabsValue = v);
</script>

{#if isOpen}
  <div
    class="tab-switcher-overlay"
    transition:fade={{ duration: 150 }}
    on:click={closeSwitcher}
    on:keydown={(e) => e.key === 'Escape' && closeSwitcher()}
    role="dialog"
    aria-modal="true"
    aria-label="Tab Switcher"
  >
    <div
      bind:this={containerRef}
      class="tab-switcher"
      class:with-search={$showSearch}
      transition:scale={{ duration: 200, start: 0.95 }}
      on:click|stopPropagation
      role="listbox"
      aria-activedescendant="tab-item-{$flatItems[$selectedIndex]?.id}"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="switcher-header">
        <h3 class="switcher-title">Quick Switch</h3>
        <div class="switcher-hints">
          <kbd>Tab</kbd> navigate
          <kbd>Enter</kbd> select
          <kbd>Esc</kbd> close
        </div>
      </div>

      <!-- Search input -->
      {#if $showSearch}
        <div class="search-container" transition:fade={{ duration: 100 }}>
          <span class="search-icon">🔍</span>
          <input
            bind:this={searchInputRef}
            type="text"
            class="search-input"
            placeholder="Search tabs..."
            bind:value={$searchQuery}
            on:keydown={(e) => e.key === 'Escape' && showSearch.set(false)}
          />
          <button 
            class="search-clear"
            on:click={() => { searchQuery.set(''); showSearch.set(false); }}
            aria-label="Clear search"
          >
            ✕
          </button>
        </div>
      {:else}
        <div class="search-hint">
          Press <kbd>/</kbd> or start typing to search
        </div>
      {/if}

      <!-- Tab list -->
      <div class="tab-list">
        {#each $groupedItems as group (group.id)}
          {#if group.items.length > 0}
            <div class="tab-group">
              <div class="group-label">{group.label}</div>
              {#each group.items as item (item.id)}
                {@const flatIndex = getFlatIndex(item)}
                {@const isSelected = flatIndex === $selectedIndex}
                {@const isPinned = pinnedTabsValue.has(item.id)}
                <div
                  id="tab-item-{item.id}"
                  class="tab-item"
                  class:selected={isSelected}
                  class:pinned={isPinned}
                  role="option"
                  aria-selected={isSelected}
                  on:click={() => handleItemClick(item, flatIndex)}
                  on:mouseenter={() => handleItemHover(flatIndex)}
                  on:keydown={(e) => e.key === 'Enter' && handleItemClick(item, flatIndex)}
                >
                  <!-- Icon -->
                  <div class="item-icon" style:background-color={item.color}>
                    {#if item.iconUrl}
                      <img src={item.iconUrl} alt="" class="icon-image" />
                    {:else if item.icon}
                      <span class="icon-emoji">{item.icon}</span>
                    {:else}
                      <span class="icon-type">{getTypeIcon(item.type)}</span>
                    {/if}
                  </div>

                  <!-- Content -->
                  <div class="item-content">
                    <div class="item-title">
                      {item.title}
                      {#if isPinned}
                        <span class="pin-indicator" title="Pinned">📌</span>
                      {/if}
                    </div>
                    {#if item.subtitle || item.serverName}
                      <div class="item-subtitle">
                        {item.subtitle || item.serverName}
                      </div>
                    {/if}
                  </div>

                  <!-- Meta -->
                  <div class="item-meta">
                    {#if item.unreadCount && item.unreadCount > 0}
                      <span class="unread-badge">{item.unreadCount}</span>
                    {/if}
                    <span class="item-time">{formatRelativeTime(item.lastAccessed)}</span>
                  </div>

                  <!-- Actions (visible on selected) -->
                  {#if isSelected}
                    <div class="item-actions" transition:fade={{ duration: 100 }}>
                      <button
                        class="action-btn"
                        on:click|stopPropagation={togglePinCurrentItem}
                        title={isPinned ? 'Unpin (Ctrl+P)' : 'Pin (Ctrl+P)'}
                      >
                        {isPinned ? '📍' : '📌'}
                      </button>
                      <button
                        class="action-btn close-btn"
                        on:click|stopPropagation={closeCurrentTab}
                        title="Close tab (Ctrl+W)"
                      >
                        ✕
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}

        {#if $flatItems.length === 0}
          <div class="empty-state">
            {#if $searchQuery}
              <p>No tabs match "{$searchQuery}"</p>
            {:else}
              <p>No recent tabs</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="switcher-footer">
        <div class="footer-hint">
          <kbd>Ctrl+P</kbd> pin
          <kbd>Ctrl+W</kbd> close
        </div>
        <div class="tab-count">
          {$flatItems.length} of {recentTabs.length} tabs
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tab-switcher-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 10000;
  }

  .tab-switcher {
    background: var(--bg-primary, #1e1e2e);
    border-radius: 12px;
    box-shadow: 
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    width: 90%;
    max-width: 600px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    outline: none;
  }

  .switcher-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .switcher-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .switcher-hints {
    font-size: 11px;
    color: var(--text-muted, #888);
    display: flex;
    gap: 8px;
  }

  kbd {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: inherit;
    font-size: 10px;
    color: var(--text-secondary, #aaa);
  }

  .search-container {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .search-icon {
    font-size: 14px;
    opacity: 0.6;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--text-primary, #e0e0e0);
    padding: 4px 0;
  }

  .search-input::placeholder {
    color: var(--text-muted, #666);
  }

  .search-clear {
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    color: var(--text-muted, #888);
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .search-clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #e0e0e0);
  }

  .search-hint {
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-muted, #666);
    text-align: center;
    background: rgba(0, 0, 0, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .tab-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .tab-group {
    margin-bottom: 12px;
  }

  .tab-group:last-child {
    margin-bottom: 0;
  }

  .group-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    padding: 4px 12px 8px;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    transition: all 0.15s ease;
  }

  .tab-item:hover,
  .tab-item.selected {
    background: rgba(255, 255, 255, 0.08);
  }

  .tab-item.selected {
    background: var(--accent-color, #5865f2);
    box-shadow: 0 2px 8px rgba(88, 101, 242, 0.3);
  }

  .tab-item.pinned {
    border-left: 2px solid var(--accent-color, #5865f2);
    padding-left: 10px;
  }

  .item-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    font-size: 16px;
  }

  .icon-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }

  .icon-emoji,
  .icon-type {
    font-size: 16px;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #e0e0e0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab-item.selected .item-title {
    color: white;
  }

  .pin-indicator {
    font-size: 10px;
    opacity: 0.7;
  }

  .item-subtitle {
    font-size: 12px;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .tab-item.selected .item-subtitle {
    color: rgba(255, 255, 255, 0.7);
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .unread-badge {
    background: #ed4245;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .item-time {
    font-size: 11px;
    color: var(--text-muted, #666);
    white-space: nowrap;
  }

  .tab-item.selected .item-time {
    color: rgba(255, 255, 255, 0.6);
  }

  .item-actions {
    position: absolute;
    right: 12px;
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: rgba(0, 0, 0, 0.3);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: rgba(0, 0, 0, 0.5);
  }

  .action-btn.close-btn:hover {
    background: #ed4245;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted, #888);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .switcher-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
  }

  .footer-hint {
    font-size: 11px;
    color: var(--text-muted, #666);
    display: flex;
    gap: 8px;
  }

  .tab-count {
    font-size: 11px;
    color: var(--text-muted, #666);
  }

  /* Scrollbar styling */
  .tab-list::-webkit-scrollbar {
    width: 6px;
  }

  .tab-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .tab-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .tab-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: light) {
    .tab-switcher-overlay {
      background: rgba(0, 0, 0, 0.3);
    }

    .tab-switcher {
      background: var(--bg-primary, #ffffff);
      box-shadow: 
        0 25px 50px -12px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(0, 0, 0, 0.1);
    }

    .switcher-header,
    .switcher-footer {
      border-color: rgba(0, 0, 0, 0.08);
    }

    kbd {
      background: rgba(0, 0, 0, 0.08);
      color: var(--text-secondary, #666);
    }

    .tab-item:hover,
    .tab-item.selected {
      background: rgba(0, 0, 0, 0.05);
    }

    .tab-item.selected {
      background: var(--accent-color, #5865f2);
    }

    .item-icon {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tab-switcher,
    .tab-item,
    .action-btn {
      transition: none;
    }
  }
</style>
</script>
