<script lang="ts">
  export let content: string;
  export let inline = false;
  
  // Simple markdown parsing - can be replaced with a proper parser
  function parseMarkdown(text: string): string {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // Code blocks (```code```)
    html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
    });
    
    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Strikethrough (~~text~~)
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // Underline (__text__ when not bold context - simplified)
    // Note: Discord uses || for spoilers, we'll add that too
    html = html.replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler">$1</span>');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      // Validate URL
      if (isValidUrl(url)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return text;
    });
    
    // Auto-link URLs
    html = html.replace(
      /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // User mentions <@userid>
    html = html.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention user">@user</span>');
    
    // Role mentions <@&roleid>
    html = html.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention role">@role</span>');
    
    // Channel mentions <#channelid>
    html = html.replace(/&lt;#(\d+)&gt;/g, '<span class="mention channel">#channel</span>');
    
    // Custom emoji <:name:id> or <a:name:id>
    html = html.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, animated, name) => {
      return `<span class="emoji" title=":${name}:">:${name}:</span>`;
    });
    
    // Blockquotes (> text)
    if (!inline) {
      html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
      // Merge consecutive blockquotes
      html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
    }
    
    // Line breaks
    if (!inline) {
      html = html.replace(/\n/g, '<br>');
    }
    
    return html;
  }
  
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  function isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
  
  $: rendered = parseMarkdown(content);
</script>

{#if inline}
  <span class="markdown inline">{@html rendered}</span>
{:else}
  <div class="markdown">{@html rendered}</div>
{/if}

<style>
  .markdown {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  
  .markdown :global(code) {
    padding: 0.2em 0.4em;
    background-color: var(--bg-secondary, #2f3136);
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875em;
  }
  
  .markdown :global(pre) {
    padding: 12px;
    background-color: var(--bg-secondary, #2f3136);
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }
  
  .markdown :global(pre code) {
    padding: 0;
    background: none;
  }
  
  .markdown :global(blockquote) {
    border-left: 4px solid var(--text-muted, #72767d);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--text-muted, #72767d);
  }
  
  .markdown :global(a) {
    color: var(--text-link, #00aff4);
    text-decoration: none;
  }
  
  .markdown :global(a:hover) {
    text-decoration: underline;
  }
  
  .markdown :global(.mention) {
    padding: 0 4px;
    border-radius: 3px;
    background-color: rgba(88, 101, 242, 0.3);
    color: var(--brand-primary, #5865f2);
    cursor: pointer;
  }
  
  .markdown :global(.mention:hover) {
    background-color: var(--brand-primary, #5865f2);
    color: white;
  }
  
  .markdown :global(.spoiler) {
    background-color: var(--bg-secondary, #2f3136);
    color: transparent;
    border-radius: 3px;
    cursor: pointer;
    user-select: none;
  }
  
  .markdown :global(.spoiler:hover),
  .markdown :global(.spoiler.revealed) {
    color: inherit;
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  .markdown :global(.emoji) {
    font-size: 1.375em;
    vertical-align: -0.2em;
  }
</style>
