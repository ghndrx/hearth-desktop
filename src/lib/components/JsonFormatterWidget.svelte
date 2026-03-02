<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputText = $state('');
  let outputText = $state('');
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let indentSize = $state(2);
  let sortKeys = $state(false);
  let autoFormat = $state(true);
  let stats = $state<{ keys: number; depth: number; size: string } | null>(null);

  const indentOptions = [
    { value: 2, label: '2 spaces' },
    { value: 4, label: '4 spaces' },
    { value: 1, label: 'Tab' },
  ];

  function formatJson() {
    error = null;
    stats = null;
    
    if (!inputText.trim()) {
      outputText = '';
      return;
    }

    try {
      let parsed = JSON.parse(inputText);
      
      if (sortKeys) {
        parsed = sortObjectKeys(parsed);
      }
      
      const indent = indentSize === 1 ? '\t' : indentSize;
      outputText = JSON.stringify(parsed, null, indent);
      
      // Calculate stats
      stats = calculateStats(parsed, inputText);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid JSON';
      outputText = '';
      
      // Try to find error position
      if (e instanceof SyntaxError) {
        const match = e.message.match(/position (\d+)/);
        if (match) {
          const pos = parseInt(match[1]);
          const lines = inputText.substring(0, pos).split('\n');
          error = `Line ${lines.length}, Col ${lines[lines.length - 1].length + 1}: ${e.message}`;
        }
      }
    }
  }

  function sortObjectKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }
    if (obj !== null && typeof obj === 'object') {
      const sorted: Record<string, unknown> = {};
      Object.keys(obj as object).sort().forEach(key => {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
      });
      return sorted;
    }
    return obj;
  }

  function calculateStats(obj: unknown, raw: string): { keys: number; depth: number; size: string } {
    let keyCount = 0;
    let maxDepth = 0;
    
    function traverse(value: unknown, depth: number) {
      maxDepth = Math.max(maxDepth, depth);
      
      if (Array.isArray(value)) {
        value.forEach(item => traverse(item, depth + 1));
      } else if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value);
        keyCount += keys.length;
        keys.forEach(key => traverse((value as Record<string, unknown>)[key], depth + 1));
      }
    }
    
    traverse(obj, 0);
    
    const bytes = new Blob([raw]).size;
    const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    
    return { keys: keyCount, depth: maxDepth, size };
  }

  function minifyJson() {
    error = null;
    stats = null;
    
    if (!inputText.trim()) {
      outputText = '';
      return;
    }

    try {
      const parsed = JSON.parse(inputText);
      outputText = JSON.stringify(parsed);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid JSON';
      outputText = '';
    }
  }

  function validateJson(): boolean {
    try {
      JSON.parse(inputText);
      return true;
    } catch {
      return false;
    }
  }

  async function copyOutput() {
    if (!outputText) return;
    
    try {
      await navigator.clipboard.writeText(outputText);
      copyFeedback = 'Copied!';
      setTimeout(() => copyFeedback = null, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => copyFeedback = null, 2000);
    }
  }

  async function pasteInput() {
    try {
      const text = await navigator.clipboard.readText();
      inputText = text;
      if (autoFormat) formatJson();
    } catch {
      error = 'Failed to paste from clipboard';
    }
  }

  function clearAll() {
    inputText = '';
    outputText = '';
    error = null;
    stats = null;
  }

  function useOutput() {
    if (outputText) {
      inputText = outputText;
      outputText = '';
    }
  }

  function loadSample() {
    inputText = JSON.stringify({
      name: "Example",
      version: "1.0.0",
      settings: {
        enabled: true,
        options: ["first", "second", "third"]
      },
      count: 42
    });
    if (autoFormat) formatJson();
  }

  // Auto-format effect
  $effect(() => {
    if (autoFormat && inputText) {
      formatJson();
    }
  });
</script>

