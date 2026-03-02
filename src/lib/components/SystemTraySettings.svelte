<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  
  interface TraySettings {
    minimizeToTray: boolean;
    closeToTray: boolean;
    showUnreadBadge: boolean;
    animateBadge: boolean;
    startMinimized: boolean;
    showInDock: boolean;
    singleClickAction: 'show' | 'toggle' | 'menu';
    customTooltip: boolean;
    tooltipTemplate: string;
  }
  
  let settings: TraySettings = {
    minimizeToTray: true,
    closeToTray: true,
    showUnreadBadge: true,
    animateBadge: true,
    startMinimized: false,
    showInDock: true,
    singleClickAction: 'toggle',
    customTooltip: false,
    tooltipTemplate: 'Hearth - {unread} unread'
  };
  
  let loading = true;
  let saving = false;
  let error: string | null = null;
  let success = false;
  
  const singleClickOptions = [
    { value: 'show', label: 'Show Window' },
    { value: 'toggle', label: 'Toggle Visibility' },
    { value: 'menu', label: 'Show Menu' }
  ];
  
  onMount(async () => {
    try {
      const stored = await invoke<TraySettings | null>('get_tray_settings');
      if (stored) {
        settings = { ...settings, ...stored };
      }
    } catch (e) {
      console.warn('Failed to load tray settings, using defaults');
    } finally {
      loading = false;
    }
    
    // Listen for tray setting changes from other sources
    const unlisten = await listen<Partial<TraySettings>>('tray-settings-changed', (event) => {
      settings = { ...settings, ...event.payload };
    });
    
    return () => {
      unlisten();
    };
  });
  
  async function saveSettings() {
    saving = true;
    error = null;
    success = false;
    
    try {
      await invoke('set_tray_settings', { settings });
      success = true;
      setTimeout(() => success = false, 2000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      saving = false;
    }
  }
  
  async function resetToDefaults() {
    settings = {
      minimizeToTray: true,
      closeToTray: true,
      showUnreadBadge: true,
      animateBadge: true,
      startMinimized: false,
      showInDock: true,
      singleClickAction: 'toggle',
      customTooltip: false,
      tooltipTemplate: 'Hearth - {unread} unread'
    };
    await saveSettings();
  }
  
  async function testTrayNotification() {
    try {
      await invoke('test_tray_notification');
    } catch (e) {
      console.error('Test notification failed:', e);
    }
  }
  
  $: {
    // Auto-save on change (debounced in real implementation)
    if (!loading) {
      saveSettings();
    }
  }
</script>

<div class="tray-settings">
  <header class="settings-header">
    <h2>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon">
        <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v3H3V5zm0 5h18v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z"/>
        <circle cx="12" cy="15" r="2" fill="var(--bg-primary)"/>
      </svg>
      System Tray
    </h2>
    <p class="description">Configure how Hearth behaves in the system tray</p>
  </header>
  
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading settings...</span>
    </div>
  {:else}
    <div class="settings-grid">
      <!-- Window Behavior Section -->
      <section class="settings-section">
        <h3>Window Behavior</h3>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Minimize to tray</strong>
            <small>Window goes to tray when minimized</small>
          </span>
          <input type="checkbox" bind:checked={settings.minimizeToTray} class="toggle" />
        </label>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Close to tray</strong>
            <small>Close button minimizes to tray instead of quitting</small>
          </span>
          <input type="checkbox" bind:checked={settings.closeToTray} class="toggle" />
        </label>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Start minimized</strong>
            <small>Launch app directly to tray on startup</small>
          </span>
          <input type="checkbox" bind:checked={settings.startMinimized} class="toggle" />
        </label>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Show in dock</strong>
            <small>Display app icon in the dock/taskbar</small>
          </span>
          <input type="checkbox" bind:checked={settings.showInDock} class="toggle" />
        </label>
      </section>
      
      <!-- Click Behavior Section -->
      <section class="settings-section">
        <h3>Click Behavior</h3>
        
        <div class="select-row">
          <span class="label-text">
            <strong>Single click action</strong>
            <small>What happens when you click the tray icon</small>
          </span>
          <select bind:value={settings.singleClickAction} class="select">
            {#each singleClickOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
      </section>
      
      <!-- Badge Section -->
      <section class="settings-section">
        <h3>Unread Badge</h3>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Show unread badge</strong>
            <small>Display unread count on tray icon</small>
          </span>
          <input type="checkbox" bind:checked={settings.showUnreadBadge} class="toggle" />
        </label>
        
        <label class="toggle-row" class:disabled={!settings.showUnreadBadge}>
          <span class="label-text">
            <strong>Animate badge</strong>
            <small>Bounce/pulse animation for new messages</small>
          </span>
          <input 
            type="checkbox" 
            bind:checked={settings.animateBadge} 
            disabled={!settings.showUnreadBadge}
            class="toggle" 
          />
        </label>
      </section>
      
      <!-- Tooltip Section -->
      <section class="settings-section">
        <h3>Tooltip</h3>
        
        <label class="toggle-row">
          <span class="label-text">
            <strong>Custom tooltip</strong>
            <small>Use a custom tooltip template</small>
          </span>
          <input type="checkbox" bind:checked={settings.customTooltip} class="toggle" />
        </label>
        
        {#if settings.customTooltip}
          <div class="input-row">
            <label for="tooltipTemplate" class="label-text">
              <strong>Tooltip template</strong>
              <small>Use {'{unread}'} for unread count, {'{server}'} for current server</small>
            </label>
            <input 
              id="tooltipTemplate"
              type="text" 
              bind:value={settings.tooltipTemplate}
              placeholder="Hearth - {'{unread}'} unread"
              class="text-input"
            />
          </div>
        {/if}
      </section>
    </div>
    
    <!-- Actions -->
    <div class="actions">
      <button class="btn secondary" on:click={testTrayNotification}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
          <path fill-rule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.94 32.94 0 003.256.508 3.5 3.5 0 006.972 0 32.933 32.933 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6z" clip-rule="evenodd"/>
        </svg>
        Test Notification
      </button>
      
      <button class="btn secondary" on:click={resetToDefaults}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
          <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd"/>
        </svg>
        Reset to Defaults
      </button>
      
      {#if success}
        <span class="status success">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="status-icon">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/>
          </svg>
          Saved
        </span>
      {/if}
      
      {#if error}
        <span class="status error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="status-icon">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
          </svg>
          {error}
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tray-settings {
    padding: 1.5rem;
    max-width: 600px;
  }
  
  .settings-header {
    margin-bottom: 1.5rem;
  }
  
  .settings-header h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--accent-primary, #5865f2);
  }
  
  .description {
    margin: 0;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
  }
  
  .loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--text-secondary, #b5bac1);
  }
  
  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--bg-tertiary, #3f4147);
    border-top-color: var(--accent-primary, #5865f2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .settings-section {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    padding: 1rem;
  }
  
  .settings-section h3 {
    margin: 0 0 1rem 0;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-secondary, #b5bac1);
  }
  
  .toggle-row,
  .select-row,
  .input-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--bg-tertiary, #3f4147);
  }
  
  .toggle-row:last-child,
  .select-row:last-child,
  .input-row:last-child {
    border-bottom: none;
  }
  
  .toggle-row.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .label-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }
  
  .label-text strong {
    color: var(--text-primary, #fff);
    font-weight: 500;
    font-size: 0.9375rem;
  }
  
  .label-text small {
    color: var(--text-muted, #80848e);
    font-size: 0.8125rem;
  }
  
  .toggle {
    appearance: none;
    width: 40px;
    height: 24px;
    background: var(--bg-tertiary, #3f4147);
    border-radius: 12px;
    position: relative;
    cursor: pointer;
    transition: background 0.15s ease;
    flex-shrink: 0;
    margin-left: 1rem;
  }
  
  .toggle::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.15s ease;
  }
  
  .toggle:checked {
    background: var(--accent-primary, #5865f2);
  }
  
  .toggle:checked::before {
    transform: translateX(16px);
  }
  
  .toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .select {
    background: var(--bg-tertiary, #3f4147);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: 1rem;
  }
  
  .select:focus {
    outline: 2px solid var(--accent-primary, #5865f2);
    outline-offset: 2px;
  }
  
  .input-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .text-input {
    background: var(--bg-tertiary, #3f4147);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    width: 100%;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  }
  
  .text-input:focus {
    outline: 2px solid var(--accent-primary, #5865f2);
    outline-offset: 2px;
  }
  
  .text-input::placeholder {
    color: var(--text-muted, #80848e);
  }
  
  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  
  .btn-icon {
    width: 1rem;
    height: 1rem;
  }
  
  .btn.secondary {
    background: var(--bg-tertiary, #3f4147);
    color: var(--text-primary, #fff);
  }
  
  .btn.secondary:hover {
    background: var(--bg-modifier-hover, #4e505a);
  }
  
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .status-icon {
    width: 1rem;
    height: 1rem;
  }
  
  .status.success {
    color: var(--green-400, #3ba55c);
    background: rgba(59, 165, 92, 0.1);
  }
  
  .status.error {
    color: var(--red-400, #ed4245);
    background: rgba(237, 66, 69, 0.1);
  }
</style>
