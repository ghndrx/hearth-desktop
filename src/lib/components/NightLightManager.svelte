<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  // Types
  type NightLightMode = 'off' | 'manual' | 'scheduled' | 'sunset-to-sunrise';

  interface NightLightSchedule {
    startTime: string;
    endTime: string;
    transitionMinutes: number;
  }

  interface NightLightSettings {
    mode: NightLightMode;
    temperature: number;
    intensity: number;
    isActive: boolean;
    schedule: NightLightSchedule;
    latitude: number | null;
    longitude: number | null;
  }

  interface NightLightStatus {
    settings: NightLightSettings;
    effectiveTemperature: number;
    cssFilter: string;
    nextChange: string | null;
    statusText: string;
  }

  interface TemperaturePreset {
    name: string;
    value: number;
  }

  // Props
  export let showSettings = false;
  export let compact = false;

  // State
  let status: NightLightStatus | null = null;
  let presets: TemperaturePreset[] = [];
  let loading = true;
  let error: string | null = null;
  let unlistenFn: UnlistenFn | null = null;

  // Computed
  $: isActive = status?.settings.isActive ?? false;
  $: mode = status?.settings.mode ?? 'off';
  $: temperature = status?.settings.temperature ?? 3400;
  $: cssFilter = status?.cssFilter ?? 'none';
  $: statusText = status?.statusText ?? 'Loading...';

  // Temperature to visual preview color
  $: previewColor = temperatureToColor(temperature);

  function temperatureToColor(temp: number): string {
    // Approximate color temperature to RGB
    // Warmer = more orange/red, cooler = more blue
    if (temp >= 6500) return '#ffffff';
    if (temp <= 1900) return '#ff9329';
    
    const ratio = (temp - 1900) / (6500 - 1900);
    const r = 255;
    const g = Math.round(147 + ratio * 108);
    const b = Math.round(41 + ratio * 214);
    return `rgb(${r}, ${g}, ${b})`;
  }

  async function loadStatus() {
    try {
      status = await invoke<NightLightStatus>('nightlight_get_status');
      const rawPresets = await invoke<[string, number][]>('nightlight_get_presets');
      presets = rawPresets.map(([name, value]) => ({ name, value }));
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load night light status';
    } finally {
      loading = false;
    }
  }

  async function toggle() {
    try {
      status = await invoke<NightLightStatus>('nightlight_toggle');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to toggle night light';
    }
  }

  async function setMode(newMode: NightLightMode) {
    try {
      status = await invoke<NightLightStatus>('nightlight_set_mode', { mode: newMode });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to set mode';
    }
  }

  async function setTemperature(temp: number) {
    try {
      status = await invoke<NightLightStatus>('nightlight_set_temperature', { temperature: temp });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to set temperature';
    }
  }

  async function setSchedule(startTime: string, endTime: string, transitionMinutes?: number) {
    try {
      status = await invoke<NightLightStatus>('nightlight_set_schedule', {
        startTime,
        endTime,
        transitionMinutes
      });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to set schedule';
    }
  }

  function handleTemperatureChange(e: Event) {
    const target = e.target as HTMLInputElement;
    setTemperature(parseInt(target.value, 10));
  }

  function handleStartTimeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (status) {
      setSchedule(target.value, status.settings.schedule.endTime);
    }
  }

  function handleEndTimeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (status) {
      setSchedule(status.settings.schedule.startTime, target.value);
    }
  }

  onMount(async () => {
    await loadStatus();
    
    // Listen for status changes
    unlistenFn = await listen<NightLightStatus>('nightlight-changed', (event) => {
      status = event.payload;
      // Apply CSS filter to document root for global effect
      applyFilter(event.payload.cssFilter);
    });

    // Apply initial filter
    if (status) {
      applyFilter(status.cssFilter);
    }
  });

  onDestroy(() => {
    if (unlistenFn) {
      unlistenFn();
    }
  });

  function applyFilter(filter: string) {
    // Apply the color temperature filter to the main content
    // The filter is applied via a custom property that can be used in CSS
    document.documentElement.style.setProperty('--nightlight-filter', filter);
  }
