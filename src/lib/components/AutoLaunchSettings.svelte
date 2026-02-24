<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
  import { writable } from 'svelte/store';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import Toast from './Toast.svelte';
  
  // Settings state
  let autoLaunchEnabled = false;
  let startMinimized = false;
  let minimizeToTray = true;
  let loading = true;
  let saving = false;
  let error: string | null = null;
  let successMessage: string | null = null;
  
  // Platform detection
  let isTauri = false;
  let platform = 'unknown';
  
  onMount(async () => {
    // Check if running in Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      isTauri = true;
      
      try {
        // Get platform info
        const os = await import('@tauri-apps/plugin-os');
        platform = await os.platform();
        
        // Load current autostart state
        autoLaunchEnabled = await isEnabled();
        
        // Load minimized settings from store
        const settings = await loadSettings();
        startMinimized = settings.startMinimized ?? false;
        minimizeToTray = settings.minimizeToTray ?? true;
      } catch (e) {
        console.error('Failed to load autostart settings:', e);
        error = 'Failed to load startup settings';
      }
    }
    
    loading = false;
  });
  
  async function loadSettings(): Promise<{ startMinimized?: boolean; minimizeToTray?: boolean }> {
    try {
      const Store = (await import('@tauri-apps/plugin-store')).Store;
      const store = await Store.load('settings.json');
      const startMin = await store.get<boolean>('startMinimized');
      const minToTray = await store.get<boolean>('minimizeToTray');
      return {
        startMinimized: startMin ?? false,
        minimizeToTray: minToTray ?? true
      };
    } catch {
      return { startMinimized: false, minimizeToTray: true };
    }
  }
  
  async function saveSettings() {
    try {
      const Store = (await import('@tauri-apps/plugin-store')).Store;
      const store = await Store.load('settings.json');
      await store.set('startMinimized', startMinimized);
      await store.set('minimizeToTray', minimizeToTray);
      await store.save();
    } catch (e) {
      console.error('Failed to save settings:', e);
      throw e;
    }
  }
  
  async function toggleAutoLaunch() {
    if (!isTauri) return;
    
    saving = true;
    error = null;
    successMessage = null;
    
    try {
      if (autoLaunchEnabled) {
        await disable();
        autoLaunchEnabled = false;
        successMessage = 'Hearth will no longer start automatically';
      } else {
        await enable();
        autoLaunchEnabled = true;
        successMessage = 'Hearth will now start when you log in';
      }
    } catch (e) {
      console.error('Failed to toggle autostart:', e);
      error = 'Failed to change startup setting. Please try again.';
      // Revert UI state
      autoLaunchEnabled = !autoLaunchEnabled;
    } finally {
      saving = false;
      setTimeout(() => { successMessage = null; }, 3000);
    }
  }
  
  async function handleMinimizedChange() {
    if (!isTauri) return;
    
    saving = true;
    error = null;
    
    try {
      await saveSettings();
      successMessage = startMinimized 
        ? 'Hearth will start minimized' 
        : 'Hearth will start in normal window';
      setTimeout(() => { successMessage = null; }, 3000);
    } catch (e) {
      error = 'Failed to save setting';
    } finally {
      saving = false;
    }
  }
  
  async function handleTrayChange() {
    if (!isTauri) return;
    
    saving = true;
    error = null;
    
    try {
      await saveSettings();
      
      // Notify main window about tray preference change
      const { emit } = await import('@tauri-apps/api/event');
      await emit('tray-preference-changed', { minimizeToTray });
      
      successMessage = minimizeToTray 
        ? 'Close button will minimize to tray' 
        : 'Close button will quit the app';
      setTimeout(() => { successMessage = null; }, 3000);
    } catch (e) {
      error = 'Failed to save setting';
    } finally {
      saving = false;
    }
  }
  
  function getPlatformLabel(): string {
    switch (platform) {
      case 'darwin':
        return 'Login Items';
      case 'windows':
        return 'Startup Apps';
      case 'linux':
        return 'Autostart';
      default:
        return 'system startup';
    }
  }
</script>

