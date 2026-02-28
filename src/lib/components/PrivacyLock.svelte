<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable } from 'svelte/store';

  // Lock state
  interface LockState {
    isLocked: boolean;
    isEnabled: boolean;
    lastActivity: number;
    failedAttempts: number;
    lockedUntil: number | null;
  }

  const lockState = writable<LockState>({
    isLocked: false,
    isEnabled: false,
    lastActivity: Date.now(),
    failedAttempts: 0,
    lockedUntil: null
  });

  // Settings
  interface PrivacySettings {
    enableAutoLock: boolean;
    autoLockTimeout: number; // minutes
    lockOnMinimize: boolean;
    lockOnScreenSaver: boolean;
    useBiometrics: boolean;
    requirePasswordOnBiometricFail: boolean;
    blurOnLock: boolean;
    hideNotificationsOnLock: boolean;
    maxFailedAttempts: number;
    lockoutDuration: number; // minutes
  }

  const settings = writable<PrivacySettings>({
    enableAutoLock: true,
    autoLockTimeout: 5,
    lockOnMinimize: false,
    lockOnScreenSaver: true,
    useBiometrics: true,
    requirePasswordOnBiometricFail: true,
    blurOnLock: true,
    hideNotificationsOnLock: true,
    maxFailedAttempts: 5,
    lockoutDuration: 15
  });

  let showSettings = false;
  let unlockMode: 'biometric' | 'password' = 'biometric';
  let passwordInput = '';
  let errorMessage = '';
  let biometricsAvailable = false;
  let unlisteners: UnlistenFn[] = [];
  let activityInterval: number;
  let countdownInterval: number;
  let lockoutCountdown = 0;

  // Check if biometrics are available
  async function checkBiometrics(): Promise<boolean> {
    try {
      const available = await invoke<boolean>('check_biometrics_available');
      return available;
    } catch {
      return false;
    }
  }

  // Lock the app
  export async function lock() {
    lockState.update(s => ({
      ...s,
      isLocked: true,
      lastActivity: Date.now()
    }));

    // Notify native layer
    try {
      await invoke('lock_app');
    } catch (error) {
      console.error('Failed to notify lock:', error);
    }
  }

  // Unlock with biometrics
  async function unlockWithBiometrics() {
    try {
      const success = await invoke<boolean>('authenticate_biometrics', {
        reason: 'Unlock Hearth'
      });

      if (success) {
        completeUnlock();
      } else {
        handleFailedAttempt();
      }
    } catch (error) {
      console.error('Biometric auth failed:', error);
      errorMessage = 'Biometric authentication failed';
      unlockMode = 'password';
    }
  }

  // Unlock with password
  async function unlockWithPassword() {
    if (!passwordInput) {
      errorMessage = 'Please enter your password';
      return;
    }

    try {
      const success = await invoke<boolean>('verify_password', {
        password: passwordInput
      });

      if (success) {
        completeUnlock();
      } else {
        handleFailedAttempt();
        errorMessage = 'Incorrect password';
      }
    } catch (error) {
      console.error('Password verification failed:', error);
      errorMessage = 'Verification failed';
    }

    passwordInput = '';
  }

  // Complete unlock
  function completeUnlock() {
    lockState.update(s => ({
      ...s,
      isLocked: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastActivity: Date.now()
    }));

    errorMessage = '';
    passwordInput = '';
    unlockMode = $settings.useBiometrics && biometricsAvailable ? 'biometric' : 'password';

    // Notify native layer
    invoke('unlock_app').catch(console.error);
  }

  // Handle failed unlock attempt
  function handleFailedAttempt() {
    lockState.update(s => {
      const newFailedAttempts = s.failedAttempts + 1;
      
      if (newFailedAttempts >= $settings.maxFailedAttempts) {
        const lockedUntil = Date.now() + $settings.lockoutDuration * 60 * 1000;
        startLockoutCountdown(lockedUntil);
        return {
          ...s,
          failedAttempts: 0,
          lockedUntil
        };
      }

      return {
        ...s,
        failedAttempts: newFailedAttempts
      };
    });
  }

  // Start lockout countdown
  function startLockoutCountdown(until: number) {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    countdownInterval = window.setInterval(() => {
      const remaining = Math.max(0, until - Date.now());
      lockoutCountdown = Math.ceil(remaining / 1000);

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        lockState.update(s => ({ ...s, lockedUntil: null }));
        lockoutCountdown = 0;
      }
    }, 1000);
  }

  // Set up auto-lock timer
  function setupAutoLock() {
    if (activityInterval) {
      clearInterval(activityInterval);
    }

    if (!$settings.enableAutoLock) return;

    activityInterval = window.setInterval(() => {
      if ($lockState.isLocked) return;

      const idleTime = Date.now() - $lockState.lastActivity;
      const timeoutMs = $settings.autoLockTimeout * 60 * 1000;

      if (idleTime >= timeoutMs) {
        lock();
      }
    }, 10000); // Check every 10 seconds
  }

  // Reset activity timer
  function resetActivityTimer() {
    lockState.update(s => ({
      ...s,
      lastActivity: Date.now()
    }));
  }

  // Format lockout time
  function formatLockoutTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Save settings
  function saveSettings(newSettings: Partial<PrivacySettings>) {
    settings.update(s => ({ ...s, ...newSettings }));
    localStorage.setItem('privacySettings', JSON.stringify($settings));
    setupAutoLock();
  }

  // Load settings
  async function loadSettings() {
    const saved = localStorage.getItem('privacySettings');
    if (saved) {
      try {
        settings.set({ ...$settings, ...JSON.parse(saved) });
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    biometricsAvailable = await checkBiometrics();
    if (!biometricsAvailable) {
      settings.update(s => ({ ...s, useBiometrics: false }));
    }
  }

  // Set up password (initial setup)
  async function setPassword(password: string): Promise<boolean> {
    try {
      await invoke('set_app_password', { password });
      settings.update(s => ({ ...s, enableAutoLock: true }));
      saveSettings($settings);
      return true;
    } catch (error) {
      console.error('Failed to set password:', error);
      return false;
    }
  }

  // Enable privacy lock
  export async function enable() {
    lockState.update(s => ({ ...s, isEnabled: true }));
    setupAutoLock();
  }

  // Disable privacy lock
  export async function disable() {
    lockState.update(s => ({
      ...s,
      isEnabled: false,
      isLocked: false
    }));
    if (activityInterval) {
      clearInterval(activityInterval);
    }
  }

  onMount(async () => {
    await loadSettings();
    setupAutoLock();

    // Track activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivityTimer, { passive: true });
    });

    // Listen for system events
    try {
      const unlistenMinimize = await listen('tauri://blur', () => {
        if ($settings.lockOnMinimize && $lockState.isEnabled) {
          lock();
        }
      });
      unlisteners.push(unlistenMinimize);

      const unlistenScreenSaver = await listen('screen-saver-activated', () => {
        if ($settings.lockOnScreenSaver && $lockState.isEnabled) {
          lock();
        }
      });
      unlisteners.push(unlistenScreenSaver);

      const unlistenSystemLock = await listen('system-locked', () => {
        if ($lockState.isEnabled) {
          lock();
        }
      });
      unlisteners.push(unlistenSystemLock);
    } catch (error) {
      console.error('Failed to set up event listeners:', error);
    }

    // Check if already locked from previous session
    try {
      const wasLocked = await invoke<boolean>('get_lock_state');
      if (wasLocked) {
        lock();
      }
    } catch {
      // Ignore
    }
  });

  onDestroy(() => {
    if (activityInterval) {
      clearInterval(activityInterval);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    unlisteners.forEach(unlisten => unlisten());

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.removeEventListener(event, resetActivityTimer);
    });
  });
