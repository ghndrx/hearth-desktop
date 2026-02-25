<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  // Mini mode state
  interface MiniModeState {
    is_active: boolean;
    previous_x: number;
    previous_y: number;
    previous_width: number;
    previous_height: number;
    previous_always_on_top: boolean;
    mini_width: number;
    mini_height: number;
    corner: string;
  }

  let isActive = false;
  let currentCorner = 'bottom-right';
  let showControls = false;
  let unlisten: UnlistenFn | null = null;

  const corners = [
    { id: 'top-left', label: '↖', title: 'Top Left' },
    { id: 'top-right', label: '↗', title: 'Top Right' },
    { id: 'bottom-left', label: '↙', title: 'Bottom Left' },
    { id: 'bottom-right', label: '↘', title: 'Bottom Right' },
  ];

  onMount(async () => {
    // Get initial state
    try {
      const state: MiniModeState = await invoke('get_mini_mode_state');
      isActive = state.is_active;
      currentCorner = state.corner;
    } catch (e) {
      console.warn('Failed to get mini mode state:', e);
    }

    // Listen for mini mode changes (from global shortcut)
    unlisten = await listen<{ active: boolean; corner: string }>('mini-mode-changed', (event) => {
      isActive = event.payload.active;
      if (event.payload.corner) {
        currentCorner = event.payload.corner;
      }
    });
  });

  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });

  async function toggleMiniMode() {
    try {
      const state: MiniModeState = await invoke('toggle_mini_mode', { corner: currentCorner });
      isActive = state.is_active;
      currentCorner = state.corner;
    } catch (e) {
      console.error('Failed to toggle mini mode:', e);
    }
  }

  async function exitMiniMode() {
    try {
      const state: MiniModeState = await invoke('exit_mini_mode');
      isActive = state.is_active;
    } catch (e) {
      console.error('Failed to exit mini mode:', e);
    }
  }

  async function moveToCorner(corner: string) {
    try {
      const state: MiniModeState = await invoke('move_mini_mode_corner', { corner });
      currentCorner = state.corner;
    } catch (e) {
      console.error('Failed to move mini mode:', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Escape exits mini mode
    if (e.key === 'Escape' && isActive) {
      exitMiniMode();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isActive}
  <!-- Mini Mode Overlay Controls -->
  <div 
    class="mini-mode-controls"
    class:visible={showControls}
    on:mouseenter={() => showControls = true}
    on:mouseleave={() => showControls = false}
    role="toolbar"
    aria-label="Mini mode controls"
  >
    <!-- Header with drag handle and exit button -->
    <div class="mini-header" data-tauri-drag-region>
      <span class="mini-title">Mini Mode</span>
      <button 
        class="exit-btn"
        on:click={exitMiniMode}
        title="Exit Mini Mode (Esc)"
        aria-label="Exit mini mode"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h4v4H2V4zm6-2h4v4H8V2zm0 6h4v4H8V8zM2 10h4v4H2v-4z" 
                fill="currentColor" opacity="0.8"/>
        </svg>
      </button>
    </div>

    <!-- Corner Position Buttons -->
    <div class="corner-buttons" role="group" aria-label="Window position">
      {#each corners as corner}
        <button
          class="corner-btn"
          class:active={currentCorner === corner.id}
          on:click={() => moveToCorner(corner.id)}
          title={corner.title}
          aria-label={`Move to ${corner.title}`}
          aria-pressed={currentCorner === corner.id}
        >
          {corner.label}
        </button>
      {/each}
    </div>

    <!-- Keyboard shortcut hint -->
    <div class="shortcut-hint">
      <kbd>⌘</kbd><kbd>⇧</kbd><kbd>P</kbd> to toggle
    </div>
  </div>
{:else}
  <!-- Mini Mode Toggle Button (shown in normal mode) -->
  <button
    class="mini-mode-toggle"
    on:click={toggleMiniMode}
    title="Enter Mini Mode (⌘⇧P)"
    aria-label="Enter mini mode"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
    </svg>
  </button>
{/if}

<style>
  .mini-mode-controls {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    opacity: 0;
    transform: translateY(-100%);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
  }

  .mini-mode-controls.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .mini-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: grab;
    user-select: none;
  }

  .mini-header:active {
    cursor: grabbing;
  }

  .mini-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .exit-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    padding: 4px 6px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .exit-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .exit-btn:active {
    background: rgba(255, 255, 255, 0.3);
  }

  .corner-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .corner-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .corner-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .corner-btn.active {
    background: rgba(88, 101, 242, 0.6);
    border-color: rgba(88, 101, 242, 0.8);
    color: white;
  }

  .shortcut-hint {
    display: flex;
    justify-content: center;
    gap: 2px;
    padding-top: 4px;
  }

  .shortcut-hint kbd {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    padding: 2px 5px;
    font-size: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Toggle button for normal mode */
  .mini-mode-toggle {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 100;
    background: var(--background-secondary, #2f3136);
    border: 1px solid var(--background-modifier-accent, #40444b);
    border-radius: 8px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .mini-mode-toggle:hover {
    background: var(--background-modifier-hover, #36393f);
    transform: scale(1.05);
  }

  .mini-mode-toggle:active {
    transform: scale(0.95);
  }

  /* Media query for already small windows (hide toggle) */
  @media (max-width: 400px) {
    .mini-mode-toggle {
      display: none;
    }
  }
</style>
