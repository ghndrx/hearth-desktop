<script lang="ts">
  /**
   * GlobalShortcutManager Component
   *
   * Manages system-wide global keyboard shortcuts that work even when
   * the Hearth window is not focused. Allows users to view, rebind,
   * enable/disable, and reset global shortcuts.
   */

  import { onMount, onDestroy } from 'svelte';
  import {
    globalShortcutsStore,
    globalShortcuts,
    registeredShortcuts,
    globalShortcutsLoading,
    globalShortcutsError,
    isRegistered,
    DEFAULT_GLOBAL_BINDINGS,
    type GlobalShortcutBinding,
  } from '../stores/globalShortcuts';
  import { formatKeys } from '../stores/shortcuts';

  let recordingId: string | null = null;
  let recordedKeys: string[] = [];

  $: sortedBindings = $globalShortcuts;

  function startRecording(id: string) {
    recordingId = id;
    recordedKeys = [];
  }

  function cancelRecording() {
    recordingId = null;
    recordedKeys = [];
  }

  function normalizeKey(key: string): string {
    const map: Record<string, string> = {
      Control: 'Ctrl',
      Meta: 'Cmd',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      ' ': 'Space',
    };
    return map[key] || key;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!recordingId) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      cancelRecording();
      return;
    }

    const key = normalizeKey(event.key);

    // Add modifier keys
    if (event.ctrlKey && !recordedKeys.includes('Ctrl')) {
      recordedKeys = [...recordedKeys, 'Ctrl'];
    }
    if (event.altKey && !recordedKeys.includes('Alt')) {
      recordedKeys = [...recordedKeys, 'Alt'];
    }
    if (event.shiftKey && !recordedKeys.includes('Shift')) {
      recordedKeys = [...recordedKeys, 'Shift'];
    }
    if (event.metaKey && !recordedKeys.includes('Cmd')) {
      recordedKeys = [...recordedKeys, 'Cmd'];
    }

    // Add non-modifier key and auto-confirm
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      recordedKeys = [...recordedKeys, key];
      const id = recordingId;
      const keys = [...recordedKeys];
      recordingId = null;
      recordedKeys = [];
      globalShortcutsStore.updateBinding(id, keys);
    }
  }

  async function toggleShortcut(binding: GlobalShortcutBinding) {
    const registered = isRegistered($registeredShortcuts, binding.id);
    if (registered) {
      await globalShortcutsStore.unregister(binding.id);
    } else if (binding.keys.length > 0) {
      await globalShortcutsStore.register(binding);
    }
  }

  async function resetBinding(id: string) {
    await globalShortcutsStore.resetBinding(id);
  }

  async function clearBinding(id: string) {
    await globalShortcutsStore.updateBinding(id, []);
  }

  async function resetAll() {
    await globalShortcutsStore.resetAll();
  }

  function isDefault(binding: GlobalShortcutBinding): boolean {
    const def = DEFAULT_GLOBAL_BINDINGS.find((d) => d.id === binding.id);
    if (!def) return false;
    return JSON.stringify(binding.keys) === JSON.stringify(def.keys);
  }

  onMount(async () => {
    window.addEventListener('keydown', handleKeyDown);
    await globalShortcutsStore.init();
    await globalShortcutsStore.registerAll();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="global-shortcut-manager">
  <div class="header">
    <div class="title-row">
      <div class="title-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
      <div>
        <h3>Global Shortcuts</h3>
        <p class="subtitle">
          These shortcuts work system-wide, even when Hearth is in the background.
        </p>
      </div>
    </div>

    <button class="reset-all-btn" on:click={resetAll} disabled={$globalShortcutsLoading}>
      Reset All
    </button>
  </div>

  {#if $globalShortcutsError}
    <div class="error-banner" role="alert">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <span>{$globalShortcutsError}</span>
      <button class="dismiss-btn" on:click={() => globalShortcutsStore.clearError()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/if}

  {#if recordingId}
    <div class="recording-overlay" role="dialog" aria-label="Recording shortcut">
      <div class="recording-modal">
        <h4>Press a key combination</h4>
        <div class="recorded-keys">
          {#if recordedKeys.length > 0}
            {formatKeys(recordedKeys)}
          {:else}
            <span class="hint">Waiting for keys...</span>
          {/if}
        </div>
        <p class="recording-hint">
          Press <kbd>Escape</kbd> to cancel
        </p>
        <button class="cancel-btn" on:click={cancelRecording}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="shortcuts-list">
    {#each sortedBindings as binding (binding.id)}
      {@const active = isRegistered($registeredShortcuts, binding.id)}
      <div class="shortcut-row" class:inactive={!active}>
        <div class="shortcut-info">
          <div class="shortcut-label">
            {binding.label}
            {#if active}
              <span class="status-dot active" title="Active"></span>
            {:else}
              <span class="status-dot" title="Inactive"></span>
            {/if}
          </div>
          <div class="shortcut-desc">{binding.description}</div>
        </div>

        <div class="shortcut-controls">
          <button
            class="keybind-btn"
            class:recording={recordingId === binding.id}
            class:empty={binding.keys.length === 0}
            on:click={() => startRecording(binding.id)}
            title="Click to rebind"
          >
            {binding.keys.length > 0 ? formatKeys(binding.keys) : 'Not set'}
          </button>

          <button
            class="icon-btn"
            on:click={() => resetBinding(binding.id)}
            title="Reset to default"
            disabled={isDefault(binding)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            class="icon-btn"
            on:click={() => clearBinding(binding.id)}
            title="Clear shortcut"
            disabled={binding.keys.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <button
            class="toggle-btn"
            class:active
            on:click={() => toggleShortcut(binding)}
            title={active ? 'Disable' : 'Enable'}
            disabled={binding.keys.length === 0}
          >
            <div class="toggle-track">
              <div class="toggle-thumb"></div>
            </div>
          </button>
        </div>
      </div>
    {/each}
  </div>

  {#if $globalShortcutsLoading}
    <div class="loading-bar">
      <div class="loading-progress"></div>
    </div>
  {/if}
</div>

<style>
  .global-shortcut-manager {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .title-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .title-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: var(--brand-primary, #5865f2);
    margin-top: 2px;
  }

  .title-icon svg {
    width: 100%;
    height: 100%;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.75rem;
    color: var(--text-muted, #949ba4);
  }

  .reset-all-btn {
    flex-shrink: 0;
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-secondary, #b5bac1);
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-all-btn:hover:not(:disabled) {
    background: var(--bg-primary, #313338);
    color: var(--text-primary, #fff);
  }

  .reset-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(237, 66, 69, 0.1);
    border: 1px solid var(--status-danger, #ed4245);
    border-radius: 4px;
    color: var(--status-danger, #ed4245);
    font-size: 0.75rem;
  }

  .error-banner svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .error-banner span {
    flex: 1;
  }

  .dismiss-btn {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .dismiss-btn svg {
    width: 14px;
    height: 14px;
  }

  .recording-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .recording-modal {
    background: var(--bg-primary, #313338);
    padding: 1.5rem 2rem;
    border-radius: 8px;
    text-align: center;
    min-width: 280px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .recording-modal h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #fff);
    font-size: 1rem;
  }

  .recorded-keys {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
    padding: 0.75rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 4px;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recorded-keys .hint {
    color: var(--text-muted, #949ba4);
    font-size: 0.875rem;
    font-weight: normal;
  }

  .recording-hint {
    margin: 0.75rem 0;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.75rem;
  }

  .recording-hint kbd {
    background: var(--bg-tertiary, #1e1f22);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.7rem;
  }

  .cancel-btn {
    padding: 0.375rem 1rem;
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #fff);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    gap: 1rem;
    border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-row.inactive {
    opacity: 0.55;
  }

  .shortcut-info {
    flex: 1;
    min-width: 0;
  }

  .shortcut-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary, #fff);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #949ba4);
    flex-shrink: 0;
  }

  .status-dot.active {
    background: var(--status-positive, #3ba55d);
  }

  .shortcut-desc {
    color: var(--text-muted, #949ba4);
    font-size: 0.7rem;
    margin-top: 0.125rem;
  }

  .shortcut-controls {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .keybind-btn {
    padding: 0.3rem 0.6rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 0.7rem;
    font-weight: 500;
    font-family: monospace;
    cursor: pointer;
    min-width: 70px;
    text-align: center;
    transition: border-color 0.15s;
  }

  .keybind-btn:hover {
    border-color: var(--brand-primary, #5865f2);
  }

  .keybind-btn.recording {
    border-color: var(--status-positive, #3ba55d);
    animation: pulse 1s infinite;
  }

  .keybind-btn.empty {
    color: var(--text-muted, #949ba4);
    font-style: italic;
    font-family: inherit;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .icon-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #949ba4);
    transition: all 0.15s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #fff);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn svg {
    width: 14px;
    height: 14px;
  }

  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
  }

  .toggle-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .toggle-track {
    width: 32px;
    height: 18px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 9px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-btn.active .toggle-track {
    background: var(--status-positive, #3ba55d);
  }

  .toggle-thumb {
    position: absolute;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }

  .toggle-btn.active .toggle-thumb {
    transform: translateX(14px);
  }

  .loading-bar {
    height: 2px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 1px;
    overflow: hidden;
  }

  .loading-progress {
    height: 100%;
    width: 40%;
    background: var(--brand-primary, #5865f2);
    border-radius: 1px;
    animation: loading 1.2s ease-in-out infinite;
  }

  @keyframes loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
</style>
