<script lang="ts">
  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  let inputText = $state('');
  let copyFeedback = $state<string | null>(null);
  let livePreview = $state(true);
  let showHtml = $state(false);
  let wordCount = $state(0);
  let charCount = $state(0);

  // Simple markdown to HTML converter
  function markdownToHtml(md: string): string {
    let html = md
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      
      // Code blocks (triple backticks)
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => 
        `<pre class="code-block${lang ? ` lang-${lang}` : ''}"><code>${code.trim()}</code></pre>`)
      
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      
      // Headers
      .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      
      // Bold & Italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      
      // Strikethrough
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      
      // Blockquotes
      .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
      
      // Horizontal rules
      .replace(/^---+$/gm, '<hr />')
      .replace(/^\*\*\*+$/gm, '<hr />')
      
      // Unordered lists
      .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
      
      // Ordered lists
      .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
      
      // Task lists
      .replace(/<li>\s*\[x\]\s*/gi, '<li class="task done">☑ ')
      .replace(/<li>\s*\[ \]\s*/gi, '<li class="task">☐ ')
      
      // Paragraphs (double newlines)
      .replace(/\n\n+/g, '</p><p>')
      
      // Single line breaks
      .replace(/\n/g, '<br />');
    
    // Wrap in paragraph if needed
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }
    
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    
    // Wrap consecutive li elements in ul
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);
    
    // Merge consecutive blockquotes
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br />');
    
    return html;
  }

  function updateStats() {
    const text = inputText.trim();
    charCount = text.length;
    wordCount = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
  }

  $effect(() => {
    inputText;
    updateStats();
  });

  async function copyHtml() {
    const html = markdownToHtml(inputText);
    
    try {
      await navigator.clipboard.writeText(html);
      copyFeedback = 'Copied!';
      setTimeout(() => copyFeedback = null, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => copyFeedback = null, 2000);
    }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(inputText);
      copyFeedback = 'MD Copied!';
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
    } catch {
      // Silent fail
    }
  }

  function clearAll() {
    inputText = '';
  }

  function loadSample() {
    inputText = `# Markdown Preview

This is a **bold** and *italic* text demo.

## Features
- Live preview
- Code highlighting
- Task lists

### Code Example
\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

> This is a blockquote

Check out [Hearth](https://hearth.io) for more!

---

- [x] Task completed
- [ ] Task pending`;
  }

  function insertMarkdown(before: string, after: string = '') {
    const textarea = document.querySelector('.markdown-input') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = inputText.substring(start, end);
    
    inputText = inputText.substring(0, start) + before + selected + after + inputText.substring(end);
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }
</script>

