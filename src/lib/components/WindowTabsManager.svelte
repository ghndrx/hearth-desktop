<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  const dispatch = createEventDispatcher<{
    tabChange: { tabId: string; index: number };
    tabClose: { tabId: string };
    tabReorder: { fromIndex: number; toIndex: number };
  }>();

  interface WindowTab {
    id: string;
    title: string;
    icon?: string;
    route: string;
    isPinned: boolean;
    isModified: boolean;
    createdAt: number;
    lastAccessedAt: number;
  }

  interface TabGroup {
    id: string;
    name: string;
    color: string;
    tabIds: string[];
    isCollapsed: boolean;
  }

  // Props
  export let maxTabs: number = 20;
  export let enableGroups: boolean = true;
  export let showTabPreview: boolean = true;
  export let tabCloseConfirm: boolean = true;

  // State
  let tabs: WindowTab[] = [];
  let groups: TabGroup[] = [];
  let activeTabId: string | null = null;
  let draggedTabId: string | null = null;
  let dragOverTabId: string | null = null;
  let hoveredTabId: string | null = null;
  let previewPosition = { x: 0, y: 0 };
  let showPreview = false;
  let isAddingGroup = false;
  let newGroupName = '';
  let contextMenuTabId: string | null = null;
  let contextMenuPosition = { x: 0, y: 0 };
  let unlisteners: UnlistenFn[] = [];

  // Tab colors for groups
  const groupColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  onMount(async () => {
    await loadTabs();
    await setupEventListeners();
  });

  onDestroy(() => {
    unlisteners.forEach(fn => fn());
  });

  async function loadTabs(): Promise<void> {
    try {
      const savedTabs = await invoke<WindowTab[]>('get_window_tabs');
      tabs = savedTabs || [];
      
      const savedGroups = await invoke<TabGroup[]>('get_tab_groups');
      groups = savedGroups || [];
      
      const lastActiveId = await invoke<string | null>('get_active_tab_id');
      if (lastActiveId && tabs.find(t => t.id === lastActiveId)) {
        activeTabId = lastActiveId;
      } else if (tabs.length > 0) {
        activeTabId = tabs[0].id;
      }
    } catch (error) {
      console.error('Failed to load tabs:', error);
      // Initialize with default tab
      tabs = [{
        id: crypto.randomUUID(),
        title: 'Home',
        route: '/',
        isPinned: false,
        isModified: false,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      }];
      activeTabId = tabs[0].id;
    }
  }

  async function setupEventListeners(): Promise<void> {
    const unlistenNavigation = await listen<{ route: string; title: string }>('navigation', (event) => {
      if (activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
          tab.route = event.payload.route;
          tab.title = event.payload.title;
          tab.lastAccessedAt = Date.now();
          tabs = tabs;
          saveTabs();
        }
      }
    });
    unlisteners.push(unlistenNavigation);

    const unlistenModified = await listen<{ tabId: string; modified: boolean }>('tab-modified', (event) => {
      const tab = tabs.find(t => t.id === event.payload.tabId);
      if (tab) {
        tab.isModified = event.payload.modified;
        tabs = tabs;
      }
    });
    unlisteners.push(unlistenModified);
  }

  async function saveTabs(): Promise<void> {
    try {
      await invoke('save_window_tabs', { tabs, activeTabId });
      await invoke('save_tab_groups', { groups });
    } catch (error) {
      console.error('Failed to save tabs:', error);
    }
  }

  function createTab(route: string = '/', title: string = 'New Tab'): void {
    if (tabs.length >= maxTabs) {
      console.warn('Maximum tabs reached');
      return;
    }

    const newTab: WindowTab = {
      id: crypto.randomUUID(),
      title,
      route,
      isPinned: false,
      isModified: false,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    // Insert after active tab or at end
    const activeIndex = tabs.findIndex(t => t.id === activeTabId);
    if (activeIndex >= 0) {
      tabs.splice(activeIndex + 1, 0, newTab);
    } else {
      tabs.push(newTab);
    }
    tabs = tabs;
    
    selectTab(newTab.id);
    saveTabs();
  }

  function selectTab(tabId: string): void {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      activeTabId = tabId;
      tab.lastAccessedAt = Date.now();
      tabs = tabs;
      
      dispatch('tabChange', { tabId, index: tabs.indexOf(tab) });
      saveTabs();
    }
  }

  async function closeTab(tabId: string): Promise<void> {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.isModified && tabCloseConfirm) {
      const confirmed = await invoke<boolean>('confirm_close_tab', {
        title: tab.title,
        message: 'This tab has unsaved changes. Close anyway?'
      });
      if (!confirmed) return;
    }

    const index = tabs.indexOf(tab);
    tabs = tabs.filter(t => t.id !== tabId);

    // Remove from groups
    groups = groups.map(g => ({
      ...g,
      tabIds: g.tabIds.filter(id => id !== tabId)
    }));

    // Select adjacent tab if closing active
    if (activeTabId === tabId) {
      if (tabs.length > 0) {
        const newIndex = Math.min(index, tabs.length - 1);
        activeTabId = tabs[newIndex].id;
      } else {
        activeTabId = null;
        createTab(); // Always have at least one tab
      }
    }

    dispatch('tabClose', { tabId });
    saveTabs();
  }

  function closeOtherTabs(tabId: string): void {
    const tabsToClose = tabs.filter(t => t.id !== tabId && !t.isPinned);
    tabsToClose.forEach(t => closeTab(t.id));
  }

  function closeTabsToRight(tabId: string): void {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index >= 0) {
      const tabsToClose = tabs.slice(index + 1).filter(t => !t.isPinned);
      tabsToClose.forEach(t => closeTab(t.id));
    }
  }

  function togglePinTab(tabId: string): void {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isPinned = !tab.isPinned;
      
      // Move pinned tabs to front
      const pinned = tabs.filter(t => t.isPinned);
      const unpinned = tabs.filter(t => !t.isPinned);
      tabs = [...pinned, ...unpinned];
      
      saveTabs();
    }
  }

  function duplicateTab(tabId: string): void {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tabs.length < maxTabs) {
      createTab(tab.route, `${tab.title} (copy)`);
    }
  }

  // Drag and drop
  function handleDragStart(event: DragEvent, tabId: string): void {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isPinned) {
      event.preventDefault();
      return;
    }
    
    draggedTabId = tabId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tabId);
    }
  }

  function handleDragOver(event: DragEvent, tabId: string): void {
    event.preventDefault();
    if (draggedTabId && draggedTabId !== tabId) {
      dragOverTabId = tabId;
    }
  }

  function handleDragLeave(): void {
    dragOverTabId = null;
  }

  function handleDrop(event: DragEvent, targetTabId: string): void {
    event.preventDefault();
    
    if (!draggedTabId || draggedTabId === targetTabId) {
      draggedTabId = null;
      dragOverTabId = null;
      return;
    }

    const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
    const toIndex = tabs.findIndex(t => t.id === targetTabId);

    if (fromIndex >= 0 && toIndex >= 0) {
      const [movedTab] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, movedTab);
      tabs = tabs;
      
      dispatch('tabReorder', { fromIndex, toIndex });
      saveTabs();
    }

    draggedTabId = null;
    dragOverTabId = null;
  }

  function handleDragEnd(): void {
    draggedTabId = null;
    dragOverTabId = null;
  }

  // Tab preview
  function handleTabHover(event: MouseEvent, tabId: string): void {
    if (!showTabPreview) return;
    
    hoveredTabId = tabId;
    previewPosition = { x: event.clientX, y: event.clientY + 20 };
    
    setTimeout(() => {
      if (hoveredTabId === tabId) {
        showPreview = true;
      }
    }, 500);
  }

  function handleTabLeave(): void {
    hoveredTabId = null;
    showPreview = false;
  }

  // Context menu
  function handleContextMenu(event: MouseEvent, tabId: string): void {
    event.preventDefault();
    contextMenuTabId = tabId;
    contextMenuPosition = { x: event.clientX, y: event.clientY };
  }

  function closeContextMenu(): void {
    contextMenuTabId = null;
  }

  // Groups
  function createGroup(): void {
    if (!newGroupName.trim()) return;

    const group: TabGroup = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      color: groupColors[groups.length % groupColors.length],
      tabIds: [],
      isCollapsed: false
    };

    groups = [...groups, group];
    newGroupName = '';
    isAddingGroup = false;
    saveTabs();
  }

  function addTabToGroup(tabId: string, groupId: string): void {
    // Remove from other groups first
    groups = groups.map(g => ({
      ...g,
      tabIds: g.tabIds.filter(id => id !== tabId)
    }));

    // Add to new group
    const group = groups.find(g => g.id === groupId);
    if (group) {
      group.tabIds.push(tabId);
      groups = groups;
      saveTabs();
    }
  }

  function removeFromGroup(tabId: string): void {
    groups = groups.map(g => ({
      ...g,
      tabIds: g.tabIds.filter(id => id !== tabId)
    }));
    saveTabs();
  }

  function toggleGroupCollapse(groupId: string): void {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      group.isCollapsed = !group.isCollapsed;
      groups = groups;
      saveTabs();
    }
  }

  function deleteGroup(groupId: string): void {
    groups = groups.filter(g => g.id !== groupId);
    saveTabs();
  }

  function getTabGroup(tabId: string): TabGroup | undefined {
    return groups.find(g => g.tabIds.includes(tabId));
  }

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent): void {
    const isMod = event.metaKey || event.ctrlKey;

    if (isMod && event.key === 't') {
      event.preventDefault();
      createTab();
    } else if (isMod && event.key === 'w') {
      event.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    } else if (isMod && event.shiftKey && event.key === 'Tab') {
      event.preventDefault();
      navigateTabs(-1);
    } else if (isMod && event.key === 'Tab') {
      event.preventDefault();
      navigateTabs(1);
    } else if (isMod && event.key >= '1' && event.key <= '9') {
      event.preventDefault();
      const index = parseInt(event.key) - 1;
      if (index < tabs.length) {
        selectTab(tabs[index].id);
      }
    }
  }

  function navigateTabs(direction: number): void {
    if (tabs.length === 0) return;
    
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = tabs.length - 1;
    if (newIndex >= tabs.length) newIndex = 0;
    
    selectTab(tabs[newIndex].id);
  }

  // Reactive
  $: pinnedTabs = tabs.filter(t => t.isPinned);
  $: unpinnedTabs = tabs.filter(t => !t.isPinned);
  $: hoveredTab = tabs.find(t => t.id === hoveredTabId);
