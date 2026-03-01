<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  // Network quality levels
  type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

  interface NetworkMetrics {
    latency: number;
    jitter: number;
    packetLoss: number;
    downlink: number;
    effectiveType: string;
  }

  // Stores
  export const networkQuality = writable<QualityLevel>('good');
  export const networkMetrics = writable<NetworkMetrics>({
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    downlink: 10,
    effectiveType: '4g'
  });

  // Props
  export let showDetails = false;
  export let compact = false;
  export let pingEndpoint = 'https://api.hearth.chat/ping';

  let isOnline = true;
  let quality: QualityLevel = 'good';
  let metrics: NetworkMetrics = {
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    downlink: 10,
    effectiveType: '4g'
  };
  let measurementInterval: ReturnType<typeof setInterval>;
  let lastLatencies: number[] = [];

  // Quality thresholds
  const QUALITY_THRESHOLDS = {
    excellent: { maxLatency: 50, maxJitter: 10, maxPacketLoss: 0 },
    good: { maxLatency: 100, maxJitter: 30, maxPacketLoss: 1 },
    fair: { maxLatency: 200, maxJitter: 50, maxPacketLoss: 3 },
    poor: { maxLatency: 500, maxJitter: 100, maxPacketLoss: 10 }
  };

  function calculateQuality(m: NetworkMetrics): QualityLevel {
    if (!isOnline) return 'offline';
    
    if (m.latency <= QUALITY_THRESHOLDS.excellent.maxLatency &&
        m.jitter <= QUALITY_THRESHOLDS.excellent.maxJitter &&
        m.packetLoss <= QUALITY_THRESHOLDS.excellent.maxPacketLoss) {
      return 'excellent';
    }
    
    if (m.latency <= QUALITY_THRESHOLDS.good.maxLatency &&
        m.jitter <= QUALITY_THRESHOLDS.good.maxJitter &&
        m.packetLoss <= QUALITY_THRESHOLDS.good.maxPacketLoss) {
      return 'good';
    }
    
    if (m.latency <= QUALITY_THRESHOLDS.fair.maxLatency &&
        m.jitter <= QUALITY_THRESHOLDS.fair.maxJitter &&
        m.packetLoss <= QUALITY_THRESHOLDS.fair.maxPacketLoss) {
      return 'fair';
    }
    
    if (m.latency <= QUALITY_THRESHOLDS.poor.maxLatency) {
      return 'poor';
    }
    
    return 'offline';
  }

  async function measureLatency(): Promise<number | null> {
    const start = performance.now();
    try {
      const response = await fetch(pingEndpoint, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'cors'
      });
      if (response.ok) {
        return Math.round(performance.now() - start);
      }
    } catch {
      // Fall back to image ping
      return new Promise((resolve) => {
        const img = new Image();
        const start = performance.now();
        img.onload = () => resolve(Math.round(performance.now() - start));
        img.onerror = () => resolve(null);
        img.src = `https://www.google.com/favicon.ico?_=${Date.now()}`;
      });
    }
    return null;
  }

  function calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;
    
    let totalVariation = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalVariation += Math.abs(latencies[i] - latencies[i - 1]);
    }
    return Math.round(totalVariation / (latencies.length - 1));
  }

  async function updateMetrics() {
    // Check online status
    isOnline = navigator.onLine;
    
    if (!isOnline) {
      quality = 'offline';
      networkQuality.set(quality);
      return;
    }

    // Measure latency
    const latency = await measureLatency();
    
    if (latency !== null) {
      lastLatencies.push(latency);
      if (lastLatencies.length > 10) {
        lastLatencies.shift();
      }
      
      // Calculate jitter from latency variations
      const jitter = calculateJitter(lastLatencies);
      
      // Get Network Information API data if available
      const connection = (navigator as any).connection;
      const downlink = connection?.downlink ?? 10;
      const effectiveType = connection?.effectiveType ?? '4g';
      
      // Estimate packet loss (simplified - real implementation would use WebRTC stats)
      const packetLoss = latency > 300 ? Math.min(((latency - 300) / 100), 10) : 0;
      
      metrics = {
        latency,
        jitter,
        packetLoss: Math.round(packetLoss * 10) / 10,
        downlink,
        effectiveType
      };
      
      networkMetrics.set(metrics);
    } else {
      // Failed to measure
      metrics.packetLoss = Math.min(metrics.packetLoss + 2, 100);
      networkMetrics.set(metrics);
    }
    
    quality = calculateQuality(metrics);
    networkQuality.set(quality);
  }

  function getQualityColor(q: QualityLevel): string {
    switch (q) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'fair': return '#eab308';
      case 'poor': return '#f97316';
      case 'offline': return '#ef4444';
    }
  }

  function getQualityBars(q: QualityLevel): number {
    switch (q) {
      case 'excellent': return 4;
      case 'good': return 3;
      case 'fair': return 2;
      case 'poor': return 1;
      case 'offline': return 0;
    }
  }

  function getQualityLabel(q: QualityLevel): string {
    switch (q) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
      case 'offline': return 'Offline';
    }
  }

  onMount(() => {
    updateMetrics();
    measurementInterval = setInterval(updateMetrics, 5000);
    
    window.addEventListener('online', updateMetrics);
    window.addEventListener('offline', updateMetrics);
  });

  onDestroy(() => {
    clearInterval(measurementInterval);
    window.removeEventListener('online', updateMetrics);
    window.removeEventListener('offline', updateMetrics);
  });

  $: bars = getQualityBars(quality);
  $: color = getQualityColor(quality);
  $: label = getQualityLabel(quality);
