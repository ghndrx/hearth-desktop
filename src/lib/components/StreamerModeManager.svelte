<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';

  // Streamer mode settings store
  interface StreamerModeSettings {
    enabled: boolean;
    autoEnable: boolean;  // Auto-enable when screen sharing detected
    hidePersonalInfo: boolean;
    hideNotifications: boolean;
    hideMessagePreviews: boolean;
    hideInviteLinks: boolean;
    hideEmailAddresses: boolean;
    hideDirectMessages: boolean;
    hideMemberList: boolean;
    hideUsernames: boolean;
    hideServerNames: boolean;
    hideChannelNames: boolean;
    playSound: boolean;
    showIndicator: boolean;
    blurImages: boolean;
    disableSounds: boolean;
    hotkey: string;
  }

  const defaultSettings: StreamerModeSettings = {
    enabled: false,
    autoEnable: true,
    hidePersonalInfo: true,
    hideNotifications: true,
    hideMessagePreviews: true,
    hideInviteLinks: true,
    hideEmailAddresses: true,
    hideDirectMessages: false,
    hideMemberList: false,
    hideUsernames: false,
    hideServerNames: false,
    hideChannelNames: false,
    playSound: true,
    showIndicator: true,
    blurImages: false,
    disableSounds: false,
    hotkey: 'Ctrl+Shift+S'
  };

  export let isOpen = false;
  
  const settings = writable<StreamerModeSettings>(defaultSettings);
  const isEnabled = derived(settings, $s => $s.enabled);
  
  let screenShareDetected = false;
  let screenShareCheckInterval: ReturnType<typeof setInterval>;
  let showQuickToggle = false;
  let justToggled = false;
  
  // Load settings from localStorage
  onMount(() => {
    const saved = localStorage.getItem('hearth-streamer-mode');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        settings.set({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error('Failed to parse streamer mode settings:', e);
      }
    }

    // Start screen share detection
    startScreenShareDetection();
    
    // Listen for hotkey
    window.addEventListener('keydown', handleHotkey);
  });

  onDestroy(() => {
    if (screenShareCheckInterval) {
      clearInterval(screenShareCheckInterval);
    }
    window.removeEventListener('keydown', handleHotkey);
  });

  // Save settings to localStorage
  function saveSettings() {
    settings.subscribe(s => {
      localStorage.setItem('hearth-streamer-mode', JSON.stringify(s));
    })();
  }

  // Toggle streamer mode
  function toggleStreamerMode() {
    settings.update(s => {
      const newEnabled = !s.enabled;
      
      if (s.playSound) {
        playToggleSound(newEnabled);
      }
      
      // Apply body class for global styling
      if (newEnabled) {
        document.body.classList.add('streamer-mode');
      } else {
        document.body.classList.remove('streamer-mode');
      }
      
      // Show quick feedback
      justToggled = true;
      setTimeout(() => justToggled = false, 2000);
      
      return { ...s, enabled: newEnabled };
    });
    saveSettings();
  }

  // Handle hotkey press
  function handleHotkey(e: KeyboardEvent) {
    let $currentSettings: StreamerModeSettings;
    settings.subscribe(s => $currentSettings = s)();
    
    const hotkey = $currentSettings.hotkey;
    const keys = hotkey.split('+');
    
    const ctrlRequired = keys.includes('Ctrl');
    const shiftRequired = keys.includes('Shift');
    const altRequired = keys.includes('Alt');
    const key = keys.filter(k => !['Ctrl', 'Shift', 'Alt'].includes(k))[0];
    
    if (
      e.ctrlKey === ctrlRequired &&
      e.shiftKey === shiftRequired &&
      e.altKey === altRequired &&
      e.key.toUpperCase() === key.toUpperCase()
    ) {
      e.preventDefault();
      toggleStreamerMode();
    }
  }

  // Play toggle sound
  function playToggleSound(enabled: boolean) {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = enabled ? 880 : 440;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.error('Failed to play toggle sound:', e);
    }
  }

  // Start screen share detection
  async function startScreenShareDetection() {
    screenShareCheckInterval = setInterval(async () => {
      try {
        // Check if there's an active screen share through Tauri
        const isSharing = await invoke<boolean>('check_screen_sharing').catch(() => false);
        
        let $currentSettings: StreamerModeSettings;
        settings.subscribe(s => $currentSettings = s)();
        
        if (isSharing && !screenShareDetected && $currentSettings.autoEnable && !$currentSettings.enabled) {
          screenShareDetected = true;
          showQuickToggle = true;
          setTimeout(() => showQuickToggle = false, 5000);
        } else if (!isSharing && screenShareDetected) {
          screenShareDetected = false;
        }
      } catch (e) {
        // Screen share detection not available
      }
    }, 2000);
  }

  // Update a single setting
  function updateSetting(key: keyof StreamerModeSettings, value: boolean | string) {
    settings.update(s => ({ ...s, [key]: value }));
    saveSettings();
  }

  // Reset to defaults
  function resetToDefaults() {
    settings.set(defaultSettings);
    saveSettings();
  }

  // Close panel
  function close() {
    isOpen = false;
  }

  // Handle backdrop click
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  $: currentSettings = $settings;
</script>

