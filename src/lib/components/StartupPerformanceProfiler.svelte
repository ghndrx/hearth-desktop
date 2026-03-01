<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived } from 'svelte/store';

  // Props
  export let showOnStartup: boolean = true;
  export let autoHideDelay: number = 5000;
  export let enableDetailedMetrics: boolean = true;

  // Types
  interface PerformanceMetric {
    name: string;
    duration: number;
    startTime: number;
    category: 'core' | 'ui' | 'network' | 'plugins';
    status: 'pending' | 'completed' | 'failed';
  }

  interface StartupProfile {
    totalDuration: number;
    metrics: PerformanceMetric[];
    timestamp: Date;
    appVersion: string;
  }

  // State
  const metrics = writable<PerformanceMetric[]>([]);
  const isVisible = writable(showOnStartup);
  const isMinimized = writable(false);
  const currentProfile = writable<StartupProfile | null>(null);
  const historicalProfiles = writable<StartupProfile[]>([]);

  // Derived stores
  const totalDuration = derived(metrics, ($metrics) =>
    $metrics.reduce((sum, m) => sum + m.duration, 0)
  );

  const categorizedMetrics = derived(metrics, ($metrics) => {
    const categories: Record<string, PerformanceMetric[]> = {
      core: [],
      ui: [],
      network: [],
      plugins: []
    };
    $metrics.forEach(m => {
      if (categories[m.category]) {
        categories[m.category].push(m);
      }
    });
    return categories;
  });

  const healthScore = derived(metrics, ($metrics) => {
    if ($metrics.length === 0) return 100;
    const totalDur = $metrics.reduce((sum, m) => sum + m.duration, 0);
    const failedCount = $metrics.filter(m => m.status === 'failed').length;
    
    // Score based on duration (under 2s is ideal) and failures
    let score = 100;
    if (totalDur > 2000) score -= Math.min(30, (totalDur - 2000) / 100);
    if (totalDur > 5000) score -= Math.min(30, (totalDur - 5000) / 200);
    score -= failedCount * 10;
    
    return Math.max(0, Math.round(score));
  });

  // Auto-hide timer
  let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

  function startAutoHide() {
    if (autoHideDelay > 0 && showOnStartup) {
      autoHideTimer = setTimeout(() => {
        isVisible.set(false);
      }, autoHideDelay);
    }
  }

  function cancelAutoHide() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  // Metric tracking
  function addMetric(metric: Omit<PerformanceMetric, 'status'>) {
    metrics.update(m => [...m, { ...metric, status: 'pending' }]);
  }

  function completeMetric(name: string, duration?: number) {
    metrics.update(m =>
      m.map(metric =>
        metric.name === name
          ? { ...metric, status: 'completed' as const, duration: duration ?? metric.duration }
          : metric
      )
    );
  }

  function failMetric(name: string) {
    metrics.update(m =>
      m.map(metric =>
        metric.name === name ? { ...metric, status: 'failed' as const } : metric
      )
    );
  }

  // Collect startup metrics from Tauri
  async function collectStartupMetrics() {
    const startTime = performance.now();

    try {
      // Core initialization
      addMetric({
        name: 'Window Creation',
        duration: 0,
        startTime,
        category: 'core'
      });

      const windowStart = performance.now();
      await invoke('get_window_state').catch(() => ({}));
      completeMetric('Window Creation', performance.now() - windowStart);

      // UI initialization
      addMetric({
        name: 'Theme Loading',
        duration: 0,
        startTime: performance.now(),
        category: 'ui'
      });

      const themeStart = performance.now();
      await invoke('get_current_theme').catch(() => 'dark');
      completeMetric('Theme Loading', performance.now() - themeStart);

      // Settings load
      addMetric({
        name: 'Settings Load',
        duration: 0,
        startTime: performance.now(),
        category: 'core'
      });

      const settingsStart = performance.now();
      await invoke('load_settings').catch(() => ({}));
      completeMetric('Settings Load', performance.now() - settingsStart);

      // Network check
      if (enableDetailedMetrics) {
        addMetric({
          name: 'Network Check',
          duration: 0,
          startTime: performance.now(),
          category: 'network'
        });

        const networkStart = performance.now();
        await invoke('check_network_status').catch(() => ({ connected: true }));
        completeMetric('Network Check', performance.now() - networkStart);
      }

      // Plugin initialization
      addMetric({
        name: 'Plugin Discovery',
        duration: 0,
        startTime: performance.now(),
        category: 'plugins'
      });

      const pluginStart = performance.now();
      await invoke('discover_plugins').catch(() => []);
      completeMetric('Plugin Discovery', performance.now() - pluginStart);

      // Session restore
      addMetric({
        name: 'Session Restore',
        duration: 0,
        startTime: performance.now(),
        category: 'core'
      });

      const sessionStart = performance.now();
      await invoke('restore_session').catch(() => null);
      completeMetric('Session Restore', performance.now() - sessionStart);

      // Create profile
      const profile: StartupProfile = {
        totalDuration: performance.now() - startTime,
        metrics: [],
        timestamp: new Date(),
        appVersion: '1.0.0'
      };

      metrics.subscribe(m => {
        profile.metrics = [...m];
      })();

      currentProfile.set(profile);

      // Save to history
      historicalProfiles.update(h => {
        const updated = [profile, ...h].slice(0, 10);
        localStorage.setItem('startupProfiles', JSON.stringify(updated));
        return updated;
      });

    } catch (error) {
      console.error('Failed to collect startup metrics:', error);
    }
  }

  // Load historical profiles
  function loadHistoricalProfiles() {
    try {
      const saved = localStorage.getItem('startupProfiles');
      if (saved) {
        const profiles = JSON.parse(saved);
        historicalProfiles.set(profiles);
      }
    } catch (error) {
      console.error('Failed to load historical profiles:', error);
    }
  }

  // Format duration
  function formatDuration(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  // Get health color
  function getHealthColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  // Get category icon
  function getCategoryIcon(category: string): string {
    switch (category) {
      case 'core': return '⚙️';
      case 'ui': return '🎨';
      case 'network': return '🌐';
      case 'plugins': return '🔌';
      default: return '📊';
    }
  }

  // Toggle visibility
  function toggleVisibility() {
    isVisible.update(v => !v);
    cancelAutoHide();
  }

  function toggleMinimized() {
    isMinimized.update(m => !m);
    cancelAutoHide();
  }

  // Export profile
  async function exportProfile() {
    const $currentProfile = null;
    currentProfile.subscribe(p => {
      if (p) {
        const data = JSON.stringify(p, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `startup-profile-${p.timestamp.toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    })();
  }

  // Clear history
  function clearHistory() {
    historicalProfiles.set([]);
    localStorage.removeItem('startupProfiles');
  }

  onMount(() => {
    loadHistoricalProfiles();
    collectStartupMetrics();
    startAutoHide();
  });

  onDestroy(() => {
    cancelAutoHide();
  });
</script>

{#if $isVisible}
  <div
    class="startup-profiler"
    class:minimized={$isMinimized}
    on:mouseenter={cancelAutoHide}
    role="dialog"
    aria-label="Startup Performance Profiler"
  >
    <div class="profiler-header">
      <div class="header-left">
        <span class="profiler-icon">⚡</span>
        <h3>Startup Performance</h3>
      </div>
      <div class="header-right">
        <button
          class="icon-button"
          on:click={toggleMinimized}
          aria-label={$isMinimized ? 'Expand' : 'Minimize'}
        >
          {$isMinimized ? '⬆️' : '⬇️'}
        </button>
        <button
          class="icon-button"
          on:click={toggleVisibility}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>

    {#if !$isMinimized}
      <div class="profiler-content">
        <!-- Health Score -->
        <div class="health-score">
          <div
            class="score-circle"
            style="--score-color: {getHealthColor($healthScore)}"
          >
            <span class="score-value">{$healthScore}</span>
            <span class="score-label">Health</span>
          </div>
          <div class="score-details">
            <div class="detail-item">
              <span class="detail-label">Total Time</span>
              <span class="detail-value">{formatDuration($totalDuration)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Metrics</span>
              <span class="detail-value">{$metrics.length}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Failed</span>
              <span class="detail-value failed">
                {$metrics.filter(m => m.status === 'failed').length}
              </span>
            </div>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div class="category-breakdown">
          {#each Object.entries($categorizedMetrics) as [category, categoryMetrics]}
            {#if categoryMetrics.length > 0}
              <div class="category-section">
                <div class="category-header">
                  <span class="category-icon">{getCategoryIcon(category)}</span>
                  <span class="category-name">{category}</span>
                  <span class="category-duration">
                    {formatDuration(categoryMetrics.reduce((s, m) => s + m.duration, 0))}
                  </span>
                </div>
                <div class="category-metrics">
                  {#each categoryMetrics as metric}
                    <div class="metric-item" class:failed={metric.status === 'failed'}>
                      <div class="metric-name">{metric.name}</div>
                      <div class="metric-bar">
                        <div
                          class="metric-fill"
                          style="width: {Math.min(100, (metric.duration / $totalDuration) * 100)}%"
                          class:pending={metric.status === 'pending'}
                          class:failed={metric.status === 'failed'}
                        ></div>
                      </div>
                      <div class="metric-duration">
                        {formatDuration(metric.duration)}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Historical Comparison -->
        {#if $historicalProfiles.length > 1}
          <div class="historical-section">
            <h4>Recent Startups</h4>
            <div class="historical-chart">
              {#each $historicalProfiles.slice(0, 5) as profile, index}
                <div
                  class="historical-bar"
                  style="height: {Math.min(100, (profile.totalDuration / 5000) * 100)}%"
                  class:current={index === 0}
                  title="{formatDuration(profile.totalDuration)} - {new Date(profile.timestamp).toLocaleDateString()}"
                ></div>
              {/each}
            </div>
            <div class="historical-labels">
              <span>Latest</span>
              <span>Oldest</span>
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="profiler-actions">
          <button class="action-button" on:click={exportProfile}>
            📥 Export
          </button>
          <button class="action-button" on:click={clearHistory}>
            🗑️ Clear History
          </button>
        </div>
      </div>
    {:else}
      <div class="minimized-summary">
        <span class="mini-score" style="color: {getHealthColor($healthScore)}">
          {$healthScore}
        </span>
        <span class="mini-duration">{formatDuration($totalDuration)}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .startup-profiler {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 360px;
    background: var(--bg-secondary, #1e1e2e);
    border: 1px solid var(--border-color, #313244);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .startup-profiler.minimized {
    width: auto;
    min-width: 150px;
  }

  .profiler-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary, #181825);
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profiler-icon {
    font-size: 18px;
  }

  .profiler-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .header-right {
    display: flex;
    gap: 4px;
  }

  .icon-button {
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    transition: background 0.2s;
  }

  .icon-button:hover {
    background: var(--bg-hover, #313244);
  }

  .profiler-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }

  .health-score {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .score-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 3px solid var(--score-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .score-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--score-color);
  }

  .score-label {
    font-size: 10px;
    color: var(--text-secondary, #a6adc8);
    text-transform: uppercase;
  }

  .score-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-label {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }

  .detail-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .detail-value.failed {
    color: #ef4444;
  }

  .category-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .category-section {
    background: var(--bg-tertiary, #181825);
    border-radius: 8px;
    padding: 10px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .category-icon {
    font-size: 12px;
  }

  .category-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
    text-transform: capitalize;
    flex: 1;
  }

  .category-duration {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .category-metrics {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metric-item {
    display: grid;
    grid-template-columns: 100px 1fr 50px;
    align-items: center;
    gap: 8px;
  }

  .metric-item.failed .metric-name {
    color: #ef4444;
  }

  .metric-name {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metric-bar {
    height: 6px;
    background: var(--bg-primary, #11111b);
    border-radius: 3px;
    overflow: hidden;
  }

  .metric-fill {
    height: 100%;
    background: linear-gradient(90deg, #89b4fa, #74c7ec);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .metric-fill.pending {
    background: #fab387;
    animation: pulse 1s infinite;
  }

  .metric-fill.failed {
    background: #ef4444;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .metric-duration {
    font-size: 10px;
    color: var(--text-secondary, #a6adc8);
    text-align: right;
  }

  .historical-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color, #313244);
  }

  .historical-section h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .historical-chart {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 60px;
    padding: 0 4px;
  }

  .historical-bar {
    flex: 1;
    background: var(--text-secondary, #a6adc8);
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: all 0.2s;
    cursor: help;
  }

  .historical-bar.current {
    background: linear-gradient(180deg, #89b4fa, #74c7ec);
  }

  .historical-bar:hover {
    opacity: 0.8;
  }

  .historical-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 10px;
    color: var(--text-secondary, #a6adc8);
  }

  .profiler-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .action-button {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary, #181825);
    color: var(--text-primary, #cdd6f4);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover {
    background: var(--bg-hover, #313244);
  }

  .minimized-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
  }

  .mini-score {
    font-size: 18px;
    font-weight: 700;
  }

  .mini-duration {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }
</style>
