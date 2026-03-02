<!--
  DNDSyncManager.svelte

  Synchronizes the OS Do-Not-Disturb / Focus mode state with Hearth's
  internal notification system. When the OS activates DND, Hearth
  automatically suppresses notifications; when deactivated, restores them.

  Features:
  - Real-time OS DND state detection
  - Automatic sync toggle
  - Visual indicator of current OS DND state
  - Platform-aware (macOS Focus Modes, GNOME/KDE DND, Windows Focus Assist)
  - Event-driven updates via Tauri events
  - Manual sync override
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived } from 'svelte/store';

  export let autoSyncEnabled: boolean = true;
  export let compact: boolean = false;

  interface OsDndStatus {
    active: boolean;
    mode_name: string | null;
    sync_enabled: boolean;
    platform: string;
    supported: boolean;
  }

  const osDndStatus = writable<OsDndStatus | null>(null);
  const hearthDndActive = writable(false);
  const syncEnabled = writable(autoSyncEnabled);
  const isLoading = writable(true);
  const error = writable<string | null>(null);
  const lastSyncEvent = writable<string | null>(null);

  const syncState = derived(
    [osDndStatus, hearthDndActive, syncEnabled],
    ([$os, $hearth, $sync]) => {
      if (!$os) return 'unknown';
      if (!$os.supported) return 'unsupported';
      if (!$sync) return 'disabled';
      if ($os.active && $hearth) return 'synced-active';
      if (!$os.active && !$hearth) return 'synced-inactive';
      return 'out-of-sync';
    }
  );

  const statusLabel = derived(
    [osDndStatus, syncState],
    ([$os, $state]) => {
      if ($state === 'unsupported') return 'Not supported on this platform';
      if ($state === 'disabled') return 'Auto-sync disabled';
      if (!$os) return 'Loading...';
      if ($os.active) return $os.mode_name ?? 'Do Not Disturb';
      return 'Notifications active';
    }
  );

  function getPlatformLabel(platform: string): string {
    switch (platform) {
      case 'macos': return 'macOS Focus';
      case 'windows': return 'Focus Assist';
      case 'linux': return 'Desktop DND';
      default: return 'System DND';
    }
  }

  async function fetchStatus(): Promise<void> {
    try {
      const [osStatus, hearthDnd] = await Promise.all([
        invoke<OsDndStatus>('dndsync_get_os_status'),
        invoke<boolean>('is_dnd_active'),
      ]);

      osDndStatus.set(osStatus);
      hearthDndActive.set(hearthDnd);
      error.set(null);
      isLoading.set(false);

      // Auto-sync if enabled
      if ($syncEnabled && osStatus.supported) {
        if (osStatus.active && !hearthDnd) {
          await invoke('set_dnd', { enabled: true });
          hearthDndActive.set(true);
          lastSyncEvent.set('Synced: DND activated');
        } else if (!osStatus.active && hearthDnd) {
          await invoke('set_dnd', { enabled: false });
          hearthDndActive.set(false);
          lastSyncEvent.set('Synced: DND deactivated');
        }
      }
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Failed to check DND status');
      isLoading.set(false);
    }
  }

  async function toggleSync(): Promise<void> {
    syncEnabled.update((v) => !v);
    const enabled = $syncEnabled;

    try {
      if (enabled) {
        await invoke('dndsync_start_sync', { intervalSecs: 3 });
      } else {
        await invoke('dndsync_stop_sync');
      }
    } catch {
      // Sync control may fail
    }
  }

  async function manualSyncFromOs(): Promise<void> {
    const osStatus = $osDndStatus;
    if (!osStatus) return;

    try {
      await invoke('set_dnd', { enabled: osStatus.active });
      hearthDndActive.set(osStatus.active);
      lastSyncEvent.set(osStatus.active ? 'Manually synced: DND on' : 'Manually synced: DND off');
      setTimeout(() => lastSyncEvent.set(null), 3000);
    } catch {
      // Sync may fail
    }
  }

  let unlisteners: UnlistenFn[] = [];

  onMount(async () => {
    fetchStatus();

    // Start native DND sync monitor
    if (autoSyncEnabled) {
      try {
        await invoke('dndsync_start_sync', { intervalSecs: 3 });
      } catch {
        // May not be supported
      }
    }

    // Listen for DND state changes
    const unlisten1 = await listen<OsDndStatus>('dndsync:os-dnd-activated', (event) => {
      osDndStatus.set(event.payload);
      lastSyncEvent.set(`${event.payload.mode_name ?? 'DND'} activated`);

      if ($syncEnabled) {
        invoke('set_dnd', { enabled: true }).then(() => hearthDndActive.set(true));
      }

      setTimeout(() => lastSyncEvent.set(null), 4000);
    });

    const unlisten2 = await listen<OsDndStatus>('dndsync:os-dnd-deactivated', (event) => {
      osDndStatus.set(event.payload);
      lastSyncEvent.set('DND deactivated');

      if ($syncEnabled) {
        invoke('set_dnd', { enabled: false }).then(() => hearthDndActive.set(false));
      }

      setTimeout(() => lastSyncEvent.set(null), 4000);
    });

    unlisteners = [unlisten1, unlisten2];

    // Periodic refresh
    const interval = setInterval(fetchStatus, 10000);
    unlisteners.push(() => clearInterval(interval));
  });

  onDestroy(() => {
    unlisteners.forEach((fn) => fn());
    invoke('dndsync_stop_sync').catch(() => {});
  });
