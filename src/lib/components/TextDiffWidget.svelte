<script lang="ts">
  import { onMount } from 'svelte';

  let leftText = $state('');
  let rightText = $state('');
  let diffResult = $state<DiffLine[]>([]);
  let diffMode = $state<'unified' | 'split'>('split');
  let ignoreWhitespace = $state(false);
  let ignoreCase = $state(false);
  let showLineNumbers = $state(true);
  let stats = $state({ additions: 0, deletions: 0, unchanged: 0 });

  interface DiffLine {
    type: 'add' | 'delete' | 'unchanged' | 'header';
    leftLineNum?: number;
    rightLineNum?: number;
    leftContent?: string;
    rightContent?: string;
    content?: string;
  }

  function normalizeText(text: string): string {
    let result = text;
    if (ignoreWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }
    if (ignoreCase) {
      result = result.toLowerCase();
    }
    return result;
  }

  function computeLCS(left: string[], right: string[]): number[][] {
    const m = left.length;
    const n = right.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const leftNorm = normalizeText(left[i - 1]);
        const rightNorm = normalizeText(right[j - 1]);
        if (leftNorm === rightNorm) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp;
  }

  function computeDiff() {
    const leftLines = leftText.split('\n');
    const rightLines = rightText.split('\n');
    const dp = computeLCS(leftLines, rightLines);
    
    const result: DiffLine[] = [];
    let i = leftLines.length;
    let j = rightLines.length;
    const changes: DiffLine[] = [];

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    while (i > 0 || j > 0) {
      const leftNorm = i > 0 ? normalizeText(leftLines[i - 1]) : '';
      const rightNorm = j > 0 ? normalizeText(rightLines[j - 1]) : '';

      if (i > 0 && j > 0 && leftNorm === rightNorm) {
        changes.unshift({
          type: 'unchanged',
          leftLineNum: i,
          rightLineNum: j,
          leftContent: leftLines[i - 1],
          rightContent: rightLines[j - 1],
          content: leftLines[i - 1]
        });
        unchanged++;
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        changes.unshift({
          type: 'add',
          rightLineNum: j,
          rightContent: rightLines[j - 1],
          content: rightLines[j - 1]
        });
        additions++;
        j--;
      } else if (i > 0) {
        changes.unshift({
          type: 'delete',
          leftLineNum: i,
          leftContent: leftLines[i - 1],
          content: leftLines[i - 1]
        });
        deletions++;
        i--;
      }
    }

    stats = { additions, deletions, unchanged };
    diffResult = changes;
  }

  function clearAll() {
    leftText = '';
    rightText = '';
    diffResult = [];
    stats = { additions: 0, deletions: 0, unchanged: 0 };
  }

  function swapTexts() {
    const temp = leftText;
    leftText = rightText;
    rightText = temp;
    if (diffResult.length > 0) {
      computeDiff();
    }
  }

  function copyDiffAsText() {
    let output = '';
    for (const line of diffResult) {
      if (line.type === 'add') {
        output += `+ ${line.content}\n`;
      } else if (line.type === 'delete') {
        output += `- ${line.content}\n`;
      } else {
        output += `  ${line.content}\n`;
      }
    }
    navigator.clipboard.writeText(output);
  }

  $effect(() => {
    if (leftText || rightText) {
      computeDiff();
    }
  });
</script>

