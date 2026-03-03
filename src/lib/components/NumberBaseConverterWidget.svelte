<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputValue = $state('');
  let inputBase = $state<2 | 8 | 10 | 16>(10);
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let bitWidth = $state<8 | 16 | 32 | 64>(32);
  let showSigned = $state(false);

  const bases = [
    { value: 2, label: 'BIN', name: 'Binary', prefix: '0b' },
    { value: 8, label: 'OCT', name: 'Octal', prefix: '0o' },
    { value: 10, label: 'DEC', name: 'Decimal', prefix: '' },
    { value: 16, label: 'HEX', name: 'Hexadecimal', prefix: '0x' },
  ] as const;

  const bitWidths = [8, 16, 32, 64] as const;

  // Parse the input value considering different prefixes
  function parseInput(value: string, base: number): bigint | null {
    if (!value.trim()) return null;
    
    let cleanValue = value.trim().toLowerCase();
    let detectedBase = base;
    
    // Auto-detect prefixes
    if (cleanValue.startsWith('0x') || cleanValue.startsWith('0X')) {
      cleanValue = cleanValue.slice(2);
      detectedBase = 16;
    } else if (cleanValue.startsWith('0b') || cleanValue.startsWith('0B')) {
      cleanValue = cleanValue.slice(2);
      detectedBase = 2;
    } else if (cleanValue.startsWith('0o') || cleanValue.startsWith('0O')) {
      cleanValue = cleanValue.slice(2);
      detectedBase = 8;
    }
    
    // Remove spaces and underscores (common separators)
    cleanValue = cleanValue.replace(/[\s_]/g, '');
    
    // Validate characters for the base
    const validChars = '0123456789abcdef'.slice(0, detectedBase);
    const regex = new RegExp(`^-?[${validChars}]+$`, 'i');
    
    if (!regex.test(cleanValue)) {
      return null;
    }
    
    try {
      const isNegative = cleanValue.startsWith('-');
      if (isNegative) cleanValue = cleanValue.slice(1);
      
      let result = BigInt(0);
      const baseBigInt = BigInt(detectedBase);
      
      for (const char of cleanValue) {
        const digit = parseInt(char, 16);
        result = result * baseBigInt + BigInt(digit);
      }
      
      return isNegative ? -result : result;
    } catch {
      return null;
    }
  }

  // Convert a bigint to a specific base with formatting
  function formatNumber(value: bigint, base: number, addGrouping: boolean = true): string {
    if (value === BigInt(0)) return '0';
    
    const isNegative = value < 0;
    let absValue = isNegative ? -value : value;
    
    let result = '';
    const baseBigInt = BigInt(base);
    const digits = '0123456789ABCDEF';
    
    while (absValue > 0) {
      const digit = Number(absValue % baseBigInt);
      result = digits[digit] + result;
      absValue = absValue / baseBigInt;
    }
    
    // Add grouping for readability
    if (addGrouping && result.length > 4) {
      const groupSize = base === 2 ? 4 : base === 16 ? 4 : 3;
      const parts: string[] = [];
      let remaining = result;
      
      while (remaining.length > 0) {
        const start = Math.max(0, remaining.length - groupSize);
        parts.unshift(remaining.slice(start));
        remaining = remaining.slice(0, start);
      }
      
      result = parts.join(base === 10 ? ',' : ' ');
    }
    
    return (isNegative ? '-' : '') + result;
  }

  // Get two's complement representation for signed display
  function getTwosComplement(value: bigint, bits: number): bigint {
    const maxValue = BigInt(1) << BigInt(bits);
    
    if (value < 0) {
      // Convert negative to two's complement
      return maxValue + value;
    }
    return value;
  }

  // Parse two's complement back to signed
  function fromTwosComplement(value: bigint, bits: number): bigint {
    const signBit = BigInt(1) << BigInt(bits - 1);
    
    if (value >= signBit) {
      // Negative number in two's complement
      const maxValue = BigInt(1) << BigInt(bits);
      return value - maxValue;
    }
    return value;
  }

  // Computed conversions
  let parsedValue = $derived.by(() => {
    error = null;
    const parsed = parseInput(inputValue, inputBase);
    
    if (inputValue.trim() && parsed === null) {
      error = `Invalid ${bases.find(b => b.value === inputBase)?.name.toLowerCase()} number`;
      return null;
    }
    
    // Check bit width limits for unsigned
    if (parsed !== null && !showSigned) {
      const maxValue = (BigInt(1) << BigInt(bitWidth)) - BigInt(1);
      if (parsed < 0 || parsed > maxValue) {
        error = `Value out of range for ${bitWidth}-bit unsigned (0 to ${maxValue})`;
        return null;
      }
    }
    
    // Check bit width limits for signed
    if (parsed !== null && showSigned) {
      const minValue = -(BigInt(1) << BigInt(bitWidth - 1));
      const maxValue = (BigInt(1) << BigInt(bitWidth - 1)) - BigInt(1);
      if (parsed < minValue || parsed > maxValue) {
        error = `Value out of range for ${bitWidth}-bit signed (${minValue} to ${maxValue})`;
        return null;
      }
    }
    
    return parsed;
  });

  let conversions = $derived.by(() => {
    if (parsedValue === null) return null;
    
    const value = showSigned && parsedValue < 0 
      ? getTwosComplement(parsedValue, bitWidth)
      : parsedValue;
    
    return {
      binary: formatNumber(value, 2),
      binaryRaw: value.toString(2).toUpperCase(),
      octal: formatNumber(value, 8),
      octalRaw: value.toString(8),
      decimal: formatNumber(parsedValue, 10),
      decimalRaw: parsedValue.toString(),
      hex: formatNumber(value, 16),
      hexRaw: value.toString(16).toUpperCase(),
      signedDecimal: showSigned ? fromTwosComplement(value, bitWidth).toString() : null,
    };
  });

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      copyFeedback = `${label} copied!`;
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

  function clearInput() {
    inputValue = '';
    error = null;
  }

  function setFromBase(base: 2 | 8 | 10 | 16, value: string) {
    inputBase = base;
    inputValue = value;
  }

  function insertSampleValue() {
    inputValue = '255';
    inputBase = 10;
  }