</script>

<div
  class="dnd-sync-manager"
  class:compact
  role="region"
  aria-label="Do Not Disturb Sync"
>
  <div class="dnd-header">
    <div class="dnd-indicator" class:active={$osDndStatus?.active}>
      <span class="dnd-icon">
        {#if $osDndStatus?.active}🔕{:else}🔔{/if}
      </span>
    </div>
    <div class="dnd-info">
      <span class="dnd-title">
        {#if $osDndStatus}
          {getPlatformLabel($osDndStatus.platform)}
        {:else}
          System DND
        {/if}
      </span>
      <span class="dnd-status">{$statusLabel}</span>
    </div>
    <div class="dnd-controls">
      <button
        class="sync-toggle"
        class:active={$syncEnabled}
        on:click={toggleSync}
        title={$syncEnabled ? 'Disable auto-sync' : 'Enable auto-sync'}
        aria-label={$syncEnabled ? 'Disable auto-sync' : 'Enable auto-sync'}
      >
        <span class="sync-icon">🔄</span>
        <span class="sync-label">{$syncEnabled ? 'On' : 'Off'}</span>
      </button>
    </div>
  </div>

  {#if $lastSyncEvent}
    <div class="sync-event" role="status">
      {$lastSyncEvent}
    </div>
  {/if}

  {#if !compact}
    <div class="dnd-details">
      <div class="detail-row">
        <span class="detail-label">OS DND</span>
        <span class="detail-value" class:active={$osDndStatus?.active}>
          {$osDndStatus?.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Hearth DND</span>
        <span class="detail-value" class:active={$hearthDndActive}>
          {$hearthDndActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Sync</span>
        <span class="detail-value sync-state {$syncState}">
          {#if $syncState === 'synced-active'}In Sync (DND On)
          {:else if $syncState === 'synced-inactive'}In Sync
          {:else if $syncState === 'out-of-sync'}Out of Sync
          {:else if $syncState === 'disabled'}Disabled
          {:else if $syncState === 'unsupported'}Unsupported
          {:else}Unknown{/if}
        </span>
      </div>

      {#if $syncState === 'out-of-sync'}
        <button class="manual-sync-btn" on:click={manualSyncFromOs}>
          Sync Now
        </button>
      {/if}
    </div>
  {/if}

  {#if $isLoading}
    <div class="dnd-loading">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<style>
  .dnd-sync-manager {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 8px;
    border: 1px solid var(--border-color, #313244);
    padding: 10px 12px;
  }

  .dnd-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dnd-indicator {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-tertiary, #262637);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .dnd-indicator.active {
    background: rgba(239, 68, 68, 0.15);
  }

  .dnd-icon {
    font-size: 1rem;
  }

  .dnd-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .dnd-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .dnd-status {
    font-size: 0.6875rem;
    color: var(--text-muted, #6c7086);
  }

  .dnd-controls {
    flex-shrink: 0;
  }

  .sync-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--border-color, #313244);
    background: var(--bg-tertiary, #262637);
    color: var(--text-muted, #6c7086);
    border-radius: 12px;
    cursor: pointer;
    font-size: 0.6875rem;
    transition: all 0.15s ease;
  }

  .sync-toggle:hover {
    border-color: var(--border-hover, #45475a);
    color: var(--text-primary, #cdd6f4);
  }

  .sync-toggle.active {
    border-color: var(--color-primary, #89b4fa);
    background: var(--color-primary-bg, rgba(137, 180, 250, 0.1));
    color: var(--color-primary, #89b4fa);
  }

  .sync-icon {
    font-size: 0.75rem;
  }

  .sync-label {
    font-weight: 500;
  }

  .sync-event {
    margin-top: 6px;
    padding: 4px 8px;
    font-size: 0.6875rem;
    color: var(--color-primary, #89b4fa);
    background: var(--color-primary-bg, rgba(137, 180, 250, 0.08));
    border-radius: 4px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dnd-details {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #313244);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-label {
    font-size: 0.75rem;
    color: var(--text-muted, #6c7086);
  }

  .detail-value {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted, #6c7086);
  }

  .detail-value.active {
    color: var(--color-danger, #ef4444);
  }

  .sync-state.synced-active {
    color: var(--color-success, #22c55e);
  }

  .sync-state.synced-inactive {
    color: var(--color-success, #22c55e);
  }

  .sync-state.out-of-sync {
    color: var(--color-warning, #f59e0b);
  }

  .sync-state.disabled {
    color: var(--text-muted, #6c7086);
  }

  .sync-state.unsupported {
    color: var(--text-muted, #6c7086);
    font-style: italic;
  }

  .manual-sync-btn {
    margin-top: 4px;
    padding: 5px 12px;
    border: 1px solid var(--color-warning, #f59e0b);
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning, #f59e0b);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.15s ease;
    align-self: flex-start;
  }

  .manual-sync-btn:hover {
    background: rgba(245, 158, 11, 0.2);
  }

  .dnd-loading {
    display: flex;
    justify-content: center;
    padding: 8px 0;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color, #313244);
    border-top-color: var(--color-primary, #89b4fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .compact .dnd-details {
    display: none;
  }

  .compact .dnd-indicator {
    width: 24px;
    height: 24px;
  }

  .compact .dnd-icon {
    font-size: 0.75rem;
  }
</style>
