<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';

  const dispatch = createEventDispatcher<{
    arranged: { layout: ArrangementLayout };
    error: { message: string };
  }>();

  export let enabled = true;
  export let animationDuration = 200;
  export let padding = 8;
  export let showPreview = true;

  type ArrangementLayout = 
    | 'cascade'
    | 'tile-horizontal'
    | 'tile-vertical'
    | 'tile-grid'
    | 'center'
    | 'maximize'
    | 'left-half'
    | 'right-half'
    | 'top-half'
    | 'bottom-half'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';

  interface WindowInfo {
    label: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }

  interface ScreenInfo {
    width: number;
    height: number;
    x: number;
    y: number;
  }

  let currentLayout: ArrangementLayout | null = null;
  let screenInfo: ScreenInfo | null = null;
  let previewLayout: ArrangementLayout | null = null;
  let isAnimating = false;

  const layouts: { id: ArrangementLayout; label: string; icon: string; description: string }[] = [
    { id: 'cascade', label: 'Cascade', icon: '📚', description: 'Stack windows diagonally' },
    { id: 'tile-horizontal', label: 'Tile Horizontal', icon: '➡️', description: 'Arrange side by side' },
    { id: 'tile-vertical', label: 'Tile Vertical', icon: '⬇️', description: 'Arrange top to bottom' },
    { id: 'tile-grid', label: 'Tile Grid', icon: '⊞', description: 'Arrange in grid pattern' },
    { id: 'center', label: 'Center', icon: '⊙', description: 'Center window on screen' },
    { id: 'maximize', label: 'Maximize', icon: '⬜', description: 'Maximize window' },
    { id: 'left-half', label: 'Left Half', icon: '◧', description: 'Snap to left half' },
    { id: 'right-half', label: 'Right Half', icon: '◨', description: 'Snap to right half' },
    { id: 'top-half', label: 'Top Half', icon: '⬒', description: 'Snap to top half' },
    { id: 'bottom-half', label: 'Bottom Half', icon: '⬓', description: 'Snap to bottom half' },
    { id: 'top-left', label: 'Top Left', icon: '◰', description: 'Snap to top-left quarter' },
    { id: 'top-right', label: 'Top Right', icon: '◳', description: 'Snap to top-right quarter' },
    { id: 'bottom-left', label: 'Bottom Left', icon: '◱', description: 'Snap to bottom-left quarter' },
    { id: 'bottom-right', label: 'Bottom Right', icon: '◲', description: 'Snap to bottom-right quarter' },
  ];

  async function getScreenInfo(): Promise<ScreenInfo> {
    try {
      const window = getCurrentWindow();
      const monitor = await window.currentMonitor();
      if (monitor) {
        return {
          width: monitor.size.width,
          height: monitor.size.height,
          x: monitor.position.x,
          y: monitor.position.y,
        };
      }
    } catch (e) {
      console.warn('Failed to get monitor info:', e);
    }
    // Fallback to reasonable defaults
    return { width: 1920, height: 1080, x: 0, y: 0 };
  }

  function calculatePosition(
    layout: ArrangementLayout,
    screen: ScreenInfo,
    windowIndex = 0,
    totalWindows = 1
  ): { x: number; y: number; width: number; height: number } {
    const { width: sw, height: sh, x: sx, y: sy } = screen;
    const p = padding;

    switch (layout) {
      case 'cascade': {
        const offset = windowIndex * 30;
        return {
          x: sx + p + offset,
          y: sy + p + offset,
          width: Math.floor(sw * 0.6),
          height: Math.floor(sh * 0.6),
        };
      }

      case 'tile-horizontal': {
        const slotWidth = Math.floor((sw - p * (totalWindows + 1)) / totalWindows);
        return {
          x: sx + p + windowIndex * (slotWidth + p),
          y: sy + p,
          width: slotWidth,
          height: sh - p * 2,
        };
      }

      case 'tile-vertical': {
        const slotHeight = Math.floor((sh - p * (totalWindows + 1)) / totalWindows);
        return {
          x: sx + p,
          y: sy + p + windowIndex * (slotHeight + p),
          width: sw - p * 2,
          height: slotHeight,
        };
      }

      case 'tile-grid': {
        const cols = Math.ceil(Math.sqrt(totalWindows));
        const rows = Math.ceil(totalWindows / cols);
        const col = windowIndex % cols;
        const row = Math.floor(windowIndex / cols);
        const cellWidth = Math.floor((sw - p * (cols + 1)) / cols);
        const cellHeight = Math.floor((sh - p * (rows + 1)) / rows);
        return {
          x: sx + p + col * (cellWidth + p),
          y: sy + p + row * (cellHeight + p),
          width: cellWidth,
          height: cellHeight,
        };
      }

      case 'center':
        return {
          x: sx + Math.floor(sw * 0.15),
          y: sy + Math.floor(sh * 0.15),
          width: Math.floor(sw * 0.7),
          height: Math.floor(sh * 0.7),
        };

      case 'maximize':
        return { x: sx + p, y: sy + p, width: sw - p * 2, height: sh - p * 2 };

      case 'left-half':
        return { x: sx + p, y: sy + p, width: Math.floor(sw / 2) - p * 1.5, height: sh - p * 2 };

      case 'right-half':
        return {
          x: sx + Math.floor(sw / 2) + Math.floor(p / 2),
          y: sy + p,
          width: Math.floor(sw / 2) - p * 1.5,
          height: sh - p * 2,
        };

      case 'top-half':
        return { x: sx + p, y: sy + p, width: sw - p * 2, height: Math.floor(sh / 2) - p * 1.5 };

      case 'bottom-half':
        return {
          x: sx + p,
          y: sy + Math.floor(sh / 2) + Math.floor(p / 2),
          width: sw - p * 2,
          height: Math.floor(sh / 2) - p * 1.5,
        };

      case 'top-left':
        return {
          x: sx + p,
          y: sy + p,
          width: Math.floor(sw / 2) - p * 1.5,
          height: Math.floor(sh / 2) - p * 1.5,
        };

      case 'top-right':
        return {
          x: sx + Math.floor(sw / 2) + Math.floor(p / 2),
          y: sy + p,
          width: Math.floor(sw / 2) - p * 1.5,
          height: Math.floor(sh / 2) - p * 1.5,
        };

      case 'bottom-left':
        return {
          x: sx + p,
          y: sy + Math.floor(sh / 2) + Math.floor(p / 2),
          width: Math.floor(sw / 2) - p * 1.5,
          height: Math.floor(sh / 2) - p * 1.5,
        };

      case 'bottom-right':
        return {
          x: sx + Math.floor(sw / 2) + Math.floor(p / 2),
          y: sy + Math.floor(sh / 2) + Math.floor(p / 2),
          width: Math.floor(sw / 2) - p * 1.5,
          height: Math.floor(sh / 2) - p * 1.5,
        };

      default:
        return { x: sx + p, y: sy + p, width: sw - p * 2, height: sh - p * 2 };
    }
  }

  async function applyLayout(layout: ArrangementLayout): Promise<void> {
    if (!enabled || isAnimating) return;

    isAnimating = true;
    try {
      const screen = await getScreenInfo();
      const position = calculatePosition(layout, screen);
      const window = getCurrentWindow();

      // Unmaximize first if needed
      const isMaximized = await window.isMaximized();
      if (isMaximized && layout !== 'maximize') {
        await window.unmaximize();
      }

      if (layout === 'maximize') {
        await window.maximize();
      } else {
        await window.setPosition(new LogicalPosition(position.x, position.y));
        await window.setSize(new LogicalSize(position.width, position.height));
      }

      currentLayout = layout;
      screenInfo = screen;
      dispatch('arranged', { layout });
    } catch (error) {
      console.error('Failed to apply layout:', error);
      dispatch('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTimeout(() => {
        isAnimating = false;
      }, animationDuration);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!enabled) return;

    // Win/Cmd + Arrow key combinations
    const isMeta = event.metaKey || event.ctrlKey;
    if (!isMeta) return;

    let layout: ArrangementLayout | null = null;

    if (event.shiftKey) {
      // Shift + Meta + Arrow = quarters
      switch (event.key) {
        case 'ArrowUp':
          layout = event.altKey ? 'top-right' : 'top-left';
          break;
        case 'ArrowDown':
          layout = event.altKey ? 'bottom-right' : 'bottom-left';
          break;
      }
    } else {
      // Meta + Arrow = halves
      switch (event.key) {
        case 'ArrowLeft':
          layout = 'left-half';
          break;
        case 'ArrowRight':
          layout = 'right-half';
          break;
        case 'ArrowUp':
          layout = event.altKey ? 'top-half' : 'maximize';
          break;
        case 'ArrowDown':
          layout = event.altKey ? 'bottom-half' : 'center';
          break;
      }
    }

    if (layout) {
      event.preventDefault();
      applyLayout(layout);
    }
  }

  function getPreviewStyle(layout: ArrangementLayout): string {
    const screen = { width: 100, height: 60, x: 0, y: 0 };
    const pos = calculatePosition(layout, screen, 0, 1);
    const scaleX = pos.width / screen.width;
    const scaleY = pos.height / screen.height;
    const offsetX = (pos.x / screen.width) * 100;
    const offsetY = (pos.y / screen.height) * 100;

    return `left: ${offsetX}%; top: ${offsetY}%; width: ${scaleX * 100}%; height: ${scaleY * 100}%;`;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    getScreenInfo().then(info => {
      screenInfo = info;
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="window-arrangement" class:disabled={!enabled}>
  <div class="arrangement-header">
    <h3>Window Arrangement</h3>
    <span class="hint">Ctrl/Cmd + Arrow keys for quick positioning</span>
  </div>

  <div class="layout-grid">
    {#each layouts as layout}
      <button
        class="layout-option"
        class:active={currentLayout === layout.id}
        class:animating={isAnimating && currentLayout === layout.id}
        on:click={() => applyLayout(layout.id)}
        on:mouseenter={() => (previewLayout = layout.id)}
        on:mouseleave={() => (previewLayout = null)}
        disabled={!enabled || isAnimating}
        title={layout.description}
      >
        {#if showPreview}
          <div class="layout-preview">
            <div class="preview-screen">
              <div
                class="preview-window"
                style={getPreviewStyle(layout.id)}
              />
            </div>
          </div>
        {:else}
          <span class="layout-icon">{layout.icon}</span>
        {/if}
        <span class="layout-label">{layout.label}</span>
      </button>
    {/each}
  </div>

  {#if currentLayout}
    <div class="current-layout">
      <span>Current: </span>
      <strong>{layouts.find(l => l.id === currentLayout)?.label}</strong>
    </div>
  {/if}
</div>

<style>
  .window-arrangement {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
  }

  .window-arrangement.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .arrangement-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .arrangement-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }

  .layout-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .layout-option:hover:not(:disabled) {
    background: var(--bg-modifier-hover, #36393f);
    border-color: var(--brand-primary, #5865f2);
  }

  .layout-option.active {
    border-color: var(--brand-primary, #5865f2);
    background: var(--brand-primary-alpha, rgba(88, 101, 242, 0.15));
  }

  .layout-option.animating {
    animation: pulse 0.2s ease;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.95); }
  }

  .layout-option:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .layout-preview {
    width: 50px;
    height: 30px;
  }

  .preview-screen {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg-primary, #36393f);
    border-radius: 2px;
    overflow: hidden;
  }

  .preview-window {
    position: absolute;
    background: var(--brand-primary, #5865f2);
    border-radius: 1px;
    opacity: 0.8;
  }

  .layout-icon {
    font-size: 1.25rem;
  }

  .layout-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #b9bbbe);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .current-layout {
    font-size: 0.8rem;
    color: var(--text-secondary, #b9bbbe);
    padding-top: 0.5rem;
    border-top: 1px solid var(--bg-modifier-accent, #4f545c);
  }

  .current-layout strong {
    color: var(--text-primary, #fff);
  }
</style>
