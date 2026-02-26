<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import Button from './Button.svelte';

  interface AccessibilitySettings {
    reducedMotion: boolean;
    highContrast: boolean;
    fontScale: number;
    screenReaderEnabled: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    captionsEnabled: boolean;
    autoPlayMedia: boolean;
    animationSpeed: number;
  }

  interface SystemA11yState {
    reducedMotion: boolean;
    highContrast: boolean;
    screenReaderActive: boolean;
  }

  let settings: AccessibilitySettings = $state({
    reducedMotion: false,
    highContrast: false,
    fontScale: 1.0,
    screenReaderEnabled: false,
    keyboardNavigation: true,
    focusIndicators: true,
    colorBlindMode: 'none',
    captionsEnabled: false,
    autoPlayMedia: true,
    animationSpeed: 1.0
  });

  let systemState: SystemA11yState = $state({
    reducedMotion: false,
    highContrast: false,
    screenReaderActive: false
  });

  let loading = $state(true);
  let error = $state<string | null>(null);
  let saved = $state(false);
  let unlistenSystem: UnlistenFn | null = null;

  const fontScaleOptions = [
    { value: 0.75, label: 'Small (75%)' },
    { value: 0.875, label: 'Medium Small (87.5%)' },
    { value: 1.0, label: 'Default (100%)' },
    { value: 1.125, label: 'Medium Large (112.5%)' },
    { value: 1.25, label: 'Large (125%)' },
    { value: 1.5, label: 'Extra Large (150%)' },
    { value: 2.0, label: 'Maximum (200%)' }
  ];

  const colorBlindModes = [
    { value: 'none', label: 'None', description: 'Standard color display' },
    { value: 'protanopia', label: 'Protanopia', description: 'Red-blind (red-green)' },
    { value: 'deuteranopia', label: 'Deuteranopia', description: 'Green-blind (red-green)' },
    { value: 'tritanopia', label: 'Tritanopia', description: 'Blue-blind (blue-yellow)' }
  ] as const;

  const animationSpeeds = [
    { value: 0, label: 'Disabled' },
    { value: 0.5, label: 'Slow (50%)' },
    { value: 1.0, label: 'Normal (100%)' },
    { value: 1.5, label: 'Fast (150%)' },
    { value: 2.0, label: 'Very Fast (200%)' }
  ];

  onMount(async () => {
    try {
      // Load saved settings
      const savedSettings = await invoke<AccessibilitySettings | null>('get_accessibility_settings');
      if (savedSettings) {
        settings = savedSettings;
      }

      // Get system accessibility state
      const sysState = await invoke<SystemA11yState>('get_system_accessibility_state');
      systemState = sysState;

      // Listen for system accessibility changes
      unlistenSystem = await listen<SystemA11yState>('system-accessibility-changed', (event) => {
        systemState = event.payload;
        // Auto-sync if user prefers system settings
        if (settings.reducedMotion !== systemState.reducedMotion && !hasUserOverride('reducedMotion')) {
          settings.reducedMotion = systemState.reducedMotion;
        }
        if (settings.highContrast !== systemState.highContrast && !hasUserOverride('highContrast')) {
          settings.highContrast = systemState.highContrast;
        }
      });

      // Apply initial settings
      applySettings();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load accessibility settings';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    unlistenSystem?.();
  });

  function hasUserOverride(key: keyof AccessibilitySettings): boolean {
    const overrides = localStorage.getItem('a11y-overrides');
    if (overrides) {
      const parsed = JSON.parse(overrides);
      return parsed[key] === true;
    }
    return false;
  }

  function setUserOverride(key: keyof AccessibilitySettings) {
    const overrides = JSON.parse(localStorage.getItem('a11y-overrides') || '{}');
    overrides[key] = true;
    localStorage.setItem('a11y-overrides', JSON.stringify(overrides));
  }

  function applySettings() {
    const root = document.documentElement;

    // Apply font scale
    root.style.setProperty('--a11y-font-scale', settings.fontScale.toString());
    root.style.fontSize = `${settings.fontScale * 100}%`;

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduce-motion');
      root.style.setProperty('--a11y-animation-duration', '0.01ms');
    } else {
      root.classList.remove('reduce-motion');
      root.style.setProperty('--a11y-animation-duration', `${1 / settings.animationSpeed}s`);
    }

    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply color blind mode
    root.setAttribute('data-colorblind-mode', settings.colorBlindMode);

    // Apply focus indicators
    if (settings.focusIndicators) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }

    // Apply keyboard navigation enhancements
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-nav');
    } else {
      root.classList.remove('keyboard-nav');
    }

    // Apply captions
    root.setAttribute('data-captions', settings.captionsEnabled.toString());

    // Apply auto-play media
    root.setAttribute('data-autoplay-media', settings.autoPlayMedia.toString());
  }

  async function saveSettings() {
    try {
      await invoke('save_accessibility_settings', { settings });
      applySettings();
      saved = true;
      setTimeout(() => saved = false, 2000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save settings';
    }
  }

  async function resetToDefaults() {
    settings = {
      reducedMotion: systemState.reducedMotion,
      highContrast: systemState.highContrast,
      fontScale: 1.0,
      screenReaderEnabled: systemState.screenReaderActive,
      keyboardNavigation: true,
      focusIndicators: true,
      colorBlindMode: 'none',
      captionsEnabled: false,
      autoPlayMedia: true,
      animationSpeed: 1.0
    };
    localStorage.removeItem('a11y-overrides');
    await saveSettings();
  }

  function announceToScreenReader(message: string) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  function handleSettingChange(key: keyof AccessibilitySettings) {
    setUserOverride(key);
    applySettings();
    announceToScreenReader(`${key} setting changed`);
  }

  // Keyboard shortcut for quick toggle
  function handleKeydown(event: KeyboardEvent) {
    // Alt+Shift+A to toggle accessibility panel focus
    if (event.altKey && event.shiftKey && event.key === 'A') {
      event.preventDefault();
      const panel = document.querySelector('[data-accessibility-panel]');
      if (panel instanceof HTMLElement) {
        panel.focus();
        announceToScreenReader('Accessibility settings panel focused');
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div 
  class="accessibility-manager"
  data-accessibility-panel
  tabindex="-1"
  role="region"
  aria-label="Accessibility Settings"
>
  <header class="a11y-header">
    <h2>Accessibility Settings</h2>
    <p class="a11y-description">
      Customize your experience to meet your accessibility needs.
      Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> to quickly access these settings.
    </p>
  </header>

  {#if loading}
    <div class="loading" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      Loading accessibility settings...
    </div>
  {:else if error}
    <div class="error" role="alert">
      <span class="error-icon" aria-hidden="true">⚠️</span>
      {error}
    </div>
  {:else}
    <div class="settings-sections">
      <!-- System Status -->
      <section class="settings-section" aria-labelledby="system-status-heading">
        <h3 id="system-status-heading">System Status</h3>
        <div class="system-indicators">
          <div class="indicator" class:active={systemState.reducedMotion}>
            <span class="indicator-icon" aria-hidden="true">🎬</span>
            <span>Reduced Motion: {systemState.reducedMotion ? 'On' : 'Off'}</span>
          </div>
          <div class="indicator" class:active={systemState.highContrast}>
            <span class="indicator-icon" aria-hidden="true">🔲</span>
            <span>High Contrast: {systemState.highContrast ? 'On' : 'Off'}</span>
          </div>
          <div class="indicator" class:active={systemState.screenReaderActive}>
            <span class="indicator-icon" aria-hidden="true">🔊</span>
            <span>Screen Reader: {systemState.screenReaderActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </section>

      <!-- Visual Settings -->
      <section class="settings-section" aria-labelledby="visual-heading">
        <h3 id="visual-heading">Visual</h3>

        <label class="setting-item">
          <span class="setting-label">Font Size</span>
          <select 
            bind:value={settings.fontScale}
            onchange={() => handleSettingChange('fontScale')}
            aria-describedby="font-scale-desc"
          >
            {#each fontScaleOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <span id="font-scale-desc" class="setting-description">
            Adjust text size throughout the application
          </span>
        </label>

        <label class="setting-item toggle">
          <span class="setting-label">High Contrast Mode</span>
          <input 
            type="checkbox" 
            bind:checked={settings.highContrast}
            onchange={() => handleSettingChange('highContrast')}
            role="switch"
            aria-describedby="high-contrast-desc"
          />
          <span id="high-contrast-desc" class="setting-description">
            Increase contrast between text and background colors
          </span>
        </label>

        <label class="setting-item">
          <span class="setting-label">Color Blind Mode</span>
          <select 
            bind:value={settings.colorBlindMode}
            onchange={() => handleSettingChange('colorBlindMode')}
            aria-describedby="colorblind-desc"
          >
            {#each colorBlindModes as mode}
              <option value={mode.value}>{mode.label} - {mode.description}</option>
            {/each}
          </select>
          <span id="colorblind-desc" class="setting-description">
            Adjust colors for color vision deficiency
          </span>
        </label>

        <label class="setting-item toggle">
          <span class="setting-label">Enhanced Focus Indicators</span>
          <input 
            type="checkbox" 
            bind:checked={settings.focusIndicators}
            onchange={() => handleSettingChange('focusIndicators')}
            role="switch"
            aria-describedby="focus-desc"
          />
          <span id="focus-desc" class="setting-description">
            Show larger, more visible focus outlines
          </span>
        </label>
      </section>

      <!-- Motion Settings -->
      <section class="settings-section" aria-labelledby="motion-heading">
        <h3 id="motion-heading">Motion & Animation</h3>

        <label class="setting-item toggle">
          <span class="setting-label">Reduce Motion</span>
          <input 
            type="checkbox" 
            bind:checked={settings.reducedMotion}
            onchange={() => handleSettingChange('reducedMotion')}
            role="switch"
            aria-describedby="reduce-motion-desc"
          />
          <span id="reduce-motion-desc" class="setting-description">
            Minimize animations and transitions
          </span>
        </label>

        {#if !settings.reducedMotion}
          <label class="setting-item">
            <span class="setting-label">Animation Speed</span>
            <select 
              bind:value={settings.animationSpeed}
              onchange={() => handleSettingChange('animationSpeed')}
              aria-describedby="animation-speed-desc"
            >
              {#each animationSpeeds as speed}
                <option value={speed.value}>{speed.label}</option>
              {/each}
            </select>
            <span id="animation-speed-desc" class="setting-description">
              Control how fast animations play
            </span>
          </label>
        {/if}

        <label class="setting-item toggle">
          <span class="setting-label">Auto-play Media</span>
          <input 
            type="checkbox" 
            bind:checked={settings.autoPlayMedia}
            onchange={() => handleSettingChange('autoPlayMedia')}
            role="switch"
            aria-describedby="autoplay-desc"
          />
          <span id="autoplay-desc" class="setting-description">
            Automatically play videos and GIFs
          </span>
        </label>
      </section>

      <!-- Navigation Settings -->
      <section class="settings-section" aria-labelledby="navigation-heading">
        <h3 id="navigation-heading">Navigation</h3>

        <label class="setting-item toggle">
          <span class="setting-label">Enhanced Keyboard Navigation</span>
          <input 
            type="checkbox" 
            bind:checked={settings.keyboardNavigation}
            onchange={() => handleSettingChange('keyboardNavigation')}
            role="switch"
            aria-describedby="keyboard-nav-desc"
          />
          <span id="keyboard-nav-desc" class="setting-description">
            Improve keyboard-only navigation throughout the app
          </span>
        </label>

        <label class="setting-item toggle">
          <span class="setting-label">Screen Reader Optimization</span>
          <input 
            type="checkbox" 
            bind:checked={settings.screenReaderEnabled}
            onchange={() => handleSettingChange('screenReaderEnabled')}
            role="switch"
            aria-describedby="screen-reader-desc"
          />
          <span id="screen-reader-desc" class="setting-description">
            Optimize content for screen readers
          </span>
        </label>
      </section>

      <!-- Media Settings -->
      <section class="settings-section" aria-labelledby="media-heading">
        <h3 id="media-heading">Media</h3>

        <label class="setting-item toggle">
          <span class="setting-label">Show Captions</span>
          <input 
            type="checkbox" 
            bind:checked={settings.captionsEnabled}
            onchange={() => handleSettingChange('captionsEnabled')}
            role="switch"
            aria-describedby="captions-desc"
          />
          <span id="captions-desc" class="setting-description">
            Display captions on videos when available
          </span>
        </label>
      </section>
    </div>

    <footer class="a11y-footer">
      <div class="footer-actions">
        <Button variant="ghost" onclick={resetToDefaults}>
          Reset to Defaults
        </Button>
        <Button variant="primary" onclick={saveSettings}>
          Save Settings
        </Button>
      </div>
      {#if saved}
        <div class="saved-indicator" role="status" aria-live="polite">
          ✓ Settings saved
        </div>
      {/if}
    </footer>
  {/if}
</div>

<style>
  .accessibility-manager {
    padding: 1.5rem;
    max-width: 640px;
    margin: 0 auto;
    outline: none;
  }

  .a11y-header {
    margin-bottom: 1.5rem;
  }

  .a11y-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #fff);
  }

  .a11y-description {
    color: var(--text-secondary, #aaa);
    font-size: 0.875rem;
    margin: 0;
  }

  .a11y-description kbd {
    background: var(--bg-tertiary, #333);
    border: 1px solid var(--border-primary, #444);
    border-radius: 4px;
    padding: 0.125rem 0.375rem;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .loading, .error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 8px;
  }

  .loading {
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-secondary, #aaa);
  }

  .error {
    background: var(--error-bg, rgba(239, 68, 68, 0.1));
    color: var(--error-text, #ef4444);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-section {
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 8px;
    padding: 1rem;
  }

  .settings-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, #aaa);
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-primary, #333);
  }

  .system-indicators {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #222);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
  }

  .indicator.active {
    background: var(--accent-bg, rgba(88, 101, 242, 0.2));
    color: var(--accent-text, #5865f2);
  }

  .indicator-icon {
    font-size: 1rem;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-secondary, #2a2a2a);
  }

  .setting-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .setting-item.toggle {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }

  .setting-item.toggle .setting-description {
    flex-basis: 100%;
    margin-top: 0.25rem;
  }

  .setting-label {
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .setting-description {
    font-size: 0.75rem;
    color: var(--text-tertiary, #666);
  }

  .setting-item select {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-primary, #333);
    background: var(--bg-tertiary, #222);
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    cursor: pointer;
    width: 100%;
    max-width: 300px;
  }

  .setting-item select:focus {
    outline: 2px solid var(--accent-primary, #5865f2);
    outline-offset: 2px;
  }

  .setting-item input[type="checkbox"] {
    width: 2.5rem;
    height: 1.25rem;
    appearance: none;
    background: var(--bg-tertiary, #333);
    border-radius: 0.625rem;
    position: relative;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .setting-item input[type="checkbox"]::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1rem;
    height: 1rem;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .setting-item input[type="checkbox"]:checked {
    background: var(--accent-primary, #5865f2);
  }

  .setting-item input[type="checkbox"]:checked::before {
    transform: translateX(1.25rem);
  }

  .setting-item input[type="checkbox"]:focus {
    outline: 2px solid var(--accent-primary, #5865f2);
    outline-offset: 2px;
  }

  .a11y-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-primary, #333);
  }

  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .saved-indicator {
    margin-top: 0.75rem;
    text-align: right;
    color: var(--success-text, #22c55e);
    font-size: 0.875rem;
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Reduced motion support */
  :global(.reduce-motion *) {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* High contrast enhancements */
  :global(.high-contrast) {
    --text-primary: #fff;
    --text-secondary: #e0e0e0;
    --bg-primary: #000;
    --bg-secondary: #111;
    --border-primary: #fff;
  }

  /* Enhanced focus indicators */
  :global(.enhanced-focus) :focus {
    outline: 3px solid var(--accent-primary, #5865f2) !important;
    outline-offset: 3px !important;
  }

  /* Keyboard navigation mode */
  :global(.keyboard-nav) :focus:not(:focus-visible) {
    outline: none;
  }

  :global(.keyboard-nav) :focus-visible {
    outline: 2px solid var(--accent-primary, #5865f2);
    outline-offset: 2px;
  }

  /* Color blind filters */
  :global([data-colorblind-mode="protanopia"]) {
    filter: url('#protanopia-filter');
  }

  :global([data-colorblind-mode="deuteranopia"]) {
    filter: url('#deuteranopia-filter');
  }

  :global([data-colorblind-mode="tritanopia"]) {
    filter: url('#tritanopia-filter');
  }
</style>
