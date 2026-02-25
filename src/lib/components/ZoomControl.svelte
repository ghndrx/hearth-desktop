<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  
  // Zoom level configuration
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 200;
  const DEFAULT_ZOOM = 100;
  const ZOOM_STEP = 10;
  const STORAGE_KEY = 'hearth-ui-zoom-level';
  
  // Preset zoom levels for quick access
  const ZOOM_PRESETS = [50, 75, 100, 125, 150, 175, 200];
  
  // Current zoom level (percentage)
  export let zoomLevel = writable(DEFAULT_ZOOM);
  export let showPresets = true;
  export let showPercentage = true;
  export let compact = false;
  export let ariaLabel = 'UI zoom controls';
  
  // Derived zoom factor for CSS transforms
  const zoomFactor = derived(zoomLevel, ($zoom) => $zoom / 100);
  
  // Track if component is mounted
  let mounted = false;
  let keyboardShortcutsEnabled = true;
  
  // Keyboard shortcut handler
  function handleKeydown(event: KeyboardEvent) {
    if (!keyboardShortcutsEnabled) return;
    
    const isModifierPressed = event.ctrlKey || event.metaKey;
    
    if (isModifierPressed) {
      switch (event.key) {
        case '=':
        case '+':
          event.preventDefault();
          zoomIn();
          break;
        case '-':
          event.preventDefault();
          zoomOut();
          break;
        case '0':
          event.preventDefault();
          resetZoom();
          break;
      }
    }
  }
  
  // Zoom in by step
  function zoomIn() {
    zoomLevel.update((current) => Math.min(current + ZOOM_STEP, MAX_ZOOM));
    saveZoomLevel();
    announceZoomChange('increased');
  }
  
  // Zoom out by step
  function zoomOut() {
    zoomLevel.update((current) => Math.max(current - ZOOM_STEP, MIN_ZOOM));
    saveZoomLevel();
    announceZoomChange('decreased');
  }
  
  // Reset to default zoom
  function resetZoom() {
    zoomLevel.set(DEFAULT_ZOOM);
    saveZoomLevel();
    announceZoomChange('reset to default');
  }
  
  // Set specific zoom level
  function setZoom(level: number) {
    const clampedLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    zoomLevel.set(clampedLevel);
    saveZoomLevel();
    announceZoomChange(`set to ${clampedLevel}%`);
  }
  
  // Save zoom level to storage
  function saveZoomLevel() {
    try {
      localStorage.setItem(STORAGE_KEY, $zoomLevel.toString());
    } catch (e) {
      console.warn('Failed to save zoom level:', e);
    }
  }
  
  // Load zoom level from storage
  function loadZoomLevel(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load zoom level:', e);
    }
    return DEFAULT_ZOOM;
  }
  
  // Apply zoom to document
  function applyZoom(level: number) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const factor = level / 100;
      
      // Apply CSS zoom (works well in Tauri/WebView)
      root.style.setProperty('--ui-zoom', factor.toString());
      root.style.setProperty('--ui-zoom-percent', `${level}%`);
      
      // Apply font-size scaling for accessibility
      root.style.fontSize = `${factor * 16}px`;
      
      // Emit custom event for other components
      window.dispatchEvent(new CustomEvent('hearth:zoom-change', {
        detail: { level, factor }
      }));
    }
  }
  
  // Announce zoom change for screen readers
  function announceZoomChange(action: string) {
    if (typeof document !== 'undefined') {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Zoom ${action}: ${$zoomLevel}%`;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        announcement.remove();
      }, 1000);
    }
  }
  
  // Handle slider input
  function handleSliderInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    setZoom(value);
  }
  
  // Subscribe to zoom changes and apply
  const unsubscribe = zoomLevel.subscribe((level) => {
    if (mounted) {
      applyZoom(level);
    }
  });
  
  onMount(() => {
    mounted = true;
    
    // Load saved zoom level
    const savedLevel = loadZoomLevel();
    zoomLevel.set(savedLevel);
    applyZoom(savedLevel);
    
    // Add keyboard listener
    window.addEventListener('keydown', handleKeydown);
    
    // Notify Tauri about zoom capability
    invoke('notify_zoom_capability', { enabled: true }).catch(() => {
      // Command may not exist, that's ok
    });
  });
  
  onDestroy(() => {
    mounted = false;
    unsubscribe();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });
  
  // Export functions for external use
  export { zoomIn, zoomOut, resetZoom, setZoom };
</script>

<div 
  class="zoom-control"
  class:compact
  role="group"
  aria-label={ariaLabel}
>
  <div class="zoom-buttons">
    <button
      class="zoom-btn zoom-out"
      on:click={zoomOut}
      disabled={$zoomLevel <= MIN_ZOOM}
      aria-label="Zoom out (Ctrl+-)"
      title="Zoom out (Ctrl+-)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>
    
    {#if showPercentage && !compact}
      <div class="zoom-display" aria-live="polite">
        <span class="zoom-value">{$zoomLevel}%</span>
      </div>
    {/if}
    
    <button
      class="zoom-btn zoom-in"
      on:click={zoomIn}
      disabled={$zoomLevel >= MAX_ZOOM}
      aria-label="Zoom in (Ctrl++)"
      title="Zoom in (Ctrl++)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="11" y1="8" x2="11" y2="14"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    </button>
    
    <button
      class="zoom-btn zoom-reset"
      on:click={resetZoom}
      disabled={$zoomLevel === DEFAULT_ZOOM}
      aria-label="Reset zoom to 100% (Ctrl+0)"
      title="Reset zoom (Ctrl+0)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  </div>
  
  {#if !compact}
    <div class="zoom-slider-container">
      <label for="zoom-slider" class="sr-only">Zoom level</label>
      <input
        id="zoom-slider"
        type="range"
        class="zoom-slider"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={ZOOM_STEP}
        value={$zoomLevel}
        on:input={handleSliderInput}
        aria-valuemin={MIN_ZOOM}
        aria-valuemax={MAX_ZOOM}
        aria-valuenow={$zoomLevel}
        aria-valuetext="{$zoomLevel}% zoom"
      />
    </div>
  {/if}
  
  {#if showPresets && !compact}
    <div class="zoom-presets" role="group" aria-label="Zoom presets">
      {#each ZOOM_PRESETS as preset}
        <button
          class="preset-btn"
          class:active={$zoomLevel === preset}
          on:click={() => setZoom(preset)}
          aria-pressed={$zoomLevel === preset}
        >
          {preset}%
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .zoom-control {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    user-select: none;
  }
  
  .zoom-control.compact {
    flex-direction: row;
    align-items: center;
    padding: 6px 8px;
    gap: 4px;
  }
  
  .zoom-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }
  
  .compact .zoom-buttons {
    gap: 4px;
  }
  
  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary, #40444b);
    color: var(--text-primary, #dcddde);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .compact .zoom-btn {
    width: 28px;
    height: 28px;
  }
  
  .zoom-btn:hover:not(:disabled) {
    background: var(--bg-hover, #4f545c);
    color: var(--text-bright, #fff);
  }
  
  .zoom-btn:active:not(:disabled) {
    transform: scale(0.95);
  }
  
  .zoom-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .zoom-btn:focus-visible {
    outline: 2px solid var(--accent, #5865f2);
    outline-offset: 2px;
  }
  
  .zoom-display {
    min-width: 48px;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #dcddde);
    font-variant-numeric: tabular-nums;
  }
  
  .zoom-slider-container {
    width: 100%;
    padding: 0 4px;
  }
  
  .zoom-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-tertiary, #40444b);
    appearance: none;
    cursor: pointer;
  }
  
  .zoom-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent, #5865f2);
    border: 2px solid var(--bg-primary, #36393f);
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  
  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }
  
  .zoom-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent, #5865f2);
    border: 2px solid var(--bg-primary, #36393f);
    cursor: pointer;
  }
  
  .zoom-slider:focus-visible {
    outline: 2px solid var(--accent, #5865f2);
    outline-offset: 4px;
  }
  
  .zoom-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  
  .preset-btn {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--border, #4f545c);
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary, #b9bbbe);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .preset-btn:hover {
    background: var(--bg-hover, #4f545c);
    color: var(--text-primary, #dcddde);
  }
  
  .preset-btn.active {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: #fff;
  }
  
  .preset-btn:focus-visible {
    outline: 2px solid var(--accent, #5865f2);
    outline-offset: 2px;
  }
  
  /* Screen reader only class */
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
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .zoom-btn {
      border: 2px solid currentColor;
    }
    
    .zoom-slider {
      border: 1px solid currentColor;
    }
    
    .preset-btn {
      border-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .zoom-btn,
    .zoom-slider::-webkit-slider-thumb,
    .preset-btn {
      transition: none;
    }
    
    .zoom-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>
