<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow, type Window } from '@tauri-apps/api/window';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    stateChange: { state: WindowState };
    error: { message: string };
  }>();

  interface WindowState {
    isMaximized: boolean;
    isMinimized: boolean;
    isFullscreen: boolean;
    isAlwaysOnTop: boolean;
    isDecorated: boolean;
    isFocused: boolean;
    isVisible: boolean;
    opacity: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
    scaleFactor: number;
  }

  interface WindowPreset {
    id: string;
    name: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    alwaysOnTop: boolean;
    opacity: number;
  }

  let appWindow: Window | null = null;
  let windowState: WindowState = {
    isMaximized: false,
    isMinimized: false,
    isFullscreen: false,
    isAlwaysOnTop: false,
    isDecorated: true,
    isFocused: true,
    isVisible: true,
    opacity: 1.0,
    position: { x: 0, y: 0 },
    size: { width: 1200, height: 800 },
    scaleFactor: 1.0
  };

  let savedPresets: WindowPreset[] = [];
  let presetName = '';
  let showPresetDialog = false;
  let opacitySlider = 100;
  let isCompactMode = false;
  let isPictureInPicture = false;

  const STORAGE_KEY = 'hearth_window_presets';
  const PIP_SIZE = { width: 400, height: 300 };
  const COMPACT_SIZE = { width: 360, height: 640 };

  onMount(async () => {
    appWindow = getCurrentWindow();
    await loadPresets();
    await refreshWindowState();

    // Set up window state listeners
    if (appWindow) {
      appWindow.onResized(async () => await refreshWindowState());
      appWindow.onMoved(async () => await refreshWindowState());
      appWindow.onFocusChanged(({ payload: focused }) => {
        windowState.isFocused = focused;
        dispatch('stateChange', { state: windowState });
      });
    }
  });

  onDestroy(() => {
    // Cleanup listeners if needed
  });

  async function refreshWindowState(): Promise<void> {
    if (!appWindow) return;

    try {
      const [
        isMaximized,
        isMinimized,
        isFullscreen,
        isDecorated,
        isVisible,
        position,
        size,
        scaleFactor
      ] = await Promise.all([
        appWindow.isMaximized(),
        appWindow.isMinimized(),
        appWindow.isFullscreen(),
        appWindow.isDecorated(),
        appWindow.isVisible(),
        appWindow.outerPosition(),
        appWindow.outerSize(),
        appWindow.scaleFactor()
      ]);

      // Get always-on-top state via Tauri command
      let isAlwaysOnTop = false;
      try {
        isAlwaysOnTop = await invoke<boolean>('get_always_on_top');
      } catch {
        // Command may not be implemented yet
      }

      windowState = {
        isMaximized,
        isMinimized,
        isFullscreen,
        isAlwaysOnTop,
        isDecorated,
        isFocused: windowState.isFocused,
        isVisible,
        opacity: opacitySlider / 100,
        position: { x: position.x, y: position.y },
        size: { width: size.width, height: size.height },
        scaleFactor
      };

      dispatch('stateChange', { state: windowState });
    } catch (error) {
      console.error('Failed to refresh window state:', error);
      dispatch('error', { message: 'Failed to get window state' });
    }
  }

  async function loadPresets(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        savedPresets = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load window presets:', error);
    }
  }

  function savePresets(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPresets));
    } catch (error) {
      console.error('Failed to save window presets:', error);
    }
  }

  async function minimize(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.minimize();
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to minimize window' });
    }
  }

  async function maximize(): Promise<void> {
    if (!appWindow) return;
    try {
      if (windowState.isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle maximize' });
    }
  }

  async function toggleFullscreen(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.setFullscreen(!windowState.isFullscreen);
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle fullscreen' });
    }
  }

  async function toggleAlwaysOnTop(): Promise<void> {
    if (!appWindow) return;
    try {
      const newState = !windowState.isAlwaysOnTop;
      await appWindow.setAlwaysOnTop(newState);
      windowState.isAlwaysOnTop = newState;
      dispatch('stateChange', { state: windowState });
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle always on top' });
    }
  }

  async function toggleDecorations(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.setDecorations(!windowState.isDecorated);
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle decorations' });
    }
  }

  async function setOpacity(value: number): Promise<void> {
    if (!appWindow) return;
    try {
      const opacity = Math.max(0.1, Math.min(1.0, value / 100));
      // Note: setOpacity may not be available on all platforms
      // await appWindow.setOpacity(opacity);
      opacitySlider = value;
      windowState.opacity = opacity;
      dispatch('stateChange', { state: windowState });
    } catch (error) {
      dispatch('error', { message: 'Failed to set opacity' });
    }
  }

  async function centerWindow(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.center();
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to center window' });
    }
  }

  async function setPosition(x: number, y: number): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.setPosition({ type: 'Physical', x, y });
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to set position' });
    }
  }

  async function setSize(width: number, height: number): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.setSize({ type: 'Physical', width, height });
      await refreshWindowState();
    } catch (error) {
      dispatch('error', { message: 'Failed to set size' });
    }
  }

  async function toggleCompactMode(): Promise<void> {
    if (!appWindow) return;
    try {
      if (isCompactMode) {
        // Restore previous size
        await appWindow.unmaximize();
        isCompactMode = false;
      } else {
        await setSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
        await centerWindow();
        isCompactMode = true;
      }
      isPictureInPicture = false;
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle compact mode' });
    }
  }

  async function togglePictureInPicture(): Promise<void> {
    if (!appWindow) return;
    try {
      if (isPictureInPicture) {
        // Restore previous state
        await appWindow.setAlwaysOnTop(false);
        isPictureInPicture = false;
      } else {
        await setSize(PIP_SIZE.width, PIP_SIZE.height);
        await appWindow.setAlwaysOnTop(true);
        // Position in bottom-right corner
        const monitors = await invoke<Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>>('get_monitors');
        if (monitors.length > 0) {
          const primary = monitors[0];
          const x = primary.position.x + primary.size.width - PIP_SIZE.width - 20;
          const y = primary.position.y + primary.size.height - PIP_SIZE.height - 60;
          await setPosition(x, y);
        }
        isPictureInPicture = true;
        windowState.isAlwaysOnTop = true;
      }
      isCompactMode = false;
      dispatch('stateChange', { state: windowState });
    } catch (error) {
      dispatch('error', { message: 'Failed to toggle picture-in-picture' });
    }
  }

  async function saveCurrentAsPreset(): Promise<void> {
    if (!presetName.trim()) return;

    const preset: WindowPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      position: windowState.position,
      size: windowState.size,
      alwaysOnTop: windowState.isAlwaysOnTop,
      opacity: windowState.opacity
    };

    savedPresets = [...savedPresets, preset];
    savePresets();
    presetName = '';
    showPresetDialog = false;
  }

  async function applyPreset(preset: WindowPreset): Promise<void> {
    if (!appWindow) return;
    try {
      await setPosition(preset.position.x, preset.position.y);
      await setSize(preset.size.width, preset.size.height);
      if (preset.alwaysOnTop !== windowState.isAlwaysOnTop) {
        await toggleAlwaysOnTop();
      }
      await setOpacity(preset.opacity * 100);
    } catch (error) {
      dispatch('error', { message: 'Failed to apply preset' });
    }
  }

  function deletePreset(presetId: string): void {
    savedPresets = savedPresets.filter(p => p.id !== presetId);
    savePresets();
  }

  async function minimizeToTray(): Promise<void> {
    try {
      await invoke('minimize_to_tray');
    } catch (error) {
      // Fallback to regular minimize
      await minimize();
    }
  }

  async function requestAttention(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.requestUserAttention(2); // Critical attention
      setTimeout(async () => {
        await appWindow?.requestUserAttention(null);
      }, 3000);
    } catch (error) {
      dispatch('error', { message: 'Failed to request attention' });
    }
  }
