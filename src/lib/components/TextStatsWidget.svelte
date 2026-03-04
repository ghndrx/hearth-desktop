<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputText = $state('');
  let copyFeedback = $state<string | null>(null);

  // Computed statistics
  let stats = $derived.by(() => {
    const text = inputText;
    
    // Character counts
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s/g, '').length;
    
    // Word count
    const words = text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0) : [];
    const wordCount = words.length;
    
    // Sentence count (split on . ! ? followed by space or end)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    
    // Paragraph count (split on double newlines)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = text.trim() ? Math.max(paragraphs.length, 1) : 0;
    
    // Line count
    const lines = text.split('\n');
    const lineCount = text.trim() ? lines.length : 0;
    const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
    
    // Reading time (average 200-250 words per minute)
    const readingTimeMin = Math.ceil(wordCount / 225);
    
    // Speaking time (average 125-150 words per minute)
    const speakingTimeMin = Math.ceil(wordCount / 140);
    
    // Average word length
    const avgWordLength = wordCount > 0 
      ? (words.reduce((sum, w) => sum + w.length, 0) / wordCount).toFixed(1)
      : '0';
    
    // Longest word
    const longestWord = words.reduce((longest, word) => 
      word.length > longest.length ? word : longest, 
    '');
    
    // Unique words
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/gi, '')));
    const uniqueWordCount = uniqueWords.size;
    
    // Most frequent words (excluding common stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'was', 'with', 'as', 'be', 'are', 'by', 'from', 'have', 'has', 'had']);
    const wordFreq = new Map<string, number>();
    words.forEach(w => {
      const normalized = w.toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (normalized.length > 2 && !stopWords.has(normalized)) {
        wordFreq.set(normalized, (wordFreq.get(normalized) || 0) + 1);
      }
    });
    const topWords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    return {
      charCount,
      charNoSpaces,
      wordCount,
      sentenceCount,
      paragraphCount,
      lineCount,
      nonEmptyLines,
      readingTimeMin,
      speakingTimeMin,
      avgWordLength,
      longestWord,
      uniqueWordCount,
      topWords
    };
  });

  async function copyStats() {
    const summary = `Text Statistics:
Characters: ${stats.charCount} (${stats.charNoSpaces} without spaces)
Words: ${stats.wordCount} (${stats.uniqueWordCount} unique)
Sentences: ${stats.sentenceCount}
Paragraphs: ${stats.paragraphCount}
Lines: ${stats.lineCount} (${stats.nonEmptyLines} non-empty)
Reading time: ~${stats.readingTimeMin} min
Speaking time: ~${stats.speakingTimeMin} min
Avg word length: ${stats.avgWordLength} chars`;

    try {
      await navigator.clipboard.writeText(summary);
      copyFeedback = 'Copied!';
      setTimeout(() => copyFeedback = null, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => copyFeedback = null, 2000);
    }
  }

  function clearText() {
    inputText = '';
  }

  function formatTime(minutes: number): string {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
</script>

<div class="stats-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">📊</span>
      <span class="label">Text Statistics</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={copyStats} title="Copy stats">
        {copyFeedback ? '✓' : '📋'}
      </button>
      <button class="action-btn" onclick={clearText} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Input -->
    <div class="input-section">
      <textarea 
        bind:value={inputText}
        placeholder="Paste or type text to analyze..."
        rows={compact ? 3 : 4}
        class="text-input"
      ></textarea>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid" class:compact>
      <div class="stat-item primary">
        <span class="stat-value">{stats.wordCount.toLocaleString()}</span>
        <span class="stat-label">Words</span>
      </div>
      <div class="stat-item primary">
        <span class="stat-value">{stats.charCount.toLocaleString()}</span>
        <span class="stat-label">Characters</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.charNoSpaces.toLocaleString()}</span>
        <span class="stat-label">No spaces</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.sentenceCount}</span>
        <span class="stat-label">Sentences</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.paragraphCount}</span>
        <span class="stat-label">Paragraphs</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{stats.lineCount}</span>
        <span class="stat-label">Lines</span>
      </div>
    </div>

    <!-- Time Estimates -->
    <div class="time-section">
      <div class="time-item">
        <span class="time-icon">📖</span>
        <span class="time-label">Reading</span>
        <span class="time-value">{formatTime(stats.readingTimeMin)}</span>
      </div>
      <div class="time-item">
        <span class="time-icon">🎤</span>
        <span class="time-label">Speaking</span>
        <span class="time-value">{formatTime(stats.speakingTimeMin)}</span>
      </div>
    </div>

    {#if !compact && stats.wordCount > 0}
      <!-- Advanced Stats -->
      <div class="advanced-section">
        <div class="advanced-header">Details</div>
        <div class="advanced-grid">
          <div class="advanced-item">
            <span class="adv-label">Unique words</span>
            <span class="adv-value">{stats.uniqueWordCount}</span>
          </div>
          <div class="advanced-item">
            <span class="adv-label">Avg length</span>
            <span class="adv-value">{stats.avgWordLength} chars</span>
          </div>
          {#if stats.longestWord}
            <div class="advanced-item full-width">
              <span class="adv-label">Longest word</span>
              <span class="adv-value mono">{stats.longestWord}</span>
            </div>
          {/if}
        </div>

        {#if stats.topWords.length > 0}
          <div class="top-words">
            <div class="advanced-header">Top Words</div>
            <div class="word-list">
              {#each stats.topWords as { word, count }}
                <span class="word-chip">
                  {word} <span class="word-count">×{count}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .stats-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 360px;
  }

  .stats-widget.compact {
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

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stats-grid.compact {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .stat-item {
    background: var(--background-tertiary, #202225);
    border-radius: 6px;
    padding: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-item.primary {
    background: var(--brand-experiment-15a, rgba(88, 101, 242, 0.15));
    border: 1px solid var(--brand-experiment-30a, rgba(88, 101, 242, 0.3));
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-normal, #dcddde);
    font-variant-numeric: tabular-nums;
  }

  .stat-item.primary .stat-value {
    color: var(--brand-experiment, #5865f2);
  }

  .compact .stat-value {
    font-size: 15px;
  }

  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 500;
  }

  .time-section {
    display: flex;
    gap: 8px;
  }

  .time-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--background-tertiary, #202225);
    border-radius: 6px;
    padding: 8px 10px;
  }

  .time-icon {
    font-size: 14px;
  }

  .time-label {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .time-value {
    margin-left: auto;
    font-weight: 600;
    color: var(--text-normal, #dcddde);
    font-size: 12px;
  }

  .advanced-section {
    border-top: 1px solid var(--background-modifier-accent, #4f545c);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .advanced-header {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .advanced-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .advanced-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .advanced-item.full-width {
    grid-column: 1 / -1;
  }

  .adv-label {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .adv-value {
    font-size: 11px;
    color: var(--text-normal, #dcddde);
    font-weight: 500;
  }

  .adv-value.mono {
    font-family: 'Consolas', 'Monaco', monospace;
    background: var(--background-tertiary, #202225);
    padding: 2px 6px;
    border-radius: 3px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-words {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .word-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .word-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 12px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--text-normal, #dcddde);
  }

  .word-count {
    color: var(--text-muted, #72767d);
    font-size: 10px;
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
