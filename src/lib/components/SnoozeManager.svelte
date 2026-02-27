<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived } from 'svelte/store';
  
  // Snooze duration presets matching Rust enum
  type SnoozeDuration = 
    | 'fifteen_minutes'
    | 'thirty_minutes'
    | 'one_hour'
    | 'two_hours'
    | 'four_hours'
    | 'until_tomorrow'
    | { custom: number };
  
  interface SnoozeStatus {
    active: boolean;
    until_timestamp: number | null;
    until_formatted: string | null;
    label: string | null;
    remaining_minutes: number | null;
  }
  
  // Props
  export let showLabel = true;
  export let compact = false;
  
  // Stores
  const snoozeStatus = writable<SnoozeStatus>({
    active: false,
    until_timestamp: null,
    until_formatted: null,
    label: null,
    remaining_minutes: null,
  });
  
  const isSnoozeActive = derived(snoozeStatus, $status => $status.active);
  const remainingText = derived(snoozeStatus, $status => {
    if (!$status.active || $status.remaining_minutes === null) return null;
    const mins = $status.remaining_minutes;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remaining = mins % 60;
      return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
    }
    return mins > 0 ? `${mins}m` : '< 1m';
  });
  
  // State
  let showDropdown = false;
  let unlistenStarted: UnlistenFn | null = null;
  let unlistenEnded: UnlistenFn | null = null;
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  
  // Preset options
  const presets: { label: string; value: SnoozeDuration; icon: string }[] = [
    { label: '15 minutes', value: 'fifteen_minutes', icon: '⏱️' },
    { label: '30 minutes', value: 'thirty_minutes', icon: '⏱️' },
    { label: '1 hour', value: 'one_hour', icon: '🕐' },
    { label: '2 hours', value: 'two_hours', icon: '🕑' },
    { label: '4 hours', value: 'four_hours', icon: '🕓' },
    { label: 'Until tomorrow', value: 'until_tomorrow', icon: '🌙' },
  ];
  
  async function loadStatus() {
    try {
      const status = await invoke<SnoozeStatus>('get_notification_snooze_status');
      snoozeStatus.set(status);
    } catch (err) {
      console.error('Failed to load snooze status:', err);
    }
  }
  
  async function startSnooze(duration: SnoozeDuration) {
    try {
      const status = await invoke<SnoozeStatus>('snooze_notifications', { duration });
      snoozeStatus.set(status);
      showDropdown = false;
    } catch (err) {
      console.error('Failed to snooze:', err);
    }
  }
  
  async function startCustomSnooze(minutes: number) {
    try {
      const status = await invoke<SnoozeStatus>('snooze_notifications_custom', { minutes });
      snoozeStatus.set(status);
      showDropdown = false;
    } catch (err) {
      console.error('Failed to snooze:', err);
    }
  }
  
  async function endSnooze() {
    try {
      const status = await invoke<SnoozeStatus>('unsnooze_notifications');
      snoozeStatus.set(status);
    } catch (err) {
      console.error('Failed to unsnooze:', err);
    }
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.snooze-manager')) {
      showDropdown = false;
    }
  }
  
  onMount(async () => {
    await loadStatus();
    
    // Listen for snooze events from tray menu
    unlistenStarted = await listen<SnoozeStatus>('snooze-started', (event) => {
      snoozeStatus.set(event.payload);
    });
    
    unlistenEnded = await listen<SnoozeStatus>('snooze-ended', (event) => {
      snoozeStatus.set(event.payload);
    });
    
    // Refresh status every minute to update remaining time
    refreshInterval = setInterval(loadStatus, 60000);
    
    // Click outside handler
    document.addEventListener('click', handleClickOutside);
  });
  
  onDestroy(() => {
    unlistenStarted?.();
    unlistenEnded?.();
    if (refreshInterval) clearInterval(refreshInterval);
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="snooze-manager" class:compact>
  {#if $isSnoozeActive}
    <!-- Active snooze indicator -->
    <button
      class="snooze-active"
      on:click={endSnooze}
      title="Click to end snooze"
      aria-label="Notifications snoozed. Click to end snooze."
    >
      <span class="snooze-icon">⏸️</span>
      {#if showLabel}
        <span class="snooze-label">
          {#if $remainingText}
            Snoozed ({$remainingText})
          {:else}
            Snoozed
          {/if}
        </span>
      {/if}
    </button>
  {:else}
    <!-- Snooze button with dropdown -->
    <div class="snooze-button-container">
      <button
        class="snooze-button"
        on:click={() => showDropdown = !showDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        title="Snooze notifications"
      >
        <span class="snooze-icon">🔕</span>
        {#if showLabel && !compact}
          <span class="snooze-label">Snooze</span>
        {/if}
        <span class="dropdown-arrow">▼</span>
      </button>
      
      {#if showDropdown}
        <div class="snooze-dropdown" role="menu">
          <div class="dropdown-header">Snooze for...</div>
          {#each presets as preset}
            <button
              class="dropdown-item"
              role="menuitem"
              on:click={() => startSnooze(preset.value)}
            >
              <span class="item-icon">{preset.icon}</span>
              <span class="item-label">{preset.label}</span>
            </button>
          {/each}
          
          <div class="dropdown-divider" role="separator"></div>
          
          <div class="custom-snooze">
            <input
              type="number"
              min="1"
              max="1440"
              placeholder="Custom (min)"
              class="custom-input"
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  const minutes = parseInt(input.value);
                  if (minutes > 0) startCustomSnooze(minutes);
                }
              }}
            />
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .snooze-manager {
    position: relative;
    display: inline-flex;
    font-family: var(--font-family, system-ui, sans-serif);
  }
  
  .snooze-button,
  .snooze-active {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
  }
  
  .snooze-button {
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-secondary, #b5bac1);
  }
  
  .snooze-button:hover {
    background: var(--bg-hover, #35373c);
    color: var(--text-primary, #f2f3f5);
  }
  
  .snooze-active {
    background: var(--accent-warning, #f0b132);
    color: var(--text-on-accent, #000);
  }
  
  .snooze-active:hover {
    background: var(--accent-warning-hover, #d99d28);
  }
  
  .snooze-icon {
    font-size: 14px;
  }
  
  .dropdown-arrow {
    font-size: 8px;
    opacity: 0.7;
    margin-left: 2px;
  }
  
  .snooze-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    min-width: 180px;
    background: var(--bg-floating, #111214);
    border-radius: 8px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
    z-index: 1000;
    overflow: hidden;
  }
  
  .dropdown-header {
    padding: 10px 12px 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary, #f2f3f5);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
  }
  
  .dropdown-item:hover {
    background: var(--bg-hover, rgba(79, 84, 92, 0.4));
  }
  
  .item-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
  }
  
  .dropdown-divider {
    height: 1px;
    margin: 4px 0;
    background: var(--border-subtle, #3f4147);
  }
  
  .custom-snooze {
    padding: 8px 12px;
  }
  
  .custom-input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-subtle, #3f4147);
    border-radius: 4px;
    background: var(--bg-input, #1e1f22);
    color: var(--text-primary, #f2f3f5);
    font-size: 13px;
  }
  
  .custom-input:focus {
    outline: none;
    border-color: var(--accent-primary, #5865f2);
  }
  
  .custom-input::placeholder {
    color: var(--text-muted, #949ba4);
  }
  
  /* Compact mode */
  .compact .snooze-button,
  .compact .snooze-active {
    padding: 4px 8px;
    font-size: 12px;
  }
  
  .compact .snooze-icon {
    font-size: 12px;
  }
</style>
