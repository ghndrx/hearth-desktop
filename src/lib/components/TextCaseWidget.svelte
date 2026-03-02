<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputText = $state('');
  let outputText = $state('');
  let selectedCase = $state<string>('');
  let copyFeedback = $state<string | null>(null);
  let charCount = $derived(inputText.length);
  let wordCount = $derived(inputText.trim() ? inputText.trim().split(/\s+/).length : 0);

  const caseTypes = [
    { id: 'lower', label: 'lowercase', icon: 'aa' },
    { id: 'upper', label: 'UPPERCASE', icon: 'AA' },
    { id: 'title', label: 'Title Case', icon: 'Aa' },
    { id: 'sentence', label: 'Sentence case', icon: 'A.' },
    { id: 'camel', label: 'camelCase', icon: 'aC' },
    { id: 'pascal', label: 'PascalCase', icon: 'PC' },
    { id: 'snake', label: 'snake_case', icon: 's_' },
    { id: 'kebab', label: 'kebab-case', icon: 'k-' },
    { id: 'constant', label: 'CONSTANT_CASE', icon: 'C_' },
    { id: 'dot', label: 'dot.case', icon: 'd.' },
    { id: 'path', label: 'path/case', icon: 'p/' },
    { id: 'alternating', label: 'aLtErNaTiNg', icon: 'aA' },
    { id: 'inverse', label: 'iNVERSE', icon: '↔' },
    { id: 'spongebob', label: 'SpOnGeBoB', icon: '🧽' },
  ];

  function toWords(text: string): string[] {
    // Split by common delimiters and camelCase boundaries
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_\-./\\]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  function convertCase(text: string, caseType: string): string {
    if (!text.trim()) return '';

    const words = toWords(text);

    switch (caseType) {
      case 'lower':
        return text.toLowerCase();
      
      case 'upper':
        return text.toUpperCase();
      
      case 'title':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      
      case 'sentence':
        const sentences = text.split(/([.!?]+\s*)/);
        return sentences.map((s, i) => {
          if (i % 2 === 1) return s; // Punctuation
          return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        }).join('');
      
      case 'camel':
        return words.map((w, i) => 
          i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join('');
      
      case 'pascal':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
      
      case 'snake':
        return words.map(w => w.toLowerCase()).join('_');
      
      case 'kebab':
        return words.map(w => w.toLowerCase()).join('-');
      
      case 'constant':
        return words.map(w => w.toUpperCase()).join('_');
      
      case 'dot':
        return words.map(w => w.toLowerCase()).join('.');
      
      case 'path':
        return words.map(w => w.toLowerCase()).join('/');
      
      case 'alternating':
        return text.split('').map((c, i) => 
          i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
        ).join('');
      
      case 'inverse':
        return text.split('').map(c => 
          c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
        ).join('');
      
      case 'spongebob':
        // Random-ish alternating with some variation
        return text.split('').map((c, i) => {
          const shouldUpper = Math.sin(i * 1.5) > 0;
          return shouldUpper ? c.toUpperCase() : c.toLowerCase();
        }).join('');
      
      default:
        return text;
    }
  }

  function applyCase(caseType: string) {
    selectedCase = caseType;
    outputText = convertCase(inputText, caseType);
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

  function clearAll() {
    inputText = '';
    outputText = '';
    selectedCase = '';
  }

  function swapTexts() {
    const temp = inputText;
    inputText = outputText;
    outputText = temp;
  }

  // Auto-convert when input changes if a case is selected
  $effect(() => {
    if (selectedCase && inputText) {
      outputText = convertCase(inputText, selectedCase);
    }
  });
</script>

<div class="case-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🔤</span>
      <span class="label">Text Case Converter</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Input -->
    <div class="input-section">
      <label class="input-label">
        Input
        <span class="char-count">{charCount} chars · {wordCount} words</span>
      </label>
      <textarea 
        bind:value={inputText}
        placeholder="Enter text to convert..."
        rows={compact ? 2 : 3}
        class="text-input"
      ></textarea>
    </div>

    <!-- Case Options -->
    <div class="case-options" class:compact>
      {#each caseTypes as caseType}
        <button 
          class="case-btn"
          class:active={selectedCase === caseType.id}
          onclick={() => applyCase(caseType.id)}
          title={caseType.label}
        >
          <span class="case-icon">{caseType.icon}</span>
          {#if !compact}
            <span class="case-label">{caseType.label}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Output -->
    <div class="output-section">
      <div class="output-header">
        <label class="input-label">Output</label>
        <div class="output-actions">
          <button 
            class="icon-btn" 
            onclick={swapTexts} 
            title="Swap input/output"
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
      <div class="output-text" class:empty={!outputText}>
        {outputText || 'Select a case type above...'}
      </div>
    </div>

    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .case-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 400px;
  }

  .case-widget.compact {
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
    gap: 4px;
  }

  .input-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .char-count {
    font-size: 10px;
    font-weight: 400;
    text-transform: none;
  }

  .text-input {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
    min-height: 60px;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .case-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .case-options.compact {
    gap: 2px;
  }

  .case-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--background-tertiary, #202225);
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 6px 8px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .compact .case-btn {
    padding: 4px 6px;
  }

  .case-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .case-btn.active {
    background: var(--brand-experiment, #5865f2);
    color: white;
    border-color: var(--brand-experiment, #5865f2);
  }

  .case-icon {
    font-family: monospace;
    font-weight: 600;
    font-size: 10px;
  }

  .case-label {
    white-space: nowrap;
  }

  .output-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    word-break: break-word;
    user-select: all;
  }

  .output-text.empty {
    color: var(--text-muted, #72767d);
    font-style: italic;
    font-family: inherit;
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
