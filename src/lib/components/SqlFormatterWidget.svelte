<script lang="ts">
  import { formatSql, highlightSql } from '$lib/utils/sqlFormatter';

  interface Props {
    compact?: boolean;
    onClose?: () => void;
    indentSize?: number;
    uppercaseKeywords?: boolean;
  }

  let { 
    compact = false, 
    onClose, 
    indentSize = 2,
    uppercaseKeywords = true 
  }: Props = $props();

  let inputSql = $state('');
  let formattedSql = $state('');
  let copyFeedback = $state<string | null>(null);
  let formatError = $state<string | null>(null);
  let currentIndentSize = $state(indentSize);
  let currentUppercaseKeywords = $state(uppercaseKeywords);

  function format() {
    try {
      formatError = null;
      formattedSql = formatSql(inputSql, {
        indentSize: currentIndentSize,
        uppercaseKeywords: currentUppercaseKeywords
      });
    } catch (e) {
      formatError = e instanceof Error ? e.message : 'Formatting failed';
    }
  }

  async function copyOutput() {
    if (!formattedSql) return;
    
    try {
      await navigator.clipboard.writeText(formattedSql);
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
    inputSql = '';
    formattedSql = '';
    formatError = null;
  }

  function loadExample() {
    inputSql = `select u.id, u.name, u.email, count(o.id) as order_count, sum(o.total) as total_spent from users u left join orders o on u.id = o.user_id where u.created_at >= '2024-01-01' and u.status = 'active' group by u.id, u.name, u.email having count(o.id) > 0 order by total_spent desc limit 10;`;
    format();
  }

  // Auto-format when input changes
  $effect(() => {
    if (inputSql) {
      format();
    } else {
      formattedSql = '';
    }
  });

  // Re-format when options change
  $effect(() => {
    if (inputSql && (currentIndentSize || currentUppercaseKeywords !== undefined)) {
      format();
    }
  });

  let highlightedHtml = $derived(highlightSql(formattedSql));
</script>

<div class="sql-formatter" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🗃️</span>
      <span class="label">SQL Formatter</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={loadExample} title="Load example">📝</button>
      <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Input -->
    <div class="input-section">
      <label class="input-label" for="sql-input">
        Raw SQL
        <span class="char-count">{inputSql.length} chars</span>
      </label>
      <textarea 
        id="sql-input"
        bind:value={inputSql}
        placeholder="Paste your SQL query here..."
        rows={compact ? 3 : 5}
        class="sql-input"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Options -->
    <div class="options-bar">
      <div class="option">
        <label class="option-label">
          <input 
            type="checkbox" 
            bind:checked={currentUppercaseKeywords}
          />
          Uppercase keywords
        </label>
      </div>
      <div class="option">
        <label class="option-label" for="indent-select">
          Indent:
        </label>
        <select id="indent-select" bind:value={currentIndentSize} class="indent-select">
          <option value={2}>2 spaces</option>
          <option value={4}>4 spaces</option>
          <option value={8}>Tab (8)</option>
        </select>
      </div>
    </div>

    <!-- Output -->
    <div class="output-section">
      <div class="output-header">
        <span class="input-label">Formatted SQL</span>
        <div class="output-actions">
          <button 
            class="icon-btn" 
            onclick={copyOutput} 
            title="Copy formatted SQL"
            disabled={!formattedSql}
          >
            {copyFeedback ? '✓' : '📋'}
          </button>
        </div>
      </div>
      
      {#if formatError}
        <div class="error-output">{formatError}</div>
      {:else if formattedSql}
        <pre class="sql-output">{@html highlightedHtml}</pre>
      {:else}
        <div class="sql-output empty">Enter SQL above to format...</div>
      {/if}
    </div>

    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .sql-formatter {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 600px;
  }

  .sql-formatter.compact {
    padding: 8px;
    max-width: 400px;
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

  .sql-input {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', 'Fira Code', monospace;
    font-size: 12px;
    resize: vertical;
    min-height: 80px;
    line-height: 1.4;
  }

  .sql-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .options-bar {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .option-label input[type="checkbox"] {
    cursor: pointer;
  }

  .indent-select {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 3px;
    color: var(--text-normal, #dcddde);
    padding: 2px 6px;
    font-size: 11px;
    cursor: pointer;
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

  .sql-output {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 10px;
    font-family: 'Consolas', 'Monaco', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    min-height: 80px;
    max-height: 300px;
    overflow: auto;
    white-space: pre;
    margin: 0;
  }

  .sql-output.empty {
    color: var(--text-muted, #72767d);
    font-style: italic;
    font-family: inherit;
    white-space: normal;
  }

  .error-output {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 10px;
    color: var(--text-danger, #ed4245);
    font-size: 12px;
    min-height: 40px;
  }

  .feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  /* Syntax highlighting colors */
  :global(.sql-keyword) {
    color: #c586c0;
    font-weight: 600;
  }

  :global(.sql-datatype) {
    color: #4ec9b0;
  }

  :global(.sql-function) {
    color: #dcdcaa;
  }

  :global(.sql-string) {
    color: #ce9178;
  }

  :global(.sql-number) {
    color: #b5cea8;
  }

  :global(.sql-comment) {
    color: #6a9955;
    font-style: italic;
  }

  :global(.sql-operator) {
    color: #d4d4d4;
  }

  :global(.sql-identifier) {
    color: #9cdcfe;
  }
</style>
