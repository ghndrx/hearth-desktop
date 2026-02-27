<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  
  // Network quality levels
  type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  
  interface NetworkStats {
    latency: number;
    jitter: number;
    packetLoss: number;
    downloadSpeed: number;
    uploadSpeed: number;
    connectionType: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    online: boolean;
    timestamp: number;
  }
  
  interface QualityThresholds {
    excellent: { latency: number; jitter: number; packetLoss: number };
    good: { latency: number; jitter: number; packetLoss: number };
    fair: { latency: number; jitter: number; packetLoss: number };
  }
  
  // Props
  export let showDetails = false;
  export let pingInterval = 5000;
  export let pingEndpoint = 'https://www.google.com/generate_204';
  export let compact = false;
  export let onQualityChange: ((quality: QualityLevel) => void) | undefined = undefined;
  
  // Quality thresholds
  const thresholds: QualityThresholds = {
    excellent: { latency: 50, jitter: 10, packetLoss: 0 },
    good: { latency: 100, jitter: 30, packetLoss: 1 },
    fair: { latency: 200, jitter: 50, packetLoss: 3 }
  };
  
  // Stores
  const networkStats = writable<NetworkStats>({
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    online: navigator.onLine,
    timestamp: Date.now()
  });
  
  const latencyHistory = writable<number[]>([]);
  const packetLossHistory = writable<number[]>([]);
  
  // Derived quality level
  const qualityLevel = derived(networkStats, ($stats): QualityLevel => {
    if (!$stats.online) return 'offline';
    
    const { latency, jitter, packetLoss } = $stats;
    
    if (latency <= thresholds.excellent.latency && 
        jitter <= thresholds.excellent.jitter && 
        packetLoss <= thresholds.excellent.packetLoss) {
      return 'excellent';
    }
    
    if (latency <= thresholds.good.latency && 
        jitter <= thresholds.good.jitter && 
        packetLoss <= thresholds.good.packetLoss) {
      return 'good';
    }
    
    if (latency <= thresholds.fair.latency && 
        jitter <= thresholds.fair.jitter && 
        packetLoss <= thresholds.fair.packetLoss) {
      return 'fair';
    }
    
    return 'poor';
  });
  
  // Quality colors and icons
  const qualityConfig: Record<QualityLevel, { color: string; icon: string; label: string }> = {
    excellent: { color: '#22c55e', icon: '●●●●', label: 'Excellent' },
    good: { color: '#84cc16', icon: '●●●○', label: 'Good' },
    fair: { color: '#eab308', icon: '●●○○', label: 'Fair' },
    poor: { color: '#ef4444', icon: '●○○○', label: 'Poor' },
    offline: { color: '#6b7280', icon: '○○○○', label: 'Offline' }
  };
  
  let pingIntervalId: ReturnType<typeof setInterval>;
  let consecutiveFailures = 0;
  let isExpanded = false;
  let lastQuality: QualityLevel | null = null;
  
  // Measure latency with a ping
  async function measureLatency(): Promise<number | null> {
    const start = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(pingEndpoint, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      consecutiveFailures = 0;
      return Math.round(performance.now() - start);
    } catch {
      consecutiveFailures++;
      return null;
    }
  }
  
  // Calculate jitter from latency history
  function calculateJitter(history: number[]): number {
    if (history.length < 2) return 0;
    
    let totalDiff = 0;
    for (let i = 1; i < history.length; i++) {
      totalDiff += Math.abs(history[i] - history[i - 1]);
    }
    
    return Math.round(totalDiff / (history.length - 1));
  }
  
  // Get Network Information API data
  function getNetworkInfo(): Partial<NetworkStats> {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0
      };
    }
    
    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };
  }
  
  // Update network stats
  async function updateNetworkStats() {
    const latency = await measureLatency();
    const networkInfo = getNetworkInfo();
    
    latencyHistory.update(history => {
      const newHistory = [...history, latency ?? 9999];
      return newHistory.slice(-20); // Keep last 20 measurements
    });
    
    packetLossHistory.update(history => {
      const newHistory = [...history, latency === null ? 1 : 0];
      return newHistory.slice(-20);
    });
    
    networkStats.update(stats => {
      const currentLatencyHistory = $latencyHistory;
      const currentPacketLossHistory = $packetLossHistory;
      
      const validLatencies = currentLatencyHistory.filter(l => l < 9999);
      const avgLatency = validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : 0;
      
      const packetLoss = currentPacketLossHistory.length > 0
        ? Math.round((currentPacketLossHistory.filter(p => p === 1).length / currentPacketLossHistory.length) * 100)
        : 0;
      
      return {
        ...stats,
        ...networkInfo,
        latency: latency ?? stats.latency,
        jitter: calculateJitter(validLatencies),
        packetLoss,
        online: navigator.onLine && consecutiveFailures < 3,
        timestamp: Date.now()
      };
    });
  }
  
  // Handle online/offline events
  function handleOnline() {
    networkStats.update(stats => ({ ...stats, online: true }));
    consecutiveFailures = 0;
    updateNetworkStats();
  }
  
  function handleOffline() {
    networkStats.update(stats => ({ ...stats, online: false }));
  }
  
  // Watch for quality changes
  $: if ($qualityLevel !== lastQuality) {
    lastQuality = $qualityLevel;
    onQualityChange?.($qualityLevel);
  }
  
  // Format speed
  function formatSpeed(mbps: number): string {
    if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
    return `${(mbps * 1000).toFixed(0)} Kbps`;
  }
  
  onMount(() => {
    updateNetworkStats();
    pingIntervalId = setInterval(updateNetworkStats, pingInterval);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for Network Information API changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStats);
    }
  });
  
  onDestroy(() => {
    if (pingIntervalId) clearInterval(pingIntervalId);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    const connection = (navigator as any).connection;
    if (connection) {
      connection.removeEventListener('change', updateNetworkStats);
    }
  });
