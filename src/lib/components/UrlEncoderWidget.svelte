<script lang="ts">
  import { onMount } from 'svelte';

  let input = '';
  let output = '';
  let mode: 'encode' | 'decode' = 'encode';
  let encodeType: 'component' | 'full' = 'component';
  let copied = false;
  let error = '';

  function processInput() {
    error = '';
    if (!input.trim()) {
      output = '';
      return;
    }

    try {
      if (mode === 'encode') {
        output = encodeType === 'component' 
          ? encodeURIComponent(input)
          : encodeURI(input);
      } else {
        output = encodeType === 'component'
          ? decodeURIComponent(input)
          : decodeURI(input);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid input for decoding';
      output = '';
    }
  }

  function swapInputOutput() {
    const temp = input;
    input = output;
    output = temp;
    mode = mode === 'encode' ? 'decode' : 'encode';
  }

  async function copyToClipboard() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  function clearAll() {
    input = '';
    output = '';
    error = '';
  }

  $: input, mode, encodeType, processInput();

  onMount(() => {
    processInput();
  });
</script>

<div class="url-encoder-widget">
  <div class="widget-header">
    <div class="title">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span>URL Encoder/Decoder</span>
    </div>
    <button class="clear-btn" on:click={clearAll} title="Clear all">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  </div>

  <div class="controls">
    <div class="mode-toggle">
      <button
        class:active={mode === 'encode'}
        on:click={() => mode = 'encode'}
      >
        Encode
      </button>
      <button
        class:active={mode === 'decode'}
        on:click={() => mode = 'decode'}
      >
        Decode
      </button>
    </div>

    <div class="type-select">
      <label>
        <input
          type="radio"
          bind:group={encodeType}
          value="component"
        />
        <span>Component</span>
      </label>
      <label>
        <input
          type="radio"
          bind:group={encodeType}
          value="full"
        />
        <span>Full URI</span>
      </label>
    </div>
  </div>

  <div class="input-section">
    <label for="url-input">Input</label>
    <textarea
      id="url-input"
      bind:value={input}
      placeholder={mode === 'encode' 
        ? 'Enter text to encode...' 
        : 'Enter encoded URL to decode...'}
      rows="3"
    ></textarea>
  </div>

  <div class="swap-section">
    <button class="swap-btn" on:click={swapInputOutput} title="Swap input and output">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </button>
  </div>

  <div class="output-section">
    <div class="output-header">
      <label for="url-output">Output</label>
      <button 
        class="copy-btn" 
        on:click={copyToClipboard}
        disabled={!output}
        class:copied
      >
        {#if copied}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Copied!
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        {/if}
      </button>
    </div>
    <textarea
      id="url-output"
      value={output}
      readonly
      placeholder="Result will appear here..."
      rows="3"
    ></textarea>
  </div>

  {#if error}
    <div class="error-message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4m0 4h.01" />
      </svg>
      {error}
    </div>
  {/if}

  <div class="info-section">
    <details>
      <summary>About encoding types</summary>
      <ul>
        <li><strong>Component:</strong> Encodes all special characters including <code>/ ? & =</code>. Use for query parameter values.</li>
        <li><strong>Full URI:</strong> Preserves URL structure characters. Use for complete URLs.</li>
      </ul>
    </details>
  </div>
</div>

<style>
  .url-encoder-widget {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    color: var(--text-normal, #dbdee1);
    max-width: 400px;
  }

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--header-primary, #f2f3f5);
  }

  .title .icon {
    width: 18px;
    height: 18px;
    color: var(--brand-500, #5865f2);
  }

  .clear-btn {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--interactive-normal, #b5bac1);
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .clear-btn:hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--interactive-hover, #dbdee1);
  }

  .clear-btn svg {
    width: 16px;
    height: 16px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mode-toggle {
    display: flex;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    padding: 3px;
  }

  .mode-toggle button {
    flex: 1;
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--text-muted, #949ba4);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .mode-toggle button.active {
    background: var(--brand-500, #5865f2);
    color: white;
  }

  .mode-toggle button:not(.active):hover {
    color: var(--text-normal, #dbdee1);
  }

  .type-select {
    display: flex;
    gap: 16px;
    padding: 4px 0;
  }

  .type-select label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted, #949ba4);
    cursor: pointer;
  }

  .type-select input[type="radio"] {
    accent-color: var(--brand-500, #5865f2);
  }

  .input-section,
  .output-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--header-secondary, #b5bac1);
  }

  textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--input-background, #1e1f22);
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-normal, #dbdee1);
    font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.15s ease;
  }

  textarea:focus {
    outline: none;
    border-color: var(--brand-500, #5865f2);
  }

  textarea[readonly] {
    background: var(--bg-tertiary, #1e1f22);
    cursor: default;
  }

  textarea::placeholder {
    color: var(--text-muted, #949ba4);
  }

  .swap-section {
    display: flex;
    justify-content: center;
  }

  .swap-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--bg-tertiary, #1e1f22);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--interactive-normal, #b5bac1);
    transition: all 0.15s ease;
  }

  .swap-btn:hover {
    background: var(--brand-500, #5865f2);
    color: white;
    transform: rotate(180deg);
  }

  .swap-btn svg {
    width: 16px;
    height: 16px;
  }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    font-size: 12px;
    color: var(--text-link, #00a8fc);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .copy-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .copy-btn:not(:disabled):hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .copy-btn.copied {
    color: var(--text-positive, #23a55a);
  }

  .copy-btn svg {
    width: 14px;
    height: 14px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(242, 63, 66, 0.1);
    border: 1px solid rgba(242, 63, 66, 0.3);
    border-radius: 6px;
    color: var(--text-danger, #f23f42);
    font-size: 13px;
  }

  .error-message svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .info-section {
    font-size: 12px;
  }

  details {
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    padding: 0;
  }

  summary {
    padding: 10px 12px;
    cursor: pointer;
    color: var(--text-muted, #949ba4);
    font-weight: 500;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: '▸';
    transition: transform 0.15s ease;
  }

  details[open] summary::before {
    transform: rotate(90deg);
  }

  details ul {
    margin: 0;
    padding: 0 12px 12px 24px;
    color: var(--text-muted, #949ba4);
  }

  details li {
    margin-bottom: 6px;
  }

  details code {
    background: var(--bg-secondary, #2b2d31);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
    font-size: 11px;
  }
</style>
