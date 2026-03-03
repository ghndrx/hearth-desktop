<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  type PaletteType = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochromatic';

  interface ColorPalette {
    name: string;
    baseColor: string;
    colors: string[];
    type: PaletteType;
  }

  let baseColor = $state('#5865f2');
  let selectedType = $state<PaletteType>('complementary');
  let generatedColors = $state<string[]>([]);
  let savedPalettes = $state<ColorPalette[]>([]);
  let copyFeedback = $state<string | null>(null);
  let showSaved = $state(false);

  const paletteTypes: { value: PaletteType; label: string; icon: string }[] = [
    { value: 'complementary', label: 'Complementary', icon: '⚖️' },
    { value: 'analogous', label: 'Analogous', icon: '🌈' },
    { value: 'triadic', label: 'Triadic', icon: '🔺' },
    { value: 'split', label: 'Split-Complementary', icon: '✂️' },
    { value: 'tetradic', label: 'Tetradic', icon: '◆' },
    { value: 'monochromatic', label: 'Monochromatic', icon: '🎨' },
  ];

  // Convert hex to HSL
  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

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

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  // Convert HSL to hex
  function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Generate palette based on type
  function generatePalette(hex: string, type: PaletteType): string[] {
    const hsl = hexToHsl(hex);
    const colors: string[] = [hex];

    switch (type) {
      case 'complementary':
        colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
        break;

      case 'analogous':
        colors.push(hslToHex(hsl.h - 30, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 30, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h - 60, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 60, hsl.s, hsl.l));
        break;

      case 'triadic':
        colors.push(hslToHex(hsl.h + 120, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 240, hsl.s, hsl.l));
        break;

      case 'split':
        colors.push(hslToHex(hsl.h + 150, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 210, hsl.s, hsl.l));
        break;

      case 'tetradic':
        colors.push(hslToHex(hsl.h + 90, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 270, hsl.s, hsl.l));
        break;

      case 'monochromatic':
        colors.push(hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 15)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 15)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 30)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 30)));
        break;
    }

    return colors;
  }

  function updatePalette() {
    generatedColors = generatePalette(baseColor, selectedType);
  }

  async function copyColor(color: string) {
    try {
      await navigator.clipboard.writeText(color.toUpperCase());
      copyFeedback = `${color.toUpperCase()} copied!`;
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    }
  }

  async function copyAllColors() {
    try {
      const text = generatedColors.map(c => c.toUpperCase()).join('\n');
      await navigator.clipboard.writeText(text);
      copyFeedback = 'All colors copied!';
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    }
  }

  function savePalette() {
    const palette: ColorPalette = {
      name: `${paletteTypes.find(p => p.value === selectedType)?.label || selectedType} Palette`,
      baseColor,
      colors: [...generatedColors],
      type: selectedType,
    };
    savedPalettes = [...savedPalettes, palette];
    localStorage.setItem('colorPalettes', JSON.stringify(savedPalettes));
  }

  function loadPalette(palette: ColorPalette) {
    baseColor = palette.baseColor;
    selectedType = palette.type;
    generatedColors = [...palette.colors];
    showSaved = false;
  }

  function deletePalette(index: number) {
    savedPalettes = savedPalettes.filter((_, i) => i !== index);
    localStorage.setItem('colorPalettes', JSON.stringify(savedPalettes));
  }

  function getContrastColor(hex: string): string {
    const hsl = hexToHsl(hex);
    return hsl.l > 50 ? '#000000' : '#ffffff';
  }

  function randomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    baseColor = color;
    updatePalette();
  }

  onMount(() => {
    const saved = localStorage.getItem('colorPalettes');
    if (saved) {
      try {
        savedPalettes = JSON.parse(saved);
      } catch {
        savedPalettes = [];
      }
    }
    updatePalette();
  });

  // Reactive update when inputs change
  $effect(() => {
    void baseColor;
    void selectedType;
    updatePalette();
  });
</script>

