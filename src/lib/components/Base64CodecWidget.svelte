<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputText = $state('');
  let outputText = $state('');
  let mode = $state<'encode' | 'decode'>('encode');
  let encoding = $state<'base64' | 'base64url' | 'url' | 'html' | 'hex'>('base64');
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let autoConvert = $state(true);

  const encodings = [
    { id: 'base64', label: 'Base64', desc: 'Standard Base64' },
    { id: 'base64url', label: 'Base64URL', desc: 'URL-safe Base64' },
    { id: 'url', label: 'URL', desc: 'URL encoding' },
    { id: 'html', label: 'HTML', desc: 'HTML entities' },
    { id: 'hex', label: 'Hex', desc: 'Hexadecimal' },
  ] as const;

  function convert() {
    error = null;
    if (!inputText.trim()) {
      outputText = '';
      return;
    }

    try {
      if (mode === 'encode') {
        outputText = encode(inputText, encoding);
      } else {
        outputText = decode(inputText, encoding);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Conversion failed';
      outputText = '';
    }
  }

  function encode(text: string, enc: typeof encoding): string {
    switch (enc) {
      case 'base64':
        return btoa(unescape(encodeURIComponent(text)));
      
      case 'base64url':
        return btoa(unescape(encodeURIComponent(text)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      
      case 'url':
        return encodeURIComponent(text);
      
      case 'html':
        return text.replace(/[&<>"']/g, (c) => {
          const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          };
          return entities[c] || c;
        });
      
      case 'hex':
        return Array.from(new TextEncoder().encode(text))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      
      default:
        return text;
    }
  }

  function decode(text: string, enc: typeof encoding): string {
    switch (enc) {
      case 'base64':
        return decodeURIComponent(escape(atob(text)));
      
      case 'base64url':
        // Add padding back
        let padded = text.replace(/-/g, '+').replace(/_/g, '/');
        while (padded.length % 4) padded += '=';
        return decodeURIComponent(escape(atob(padded)));
      
      case 'url':
        return decodeURIComponent(text);
      
      case 'html':
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent || '';
      
      case 'hex':
        const bytes = text.match(/.{1,2}/g) || [];
        return new TextDecoder().decode(
          new Uint8Array(bytes.map(b => parseInt(b, 16)))
        );
      
      default:
        return text;
    }
  }

  async function copyOutput() {
    if (!outputText) return;
    
    try {
      await navigator.clipboard.writeText(outputText);
      copyFeedback = 'Copied!';
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

  function swapTexts() {
    const temp = inputText;
    inputText = outputText;
    outputText = temp;
    mode = mode === 'encode' ? 'decode' : 'encode';
  }

  function clearAll() {
    inputText = '';
    outputText = '';
    error = null;
  }

  function toggleMode() {
    mode = mode === 'encode' ? 'decode' : 'encode';
    // Swap input/output when toggling
    swapTexts();
  }

  // Auto-convert effect
  $effect(() => {
    if (autoConvert && inputText) {
      convert();
    }
  });
</script>

<div class="codec-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🔐</span>
      <span class="label">Encoder/Decoder</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Mode & Encoding Selection -->
    <div class="controls">
      <div class="mode-toggle">
        <button 
          class="mode-btn"
          class:active={mode === 'encode'}
          onclick={() => mode = 'encode'}
        >
          Encode
        </button>
        <button 
          class="mode-btn"
          class:active={mode === 'decode'}
          onclick={() => mode = 'decode'}
        >
          Decode
        </button>
      </div>

      <div class="encoding-select">
        <select bind:value={encoding} class="select-input">
          {#each encodings as enc}
            <option value={enc.id}>{enc.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Encoding description -->
    {#if !compact}
      <div class="encoding-desc">
        {encodings.find(e => e.id === encoding)?.desc || ''}
      </div>
    {/if}

    <!-- Input -->
    <div class="input-section">
      <label class="input-label">
        {mode === 'encode' ? 'Plain Text' : 'Encoded Text'}
      </label>
      <textarea 
        bind:value={inputText}
        placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter encoded text to decode...'}
        rows={compact ? 2 : 3}
        class="text-input"
        oninput={() => autoConvert && convert()}
      ></textarea>
    </div>

    <!-- Convert Button -->
    {#if !autoConvert}
      <button class="convert-btn" onclick={convert}>
        {mode === 'encode' ? 'Encode →' : 'Decode →'}
      </button>
    {/if}

    <!-- Output -->
    <div class="output-section">
      <div class="output-header">
        <label class="input-label">
          {mode === 'encode' ? 'Encoded Result' : 'Decoded Result'}
        </label>
        <div class="output-actions">
          <button 
            class="icon-btn" 
            onclick={swapTexts} 
            title="Swap & toggle mode"
            disabled={!outputText}
          >
            ↕
          </button>
          <button 
            class="icon-btn" 
            onclick={copyOutput} 
            title="Copy output"
            disabled={!outputText}
          >
            {copyFeedback ? '✓' : '📋'}
          </button>
        </div>
      </div>
      
      {#if error}
        <div class="error-text">{error}</div>
      {:else}
        <div class="output-text" class:empty={!outputText}>
          {outputText || 'Result will appear here...'}
        </div>
      {/if}
    </div>

    <!-- Stats -->
    {#if outputText && !compact}
      <div class="stats">
        <span>Input: {inputText.length} chars</span>
        <span>Output: {outputText.length} chars</span>
        {#if encoding === 'base64' || encoding === 'base64url'}
          <span>
            Ratio: {(outputText.length / inputText.length).toFixed(2)}x
          </span>
        {/if}
      </div>
    {/if}

    <!-- Auto-convert toggle -->
    <label class="auto-toggle">
      <input type="checkbox" bind:checked={autoConvert} />
      <span>Auto-convert</span>
    </label>

    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .codec-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 350px;
  }

  .codec-widget.compact {
    padding: 8px;
    max-width: 260px;
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

  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .mode-toggle {
    display: flex;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    overflow: hidden;
  }

  .mode-btn {
    background: transparent;
    border: none;
    padding: 6px 12px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .mode-btn.active {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }

  .mode-btn:hover:not(.active) {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .encoding-select {
    flex: 1;
  }

  .select-input {
    width: 100%;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 6px 8px;
    color: var(--text-normal, #dcddde);
    font-size: 12px;
    cursor: pointer;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .encoding-desc {
    font-size: 11px;
    color: var(--text-muted, #72767d);
    padding-left: 4px;
  }

  .input-section,
  .output-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .text-input {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    resize: vertical;
    min-height: 50px;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .convert-btn {
    background: var(--brand-experiment, #5865f2);
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .convert-btn:hover {
    background: var(--brand-experiment-560, #4752c4);
  }

  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .output-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .output-text {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    min-height: 40px;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: all;
  }

  .output-text.empty {
    color: var(--text-muted, #72767d);
    font-style: italic;
    font-family: inherit;
  }

  .error-text {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-danger, #ed4245);
    font-size: 12px;
    min-height: 40px;
  }

  .stats {
    display: flex;
    gap: 12px;
    font-size: 10px;
    color: var(--text-muted, #72767d);
    padding: 4px 0;
  }

  .auto-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .auto-toggle input {
    cursor: pointer;
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
