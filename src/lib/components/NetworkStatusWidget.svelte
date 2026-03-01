<!--
  NetworkStatusWidget.svelte
  
  A compact real-time network status widget displaying connectivity,
  latency, and network interface information. Designed for sidebar/widget bar integration.
  
  Features:
  - Online/offline status indicator
  - Network type display (WiFi/Ethernet)
  - Live ping latency measurement
  - Interface list with IP addresses
  - Compact/expanded view modes
  - Auto-refresh with configurable interval
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived } from 'svelte/store';

  // Props
  export let refreshIntervalMs: number = 5000;
  export let compact: boolean = true;
  export let pingHost: string = 'google.com';
  export let showPing: boolean = true;
  export let showInterfaces: boolean = true;

  // Types
  interface NetworkInterface {
    name: string;
    is_up: boolean;
    ip_addresses: string[];
  }

  interface NetworkStatus {
    is_online: boolean;
    network_type: string;
    interfaces: NetworkInterface[];
  }

  interface LatencyResult {
    host: string;
    latency_ms: number | null;
    reachable: boolean;
  }

  // Stores
  const networkStatus = writable<NetworkStatus | null>(null);
  const latencyResult = writable<LatencyResult | null>(null);
  const isExpanded = writable(false);
  const isLoading = writable(true);
  const error = writable<string | null>(null);
  const pingHistory = writable<number[]>([]);

  // Derived values
  const isOnline = derived(networkStatus, ($status) => $status?.is_online ?? false);
  const networkType = derived(networkStatus, ($status) => $status?.network_type ?? 'unknown');
  const activeInterfaces = derived(networkStatus, ($status) =>
    ($status?.interfaces ?? []).filter((i) => i.is_up && i.ip_addresses.length > 0)
  );
  const latencyMs = derived(latencyResult, ($result) => $result?.latency_ms ?? null);
  const avgLatency = derived(pingHistory, ($history) => {
    if ($history.length === 0) return null;
    const sum = $history.reduce((a, b) => a + b, 0);
    return Math.round(sum / $history.length);
  });

  // Network type icons
  function getNetworkIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'wifi':
        return '📶';
      case 'ethernet':
        return '🔌';
      default:
        return '🌐';
    }
  }

  // Latency quality indicator
  function getLatencyQuality(ms: number | null): { level: string; color: string; label: string } {
    if (ms === null) {
      return { level: 'unknown', color: 'var(--text-muted, #6c7086)', label: '—' };
    }
    if (ms < 50) {
      return { level: 'excellent', color: 'var(--color-success, #22c55e)', label: 'Excellent' };
    }
    if (ms < 100) {
      return { level: 'good', color: 'var(--color-success, #22c55e)', label: 'Good' };
    }
    if (ms < 200) {
      return { level: 'fair', color: 'var(--color-warning, #f59e0b)', label: 'Fair' };
    }
    return { level: 'poor', color: 'var(--color-danger, #ef4444)', label: 'Poor' };
  }

  // Format interface name for display
  function formatInterfaceName(name: string): string {
    // Shorten common prefixes
    if (name.startsWith('wlp') || name.startsWith('wlan')) return 'WiFi';
    if (name.startsWith('eth') || name.startsWith('enp')) return 'Ethernet';
    if (name.startsWith('en')) return name.replace('en', 'Eth');
    return name;
  }

  // Data fetching
  async function fetchNetworkInfo(): Promise<void> {
    try {
      const status = await invoke<NetworkStatus>('get_network_status');
      networkStatus.set(status);

      if (showPing && status.is_online) {
        const latency = await invoke<LatencyResult>('measure_latency', { host: pingHost });
        latencyResult.set(latency);

        // Update ping history (keep last 10 measurements)
        if (latency.latency_ms !== null) {
          pingHistory.update((history) => {
            const newHistory = [...history, latency.latency_ms!];
            return newHistory.slice(-10);
          });
        }
      } else {
        latencyResult.set(null);
        pingHistory.set([]);
      }

      error.set(null);
      isLoading.set(false);
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Failed to fetch network info');
      isLoading.set(false);
    }
  }

  function toggleExpanded(): void {
    isExpanded.update((v) => !v);
  }

  // Lifecycle
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let unlistenStatus: UnlistenFn | null = null;

  onMount(async () => {
    // Initial fetch
    await fetchNetworkInfo();

    // Start polling
    intervalId = setInterval(fetchNetworkInfo, refreshIntervalMs);

    // Listen for network status change events
    try {
      unlistenStatus = await listen<NetworkStatus>('network:status-changed', (event) => {
        networkStatus.set(event.payload);
      });
    } catch {
      // Event listening not available
    }

    // Start network monitor
    try {
      await invoke('start_network_monitor');
    } catch {
      // Monitor may already be running
    }
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (unlistenStatus) {
      unlistenStatus();
    }
  });

  // Reactive refresh interval update
  $: if (intervalId && refreshIntervalMs) {
    clearInterval(intervalId);
    intervalId = setInterval(fetchNetworkInfo, refreshIntervalMs);
  }
