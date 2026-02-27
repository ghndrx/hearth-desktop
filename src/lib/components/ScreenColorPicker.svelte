<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  // Props
  export let onColorPicked: ((color: ColorInfo) => void) | null = null;
  export let showHistory: boolean = true;
  export let maxHistory: number = 20;
  export let defaultFormat: ColorFormat = 'hex';

  // Types
  type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv';

  interface ColorInfo {
    hex: string;
    rgb: { r: number; g: number; b: number };
    hsl: { h: number; s: number; l: number };
    hsv: { h: number; s: number; v: number };
    timestamp: number;
  }

  // State
  let isPicking = false;
  let currentColor: ColorInfo | null = null;
  let colorHistory: ColorInfo[] = [];
  let selectedFormat: ColorFormat = defaultFormat;
  let copyFeedback = '';
  let cursorPosition = { x: 0, y: 0 };
  let previewColor: string | null = null;
  let isSupported = true;
  let errorMessage = '';

  // Load history from storage
  onMount(async () => {
    try {
      const stored = localStorage.getItem('screen-color-picker-history');
      if (stored) {
        colorHistory = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }

    // Check if screen capture is supported
    try {
      const supported = await invoke<boolean>('check_screen_capture_support');
      isSupported = supported;
    } catch {
      // Assume supported if check fails
      isSupported = true;
    }
  });

  // Save history to storage
  function saveHistory(): void {
    try {
      localStorage.setItem('screen-color-picker-history', JSON.stringify(colorHistory));
    } catch {
      // Ignore storage errors
    }
  }

  // Convert RGB to hex
  function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // Convert RGB to HSL
  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Convert RGB to HSV
  function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const v = max;
    const d = max - min;
    const s = max === 0 ? 0 : d / max;

    if (max !== min) {
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  }

  // Create color info from RGB
  function createColorInfo(r: number, g: number, b: number): ColorInfo {
    return {
      hex: rgbToHex(r, g, b),
      rgb: { r, g, b },
      hsl: rgbToHsl(r, g, b),
      hsv: rgbToHsv(r, g, b),
      timestamp: Date.now()
    };
  }

  // Start color picking
  async function startPicking(): Promise<void> {
    if (!isSupported) {
      errorMessage = 'Screen color picking is not supported on this platform';
      return;
    }

    isPicking = true;
    errorMessage = '';

    try {
      // Request screen capture and pixel color
      const result = await invoke<{ r: number; g: number; b: number }>('pick_screen_color');
      
      const colorInfo = createColorInfo(result.r, result.g, result.b);
      currentColor = colorInfo;

      // Add to history
      colorHistory = [colorInfo, ...colorHistory.filter(c => c.hex !== colorInfo.hex)].slice(0, maxHistory);
      saveHistory();

      // Callback
      if (onColorPicked) {
        onColorPicked(colorInfo);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to pick color';
    } finally {
      isPicking = false;
      previewColor = null;
    }
  }

  // Get formatted color string
  function getFormattedColor(color: ColorInfo, format: ColorFormat): string {
    switch (format) {
      case 'hex':
        return color.hex.toUpperCase();
      case 'rgb':
        return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
      case 'hsl':
        return `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`;
      case 'hsv':
        return `hsv(${color.hsv.h}, ${color.hsv.s}%, ${color.hsv.v}%)`;
      default:
        return color.hex;
    }
  }

  // Copy color to clipboard
  async function copyColor(color: ColorInfo, format?: ColorFormat): Promise<void> {
    const text = getFormattedColor(color, format || selectedFormat);
    
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = text;
      setTimeout(() => {
        copyFeedback = '';
      }, 2000);
    } catch {
      errorMessage = 'Failed to copy to clipboard';
    }
  }

  // Remove color from history
  function removeFromHistory(color: ColorInfo): void {
    colorHistory = colorHistory.filter(c => c.timestamp !== color.timestamp);
    saveHistory();
  }

  // Clear all history
  function clearHistory(): void {
    colorHistory = [];
    saveHistory();
  }

  // Get contrasting text color
  function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Format options
  const formatOptions: { value: ColorFormat; label: string }[] = [
    { value: 'hex', label: 'HEX' },
    { value: 'rgb', label: 'RGB' },
    { value: 'hsl', label: 'HSL' },
    { value: 'hsv', label: 'HSV' }
  ];
</script>

<div class="screen-color-picker">
  <div class="picker-header">
    <h3>Screen Color Picker</h3>
    <div class="format-selector">
      {#each formatOptions as option}
        <button
          class="format-btn"
          class:active={selectedFormat === option.value}
          on:click={() => selectedFormat = option.value}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  {#if errorMessage}
    <div class="error-message" transition:fade={{ duration: 200 }}>
      <span class="error-icon">⚠️</span>
      {errorMessage}
      <button class="dismiss-btn" on:click={() => errorMessage = ''}>×</button>
    </div>
  {/if}

  <div class="picker-content">
    <button
      class="pick-button"
      class:picking={isPicking}
      on:click={startPicking}
      disabled={isPicking || !isSupported}
    >
      {#if isPicking}
        <span class="picker-icon">🎯</span>
        <span>Click anywhere on screen...</span>
      {:else}
        <span class="picker-icon">🔍</span>
        <span>Pick Color from Screen</span>
      {/if}
    </button>

    {#if currentColor}
      <div class="current-color" transition:scale={{ duration: 200 }}>
        <div
          class="color-preview"
          style="background-color: {currentColor.hex}"
        >
          <span style="color: {getContrastColor(currentColor.hex)}">
            {getFormattedColor(currentColor, selectedFormat)}
          </span>
        </div>
        <div class="color-details">
          <div class="color-values">
            <div class="value-row">
              <span class="label">HEX:</span>
              <span class="value">{currentColor.hex.toUpperCase()}</span>
              <button class="copy-btn" on:click={() => copyColor(currentColor, 'hex')}>📋</button>
            </div>
            <div class="value-row">
              <span class="label">RGB:</span>
              <span class="value">{currentColor.rgb.r}, {currentColor.rgb.g}, {currentColor.rgb.b}</span>
              <button class="copy-btn" on:click={() => copyColor(currentColor, 'rgb')}>📋</button>
            </div>
            <div class="value-row">
              <span class="label">HSL:</span>
              <span class="value">{currentColor.hsl.h}°, {currentColor.hsl.s}%, {currentColor.hsl.l}%</span>
              <button class="copy-btn" on:click={() => copyColor(currentColor, 'hsl')}>📋</button>
            </div>
            <div class="value-row">
              <span class="label">HSV:</span>
              <span class="value">{currentColor.hsv.h}°, {currentColor.hsv.s}%, {currentColor.hsv.v}%</span>
              <button class="copy-btn" on:click={() => copyColor(currentColor, 'hsv')}>📋</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if copyFeedback}
      <div class="copy-feedback" transition:fade={{ duration: 150 }}>
        ✓ Copied: {copyFeedback}
      </div>
    {/if}
  </div>

  {#if showHistory && colorHistory.length > 0}
    <div class="color-history">
      <div class="history-header">
        <h4>Recent Colors ({colorHistory.length})</h4>
        <button class="clear-btn" on:click={clearHistory}>Clear All</button>
      </div>
      <div class="history-grid">
        {#each colorHistory as color (color.timestamp)}
          <button
            class="history-item"
            style="background-color: {color.hex}"
            title="{getFormattedColor(color, selectedFormat)}"
            on:click={() => {
              currentColor = color;
              copyColor(color);
            }}
            on:contextmenu|preventDefault={() => removeFromHistory(color)}
          >
            <span
              class="history-label"
              style="color: {getContrastColor(color.hex)}"
            >
              {color.hex.toUpperCase().slice(1)}
            </span>
          </button>
        {/each}
      </div>
      <p class="history-hint">Click to copy • Right-click to remove</p>
    </div>
  {/if}
</div>

<style>
  .screen-color-picker {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-primary, #1a1a1a);
    border-radius: 8px;
    color: var(--text-primary, #ffffff);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .picker-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .format-selector {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary, #2a2a2a);
    padding: 4px;
    border-radius: 6px;
  }

  .format-btn {
    padding: 4px 10px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #888);
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .format-btn:hover {
    color: var(--text-primary, #fff);
  }

  .format-btn.active {
    background: var(--accent-color, #5865f2);
    color: white;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #f87171;
    font-size: 0.875rem;
  }

  .dismiss-btn {
    margin-left: auto;
    padding: 0 6px;
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .dismiss-btn:hover {
    opacity: 1;
  }

  .picker-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .pick-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pick-button:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
    transform: translateY(-1px);
  }

  .pick-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pick-button.picking {
    background: var(--warning-color, #f59e0b);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  .picker-icon {
    font-size: 1.25rem;
  }

  .current-color {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 8px;
  }

  .color-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    border-radius: 6px;
    font-size: 1.1rem;
    font-weight: 600;
    font-family: 'Monaco', 'Menlo', monospace;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .color-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .color-values {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .value-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    background: var(--bg-tertiary, #333);
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .value-row .label {
    color: var(--text-secondary, #888);
    font-weight: 500;
    min-width: 40px;
  }

  .value-row .value {
    flex: 1;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8rem;
  }

  .copy-btn {
    padding: 2px 6px;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  .copy-feedback {
    padding: 0.5rem 0.75rem;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 6px;
    color: #4ade80;
    font-size: 0.85rem;
    text-align: center;
  }

  .color-history {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #333);
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .history-header h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary, #888);
  }

  .clear-btn {
    padding: 4px 10px;
    background: none;
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    color: var(--text-secondary, #888);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .clear-btn:hover {
    border-color: var(--danger-color, #ef4444);
    color: var(--danger-color, #ef4444);
  }

  .history-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 6px;
  }

  .history-item {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.15s;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .history-item:hover {
    transform: scale(1.08);
    z-index: 1;
  }

  .history-label {
    font-size: 0.65rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-weight: 600;
    opacity: 0.9;
  }

  .history-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted, #666);
    text-align: center;
  }
</style>