</script>

<div class="night-light-manager" class:compact>
  {#if loading}
    <div class="loading">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading night light settings...</span>
    </div>
  {:else if error}
    <div class="error" role="alert">
      <span class="error-icon" aria-hidden="true">⚠️</span>
      <span>{error}</span>
      <button on:click={loadStatus} class="retry-btn">Retry</button>
    </div>
  {:else}
    {#if compact}
      <!-- Compact view: just toggle and status -->
      <button
        class="compact-toggle"
        class:active={isActive}
        on:click={toggle}
        aria-pressed={isActive}
        title={statusText}
      >
        <span class="icon" aria-hidden="true">🌙</span>
        <span class="label">{isActive ? 'On' : 'Off'}</span>
        <span
          class="color-preview"
          style="background-color: {previewColor}"
          aria-hidden="true"
        ></span>
      </button>
    {:else}
      <!-- Full view -->
      <div class="header">
        <div class="title-row">
          <span class="icon" aria-hidden="true">🌙</span>
          <h3>Night Light</h3>
          <button
            class="toggle-btn"
            class:active={isActive}
            on:click={toggle}
            aria-pressed={isActive}
          >
            {isActive ? 'On' : 'Off'}
          </button>
        </div>
        <p class="status-text">{statusText}</p>
      </div>

      {#if showSettings}
        <div class="settings">
          <!-- Mode selector -->
          <div class="setting-group">
            <label class="setting-label">Mode</label>
            <div class="mode-buttons" role="radiogroup" aria-label="Night light mode">
              <button
                class="mode-btn"
                class:selected={mode === 'off'}
                on:click={() => setMode('off')}
                role="radio"
                aria-checked={mode === 'off'}
              >
                Off
              </button>
              <button
                class="mode-btn"
                class:selected={mode === 'manual'}
                on:click={() => setMode('manual')}
                role="radio"
                aria-checked={mode === 'manual'}
              >
                Manual
              </button>
              <button
                class="mode-btn"
                class:selected={mode === 'scheduled'}
                on:click={() => setMode('scheduled')}
                role="radio"
                aria-checked={mode === 'scheduled'}
              >
                Schedule
              </button>
              <button
                class="mode-btn"
                class:selected={mode === 'sunset-to-sunrise'}
                on:click={() => setMode('sunset-to-sunrise')}
                role="radio"
                aria-checked={mode === 'sunset-to-sunrise'}
              >
                Auto
              </button>
            </div>
          </div>

          <!-- Temperature slider -->
          <div class="setting-group">
            <label class="setting-label" for="temp-slider">
              Color Temperature
              <span class="temp-value">{temperature}K</span>
            </label>
            <div class="temp-slider-container">
              <span class="temp-label warm">Warm</span>
              <input
                id="temp-slider"
                type="range"
                min="1900"
                max="6500"
                step="100"
                value={temperature}
                on:input={handleTemperatureChange}
                style="--preview-color: {previewColor}"
              />
              <span class="temp-label cool">Cool</span>
            </div>
            <div
              class="color-bar"
              style="background: linear-gradient(to right, #ff9329, #ffd4a3, #ffffff)"
              aria-hidden="true"
            ></div>
          </div>

          <!-- Presets -->
          <div class="setting-group">
            <label class="setting-label">Presets</label>
            <div class="presets">
              {#each presets as preset}
                <button
                  class="preset-btn"
                  class:selected={temperature === preset.value}
                  on:click={() => setTemperature(preset.value)}
                  style="--preset-color: {temperatureToColor(preset.value)}"
                >
                  <span
                    class="preset-swatch"
                    style="background-color: {temperatureToColor(preset.value)}"
                    aria-hidden="true"
                  ></span>
                  {preset.name}
                </button>
              {/each}
            </div>
          </div>

          <!-- Schedule (if scheduled mode) -->
          {#if mode === 'scheduled' && status}
            <div class="setting-group">
              <label class="setting-label">Schedule</label>
              <div class="schedule-inputs">
                <div class="time-input">
                  <label for="start-time">Turn on at</label>
                  <input
                    id="start-time"
                    type="time"
                    value={status.settings.schedule.startTime}
                    on:change={handleStartTimeChange}
                  />
                </div>
                <div class="time-input">
                  <label for="end-time">Turn off at</label>
                  <input
                    id="end-time"
                    type="time"
                    value={status.settings.schedule.endTime}
                    on:change={handleEndTimeChange}
                  />
                </div>
              </div>
            </div>
          {/if}

          <!-- Preview -->
          <div class="setting-group">
            <label class="setting-label">Preview</label>
            <div
              class="preview-area"
              style="filter: {cssFilter}"
            >
              <p>This is how content will look with night light active.</p>
              <div class="preview-colors">
                <span style="background: #3b82f6"></span>
                <span style="background: #10b981"></span>
                <span style="background: #f59e0b"></span>
                <span style="background: #ef4444"></span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .night-light-manager {
    padding: 1rem;
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 0.75rem;
    color: var(--text-primary, #fff);
  }

  .night-light-manager.compact {
    padding: 0.5rem;
    background: transparent;
  }

  .loading,
  .error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error {
    background: rgba(239, 68, 68, 0.1);
    border-radius: 0.5rem;
  }

  .retry-btn {
    margin-left: auto;
    padding: 0.25rem 0.75rem;
    background: var(--accent-color, #3b82f6);
    border: none;
    border-radius: 0.25rem;
    color: white;
    cursor: pointer;
  }

  .header {
    margin-bottom: 1rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-row .icon {
    font-size: 1.5rem;
  }

  .title-row h3 {
    margin: 0;
    flex: 1;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .toggle-btn {
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 1rem;
    color: var(--text-secondary, #999);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-btn.active {
    background: var(--accent-color, #3b82f6);
    border-color: var(--accent-color, #3b82f6);
    color: white;
  }

  .status-text {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #999);
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setting-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary, #999);
  }

  .temp-value {
    color: var(--text-primary, #fff);
    font-weight: 600;
  }

  .mode-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .mode-btn {
    flex: 1;
    padding: 0.5rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    color: var(--text-secondary, #999);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .mode-btn:hover {
    background: var(--bg-hover, #333);
  }

  .mode-btn.selected {
    background: var(--accent-color, #3b82f6);
    border-color: var(--accent-color, #3b82f6);
    color: white;
  }

  .temp-slider-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .temp-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #999);
  }

  .temp-label.warm { color: #ff9329; }
  .temp-label.cool { color: #93c5fd; }

  input[type="range"] {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 0.5rem;
    background: linear-gradient(to right, #ff9329, #ffd4a3, #ffffff);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    background: var(--preview-color, #fff);
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    background: var(--preview-color, #fff);
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }

  .color-bar {
    height: 0.25rem;
    border-radius: 0.125rem;
    margin-top: 0.25rem;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .preset-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    border-color: var(--preset-color);
  }

  .preset-btn.selected {
    border-color: var(--preset-color);
    box-shadow: 0 0 0 1px var(--preset-color);
  }

  .preset-swatch {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .schedule-inputs {
    display: flex;
    gap: 1rem;
  }

  .time-input {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .time-input label {
    font-size: 0.75rem;
    color: var(--text-secondary, #999);
  }

  .time-input input {
    padding: 0.5rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.375rem;
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
  }

  .preview-area {
    padding: 1rem;
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 0.5rem;
    text-align: center;
  }

  .preview-area p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
  }

  .preview-colors {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .preview-colors span {
    width: 2rem;
    height: 2rem;
    border-radius: 0.25rem;
  }

  /* Compact toggle */
  .compact-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .compact-toggle:hover {
    background: var(--bg-hover, #333);
  }

  .compact-toggle.active {
    border-color: var(--accent-color, #3b82f6);
  }

  .compact-toggle .icon {
    font-size: 1rem;
  }

  .compact-toggle .label {
    font-size: 0.875rem;
  }

  .compact-toggle .color-preview {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
</style>
