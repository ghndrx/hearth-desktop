<!--
  ProcessManagerPanel.svelte

  Native process manager that displays running system processes with
  CPU and memory usage. Provides app detection for smart status features.

  Features:
  - Top processes by CPU and memory usage
  - Process search and filtering
  - Communication app detection (Zoom, Teams, Slack, etc.)
  - Gaming app detection
  - Process count and system resource summary
  - Auto-refresh with configurable interval
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived } from 'svelte/store';

  export let refreshIntervalMs: number = 3000;
  export let topCount: number = 8;
  export let compact: boolean = false;

  interface ProcessInfo {
    pid: number;
    name: string;
    cpu_usage: number;
    memory_bytes: number;
    status: string;
    start_time: number;
    parent_pid: number | null;
  }

  interface ProcessSummary {
    total_processes: number;
    total_threads: number;
    total_cpu_usage: number;
    total_memory_bytes: number;
    top_cpu: ProcessInfo[];
    top_memory: ProcessInfo[];
    timestamp: number;
  }

  interface AppDetection {
    app_name: string;
    running: boolean;
    pid: number | null;
    cpu_usage: number | null;
    memory_bytes: number | null;
  }

  const summary = writable<ProcessSummary | null>(null);
  const commApps = writable<AppDetection[]>([]);
  const gamingApps = writable<AppDetection[]>([]);
  const isLoading = writable(true);
  const error = writable<string | null>(null);
  const isExpanded = writable(!compact);
  const activeTab = writable<'cpu' | 'memory' | 'apps'>('cpu');
  const searchQuery = writable('');

  const filteredTopCpu = derived(
    [summary, searchQuery],
    ([$s, $q]) => {
      if (!$s) return [];
      if (!$q) return $s.top_cpu;
      const q = $q.toLowerCase();
      return $s.top_cpu.filter((p) => p.name.toLowerCase().includes(q));
    }
  );

  const filteredTopMemory = derived(
    [summary, searchQuery],
    ([$s, $q]) => {
      if (!$s) return [];
      if (!$q) return $s.top_memory;
      const q = $q.toLowerCase();
      return $s.top_memory.filter((p) => p.name.toLowerCase().includes(q));
    }
  );

  const runningCommApps = derived(commApps, ($apps) =>
    $apps.filter((a) => a.running)
  );

  const runningGamingApps = derived(gamingApps, ($apps) =>
    $apps.filter((a) => a.running)
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  }

  function getCpuColor(usage: number): string {
    if (usage < 25) return 'var(--color-success, #22c55e)';
    if (usage < 60) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }

  function getMemoryColor(bytes: number, totalBytes: number): string {
    const percent = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;
    if (percent < 2) return 'var(--color-success, #22c55e)';
    if (percent < 5) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  }

  async function fetchData(): Promise<void> {
    try {
      const [processSummary, comm, gaming] = await Promise.all([
        invoke<ProcessSummary>('process_get_summary', { topCount }),
        invoke<AppDetection[]>('process_detect_communication_apps'),
        invoke<AppDetection[]>('process_detect_gaming_apps'),
      ]);

      summary.set(processSummary);
      commApps.set(comm);
      gamingApps.set(gaming);
      error.set(null);
      isLoading.set(false);
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Failed to fetch processes');
      isLoading.set(false);
    }
  }

  function toggleExpanded(): void {
    isExpanded.update((v) => !v);
  }

  function setTab(tab: 'cpu' | 'memory' | 'apps'): void {
    activeTab.set(tab);
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    fetchData();
    intervalId = setInterval(fetchData, refreshIntervalMs);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<div
  class="process-manager"
  class:compact
  class:expanded={$isExpanded}
  role="region"
  aria-label="Process Manager"
>
  <div
    class="pm-header"
    on:click={toggleExpanded}
    on:keypress={(e) => e.key === 'Enter' && toggleExpanded()}
    tabindex="0"
    role="button"
    aria-expanded={$isExpanded}
  >
    <div class="pm-title">
      <span class="pm-icon">⚙️</span>
      <span>Processes</span>
      {#if $summary}
        <span class="pm-badge">{$summary.total_processes}</span>
      {/if}
    </div>
    {#if $summary && !$isExpanded}
      <span class="pm-summary-compact">
        CPU {$summary.total_cpu_usage.toFixed(0)}% | RAM {formatBytes($summary.total_memory_bytes)}
      </span>
    {/if}
    <span class="expand-icon" class:rotated={$isExpanded}>▶</span>
  </div>

  {#if $isExpanded}
    <div class="pm-content">
      {#if $isLoading}
        <div class="pm-loading">
          <div class="spinner"></div>
          <span>Loading processes...</span>
        </div>
      {:else if $error}
        <div class="pm-error">⚠️ {$error}</div>
      {:else if $summary}
        <!-- Summary bar -->
        <div class="pm-stats">
          <div class="stat">
            <span class="stat-label">Processes</span>
            <span class="stat-value">{$summary.total_processes}</span>
          </div>
          <div class="stat">
            <span class="stat-label">CPU Total</span>
            <span class="stat-value" style="color: {getCpuColor($summary.total_cpu_usage)}">
              {$summary.total_cpu_usage.toFixed(1)}%
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Memory</span>
            <span class="stat-value">{formatBytes($summary.total_memory_bytes)}</span>
          </div>
        </div>

        <!-- Tab bar -->
        <div class="tab-bar" role="tablist">
          <button
            class="tab"
            class:active={$activeTab === 'cpu'}
            on:click|stopPropagation={() => setTab('cpu')}
            role="tab"
            aria-selected={$activeTab === 'cpu'}
          >CPU</button>
          <button
            class="tab"
            class:active={$activeTab === 'memory'}
            on:click|stopPropagation={() => setTab('memory')}
            role="tab"
            aria-selected={$activeTab === 'memory'}
          >Memory</button>
          <button
            class="tab"
            class:active={$activeTab === 'apps'}
            on:click|stopPropagation={() => setTab('apps')}
            role="tab"
            aria-selected={$activeTab === 'apps'}
          >
            Apps
            {#if $runningCommApps.length > 0 || $runningGamingApps.length > 0}
              <span class="tab-badge">
                {$runningCommApps.length + $runningGamingApps.length}
              </span>
            {/if}
          </button>
        </div>

        <!-- Search (for CPU and Memory tabs) -->
        {#if $activeTab !== 'apps'}
          <div class="search-bar">
            <input
              type="text"
              placeholder="Filter processes..."
              bind:value={$searchQuery}
              class="search-input"
              on:click|stopPropagation
              aria-label="Filter processes"
            />
          </div>
        {/if}

        <!-- Process Lists -->
        {#if $activeTab === 'cpu'}
          <div class="process-list" role="list">
            {#each $filteredTopCpu as proc (proc.pid)}
              <div class="process-item" role="listitem">
                <span class="proc-name" title="{proc.name} (PID: {proc.pid})">{proc.name}</span>
                <div class="proc-bar">
                  <div
                    class="proc-bar-fill"
                    style="width: {Math.min(proc.cpu_usage, 100)}%; background: {getCpuColor(proc.cpu_usage)}"
                  ></div>
                </div>
                <span class="proc-value" style="color: {getCpuColor(proc.cpu_usage)}">
                  {proc.cpu_usage.toFixed(1)}%
                </span>
              </div>
            {/each}
          </div>
        {:else if $activeTab === 'memory'}
          <div class="process-list" role="list">
            {#each $filteredTopMemory as proc (proc.pid)}
              <div class="process-item" role="listitem">
                <span class="proc-name" title="{proc.name} (PID: {proc.pid})">{proc.name}</span>
                <span class="proc-value">{formatBytes(proc.memory_bytes)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="app-detection">
            {#if $runningCommApps.length > 0}
              <div class="app-section">
                <h4 class="section-label">Communication Apps</h4>
                {#each $runningCommApps as app (app.app_name)}
                  <div class="app-item running">
                    <span class="app-dot running"></span>
                    <span class="app-name">{app.app_name}</span>
                    {#if app.cpu_usage !== null}
                      <span class="app-stat">CPU {app.cpu_usage.toFixed(1)}%</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}

            {#if $runningGamingApps.length > 0}
              <div class="app-section">
                <h4 class="section-label">Gaming</h4>
                {#each $runningGamingApps as app (app.app_name)}
                  <div class="app-item running">
                    <span class="app-dot running"></span>
                    <span class="app-name">{app.app_name}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if $runningCommApps.length === 0 && $runningGamingApps.length === 0}
              <div class="app-empty">
                No communication or gaming apps detected
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .process-manager {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 8px;
    border: 1px solid var(--border-color, #313244);
    overflow: hidden;
  }

  .pm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    gap: 8px;
  }

  .pm-header:hover {
    background: var(--bg-tertiary, #262637);
  }

  .pm-header:focus {
    outline: 2px solid var(--color-primary, #89b4fa);
    outline-offset: -2px;
  }

  .pm-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
    flex-shrink: 0;
  }

  .pm-icon {
    font-size: 1rem;
  }

  .pm-badge {
    background: var(--bg-tertiary, #262637);
    color: var(--text-muted, #6c7086);
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 8px;
  }

  .pm-summary-compact {
    font-size: 0.6875rem;
    color: var(--text-muted, #6c7086);
    flex: 1;
    text-align: right;
    white-space: nowrap;
  }

  .expand-icon {
    font-size: 0.625rem;
    color: var(--text-muted, #6c7086);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .expand-icon.rotated {
    transform: rotate(90deg);
  }

  .pm-content {
    padding: 0 12px 10px;
  }

  .pm-loading, .pm-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    font-size: 0.8125rem;
    color: var(--text-muted, #6c7086);
  }

  .pm-error {
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

  .pm-stats {
    display: flex;
    gap: 16px;
    padding: 6px 0 10px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #6c7086);
  }

  .stat-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 8px 0 6px;
  }

  .tab {
    flex: 1;
    padding: 5px 8px;
    border: none;
    background: var(--bg-tertiary, #262637);
    color: var(--text-muted, #6c7086);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .tab:hover {
    color: var(--text-primary, #cdd6f4);
  }

  .tab.active {
    background: var(--color-primary-bg, rgba(137, 180, 250, 0.15));
    color: var(--color-primary, #89b4fa);
  }

  .tab-badge {
    background: var(--color-success, #22c55e);
    color: white;
    font-size: 0.625rem;
    padding: 0 4px;
    border-radius: 6px;
    min-width: 14px;
    text-align: center;
  }

  .search-bar {
    padding: 4px 0 6px;
  }

  .search-input {
    width: 100%;
    padding: 5px 8px;
    background: var(--bg-tertiary, #262637);
    border: 1px solid var(--border-color, #313244);
    border-radius: 4px;
    color: var(--text-primary, #cdd6f4);
    font-size: 0.75rem;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-primary, #89b4fa);
  }

  .search-input::placeholder {
    color: var(--text-muted, #6c7086);
  }

  .process-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }

  .process-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 4px;
    transition: background 0.1s ease;
  }

  .process-item:hover {
    background: var(--bg-tertiary, #262637);
  }

  .proc-name {
    flex: 1;
    font-size: 0.75rem;
    color: var(--text-primary, #cdd6f4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .proc-bar {
    width: 60px;
    height: 4px;
    background: var(--bg-tertiary, #262637);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .proc-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .proc-value {
    font-size: 0.6875rem;
    font-weight: 500;
    min-width: 44px;
    text-align: right;
    flex-shrink: 0;
    color: var(--text-muted, #6c7086);
  }

  .app-detection {
    padding-top: 4px;
  }

  .app-section {
    margin-bottom: 8px;
  }

  .section-label {
    margin: 0 0 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #6c7086);
  }

  .app-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 0.8125rem;
    color: var(--text-primary, #cdd6f4);
  }

  .app-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted, #6c7086);
    flex-shrink: 0;
  }

  .app-dot.running {
    background: var(--color-success, #22c55e);
  }

  .app-name {
    flex: 1;
    text-transform: capitalize;
  }

  .app-stat {
    font-size: 0.6875rem;
    color: var(--text-muted, #6c7086);
  }

  .app-empty {
    padding: 12px 0;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted, #6c7086);
  }
</style>
