<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived, type Writable, type Readable } from 'svelte/store';

  // Types
  interface PiPWindow {
    id: string;
    title: string;
    width: number;
    height: number;
    x: number;
    y: number;
    alwaysOnTop: boolean;
    opacity: number;
    contentType: 'video' | 'call' | 'media' | 'custom';
    sourceId?: string;
    isMinimized: boolean;
    isVisible: boolean;
    aspectRatio?: number;
    createdAt: Date;
  }

  interface PiPConfig {
    defaultWidth: number;
    defaultHeight: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    defaultOpacity: number;
    snapToCorners: boolean;
    snapDistance: number;
    rememberPosition: boolean;
    showControls: boolean;
    autoHideControls: boolean;
    controlsHideDelay: number;
    allowResize: boolean;
    maintainAspectRatio: boolean;
    clickThrough: boolean;
    borderRadius: number;
  }

  interface ScreenCorner {
    name: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    x: number;
    y: number;
  }

  interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  }

  interface ResizeState {
    isResizing: boolean;
    edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
  }

  // Props
  export let enabled: boolean = true;
  export let config: Partial<PiPConfig> = {};

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    windowCreated: { window: PiPWindow };
    windowClosed: { windowId: string };
    windowMoved: { windowId: string; x: number; y: number };
    windowResized: { windowId: string; width: number; height: number };
    visibilityChanged: { windowId: string; visible: boolean };
    error: { message: string; code?: string };
  }>();

  // Default configuration
  const defaultConfig: PiPConfig = {
    defaultWidth: 320,
    defaultHeight: 180,
    minWidth: 200,
    minHeight: 112,
    maxWidth: 800,
    maxHeight: 450,
    defaultOpacity: 1.0,
    snapToCorners: true,
    snapDistance: 20,
    rememberPosition: true,
    showControls: true,
    autoHideControls: true,
    controlsHideDelay: 2000,
    allowResize: true,
    maintainAspectRatio: true,
    clickThrough: false,
    borderRadius: 8,
  };

  // Merge config
  $: mergedConfig = { ...defaultConfig, ...config };

  // Stores
  const pipWindows: Writable<Map<string, PiPWindow>> = writable(new Map());
  const activeWindowId: Writable<string | null> = writable(null);
  const dragState: Writable<DragState> = writable({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const resizeState: Writable<ResizeState> = writable({
    isResizing: false,
    edge: null,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0,
  });
  const controlsVisible: Writable<boolean> = writable(true);
  const screenDimensions: Writable<{ width: number; height: number }> = writable({
    width: 1920,
    height: 1080,
  });

  // Derived stores
  const windowCount: Readable<number> = derived(pipWindows, ($windows) => $windows.size);
  const activeWindow: Readable<PiPWindow | null> = derived(
    [pipWindows, activeWindowId],
    ([$windows, $id]) => ($id ? $windows.get($id) ?? null : null)
  );

  // Timers
  let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
  let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Screen corners for snapping
  const getScreenCorners = (): ScreenCorner[] => {
    const { width, height } = $screenDimensions;
    const padding = 20;
    const windowWidth = mergedConfig.defaultWidth;
    const windowHeight = mergedConfig.defaultHeight;

    return [
      { name: 'top-left', x: padding, y: padding },
      { name: 'top-right', x: width - windowWidth - padding, y: padding },
      { name: 'bottom-left', x: padding, y: height - windowHeight - padding },
      { name: 'bottom-right', x: width - windowWidth - padding, y: height - windowHeight - padding },
    ];
  };

  // Generate unique window ID
  const generateWindowId = (): string => {
    return `pip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Create PiP window
  export async function createWindow(
    contentType: PiPWindow['contentType'],
    title: string = 'Picture in Picture',
    sourceId?: string,
    options: Partial<PiPWindow> = {}
  ): Promise<PiPWindow | null> {
    if (!enabled) {
      dispatch('error', { message: 'PiP is disabled', code: 'DISABLED' });
      return null;
    }

    try {
      const id = generateWindowId();
      const corners = getScreenCorners();
      const defaultCorner = corners[3]; // bottom-right

      const savedPosition = mergedConfig.rememberPosition
        ? await loadSavedPosition(contentType)
        : null;

      const newWindow: PiPWindow = {
        id,
        title,
        width: options.width ?? mergedConfig.defaultWidth,
        height: options.height ?? mergedConfig.defaultHeight,
        x: savedPosition?.x ?? options.x ?? defaultCorner.x,
        y: savedPosition?.y ?? options.y ?? defaultCorner.y,
        alwaysOnTop: options.alwaysOnTop ?? true,
        opacity: options.opacity ?? mergedConfig.defaultOpacity,
        contentType,
        sourceId,
        isMinimized: false,
        isVisible: true,
        aspectRatio: options.aspectRatio ?? 16 / 9,
        createdAt: new Date(),
      };

      // Create native window via Tauri
      await invoke('create_pip_window', {
        windowId: id,
        config: {
          title: newWindow.title,
          width: newWindow.width,
          height: newWindow.height,
          x: newWindow.x,
          y: newWindow.y,
          always_on_top: newWindow.alwaysOnTop,
          decorations: false,
          transparent: true,
          resizable: mergedConfig.allowResize,
          skip_taskbar: true,
        },
      });

      pipWindows.update((windows) => {
        windows.set(id, newWindow);
        return windows;
      });

      activeWindowId.set(id);

      dispatch('windowCreated', { window: newWindow });
      return newWindow;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create PiP window';
      dispatch('error', { message, code: 'CREATE_FAILED' });
      return null;
    }
  }

  // Close PiP window
  export async function closeWindow(windowId: string): Promise<void> {
    try {
      await invoke('close_pip_window', { windowId });

      pipWindows.update((windows) => {
        windows.delete(windowId);
        return windows;
      });

      if ($activeWindowId === windowId) {
        const remaining = Array.from($pipWindows.keys());
        activeWindowId.set(remaining.length > 0 ? remaining[0] : null);
      }

      dispatch('windowClosed', { windowId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close PiP window';
      dispatch('error', { message, code: 'CLOSE_FAILED' });
    }
  }

  // Close all windows
  export async function closeAllWindows(): Promise<void> {
    const windowIds = Array.from($pipWindows.keys());
    await Promise.all(windowIds.map((id) => closeWindow(id)));
  }

  // Move window
  export async function moveWindow(windowId: string, x: number, y: number): Promise<void> {
    try {
      // Apply snap to corners if enabled
      let finalX = x;
      let finalY = y;

      if (mergedConfig.snapToCorners) {
        const corners = getScreenCorners();
        const window = $pipWindows.get(windowId);

        if (window) {
          for (const corner of corners) {
            const distX = Math.abs(x - corner.x);
            const distY = Math.abs(y - corner.y);

            if (distX < mergedConfig.snapDistance && distY < mergedConfig.snapDistance) {
              finalX = corner.x;
              finalY = corner.y;
              break;
            }
          }
        }
      }

      await invoke('move_pip_window', { windowId, x: finalX, y: finalY });

      pipWindows.update((windows) => {
        const window = windows.get(windowId);
        if (window) {
          window.x = finalX;
          window.y = finalY;
        }
        return windows;
      });

      // Schedule position save
      if (mergedConfig.rememberPosition) {
        schedulePositionSave(windowId);
      }

      dispatch('windowMoved', { windowId, x: finalX, y: finalY });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move PiP window';
      dispatch('error', { message, code: 'MOVE_FAILED' });
    }
  }

  // Resize window
  export async function resizeWindow(
    windowId: string,
    width: number,
    height: number
  ): Promise<void> {
    try {
      const window = $pipWindows.get(windowId);
      if (!window) return;

      let finalWidth = Math.max(mergedConfig.minWidth, Math.min(width, mergedConfig.maxWidth));
      let finalHeight = Math.max(mergedConfig.minHeight, Math.min(height, mergedConfig.maxHeight));

      // Maintain aspect ratio if enabled
      if (mergedConfig.maintainAspectRatio && window.aspectRatio) {
        finalHeight = finalWidth / window.aspectRatio;
        if (finalHeight > mergedConfig.maxHeight) {
          finalHeight = mergedConfig.maxHeight;
          finalWidth = finalHeight * window.aspectRatio;
        }
      }

      await invoke('resize_pip_window', { windowId, width: finalWidth, height: finalHeight });

      pipWindows.update((windows) => {
        const win = windows.get(windowId);
        if (win) {
          win.width = finalWidth;
          win.height = finalHeight;
        }
        return windows;
      });

      dispatch('windowResized', { windowId, width: finalWidth, height: finalHeight });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resize PiP window';
      dispatch('error', { message, code: 'RESIZE_FAILED' });
    }
  }

  // Toggle visibility
  export async function toggleVisibility(windowId: string): Promise<void> {
    const window = $pipWindows.get(windowId);
    if (!window) return;

    try {
      const newVisibility = !window.isVisible;
      await invoke('set_pip_visibility', { windowId, visible: newVisibility });

      pipWindows.update((windows) => {
        const win = windows.get(windowId);
        if (win) {
          win.isVisible = newVisibility;
        }
        return windows;
      });

      dispatch('visibilityChanged', { windowId, visible: newVisibility });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle visibility';
      dispatch('error', { message, code: 'VISIBILITY_FAILED' });
    }
  }

  // Set opacity
  export async function setOpacity(windowId: string, opacity: number): Promise<void> {
    try {
      const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
      await invoke('set_pip_opacity', { windowId, opacity: clampedOpacity });

      pipWindows.update((windows) => {
        const window = windows.get(windowId);
        if (window) {
          window.opacity = clampedOpacity;
        }
        return windows;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set opacity';
      dispatch('error', { message, code: 'OPACITY_FAILED' });
    }
  }

  // Toggle always on top
  export async function toggleAlwaysOnTop(windowId: string): Promise<void> {
    const window = $pipWindows.get(windowId);
    if (!window) return;

    try {
      const newValue = !window.alwaysOnTop;
      await invoke('set_pip_always_on_top', { windowId, alwaysOnTop: newValue });

      pipWindows.update((windows) => {
        const win = windows.get(windowId);
        if (win) {
          win.alwaysOnTop = newValue;
        }
        return windows;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle always on top';
      dispatch('error', { message, code: 'ALWAYS_ON_TOP_FAILED' });
    }
  }

  // Load saved position
  async function loadSavedPosition(
    contentType: string
  ): Promise<{ x: number; y: number } | null> {
    try {
      const result = await invoke<{ x: number; y: number } | null>('get_pip_saved_position', {
        contentType,
      });
      return result;
    } catch {
      return null;
    }
  }

  // Schedule position save
  function schedulePositionSave(windowId: string): void {
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
    }

    positionSaveTimer = setTimeout(async () => {
      const window = $pipWindows.get(windowId);
      if (window) {
        try {
          await invoke('save_pip_position', {
            contentType: window.contentType,
            x: window.x,
            y: window.y,
          });
        } catch {
          // Silently fail position save
        }
      }
    }, 500);
  }

  // Handle drag start
  function handleDragStart(event: MouseEvent, windowId: string): void {
    const window = $pipWindows.get(windowId);
    if (!window) return;

    activeWindowId.set(windowId);
    dragState.set({
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - window.x,
      offsetY: event.clientY - window.y,
    });

    showControls();
  }

  // Handle drag
  function handleDrag(event: MouseEvent): void {
    if (!$dragState.isDragging || !$activeWindowId) return;

    const x = event.clientX - $dragState.offsetX;
    const y = event.clientY - $dragState.offsetY;
    moveWindow($activeWindowId, x, y);
  }

  // Handle drag end
  function handleDragEnd(): void {
    dragState.update((state) => ({ ...state, isDragging: false }));
    scheduleControlsHide();
  }

  // Handle resize start
  function handleResizeStart(
    event: MouseEvent,
    windowId: string,
    edge: ResizeState['edge']
  ): void {
    if (!mergedConfig.allowResize) return;

    const window = $pipWindows.get(windowId);
    if (!window) return;

    event.stopPropagation();
    activeWindowId.set(windowId);
    resizeState.set({
      isResizing: true,
      edge,
      startWidth: window.width,
      startHeight: window.height,
      startX: event.clientX,
      startY: event.clientY,
    });

    showControls();
  }

  // Handle resize
  function handleResize(event: MouseEvent): void {
    if (!$resizeState.isResizing || !$activeWindowId) return;

    const window = $pipWindows.get($activeWindowId);
    if (!window) return;

    const deltaX = event.clientX - $resizeState.startX;
    const deltaY = event.clientY - $resizeState.startY;

    let newWidth = $resizeState.startWidth;
    let newHeight = $resizeState.startHeight;

    switch ($resizeState.edge) {
      case 'e':
      case 'se':
      case 'ne':
        newWidth = $resizeState.startWidth + deltaX;
        break;
      case 'w':
      case 'sw':
      case 'nw':
        newWidth = $resizeState.startWidth - deltaX;
        break;
    }

    switch ($resizeState.edge) {
      case 's':
      case 'se':
      case 'sw':
        newHeight = $resizeState.startHeight + deltaY;
        break;
      case 'n':
      case 'ne':
      case 'nw':
        newHeight = $resizeState.startHeight - deltaY;
        break;
    }

    resizeWindow($activeWindowId, newWidth, newHeight);
  }

  // Handle resize end
  function handleResizeEnd(): void {
    resizeState.update((state) => ({ ...state, isResizing: false, edge: null }));
    scheduleControlsHide();
  }

  // Show controls
  function showControls(): void {
    controlsVisible.set(true);
    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
      controlsHideTimer = null;
    }
  }

  // Schedule controls hide
  function scheduleControlsHide(): void {
    if (!mergedConfig.autoHideControls || !mergedConfig.showControls) return;

    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
    }

    controlsHideTimer = setTimeout(() => {
      controlsVisible.set(false);
    }, mergedConfig.controlsHideDelay);
  }

  // Get screen dimensions
  async function updateScreenDimensions(): Promise<void> {
    try {
      const dimensions = await invoke<{ width: number; height: number }>('get_screen_dimensions');
      screenDimensions.set(dimensions);
    } catch {
      // Use defaults
    }
  }

  // Lifecycle
  onMount(() => {
    updateScreenDimensions();

    // Global mouse event handlers
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleResizeEnd);

    // Screen resize handler
    window.addEventListener('resize', updateScreenDimensions);

    scheduleControlsHide();
  });

  onDestroy(() => {
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', handleResizeEnd);
    window.removeEventListener('resize', updateScreenDimensions);

    if (controlsHideTimer) {
      clearTimeout(controlsHideTimer);
    }
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
    }

    // Close all windows on destroy
    closeAllWindows();
  });

  // Exported state
  export { pipWindows, activeWindowId, windowCount, activeWindow };
</script>

<div
  class="pip-manager"
  class:enabled
  role="region"
  aria-label="Picture in Picture Manager"
>
  {#if enabled}
    <!-- PiP Windows Overlay -->
    {#each Array.from($pipWindows.values()) as pipWindow (pipWindow.id)}
      {#if pipWindow.isVisible}
        <div
          class="pip-window"
          class:active={$activeWindowId === pipWindow.id}
          class:dragging={$dragState.isDragging && $activeWindowId === pipWindow.id}
          style="
            left: {pipWindow.x}px;
            top: {pipWindow.y}px;
            width: {pipWindow.width}px;
            height: {pipWindow.height}px;
            opacity: {pipWindow.opacity};
            border-radius: {mergedConfig.borderRadius}px;
            pointer-events: {mergedConfig.clickThrough ? 'none' : 'auto'};
          "
          on:mouseenter={showControls}
          on:mouseleave={scheduleControlsHide}
          role="dialog"
          aria-label={pipWindow.title}
        >
          <!-- Drag handle / Title bar -->
          <div
            class="pip-header"
            class:visible={$controlsVisible && mergedConfig.showControls}
            on:mousedown={(e) => handleDragStart(e, pipWindow.id)}
            role="toolbar"
          >
            <span class="pip-title">{pipWindow.title}</span>
            <div class="pip-controls">
              <button
                class="pip-btn"
                on:click|stopPropagation={() => toggleAlwaysOnTop(pipWindow.id)}
                title={pipWindow.alwaysOnTop ? 'Unpin' : 'Pin on top'}
                aria-label={pipWindow.alwaysOnTop ? 'Unpin window' : 'Pin window on top'}
              >
                {#if pipWindow.alwaysOnTop}
                  📌
                {:else}
                  📍
                {/if}
              </button>
              <button
                class="pip-btn"
                on:click|stopPropagation={() => toggleVisibility(pipWindow.id)}
                title="Minimize"
                aria-label="Minimize window"
              >
                ➖
              </button>
              <button
                class="pip-btn close"
                on:click|stopPropagation={() => closeWindow(pipWindow.id)}
                title="Close"
                aria-label="Close window"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Content area -->
          <div class="pip-content" data-content-type={pipWindow.contentType}>
            <slot name="content" {pipWindow}>
              <div class="pip-placeholder">
                {#if pipWindow.contentType === 'video'}
                  🎬 Video
                {:else if pipWindow.contentType === 'call'}
                  📹 Call
                {:else if pipWindow.contentType === 'media'}
                  🎵 Media
                {:else}
                  📦 Content
                {/if}
              </div>
            </slot>
          </div>

          <!-- Resize handles -->
          {#if mergedConfig.allowResize}
            <div
              class="resize-handle n"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'n')}
              role="separator"
              aria-orientation="horizontal"
            />
            <div
              class="resize-handle s"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 's')}
              role="separator"
              aria-orientation="horizontal"
            />
            <div
              class="resize-handle e"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'e')}
              role="separator"
              aria-orientation="vertical"
            />
            <div
              class="resize-handle w"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'w')}
              role="separator"
              aria-orientation="vertical"
            />
            <div
              class="resize-handle ne"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'ne')}
              role="separator"
            />
            <div
              class="resize-handle nw"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'nw')}
              role="separator"
            />
            <div
              class="resize-handle se"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'se')}
              role="separator"
            />
            <div
              class="resize-handle sw"
              on:mousedown={(e) => handleResizeStart(e, pipWindow.id, 'sw')}
              role="separator"
            />
          {/if}

          <!-- Opacity slider (visible when controls shown) -->
          {#if $controlsVisible && mergedConfig.showControls}
            <div class="pip-opacity-control">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={pipWindow.opacity}
                on:input={(e) => setOpacity(pipWindow.id, parseFloat(e.currentTarget.value))}
                title="Opacity"
                aria-label="Window opacity"
              />
            </div>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Window count indicator -->
    {#if $windowCount > 0}
      <div class="pip-count" aria-live="polite">
        {$windowCount} PiP window{$windowCount !== 1 ? 's' : ''} active
      </div>
    {/if}
  {/if}
</div>

<style>
  .pip-manager {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  }

  .pip-manager:not(.enabled) {
    display: none;
  }

  .pip-window {
    position: absolute;
    background: var(--pip-bg, #1a1a1a);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    pointer-events: auto;
    transition: box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
  }

  .pip-window.active {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3),
      0 0 0 2px var(--pip-accent, #5865f2);
  }

  .pip-window.dragging {
    cursor: grabbing;
    opacity: 0.9 !important;
  }

  .pip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%);
    cursor: grab;
    user-select: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }

  .pip-header.visible {
    opacity: 1;
  }

  .pip-header:active {
    cursor: grabbing;
  }

  .pip-title {
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }

  .pip-controls {
    display: flex;
    gap: 4px;
  }

  .pip-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
    color: #fff;
  }

  .pip-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .pip-btn.close:hover {
    background: rgba(237, 66, 69, 0.8);
  }

  .pip-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    overflow: hidden;
  }

  .pip-placeholder {
    font-size: 24px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
    padding: 20px;
  }

  .pip-opacity-control {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 4px;
    opacity: 0.8;
    transition: opacity 0.2s ease;
  }

  .pip-opacity-control:hover {
    opacity: 1;
  }

  .pip-opacity-control input {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
  }

  .pip-opacity-control input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  /* Resize handles */
  .resize-handle {
    position: absolute;
    background: transparent;
  }

  .resize-handle.n,
  .resize-handle.s {
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }

  .resize-handle.n {
    top: 0;
  }

  .resize-handle.s {
    bottom: 0;
  }

  .resize-handle.e,
  .resize-handle.w {
    top: 8px;
    bottom: 8px;
    width: 6px;
    cursor: ew-resize;
  }

  .resize-handle.e {
    right: 0;
  }

  .resize-handle.w {
    left: 0;
  }

  .resize-handle.ne,
  .resize-handle.nw,
  .resize-handle.se,
  .resize-handle.sw {
    width: 12px;
    height: 12px;
  }

  .resize-handle.ne {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }

  .resize-handle.nw {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }

  .resize-handle.se {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }

  .resize-handle.sw {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }

  .pip-count {
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    pointer-events: auto;
    backdrop-filter: blur(8px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pip-header,
    .pip-window,
    .pip-btn,
    .pip-opacity-control {
      transition: none;
    }
  }
</style>