<div class="auto-launch-settings">
  <h3>Startup & System Tray</h3>
  
  {#if loading}
    <div class="loading">
      <LoadingSpinner size="small" />
      <span>Loading settings...</span>
    </div>
  {:else if !isTauri}
    <div class="not-available">
      <p>Startup settings are only available in the desktop app.</p>
    </div>
  {:else}
    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <label for="auto-launch">Launch on Login</label>
          <p class="setting-description">
            Automatically start Hearth when you log in to your computer.
            This adds Hearth to your {getPlatformLabel()}.
          </p>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            id="auto-launch"
            bind:checked={autoLaunchEnabled}
            on:change={toggleAutoLaunch}
            disabled={saving}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="setting-row" class:disabled={!autoLaunchEnabled}>
        <div class="setting-info">
          <label for="start-minimized">Start Minimized</label>
          <p class="setting-description">
            Start Hearth in the system tray instead of opening the main window.
            Useful if you want Hearth running but not in the way.
          </p>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            id="start-minimized"
            bind:checked={startMinimized}
            on:change={handleMinimizedChange}
            disabled={saving || !autoLaunchEnabled}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
      
      <div class="setting-row">
        <div class="setting-info">
          <label for="minimize-to-tray">Minimize to Tray on Close</label>
          <p class="setting-description">
            When you close the window, keep Hearth running in the system tray
            instead of quitting. Use the tray icon to restore or quit.
          </p>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            id="minimize-to-tray"
            bind:checked={minimizeToTray}
            on:change={handleTrayChange}
            disabled={saving}
          />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="info-box">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        {#if platform === 'darwin'}
          You can also manage startup apps in System Settings → General → Login Items.
        {:else if platform === 'windows'}
          You can also manage startup apps in Settings → Apps → Startup.
        {:else if platform === 'linux'}
          Autostart is managed via ~/.config/autostart/.
        {/if}
      </p>
    </div>
    
    {#if error}
      <div class="error-message">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        {error}
      </div>
    {/if}
    
    {#if successMessage}
      <div class="success-message">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        {successMessage}
      </div>
    {/if}
  {/if}
</div>

<style>
  .auto-launch-settings {
    padding: 1rem;
    max-width: 600px;
  }
  
  h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--header-primary, #f2f3f5);
  }
  
  .loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-muted, #a3a6aa);
    padding: 1rem 0;
  }
  
  .not-available {
    padding: 1rem;
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    color: var(--text-muted, #a3a6aa);
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    transition: opacity 0.2s;
  }
  
  .setting-row.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .setting-info {
    flex: 1;
  }
  
  .setting-info label {
    display: block;
    font-weight: 500;
    color: var(--header-primary, #f2f3f5);
    margin-bottom: 0.25rem;
    cursor: pointer;
  }
  
  .setting-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted, #a3a6aa);
    line-height: 1.4;
  }
  
  /* Toggle switch styles */
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background-tertiary, #202225);
    transition: 0.2s;
    border-radius: 24px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: var(--text-muted, #a3a6aa);
    transition: 0.2s;
    border-radius: 50%;
  }
  
  .toggle input:checked + .toggle-slider {
    background-color: var(--brand-experiment, #5865f2);
  }
  
  .toggle input:checked + .toggle-slider:before {
    transform: translateX(20px);
    background-color: white;
  }
  
  .toggle input:disabled + .toggle-slider {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .info-box {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding: 0.875rem 1rem;
    background: var(--background-secondary-alt, #18191c);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--text-muted, #a3a6aa);
  }
  
  .info-box svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
    color: var(--text-muted, #a3a6aa);
  }
  
  .info-box p {
    margin: 0;
    line-height: 1.4;
  }
  
  .error-message,
  .success-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
  }
  
  .error-message {
    background: rgba(237, 66, 69, 0.1);
    color: var(--status-danger, #ed4245);
  }
  
  .success-message {
    background: rgba(87, 242, 135, 0.1);
    color: var(--status-positive, #57f287);
  }
  
  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .setting-row {
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .toggle {
      align-self: flex-start;
    }
  }
</style>
