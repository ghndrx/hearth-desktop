<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  interface InstalledApp {
    name: string;
    path: string;
    icon: string | null;
    category: string | null;
    launch_count: number;
    last_launched: number | null;
  }

  export let isOpen = false;
  export let onClose: () => void = () => {};

  let searchQuery = '';
  let allApps: InstalledApp[] = [];
  let filteredApps: InstalledApp[] = [];
  let recentApps: InstalledApp[] = [];
  let selectedIndex = 0;
  let isLoading = true;
  let searchInput: HTMLInputElement;
  let categories: string[] = [];
  let selectedCategory: string | null = null;

  $: {
    if (searchQuery) {
      filterApps();
    } else {
      filteredApps = selectedCategory
        ? allApps.filter(app => app.category === selectedCategory)
        : allApps;
    }
    selectedIndex = 0;
  }

  async function filterApps() {
    try {
      filteredApps = await invoke<InstalledApp[]>('search_apps', { query: searchQuery });
      if (selectedCategory) {
        filteredApps = filteredApps.filter(app => app.category === selectedCategory);
      }
    } catch (error) {
      console.error('Failed to search apps:', error);
      // Fallback to client-side filtering
      const query = searchQuery.toLowerCase();
      filteredApps = allApps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        (app.category && app.category.toLowerCase().includes(query))
      );
    }
  }

  async function loadApps() {
    isLoading = true;
    try {
      allApps = await invoke<InstalledApp[]>('scan_installed_apps');
      filteredApps = allApps;
      
      // Extract unique categories
      const categorySet = new Set<string>();
      allApps.forEach(app => {
        if (app.category) categorySet.add(app.category);
      });
      categories = Array.from(categorySet).sort();
      
      // Load recent apps
      recentApps = await invoke<InstalledApp[]>('get_recent_apps', { limit: 5 });
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      isLoading = false;
    }
  }

  async function launchApp(app: InstalledApp) {
    try {
      await invoke<boolean>('launch_app', { appPath: app.path });
      // Update recent apps after launch
      recentApps = await invoke<InstalledApp[]>('get_recent_apps', { limit: 5 });
      onClose();
    } catch (error) {
      console.error('Failed to launch app:', error);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredApps.length - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredApps[selectedIndex]) {
          launchApp(filteredApps[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case 'Tab':
        event.preventDefault();
        // Cycle through categories
        if (categories.length > 0) {
          const currentIdx = selectedCategory 
            ? categories.indexOf(selectedCategory) 
            : -1;
          const nextIdx = (currentIdx + 1) % (categories.length + 1);
          selectedCategory = nextIdx === categories.length ? null : categories[nextIdx];
        }
        break;
    }
  }

  function scrollToSelected() {
    const element = document.querySelector(`[data-app-index="${selectedIndex}"]`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function selectCategory(category: string | null) {
    selectedCategory = category;
  }

  function getAppIcon(app: InstalledApp): string {
    // Return a default icon based on category or generic
    const categoryIcons: Record<string, string> = {
      'Internet': '🌐',
      'Communication': '💬',
      'Graphics': '🎨',
      'Music': '🎵',
      'Video': '🎬',
      'Development': '💻',
      'System': '⚙️',
      'Games': '🎮',
      'Office': '📄',
      'Utilities': '🔧',
    };
    
    if (app.category && categoryIcons[app.category]) {
      return categoryIcons[app.category];
    }
    return '📱';
  }

  onMount(() => {
    loadApps();
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  $: if (isOpen && searchInput) {
    setTimeout(() => searchInput?.focus(), 50);
  }
</script>

{#if isOpen}
  <div 
    class="launcher-overlay" 
    transition:fade={{ duration: 150 }}
    on:click={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    aria-modal="true"
    aria-label="Application Launcher"
  >
    <div 
      class="launcher-container"
      transition:fly={{ y: -20, duration: 200, easing: quintOut }}
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="presentation"
    >
      <!-- Search Header -->
      <div class="search-header">
        <div class="search-icon">🔍</div>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search applications..."
          class="search-input"
          aria-label="Search applications"
        />
        <button class="close-btn" on:click={onClose} aria-label="Close launcher">
          ✕
        </button>
      </div>

      <!-- Category Pills -->
      {#if categories.length > 0}
        <div class="category-pills">
          <button
            class="category-pill"
            class:active={selectedCategory === null}
            on:click={() => selectCategory(null)}
          >
            All
          </button>
          {#each categories as category}
            <button
              class="category-pill"
              class:active={selectedCategory === category}
              on:click={() => selectCategory(category)}
            >
              {category}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Recent Apps -->
      {#if !searchQuery && recentApps.length > 0 && !selectedCategory}
        <div class="section">
          <h3 class="section-title">Recent</h3>
          <div class="recent-apps">
            {#each recentApps as app}
              <button
                class="recent-app"
                on:click={() => launchApp(app)}
                transition:scale={{ duration: 150 }}
                aria-label={`Launch ${app.name}`}
              >
                <span class="app-icon">{getAppIcon(app)}</span>
                <span class="app-name-small">{app.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- App List -->
      <div class="app-list" role="listbox">
        {#if isLoading}
          <div class="loading">
            <div class="spinner"></div>
            <span>Scanning applications...</span>
          </div>
        {:else if filteredApps.length === 0}
          <div class="empty-state">
            <span class="empty-icon">🔎</span>
            <span>No applications found</span>
          </div>
        {:else}
          {#each filteredApps as app, index}
            <button
              class="app-item"
              class:selected={index === selectedIndex}
              data-app-index={index}
              on:click={() => launchApp(app)}
              on:mouseenter={() => selectedIndex = index}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span class="app-icon-large">{getAppIcon(app)}</span>
              <div class="app-info">
                <span class="app-name">{app.name}</span>
                {#if app.category}
                  <span class="app-category">{app.category}</span>
                {/if}
              </div>
              {#if app.launch_count > 0}
                <span class="launch-count" title="Times launched">
                  {app.launch_count}×
                </span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="launcher-footer">
        <span class="hint">↑↓ Navigate</span>
        <span class="hint">↵ Launch</span>
        <span class="hint">Tab Categories</span>
        <span class="hint">Esc Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .launcher-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 9999;
  }

  .launcher-container {
    background: var(--bg-primary, #1a1a2e);
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  .search-header {
    display: flex;
    align-items: center;
    padding: 16px;
    gap: 12px;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .search-icon {
    font-size: 20px;
    opacity: 0.6;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 18px;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    padding: 4px 8px;
    font-size: 16px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #fff);
  }

  .category-pills {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .category-pill {
    background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
    border: none;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .category-pill:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  }

  .category-pill.active {
    background: var(--accent-color, #6366f1);
    color: white;
  }

  .section {
    padding: 12px 16px 0;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px;
  }

  .recent-apps {
    display: flex;
    gap: 8px;
    padding-bottom: 12px;
    overflow-x: auto;
  }

  .recent-app {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 16px;
    background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 80px;
  }

  .recent-app:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
    transform: translateY(-2px);
  }

  .app-name-small {
    font-size: 11px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .app-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: all 0.1s ease;
  }

  .app-item:hover,
  .app-item.selected {
    background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  }

  .app-item.selected {
    background: var(--accent-color, #6366f1);
  }

  .app-icon {
    font-size: 24px;
  }

  .app-icon-large {
    font-size: 32px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
    border-radius: 10px;
  }

  .app-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .app-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-category {
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  .launch-count {
    font-size: 11px;
    color: var(--text-tertiary, rgba(255, 255, 255, 0.3));
    background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
    padding: 2px 8px;
    border-radius: 10px;
  }

  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    gap: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-top-color: var(--accent-color, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .launcher-footer {
    display: flex;
    gap: 16px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    background: var(--bg-secondary, rgba(0, 0, 0, 0.2));
  }

  .hint {
    font-size: 11px;
    color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  }

  /* Scrollbar styling */
  .app-list::-webkit-scrollbar {
    width: 6px;
  }

  .app-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .app-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }

  .app-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
  }
</style>
