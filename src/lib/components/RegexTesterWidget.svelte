<script lang="ts">
  import { onMount } from 'svelte';

  let pattern: string = '';
  let flags: string = 'g';
  let testString: string = '';
  let matches: RegExpMatchArray[] = [];
  let error: string = '';
  let highlightedText: string = '';
  let matchCount: number = 0;
  let executionTime: number = 0;

  // Flag toggles
  let globalFlag: boolean = true;
  let caseInsensitive: boolean = false;
  let multiline: boolean = false;
  let dotAll: boolean = false;
  let unicode: boolean = false;

  // Common regex patterns
  const presets = [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' },
    { name: 'URL', pattern: 'https?:\\/\\/[\\w\\-._~:/?#[\\]@!$&\'()*+,;=%]+' },
    { name: 'Phone (US)', pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}' },
    { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])' },
    { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b' },
    { name: 'UUID', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' },
    { name: 'Credit Card', pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b' },
  ];

  $: {
    flags = '';
    if (globalFlag) flags += 'g';
    if (caseInsensitive) flags += 'i';
    if (multiline) flags += 'm';
    if (dotAll) flags += 's';
    if (unicode) flags += 'u';
  }

  $: testRegex(pattern, flags, testString);

  function testRegex(pat: string, flg: string, str: string) {
    error = '';
    matches = [];
    highlightedText = '';
    matchCount = 0;
    executionTime = 0;

    if (!pat || !str) {
      highlightedText = escapeHtml(str);
      return;
    }

    try {
      const startTime = performance.now();
      const regex = new RegExp(pat, flg);
      
      // Collect all matches
      if (flg.includes('g')) {
        let match;
        while ((match = regex.exec(str)) !== null) {
          matches.push(match);
          matchCount++;
          // Safety: prevent infinite loops
          if (matchCount > 1000) {
            error = 'Too many matches (>1000). Pattern may be too broad.';
            break;
          }
        }
      } else {
        const match = str.match(regex);
        if (match) {
          matches.push(match);
          matchCount = 1;
        }
      }

      executionTime = performance.now() - startTime;

      // Generate highlighted text
      highlightedText = generateHighlightedText(str, pat, flg);
    } catch (e: any) {
      error = e.message || 'Invalid regex pattern';
      highlightedText = escapeHtml(str);
    }
  }

  function generateHighlightedText(str: string, pat: string, flg: string): string {
    if (!pat) return escapeHtml(str);
    
    try {
      const regex = new RegExp(pat, flg);
      let result = '';
      let lastIndex = 0;
      let matchIdx = 0;
      
      if (flg.includes('g')) {
        let match;
        const tempRegex = new RegExp(pat, flg);
        while ((match = tempRegex.exec(str)) !== null && matchIdx < 1000) {
          result += escapeHtml(str.slice(lastIndex, match.index));
          result += `<mark class="match match-${matchIdx % 5}">${escapeHtml(match[0])}</mark>`;
          lastIndex = match.index + match[0].length;
          matchIdx++;
          if (match[0].length === 0) tempRegex.lastIndex++;
        }
      } else {
        const match = str.match(regex);
        if (match && match.index !== undefined) {
          result += escapeHtml(str.slice(0, match.index));
          result += `<mark class="match match-0">${escapeHtml(match[0])}</mark>`;
          lastIndex = match.index + match[0].length;
        }
      }
      
      result += escapeHtml(str.slice(lastIndex));
      return result;
    } catch {
      return escapeHtml(str);
    }
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }

  function applyPreset(preset: { name: string; pattern: string }) {
    pattern = preset.pattern;
  }

  function copyPattern() {
    navigator.clipboard.writeText(pattern);
  }

  function clearAll() {
    pattern = '';
    testString = '';
    matches = [];
    error = '';
    highlightedText = '';
  }
</script>

<div class="regex-tester">
  <div class="header">
    <h3>🔍 Regex Tester</h3>
    <button class="clear-btn" on:click={clearAll} title="Clear all">
      ✕
    </button>
  </div>

  <div class="presets">
    <span class="presets-label">Presets:</span>
    <div class="preset-buttons">
      {#each presets as preset}
        <button class="preset-btn" on:click={() => applyPreset(preset)}>
          {preset.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="pattern-section">
    <div class="pattern-input-row">
      <span class="regex-delimiter">/</span>
      <input
        type="text"
        bind:value={pattern}
        placeholder="Enter regex pattern..."
        class="pattern-input"
        spellcheck="false"
      />
      <span class="regex-delimiter">/</span>
      <span class="flags-display">{flags || 'no flags'}</span>
      <button class="copy-btn" on:click={copyPattern} title="Copy pattern">
        📋
      </button>
    </div>

    <div class="flags-row">
      <label class="flag-checkbox">
        <input type="checkbox" bind:checked={globalFlag} />
        <span>g</span> global
      </label>
      <label class="flag-checkbox">
        <input type="checkbox" bind:checked={caseInsensitive} />
        <span>i</span> case insensitive
      </label>
      <label class="flag-checkbox">
        <input type="checkbox" bind:checked={multiline} />
        <span>m</span> multiline
      </label>
      <label class="flag-checkbox">
        <input type="checkbox" bind:checked={dotAll} />
        <span>s</span> dot all
      </label>
      <label class="flag-checkbox">
        <input type="checkbox" bind:checked={unicode} />
        <span>u</span> unicode
      </label>
    </div>

    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>

  <div class="test-string-section">
    <label for="test-string">Test String:</label>
    <textarea
      id="test-string"
      bind:value={testString}
      placeholder="Enter text to test against..."
      rows="4"
      spellcheck="false"
    ></textarea>
  </div>

  <div class="results-section">
    <div class="results-header">
      <span class="match-count">
        {matchCount} match{matchCount !== 1 ? 'es' : ''} found
      </span>
      {#if executionTime > 0}
        <span class="execution-time">({executionTime.toFixed(2)}ms)</span>
      {/if}
    </div>

    <div class="highlighted-output">
      {@html highlightedText || '<span class="placeholder">Results will appear here...</span>'}
    </div>

    {#if matches.length > 0}
      <div class="matches-list">
        <h4>Match Details:</h4>
        <div class="matches-scroll">
          {#each matches.slice(0, 50) as match, i}
            <div class="match-item">
              <span class="match-index">#{i + 1}</span>
              <span class="match-value">"{match[0]}"</span>
              <span class="match-position">at {match.index}</span>
              {#if match.length > 1}
                <div class="capture-groups">
                  {#each match.slice(1) as group, gi}
                    <span class="capture-group">Group {gi + 1}: "{group ?? 'undefined'}"</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
          {#if matches.length > 50}
            <div class="more-matches">...and {matches.length - 50} more matches</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .regex-tester {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    color: var(--text-normal, #dcddde);
    max-height: 600px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
  }

  .clear-btn:hover {
    background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .presets-label {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .preset-btn {
    background: var(--bg-tertiary, #202225);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    color: var(--text-normal, #dcddde);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: var(--brand-experiment, #5865f2);
    border-color: var(--brand-experiment, #5865f2);
  }

  .pattern-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pattern-input-row {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-tertiary, #202225);
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid var(--bg-modifier-accent, #4f545c);
  }

  .regex-delimiter {
    color: var(--text-muted, #72767d);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 16px;
  }

  .pattern-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-normal, #dcddde);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    outline: none;
  }

  .pattern-input::placeholder {
    color: var(--text-muted, #72767d);
  }

  .flags-display {
    color: var(--brand-experiment, #5865f2);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    min-width: 60px;
  }

  .copy-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .copy-btn:hover {
    opacity: 1;
  }

  .flags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .flag-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .flag-checkbox input {
    cursor: pointer;
  }

  .flag-checkbox span {
    font-family: 'Fira Code', 'Consolas', monospace;
    color: var(--brand-experiment, #5865f2);
    font-weight: 600;
  }

  .error {
    background: var(--status-danger-background, rgba(237, 66, 69, 0.1));
    color: var(--status-danger, #ed4245);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
  }

  .test-string-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .test-string-section label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
  }

  .test-string-section textarea {
    background: var(--bg-tertiary, #202225);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-normal, #dcddde);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    padding: 8px;
    resize: vertical;
    min-height: 60px;
  }

  .test-string-section textarea:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .results-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .results-header {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .match-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-positive, #3ba55c);
  }

  .execution-time {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .highlighted-output {
    background: var(--bg-tertiary, #202225);
    padding: 12px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
  }

  .highlighted-output :global(.placeholder) {
    color: var(--text-muted, #72767d);
    font-style: italic;
  }

  .highlighted-output :global(.match) {
    padding: 1px 2px;
    border-radius: 2px;
    font-weight: 600;
  }

  .highlighted-output :global(.match-0) { background: rgba(88, 101, 242, 0.4); }
  .highlighted-output :global(.match-1) { background: rgba(59, 165, 92, 0.4); }
  .highlighted-output :global(.match-2) { background: rgba(250, 166, 26, 0.4); }
  .highlighted-output :global(.match-3) { background: rgba(237, 66, 69, 0.4); }
  .highlighted-output :global(.match-4) { background: rgba(235, 69, 158, 0.4); }

  .matches-list {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .matches-list h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
  }

  .matches-scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .match-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-tertiary, #202225);
    border-radius: 4px;
    font-size: 12px;
  }

  .match-index {
    color: var(--text-muted, #72767d);
    font-weight: 600;
    min-width: 30px;
  }

  .match-value {
    font-family: 'Fira Code', 'Consolas', monospace;
    color: var(--brand-experiment, #5865f2);
  }

  .match-position {
    color: var(--text-muted, #72767d);
  }

  .capture-groups {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    padding-left: 38px;
  }

  .capture-group {
    background: var(--bg-secondary, #2f3136);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .more-matches {
    text-align: center;
    color: var(--text-muted, #72767d);
    font-size: 11px;
    padding: 8px;
  }
</style>
