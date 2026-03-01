<!--
  SystemMonitorWidget.svelte
  
  A compact real-time system monitor widget displaying CPU, memory,
  and system stats. Designed for sidebar/widget bar integration.
  
  Features:
  - Live CPU usage with animated bar
  - Memory usage visualization
  - System uptime display
  - Compact/expanded view modes
  - Click to toggle detailed stats
  - Refresh interval configuration
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived } from 'svelte/store';

  // Props
  export let refreshIntervalMs: number = 2000;
  export let compact: boolean = true;
  export let showCpu: boolean = true;
  export let showMemory: boolean = true;
  export let showUptime: boolean = true;

  // Types
  interface CpuInfo {
    name: string;
    physicalCores: number;
    logicalCores: number;
    frequencyMhz: number;
    usagePercent: number;
  }

  interface MemoryInfo {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
  }

  interface OsInfo {
    name: string;
    version: string;
    kernelVersion: string;
    hostname: string;
    arch: string;
    uptimeSeconds: number;
  }

  // Stores
  const cpuInfo = writable<CpuInfo | null>(null);
  const memoryInfo = writable<MemoryInfo | null>(null);
  const osInfo = writable<OsInfo | null>(null);
  const isExpanded = writable(false);
  const isLoading = writable(true);
  const error = writable<string | null>(null);

  // Derived values
  const cpuUsage = derived(cpuInfo, ($cpu) => $cpu?.usagePercent ?? 0);
  const memUsage = derived(memoryInfo, ($mem) => $mem?.usagePercent ?? 0);
  const uptime = derived(osInfo, ($os) => formatUptime($os?.uptimeSeconds ?? 0));

  // Format helpers
  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  function getUsageColor(percent: number): string {
    if (percent < 50) return 'var(--color-success, #22c55e)';
    if (percent < 75) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }

  function getUsageLevel(percent: number): string {
    if (percent < 50) return 'low';
    if (percent < 75) return 'medium';
    return 'high';
  }

  // Data fetching
  async function fetchSystemInfo(): Promise<void> {
    try {
      const [cpu, mem, os] = await Promise.all([
        showCpu ? invoke<CpuInfo>('get_cpu_info') : Promise.resolve(null),
        showMemory ? invoke<MemoryInfo>('get_memory_info') : Promise.resolve(null),
        showUptime ? invoke<OsInfo>('get_os_info') : Promise.resolve(null),
      ]);

      if (cpu) cpuInfo.set(cpu);
      if (mem) memoryInfo.set(mem);
      if (os) osInfo.set(os);
      
      error.set(null);
      isLoading.set(false);
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Failed to fetch system info');
      isLoading.set(false);
    }
  }

  function toggleExpanded(): void {
    isExpanded.update((v) => !v);
  }

  // Lifecycle
  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    fetchSystemInfo();
    intervalId = setInterval(fetchSystemInfo, refreshIntervalMs);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Reactive refresh interval update
  $: if (intervalId && refreshIntervalMs) {
    clearInterval(intervalId);
    intervalId = setInterval(fetchSystemInfo, refreshIntervalMs);
  }
</script>

<div
  class="system-monitor-widget"
  class:compact
  class:expanded={$isExpanded}
  role="region"
  aria-label="System Monitor"
  on:click={toggleExpanded}
  on:keypress={(e) => e.key === 'Enter' && toggleExpanded()}
  tabindex="0"
