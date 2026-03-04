<script lang="ts">
  /**
   * CustomTitlebar.svelte
   * 
   * A custom window titlebar that replaces native OS decorations.
   * Provides consistent theming across platforms with integrated
   * connection status and quick actions.
   * 
   * To use: Set decorations: false in tauri.conf.json and include
   * this component at the top of your app layout.
   */
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { fade, scale } from 'svelte/transition';
  import { networkStatus } from '$lib/stores/networkStatus';
  import { syncStatus } from '$lib/stores/syncStatus';
  import { websocketStatus } from '$lib/stores/websocket';

  const dispatch = createEventDispatcher<{
    menuClick: void;
  }>();

  // Props
  export let showMenuButton = true;
  export let showConnectionStatus = true;
  export let draggable = true;
  export let class_ = '';
  export { class_ as class };

  // Window state
  let isMaximized = false;
  let isFullscreen = false;
  let isFocused = true;

  // Connection state
  let connectionState: 'connected' | 'connecting' | 'disconnected' | 'error' = 'connecting';
  let connectionMessage = '';

  // Menu state
  let showMenu = false;
  let menuButtonRef: HTMLButtonElement;

  // Event unlisteners
  let unlistenFocus: UnlistenFn | null = null;
  let unlistenBlur: UnlistenFn | null = null;
  let unlistenMaximize: UnlistenFn | null = null;
  let unlistenUnmaximize: UnlistenFn | null = null;
  let unlistenEnterFullscreen: UnlistenFn | null = null;
  let unlistenLeaveFullscreen: UnlistenFn | null = null;

  const appWindow = getCurrentWindow();

  onMount(async () => {
    // Listen for window state changes
    unlistenFocus = await appWindow.listen('tauri://focus', () => {
      isFocused = true;
    });

    unlistenBlur = await appWindow.listen('tauri://blur', () => {
      isFocused = false;
    });

    unlistenMaximize = await appWindow.listen('tauri://resize', async () => {
      isMaximized = await appWindow.isMaximized();
    });

    unlistenEnterFullscreen = await appWindow.listen('tauri://enter-fullscreen', () => {
      isFullscreen = true;
    });

    unlistenLeaveFullscreen = await appWindow.listen('tauri://leave-fullscreen', () => {
      isFullscreen = false;
    });

    // Get initial window state
    try {
      isMaximized = await appWindow.isMaximized();
      isFullscreen = await appWindow.isFullscreen();
    } catch (e) {
      console.error('[CustomTitlebar] Failed to get window state:', e);
    }

    // Initialize network status
    networkStatus.init();
  });

  onDestroy(() => {
    unlistenFocus?.();
    unlistenBlur?.();
    unlistenMaximize?.();
    unlistenUnmaximize?.();
    unlistenEnterFullscreen?.();
    unlistenLeaveFullscreen?.();
  });

  // Derive connection state from multiple sources
  $: {
    if (!$networkStatus.isOnline) {
      connectionState = 'disconnected';
      connectionMessage = 'Offline';
    } else if ($websocketStatus?.state === 'connected') {
      connectionState = 'connected';
      connectionMessage = 'Connected';
    } else if ($websocketStatus?.state === 'connecting') {
      connectionState = 'connecting';
      connectionMessage = 'Connecting...';
    } else if ($syncStatus.state === 'error') {
      connectionState = 'error';
      connectionMessage = 'Sync error';
    } else {
      connectionState = 'connecting';
      connectionMessage = 'Connecting...';
    }
  }

  // Window control handlers
  async function handleMinimize() {
    try {
      await appWindow.minimize();
    } catch (e) {
      console.error('[CustomTitlebar] Failed to minimize:', e);
    }
  }

  async function handleMaximizeRestore() {
    try {
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.error('[CustomTitlebar] Failed to maximize/restore:', e);
    }
  }

  async function handleClose() {
    try {
      // Check if we should minimize to tray instead
      const minimizeToTray = localStorage.getItem('hearth-minimize-to-tray') === 'true';
      if (minimizeToTray) {
        await appWindow.hide();
      } else {
        await appWindow.close();
      }
    } catch (e) {
      console.error('[CustomTitlebar] Failed to close:', e);
    }
  }

  function handleMenuClick() {
    showMenu = !showMenu;
    if (showMenu) {
      dispatch('menuClick');
    }
  }

  function handleMenuItemClick(action: string) {
    showMenu = false;
    // Emit event for parent to handle
    window.dispatchEvent(new CustomEvent('titlebar:menu-action', { detail: action }));
  }

  // Click outside to close menu
  function handleClickOutside(event: MouseEvent) {
    if (showMenu && menuButtonRef && !menuButtonRef.contains(event.target as Node)) {
      showMenu = false;
    }
  }

  // Get connection status color
  $: connectionColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500',
    error: 'bg-orange-500'
  }[connectionState];

  $: connectionIcon = {
    connected: '●',
    connecting: '◐',
    disconnected: '○',
    error: '!'
  }[connectionState];
