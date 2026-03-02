<script lang="ts">
  import { onMount } from 'svelte';

  // Widget state
  let pattern = '';
  let flags = 'g';
  let testString = 'Hello world! This is a test string.\nWith multiple lines.';
  let matches: RegExpMatchArray[] = [];
  let error = '';
  let isValid = true;
  let groups: Record<string, string>[] = [];

  // Flag checkboxes
  let globalFlag = true;
  let caseInsensitiveFlag = false;
  let multilineFlag = false;
  let dotAllFlag = false;
  let unicodeFlag = false;
  let stickyFlag = false;

  // Common patterns
  const commonPatterns = [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' },
    { name: 'URL', pattern: 'https?://[^\\s]+' },
    { name: 'Phone (US)', pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}' },
    { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-\\d{2}-\\d{2}' },
    { name: 'Hex Color', pattern: '#[0-9A-Fa-f]{3,6}\\b' },
    { name: 'Word', pattern: '\\b\\w+\\b' },
    { name: 'Number', pattern: '-?\\d+(?:\\.\\d+)?' },
  ];

  // History
  let history: { pattern: string; flags: string }[] = [];
  const MAX_HISTORY = 10;

  function updateFlags() {
    let f = '';
    if (globalFlag) f += 'g';
    if (caseInsensitiveFlag) f += 'i';
    if (multilineFlag) f += 'm';
    if (dotAllFlag) f += 's';
    if (unicodeFlag) f += 'u';
    if (stickyFlag) f += 'y';
    flags = f;
    testPattern();
  }

  function testPattern() {
    matches = [];
    groups = [];
    error = '';
    isValid = true;

    if (!pattern) {
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);
      
      if (flags.includes('g')) {
        let match;
        while ((match = regex.exec(testString)) !== null) {
          matches.push(match);
          if (match.groups) {
            groups.push(match.groups);
          }
          // Prevent infinite loop for zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        const match = regex.exec(testString);
        if (match) {
          matches.push(match);
          if (match.groups) {
            groups.push(match.groups);
          }
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid regex';
      isValid = false;
    }
  }

  function addToHistory() {
    if (pattern && isValid) {
      const entry = { pattern, flags };
      // Remove duplicates
      history = history.filter(h => h.pattern !== pattern || h.flags !== flags);
      history.unshift(entry);
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
    }
  }

  function loadFromHistory(entry: { pattern: string; flags: string }) {
    pattern = entry.pattern;
    // Parse flags
    globalFlag = entry.flags.includes('g');
    caseInsensitiveFlag = entry.flags.includes('i');
    multilineFlag = entry.flags.includes('m');
    dotAllFlag = entry.flags.includes('s');
    unicodeFlag = entry.flags.includes('u');
    stickyFlag = entry.flags.includes('y');
    flags = entry.flags;
    testPattern();
  }

  function loadCommonPattern(p: { name: string; pattern: string }) {
    pattern = p.pattern;
    testPattern();
    addToHistory();
  }

  function copyPattern() {
    navigator.clipboard.writeText(`/${pattern}/${flags}`);
  }

  function copyMatches() {
    const text = matches.map(m => m[0]).join('\n');
    navigator.clipboard.writeText(text);
  }

  function clearAll() {
    pattern = '';
    testString = '';
    matches = [];
    groups = [];
    error = '';
    isValid = true;
  }

  function getHighlightedText(): string {
    if (!pattern || !isValid || matches.length === 0) {
      return escapeHtml(testString);
    }

    try {
      const regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      let result = testString;
      let offset = 0;
      
      // Sort matches by index to process in order
      const sortedMatches = [...matches].sort((a, b) => (a.index || 0) - (b.index || 0));
      
      for (const match of sortedMatches) {
        const idx = (match.index || 0) + offset;
        const before = result.slice(0, idx);
        const matchText = match[0];
        const after = result.slice(idx + matchText.length);
        const highlighted = `<mark class="match-highlight">${escapeHtml(matchText)}</mark>`;
        result = before + highlighted + after;
        offset += highlighted.length - matchText.length;
      }
      
      return result;
    } catch {
      return escapeHtml(testString);
    }
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }

  // Reactive update
  $: if (pattern !== undefined || testString !== undefined || flags !== undefined) {
    testPattern();
  }

  onMount(() => {
    testPattern();
  });
</script>

<div class="regex-tester-widget">
  <div class="widget-header">
    <h3>🔍 RegEx Tester</h3>
    <div class="header-actions">
      <button class="icon-btn" on:click={clearAll} title="Clear all">
        🗑️
      </button>
    </div>
  </div>

  <div class="widget-content">
    <!-- Pattern input -->
    <div class="input-group">
      <label for="pattern">Pattern</label>
      <div class="pattern-input-wrapper">
        <span class="pattern-delimiter">/</span>
        <input
          id="pattern"
          type="text"
          bind:value={pattern}
          placeholder="Enter regex pattern..."
          class:invalid={!isValid}
          on:blur={addToHistory}
        />
        <span class="pattern-delimiter">/</span>
        <span class="flags-display">{flags}</span>
      </div>
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
    </div>

    <!-- Flags -->
    <div class="flags-group">
      <label>
        <input type="checkbox" bind:checked={globalFlag} on:change={updateFlags} />
        <span title="Global - find all matches">g</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={caseInsensitiveFlag} on:change={updateFlags} />
        <span title="Case insensitive">i</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={multilineFlag} on:change={updateFlags} />
        <span title="Multiline - ^ and $ match line boundaries">m</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={dotAllFlag} on:change={updateFlags} />
        <span title="Dot all - . matches newlines">s</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={unicodeFlag} on:change={updateFlags} />
        <span title="Unicode">u</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={stickyFlag} on:change={updateFlags} />
        <span title="Sticky - match from lastIndex">y</span>
      </label>
    </div>

    <!-- Common patterns dropdown -->
    <div class="common-patterns">
      <select on:change={(e) => {
        const idx = parseInt(e.currentTarget.value);
        if (idx >= 0) {
          loadCommonPattern(commonPatterns[idx]);
          e.currentTarget.value = '-1';
        }
      }}>
        <option value="-1">Common patterns...</option>
        {#each commonPatterns as p, i}
          <option value={i}>{p.name}</option>
        {/each}
      </select>
    </div>

    <!-- Test string -->
    <div class="input-group">
      <label for="test-string">Test String</label>
      <textarea
        id="test-string"
        bind:value={testString}
        placeholder="Enter text to test against..."
        rows="4"
      ></textarea>
    </div>

    <!-- Highlighted result -->
    <div class="result-section">
      <div class="result-header">
        <span>Result ({matches.length} match{matches.length !== 1 ? 'es' : ''})</span>
        {#if matches.length > 0}
          <button class="copy-btn" on:click={copyMatches} title="Copy matches">
            📋
          </button>
        {/if}
      </div>
      <div class="highlighted-text">
        {@html getHighlightedText()}
      </div>
    </div>

    <!-- Matches list -->
    {#if matches.length > 0}
      <div class="matches-section">
        <div class="matches-header">Matches</div>
        <div class="matches-list">
          {#each matches as match, i}
            <div class="match-item">
              <span class="match-index">{i + 1}</span>
              <span class="match-text">"{match[0]}"</span>
              <span class="match-position">@{match.index}</span>
              {#if match.length > 1}
                <div class="capture-groups">
                  {#each match.slice(1) as group, gi}
                    <span class="group">Group {gi + 1}: "{group || ''}"</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Named groups -->
    {#if groups.length > 0 && Object.keys(groups[0]).length > 0}
      <div class="groups-section">
        <div class="groups-header">Named Groups</div>
        {#each groups as group, i}
          <div class="group-item">
            {#each Object.entries(group) as [name, value]}
              <span class="named-group">{name}: "{value}"</span>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

    <!-- History -->
    {#if history.length > 0}
      <div class="history-section">
        <div class="history-header">Recent Patterns</div>
        <div class="history-list">
          {#each history as entry}
            <button class="history-item" on:click={() => loadFromHistory(entry)}>
              <span class="history-pattern">/{entry.pattern}/{entry.flags}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Quick actions -->
    <div class="actions">
      <button class="action-btn" on:click={copyPattern} disabled={!pattern || !isValid}>
        📋 Copy Pattern
      </button>
    </div>
  </div>
</div>

<style>
  .regex-tester-widget {
    background: var(--widget-bg, #1e1e2e);
    border-radius: 12px;
    padding: 16px;
    color: var(--text-primary, #cdd6f4);
    font-family: system-ui, -apple-system, sans-serif;
    min-width: 320px;
    max-width: 500px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;
  }

  .icon-btn:hover {
    background: var(--hover-bg, #313244);
  }

  .widget-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #a6adc8);
  }

  .pattern-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--input-bg, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 8px;
    padding: 0 12px;
    gap: 4px;
  }

  .pattern-delimiter {
    color: var(--text-muted, #6c7086);
    font-family: monospace;
    font-size: 16px;
  }

  .flags-display {
    color: var(--accent-color, #cba6f7);
    font-family: monospace;
    font-size: 14px;
    min-width: 40px;
  }

  .pattern-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary, #cdd6f4);
    font-family: monospace;
    font-size: 14px;
    padding: 10px 0;
    outline: none;
  }

  .pattern-input-wrapper input.invalid {
    color: var(--error-color, #f38ba8);
  }

  .error-message {
    color: var(--error-color, #f38ba8);
    font-size: 12px;
    padding: 4px 8px;
    background: rgba(243, 139, 168, 0.1);
    border-radius: 4px;
  }

  .flags-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .flags-group label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
    font-family: monospace;
  }

  .flags-group label span {
    color: var(--accent-color, #cba6f7);
  }

  .flags-group input[type="checkbox"] {
    accent-color: var(--accent-color, #cba6f7);
  }

  .common-patterns select {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    font-size: 14px;
    cursor: pointer;
  }

  textarea {
    background: var(--input-bg, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    font-family: monospace;
    font-size: 13px;
    padding: 10px 12px;
    resize: vertical;
    outline: none;
  }

  textarea:focus {
    border-color: var(--accent-color, #cba6f7);
  }

  .result-section {
    background: var(--input-bg, #181825);
    border-radius: 8px;
    padding: 12px;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #a6adc8);
    margin-bottom: 8px;
  }

  .copy-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .copy-btn:hover {
    background: var(--hover-bg, #313244);
  }

  .highlighted-text {
    font-family: monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 150px;
    overflow-y: auto;
  }

  :global(.match-highlight) {
    background: rgba(203, 166, 247, 0.3);
    color: var(--accent-color, #cba6f7);
    padding: 1px 2px;
    border-radius: 2px;
  }

  .matches-section,
  .groups-section {
    background: var(--input-bg, #181825);
    border-radius: 8px;
    padding: 12px;
  }

  .matches-header,
  .groups-header,
  .history-header {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #a6adc8);
    margin-bottom: 8px;
  }

  .matches-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .match-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--widget-bg, #1e1e2e);
    border-radius: 6px;
    font-family: monospace;
    font-size: 12px;
  }

  .match-index {
    background: var(--accent-color, #cba6f7);
    color: var(--widget-bg, #1e1e2e);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 11px;
  }

  .match-text {
    color: var(--text-primary, #cdd6f4);
  }

  .match-position {
    color: var(--text-muted, #6c7086);
    font-size: 11px;
  }

  .capture-groups {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
    padding-left: 28px;
  }

  .group,
  .named-group {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    background: rgba(166, 173, 200, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .group-item {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px;
    background: var(--widget-bg, #1e1e2e);
    border-radius: 6px;
    margin-top: 4px;
  }

  .history-section {
    border-top: 1px solid var(--border-color, #313244);
    padding-top: 12px;
  }

  .history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .history-item {
    background: var(--input-bg, #181825);
    border: 1px solid var(--border-color, #313244);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .history-item:hover {
    border-color: var(--accent-color, #cba6f7);
    background: var(--hover-bg, #313244);
  }

  .history-pattern {
    font-family: monospace;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--accent-color, #cba6f7);
    color: var(--widget-bg, #1e1e2e);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