</script>

<div class="window-manager">
  <div class="section">
    <h3>Window Controls</h3>
    <div class="controls-grid">
      <button 
        class="control-btn" 
        on:click={minimize}
        title="Minimize"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Minimize</span>
      </button>

      <button 
        class="control-btn" 
        on:click={maximize}
        title={windowState.isMaximized ? 'Restore' : 'Maximize'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if windowState.isMaximized}
            <rect x="5" y="5" width="14" height="14" rx="1"></rect>
          {:else}
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          {/if}
        </svg>
        <span>{windowState.isMaximized ? 'Restore' : 'Maximize'}</span>
      </button>

      <button 
        class="control-btn" 
        class:active={windowState.isFullscreen}
        on:click={toggleFullscreen}
        title="Fullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if windowState.isFullscreen}
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          {:else}
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          {/if}
        </svg>
        <span>Fullscreen</span>
      </button>

      <button 
        class="control-btn" 
        on:click={minimizeToTray}
        title="Minimize to Tray"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="14" width="18" height="7" rx="2"></rect>
          <polyline points="12 3 12 10"></polyline>
          <polyline points="8 6 12 10 16 6"></polyline>
        </svg>
        <span>To Tray</span>
      </button>
    </div>
  </div>

  <div class="section">
    <h3>Window Modes</h3>
    <div class="controls-grid">
      <button 
        class="control-btn" 
        class:active={windowState.isAlwaysOnTop}
        on:click={toggleAlwaysOnTop}
        title="Always on Top"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L12 6"></path>
          <path d="M12 18L12 22"></path>
          <circle cx="12" cy="12" r="6"></circle>
        </svg>
        <span>Pin</span>
      </button>

      <button 
        class="control-btn" 
        class:active={isCompactMode}
        on:click={toggleCompactMode}
        title="Compact Mode"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="3" width="12" height="18" rx="2"></rect>
        </svg>
        <span>Compact</span>
      </button>

      <button 
        class="control-btn" 
        class:active={isPictureInPicture}
        on:click={togglePictureInPicture}
        title="Picture in Picture"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="14" rx="2"></rect>
          <rect x="12" y="10" width="8" height="6" rx="1" fill="currentColor"></rect>
        </svg>
        <span>PiP</span>
      </button>

      <button 
        class="control-btn"
        on:click={centerWindow}
        title="Center Window"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
        </svg>
        <span>Center</span>
      </button>
    </div>
  </div>

  <div class="section">
    <h3>Window Info</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Size</span>
        <span class="value">{windowState.size.width} × {windowState.size.height}</span>
      </div>
      <div class="info-item">
        <span class="label">Position</span>
        <span class="value">{windowState.position.x}, {windowState.position.y}</span>
      </div>
      <div class="info-item">
        <span class="label">Scale</span>
        <span class="value">{windowState.scaleFactor.toFixed(2)}x</span>
      </div>
      <div class="info-item">
        <span class="label">Focus</span>
        <span class="value" class:active={windowState.isFocused}>
          {windowState.isFocused ? 'Yes' : 'No'}
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>Presets</h3>
    <div class="presets-list">
      {#each savedPresets as preset (preset.id)}
        <div class="preset-item">
          <button class="preset-btn" on:click={() => applyPreset(preset)}>
            <span class="preset-name">{preset.name}</span>
            <span class="preset-details">
              {preset.size.width}×{preset.size.height}
            </span>
          </button>
          <button 
            class="delete-btn" 
            on:click={() => deletePreset(preset.id)}
            title="Delete preset"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {:else}
        <p class="no-presets">No saved presets</p>
      {/each}
    </div>
    <button class="add-preset-btn" on:click={() => showPresetDialog = true}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Save Current Layout
    </button>
  </div>

  {#if showPresetDialog}
    <div class="preset-dialog-overlay" on:click={() => showPresetDialog = false}>
      <div class="preset-dialog" on:click|stopPropagation>
        <h4>Save Window Preset</h4>
        <input
          type="text"
          bind:value={presetName}
          placeholder="Preset name..."
          on:keydown={(e) => e.key === 'Enter' && saveCurrentAsPreset()}
        />
        <div class="dialog-buttons">
          <button class="cancel-btn" on:click={() => showPresetDialog = false}>
            Cancel
          </button>
          <button 
            class="save-btn" 
            on:click={saveCurrentAsPreset}
            disabled={!presetName.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .window-manager {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 8px;
    color: var(--text-primary, #ffffff);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .control-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-primary, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: var(--bg-hover, #333);
    border-color: var(--accent-color, #5865f2);
  }

  .control-btn.active {
    background: var(--accent-color, #5865f2);
    color: white;
  }

  .control-btn span {
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 4px;
    font-size: 0.8125rem;
  }

  .info-item .label {
    color: var(--text-secondary, #888);
  }

  .info-item .value {
    font-family: monospace;
  }

  .info-item .value.active {
    color: var(--success-color, #3ba55c);
  }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .preset-item {
    display: flex;
    gap: 0.5rem;
  }

  .preset-btn {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-primary, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .preset-btn:hover {
    border-color: var(--accent-color, #5865f2);
  }

  .preset-name {
    font-weight: 500;
  }

  .preset-details {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    font-family: monospace;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--error-color, #ed4245);
    border-radius: 4px;
    color: var(--error-color, #ed4245);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .delete-btn:hover {
    opacity: 1;
  }

  .no-presets {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary, #888);
    font-size: 0.875rem;
  }

  .add-preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-preset-btn:hover {
    background: var(--accent-hover, #4752c4);
  }

  .preset-dialog-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
  }

  .preset-dialog {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 8px;
    min-width: 300px;
  }

  .preset-dialog h4 {
    margin: 0;
    font-size: 1rem;
  }

  .preset-dialog input {
    padding: 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    color: var(--text-primary, #ffffff);
    font-size: 0.9375rem;
  }

  .preset-dialog input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .cancel-btn,
  .save-btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid var(--border-color, #444);
    color: var(--text-primary, #ffffff);
  }

  .cancel-btn:hover {
    background: var(--bg-hover, #333);
  }

  .save-btn {
    background: var(--accent-color, #5865f2);
    border: none;
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
