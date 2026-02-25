<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  interface OsInfo {
    name: string;
    version: string;
    kernelVersion: string;
    hostname: string;
    arch: string;
    uptimeSeconds: number;
  }

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

  interface RuntimeInfo {
    tauriVersion: string;
    appVersion: string;
    targetTriple: string;
    buildType: string;
  }

  interface SystemInfo {
    os: OsInfo;
    cpu: CpuInfo;
    memory: MemoryInfo;
    runtime: RuntimeInfo;
  }

  // Props
  export let showRefreshButton = true;
  export let autoRefresh = false;
  export let autoRefreshInterval = 5000;
  export let compact = false;

  // State
  let systemInfo: SystemInfo | null = null;
  let loading = true;
  let error: string | null = null;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  // Format bytes to human-readable
  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  // Format uptime to human-readable
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

  // Format frequency to GHz if >= 1000
  function formatFrequency(mhz: number): string {
    if (mhz >= 1000) {
      return `${(mhz / 1000).toFixed(2)} GHz`;
    }
    return `${mhz} MHz`;
  }

  // Load system info
  async function loadSystemInfo(): Promise<void> {
    try {
      error = null;
      systemInfo = await invoke<SystemInfo>('get_system_info');
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error('Failed to get system info:', e);
    } finally {
      loading = false;
    }
  }

  // Manual refresh
  async function refresh(): Promise<void> {
    loading = true;
    await loadSystemInfo();
  }

  // Lifecycle
  onMount(() => {
    loadSystemInfo();

    if (autoRefresh && autoRefreshInterval > 0) {
      refreshIntervalId = setInterval(loadSystemInfo, autoRefreshInterval);
    }
  });

  onDestroy(() => {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }
  });

  // Reactive: update interval when props change
  $: if (autoRefresh && autoRefreshInterval > 0 && !refreshIntervalId) {
    refreshIntervalId = setInterval(loadSystemInfo, autoRefreshInterval);
  } else if (!autoRefresh && refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
</script>

<div class="system-info-panel" class:compact>
  <div class="header">
    <h3>System Information</h3>
    {#if showRefreshButton}
      <button class="refresh-btn" on:click={refresh} disabled={loading} title="Refresh">
        <svg class="icon" class:spinning={loading} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    {/if}
  </div>

  {#if loading && !systemInfo}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading system information...</span>
    </div>
  {:else if error}
    <div class="error">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Failed to load system info: {error}</span>
    </div>
  {:else if systemInfo}
    <div class="info-sections">
      <!-- Operating System -->
      <section class="info-section">
        <h4>
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Operating System
        </h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">OS</span>
            <span class="value">{systemInfo.os.name} {systemInfo.os.version}</span>
          </div>
          <div class="info-item">
            <span class="label">Kernel</span>
            <span class="value">{systemInfo.os.kernelVersion}</span>
          </div>
          <div class="info-item">
            <span class="label">Hostname</span>
            <span class="value">{systemInfo.os.hostname}</span>
          </div>
          <div class="info-item">
            <span class="label">Architecture</span>
            <span class="value">{systemInfo.os.arch}</span>
          </div>
          <div class="info-item">
            <span class="label">Uptime</span>
            <span class="value">{formatUptime(systemInfo.os.uptimeSeconds)}</span>
          </div>
        </div>
      </section>

      <!-- CPU -->
      <section class="info-section">
        <h4>
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/>
            <line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/>
            <line x1="15" y1="20" x2="15" y2="23"/>
            <line x1="20" y1="9" x2="23" y2="9"/>
            <line x1="20" y1="14" x2="23" y2="14"/>
            <line x1="1" y1="9" x2="4" y2="9"/>
            <line x1="1" y1="14" x2="4" y2="14"/>
          </svg>
          Processor
        </h4>
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="label">CPU</span>
            <span class="value">{systemInfo.cpu.name}</span>
          </div>
          <div class="info-item">
            <span class="label">Cores</span>
            <span class="value">{systemInfo.cpu.physicalCores} physical / {systemInfo.cpu.logicalCores} logical</span>
          </div>
          <div class="info-item">
            <span class="label">Frequency</span>
            <span class="value">{formatFrequency(systemInfo.cpu.frequencyMhz)}</span>
          </div>
          <div class="info-item full-width">
            <span class="label">Usage</span>
            <div class="progress-container">
              <div class="progress-bar" style="width: {systemInfo.cpu.usagePercent}%"></div>
              <span class="progress-text">{systemInfo.cpu.usagePercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Memory -->
      <section class="info-section">
        <h4>
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
            <line x1="6" y1="16" x2="6" y2="16.01"/>
            <line x1="10" y1="16" x2="10" y2="16.01"/>
            <line x1="14" y1="16" x2="14" y2="16.01"/>
            <line x1="18" y1="16" x2="18" y2="16.01"/>
          </svg>
          Memory
        </h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Total</span>
            <span class="value">{formatBytes(systemInfo.memory.totalBytes)}</span>
          </div>
          <div class="info-item">
            <span class="label">Used</span>
            <span class="value">{formatBytes(systemInfo.memory.usedBytes)}</span>
          </div>
          <div class="info-item">
            <span class="label">Available</span>
            <span class="value">{formatBytes(systemInfo.memory.availableBytes)}</span>
          </div>
          <div class="info-item full-width">
            <span class="label">Usage</span>
            <div class="progress-container">
              <div 
                class="progress-bar" 
                class:warning={systemInfo.memory.usagePercent > 70}
                class:critical={systemInfo.memory.usagePercent > 90}
                style="width: {systemInfo.memory.usagePercent}%"
              ></div>
              <span class="progress-text">{systemInfo.memory.usagePercent.toFixed(1)}%</span>
            </div>
          </div>
          {#if systemInfo.memory.swapTotalBytes > 0}
            <div class="info-item">
              <span class="label">Swap Total</span>
              <span class="value">{formatBytes(systemInfo.memory.swapTotalBytes)}</span>
            </div>
            <div class="info-item">
              <span class="label">Swap Used</span>
              <span class="value">{formatBytes(systemInfo.memory.swapUsedBytes)}</span>
            </div>
          {/if}
        </div>
      </section>

      <!-- Application Runtime -->
      <section class="info-section">
        <h4>
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Application
        </h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">App Version</span>
            <span class="value">{systemInfo.runtime.appVersion}</span>
          </div>
          <div class="info-item">
            <span class="label">Tauri Version</span>
            <span class="value">{systemInfo.runtime.tauriVersion}</span>
          </div>
          <div class="info-item">
            <span class="label">Target</span>
            <span class="value">{systemInfo.runtime.targetTriple}</span>
          </div>
          <div class="info-item">
            <span class="label">Build</span>
            <span class="value build-badge" class:release={systemInfo.runtime.buildType === 'release'}>
              {systemInfo.runtime.buildType}
            </span>
          </div>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .system-info-panel {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 16px;
    color: var(--text-primary, #dcddde);
  }

  .system-info-panel.compact {
    padding: 12px;
  }

  .system-info-panel.compact .info-sections {
    gap: 12px;
  }

  .system-info-panel.compact h4 {
    font-size: 12px;
    margin-bottom: 8px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .refresh-btn {
    background: transparent;
    border: none;
    padding: 6px;
    cursor: pointer;
    border-radius: 4px;
    color: var(--text-muted, #72767d);
    transition: all 0.15s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-primary, #dcddde);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-btn .icon {
    width: 18px;
    height: 18px;
  }

  .refresh-btn .icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px;
    color: var(--text-muted, #72767d);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--text-muted, #72767d);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(237, 66, 69, 0.1);
    border-radius: 4px;
    color: var(--status-danger, #ed4245);
  }

  .error-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .info-sections {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .info-section {
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 12px;
  }

  .info-section h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-muted, #72767d);
  }

  .section-icon {
    width: 16px;
    height: 16px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-item.full-width {
    grid-column: 1 / -1;
  }

  .label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-muted, #72767d);
  }

  .value {
    font-size: 14px;
    color: var(--text-primary, #dcddde);
    word-break: break-word;
  }

  .progress-container {
    position: relative;
    height: 20px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: var(--brand-experiment, #5865f2);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-bar.warning {
    background: var(--status-warning, #faa61a);
  }

  .progress-bar.critical {
    background: var(--status-danger, #ed4245);
  }

  .progress-text {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .build-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(250, 166, 26, 0.2);
    color: var(--status-warning, #faa61a);
  }

  .build-badge.release {
    background: rgba(59, 165, 93, 0.2);
    color: var(--status-positive, #3ba55d);
  }

  /* Responsive */
  @media (max-width: 400px) {
    .info-grid {
      grid-template-columns: 1fr;
    }

    .info-item.full-width {
      grid-column: 1;
    }
  }
</style>
