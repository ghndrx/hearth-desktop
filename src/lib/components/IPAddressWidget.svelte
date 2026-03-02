<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  interface NetworkInterface {
    name: string;
    ipv4: string | null;
    ipv6: string | null;
    mac: string | null;
  }

  let localIPs = $state<NetworkInterface[]>([]);
  let publicIP = $state<string | null>(null);
  let publicIPv6 = $state<string | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let lastRefresh = $state<Date | null>(null);
  let showDetails = $state(false);
  let copyFeedback = $state<string | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchNetworkInfo() {
    isLoading = true;
    error = null;

    try {
      // Try Tauri backend first
      try {
        const info = await invoke<{
          interfaces: NetworkInterface[];
          public_ip: string | null;
          public_ipv6: string | null;
        }>('get_network_info');
        
        localIPs = info.interfaces;
        publicIP = info.public_ip;
        publicIPv6 = info.public_ipv6;
      } catch {
        // Fallback to browser APIs
        localIPs = [{
          name: 'Primary',
          ipv4: '127.0.0.1',
          ipv6: '::1',
          mac: null
        }];

        // Fetch public IP from external service
        try {
          const response = await fetch('https://api.ipify.org?format=json');
          const data = await response.json();
          publicIP = data.ip;
        } catch {
          publicIP = null;
        }

        try {
          const response = await fetch('https://api64.ipify.org?format=json');
          const data = await response.json();
          if (data.ip && data.ip.includes(':')) {
            publicIPv6 = data.ip;
          }
        } catch {
          publicIPv6 = null;
        }
      }

      lastRefresh = new Date();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch network info';
    } finally {
      isLoading = false;
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = `${label} copied!`;
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    }
  }

  function copyAllAddresses() {
    const addresses: string[] = [];
    
    if (publicIP) addresses.push(`Public IPv4: ${publicIP}`);
    if (publicIPv6) addresses.push(`Public IPv6: ${publicIPv6}`);
    
    localIPs.forEach(iface => {
      if (iface.ipv4) addresses.push(`${iface.name} IPv4: ${iface.ipv4}`);
      if (iface.ipv6) addresses.push(`${iface.name} IPv6: ${iface.ipv6}`);
    });
    
    copyToClipboard(addresses.join('\n'), 'All addresses');
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  onMount(() => {
    fetchNetworkInfo();
    // Auto-refresh every 5 minutes
    refreshInterval = setInterval(fetchNetworkInfo, 5 * 60 * 1000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="ip-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🌐</span>
      <span class="label">IP Address</span>
    </div>
    <div class="actions">
      <button 
        class="action-btn" 
        onclick={fetchNetworkInfo}
        disabled={isLoading}
        title="Refresh"
      >
        <span class:spinning={isLoading}>↻</span>
      </button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {:else if isLoading && !publicIP}
    <div class="loading">Loading network info...</div>
  {:else}
    <div class="content">
      <!-- Public IP Section -->
      <div class="ip-section">
        <div class="section-label">Public</div>
        {#if publicIP}
          <button 
            class="ip-value" 
            onclick={() => copyToClipboard(publicIP!, 'Public IPv4')}
            title="Click to copy"
          >
            <span class="ip-type">v4</span>
            <span class="ip-text">{publicIP}</span>
          </button>
        {:else}
          <span class="ip-unavailable">Unable to detect</span>
        {/if}
        
        {#if publicIPv6 && !compact}
          <button 
            class="ip-value ipv6" 
            onclick={() => copyToClipboard(publicIPv6!, 'Public IPv6')}
            title="Click to copy"
          >
            <span class="ip-type">v6</span>
            <span class="ip-text">{publicIPv6}</span>
          </button>
        {/if}
      </div>

      <!-- Local IP Section -->
      {#if !compact || showDetails}
        <div class="ip-section">
          <div class="section-label">Local</div>
          {#each localIPs.filter(i => i.ipv4 || i.ipv6) as iface}
            <div class="interface">
              <span class="interface-name">{iface.name}</span>
              {#if iface.ipv4}
                <button 
                  class="ip-value" 
                  onclick={() => copyToClipboard(iface.ipv4!, `${iface.name} IPv4`)}
                  title="Click to copy"
                >
                  <span class="ip-type">v4</span>
                  <span class="ip-text">{iface.ipv4}</span>
                </button>
              {/if}
              {#if iface.ipv6 && !compact}
                <button 
                  class="ip-value ipv6" 
                  onclick={() => copyToClipboard(iface.ipv6!, `${iface.name} IPv6`)}
                  title="Click to copy"
                >
                  <span class="ip-type">v6</span>
                  <span class="ip-text">{iface.ipv6}</span>
                </button>
              {/if}
              {#if iface.mac && !compact}
                <div class="mac-address">MAC: {iface.mac}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Copy feedback -->
      {#if copyFeedback}
        <div class="copy-feedback">{copyFeedback}</div>
      {/if}

      <!-- Footer -->
      <div class="widget-footer">
        {#if compact}
          <button class="toggle-details" onclick={() => showDetails = !showDetails}>
            {showDetails ? 'Less' : 'More'}
          </button>
        {/if}
        <button class="copy-all" onclick={copyAllAddresses}>Copy All</button>
        {#if lastRefresh}
          <span class="last-refresh">Updated {formatTime(lastRefresh)}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .ip-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    min-width: 200px;
  }

  .ip-widget.compact {
    padding: 8px;
    min-width: 160px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--text-normal, #dcddde);
  }

  .icon {
    font-size: 16px;
  }

  .actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ip-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .interface {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 8px;
    border-left: 2px solid var(--background-modifier-accent, #4f545c);
  }

  .interface-name {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .ip-value {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--background-tertiary, #202225);
    border: none;
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .ip-value:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.6));
  }

  .ip-value.ipv6 .ip-text {
    font-size: 10px;
    word-break: break-all;
  }

  .ip-type {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    background: var(--brand-experiment, #5865f2);
    color: white;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .ip-text {
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
  }

  .ip-unavailable {
    color: var(--text-muted, #72767d);
    font-style: italic;
    font-size: 12px;
  }

  .mac-address {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    font-family: monospace;
  }

  .copy-feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .widget-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .toggle-details,
  .copy-all {
    font-size: 11px;
    color: var(--text-link, #00aff4);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .toggle-details:hover,
  .copy-all:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .last-refresh {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    margin-left: auto;
  }

  .error {
    color: var(--text-danger, #ed4245);
    font-size: 12px;
    padding: 8px;
    text-align: center;
  }

  .loading {
    color: var(--text-muted, #72767d);
    font-size: 12px;
    padding: 8px;
    text-align: center;
  }
</style>