</script>

<div 
  class="network-quality-indicator" 
  class:compact
  class:expanded={isExpanded && showDetails}
  role="status"
  aria-label="Network quality: {qualityConfig[$qualityLevel].label}"
>
  <button 
    class="quality-badge"
    style="--quality-color: {qualityConfig[$qualityLevel].color}"
    on:click={() => showDetails && (isExpanded = !isExpanded)}
    disabled={!showDetails}
    aria-expanded={isExpanded}
    title="Network Quality: {qualityConfig[$qualityLevel].label}"
  >
    <span class="signal-bars" aria-hidden="true">
      {qualityConfig[$qualityLevel].icon}
    </span>
    
    {#if !compact}
      <span class="quality-label">
        {qualityConfig[$qualityLevel].label}
      </span>
      
      {#if $networkStats.latency > 0}
        <span class="latency-value">
          {$networkStats.latency}ms
        </span>
      {/if}
    {/if}
  </button>
  
  {#if isExpanded && showDetails}
    <div class="details-panel">
      <div class="stat-row">
        <span class="stat-label">Latency</span>
        <span class="stat-value">{$networkStats.latency}ms</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Jitter</span>
        <span class="stat-value">{$networkStats.jitter}ms</span>
      </div>
      
      <div class="stat-row">
        <span class="stat-label">Packet Loss</span>
        <span class="stat-value" class:warning={$networkStats.packetLoss > 0}>
          {$networkStats.packetLoss}%
        </span>
      </div>
      
      {#if $networkStats.effectiveType !== 'unknown'}
        <div class="stat-row">
          <span class="stat-label">Connection</span>
          <span class="stat-value">{$networkStats.effectiveType.toUpperCase()}</span>
        </div>
      {/if}
      
      {#if $networkStats.downlink > 0}
        <div class="stat-row">
          <span class="stat-label">Bandwidth</span>
          <span class="stat-value">{formatSpeed($networkStats.downlink)}</span>
        </div>
      {/if}
      
      <div class="latency-graph" aria-hidden="true">
        <div class="graph-bars">
          {#each $latencyHistory.slice(-10) as latency, i}
            <div 
              class="graph-bar"
              style="height: {Math.min(100, (latency / 300) * 100)}%; opacity: {0.4 + (i / 10) * 0.6}"
              class:high={latency > 200}
              class:failed={latency >= 9999}
            />
          {/each}
        </div>
        <span class="graph-label">Last 10 pings</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .network-quality-indicator {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .quality-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: none;
    border-radius: 12px;
    background: var(--quality-color, #6b7280);
    background: linear-gradient(135deg, var(--quality-color) 0%, color-mix(in srgb, var(--quality-color) 80%, black) 100%);
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  
  .quality-badge:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
  
  .quality-badge:disabled {
    cursor: default;
  }
  
  .compact .quality-badge {
    padding: 2px 6px;
    font-size: 10px;
    gap: 3px;
  }
  
  .signal-bars {
    font-size: 8px;
    letter-spacing: 1px;
  }
  
  .compact .signal-bars {
    font-size: 6px;
    letter-spacing: 0.5px;
  }
  
  .quality-label {
    font-weight: 600;
  }
  
  .latency-value {
    opacity: 0.9;
    font-size: 11px;
    padding-left: 4px;
    border-left: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .details-panel {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    padding: 12px;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 180px;
    z-index: 1000;
    animation: slideIn 0.15s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    color: #e5e7eb;
    font-size: 12px;
  }
  
  .stat-row:not(:last-of-type) {
    border-bottom: 1px solid #374151;
  }
  
  .stat-label {
    color: #9ca3af;
  }
  
  .stat-value {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  
  .stat-value.warning {
    color: #fbbf24;
  }
  
  .latency-graph {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #374151;
  }
  
  .graph-bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 40px;
  }
  
  .graph-bar {
    flex: 1;
    min-height: 2px;
    background: #22c55e;
    border-radius: 2px 2px 0 0;
    transition: height 0.2s ease;
  }
  
  .graph-bar.high {
    background: #eab308;
  }
  
  .graph-bar.failed {
    background: #ef4444;
    height: 100% !important;
  }
  
  .graph-label {
    display: block;
    text-align: center;
    font-size: 10px;
    color: #6b7280;
    margin-top: 4px;
  }
</style>
