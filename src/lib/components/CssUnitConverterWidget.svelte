<script lang="ts">
  let inputValue: number = 16;
  let fromUnit: string = 'px';
  let rootFontSize: number = 16;
  let viewportWidth: number = 1920;
  let viewportHeight: number = 1080;
  let showCopyFeedback: boolean = false;
  let copyFeedbackText: string = '';
  let showSettings: boolean = false;

  type UnitType = 'absolute' | 'relative' | 'viewport';

  interface UnitDef {
    name: string;
    label: string;
    type: UnitType;
    description: string;
  }

  const units: UnitDef[] = [
    { name: 'px', label: 'px', type: 'absolute', description: 'Pixels - 1/96th of 1 inch' },
    { name: 'rem', label: 'rem', type: 'relative', description: 'Relative to root font size' },
    { name: 'em', label: 'em', type: 'relative', description: 'Relative to parent font size' },
    { name: 'pt', label: 'pt', type: 'absolute', description: 'Points - 1/72nd of 1 inch' },
    { name: 'pc', label: 'pc', type: 'absolute', description: 'Picas - 1/6th of 1 inch' },
    { name: 'in', label: 'in', type: 'absolute', description: 'Inches' },
    { name: 'cm', label: 'cm', type: 'absolute', description: 'Centimeters' },
    { name: 'mm', label: 'mm', type: 'absolute', description: 'Millimeters' },
    { name: 'vw', label: 'vw', type: 'viewport', description: '1% of viewport width' },
    { name: 'vh', label: 'vh', type: 'viewport', description: '1% of viewport height' },
    { name: 'vmin', label: 'vmin', type: 'viewport', description: '1% of smaller viewport dimension' },
    { name: 'vmax', label: 'vmax', type: 'viewport', description: '1% of larger viewport dimension' },
    { name: '%', label: '%', type: 'relative', description: 'Percentage of parent element' },
  ];

  interface ConversionResult {
    unit: UnitDef;
    value: number;
    formatted: string;
    cssValue: string;
  }

  // Common presets for quick entry
  const presets = [
    { label: '8px', value: 8, unit: 'px' },
    { label: '12px', value: 12, unit: 'px' },
    { label: '14px', value: 14, unit: 'px' },
    { label: '16px', value: 16, unit: 'px' },
    { label: '20px', value: 20, unit: 'px' },
    { label: '24px', value: 24, unit: 'px' },
    { label: '32px', value: 32, unit: 'px' },
    { label: '48px', value: 48, unit: 'px' },
    { label: '1rem', value: 1, unit: 'rem' },
    { label: '1.5rem', value: 1.5, unit: 'rem' },
    { label: '2rem', value: 2, unit: 'rem' },
    { label: '100vw', value: 100, unit: 'vw' },
  ];

  // Common viewport sizes
  const viewportPresets = [
    { label: 'Mobile', width: 375, height: 667 },
    { label: 'Tablet', width: 768, height: 1024 },
    { label: 'Laptop', width: 1366, height: 768 },
    { label: 'Desktop', width: 1920, height: 1080 },
    { label: '4K', width: 3840, height: 2160 },
  ];

  function toPx(value: number, unit: string): number {
    switch (unit) {
      case 'px': return value;
      case 'rem': return value * rootFontSize;
      case 'em': return value * rootFontSize; // Simplified: assumes em = rem for conversion
      case 'pt': return value * (96 / 72);
      case 'pc': return value * 16;
      case 'in': return value * 96;
      case 'cm': return value * (96 / 2.54);
      case 'mm': return value * (96 / 25.4);
      case 'vw': return value * (viewportWidth / 100);
      case 'vh': return value * (viewportHeight / 100);
      case 'vmin': return value * (Math.min(viewportWidth, viewportHeight) / 100);
      case 'vmax': return value * (Math.max(viewportWidth, viewportHeight) / 100);
      case '%': return value * (rootFontSize / 100); // Percentage of root font-size
      default: return value;
    }
  }

  function fromPx(px: number, unit: string): number {
    switch (unit) {
      case 'px': return px;
      case 'rem': return px / rootFontSize;
      case 'em': return px / rootFontSize;
      case 'pt': return px * (72 / 96);
      case 'pc': return px / 16;
      case 'in': return px / 96;
      case 'cm': return px * (2.54 / 96);
      case 'mm': return px * (25.4 / 96);
      case 'vw': return px / (viewportWidth / 100);
      case 'vh': return px / (viewportHeight / 100);
      case 'vmin': return px / (Math.min(viewportWidth, viewportHeight) / 100);
      case 'vmax': return px / (Math.max(viewportWidth, viewportHeight) / 100);
      case '%': return px / (rootFontSize / 100);
      default: return px;
    }
  }

  function formatValue(value: number): string {
    if (Number.isInteger(value)) return value.toString();
    if (Math.abs(value) < 0.001) return '0';
    // Remove trailing zeros
    const formatted = value.toFixed(4);
    return parseFloat(formatted).toString();
  }

  $: conversions = calculateConversions(inputValue, fromUnit, rootFontSize, viewportWidth, viewportHeight);

  function calculateConversions(_val: number, _from: string, _root: number, _vw: number, _vh: number): ConversionResult[] {
    const px = toPx(_val, _from);
    return units
      .filter(u => u.name !== _from)
      .map(u => {
        const value = fromPx(px, u.name);
        const formatted = formatValue(value);
        return {
          unit: u,
          value,
          formatted,
          cssValue: `${formatted}${u.name}`,
        };
      });
  }

  function applyPreset(preset: { value: number; unit: string }) {
    inputValue = preset.value;
    fromUnit = preset.unit;
  }

  function applyViewportPreset(preset: { width: number; height: number }) {
    viewportWidth = preset.width;
    viewportHeight = preset.height;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedbackText = 'Copied!';
      showCopyFeedback = true;
      setTimeout(() => { showCopyFeedback = false; }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function getTypeColor(type: UnitType): string {
    switch (type) {
      case 'absolute': return 'var(--accent, #5865f2)';
      case 'relative': return 'var(--success, #3ba55c)';
      case 'viewport': return 'var(--warning, #faa61a)';
    }
  }
</script>

<div class="css-converter" role="application" aria-label="CSS Unit Converter">
  <div class="header">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
      CSS Unit Converter
    </h3>
    <button
      class="settings-btn"
      on:click={() => showSettings = !showSettings}
      title="Settings"
      aria-label="Toggle settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </div>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="setting-row">
        <label for="root-font-size">Root font size:</label>
        <div class="setting-input-group">
          <input
            id="root-font-size"
            type="number"
            bind:value={rootFontSize}
            min="1"
            max="100"
            step="1"
          />
          <span class="setting-unit">px</span>
        </div>
      </div>
      <div class="setting-row">
        <label for="viewport-w">Viewport:</label>
        <div class="setting-input-group">
          <input
            id="viewport-w"
            type="number"
            bind:value={viewportWidth}
            min="1"
            step="1"
          />
          <span class="setting-sep">x</span>
          <input
            id="viewport-h"
            type="number"
            bind:value={viewportHeight}
            min="1"
            step="1"
          />
          <span class="setting-unit">px</span>
        </div>
      </div>
      <div class="viewport-presets">
        {#each viewportPresets as preset}
          <button
            class="viewport-preset-btn"
            class:active={viewportWidth === preset.width && viewportHeight === preset.height}
            on:click={() => applyViewportPreset(preset)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Input Section -->
  <div class="input-section">
    <div class="input-row">
      <input
        type="number"
        bind:value={inputValue}
        step="any"
        class="value-input"
        aria-label="Value to convert"
      />
      <select bind:value={fromUnit} class="unit-select" aria-label="Source unit">
        {#each units as unit}
          <option value={unit.name}>{unit.label}</option>
        {/each}
      </select>
    </div>
    <div class="input-description">
      {units.find(u => u.name === fromUnit)?.description}
    </div>
  </div>

  <!-- Presets -->
  <div class="presets">
    <span class="presets-label">Quick:</span>
    <div class="preset-buttons">
      {#each presets as preset}
        <button
          class="preset-btn"
          class:active={inputValue === preset.value && fromUnit === preset.unit}
          on:click={() => applyPreset(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Results -->
  <div class="results">
    <div class="results-header">
      <span class="legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--accent, #5865f2)"></span> Absolute</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--success, #3ba55c)"></span> Relative</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--warning, #faa61a)"></span> Viewport</span>
      </span>
    </div>
    <div class="results-grid">
      {#each conversions as result}
        <button
          class="result-row"
          on:click={() => copyToClipboard(result.cssValue)}
          title="Click to copy: {result.cssValue}"
        >
          <span class="result-indicator" style="background: {getTypeColor(result.unit.type)}"></span>
          <span class="result-value">{result.formatted}</span>
          <span class="result-unit">{result.unit.label}</span>
          <span class="result-css">{result.cssValue}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Pixel Preview -->
  <div class="preview-section">
    <div class="preview-label">Visual Preview ({formatValue(toPx(inputValue, fromUnit))}px):</div>
    <div class="preview-bar-container">
      <div
        class="preview-bar"
        style="width: {Math.min(Math.max(toPx(inputValue, fromUnit), 0), 300)}px"
      ></div>
    </div>
  </div>

  <!-- Copy Feedback -->
  {#if showCopyFeedback}
    <div class="copy-feedback" role="status" aria-live="polite">
      {copyFeedbackText}
    </div>
  {/if}
</div>

<style>
  .css-converter {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    color: var(--text-primary, #f2f3f5);
    font-family: var(--font-sans, system-ui, sans-serif);
    position: relative;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header svg {
    color: var(--accent, #5865f2);
  }

  .settings-btn {
    padding: 6px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-secondary, #b5bac1);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .settings-btn:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  /* Settings */
  .settings-panel {
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .setting-row label {
    font-size: 12px;
    color: var(--text-secondary, #b5bac1);
    font-weight: 500;
  }

  .setting-input-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .setting-input-group input {
    width: 70px;
    padding: 4px 8px;
    background: var(--bg-secondary, #2b2d31);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 4px;
    color: var(--text-primary, #f2f3f5);
    font-size: 12px;
    text-align: center;
  }

  .setting-input-group input:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .setting-unit, .setting-sep {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
  }

  .viewport-presets {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .viewport-preset-btn {
    padding: 3px 8px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-secondary, #b5bac1);
    font-size: 10px;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.15s ease;
  }

  .viewport-preset-btn:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .viewport-preset-btn.active {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: white;
  }

  /* Input */
  .input-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-row {
    display: flex;
    gap: 6px;
  }

  .value-input {
    flex: 1;
    padding: 10px 14px;
    background: var(--bg-tertiary, #1e1f22);
    border: 2px solid var(--border-color, #3f4147);
    border-radius: 6px;
    color: var(--text-primary, #f2f3f5);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 18px;
    font-weight: 600;
  }

  .value-input:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .unit-select {
    padding: 10px 14px;
    background: var(--bg-tertiary, #1e1f22);
    border: 2px solid var(--border-color, #3f4147);
    border-radius: 6px;
    color: var(--accent, #5865f2);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    min-width: 80px;
  }

  .unit-select:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .input-description {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    padding-left: 2px;
  }

  /* Presets */
  .presets {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .presets-label {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    font-weight: 500;
  }

  .preset-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 3px 8px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-secondary, #b5bac1);
    font-size: 11px;
    font-family: 'Fira Code', 'Consolas', monospace;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .preset-btn.active {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: white;
  }

  /* Results */
  .results {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .results-header {
    display: flex;
    justify-content: flex-end;
  }

  .legend {
    display: flex;
    gap: 10px;
    font-size: 10px;
    color: var(--text-muted, #949ba4);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }

  .results-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 300px;
    overflow-y: auto;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    color: inherit;
    font-family: inherit;
  }

  .result-row:hover {
    border-color: var(--accent, #5865f2);
    background: rgba(88, 101, 242, 0.08);
  }

  .result-indicator {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .result-value {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
    min-width: 80px;
    text-align: right;
  }

  .result-unit {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    color: var(--text-muted, #949ba4);
    min-width: 40px;
  }

  .result-css {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    color: var(--accent, #5865f2);
    flex: 1;
    text-align: right;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .result-row:hover .result-css {
    opacity: 1;
  }

  /* Preview */
  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
  }

  .preview-label {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    font-weight: 500;
  }

  .preview-bar-container {
    height: 12px;
    background: rgba(88, 101, 242, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .preview-bar {
    height: 100%;
    background: var(--accent, #5865f2);
    border-radius: 4px;
    transition: width 0.2s ease;
    min-width: 1px;
  }

  /* Copy Feedback */
  .copy-feedback {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success, #3ba55c);
    color: white;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    animation: fadeInOut 1.5s ease;
    pointer-events: none;
    z-index: 10;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(8px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  @media (max-width: 400px) {
    .css-converter {
      padding: 12px;
    }
    .value-input {
      font-size: 16px;
    }
    .preset-buttons {
      gap: 3px;
    }
  }
</style>