</script>

<div
  class="network-status-widget"
  class:compact
  class:expanded={$isExpanded}
  class:offline={!$isOnline}
  role="region"
  aria-label="Network Status"
  on:click={toggleExpanded}
  on:keypress={(e) => e.key === 'Enter' && toggleExpanded()}
  tabindex="0"
>
  {#if $isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Checking network...</span>
    </div>
  {:else if $error}
    <div class="error">
      <span class="error-icon">⚠️</span>
      <span>{$error}</span>
    </div>
  {:else}
    <!-- Compact View -->
    {#if compact && !$isExpanded}
      <div class="compact-stats">
        <div class="status-indicator" class:online={$isOnline} class:offline={!$isOnline}>
          <span class="network-icon">{getNetworkIcon($networkType)}</span>
          <span class="status-dot"></span>
        </div>

        <div class="connection-info">
          <span class="network-type">{$networkType === 'unknown' ? 'Network' : $networkType}</span>
          {#if $isOnline && showPing && $latencyMs !== null}
            <span
              class="latency-value"
              style="color: {getLatencyQuality($latencyMs).color}"
              title="Ping to {pingHost}"
            >
              {$latencyMs}ms
            </span>
          {:else if !$isOnline}
            <span class="offline-label">Offline</span>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Expanded View -->
      <div class="expanded-stats">
        <div class="widget-header">
          <h3>Network Status</h3>
          <button class="collapse-btn" on:click|stopPropagation={toggleExpanded}>▼</button>
        </div>

        <!-- Connection Status -->
        <div class="stat-section">
          <div class="stat-header">
            <span class="network-icon large">{getNetworkIcon($networkType)}</span>
            <span class="stat-label">Connection</span>
            <span class="status-badge" class:online={$isOnline} class:offline={!$isOnline}>
              {$isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div class="stat-details">
            <span>Type: {$networkType === 'unknown' ? 'Unknown' : $networkType}</span>
          </div>
        </div>

        <!-- Latency Section -->
        {#if showPing && $isOnline}
          <div class="stat-section">
            <div class="stat-header">
              <span class="stat-icon">📡</span>
              <span class="stat-label">Latency</span>
              {#if $latencyMs !== null}
                <span class="stat-value" style="color: {getLatencyQuality($latencyMs).color}">
                  {$latencyMs}ms
                </span>
              {:else}
                <span class="stat-value muted">—</span>
              {/if}
            </div>
            <div class="latency-bar">
              {#each $pingHistory as ping, i}
                <div
                  class="latency-bar-segment"
                  style="height: {Math.min(ping / 3, 100)}%; background-color: {getLatencyQuality(ping).color}"
                  title="{ping}ms"
                ></div>
              {/each}
            </div>
            <div class="stat-details">
              <span>Host: {pingHost}</span>
              {#if $avgLatency !== null}
                <span>Average: {$avgLatency}ms ({getLatencyQuality($avgLatency).label})</span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Interfaces Section -->
        {#if showInterfaces && $activeInterfaces.length > 0}
          <div class="stat-section">
            <div class="stat-header">
              <span class="stat-icon">🔗</span>
              <span class="stat-label">Interfaces</span>
              <span class="stat-count">{$activeInterfaces.length}</span>
            </div>
            <div class="interfaces-list">
              {#each $activeInterfaces as iface}
                <div class="interface-item">
                  <span class="interface-name">{formatInterfaceName(iface.name)}</span>
                  <div class="interface-ips">
                    {#each iface.ip_addresses as ip}
                      <code class="ip-address">{ip}</code>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .network-status-widget {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--border-color, #313244);
    user-select: none;
  }

  .network-status-widget:hover {
    background: var(--bg-tertiary, #262637);
    border-color: var(--border-hover, #45475a);
  }

  .network-status-widget:focus {
    outline: 2px solid var(--color-primary, #89b4fa);
    outline-offset: 2px;
  }

  .network-status-widget.offline {
    border-color: var(--color-danger, #ef4444);
  }

  .network-status-widget.expanded {
    padding: 12px 16px;
  }

  /* Loading State */
  .loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted, #6c7086);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #313244);
    border-top-color: var(--color-primary, #89b4fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error State */
  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-danger, #ef4444);
    font-size: 0.875rem;
  }

  /* Compact View */
  .compact-stats {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-indicator {
    position: relative;
    display: flex;
    align-items: center;
  }

  .network-icon {
    font-size: 1rem;
  }

  .network-icon.large {
    font-size: 1.25rem;
  }

  .status-dot {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--bg-secondary, #1e1e2e);
  }

  .status-indicator.online .status-dot {
    background: var(--color-success, #22c55e);
  }

  .status-indicator.offline .status-dot {
    background: var(--color-danger, #ef4444);
  }

  .connection-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
  }

  .network-type {
    color: var(--text-primary, #cdd6f4);
    font-weight: 500;
    text-transform: capitalize;
  }

  .latency-value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .offline-label {
    color: var(--color-danger, #ef4444);
    font-weight: 500;
  }

  /* Expanded View */
  .expanded-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .collapse-btn {
    background: none;
    border: none;
    color: var(--text-muted, #6c7086);
    cursor: pointer;
    padding: 4px;
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }

  .collapse-btn:hover {
    color: var(--text-primary, #cdd6f4);
  }

  .expanded .collapse-btn {
    transform: rotate(180deg);
  }

  .stat-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-icon {
    font-size: 0.875rem;
  }

  .stat-label {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
  }

  .stat-value {
    font-weight: 600;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }

  .stat-value.muted {
    color: var(--text-muted, #6c7086);
  }

  .stat-count {
    background: var(--bg-tertiary, #262637);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.75rem;
    color: var(--text-muted, #6c7086);
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.online {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success, #22c55e);
  }

  .status-badge.offline {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-danger, #ef4444);
  }

  .stat-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
    color: var(--text-muted, #6c7086);
  }

  /* Latency Bar */
  .latency-bar {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 24px;
    padding: 2px;
    background: var(--bg-tertiary, #262637);
    border-radius: 4px;
  }

  .latency-bar-segment {
    flex: 1;
    min-height: 4px;
    border-radius: 2px;
    transition: height 0.3s ease;
  }

  /* Interfaces List */
  .interfaces-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .interface-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    background: var(--bg-tertiary, #262637);
    border-radius: 6px;
  }

  .interface-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
  }

  .interface-ips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ip-address {
    font-size: 0.7rem;
    font-family: var(--font-mono, monospace);
    background: var(--bg-secondary, #1e1e2e);
    padding: 1px 4px;
    border-radius: 3px;
    color: var(--text-muted, #6c7086);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .compact-stats {
      gap: 6px;
    }

    .connection-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
  }
</style>