</script>

<div class="converter-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🔢</span>
      <span class="label">Base Converter</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={clearInput} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Input Section -->
    <div class="input-section">
      <div class="input-header">
        <label class="input-label">Input</label>
        <select bind:value={inputBase} class="base-select">
          {#each bases as base}
            <option value={base.value}>{base.label} ({base.name})</option>
          {/each}
        </select>
      </div>
      <div class="input-wrapper">
        <span class="prefix">{bases.find(b => b.value === inputBase)?.prefix || ''}</span>
        <input 
          type="text" 
          bind:value={inputValue}
          placeholder={`Enter ${bases.find(b => b.value === inputBase)?.name.toLowerCase()} number...`}
          class="text-input"
          class:has-prefix={bases.find(b => b.value === inputBase)?.prefix}
        />
      </div>
      {#if !inputValue.trim()}
        <button class="sample-btn" onclick={insertSampleValue}>
          Try: 255 (decimal)
        </button>
      {/if}
    </div>

    <!-- Options -->
    <div class="options">
      <div class="option-group">
        <label class="option-label">Bit Width</label>
        <div class="bit-toggle">
          {#each bitWidths as width}
            <button 
              class="bit-btn"
              class:active={bitWidth === width}
              onclick={() => bitWidth = width}
            >
              {width}
            </button>
          {/each}
        </div>
      </div>
      
      <label class="signed-toggle">
        <input type="checkbox" bind:checked={showSigned} />
        <span>Signed</span>
      </label>
    </div>

    <!-- Error Display -->
    {#if error}
      <div class="error-box">{error}</div>
    {/if}

    <!-- Results -->
    {#if conversions}
      <div class="results">
        {#each bases as base}
          {@const value = base.value === 2 ? conversions.binary 
            : base.value === 8 ? conversions.octal 
            : base.value === 10 ? conversions.decimal 
            : conversions.hex}
          {@const rawValue = base.value === 2 ? conversions.binaryRaw 
            : base.value === 8 ? conversions.octalRaw 
            : base.value === 10 ? conversions.decimalRaw 
            : conversions.hexRaw}
          
          <div class="result-row" class:active={inputBase === base.value}>
            <div class="result-header">
              <span class="result-label">{base.label}</span>
              <span class="result-name">{base.name}</span>
            </div>
            <div class="result-value-row">
              <code class="result-value">
                {#if base.prefix}<span class="value-prefix">{base.prefix}</span>{/if}{value}
              </code>
              <div class="result-actions">
                <button 
                  class="copy-btn" 
                  onclick={() => copyValue(rawValue, base.label)}
                  title="Copy raw value"
                >
                  📋
                </button>
                {#if inputBase !== base.value}
                  <button 
                    class="use-btn" 
                    onclick={() => setFromBase(base.value, rawValue)}
                    title="Use as input"
                  >
                    ↑
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}

        <!-- Additional info for signed numbers -->
        {#if showSigned && conversions.signedDecimal}
          <div class="signed-info">
            <span class="info-label">Signed value:</span>
            <span class="info-value">{conversions.signedDecimal}</span>
          </div>
        {/if}
      </div>

      <!-- Bit visualization (non-compact only) -->
      {#if !compact && parsedValue !== null}
        {@const displayValue = showSigned && parsedValue < 0 
          ? getTwosComplement(parsedValue, bitWidth)
          : parsedValue}
        {@const binaryStr = displayValue.toString(2).padStart(bitWidth, '0')}
        
        <div class="bit-visual">
          <div class="bit-label">Bit Pattern ({bitWidth}-bit)</div>
          <div class="bits">
            {#each binaryStr.split('') as bit, i}
              {#if i > 0 && (bitWidth - i) % 4 === 0}
                <span class="bit-separator"></span>
              {/if}
              <span class="bit" class:one={bit === '1'} class:sign-bit={showSigned && i === 0}>
                {bit}
              </span>
            {/each}
          </div>
          {#if showSigned}
            <div class="bit-legend">
              <span class="legend-item"><span class="legend-color sign"></span>Sign bit</span>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Copy feedback -->
    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .converter-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 380px;
  }

  .converter-widget.compact {
    padding: 8px;
    max-width: 280px;
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

  .action-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .input-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .base-select {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--text-normal, #dcddde);
    font-size: 11px;
    cursor: pointer;
  }

  .base-select:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .prefix {
    position: absolute;
    left: 8px;
    color: var(--text-muted, #72767d);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    pointer-events: none;
  }

  .text-input {
    width: 100%;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }

  .text-input.has-prefix {
    padding-left: 28px;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .sample-btn {
    align-self: flex-start;
    background: transparent;
    border: 1px dashed var(--text-muted, #72767d);
    color: var(--text-muted, #72767d);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sample-btn:hover {
    border-color: var(--brand-experiment, #5865f2);
    color: var(--brand-experiment, #5865f2);
  }

  .options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .option-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .option-label {
    font-size: 10px;
    color: var(--text-muted, #72767d);
  }

  .bit-toggle {
    display: flex;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    overflow: hidden;
  }

  .bit-btn {
    background: transparent;
    border: none;
    padding: 4px 8px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 10px;
    transition: all 0.15s ease;
  }

  .bit-btn.active {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }

  .bit-btn:hover:not(.active) {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .signed-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .signed-toggle input {
    cursor: pointer;
  }

  .error-box {
    background: rgba(237, 66, 69, 0.1);
    border: 1px solid var(--text-danger, #ed4245);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-danger, #ed4245);
    font-size: 12px;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-row {
    background: var(--background-tertiary, #202225);
    border-radius: 6px;
    padding: 8px 10px;
    transition: all 0.15s ease;
  }

  .result-row.active {
    border-left: 3px solid var(--brand-experiment, #5865f2);
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .result-label {
    font-weight: 700;
    font-size: 11px;
    color: var(--brand-experiment, #5865f2);
    min-width: 32px;
  }

  .result-name {
    font-size: 10px;
    color: var(--text-muted, #72767d);
  }

  .result-value-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .result-value {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    color: var(--text-normal, #dcddde);
    word-break: break-all;
    flex: 1;
  }

  .value-prefix {
    color: var(--text-muted, #72767d);
  }

  .result-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .copy-btn,
  .use-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .copy-btn:hover,
  .use-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .signed-info {
    display: flex;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(88, 101, 242, 0.1);
    border-radius: 4px;
    font-size: 11px;
  }

  .info-label {
    color: var(--text-muted, #72767d);
  }

  .info-value {
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .bit-visual {
    background: var(--background-tertiary, #202225);
    border-radius: 6px;
    padding: 10px;
  }

  .bit-label {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    margin-bottom: 8px;
  }

  .bits {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .bit {
    width: 16px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary, #2f3136);
    color: var(--text-muted, #72767d);
    font-size: 10px;
    border-radius: 2px;
  }

  .bit.one {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }

  .bit.sign-bit {
    border: 1px solid var(--text-warning, #faa61a);
  }

  .bit-separator {
    width: 4px;
  }

  .bit-legend {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    font-size: 9px;
    color: var(--text-muted, #72767d);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-color {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid var(--text-warning, #faa61a);
    background: var(--background-secondary, #2f3136);
  }

  .feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }
</style>