<div class="md-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">📝</span>
      <span class="label">Markdown Preview</span>
    </div>
    <div class="actions">
      <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- Formatting Toolbar -->
    <div class="toolbar">
      <button class="tool-btn" onclick={() => insertMarkdown('**', '**')} title="Bold">
        <strong>B</strong>
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('*', '*')} title="Italic">
        <em>I</em>
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('~~', '~~')} title="Strikethrough">
        <del>S</del>
      </button>
      <span class="toolbar-divider"></span>
      <button class="tool-btn" onclick={() => insertMarkdown('# ')} title="Heading">
        H
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('`', '`')} title="Inline Code">
        {'</>'}
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('> ')} title="Quote">
        "
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('- ')} title="List">
        •
      </button>
      <button class="tool-btn" onclick={() => insertMarkdown('[', '](url)')} title="Link">
        🔗
      </button>
    </div>

    <!-- Input -->
    <div class="input-section">
      <div class="section-header">
        <label class="input-label">Markdown</label>
        <div class="section-actions">
          <button class="mini-btn" onclick={pasteInput} title="Paste">📥</button>
          <button class="mini-btn" onclick={loadSample} title="Load sample">📄</button>
          <button class="mini-btn" onclick={copyMarkdown} title="Copy Markdown">📋</button>
        </div>
      </div>
      <textarea 
        bind:value={inputText}
        placeholder="Type your markdown here..."
        rows={compact ? 3 : 5}
        class="markdown-input"
      ></textarea>
    </div>

    <!-- View Toggle -->
    <div class="view-toggle">
      <label class="toggle-label">
        <input type="checkbox" bind:checked={livePreview} />
        <span>Live preview</span>
      </label>
      <label class="toggle-label">
        <input type="checkbox" bind:checked={showHtml} />
        <span>Show HTML</span>
      </label>
    </div>

    <!-- Preview/HTML Output -->
    {#if livePreview}
      <div class="output-section">
        <div class="section-header">
          <label class="input-label">{showHtml ? 'HTML Output' : 'Preview'}</label>
          <div class="section-actions">
            <button 
              class="mini-btn" 
              onclick={copyHtml}
              disabled={!inputText}
              title="Copy HTML"
            >
              {copyFeedback ? '✓' : '📋'}
            </button>
          </div>
        </div>
        
        {#if showHtml}
          <pre class="html-output">{markdownToHtml(inputText)}</pre>
        {:else}
          <div class="preview-output" class:empty={!inputText}>
            {#if inputText}
              {@html markdownToHtml(inputText)}
            {:else}
              <span class="placeholder">Preview will appear here...</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Stats -->
    {#if !compact}
      <div class="stats">
        <span class="stat-item">
          <span class="stat-label">Words:</span>
          <span class="stat-value">{wordCount}</span>
        </span>
        <span class="stat-item">
          <span class="stat-label">Characters:</span>
          <span class="stat-value">{charCount}</span>
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  .md-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 400px;
  }

  .md-widget.compact {
    padding: 8px;
    max-width: 300px;
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

  .toolbar {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    flex-wrap: wrap;
  }

  .tool-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.15s ease;
    min-width: 28px;
  }

  .tool-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .toolbar-divider {
    width: 1px;
    background: var(--background-modifier-accent, #4f545c);
    margin: 2px 4px;
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

  .markdown-input {
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s ease;
  }

  .markdown-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .view-toggle {
    display: flex;
    gap: 16px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
  }

  .toggle-label input {
    cursor: pointer;
  }

  .preview-output {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 12px;
    color: var(--text-normal, #dcddde);
    font-size: 13px;
    min-height: 80px;
    max-height: 250px;
    overflow: auto;
    line-height: 1.5;
  }

  .preview-output.empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder {
    color: var(--text-muted, #72767d);
    font-style: italic;
  }

  /* Markdown rendered styles */
  .preview-output :global(h1) {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.5em 0 0.3em;
    padding-bottom: 0.2em;
    border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .preview-output :global(h2) {
    font-size: 1.3em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
  }

  .preview-output :global(h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin: 0.4em 0 0.2em;
  }

  .preview-output :global(h4),
  .preview-output :global(h5),
  .preview-output :global(h6) {
    font-size: 1em;
    font-weight: 600;
    margin: 0.3em 0 0.2em;
  }

  .preview-output :global(p) {
    margin: 0.5em 0;
  }

  .preview-output :global(strong) {
    font-weight: 700;
  }

  .preview-output :global(em) {
    font-style: italic;
  }

  .preview-output :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .preview-output :global(a) {
    color: var(--brand-experiment, #5865f2);
    text-decoration: none;
  }

  .preview-output :global(a:hover) {
    text-decoration: underline;
  }

  .preview-output :global(blockquote) {
    border-left: 3px solid var(--brand-experiment, #5865f2);
    margin: 0.5em 0;
    padding: 0.3em 0 0.3em 1em;
    color: var(--text-muted, #72767d);
  }

  .preview-output :global(code.inline-code) {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
  }

  .preview-output :global(pre.code-block) {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.8em;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.5em 0;
  }

  .preview-output :global(pre.code-block code) {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.85em;
  }

  .preview-output :global(ul) {
    margin: 0.5em 0;
    padding-left: 1.5em;
    list-style: disc;
  }

  .preview-output :global(li) {
    margin: 0.2em 0;
  }

  .preview-output :global(li.task) {
    list-style: none;
    margin-left: -1.2em;
  }

  .preview-output :global(li.task.done) {
    color: var(--text-positive, #3ba55d);
  }

  .preview-output :global(hr) {
    border: none;
    border-top: 1px solid var(--background-modifier-accent, #4f545c);
    margin: 1em 0;
  }

  .preview-output :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  .html-output {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 11px;
    min-height: 80px;
    max-height: 200px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    user-select: all;
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
</style>
