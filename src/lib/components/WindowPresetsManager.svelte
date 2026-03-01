<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher<{
    presetApplied: { name: string };
    presetSaved: { name: string };
    presetDeleted: { name: string };
    error: { message: string };
  }>();

  export let maxPresets = 10;
  export let animationDuration = 200;

  interface WindowPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isFullscreen: boolean;
  }

  interface WindowPreset {
    id: string;
    name: string;
    position: WindowPosition;
    createdAt: number;
    lastUsed: number;
    icon: string;
  }

  let presets: WindowPreset[] = [];
  let isLoading = true;
  let isSaving = false;
  let isApplying = false;
  let newPresetName = '';
  let showSaveDialog = false;
  let editingPresetId: string | null = null;
  let editingName = '';
  let selectedIcon = '🪟';

  const iconOptions = ['🪟', '💼', '🎮', '📝', '🎨', '📊', '🎬', '💻', '📚', '⚡'];

  const STORAGE_KEY = 'hearth-window-presets';

  async function loadPresets(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        presets = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
      presets = [];
    } finally {
      isLoading = false;
    }
  }

  function savePresetsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error('Failed to save presets:', error);
    }
  }

  async function getCurrentPosition(): Promise<WindowPosition> {
    const window = getCurrentWindow();
    const position = await window.outerPosition();
    const size = await window.outerSize();
    const isMaximized = await window.isMaximized();
    const isFullscreen = await window.isFullscreen();

    return {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      isMaximized,
      isFullscreen,
    };
  }

  async function saveCurrentAsPreset(): Promise<void> {
    if (!newPresetName.trim() || presets.length >= maxPresets) return;

    isSaving = true;
    try {
      const position = await getCurrentPosition();
      const newPreset: WindowPreset = {
        id: crypto.randomUUID(),
        name: newPresetName.trim(),
        position,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: selectedIcon,
      };

      presets = [...presets, newPreset];
      savePresetsToStorage();
      dispatch('presetSaved', { name: newPreset.name });

      // Reset form
      newPresetName = '';
      selectedIcon = '🪟';
      showSaveDialog = false;
    } catch (error) {
      console.error('Failed to save preset:', error);
      dispatch('error', { message: 'Failed to save window preset' });
    } finally {
      isSaving = false;
    }
  }

  async function applyPreset(preset: WindowPreset): Promise<void> {
    if (isApplying) return;

    isApplying = true;
    try {
      const window = getCurrentWindow();
      const { position } = preset;

      // Handle fullscreen/maximized states first
      const currentFullscreen = await window.isFullscreen();
      const currentMaximized = await window.isMaximized();

      if (currentFullscreen && !position.isFullscreen) {
        await window.setFullscreen(false);
      }
      if (currentMaximized && !position.isMaximized) {
        await window.unmaximize();
      }

      if (position.isFullscreen) {
        await window.setFullscreen(true);
      } else if (position.isMaximized) {
        await window.maximize();
      } else {
        await window.setPosition(new LogicalPosition(position.x, position.y));
        await window.setSize(new LogicalSize(position.width, position.height));
      }

      // Update last used timestamp
      presets = presets.map(p =>
        p.id === preset.id ? { ...p, lastUsed: Date.now() } : p
      );
      savePresetsToStorage();

      dispatch('presetApplied', { name: preset.name });
    } catch (error) {
      console.error('Failed to apply preset:', error);
      dispatch('error', { message: 'Failed to apply window preset' });
    } finally {
      setTimeout(() => {
        isApplying = false;
      }, animationDuration);
    }
  }

  function deletePreset(id: string): void {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;

    presets = presets.filter(p => p.id !== id);
    savePresetsToStorage();
    dispatch('presetDeleted', { name: preset.name });
  }

  function startEditing(preset: WindowPreset): void {
    editingPresetId = preset.id;
    editingName = preset.name;
  }

  function saveEdit(): void {
    if (!editingPresetId || !editingName.trim()) return;

    presets = presets.map(p =>
      p.id === editingPresetId ? { ...p, name: editingName.trim() } : p
    );
    savePresetsToStorage();
    editingPresetId = null;
    editingName = '';
  }

  function cancelEdit(): void {
    editingPresetId = null;
    editingName = '';
  }

  async function updatePreset(preset: WindowPreset): Promise<void> {
    try {
      const position = await getCurrentPosition();
      presets = presets.map(p =>
        p.id === preset.id ? { ...p, position, lastUsed: Date.now() } : p
      );
      savePresetsToStorage();
    } catch (error) {
      console.error('Failed to update preset:', error);
      dispatch('error', { message: 'Failed to update preset position' });
    }
  }

  function formatSize(pos: WindowPosition): string {
    return `${pos.width}×${pos.height}`;
  }

  function formatPosition(pos: WindowPosition): string {
    if (pos.isFullscreen) return 'Fullscreen';
    if (pos.isMaximized) return 'Maximized';
    return `${pos.x}, ${pos.y}`;
  }

  function getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Ctrl/Cmd + Shift + 1-9 to apply presets
    if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
      const num = parseInt(event.key);
      if (num >= 1 && num <= 9 && num <= presets.length) {
        event.preventDefault();
        applyPreset(presets[num - 1]);
      }
    }
  }

  onMount(() => {
    loadPresets();
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="window-presets-manager">
  <div class="presets-header">
    <h3>Window Presets</h3>
    <span class="hint">Save and restore custom window layouts</span>
  </div>

  {#if isLoading}
    <div class="loading">Loading presets...</div>
  {:else}
    <div class="presets-list">
      {#if presets.length === 0}
        <div class="empty-state">
          <span class="empty-icon">🪟</span>
          <p>No presets saved yet</p>
          <p class="empty-hint">Save your current window position as a preset</p>
        </div>
      {:else}
        {#each presets as preset, index (preset.id)}
          <div
            class="preset-item"
            class:applying={isApplying}
          >
            {#if editingPresetId === preset.id}
              <div class="edit-form">
                <input
                  type="text"
                  bind:value={editingName}
                  on:keydown={(e) => e.key === 'Enter' && saveEdit()}
                  on:keydown={(e) => e.key === 'Escape' && cancelEdit()}
                  class="edit-input"
                  autofocus
                />
                <button class="btn-icon save" on:click={saveEdit} title="Save">✓</button>
                <button class="btn-icon cancel" on:click={cancelEdit} title="Cancel">✕</button>
              </div>
            {:else}
              <button
                class="preset-main"
                on:click={() => applyPreset(preset)}
                disabled={isApplying}
                title="Click to apply • Ctrl/Cmd+Shift+{index + 1}"
              >
                <span class="preset-icon">{preset.icon}</span>
                <div class="preset-info">
                  <span class="preset-name">{preset.name}</span>
                  <span class="preset-details">
                    {formatPosition(preset.position)} • {formatSize(preset.position)}
                  </span>
                </div>
                <span class="preset-shortcut">{index + 1}</span>
              </button>

              <div class="preset-actions">
                <button
                  class="btn-icon"
                  on:click={() => updatePreset(preset)}
                  title="Update to current position"
                >
                  🔄
                </button>
                <button
                  class="btn-icon"
                  on:click={() => startEditing(preset)}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  class="btn-icon delete"
                  on:click={() => deletePreset(preset.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    {#if !showSaveDialog && presets.length < maxPresets}
      <button class="add-preset-btn" on:click={() => (showSaveDialog = true)}>
        <span>+</span> Save Current Position
      </button>
    {/if}

    {#if showSaveDialog}
      <div class="save-dialog">
        <div class="dialog-header">
          <h4>Save Window Preset</h4>
          <button class="btn-icon" on:click={() => (showSaveDialog = false)}>✕</button>
        </div>

        <div class="icon-picker">
          {#each iconOptions as icon}
            <button
              class="icon-option"
              class:selected={selectedIcon === icon}
              on:click={() => (selectedIcon = icon)}
            >
              {icon}
            </button>
          {/each}
        </div>

        <input
          type="text"
          bind:value={newPresetName}
          placeholder="Preset name (e.g., Coding Layout)"
          class="preset-name-input"
          on:keydown={(e) => e.key === 'Enter' && saveCurrentAsPreset()}
          maxlength="30"
          autofocus
        />

        <div class="dialog-actions">
          <button
            class="btn secondary"
            on:click={() => (showSaveDialog = false)}
          >
            Cancel
          </button>
          <button
            class="btn primary"
            on:click={saveCurrentAsPreset}
            disabled={!newPresetName.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </div>
    {/if}

    {#if presets.length >= maxPresets}
      <p class="limit-notice">Maximum of {maxPresets} presets reached</p>
    {/if}
  {/if}
</div>

<style>
  .window-presets-manager {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    max-width: 400px;
  }

  .presets-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .presets-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted, #72767d);
  }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-muted, #72767d);
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
  }

  .empty-hint {
    font-size: 0.8rem;
    margin-top: 0.25rem !important;
  }

  .preset-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
    overflow: hidden;
  }

  .preset-item.applying {
    opacity: 0.7;
    pointer-events: none;
  }

  .preset-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .preset-main:hover:not(:disabled) {
    background: var(--bg-modifier-hover, #36393f);
  }

  .preset-main:disabled {
    cursor: not-allowed;
  }

  .preset-icon {
    font-size: 1.25rem;
  }

  .preset-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .preset-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preset-details {
    font-size: 0.7rem;
    color: var(--text-muted, #72767d);
  }

  .preset-shortcut {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted, #72767d);
    background: var(--bg-secondary, #2f3136);
    border-radius: 4px;
  }

  .preset-actions {
    display: flex;
    gap: 0.25rem;
    padding-right: 0.5rem;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 0.85rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.15s ease;
  }

  .btn-icon:hover {
    background: var(--bg-modifier-hover, #36393f);
    opacity: 1;
  }

  .btn-icon.delete:hover {
    background: var(--status-danger, #ed4245);
  }

  .btn-icon.save {
    color: var(--status-positive, #3ba55d);
  }

  .btn-icon.cancel {
    color: var(--status-danger, #ed4245);
  }

  .edit-form {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .edit-input {
    flex: 1;
    padding: 0.5rem;
    background: var(--bg-primary, #36393f);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 0.9rem;
  }

  .edit-input:focus {
    outline: none;
    border-color: var(--brand-primary, #5865f2);
  }

  .add-preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: 2px dashed var(--bg-modifier-accent, #4f545c);
    border-radius: 6px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s ease;
  }

  .add-preset-btn:hover {
    border-color: var(--brand-primary, #5865f2);
    color: var(--brand-primary, #5865f2);
    background: var(--brand-primary-alpha, rgba(88, 101, 242, 0.1));
  }

  .add-preset-btn span {
    font-size: 1.25rem;
    font-weight: 300;
  }

  .save-dialog {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    border: 1px solid var(--bg-modifier-accent, #4f545c);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dialog-header h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .icon-option {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: 1.25rem;
    background: var(--bg-secondary, #2f3136);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-option:hover {
    background: var(--bg-modifier-hover, #36393f);
  }

  .icon-option.selected {
    border-color: var(--brand-primary, #5865f2);
    background: var(--brand-primary-alpha, rgba(88, 101, 242, 0.15));
  }

  .preset-name-input {
    padding: 0.75rem;
    background: var(--bg-primary, #36393f);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 0.9rem;
  }

  .preset-name-input:focus {
    outline: none;
    border-color: var(--brand-primary, #5865f2);
  }

  .preset-name-input::placeholder {
    color: var(--text-muted, #72767d);
  }

  .dialog-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.secondary {
    background: var(--bg-secondary, #2f3136);
    color: var(--text-primary, #fff);
  }

  .btn.secondary:hover {
    background: var(--bg-modifier-hover, #36393f);
  }

  .btn.primary {
    background: var(--brand-primary, #5865f2);
    color: #fff;
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--brand-primary-hover, #4752c4);
  }

  .btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .limit-notice {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
    text-align: center;
  }
</style>