>
  {#if $isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading...</span>
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
        {#if showCpu}
          <div class="stat-item" title="CPU Usage: {$cpuUsage.toFixed(1)}%">
            <span class="stat-icon">🖥️</span>
            <div class="mini-bar">
              <div
                class="mini-bar-fill"
                class:low={getUsageLevel($cpuUsage) === 'low'}
                class:medium={getUsageLevel($cpuUsage) === 'medium'}
                class:high={getUsageLevel($cpuUsage) === 'high'}
                style="width: {$cpuUsage}%"
              ></div>
            </div>
            <span class="stat-value">{$cpuUsage.toFixed(0)}%</span>
          </div>
        {/if}
        
        {#if showMemory}
          <div class="stat-item" title="Memory Usage: {$memUsage.toFixed(1)}%">
            <span class="stat-icon">💾</span>
            <div class="mini-bar">
              <div
                class="mini-bar-fill"
                class:low={getUsageLevel($memUsage) === 'low'}
                class:medium={getUsageLevel($memUsage) === 'medium'}
                class:high={getUsageLevel($memUsage) === 'high'}
                style="width: {$memUsage}%"
              ></div>
            </div>
            <span class="stat-value">{$memUsage.toFixed(0)}%</span>
          </div>
        {/if}
        
        {#if showUptime}
          <div class="stat-item uptime" title="System Uptime">
            <span class="stat-icon">⏱️</span>
            <span class="stat-value">{$uptime}</span>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Expanded View -->
      <div class="expanded-stats">
        <div class="widget-header">
          <h3>System Monitor</h3>
          <button class="collapse-btn" on:click|stopPropagation={toggleExpanded}>
            ▼
          </button>
        </div>

        {#if showCpu && $cpuInfo}
          <div class="stat-section">
            <div class="stat-header">
              <span class="stat-icon">🖥️</span>
              <span class="stat-label">CPU</span>
              <span class="stat-value" style="color: {getUsageColor($cpuUsage)}">
                {$cpuUsage.toFixed(1)}%
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill cpu"
                style="width: {$cpuUsage}%; background-color: {getUsageColor($cpuUsage)}"
              ></div>
            </div>
            <div class="stat-details">
              <span>{$cpuInfo.name}</span>
              <span>{$cpuInfo.logicalCores} cores @ {$cpuInfo.frequencyMhz} MHz</span>
            </div>
          </div>
        {/if}

        {#if showMemory && $memoryInfo}
          <div class="stat-section">
            <div class="stat-header">
              <span class="stat-icon">💾</span>
              <span class="stat-label">Memory</span>
              <span class="stat-value" style="color: {getUsageColor($memUsage)}">
                {$memUsage.toFixed(1)}%
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill memory"
                style="width: {$memUsage}%; background-color: {getUsageColor($memUsage)}"
              ></div>
            </div>
            <div class="stat-details">
              <span>{formatBytes($memoryInfo.usedBytes)} / {formatBytes($memoryInfo.totalBytes)}</span>
              <span>Available: {formatBytes($memoryInfo.availableBytes)}</span>
            </div>
            {#if $memoryInfo.swapTotalBytes > 0}
              <div class="stat-details swap">
                <span>Swap: {formatBytes($memoryInfo.swapUsedBytes)} / {formatBytes($memoryInfo.swapTotalBytes)}</span>
              </div>
            {/if}
          </div>
        {/if}

        {#if showUptime && $osInfo}
          <div class="stat-section">
            <div class="stat-header">
              <span class="stat-icon">⏱️</span>
              <span class="stat-label">System</span>
            </div>
            <div class="stat-details">
              <span>{$osInfo.name} {$osInfo.version}</span>
              <span>Uptime: {$uptime}</span>
              <span>Host: {$osInfo.hostname}</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .system-monitor-widget {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--border-color, #313244);
    user-select: none;
  }

  .system-monitor-widget:hover {
    background: var(--bg-tertiary, #262637);
    border-color: var(--border-hover, #45475a);
  }

  .system-monitor-widget:focus {
    outline: 2px solid var(--color-primary, #89b4fa);
    outline-offset: 2px;
  }

  .system-monitor-widget.expanded {
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
    to { transform: rotate(360deg); }
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
    gap: 12px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
  }

  .stat-icon {
    font-size: 0.875rem;
  }

  .mini-bar {
    width: 40px;
    height: 6px;
    background: var(--bg-tertiary, #262637);
    border-radius: 3px;
    overflow: hidden;
  }

  .mini-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .mini-bar-fill.low {
    background-color: var(--color-success, #22c55e);
  }

  .mini-bar-fill.medium {
    background-color: var(--color-warning, #f59e0b);
  }

  .mini-bar-fill.high {
    background-color: var(--color-danger, #ef4444);
  }

  .stat-value {
    color: var(--text-primary, #cdd6f4);
    font-weight: 500;
    min-width: 32px;
  }

  .stat-item.uptime .stat-value {
    min-width: auto;
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

  .stat-label {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary, #262637);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .stat-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75rem;
    color: var(--text-muted, #6c7086);
  }

  .stat-details.swap {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--border-color, #313244);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .compact-stats {
      flex-wrap: wrap;
      gap: 8px;
    }

    .mini-bar {
      width: 30px;
    }
  }
</style>