<!-- Global CSS injection for streamer mode via dynamic style element -->
<svelte:head>
  {#if $isEnabled}
    {@html `<style id="streamer-mode-styles">
      /* Streamer Mode Global Styles */
      .streamer-mode .sensitive-info,
      .streamer-mode [data-sensitive="true"] {
        filter: blur(8px) !important;
        transition: filter 0.2s;
      }
      
      .streamer-mode .sensitive-info:hover,
      .streamer-mode [data-sensitive="true"]:hover {
        filter: blur(4px) !important;
      }
      
      ${currentSettings.hideDirectMessages ? `.streamer-mode .dm-content { display: none !important; }` : ''}
      ${currentSettings.hideMemberList ? `.streamer-mode .member-list { display: none !important; }` : ''}
      ${currentSettings.hideInviteLinks ? `.streamer-mode .invite-link { filter: blur(10px) !important; }` : ''}
      ${currentSettings.hideEmailAddresses ? `.streamer-mode .email-address { filter: blur(10px) !important; }` : ''}
      ${currentSettings.blurImages ? `.streamer-mode .user-avatar img, .streamer-mode .message-attachment img { filter: blur(15px) !important; }` : ''}
    </style>`}
  {/if}
</svelte:head>

<!-- Streamer Mode Indicator -->
{#if $isEnabled && currentSettings.showIndicator}
  <div class="streamer-indicator" class:just-toggled={justToggled}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
    <span>LIVE</span>
  </div>
{/if}

<!-- Quick Toggle Prompt (when screen share detected) -->
{#if showQuickToggle && !$isEnabled}
  <div class="quick-toggle-prompt">
    <div class="prompt-content">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <span>Screen sharing detected. Enable Streamer Mode?</span>
      <button class="enable-btn" on:click={toggleStreamerMode}>Enable</button>
      <button class="dismiss-btn" on:click={() => showQuickToggle = false}>×</button>
    </div>
  </div>
{/if}

<!-- Settings Panel -->
{#if isOpen}
  <div class="streamer-mode-overlay" on:click={handleBackdropClick}>
    <div class="streamer-mode-panel">
      <div class="panel-header">
        <div class="header-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
          </svg>
          <h2>Streamer Mode</h2>
        </div>
        <button class="close-btn" on:click={close}>×</button>
      </div>

      <div class="panel-content">
        <!-- Main Toggle -->
        <div class="main-toggle">
          <div class="toggle-info">
            <h3>Enable Streamer Mode</h3>
            <p>Hide sensitive information while streaming or screen sharing</p>
          </div>
          <label class="switch">
            <input type="checkbox" checked={currentSettings.enabled} on:change={() => toggleStreamerMode()}/>
            <span class="slider"></span>
          </label>
        </div>

        <div class="settings-section">
          <h4>Automation</h4>
          
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Auto-enable when screen sharing</span>
              <span class="setting-desc">Automatically turn on when screen share is detected</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.autoEnable} 
                on:change={(e) => updateSetting('autoEnable', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Keyboard Shortcut</span>
              <span class="setting-desc">Quick toggle hotkey</span>
            </div>
            <kbd class="hotkey-display">{currentSettings.hotkey}</kbd>
          </div>
        </div>

        <div class="settings-section">
          <h4>Privacy Options</h4>
          
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide personal information</span>
              <span class="setting-desc">Blur usernames and identifying info</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hidePersonalInfo}
                on:change={(e) => updateSetting('hidePersonalInfo', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide notifications</span>
              <span class="setting-desc">Suppress desktop notifications</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideNotifications}
                on:change={(e) => updateSetting('hideNotifications', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide message previews</span>
              <span class="setting-desc">Don't show message content in notifications</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideMessagePreviews}
                on:change={(e) => updateSetting('hideMessagePreviews', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide invite links</span>
              <span class="setting-desc">Blur server invite links</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideInviteLinks}
                on:change={(e) => updateSetting('hideInviteLinks', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide email addresses</span>
              <span class="setting-desc">Blur any visible email addresses</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideEmailAddresses}
                on:change={(e) => updateSetting('hideEmailAddresses', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide direct messages</span>
              <span class="setting-desc">Hide DM conversations from view</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideDirectMessages}
                on:change={(e) => updateSetting('hideDirectMessages', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Hide member list</span>
              <span class="setting-desc">Hide the server member sidebar</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.hideMemberList}
                on:change={(e) => updateSetting('hideMemberList', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Blur images</span>
              <span class="setting-desc">Blur avatars and attachments</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.blurImages}
                on:change={(e) => updateSetting('blurImages', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h4>Feedback</h4>
          
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Play toggle sound</span>
              <span class="setting-desc">Audio feedback when toggling</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.playSound}
                on:change={(e) => updateSetting('playSound', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Show indicator</span>
              <span class="setting-desc">Display LIVE badge when active</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.showIndicator}
                on:change={(e) => updateSetting('showIndicator', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Disable sounds</span>
              <span class="setting-desc">Mute all app sounds while streaming</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={currentSettings.disableSounds}
                on:change={(e) => updateSetting('disableSounds', e.currentTarget.checked)}/>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="panel-footer">
          <button class="reset-btn" on:click={resetToDefaults}>Reset to Defaults</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Streamer Indicator */
  .streamer-indicator {
    position: fixed;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #eb4034, #ff6b5b);
    color: white;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    z-index: 10000;
    box-shadow: 0 2px 12px rgba(235, 64, 52, 0.4);
    animation: pulse-glow 2s infinite;
  }

  .streamer-indicator.just-toggled {
    animation: pop-in 0.3s ease-out;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 2px 12px rgba(235, 64, 52, 0.4); }
    50% { box-shadow: 0 2px 20px rgba(235, 64, 52, 0.6); }
  }

  @keyframes pop-in {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Quick Toggle Prompt */
  .quick-toggle-prompt {
    position: fixed;
    top: 60px;
    right: 12px;
    z-index: 9999;
    animation: slide-in 0.3s ease-out;
  }

  @keyframes slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .prompt-content {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    color: var(--text-primary, #dcddde);
    font-size: 13px;
  }

  .enable-btn {
    padding: 6px 12px;
    background: #5865f2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .enable-btn:hover {
    background: #4752c4;
  }

  .dismiss-btn {
    padding: 4px 8px;
    background: transparent;
    color: var(--text-muted, #72767d);
    border: none;
    font-size: 16px;
    cursor: pointer;
  }

  /* Settings Panel Overlay */
  .streamer-mode-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    animation: fade-in 0.2s ease-out;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .streamer-mode-panel {
    width: 480px;
    max-height: 80vh;
    background: var(--bg-primary, #36393f);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    animation: scale-in 0.2s ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #40444b);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-primary, #fff);
  }

  .header-title svg {
    color: #eb4034;
  }

  .header-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    font-size: 20px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #2f3136);
    color: var(--text-primary, #fff);
  }

  .panel-content {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  /* Main Toggle */
  .main-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .toggle-info h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .toggle-info p {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  /* Settings Section */
  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #72767d);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-color, #40444b);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: 14px;
    color: var(--text-primary, #dcddde);
  }

  .setting-desc {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .hotkey-display {
    padding: 4px 8px;
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary, #dcddde);
  }

  /* Toggle Switch */
  .switch {
    position: relative;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary, #202225);
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #5865f2;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* Footer */
  .panel-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #40444b);
    display: flex;
    justify-content: flex-end;
  }

  .reset-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-color, #40444b);
    border-radius: 4px;
    color: var(--text-muted, #72767d);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    background: var(--bg-secondary, #2f3136);
    color: var(--text-primary, #dcddde);
  }
</style>