</script>

{#if $lockState.isLocked}
  <div class="privacy-lock-overlay" class:blur={$settings.blurOnLock}>
    <div class="lock-container">
      <div class="lock-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <h2>Hearth is Locked</h2>
      <p class="subtitle">Unlock to continue</p>

      {#if $lockState.lockedUntil}
        <div class="lockout-notice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Too many attempts. Try again in {formatLockoutTime(lockoutCountdown)}</span>
        </div>
      {:else}
        {#if unlockMode === 'biometric' && biometricsAvailable}
          <div class="biometric-section">
            <button class="biometric-btn" on:click={unlockWithBiometrics}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"/>
              </svg>
              <span>Unlock with Touch ID</span>
            </button>

            <button class="text-btn" on:click={() => unlockMode = 'password'}>
              Use password instead
            </button>
          </div>
        {:else}
          <div class="password-section">
            <form on:submit|preventDefault={unlockWithPassword}>
              <input
                type="password"
                bind:value={passwordInput}
                placeholder="Enter password"
                autocomplete="current-password"
                autofocus
              />
              
              {#if errorMessage}
                <p class="error">{errorMessage}</p>
              {/if}

              {#if $lockState.failedAttempts > 0}
                <p class="attempts">
                  {$settings.maxFailedAttempts - $lockState.failedAttempts} attempts remaining
                </p>
              {/if}

              <button type="submit" class="unlock-btn">
                Unlock
              </button>
            </form>

            {#if biometricsAvailable && $settings.useBiometrics}
              <button class="text-btn" on:click={() => unlockMode = 'biometric'}>
                Use Touch ID instead
              </button>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Settings Panel (when not locked) -->
{#if showSettings && !$lockState.isLocked}
  <div class="settings-overlay">
    <div class="settings-panel">
      <div class="settings-header">
        <h3>Privacy & Lock Settings</h3>
        <button class="close-btn" on:click={() => showSettings = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="settings-content">
        <div class="setting-group">
          <h4>Auto-Lock</h4>
          
          <label class="toggle-setting">
            <span>Enable auto-lock</span>
            <input
              type="checkbox"
              checked={$settings.enableAutoLock}
              on:change={(e) => saveSettings({ enableAutoLock: e.currentTarget.checked })}
            />
          </label>

          {#if $settings.enableAutoLock}
            <label class="select-setting">
              <span>Lock after inactivity</span>
              <select
                value={$settings.autoLockTimeout}
                on:change={(e) => saveSettings({ autoLockTimeout: parseInt(e.currentTarget.value) })}
              >
                <option value={1}>1 minute</option>
                <option value={2}>2 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </label>
          {/if}

          <label class="toggle-setting">
            <span>Lock when minimized</span>
            <input
              type="checkbox"
              checked={$settings.lockOnMinimize}
              on:change={(e) => saveSettings({ lockOnMinimize: e.currentTarget.checked })}
            />
          </label>

          <label class="toggle-setting">
            <span>Lock on screen saver</span>
            <input
              type="checkbox"
              checked={$settings.lockOnScreenSaver}
              on:change={(e) => saveSettings({ lockOnScreenSaver: e.currentTarget.checked })}
            />
          </label>
        </div>

        <div class="setting-group">
          <h4>Authentication</h4>

          {#if biometricsAvailable}
            <label class="toggle-setting">
              <span>Use Touch ID / Face ID</span>
              <input
                type="checkbox"
                checked={$settings.useBiometrics}
                on:change={(e) => saveSettings({ useBiometrics: e.currentTarget.checked })}
              />
            </label>
          {/if}

          <label class="select-setting">
            <span>Max failed attempts</span>
            <select
              value={$settings.maxFailedAttempts}
              on:change={(e) => saveSettings({ maxFailedAttempts: parseInt(e.currentTarget.value) })}
            >
              <option value={3}>3 attempts</option>
              <option value={5}>5 attempts</option>
              <option value={10}>10 attempts</option>
            </select>
          </label>

          <label class="select-setting">
            <span>Lockout duration</span>
            <select
              value={$settings.lockoutDuration}
              on:change={(e) => saveSettings({ lockoutDuration: parseInt(e.currentTarget.value) })}
            >
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </label>
        </div>

        <div class="setting-group">
          <h4>Privacy</h4>

          <label class="toggle-setting">
            <span>Blur content when locked</span>
            <input
              type="checkbox"
              checked={$settings.blurOnLock}
              on:change={(e) => saveSettings({ blurOnLock: e.currentTarget.checked })}
            />
          </label>

          <label class="toggle-setting">
            <span>Hide notifications when locked</span>
            <input
              type="checkbox"
              checked={$settings.hideNotificationsOnLock}
              on:change={(e) => saveSettings({ hideNotificationsOnLock: e.currentTarget.checked })}
            />
          </label>
        </div>

        <div class="action-buttons">
          <button class="lock-now-btn" on:click={lock}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Lock Now
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .privacy-lock-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #1e1e1e);
  }

  .privacy-lock-overlay.blur {
    backdrop-filter: blur(20px);
    background: rgba(30, 30, 30, 0.95);
  }

  .lock-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    text-align: center;
    max-width: 400px;
  }

  .lock-icon {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--bg-secondary, #2d2d2d);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color, #5865f2);
    margin-bottom: 24px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .subtitle {
    margin: 0 0 32px;
    color: var(--text-secondary, #999);
  }

  .lockout-notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    color: #ef4444;
    font-size: 14px;
  }

  .biometric-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .biometric-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 48px;
    background: var(--bg-secondary, #2d2d2d);
    border: 2px solid var(--border-color, #3d3d3d);
    border-radius: 16px;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .biometric-btn:hover {
    border-color: var(--accent-color, #5865f2);
    background: var(--bg-tertiary, #3d3d3d);
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--accent-color, #5865f2);
    cursor: pointer;
    font-size: 14px;
  }

  .text-btn:hover {
    text-decoration: underline;
  }

  .password-section {
    width: 100%;
  }

  .password-section form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .password-section input {
    width: 100%;
    padding: 14px 18px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 10px;
    color: var(--text-primary, #fff);
    font-size: 16px;
    text-align: center;
  }

  .password-section input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .error {
    margin: 0;
    color: #ef4444;
    font-size: 13px;
  }

  .attempts {
    margin: 0;
    color: #f59e0b;
    font-size: 13px;
  }

  .unlock-btn {
    padding: 14px;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .unlock-btn:hover {
    background: var(--accent-hover, #4752c4);
  }

  /* Settings Panel */
  .settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .settings-panel {
    width: 480px;
    max-height: 80vh;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #3d3d3d);
  }

  .settings-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #999);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
  }

  .settings-content {
    padding: 20px;
    overflow-y: auto;
    max-height: calc(80vh - 60px);
  }

  .setting-group {
    margin-bottom: 24px;
  }

  .setting-group h4 {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #999);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .toggle-setting, .select-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color, #3d3d3d);
    font-size: 14px;
    color: var(--text-primary, #fff);
  }

  .toggle-setting input[type="checkbox"] {
    width: 44px;
    height: 24px;
    accent-color: var(--accent-color, #5865f2);
  }

  .select-setting select {
    padding: 6px 12px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .action-buttons {
    padding-top: 16px;
  }

  .lock-now-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #ef4444;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .lock-now-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
</style>
</script>
