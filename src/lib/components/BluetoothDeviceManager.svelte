<!--
  BluetoothDeviceManager.svelte

  Native Bluetooth device manager that displays paired/connected devices,
  monitors connection state changes, and shows battery levels where available.

  Features:
  - List paired and connected Bluetooth devices
  - Real-time connection/disconnection notifications
  - Battery level indicators for supported devices
  - Device type icons (headphones, speakers, keyboard, mouse)
  - Audio device quick-switch
  - Auto-refresh with configurable interval
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived } from 'svelte/store';

  export let refreshIntervalMs: number = 5000;
  export let showDisconnected: boolean = true;
  export let compact: boolean = false;

  interface BluetoothDevice {
    name: string;
    address: string;
    device_type: string;
    connected: boolean;
    paired: boolean;
    battery_level: number | null;
    signal_strength: number | null;
  }

  interface BluetoothStatus {
    available: boolean;
    enabled: boolean;
    discovering: boolean;
    devices: BluetoothDevice[];
  }

  const status = writable<BluetoothStatus | null>(null);
  const isLoading = writable(true);
  const error = writable<string | null>(null);
  const isExpanded = writable(!compact);
  const lastEvent = writable<string | null>(null);

  const connectedDevices = derived(status, ($s) =>
    $s?.devices.filter((d) => d.connected) ?? []
  );
  const disconnectedDevices = derived(status, ($s) =>
    $s?.devices.filter((d) => !d.connected) ?? []
  );
  const audioDevices = derived(connectedDevices, ($devices) =>
    $devices.filter((d) => {
      const t = d.device_type.toLowerCase();
      return t.includes('audio') || t.includes('headset') || t.includes('headphone') || t.includes('speaker');
    })
  );

  function getDeviceIcon(deviceType: string): string {
    const t = deviceType.toLowerCase();
    if (t.includes('headphone') || t.includes('headset')) return '🎧';
    if (t.includes('speaker') || t.includes('audio')) return '🔊';
    if (t.includes('keyboard')) return '⌨️';
    if (t.includes('mouse')) return '🖱️';
    if (t.includes('gamepad') || t.includes('gaming')) return '🎮';
    if (t.includes('phone')) return '📱';
    if (t.includes('computer')) return '💻';
    if (t.includes('watch')) return '⌚';
    return '📶';
  }

  function getBatteryIcon(level: number | null): string {
    if (level === null) return '';
    if (level > 75) return '🔋';
    if (level > 25) return '🪫';
    return '⚠️';
  }

  function getBatteryColor(level: number | null): string {
    if (level === null) return '';
    if (level > 50) return 'var(--color-success, #22c55e)';
    if (level > 20) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }

  async function fetchStatus(): Promise<void> {
    try {
      const result = await invoke<BluetoothStatus>('bluetooth_get_status');
      status.set(result);
      error.set(null);
      isLoading.set(false);
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Bluetooth unavailable');
      isLoading.set(false);
    }
  }

  function toggleExpanded(): void {
    isExpanded.update((v) => !v);
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let unlisteners: UnlistenFn[] = [];

  onMount(async () => {
    fetchStatus();
    intervalId = setInterval(fetchStatus, refreshIntervalMs);

    // Listen for connection events
    const unlisten1 = await listen<BluetoothDevice>('bluetooth:connected', (event) => {
      lastEvent.set(`${event.payload.name} connected`);
      fetchStatus();
      setTimeout(() => lastEvent.set(null), 3000);
    });

    const unlisten2 = await listen<BluetoothDevice>('bluetooth:disconnected', (event) => {
      lastEvent.set(`${event.payload.name} disconnected`);
      fetchStatus();
      setTimeout(() => lastEvent.set(null), 3000);
    });

    unlisteners = [unlisten1, unlisten2];

    // Start the native monitor
    try {
      await invoke('bluetooth_start_monitor', { intervalSecs: Math.ceil(refreshIntervalMs / 1000) });
    } catch {
      // Monitor may not be available
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    unlisteners.forEach((fn) => fn());
    invoke('bluetooth_stop_monitor').catch(() => {});
  });
</script>

<div
  class="bluetooth-manager"
  class:compact
  class:expanded={$isExpanded}
  role="region"
  aria-label="Bluetooth Devices"
>
  <div
    class="bt-header"
    on:click={toggleExpanded}
    on:keypress={(e) => e.key === 'Enter' && toggleExpanded()}
    tabindex="0"
    role="button"
    aria-expanded={$isExpanded}
  >
    <div class="bt-title">
      <span class="bt-icon">📶</span>
      <span>Bluetooth</span>
      {#if $status}
        <span class="bt-badge" class:active={$status.enabled}>
          {$connectedDevices.length}
        </span>
      {/if}
    </div>
    <span class="expand-icon" class:rotated={$isExpanded}>▶</span>
  </div>

  {#if $lastEvent}
    <div class="bt-event" role="alert">
      {$lastEvent}
    </div>
  {/if}

  {#if $isExpanded}
    <div class="bt-content">
      {#if $isLoading}
        <div class="bt-loading">
          <div class="spinner"></div>
          <span>Scanning...</span>
        </div>
      {:else if $error}
        <div class="bt-error">
          <span>⚠️ {$error}</span>
        </div>
      {:else if !$status?.available}
        <div class="bt-unavailable">
          <span>Bluetooth not available</span>
        </div>
      {:else}
        {#if $connectedDevices.length > 0}
          <div class="device-section">
            <h4 class="section-label">Connected</h4>
            {#each $connectedDevices as device (device.address)}
              <div class="device-item connected">
                <span class="device-icon">{getDeviceIcon(device.device_type)}</span>
                <div class="device-info">
                  <span class="device-name">{device.name}</span>
                  <span class="device-type">{device.device_type}</span>
                </div>
                {#if device.battery_level !== null}
                  <div class="battery" style="color: {getBatteryColor(device.battery_level)}">
                    <span>{getBatteryIcon(device.battery_level)}</span>
                    <span class="battery-level">{device.battery_level}%</span>
                  </div>
                {/if}
                <span class="status-dot connected" title="Connected"></span>
              </div>
            {/each}
          </div>
        {/if}

        {#if showDisconnected && $disconnectedDevices.length > 0}
          <div class="device-section">
            <h4 class="section-label">Paired</h4>
            {#each $disconnectedDevices as device (device.address)}
              <div class="device-item disconnected">
                <span class="device-icon">{getDeviceIcon(device.device_type)}</span>
                <div class="device-info">
                  <span class="device-name">{device.name}</span>
                  <span class="device-type">{device.device_type}</span>
                </div>
                <span class="status-dot" title="Disconnected"></span>
              </div>
            {/each}
          </div>
        {/if}

        {#if $status?.devices.length === 0}
          <div class="bt-empty">
            <span>No paired devices</span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .bluetooth-manager {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 8px;
    border: 1px solid var(--border-color, #313244);
    overflow: hidden;
  }

  .bt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .bt-header:hover {
    background: var(--bg-tertiary, #262637);
  }

  .bt-header:focus {
    outline: 2px solid var(--color-primary, #89b4fa);
    outline-offset: -2px;
  }

  .bt-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .bt-icon {
    font-size: 1rem;
  }

  .bt-badge {
    background: var(--bg-tertiary, #262637);
    color: var(--text-muted, #6c7086);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .bt-badge.active {
    background: var(--color-primary-bg, rgba(137, 180, 250, 0.15));
    color: var(--color-primary, #89b4fa);
  }

  .expand-icon {
    font-size: 0.625rem;
    color: var(--text-muted, #6c7086);
    transition: transform 0.2s ease;
  }

  .expand-icon.rotated {
    transform: rotate(90deg);
  }

  .bt-event {
    padding: 4px 12px;
    font-size: 0.75rem;
    color: var(--color-primary, #89b4fa);
    background: var(--color-primary-bg, rgba(137, 180, 250, 0.1));
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bt-content {
    padding: 0 12px 10px;
  }

  .bt-loading, .bt-error, .bt-unavailable, .bt-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    font-size: 0.8125rem;
    color: var(--text-muted, #6c7086);
  }

  .bt-error {
    color: var(--color-danger, #ef4444);
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

  .device-section {
    margin-top: 8px;
  }

  .section-label {
    margin: 0 0 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #6c7086);
  }

  .device-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .device-item:hover {
    background: var(--bg-tertiary, #262637);
  }

  .device-item.disconnected {
    opacity: 0.6;
  }

  .device-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .device-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .device-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .device-type {
    font-size: 0.6875rem;
    color: var(--text-muted, #6c7086);
  }

  .battery {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .battery-level {
    font-weight: 500;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted, #6c7086);
    flex-shrink: 0;
  }

  .status-dot.connected {
    background: var(--color-success, #22c55e);
  }

  .compact .bt-content {
    padding: 0 8px 8px;
  }

  .compact .device-item {
    padding: 4px 6px;
  }
</style>
