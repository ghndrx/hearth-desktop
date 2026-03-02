<script lang="ts">
  import { onMount } from 'svelte';
  
  // UUID formats
  type UUIDVersion = 'v4' | 'v1-like' | 'ulid' | 'nanoid';
  
  interface GeneratedUUID {
    id: string;
    value: string;
    version: UUIDVersion;
    timestamp: Date;
  }
  
  let selectedVersion: UUIDVersion = 'v4';
  let generatedUUID = '';
  let history: GeneratedUUID[] = [];
  let quantity = 1;
  let uppercase = false;
  let noBraces = false;
  let copied = false;
  let copiedId: string | null = null;
  
  // Generate UUID v4 (random)
  function generateUUIDv4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Generate UUID v1-like (timestamp-based, simplified)
  function generateUUIDv1Like(): string {
    const now = Date.now();
    const timeHex = now.toString(16).padStart(12, '0');
    const timeLow = timeHex.slice(-8);
    const timeMid = timeHex.slice(-12, -8);
    const timeHigh = '1' + timeHex.slice(0, 3);
    const clockSeq = (Math.random() * 0x3fff | 0x8000).toString(16);
    const node = Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
    return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq}-${node}`;
  }
  
  // Generate ULID (Universally Unique Lexicographically Sortable Identifier)
  function generateULID(): string {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const now = Date.now();
    let str = '';
    
    // Encode timestamp (48 bits = 10 chars)
    let t = now;
    for (let i = 0; i < 10; i++) {
      str = ENCODING[t % 32] + str;
      t = Math.floor(t / 32);
    }
    
    // Encode randomness (80 bits = 16 chars)
    for (let i = 0; i < 16; i++) {
      str += ENCODING[Math.floor(Math.random() * 32)];
    }
    
    return str;
  }
  
  // Generate NanoID-like
  function generateNanoID(size = 21): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = '';
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < size; i++) {
      id += alphabet[bytes[i] % 64];
    }
    return id;
  }
  
  function generateUUID(): string {
    let uuid: string;
    switch (selectedVersion) {
      case 'v4':
        uuid = generateUUIDv4();
        break;
      case 'v1-like':
        uuid = generateUUIDv1Like();
        break;
      case 'ulid':
        uuid = generateULID();
        break;
      case 'nanoid':
        uuid = generateNanoID();
        break;
      default:
        uuid = generateUUIDv4();
    }
    
    if (uppercase && selectedVersion !== 'nanoid') {
      uuid = uuid.toUpperCase();
    }
    
    if (noBraces && (selectedVersion === 'v4' || selectedVersion === 'v1-like')) {
      uuid = uuid.replace(/-/g, '');
    }
    
    return uuid;
  }
  
  function generate() {
    const newUUIDs: GeneratedUUID[] = [];
    for (let i = 0; i < quantity; i++) {
      const uuid = generateUUID();
      newUUIDs.push({
        id: crypto.randomUUID(),
        value: uuid,
        version: selectedVersion,
        timestamp: new Date()
      });
    }
    
    generatedUUID = newUUIDs.map(u => u.value).join('\n');
    history = [...newUUIDs, ...history].slice(0, 50);
  }
  
  async function copyToClipboard(text: string, id?: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        copiedId = id;
        setTimeout(() => copiedId = null, 1500);
      } else {
        copied = true;
        setTimeout(() => copied = false, 1500);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  function clearHistory() {
    history = [];
  }
  
  function removeFromHistory(id: string) {
    history = history.filter(h => h.id !== id);
  }
  
  function formatVersion(version: UUIDVersion): string {
    switch (version) {
      case 'v4': return 'UUID v4';
      case 'v1-like': return 'UUID v1';
      case 'ulid': return 'ULID';
      case 'nanoid': return 'NanoID';
      default: return version;
    }
  }
  
  onMount(() => {
    generate();
  });
</script>

<div class="uuid-generator-widget">
  <div class="widget-header">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      UUID Generator
    </h3>
  </div>
  
  <div class="widget-content">
    <div class="controls-row">
      <div class="control-group">
        <label for="uuid-version">Format</label>
        <select id="uuid-version" bind:value={selectedVersion} on:change={generate}>
          <option value="v4">UUID v4 (Random)</option>
          <option value="v1-like">UUID v1 (Time-based)</option>
          <option value="ulid">ULID (Sortable)</option>
          <option value="nanoid">NanoID (Compact)</option>
        </select>
      </div>
      
      <div class="control-group">
        <label for="quantity">Count</label>
        <input 
          type="number" 
          id="quantity"
          bind:value={quantity} 
          min="1" 
          max="100"
          on:change={generate}
        />
      </div>
    </div>
    
    <div class="options-row">
      {#if selectedVersion === 'v4' || selectedVersion === 'v1-like'}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={uppercase} on:change={generate} />
          Uppercase
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={noBraces} on:change={generate} />
          No dashes
        </label>
      {:else if selectedVersion === 'ulid'}
        <span class="format-hint">26 characters, base32</span>
      {:else if selectedVersion === 'nanoid'}
        <span class="format-hint">21 characters, URL-safe</span>
      {/if}
    </div>
    
    <div class="output-section">
      <div class="output-box">
        <textarea 
          readonly 
          value={generatedUUID}
          rows={Math.min(quantity, 5)}
          aria-label="Generated UUIDs"
        />
        <button 
          class="copy-btn" 
          class:copied
          on:click={() => copyToClipboard(generatedUUID)}
          aria-label="Copy to clipboard"
        >
          {#if copied}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
      </div>
      
      <button class="generate-btn" on:click={generate}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
        </svg>
        Generate
      </button>
    </div>
    
    {#if history.length > 0}
      <div class="history-section">
        <div class="history-header">
          <span>History ({history.length})</span>
          <button class="clear-btn" on:click={clearHistory}>Clear</button>
        </div>
        <div class="history-list">
          {#each history as item (item.id)}
            <div class="history-item">
              <div class="history-content">
                <code class="history-value">{item.value}</code>
                <span class="history-meta">
                  {formatVersion(item.version)} • {item.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div class="history-actions">
                <button 
                  class="icon-btn"
                  class:copied={copiedId === item.id}
                  on:click={() => copyToClipboard(item.value, item.id)}
                  aria-label="Copy"
                >
                  {#if copiedId === item.id}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  {/if}
                </button>
                <button 
                  class="icon-btn delete"
                  on:click={() => removeFromHistory(item.id)}
                  aria-label="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .uuid-generator-widget {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 12px;
    padding: 16px;
    min-width: 320px;
    max-width: 420px;
    font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  }
  
  .widget-header {
    margin-bottom: 16px;
  }
  
  .widget-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }
  
  .widget-header svg {
    color: var(--brand-primary, #5865f2);
  }
  
  .widget-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .controls-row {
    display: flex;
    gap: 12px;
  }
  
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  
  .control-group:last-child {
    flex: 0 0 80px;
  }
  
  .control-group label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  select, input[type="number"] {
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-subtle, #3f4147);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-primary, #f2f3f5);
    outline: none;
    transition: border-color 0.15s;
  }
  
  select:hover, input[type="number"]:hover {
    border-color: var(--border-hover, #4f545c);
  }
  
  select:focus, input[type="number"]:focus {
    border-color: var(--brand-primary, #5865f2);
  }
  
  input[type="number"] {
    text-align: center;
  }
  
  .options-row {
    display: flex;
    gap: 16px;
    align-items: center;
    min-height: 24px;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary, #b5bac1);
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--brand-primary, #5865f2);
    cursor: pointer;
  }
  
  .format-hint {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    font-style: italic;
  }
  
  .output-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .output-box {
    position: relative;
  }
  
  textarea {
    width: 100%;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-subtle, #3f4147);
    border-radius: 8px;
    padding: 12px;
    padding-right: 44px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
    font-size: 12px;
    color: var(--text-primary, #f2f3f5);
    resize: none;
    outline: none;
    line-height: 1.5;
    box-sizing: border-box;
  }
  
  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--bg-modifier-hover, #4e505899);
    border: none;
    border-radius: 4px;
    padding: 6px;
    cursor: pointer;
    color: var(--text-secondary, #b5bac1);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .copy-btn:hover {
    background: var(--bg-modifier-active, #6d6f7899);
    color: var(--text-primary, #f2f3f5);
  }
  
  .copy-btn.copied {
    background: var(--status-positive-bg, #248045);
    color: white;
  }
  
  .generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--brand-primary, #5865f2);
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  
  .generate-btn:hover {
    background: var(--brand-primary-hover, #4752c4);
  }
  
  .generate-btn:active {
    background: var(--brand-primary-active, #3c45a5);
  }
  
  .history-section {
    margin-top: 8px;
    border-top: 1px solid var(--border-subtle, #3f4147);
    padding-top: 12px;
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .history-header span {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  .clear-btn {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--text-link, #00a8fc);
    cursor: pointer;
    padding: 2px 4px;
  }
  
  .clear-btn:hover {
    text-decoration: underline;
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    padding: 8px 10px;
    gap: 8px;
  }
  
  .history-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .history-value {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
    font-size: 11px;
    color: var(--text-primary, #f2f3f5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .history-meta {
    font-size: 10px;
    color: var(--text-muted, #949ba4);
  }
  
  .history-actions {
    display: flex;
    gap: 4px;
  }
  
  .icon-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-muted, #949ba4);
    border-radius: 4px;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .icon-btn:hover {
    background: var(--bg-modifier-hover, #4e505899);
    color: var(--text-primary, #f2f3f5);
  }
  
  .icon-btn.copied {
    color: var(--status-positive, #23a55a);
  }
  
  .icon-btn.delete:hover {
    background: var(--status-danger-bg, #da373c33);
    color: var(--status-danger, #da373c);
  }
</style>