</script>

<div 
  class="network-quality-indicator"
  class:compact
  class:show-details={showDetails}
  title="{label} - {metrics.latency}ms"
>
  <div class="signal-bars">
    {#each [1, 2, 3, 4] as barNum}
      <div 
        class="bar"
        class:active={barNum <= bars}
        style="--bar-color: {color}; --bar-height: {barNum * 25}%"
      ></div>
    {/each}
  </div>
  
  {#if !compact}
    <span class="quality-label" style="color: {color}">{label}</span>
  {/if}
  
  {#if showDetails}
    <div class="metrics-panel">
      <div class="metric">
        <span class="metric-label">Latency</span>
        <span class="metric-value">{metrics.latency}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Jitter</span>
        <span class="metric-value">{metrics.jitter}ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Packet Loss</span>
        <span class="metric-value">{metrics.packetLoss}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">Bandwidth</span>
        <span class="metric-value">{metrics.downlink} Mbps</span>
      </div>
      <div class="metric">
        <span class="metric-label">Connection</span>
        <span class="metric-value">{metrics.effectiveType.toUpperCase()}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .network-quality-indicator {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--bg-secondary, rgba(0, 0, 0, 0.1));
    font-size: 12px;
    position: relative;
    cursor: default;
  }

  .network-quality-indicator.compact {
    padding: 4px;
    gap: 0;
  }

  .signal-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
  }

  .compact .signal-bars {
    height: 12px;
  }

  .bar {
    width: 4px;
    height: var(--bar-height);
    background: var(--bg-tertiary, rgba(0, 0, 0, 0.2));
    border-radius: 1px;
    transition: background-color 0.3s ease;
  }

  .compact .bar {
    width: 3px;
  }

  .bar.active {
    background: var(--bar-color);
  }

  .quality-label {
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metrics-panel {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-floating, #1e1e1e);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 180px;
    z-index: 1000;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .metric:not(:last-child) {
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  }

  .metric-label {
    color: var(--text-muted, #888);
    font-size: 11px;
  }

  .metric-value {
    color: var(--text-primary, #fff);
    font-weight: 500;
    font-family: monospace;
  }

  .show-details:hover .metrics-panel {
    display: block;
  }

  .metrics-panel {
    display: none;
  }

  .show-details:hover .metrics-panel,
  .show-details:focus-within .metrics-panel {
    display: block;
  }
</style>