</script>

<svelte:window on:keydown={handleKeydown} on:click={closeContextMenu} />

<div class="window-tabs-manager">
  <div class="tabs-bar">
    <!-- Pinned tabs -->
    {#if pinnedTabs.length > 0}
      <div class="pinned-tabs">
        {#each pinnedTabs as tab (tab.id)}
          <button
            class="tab pinned"
            class:active={tab.id === activeTabId}
            on:click={() => selectTab(tab.id)}
            on:contextmenu={(e) => handleContextMenu(e, tab.id)}
            title={tab.title}
          >
            {#if tab.icon}
              <img src={tab.icon} alt="" class="tab-icon" />
            {:else}
              <span class="tab-icon-placeholder">📄</span>
            {/if}
            {#if tab.isModified}
              <span class="modified-dot" />
            {/if}
          </button>
        {/each}
      </div>
      <div class="tabs-divider" />
    {/if}

    <!-- Regular tabs -->
    <div class="regular-tabs">
      {#each unpinnedTabs as tab (tab.id)}
        {@const tabGroup = getTabGroup(tab.id)}
        <button
          class="tab"
          class:active={tab.id === activeTabId}
          class:dragging={tab.id === draggedTabId}
          class:drag-over={tab.id === dragOverTabId}
          style={tabGroup ? `--group-color: ${tabGroup.color}` : ''}
          draggable="true"
          on:click={() => selectTab(tab.id)}
          on:contextmenu={(e) => handleContextMenu(e, tab.id)}
          on:dragstart={(e) => handleDragStart(e, tab.id)}
          on:dragover={(e) => handleDragOver(e, tab.id)}
          on:dragleave={handleDragLeave}
          on:drop={(e) => handleDrop(e, tab.id)}
          on:dragend={handleDragEnd}
          on:mouseenter={(e) => handleTabHover(e, tab.id)}
          on:mouseleave={handleTabLeave}
        >
          {#if tabGroup}
            <span class="tab-group-indicator" style="background: {tabGroup.color}" />
          {/if}
          {#if tab.icon}
            <img src={tab.icon} alt="" class="tab-icon" />
          {:else}
            <span class="tab-icon-placeholder">📄</span>
          {/if}
          <span class="tab-title">{tab.title}</span>
          {#if tab.isModified}
            <span class="modified-dot" />
          {/if}
          <button
            class="tab-close"
            on:click|stopPropagation={() => closeTab(tab.id)}
            title="Close tab"
          >
            ✕
          </button>
        </button>
      {/each}
    </div>

    <!-- New tab button -->
    <button
      class="new-tab-btn"
      on:click={() => createTab()}
      title="New tab (Ctrl+T)"
      disabled={tabs.length >= maxTabs}
    >
      +
    </button>

    <!-- Tab groups toggle -->
    {#if enableGroups}
      <div class="tabs-spacer" />
      <button
        class="groups-btn"
        on:click={() => isAddingGroup = !isAddingGroup}
        title="Manage tab groups"
      >
        📁
      </button>
    {/if}
  </div>

  <!-- Group creation panel -->
  {#if isAddingGroup}
    <div class="group-panel">
      <input
        type="text"
        bind:value={newGroupName}
        placeholder="Group name..."
        on:keydown={(e) => e.key === 'Enter' && createGroup()}
      />
      <button on:click={createGroup}>Create</button>
      <button on:click={() => isAddingGroup = false}>Cancel</button>
      
      {#if groups.length > 0}
        <div class="existing-groups">
          {#each groups as group (group.id)}
            <div class="group-item" style="--group-color: {group.color}">
              <span class="group-color" style="background: {group.color}" />
              <span class="group-name">{group.name}</span>
              <span class="group-count">{group.tabIds.length}</span>
              <button on:click={() => deleteGroup(group.id)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Tab preview tooltip -->
  {#if showPreview && hoveredTab}
    <div
      class="tab-preview"
      style="left: {previewPosition.x}px; top: {previewPosition.y}px"
    >
      <div class="preview-title">{hoveredTab.title}</div>
      <div class="preview-route">{hoveredTab.route}</div>
      <div class="preview-time">
        Last accessed: {new Date(hoveredTab.lastAccessedAt).toLocaleTimeString()}
      </div>
    </div>
  {/if}

  <!-- Context menu -->
  {#if contextMenuTabId}
    {@const contextTab = tabs.find(t => t.id === contextMenuTabId)}
    <div
      class="context-menu"
      style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px"
    >
      <button on:click={() => { closeTab(contextMenuTabId!); closeContextMenu(); }}>
        Close Tab
      </button>
      <button on:click={() => { closeOtherTabs(contextMenuTabId!); closeContextMenu(); }}>
        Close Other Tabs
      </button>
      <button on:click={() => { closeTabsToRight(contextMenuTabId!); closeContextMenu(); }}>
        Close Tabs to Right
      </button>
      <div class="menu-divider" />
      <button on:click={() => { togglePinTab(contextMenuTabId!); closeContextMenu(); }}>
        {contextTab?.isPinned ? 'Unpin Tab' : 'Pin Tab'}
      </button>
      <button on:click={() => { duplicateTab(contextMenuTabId!); closeContextMenu(); }}>
        Duplicate Tab
      </button>
      {#if enableGroups}
        <div class="menu-divider" />
        {#if getTabGroup(contextMenuTabId!)}
          <button on:click={() => { removeFromGroup(contextMenuTabId!); closeContextMenu(); }}>
            Remove from Group
          </button>
        {/if}
        {#each groups as group (group.id)}
          <button on:click={() => { addTabToGroup(contextMenuTabId!, group.id); closeContextMenu(); }}>
            Add to "{group.name}"
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .window-tabs-manager {
    position: relative;
    width: 100%;
    background: var(--bg-secondary, #1e1e1e);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .tabs-bar {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 4px;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .tabs-bar::-webkit-scrollbar {
    height: 4px;
  }

  .tabs-bar::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, #555);
    border-radius: 2px;
  }

  .pinned-tabs,
  .regular-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .tabs-divider {
    width: 1px;
    height: 20px;
    background: var(--border-color, #444);
    margin: 0 6px;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 6px 6px 0 0;
    color: var(--text-secondary, #888);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    max-width: 200px;
    min-width: 100px;
  }

  .tab.pinned {
    min-width: auto;
    max-width: 40px;
    padding: 6px 10px;
  }

  .tab:hover {
    background: var(--bg-hover, #2a2a2a);
    color: var(--text-primary, #fff);
  }

  .tab.active {
    background: var(--bg-primary, #252525);
    color: var(--text-primary, #fff);
  }

  .tab.dragging {
    opacity: 0.5;
  }

  .tab.drag-over {
    border-left: 2px solid var(--accent-color, #007acc);
  }

  .tab-group-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 6px 6px 0 0;
  }

  .tab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .tab-icon-placeholder {
    font-size: 14px;
    flex-shrink: 0;
  }

  .tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .modified-dot {
    width: 8px;
    height: 8px;
    background: var(--accent-color, #007acc);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tab-close {
    display: none;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary, #888);
    font-size: 10px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .tab:hover .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-close:hover {
    background: var(--bg-danger, #ff4444);
    color: white;
  }

  .new-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-left: 4px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary, #888);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .new-tab-btn:hover:not(:disabled) {
    background: var(--bg-hover, #2a2a2a);
    color: var(--text-primary, #fff);
  }

  .new-tab-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tabs-spacer {
    flex: 1;
  }

  .groups-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .groups-btn:hover {
    background: var(--bg-hover, #2a2a2a);
  }

  .group-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-tertiary, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
  }

  .group-panel input {
    flex: 1;
    min-width: 150px;
    padding: 6px 10px;
    background: var(--input-bg, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .group-panel button {
    padding: 6px 12px;
    background: var(--accent-color, #007acc);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 13px;
    cursor: pointer;
  }

  .group-panel button:last-of-type {
    background: var(--bg-secondary, #333);
  }

  .existing-groups {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    margin-top: 4px;
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-secondary, #252525);
    border-radius: 4px;
    font-size: 12px;
  }

  .group-color {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .group-name {
    color: var(--text-primary, #fff);
  }

  .group-count {
    color: var(--text-secondary, #888);
    padding: 0 4px;
    background: var(--bg-primary, #1e1e1e);
    border-radius: 4px;
  }

  .group-item button {
    padding: 2px 4px;
    background: transparent;
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .group-item button:hover {
    color: var(--text-danger, #ff4444);
  }

  .tab-preview {
    position: fixed;
    padding: 10px;
    background: var(--bg-floating, #252525);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    pointer-events: none;
  }

  .preview-title {
    font-weight: 500;
    color: var(--text-primary, #fff);
    margin-bottom: 4px;
  }

  .preview-route {
    font-size: 12px;
    color: var(--text-secondary, #888);
    margin-bottom: 4px;
  }

  .preview-time {
    font-size: 11px;
    color: var(--text-tertiary, #666);
  }

  .context-menu {
    position: fixed;
    min-width: 180px;
    background: var(--bg-floating, #252525);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    overflow: hidden;
  }

  .context-menu button {
    display: block;
    width: 100%;
    padding: 8px 14px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .context-menu button:hover {
    background: var(--bg-hover, #333);
  }

  .menu-divider {
    height: 1px;
    background: var(--border-color, #444);
    margin: 4px 0;
  }

  @media (prefers-color-scheme: light) {
    .window-tabs-manager {
      background: var(--bg-secondary, #f5f5f5);
    }

    .tab.active {
      background: var(--bg-primary, #fff);
    }
  }
</style>