<div class="text-diff-widget">
  <div class="widget-header">
    <div class="header-left">
      <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v18M3 12h18M9 9l3-3 3 3M9 15l3 3 3-3"/>
      </svg>
      <h3>Text Diff</h3>
    </div>
    <div class="header-controls">
      <div class="stats">
        <span class="stat additions">+{stats.additions}</span>
        <span class="stat deletions">-{stats.deletions}</span>
        <span class="stat unchanged">={stats.unchanged}</span>
      </div>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-group">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={ignoreWhitespace} />
        <span>Ignore whitespace</span>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={ignoreCase} />
        <span>Ignore case</span>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showLineNumbers} />
        <span>Line numbers</span>
      </label>
    </div>
    <div class="toolbar-group">
      <div class="mode-toggle">
        <button 
          class:active={diffMode === 'split'}
          onclick={() => diffMode = 'split'}
        >
          Split
        </button>
        <button 
          class:active={diffMode === 'unified'}
          onclick={() => diffMode = 'unified'}
        >
          Unified
        </button>
      </div>
      <button class="icon-btn" onclick={swapTexts} title="Swap texts">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      </button>
      <button class="icon-btn" onclick={copyDiffAsText} title="Copy diff">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
      <button class="icon-btn danger" onclick={clearAll} title="Clear all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="input-panels">
    <div class="input-panel">
      <div class="panel-header">
        <span class="panel-label">Original</span>
        <span class="line-count">{leftText.split('\n').filter(l => l).length} lines</span>
      </div>
      <textarea
        bind:value={leftText}
        placeholder="Paste original text here..."
        spellcheck="false"
      ></textarea>
    </div>
    <div class="input-panel">
      <div class="panel-header">
        <span class="panel-label">Modified</span>
        <span class="line-count">{rightText.split('\n').filter(l => l).length} lines</span>
      </div>
      <textarea
        bind:value={rightText}
        placeholder="Paste modified text here..."
        spellcheck="false"
      ></textarea>
    </div>
  </div>

  {#if diffResult.length > 0}
    <div class="diff-output" class:split-view={diffMode === 'split'}>
      <div class="diff-header">
        <span>Diff Output</span>
      </div>
      
      {#if diffMode === 'unified'}
        <div class="unified-diff">
          {#each diffResult as line, idx}
            <div class="diff-line {line.type}">
              {#if showLineNumbers}
                <span class="line-num left">{line.leftLineNum ?? ''}</span>
                <span class="line-num right">{line.rightLineNum ?? ''}</span>
              {/if}
              <span class="line-prefix">
                {#if line.type === 'add'}+{:else if line.type === 'delete'}-{:else}&nbsp;{/if}
              </span>
              <span class="line-content">{line.content}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="split-diff">
          <div class="split-column left">
            {#each diffResult as line, idx}
              <div class="diff-line {line.type === 'add' ? 'empty' : line.type}">
                {#if showLineNumbers}
                  <span class="line-num">{line.leftLineNum ?? ''}</span>
                {/if}
                <span class="line-content">
                  {#if line.type !== 'add'}{line.leftContent ?? line.content}{/if}
                </span>
              </div>
            {/each}
          </div>
          <div class="split-column right">
            {#each diffResult as line, idx}
              <div class="diff-line {line.type === 'delete' ? 'empty' : line.type}">
                {#if showLineNumbers}
                  <span class="line-num">{line.rightLineNum ?? ''}</span>
                {/if}
                <span class="line-content">
                  {#if line.type !== 'delete'}{line.rightContent ?? line.content}{/if}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .text-diff-widget {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-primary, #1a1a2e);
    border-radius: 12px;
    color: var(--text-primary, #e0e0e0);
    font-family: system-ui, -apple-system, sans-serif;
    max-height: 600px;
    overflow: hidden;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .widget-icon {
    width: 20px;
    height: 20px;
    color: var(--accent, #7c3aed);
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .stats {
    display: flex;
    gap: 8px;
    font-size: 12px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .stat {
    padding: 2px 6px;
    border-radius: 4px;
  }

  .stat.additions {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .stat.deletions {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .stat.unchanged {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border, #2a2a4a);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0b0);
    cursor: pointer;
  }

  .checkbox-label input {
    accent-color: var(--accent, #7c3aed);
  }

  .mode-toggle {
    display: flex;
    background: var(--bg-secondary, #252540);
    border-radius: 6px;
    padding: 2px;
  }

  .mode-toggle button {
    padding: 4px 12px;
    font-size: 12px;
    background: transparent;
    border: none;
    color: var(--text-secondary, #a0a0b0);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-toggle button.active {
    background: var(--accent, #7c3aed);
    color: white;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--bg-secondary, #252540);
    border: none;
    border-radius: 6px;
    color: var(--text-secondary, #a0a0b0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-hover, #303050);
    color: var(--text-primary, #e0e0e0);
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .icon-btn svg {
    width: 14px;
    height: 14px;
  }

  .input-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .input-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .panel-label {
    font-weight: 500;
    color: var(--text-primary, #e0e0e0);
  }

  .line-count {
    color: var(--text-muted, #6b6b80);
  }

  textarea {
    width: 100%;
    height: 120px;
    padding: 10px;
    background: var(--bg-secondary, #252540);
    border: 1px solid var(--border, #2a2a4a);
    border-radius: 8px;
    color: var(--text-primary, #e0e0e0);
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent, #7c3aed);
  }

  textarea::placeholder {
    color: var(--text-muted, #6b6b80);
  }

  .diff-output {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, #252540);
    border-radius: 8px;
    overflow: hidden;
    max-height: 250px;
  }

  .diff-header {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-tertiary, #1e1e35);
    border-bottom: 1px solid var(--border, #2a2a4a);
  }

  .unified-diff {
    overflow-y: auto;
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .unified-diff .diff-line {
    display: flex;
    padding: 0 12px;
    min-height: 22px;
  }

  .line-num {
    width: 35px;
    text-align: right;
    padding-right: 8px;
    color: var(--text-muted, #6b6b80);
    user-select: none;
    flex-shrink: 0;
  }

  .line-prefix {
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .line-content {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .diff-line.add {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .diff-line.delete {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .diff-line.unchanged {
    color: var(--text-secondary, #a0a0b0);
  }

  .diff-line.empty {
    background: var(--bg-tertiary, #1e1e35);
    color: transparent;
  }

  .split-diff {
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow-y: auto;
  }

  .split-column {
    font-family: 'SF Mono', Monaco, 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .split-column.left {
    border-right: 1px solid var(--border, #2a2a4a);
  }

  .split-column .diff-line {
    display: flex;
    padding: 0 8px;
    min-height: 22px;
  }

  .split-column .line-num {
    width: 30px;
  }

  @media (max-width: 600px) {
    .input-panels {
      grid-template-columns: 1fr;
    }

    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .split-diff {
      grid-template-columns: 1fr;
    }

    .split-column.left {
      border-right: none;
      border-bottom: 1px solid var(--border, #2a2a4a);
    }
  }
</style>
