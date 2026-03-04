<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

  interface RequestHistory {
    id: string;
    method: HttpMethod;
    url: string;
    status: number | null;
    timestamp: Date;
    duration: number;
  }

  interface ResponseData {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
    size: number;
  }

  let method = $state<HttpMethod>('GET');
  let url = $state('https://httpbin.org/get');
  let requestBody = $state('');
  let customHeaders = $state<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let response = $state<ResponseData | null>(null);
  let history = $state<RequestHistory[]>([]);
  let activeTab = $state<'body' | 'headers' | 'raw'>('body');
  let showHeaders = $state(false);
  let showHistory = $state(false);
  let copyFeedback = $state<string | null>(null);

  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

  const methodColors: Record<HttpMethod, string> = {
    GET: '#3ba55c',
    POST: '#faa61a',
    PUT: '#5865f2',
    DELETE: '#ed4245'
  };

  function addHeader() {
    customHeaders = [...customHeaders, { key: '', value: '', enabled: true }];
  }

  function removeHeader(index: number) {
    customHeaders = customHeaders.filter((_, i) => i !== index);
  }

  function updateHeader(index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) {
    customHeaders = customHeaders.map((h, i) => 
      i === index ? { ...h, [field]: value } : h
    );
  }

  async function sendRequest() {
    if (!url.trim()) {
      error = 'Please enter a URL';
      return;
    }

    isLoading = true;
    error = null;
    response = null;
    const startTime = performance.now();

    try {
      const headers: Record<string, string> = {};
      customHeaders
        .filter(h => h.enabled && h.key.trim())
        .forEach(h => {
          headers[h.key.trim()] = h.value;
        });

      const options: RequestInit = {
        method,
        headers,
      };

      if ((method === 'POST' || method === 'PUT') && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        bodyText = '<Unable to read response body>';
      }

      response = {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: bodyText,
        duration,
        size: new Blob([bodyText]).size
      };

      // Add to history
      const historyEntry: RequestHistory = {
        id: Date.now().toString(),
        method,
        url,
        status: res.status,
        timestamp: new Date(),
        duration
      };
      history = [historyEntry, ...history.slice(0, 19)];
      saveHistory();

    } catch (e) {
      const endTime = performance.now();
      error = e instanceof Error ? e.message : 'Request failed';
      
      // Add failed request to history
      const historyEntry: RequestHistory = {
        id: Date.now().toString(),
        method,
        url,
        status: null,
        timestamp: new Date(),
        duration: Math.round(endTime - startTime)
      };
      history = [historyEntry, ...history.slice(0, 19)];
      saveHistory();
    } finally {
      isLoading = false;
    }
  }

  function formatBody(body: string): string {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getStatusClass(status: number | null): string {
    if (status === null) return 'status-error';
    if (status >= 200 && status < 300) return 'status-success';
    if (status >= 300 && status < 400) return 'status-redirect';
    if (status >= 400 && status < 500) return 'status-client-error';
    return 'status-server-error';
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = `${label} copied!`;
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

  function loadFromHistory(entry: RequestHistory) {
    method = entry.method;
    url = entry.url;
    showHistory = false;
  }

  function clearHistory() {
    history = [];
    saveHistory();
  }

  function saveHistory() {
    try {
      localStorage.setItem('hearth-network-debugger-history', JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }

  function loadHistory() {
    try {
      const stored = localStorage.getItem('hearth-network-debugger-history');
      if (stored) {
        const parsed = JSON.parse(stored);
        history = parsed.map((h: RequestHistory) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        }));
      }
    } catch {
      // Ignore storage errors
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  onMount(() => {
    loadHistory();
  });
</script>

<div class="network-debugger" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🌐</span>
      <span class="label">Network Debugger</span>
    </div>
    <div class="actions">
      <button 
        class="action-btn"
        onclick={() => showHistory = !showHistory}
        title="History"
        class:active={showHistory}
      >
        📜
      </button>
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  {#if showHistory}
    <div class="history-panel">
      <div class="history-header">
        <span>Request History</span>
        <button class="clear-history-btn" onclick={clearHistory}>Clear</button>
      </div>
      {#if history.length === 0}
        <div class="history-empty">No requests yet</div>
      {:else}
        <div class="history-list">
          {#each history as entry (entry.id)}
            <button 
              class="history-item"
              onclick={() => loadFromHistory(entry)}
            >
              <span 
                class="history-method"
                style="background: {methodColors[entry.method]}"
              >
                {entry.method}
              </span>
              <span class="history-url">{entry.url}</span>
              <span class="history-status {getStatusClass(entry.status)}">
                {entry.status ?? 'ERR'}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="request-section">
      <div class="url-bar">
        <select 
          class="method-select"
          bind:value={method}
          style="background: {methodColors[method]}"
          aria-label="HTTP Method"
        >
          {#each methods as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
        <input
          type="text"
          class="url-input"
          placeholder="Enter URL..."
          bind:value={url}
          onkeydown={(e) => e.key === 'Enter' && sendRequest()}
          aria-label="Request URL"
        />
        <button 
          class="send-btn"
          onclick={sendRequest}
          disabled={isLoading}
          aria-label="Send Request"
        >
          {isLoading ? '⏳' : '▶'}
        </button>
      </div>

      {#if !compact}
        <button 
          class="toggle-headers-btn"
          onclick={() => showHeaders = !showHeaders}
        >
          Headers {customHeaders.filter(h => h.enabled).length > 0 ? `(${customHeaders.filter(h => h.enabled).length})` : ''}
          <span class="toggle-icon">{showHeaders ? '▼' : '▶'}</span>
        </button>

        {#if showHeaders}
          <div class="headers-section">
            {#each customHeaders as header, i}
              <div class="header-row">
                <input
                  type="checkbox"
                  checked={header.enabled}
                  onchange={(e) => updateHeader(i, 'enabled', (e.target as HTMLInputElement).checked)}
                  aria-label="Enable header"
                />
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  oninput={(e) => updateHeader(i, 'key', (e.target as HTMLInputElement).value)}
                  class="header-key"
                  aria-label="Header name"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  oninput={(e) => updateHeader(i, 'value', (e.target as HTMLInputElement).value)}
                  class="header-value"
                  aria-label="Header value"
                />
                <button 
                  class="remove-header-btn"
                  onclick={() => removeHeader(i)}
                  aria-label="Remove header"
                >
                  ×
                </button>
              </div>
            {/each}
            <button class="add-header-btn" onclick={addHeader}>
              + Add Header
            </button>
          </div>
        {/if}

        {#if method === 'POST' || method === 'PUT'}
          <div class="body-section">
            <div class="body-label">Request Body</div>
            <textarea
              class="body-input"
              placeholder={'{"key": "value"}'}
              bind:value={requestBody}
              rows={4}
              aria-label="Request body"
            ></textarea>
          </div>
        {/if}
      {/if}
    </div>

    {#if error}
      <div class="error-section">
        <span class="error-icon">❌</span>
        <span class="error-message">{error}</span>
      </div>
    {/if}

    {#if response}
      <div class="response-section">
        <div class="response-status">
          <span class="status-badge {getStatusClass(response.status)}">
            {response.status} {response.statusText}
          </span>
          <span class="response-meta">
            {response.duration}ms • {formatSize(response.size)}
          </span>
        </div>

        {#if !compact}
          <div class="response-tabs">
            <button 
              class="tab-btn"
              class:active={activeTab === 'body'}
              onclick={() => activeTab = 'body'}
            >
              Body
            </button>
            <button 
              class="tab-btn"
              class:active={activeTab === 'headers'}
              onclick={() => activeTab = 'headers'}
            >
              Headers
            </button>
            <button 
              class="tab-btn"
              class:active={activeTab === 'raw'}
              onclick={() => activeTab = 'raw'}
            >
              Raw
            </button>
            <button 
              class="copy-btn"
              onclick={() => copyToClipboard(
                activeTab === 'headers' 
                  ? JSON.stringify(response.headers, null, 2)
                  : response.body,
                activeTab === 'headers' ? 'Headers' : 'Body'
              )}
            >
              📋
            </button>
          </div>

          <div class="response-content">
            {#if activeTab === 'body'}
              <pre class="response-body">{formatBody(response.body)}</pre>
            {:else if activeTab === 'headers'}
              <div class="response-headers">
                {#each Object.entries(response.headers) as [key, value]}
                  <div class="header-item">
                    <span class="header-name">{key}:</span>
                    <span class="header-val">{value}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <pre class="response-raw">{response.body}</pre>
            {/if}
          </div>
        {:else}
          <pre class="response-body compact">{formatBody(response.body).slice(0, 200)}{response.body.length > 200 ? '...' : ''}</pre>
        {/if}
      </div>
    {/if}

    {#if copyFeedback}
      <div class="copy-feedback">{copyFeedback}</div>
    {/if}
  {/if}
</div>

<style>
  .network-debugger {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    min-width: 300px;
    max-width: 100%;
  }

  .network-debugger.compact {
    min-width: 200px;
    padding: 8px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
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

  .action-btn:hover,
  .action-btn.active {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .url-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .method-select {
    border: none;
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    color: white;
    cursor: pointer;
    min-width: 70px;
  }

  .method-select option {
    background: var(--background-tertiary, #202225);
    color: var(--text-normal, #dcddde);
  }

  .url-input {
    flex: 1;
    background: var(--background-tertiary, #202225);
    border: none;
    border-radius: 4px;
    padding: 8px 10px;
    color: var(--text-normal, #dcddde);
    font-size: 12px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .url-input:focus {
    outline: 2px solid var(--brand-experiment, #5865f2);
    outline-offset: -2px;
  }

  .send-btn {
    background: var(--brand-experiment, #5865f2);
    border: none;
    border-radius: 4px;
    padding: 8px 14px;
    color: white;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--brand-experiment-560, #4752c4);
  }

  .send-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toggle-headers-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 11px;
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .toggle-headers-btn:hover {
    color: var(--text-normal, #dcddde);
  }

  .toggle-icon {
    font-size: 8px;
  }

  .headers-section {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .header-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .header-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .header-key,
  .header-value {
    flex: 1;
    background: var(--background-secondary, #2f3136);
    border: none;
    border-radius: 3px;
    padding: 6px 8px;
    color: var(--text-normal, #dcddde);
    font-size: 11px;
  }

  .header-key {
    font-weight: 600;
  }

  .remove-header-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
  }

  .remove-header-btn:hover {
    color: var(--text-danger, #ed4245);
  }

  .add-header-btn {
    background: transparent;
    border: 1px dashed var(--background-modifier-accent, #4f545c);
    border-radius: 3px;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 6px;
    font-size: 11px;
  }

  .add-header-btn:hover {
    border-color: var(--brand-experiment, #5865f2);
    color: var(--brand-experiment, #5865f2);
  }

  .body-section {
    margin-bottom: 8px;
  }

  .body-label {
    font-size: 11px;
    color: var(--text-muted, #72767d);
    margin-bottom: 4px;
  }

  .body-input {
    width: 100%;
    background: var(--background-tertiary, #202225);
    border: none;
    border-radius: 4px;
    padding: 8px;
    color: var(--text-normal, #dcddde);
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
    resize: vertical;
    min-height: 60px;
  }

  .body-input:focus {
    outline: 2px solid var(--brand-experiment, #5865f2);
    outline-offset: -2px;
  }

  .error-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: rgba(237, 66, 69, 0.1);
    border-radius: 4px;
    color: var(--text-danger, #ed4245);
    margin-bottom: 8px;
  }

  .error-icon {
    font-size: 14px;
  }

  .error-message {
    font-size: 12px;
  }

  .response-section {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    overflow: hidden;
  }

  .response-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .status-success {
    background: rgba(59, 165, 92, 0.2);
    color: #3ba55c;
  }

  .status-redirect {
    background: rgba(250, 166, 26, 0.2);
    color: #faa61a;
  }

  .status-client-error {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }

  .status-server-error {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }

  .status-error {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }

  .response-meta {
    font-size: 10px;
    color: var(--text-muted, #72767d);
  }

  .response-tabs {
    display: flex;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 3px;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .tab-btn.active {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }

  .copy-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
    border-radius: 3px;
  }

  .copy-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .response-content {
    max-height: 200px;
    overflow: auto;
  }

  .response-body,
  .response-raw {
    margin: 0;
    padding: 10px;
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
    color: var(--text-normal, #dcddde);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .response-body.compact {
    max-height: 80px;
    overflow: hidden;
    font-size: 10px;
  }

  .response-headers {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .header-item {
    display: flex;
    gap: 8px;
    font-size: 11px;
  }

  .header-name {
    color: var(--brand-experiment, #5865f2);
    font-weight: 600;
    flex-shrink: 0;
  }

  .header-val {
    color: var(--text-normal, #dcddde);
    word-break: break-all;
  }

  .copy-feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 6px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    margin-top: 8px;
  }

  .history-panel {
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    overflow: hidden;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-normal, #dcddde);
  }

  .clear-history-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 10px;
    padding: 2px 6px;
  }

  .clear-history-btn:hover {
    color: var(--text-danger, #ed4245);
  }

  .history-empty {
    padding: 20px;
    text-align: center;
    color: var(--text-muted, #72767d);
    font-size: 12px;
  }

  .history-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    width: 100%;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .history-item:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
  }

  .history-method {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .history-url {
    flex: 1;
    font-size: 11px;
    color: var(--text-normal, #dcddde);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-status {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }
</style>