<div class="palette-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🎨</span>
      <span class="label">Color Palette</span>
    </div>
    <div class="actions">
      <button 
        class="action-btn" 
        onclick={randomColor}
        title="Random Color"
      >
        🎲
      </button>
      <button 
        class="action-btn"
        onclick={() => showSaved = !showSaved}
        title="Saved Palettes"
        class:active={showSaved}
      >
        💾
      </button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  {#if showSaved}
    <div class="saved-section">
      <div class="section-label">Saved Palettes</div>
      {#if savedPalettes.length === 0}
        <div class="empty-state">No saved palettes yet</div>
      {:else}
        <div class="saved-list">
          {#each savedPalettes as palette, index}
            <div class="saved-item">
              <button class="palette-preview" onclick={() => loadPalette(palette)}>
                {#each palette.colors.slice(0, 4) as color}
                  <span class="preview-swatch" style:background={color}></span>
                {/each}
              </button>
              <span class="palette-name">{palette.name}</span>
              <button class="delete-btn" onclick={() => deletePalette(index)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
      <button class="back-btn" onclick={() => showSaved = false}>← Back to Generator</button>
    </div>
  {:else}
    <div class="content">
      <!-- Color Input -->
      <div class="input-row">
        <label class="color-input-wrapper">
          <input 
            type="color" 
            bind:value={baseColor}
            class="color-picker"
          />
          <input 
            type="text" 
            bind:value={baseColor}
            class="hex-input"
            pattern="^#[0-9A-Fa-f]{6}$"
            maxlength="7"
          />
        </label>
      </div>

      <!-- Palette Type Selector -->
      {#if !compact}
        <div class="type-selector">
          {#each paletteTypes as type}
            <button 
              class="type-btn"
              class:selected={selectedType === type.value}
              onclick={() => selectedType = type.value}
              title={type.label}
            >
              <span class="type-icon">{type.icon}</span>
              {#if !compact}
                <span class="type-label">{type.label}</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <select class="type-select" bind:value={selectedType}>
          {#each paletteTypes as type}
            <option value={type.value}>{type.icon} {type.label}</option>
          {/each}
        </select>
      {/if}

      <!-- Generated Palette -->
      <div class="palette-display">
        <div class="section-label">Generated Colors</div>
        <div class="color-grid">
          {#each generatedColors as color, index}
            <button 
              class="color-swatch"
              style:background={color}
              style:color={getContrastColor(color)}
              onclick={() => copyColor(color)}
              title="Click to copy"
            >
              <span class="swatch-hex">{color.toUpperCase()}</span>
              {#if index === 0}
                <span class="base-badge">BASE</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Copy feedback -->
      {#if copyFeedback}
        <div class="copy-feedback">{copyFeedback}</div>
      {/if}

      <!-- Footer Actions -->
      <div class="widget-footer">
        <button class="footer-btn" onclick={copyAllColors}>
          📋 Copy All
        </button>
        <button class="footer-btn" onclick={savePalette}>
          💾 Save
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .palette-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    min-width: 280px;
    max-width: 320px;
  }

  .palette-widget.compact {
    padding: 8px;
    min-width: 200px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--text-normal, #dcddde);
  }

  .icon {
    font-size: 16px;
  }

  .actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .action-btn:hover,
  .action-btn.active {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input-row {
    display: flex;
    gap: 8px;
  }

  .color-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .color-picker {
    width: 40px;
    height: 32px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }

  .color-picker::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-picker::-webkit-color-swatch {
    border-radius: 4px;
    border: none;
  }

  .hex-input {
    flex: 1;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 6px 10px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    text-transform: uppercase;
  }

  .hex-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .type-selector {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .type-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--background-tertiary, #202225);
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .type-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .type-btn.selected {
    background: var(--brand-experiment, #5865f2);
    color: white;
    border-color: var(--brand-experiment, #5865f2);
  }

  .type-icon {
    font-size: 14px;
  }

  .type-label {
    font-size: 11px;
  }

  .type-select {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-size: 12px;
    cursor: pointer;
  }

  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .palette-display {
    display: flex;
    flex-direction: column;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 6px;
  }

  .color-swatch {
    position: relative;
    aspect-ratio: 1.5;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-weight: 600;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    min-height: 50px;
  }

  .color-swatch:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .swatch-hex {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .base-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 8px;
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 4px;
    border-radius: 3px;
  }

  .copy-feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .widget-footer {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .footer-btn {
    flex: 1;
    padding: 6px 10px;
    background: var(--background-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-normal, #dcddde);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .footer-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.6));
  }

  /* Saved Palettes Section */
  .saved-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted, #72767d);
    font-size: 12px;
    padding: 20px;
  }

  .saved-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .saved-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .palette-preview {
    display: flex;
    gap: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .preview-swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }

  .palette-name {
    flex: 1;
    font-size: 11px;
    color: var(--text-normal, #dcddde);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 6px;
    font-size: 14px;
  }

  .delete-btn:hover {
    color: var(--text-danger, #ed4245);
  }

  .back-btn {
    margin-top: 8px;
    padding: 8px;
    background: transparent;
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-link, #00aff4);
    font-size: 12px;
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }
</style>