<div class="json-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">📋</span>
      <span class="label">JSON Formatter</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Controls -->
    <div class="controls">
      <div class="control-group">
        <label class="control-label">Indent:</label>
        <select bind:value={indentSize} class="select-input">
          {#each indentOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <label class="checkbox-label">
        <input type="checkbox" bind:checked={sortKeys} />
        <span>Sort keys</span>
      </label>
    </div>

    <!-- Input -->
    <div class="input-section">
      <div class="section-header">
        <label class="input-label">Input JSON</label>
        <div class="section-actions">
          <button class="mini-btn" onclick={pasteInput} title="Paste">📥</button>
          <button class="mini-btn" onclick={loadSample} title="Load sample">📄</button>
        </div>
      </div>
      <textarea 
        bind:value={inputText}
        placeholder='{"paste": "your JSON here"}'
        rows={compact ? 3 : 5}
        class="text-input"
        class:invalid={inputText && !validateJson()}
        oninput={() => autoFormat && formatJson()}
      ></textarea>
      {#if inputText}
        <div class="validation-indicator" class:valid={validateJson()} class:invalid={!validateJson()}>
          {validateJson() ? '✓ Valid JSON' : '✗ Invalid JSON'}
        </div>
      {/if}
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button class="primary-btn" onclick={formatJson}>
        ✨ Format
      </button>
      <button class="secondary-btn" onclick={minifyJson}>
        📦 Minify
      </button>
    </div>

    <!-- Output -->
    <div class="output-section">
      <div class="section-header">
        <label class="input-label">Output</label>
        <div class="section-actions">
          <button 
            class="mini-btn" 
            onclick={useOutput} 
            title="Use as input"
            disabled={!outputText}
          >
            ↑
          </button>
          <button 
            class="mini-btn" 
            onclick={copyOutput} 
            title="Copy output"
            disabled={!outputText}
          >
            {copyFeedback ? '✓' : '📋'}
          </button>
        </div>
      </div>
      
      {#if error}
        <div class="error-box">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{error}</span>
        </div>
      {:else}
        <pre class="output-text" class:empty={!outputText}>{outputText || 'Formatted JSON will appear here...'}</pre>
      {/if}
    </div>

    <!-- Stats -->
    {#if stats && !compact}
      <div class="stats">
        <span class="stat-item">
          <span class="stat-label">Keys:</span>
          <span class="stat-value">{stats.keys}</span>
        </span>
        <span class="stat-item">
          <span class="stat-label">Depth:</span>
          <span class="stat-value">{stats.depth}</span>
        </span>
        <span class="stat-item">
          <span class="stat-label">Size:</span>
          <span class="stat-value">{stats.size}</span>
        </span>
      </div>
    {/if}

    <!-- Auto-format toggle -->
    <label class="auto-toggle">
      <input type="checkbox" bind:checked={autoFormat} />
      <span>Auto-format on input</span>
    </label>
  </div>
</div>

<style>
  .json-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 380px;
  }

  .json-widget.compact {
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

  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-label {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .select-input {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--text-normal, #dcddde);
    font-size: 11px;
    cursor: pointer;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .checkbox-label input {
    cursor: pointer;
  }

  .input-section,
  .output-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-actions {
    display: flex;
    gap: 4px;
  }

  .input-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .mini-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .mini-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .mini-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    min-height: 60px;
    transition: border-color 0.15s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .text-input.invalid {
    border-color: var(--text-danger, #ed4245);
  }

  .validation-indicator {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    width: fit-content;
  }

  .validation-indicator.valid {
    color: var(--text-positive, #3ba55d);
    background: rgba(59, 165, 93, 0.1);
  }

  .validation-indicator.invalid {
    color: var(--text-danger, #ed4245);
    background: rgba(237, 66, 69, 0.1);
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .primary-btn {
    flex: 1;
    background: var(--brand-experiment, #5865f2);
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    color: white;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .primary-btn:hover {
    background: var(--brand-experiment-560, #4752c4);
  }

  .secondary-btn {
    flex: 1;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px 12px;
    color: var(--text-normal, #dcddde);
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .secondary-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .output-text {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 11px;
    min-height: 80px;
    max-height: 200px;
    overflow: auto;
    white-space: pre;
    margin: 0;
    user-select: all;
  }

  .output-text.empty {
    color: var(--text-muted, #72767d);
    font-style: italic;
    font-family: inherit;
    white-space: normal;
  }

  .error-box {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--text-danger, #ed4245);
    border-radius: 4px;
    padding: 8px;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    min-height: 60px;
  }

  .error-icon {
    flex-shrink: 0;
  }

  .error-text {
    color: var(--text-danger, #ed4245);
    font-size: 12px;
    word-break: break-word;
  }

  .stats {
    display: flex;
    gap: 16px;
    padding: 6px 8px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .stat-item {
    display: flex;
    gap: 4px;
    font-size: 11px;
  }

  .stat-label {
    color: var(--text-muted, #72767d);
  }

  .stat-value {
    color: var(--text-normal, #dcddde);
    font-weight: 600;
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
</style>
