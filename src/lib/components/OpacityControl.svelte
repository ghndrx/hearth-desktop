<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { setWindowOpacity, getWindowOpacity } from '$lib/tauri';
  import { settingsStore } from '$lib/stores/settings';
  
  /** Current opacity value (0.1 to 1.0) */
  let opacity = 1.0;
  
  /** Whether opacity control is expanded */
  let isExpanded = false;
  
  /** Loading state */
  let isLoading = true;
  
  /** Debounce timer for opacity changes */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  /** Preset opacity levels */
  const presets = [
    { label: '100%', value: 1.0 },
    { label: '90%', value: 0.9 },
    { label: '80%', value: 0.8 },
    { label: '70%', value: 0.7 },
    { label: '60%', value: 0.6 },
    { label: '50%', value: 0.5 },
  ];
  
  onMount(async () => {
    try {
      // Load saved opacity from settings or get current
      const savedOpacity = $settingsStore.windowOpacity;
      if (savedOpacity !== undefined) {
        opacity = savedOpacity;
        await setWindowOpacity(opacity);
      } else {
        opacity = await getWindowOpacity();
      }
    } catch (error) {
      console.error('Failed to get window opacity:', error);
      opacity = 1.0;
    } finally {
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });
  
  async function handleOpacityChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newOpacity = parseFloat(target.value);
    opacity = newOpacity;
    
    // Debounce the actual window update
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(async () => {
      try {
        await setWindowOpacity(newOpacity);
        // Save to settings
        settingsStore.update(s => ({ ...s, windowOpacity: newOpacity }));
      } catch (error) {
        console.error('Failed to set window opacity:', error);
      }
    }, 50);
  }
  
  async function setPreset(value: number) {
    opacity = value;
    try {
      await setWindowOpacity(value);
      settingsStore.update(s => ({ ...s, windowOpacity: value }));
    } catch (error) {
      console.error('Failed to set window opacity:', error);
    }
  }
  
  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
  
  function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }
</script>

<div class="opacity-control" class:expanded={isExpanded}>
  <button
    class="opacity-toggle"
    on:click={toggleExpanded}
    title="Window Opacity"
    aria-expanded={isExpanded}
    aria-label="Window opacity control"
  >
    <svg
      class="opacity-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- Transparency/layers icon -->
      <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.3" />
      <rect x="6" y="6" width="12" height="12" rx="1" opacity="0.6" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </svg>
    <span class="opacity-value">{formatPercent(opacity)}</span>
  </button>
  
  {#if isExpanded}
    <div class="opacity-panel" role="dialog" aria-label="Opacity settings">
      <div class="panel-header">
        <span class="panel-title">Window Opacity</span>
        <span class="current-value">{formatPercent(opacity)}</span>
      </div>
      
      <div class="slider-container">
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          bind:value={opacity}
          on:input={handleOpacityChange}
          class="opacity-slider"
          aria-label="Opacity slider"
          disabled={isLoading}
        />
        <div class="slider-labels">
          <span>10%</span>
          <span>100%</span>
        </div>
      </div>
      
      <div class="presets">
        {#each presets as preset}
          <button
            class="preset-btn"
            class:active={Math.abs(opacity - preset.value) < 0.01}
            on:click={() => setPreset(preset.value)}
            disabled={isLoading}
          >
            {preset.label}
          </button>
        {/each}
      </div>
      
      <p class="hint">
        Adjust window transparency. Lower values make the window more see-through.
      </p>
    </div>
  {/if}
</div>

<style>
  .opacity-control {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  
  .opacity-toggle {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: var(--bg-tertiary, #2f3136);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 0.375rem;
    color: var(--text-secondary, #b9bbbe);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .opacity-toggle:hover {
    background: var(--bg-secondary, #36393f);
    color: var(--text-primary, #fff);
  }
  
  .opacity-control.expanded .opacity-toggle {
    background: var(--bg-secondary, #36393f);
    border-color: var(--accent-color, #5865f2);
  }
  
  .opacity-icon {
    width: 1rem;
    height: 1rem;
  }
  
  .opacity-value {
    font-weight: 500;
    min-width: 2.5rem;
    text-align: center;
  }
  
  .opacity-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 220px;
    padding: 0.875rem;
    background: var(--bg-floating, #18191c);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    animation: slideIn 0.15s ease;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .panel-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .current-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--accent-color, #5865f2);
  }
  
  .slider-container {
    margin-bottom: 0.75rem;
  }
  
  .opacity-slider {
    width: 100%;
    height: 0.375rem;
    border-radius: 0.25rem;
    background: var(--bg-tertiary, #2f3136);
    appearance: none;
    cursor: pointer;
  }
  
  .opacity-slider::-webkit-slider-thumb {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: var(--accent-color, #5865f2);
    cursor: grab;
    transition: transform 0.1s ease;
  }
  
  .opacity-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  
  .opacity-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.1);
  }
  
  .opacity-slider::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    border: none;
    border-radius: 50%;
    background: var(--accent-color, #5865f2);
    cursor: grab;
  }
  
  .slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.625rem;
    color: var(--text-muted, #72767d);
  }
  
  .presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;
    margin-bottom: 0.75rem;
  }
  
  .preset-btn {
    padding: 0.375rem;
    background: var(--bg-tertiary, #2f3136);
    border: 1px solid transparent;
    border-radius: 0.25rem;
    color: var(--text-secondary, #b9bbbe);
    font-size: 0.6875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.1s ease;
  }
  
  .preset-btn:hover {
    background: var(--bg-secondary, #36393f);
    color: var(--text-primary, #fff);
  }
  
  .preset-btn.active {
    background: var(--accent-color, #5865f2);
    color: #fff;
    border-color: var(--accent-color, #5865f2);
  }
  
  .preset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .hint {
    margin: 0;
    font-size: 0.6875rem;
    color: var(--text-muted, #72767d);
    line-height: 1.4;
  }
</style>
