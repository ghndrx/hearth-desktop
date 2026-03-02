<script lang="ts">
  /**
   * UnitConverterWidget.svelte
   * A compact unit converter widget for quick conversions.
   * Supports length, weight, temperature, time, and data units.
   */

  // Props
  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  // Unit categories and their units
  const categories: Record<string, UnitCategory> = {
    length: {
      name: 'Length',
      icon: '📏',
      units: [
        { id: 'mm', name: 'Millimeters', factor: 0.001 },
        { id: 'cm', name: 'Centimeters', factor: 0.01 },
        { id: 'm', name: 'Meters', factor: 1 },
        { id: 'km', name: 'Kilometers', factor: 1000 },
        { id: 'in', name: 'Inches', factor: 0.0254 },
        { id: 'ft', name: 'Feet', factor: 0.3048 },
        { id: 'yd', name: 'Yards', factor: 0.9144 },
        { id: 'mi', name: 'Miles', factor: 1609.344 }
      ]
    },
    weight: {
      name: 'Weight',
      icon: '⚖️',
      units: [
        { id: 'mg', name: 'Milligrams', factor: 0.000001 },
        { id: 'g', name: 'Grams', factor: 0.001 },
        { id: 'kg', name: 'Kilograms', factor: 1 },
        { id: 'oz', name: 'Ounces', factor: 0.0283495 },
        { id: 'lb', name: 'Pounds', factor: 0.453592 },
        { id: 'st', name: 'Stones', factor: 6.35029 }
      ]
    },
    temperature: {
      name: 'Temperature',
      icon: '🌡️',
      units: [
        { id: 'c', name: 'Celsius', factor: 1, offset: 0 },
        { id: 'f', name: 'Fahrenheit', factor: 5/9, offset: -32 },
        { id: 'k', name: 'Kelvin', factor: 1, offset: -273.15 }
      ]
    },
    time: {
      name: 'Time',
      icon: '⏱️',
      units: [
        { id: 'ms', name: 'Milliseconds', factor: 0.001 },
        { id: 's', name: 'Seconds', factor: 1 },
        { id: 'min', name: 'Minutes', factor: 60 },
        { id: 'h', name: 'Hours', factor: 3600 },
        { id: 'd', name: 'Days', factor: 86400 },
        { id: 'wk', name: 'Weeks', factor: 604800 }
      ]
    },
    data: {
      name: 'Data',
      icon: '💾',
      units: [
        { id: 'b', name: 'Bytes', factor: 1 },
        { id: 'kb', name: 'Kilobytes', factor: 1024 },
        { id: 'mb', name: 'Megabytes', factor: 1048576 },
        { id: 'gb', name: 'Gigabytes', factor: 1073741824 },
        { id: 'tb', name: 'Terabytes', factor: 1099511627776 }
      ]
    },
    volume: {
      name: 'Volume',
      icon: '🧪',
      units: [
        { id: 'ml', name: 'Milliliters', factor: 0.001 },
        { id: 'l', name: 'Liters', factor: 1 },
        { id: 'gal', name: 'Gallons (US)', factor: 3.78541 },
        { id: 'qt', name: 'Quarts', factor: 0.946353 },
        { id: 'pt', name: 'Pints', factor: 0.473176 },
        { id: 'cup', name: 'Cups', factor: 0.236588 },
        { id: 'floz', name: 'Fluid Oz', factor: 0.0295735 }
      ]
    }
  };

  interface Unit {
    id: string;
    name: string;
    factor: number;
    offset?: number;
  }

  interface UnitCategory {
    name: string;
    icon: string;
    units: Unit[];
  }

  // State
  let selectedCategory = $state('length');
  let fromUnit = $state('m');
  let toUnit = $state('ft');
  let inputValue = $state('1');
  let showCategoryPicker = $state(false);

  // Get current category
  let currentCategory = $derived(categories[selectedCategory]);

  // Convert value
  let result = $derived(() => {
    const value = parseFloat(inputValue);
    if (isNaN(value)) return '—';
    
    const from = currentCategory.units.find(u => u.id === fromUnit);
    const to = currentCategory.units.find(u => u.id === toUnit);
    
    if (!from || !to) return '—';
    
    let converted: number;
    
    // Special handling for temperature
    if (selectedCategory === 'temperature') {
      // Convert to Celsius first
      let celsius: number;
      if (fromUnit === 'c') {
        celsius = value;
      } else if (fromUnit === 'f') {
        celsius = (value - 32) * 5/9;
      } else { // kelvin
        celsius = value - 273.15;
      }
      
      // Convert from Celsius to target
      if (toUnit === 'c') {
        converted = celsius;
      } else if (toUnit === 'f') {
        converted = celsius * 9/5 + 32;
      } else { // kelvin
        converted = celsius + 273.15;
      }
    } else {
      // Standard conversion: value * fromFactor / toFactor
      converted = (value * from.factor) / to.factor;
    }
    
    // Format result
    if (Math.abs(converted) >= 1000000 || (Math.abs(converted) < 0.001 && converted !== 0)) {
      return converted.toExponential(4);
    } else if (Number.isInteger(converted)) {
      return converted.toLocaleString();
    } else {
      return converted.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
  });

  function selectCategory(cat: string) {
    selectedCategory = cat;
    const units = categories[cat].units;
    fromUnit = units[0].id;
    toUnit = units[1]?.id || units[0].id;
    showCategoryPicker = false;
  }

  function swapUnits() {
    const temp = fromUnit;
    fromUnit = toUnit;
    toUnit = temp;
  }

  function getUnitLabel(unitId: string): string {
    const unit = currentCategory.units.find(u => u.id === unitId);
    return unit?.id.toUpperCase() || unitId;
  }
</script>

<div class="unit-converter-widget" class:compact>
  <div class="category-selector">
    <button 
      class="category-btn"
      onclick={() => showCategoryPicker = !showCategoryPicker}
    >
      <span class="category-icon">{currentCategory.icon}</span>
      <span class="category-name">{currentCategory.name}</span>
      <span class="dropdown-arrow">{showCategoryPicker ? '▲' : '▼'}</span>
    </button>
    
    {#if showCategoryPicker}
      <div class="category-dropdown">
        {#each Object.entries(categories) as [key, cat]}
          <button 
            class="category-option"
            class:active={key === selectedCategory}
            onclick={() => selectCategory(key)}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="converter-body">
    <div class="input-row">
      <input
        type="text"
        class="value-input"
        bind:value={inputValue}
        placeholder="Enter value"
        inputmode="decimal"
      />
      <select class="unit-select" bind:value={fromUnit}>
        {#each currentCategory.units as unit}
          <option value={unit.id}>{unit.id.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <button class="swap-btn" onclick={swapUnits} aria-label="Swap units">
      ⇅
    </button>

    <div class="result-row">
      <div class="result-value">{result()}</div>
      <select class="unit-select" bind:value={toUnit}>
        {#each currentCategory.units as unit}
          <option value={unit.id}>{unit.id.toUpperCase()}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="conversion-label">
    {inputValue || '0'} {getUnitLabel(fromUnit)} = {result()} {getUnitLabel(toUnit)}
  </div>
</div>

<style>
  .unit-converter-widget {
    --conv-bg: var(--bg-tertiary, #40444b);
    --conv-input-bg: var(--bg-primary, #36393f);
    --conv-text: var(--text-primary, #ffffff);
    --conv-text-muted: var(--text-muted, #72767d);
    --conv-accent: var(--accent, #5865f2);
    --conv-radius: 6px;

    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .category-selector {
    position: relative;
  }

  .category-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    background: var(--conv-input-bg);
    border: none;
    border-radius: var(--conv-radius);
    color: var(--conv-text);
    cursor: pointer;
    font-size: 0.85rem;
    transition: background-color 0.15s;
  }

  .category-btn:hover {
    background: var(--bg-modifier-hover, #4f545c);
  }

  .category-icon {
    font-size: 1rem;
  }

  .category-name {
    flex: 1;
    text-align: left;
  }

  .dropdown-arrow {
    font-size: 0.7rem;
    color: var(--conv-text-muted);
  }

  .category-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--conv-input-bg);
    border-radius: var(--conv-radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10;
    overflow: hidden;
  }

  .category-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    color: var(--conv-text);
    cursor: pointer;
    font-size: 0.85rem;
    text-align: left;
  }

  .category-option:hover {
    background: var(--bg-modifier-hover, #4f545c);
  }

  .category-option.active {
    background: var(--conv-accent);
  }

  .converter-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .input-row,
  .result-row {
    display: flex;
    gap: 6px;
    width: 100%;
  }

  .value-input {
    flex: 1;
    padding: 8px 10px;
    background: var(--conv-input-bg);
    border: none;
    border-radius: var(--conv-radius);
    color: var(--conv-text);
    font-size: 1rem;
    text-align: right;
    min-width: 0;
  }

  .value-input:focus {
    outline: 2px solid var(--conv-accent);
    outline-offset: -2px;
  }

  .value-input::placeholder {
    color: var(--conv-text-muted);
  }

  .result-value {
    flex: 1;
    padding: 8px 10px;
    background: var(--conv-input-bg);
    border-radius: var(--conv-radius);
    color: var(--conv-accent);
    font-size: 1rem;
    font-weight: 500;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unit-select {
    width: 60px;
    padding: 8px 6px;
    background: var(--conv-input-bg);
    border: none;
    border-radius: var(--conv-radius);
    color: var(--conv-text);
    font-size: 0.8rem;
    cursor: pointer;
    text-align: center;
  }

  .unit-select:focus {
    outline: 2px solid var(--conv-accent);
    outline-offset: -2px;
  }

  .swap-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--conv-input-bg);
    border: none;
    border-radius: 50%;
    color: var(--conv-text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s;
  }

  .swap-btn:hover {
    background: var(--conv-accent);
    color: white;
  }

  .conversion-label {
    font-size: 0.7rem;
    color: var(--conv-text-muted);
    text-align: center;
    padding-top: 4px;
    border-top: 1px solid var(--conv-input-bg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .category-btn {
    padding: 6px 8px;
    font-size: 0.8rem;
  }

  .compact .value-input,
  .compact .result-value {
    padding: 6px 8px;
    font-size: 0.9rem;
  }

  .compact .unit-select {
    width: 50px;
    padding: 6px 4px;
    font-size: 0.75rem;
  }
</style>
