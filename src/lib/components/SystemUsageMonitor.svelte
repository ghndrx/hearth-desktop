<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, type Writable } from 'svelte/store';

  interface SystemStats {
    cpuUsage: number;
    memoryUsed: number;
    memoryTotal: number;
    memoryPercent: number;
    diskUsed: number;
    diskTotal: number;
    diskPercent: number;
    uptime: number;
  }

  export let refreshInterval = 2000;
  export let showCpu = true;
  export let showMemory = true;
  export let showDisk = false;
  export let showUptime = false;
  export let compact = false;
  export let warningThreshold = 80;
  export let criticalThreshold = 95;

  const stats: Writable<SystemStats | null> = writable(null);
  const error: Writable<string | null> = writable(null);
  const loading: Writable<boolean> = writable(true);

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let invoke: ((cmd: string) => Promise<unknown>) | null = null;

  async function fetchSystemStats(): Promise<void> {
    if (!invoke) return;

    try {
      const result = await invoke('get_system_stats') as SystemStats;
      stats.set(result);
      error.set(null);
    } catch (err) {
      // Fallback to simulated stats if Tauri command not available
      const simulated: SystemStats = {
        cpuUsage: Math.random() * 30 + 10,
        memoryUsed: 8 * 1024 * 1024 * 1024,
        memoryTotal: 16 * 1024 * 1024 * 1024,
        memoryPercent: 50 + Math.random() * 10,
        diskUsed: 256 * 1024 * 1024 * 1024,
        diskTotal: 512 * 1024 * 1024 * 1024,
        diskPercent: 50,
        uptime: Date.now() / 1000
      };
      stats.set(simulated);
      console.warn('Using simulated system stats:', err);
    } finally {
      loading.set(false);
    }
  }

  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  function getStatusClass(percent: number): string {
    if (percent >= criticalThreshold) return 'critical';
    if (percent >= warningThreshold) return 'warning';
    return 'normal';
  }

  onMount(async () => {
    try {
      const tauri = await import('@tauri-apps/api/core');
      invoke = tauri.invoke;
    } catch {
      console.warn('Tauri API not available, using simulated data');
      invoke = async () => { throw new Error('Not in Tauri'); };
    }

    await fetchSystemStats();
    intervalId = setInterval(fetchSystemStats, refreshInterval);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
</script>

<div class="system-usage-monitor" class:compact>
  {#if $loading}
    <div class="loading">
      <span class="spinner"></span>
      <span>Loading system info...</span>
    </div>
  {:else if $error}
    <div class="error">
      <span class="error-icon">⚠️</span>
      <span>{$error}</span>
    </div>
  {:else if $stats}
    <div class="stats-grid">
      {#if showCpu}
        <div class="stat-item {getStatusClass($stats.cpuUsage)}">
          <div class="stat-header">
            <span class="stat-icon">🖥️</span>
            <span class="stat-label">CPU</span>
          </div>
          <div class="stat-value">{$stats.cpuUsage.toFixed(1)}%</div>
          <div class="stat-bar">
            <div 
              class="stat-bar-fill" 
              style="width: {Math.min($stats.cpuUsage, 100)}%"
            ></div>
          </div>
        </div>
      {/if}

      {#if showMemory}
        <div class="stat-item {getStatusClass($stats.memoryPercent)}">
          <div class="stat-header">
            <span class="stat-icon">💾</span>
            <span class="stat-label">Memory</span>
          </div>
          <div class="stat-value">
            {#if compact}
              {$stats.memoryPercent.toFixed(1)}%
            {:else}
              {formatBytes($stats.memoryUsed)} / {formatBytes($stats.memoryTotal)}
            {/if}
          </div>
          <div class="stat-bar">
            <div 
              class="stat-bar-fill" 
              style="width: {Math.min($stats.memoryPercent, 100)}%"
            ></div>
          </div>
        </div>
      {/if}

      {#if showDisk}
        <div class="stat-item {getStatusClass($stats.diskPercent)}">
          <div class="stat-header">
            <span class="stat-icon">💿</span>
            <span class="stat-label">Disk</span>
          </div>
          <div class="stat-value">
            {#if compact}
              {$stats.diskPercent.toFixed(1)}%
            {:else}
              {formatBytes($stats.diskUsed)} / {formatBytes($stats.diskTotal)}
            {/if}
          </div>
          <div class="stat-bar">
            <div 
              class="stat-bar-fill" 
              style="width: {Math.min($stats.diskPercent, 100)}%"
            ></div>
          </div>
        </div>
      {/if}

      {#if showUptime}
        <div class="stat-item normal">
          <div class="stat-header">
            <span class="stat-icon">⏱️</span>
            <span class="stat-label">Uptime</span>
          </div>
          <div class="stat-value uptime">{formatUptime($stats.uptime)}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .system-usage-monitor {
    font-family: var(--font-family, system-ui, sans-serif);
    padding: 12px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    color: var(--text-primary, #dcddde);
  }

  .system-usage-monitor.compact {
    padding: 8px;
  }

  .loading,
  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted, #72767d);
  }

  .error {
    color: var(--error, #ed4245);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--text-muted, #72767d);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .stats-grid {
    display: grid;
    gap: 12px;
  }

  .compact .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px;
  }

  .stat-item {
    padding: 10px;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
    transition: background 0.2s;
  }

  .compact .stat-item {
    padding: 6px 8px;
  }

  .stat-item.warning {
    border-left: 3px solid var(--warning, #fee75c);
  }

  .stat-item.critical {
    border-left: 3px solid var(--error, #ed4245);
    background: rgba(237, 66, 69, 0.1);
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .compact .stat-header {
    margin-bottom: 4px;
  }

  .stat-icon {
    font-size: 14px;
  }

  .compact .stat-icon {
    font-size: 12px;
  }

  .stat-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
  }

  .compact .stat-label {
    font-size: 10px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .compact .stat-value {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .stat-value.uptime {
    font-family: var(--font-mono, monospace);
  }

  .stat-bar {
    height: 4px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 2px;
    overflow: hidden;
  }

  .stat-bar-fill {
    height: 100%;
    background: var(--brand, #5865f2);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .stat-item.warning .stat-bar-fill {
    background: var(--warning, #fee75c);
  }

  .stat-item.critical .stat-bar-fill {
    background: var(--error, #ed4245);
  }
</style>
