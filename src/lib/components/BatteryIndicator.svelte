<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable } from 'svelte/store';
  import Tooltip from './Tooltip.svelte';

  interface PowerStatus {
    is_ac_power: boolean;
    is_charging: boolean;
    battery_percentage: number | null;
    time_remaining: string | null;
    is_power_save_mode: boolean;
  }

  // Props
  export let showPercentage = true;
  export let showTooltip = true;
  export let lowBatteryThreshold = 20;
  export let criticalBatteryThreshold = 10;

  // State
  const powerStatus = writable<PowerStatus | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let showLowBatteryWarning = false;
  let warningDismissed = false;

  // Battery fill color based on level and charging state
  $: batteryColor = (() => {
    if (!$powerStatus || $powerStatus.battery_percentage === null) return 'var(--text-muted)';
    if ($powerStatus.is_charging) return 'var(--status-online)';
    if ($powerStatus.battery_percentage <= criticalBatteryThreshold) return 'var(--status-dnd)';
    if ($powerStatus.battery_percentage <= lowBatteryThreshold) return 'var(--status-idle)';
    return 'var(--status-online)';
  })();

  // Battery level for visual fill (0-100)
  $: batteryLevel = $powerStatus?.battery_percentage ?? 0;

  // Tooltip text
  $: tooltipText = (() => {
    if (!$powerStatus) return 'Checking power status...';
    if ($powerStatus.battery_percentage === null) return 'On AC power';
    
    let text = `${$powerStatus.battery_percentage}%`;
    if ($powerStatus.is_charging) {
      text += ' • Charging';
      if ($powerStatus.time_remaining) {
        text += ` (${$powerStatus.time_remaining} until full)`;
      }
    } else if ($powerStatus.time_remaining) {
      text += ` • ${$powerStatus.time_remaining} remaining`;
    }
    return text;
  })();

  // Check for low battery warning
  $: {
    if ($powerStatus && 
        !$powerStatus.is_charging && 
        !$powerStatus.is_ac_power &&
        $powerStatus.battery_percentage !== null &&
        $powerStatus.battery_percentage <= lowBatteryThreshold &&
        !warningDismissed) {
      showLowBatteryWarning = true;
    } else if ($powerStatus?.is_charging || $powerStatus?.is_ac_power) {
      showLowBatteryWarning = false;
      warningDismissed = false;
    }
  }

  async function fetchPowerStatus() {
    try {
      const status = await invoke<PowerStatus>('get_power_status');
      powerStatus.set(status);
    } catch (error) {
      console.error('Failed to fetch power status:', error);
      // If we can't get power status, assume desktop/AC power
      powerStatus.set({
        is_ac_power: true,
        is_charging: false,
        battery_percentage: null,
        time_remaining: null,
        is_power_save_mode: false,
      });
    }
  }

  function dismissWarning() {
    showLowBatteryWarning = false;
    warningDismissed = true;
  }

  onMount(() => {
    fetchPowerStatus();
    // Poll every 60 seconds
    pollInterval = setInterval(fetchPowerStatus, 60000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
</script>

{#if $powerStatus}
  <div class="battery-indicator" class:low={batteryLevel <= lowBatteryThreshold && !$powerStatus.is_charging}>
    {#if showTooltip}
      <Tooltip text={tooltipText}>
        <div class="battery-wrapper">
          {#if $powerStatus.battery_percentage !== null}
            <div class="battery-icon" role="img" aria-label={tooltipText}>
              <div class="battery-body">
                <div 
                  class="battery-fill" 
                  style="width: {batteryLevel}%; background-color: {batteryColor};"
                />
              </div>
              <div class="battery-tip" />
              {#if $powerStatus.is_charging}
                <svg class="charging-bolt" viewBox="0 0 12 16" fill="currentColor">
                  <path d="M7 0L3 7h3l-2 9 7-10H7l2-6z" />
                </svg>
              {/if}
            </div>
            {#if showPercentage}
              <span class="battery-percentage">{batteryLevel}%</span>
            {/if}
          {:else}
            <!-- AC power without battery info (desktop) -->
            <svg class="power-plug" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 0v3H4v3H2v2h2v1a3 3 0 003 3v3h2v-3a3 3 0 003-3V8h2V6h-2V3h-2V0H8v3H6V0z" />
            </svg>
          {/if}
        </div>
      </Tooltip>
    {:else}
      <div class="battery-wrapper">
        {#if $powerStatus.battery_percentage !== null}
          <div class="battery-icon" role="img" aria-label={tooltipText}>
            <div class="battery-body">
              <div 
                class="battery-fill" 
                style="width: {batteryLevel}%; background-color: {batteryColor};"
              />
            </div>
            <div class="battery-tip" />
            {#if $powerStatus.is_charging}
              <svg class="charging-bolt" viewBox="0 0 12 16" fill="currentColor">
                <path d="M7 0L3 7h3l-2 9 7-10H7l2-6z" />
              </svg>
            {/if}
          </div>
          {#if showPercentage}
            <span class="battery-percentage">{batteryLevel}%</span>
          {/if}
        {:else}
          <svg class="power-plug" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 0v3H4v3H2v2h2v1a3 3 0 003 3v3h2v-3a3 3 0 003-3V8h2V6h-2V3h-2V0H8v3H6V0z" />
          </svg>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Low battery warning toast -->
  {#if showLowBatteryWarning}
    <div class="low-battery-warning" role="alert">
      <div class="warning-content">
        <svg class="warning-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="warning-text">
          <strong>Low Battery</strong>
          <p>Battery at {batteryLevel}%. Plug in to continue using Hearth.</p>
        </div>
        <button class="dismiss-button" on:click={dismissWarning} aria-label="Dismiss warning">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .battery-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .battery-indicator.low {
    animation: pulse-warning 2s ease-in-out infinite;
  }

  @keyframes pulse-warning {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .battery-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: default;
  }

  .battery-icon {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .battery-body {
    width: 22px;
    height: 12px;
    border: 2px solid var(--text-muted);
    border-radius: 3px;
    position: relative;
    overflow: hidden;
    background: var(--background-secondary);
  }

  .battery-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
    border-radius: 1px;
  }

  .battery-tip {
    width: 3px;
    height: 6px;
    background: var(--text-muted);
    border-radius: 0 2px 2px 0;
  }

  .charging-bolt {
    position: absolute;
    width: 10px;
    height: 14px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: var(--background-primary);
    filter: drop-shadow(0 0 1px var(--status-online));
    z-index: 1;
  }

  .battery-percentage {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    min-width: 28px;
    text-align: right;
  }

  .power-plug {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }

  /* Low battery warning toast */
  .low-battery-warning {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 9999;
    animation: slide-in 0.3s ease-out;
  }

  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .warning-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: var(--background-floating);
    border: 1px solid var(--status-idle);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    max-width: 320px;
  }

  .warning-icon {
    width: 24px;
    height: 24px;
    color: var(--status-idle);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .warning-text {
    flex: 1;
  }

  .warning-text strong {
    display: block;
    color: var(--text-primary);
    font-size: 14px;
    margin-bottom: 4px;
  }

  .warning-text p {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
    line-height: 1.4;
  }

  .dismiss-button {
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .dismiss-button:hover {
    color: var(--text-primary);
    background: var(--background-modifier-hover);
  }

  .dismiss-button svg {
    width: 14px;
    height: 14px;
  }
</style>
