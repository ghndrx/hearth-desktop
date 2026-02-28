<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { writable, derived, type Writable } from 'svelte/store';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let isOpen = false;
  export let anchorElement: HTMLElement | null = null;
  
  // Quick settings state
  const settings: Writable<{
    doNotDisturb: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    darkMode: boolean;
    compactMode: boolean;
    autoAway: boolean;
    streamerMode: boolean;
  }> = writable({
    doNotDisturb: false,
    soundEnabled: true,
    notificationsEnabled: true,
    darkMode: true,
    compactMode: false,
    autoAway: true,
    streamerMode: false
  });
  
  // Volume control
  let volume = 80;
  let micMuted = false;
  let speakerMuted = false;
  
  // Position tracking
  let dropdownEl: HTMLElement;
  let position = { top: 0, left: 0 };
  
  // Load saved settings on mount
  onMount(async () => {
    try {
      const saved = localStorage.getItem('hearth-quick-settings');
      if (saved) {
        settings.set({ ...$settings, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.warn('Failed to load quick settings:', e);
    }
    
    // Position dropdown relative to anchor
    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('click', handleClickOutside);
  });
  
  onDestroy(() => {
    window.removeEventListener('resize', updatePosition);
    document.removeEventListener('click', handleClickOutside);
  });
  
  function updatePosition() {
    if (!anchorElement || !isOpen) return;
    
    const rect = anchorElement.getBoundingClientRect();
    position = {
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 320)
    };
  }
  
  function handleClickOutside(e: MouseEvent) {
    if (dropdownEl && !dropdownEl.contains(e.target as Node) && 
        anchorElement && !anchorElement.contains(e.target as Node)) {
      close();
    }
  }
  
  function close() {
    isOpen = false;
    dispatch('close');
  }
  
  function toggleSetting(key: keyof typeof $settings) {
    settings.update(s => {
      const updated = { ...s, [key]: !s[key] };
      localStorage.setItem('hearth-quick-settings', JSON.stringify(updated));
      dispatch('change', { key, value: updated[key] });
      return updated;
    });
  }
  
  function handleVolumeChange(e: Event) {
    volume = parseInt((e.target as HTMLInputElement).value);
    dispatch('volumeChange', { volume });
  }
  
  function toggleMic() {
    micMuted = !micMuted;
    dispatch('micToggle', { muted: micMuted });
  }
  
  function toggleSpeaker() {
    speakerMuted = !speakerMuted;
    dispatch('speakerToggle', { muted: speakerMuted });
  }
  
  function openFullSettings() {
    dispatch('openSettings');
    close();
  }
  
  // Reactive position update
  $: if (isOpen && anchorElement) {
    updatePosition();
  }
  
  // Setting groups for organization
  const settingGroups = [
    {
      title: 'Status',
      items: [
        { key: 'doNotDisturb', label: 'Do Not Disturb', icon: '🔕', description: 'Pause all notifications' },
        { key: 'autoAway', label: 'Auto Away', icon: '⏰', description: 'Set away when idle' },
        { key: 'streamerMode', label: 'Streamer Mode', icon: '📺', description: 'Hide sensitive info' }
      ]
    },
    {
      title: 'Audio & Notifications',
      items: [
        { key: 'soundEnabled', label: 'Sounds', icon: '🔊', description: 'Play notification sounds' },
        { key: 'notificationsEnabled', label: 'Notifications', icon: '🔔', description: 'Show desktop alerts' }
      ]
    },
    {
      title: 'Appearance',
      items: [
        { key: 'darkMode', label: 'Dark Mode', icon: '🌙', description: 'Use dark theme' },
        { key: 'compactMode', label: 'Compact Mode', icon: '📐', description: 'Reduce spacing' }
      ]
    }
  ] as const;
</script>

{#if isOpen}
  <div
    bind:this={dropdownEl}
    class="quick-settings-dropdown"
    style="top: {position.top}px; left: {position.left}px;"
    transition:fly={{ y: -10, duration: 200 }}
    role="dialog"
    aria-label="Quick Settings"
  >
    <header class="dropdown-header">
      <h3>Quick Settings</h3>
      <button class="close-btn" on:click={close} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </header>
    
    <!-- Volume Control -->
    <section class="volume-section">
      <div class="volume-header">
        <span class="volume-label">Volume</span>
        <span class="volume-value">{volume}%</span>
      </div>
      <div class="volume-controls">
        <button 
          class="audio-btn" 
          class:muted={speakerMuted}
          on:click={toggleSpeaker}
          aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
        >
          {speakerMuted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          on:input={handleVolumeChange}
          class="volume-slider"
          aria-label="Volume"
        />
        <button 
          class="audio-btn" 
          class:muted={micMuted}
          on:click={toggleMic}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {micMuted ? '🎤' : '🎙️'}
        </button>
      </div>
    </section>
    
    <div class="divider" />
    
    <!-- Settings Groups -->
    {#each settingGroups as group}
      <section class="settings-group">
        <h4 class="group-title">{group.title}</h4>
        {#each group.items as item}
          <button
            class="setting-item"
            class:active={$settings[item.key]}
            on:click={() => toggleSetting(item.key)}
            aria-pressed={$settings[item.key]}
          >
            <span class="setting-icon">{item.icon}</span>
            <div class="setting-info">
              <span class="setting-label">{item.label}</span>
              <span class="setting-description">{item.description}</span>
            </div>
            <div class="toggle" class:on={$settings[item.key]}>
              <div class="toggle-knob" />
            </div>
          </button>
        {/each}
      </section>
    {/each}
    
    <div class="divider" />
    
    <!-- Footer -->
    <footer class="dropdown-footer">
      <button class="full-settings-btn" on:click={openFullSettings}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
        All Settings
      </button>
    </footer>
  </div>
  
  <!-- Backdrop for mobile -->
  <div class="backdrop" on:click={close} transition:fade={{ duration: 150 }} />
{/if}

<style>
  .quick-settings-dropdown {
    position: fixed;
    z-index: 9999;
    width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--border-color, #202225);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: transparent;
  }
  
  @media (max-width: 640px) {
    .backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
    
    .quick-settings-dropdown {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto !important;
      width: 100%;
      max-height: 70vh;
      border-radius: 16px 16px 0 0;
    }
  }
  
  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #202225);
  }
  
  .dropdown-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .close-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-primary, #fff);
  }
  
  .volume-section {
    padding: 12px 16px;
  }
  
  .volume-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .volume-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted, #72767d);
    text-transform: uppercase;
  }
  
  .volume-value {
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
  }
  
  .volume-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .audio-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    font-size: 18px;
    border-radius: 4px;
    opacity: 0.8;
    transition: opacity 0.15s;
  }
  
  .audio-btn:hover {
    opacity: 1;
  }
  
  .audio-btn.muted {
    opacity: 0.5;
  }
  
  .volume-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bg-tertiary, #202225);
    border-radius: 2px;
    outline: none;
  }
  
  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--brand-color, #5865f2);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s;
  }
  
  .volume-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
  
  .divider {
    height: 1px;
    background: var(--border-color, #202225);
    margin: 4px 0;
  }
  
  .settings-group {
    padding: 8px 0;
  }
  
  .group-title {
    padding: 4px 16px 8px;
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #72767d);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  .setting-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  
  .setting-item:hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
  }
  
  .setting-item.active {
    background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.6));
  }
  
  .setting-icon {
    font-size: 18px;
    margin-right: 12px;
    width: 24px;
    text-align: center;
  }
  
  .setting-info {
    flex: 1;
    min-width: 0;
  }
  
  .setting-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }
  
  .setting-description {
    display: block;
    font-size: 12px;
    color: var(--text-muted, #72767d);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .toggle {
    width: 40px;
    height: 22px;
    background: var(--bg-tertiary, #202225);
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
    margin-left: 8px;
  }
  
  .toggle.on {
    background: var(--brand-color, #5865f2);
  }
  
  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle.on .toggle-knob {
    transform: translateX(18px);
  }
  
  .dropdown-footer {
    padding: 8px;
    border-top: 1px solid var(--border-color, #202225);
  }
  
  .full-settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .full-settings-btn:hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.6));
  }
  
  .full-settings-btn svg {
    opacity: 0.8;
  }
</style>