</script>

<svelte:window on:click={handleClickOutside} />

{#if !isFullscreen}
  <div
    class="custom-titlebar {class_}"
    class:is-focused={isFocused}
    class:is-unfocused={!isFocused}
    data-tauri-drag-region={draggable}
  >
    <!-- Left section: Menu button and app branding -->
    <div class="titlebar-section left">
      {#if showMenuButton}
        <button
          bind:this={menuButtonRef}
          class="menu-button"
          on:click={handleMenuClick}
          aria-label="Menu"
          aria-expanded={showMenu}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>

        {#if showMenu}
          <div class="dropdown-menu" transition:scale={{ duration: 150, start: 0.95 }}>
            <button class="menu-item" on:click={() => handleMenuItemClick('settings')}>
              <span>⚙️</span> Settings
            </button>
            <button class="menu-item" on:click={() => handleMenuItemClick('digest')}>
              <span>📊</span> Daily Digest
            </button>
            <button class="menu-item" on:click={() => handleMenuItemClick('focus')}>
              <span>🎯</span> Focus Mode
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item" on:click={() => handleMenuItemClick('about')}>
              <span>ℹ️</span> About Hearth
            </button>
          </div>
        {/if}
      {/if}

      <div class="app-branding" data-tauri-drag-region={draggable}>
        <span class="app-icon">🔥</span>
        <span class="app-name">Hearth</span>
      </div>
    </div>

    <!-- Center section: Window title (draggable) -->
    <div class="titlebar-section center" data-tauri-drag-region={draggable}>
      <slot name="title">
        <span class="window-title">Hearth Chat</span>
      </slot>
    </div>

    <!-- Right section: Connection status and window controls -->
    <div class="titlebar-section right">
      {#if showConnectionStatus}
        <div class="connection-status" title={connectionMessage}>
          <span class="connection-indicator {connectionColor}">{connectionIcon}</span>
          <span class="connection-text">{connectionMessage}</span>
        </div>
      {/if}

      <slot name="actions"></slot>

      <div class="window-controls">
        <button
          class="window-control minimize"
          on:click={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>

        <button
          class="window-control maximize"
          on:click={handleMaximizeRestore}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {#if isMaximized}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 3h6v6H3V3zm1 1v4h4V4H4z" fill="currentColor"/>
            </svg>
          {:else}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          {/if}
        </button>

        <button
          class="window-control close"
          on:click={handleClose}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    padding: 0 8px;
    background: var(--bg-secondary, #1a1b1e);
    border-bottom: 1px solid var(--border-color, #2f3035);
    user-select: none;
    -webkit-user-select: none;
    transition: background-color 0.15s ease;
  }

  .custom-titlebar.is-unfocused {
    background: var(--bg-tertiary, #151619);
    border-bottom-color: var(--border-color-muted, #25262b);
  }

  .titlebar-section {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .titlebar-section.left {
    justify-content: flex-start;
  }

  .titlebar-section.center {
    justify-content: center;
    flex: 2;
  }

  .titlebar-section.right {
    justify-content: flex-end;
  }

  /* Menu button */
  .menu-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .menu-button:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #f3f4f6);
  }

  .menu-button:active {
    transform: scale(0.95);
  }

  /* Dropdown menu */
  .dropdown-menu {
    position: absolute;
    top: 40px;
    left: 8px;
    min-width: 180px;
    padding: 6px;
    background: var(--bg-primary, #1e1f22);
    border: 1px solid var(--border-color, #2f3035);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    z-index: 1000;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary, #f3f4f6);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .menu-item:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
  }

  .menu-divider {
    height: 1px;
    margin: 6px 0;
    background: var(--border-color, #2f3035);
  }

  /* App branding */
  .app-branding {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: default;
  }

  .app-icon {
    font-size: 18px;
  }

  .app-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #f3f4f6);
  }

  /* Window title */
  .window-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #9ca3af);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Connection status */
  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--bg-tertiary, #151619);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-secondary, #9ca3af);
  }

  .connection-indicator {
    font-size: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .connection-indicator.bg-green-500 {
    color: #22c55e;
  }

  .connection-indicator.bg-yellow-500 {
    color: #eab308;
  }

  .connection-indicator.bg-red-500 {
    color: #ef4444;
  }

  .connection-indicator.bg-orange-500 {
    color: #f97316;
  }

  .connection-text {
    display: none;
  }

  @media (min-width: 900px) {
    .connection-text {
      display: inline;
    }
  }

  /* Window controls */
  .window-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: 8px;
  }

  .window-control {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .window-control:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #f3f4f6);
  }

  .window-control.close:hover {
    background: #ef4444;
    color: white;
  }

  .window-control:active {
    transform: scale(0.95);
  }

  /* Platform-specific adjustments */
  @media (prefers-color-scheme: light) {
    .custom-titlebar {
      background: #f3f4f6;
      border-bottom-color: #e5e7eb;
    }

    .custom-titlebar.is-unfocused {
      background: #f9fafb;
    }
  }
</style>
