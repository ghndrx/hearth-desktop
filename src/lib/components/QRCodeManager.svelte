<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let showPanel: boolean = false;
  export let defaultTab: 'generate' | 'scan' | 'history' = 'generate';
  
  // Types
  interface QrContent {
    type: 'Text' | 'Wifi' | 'Contact' | 'ServerInvite' | 'VoiceInvite';
    data: string | WifiData | ContactData | InviteData | VoiceData;
  }
  
  interface WifiData {
    ssid: string;
    password: string;
    encryption: string;
  }
  
  interface ContactData {
    name: string;
    phone?: string;
    email?: string;
  }
  
  interface InviteData {
    code: string;
    server_name?: string;
  }
  
  interface VoiceData {
    channel_id: string;
    server_id: string;
  }
  
  interface QrOptions {
    size?: number;
    error_correction?: string;
    fg_color?: string;
    bg_color?: string;
    quiet_zone?: boolean;
  }
  
  interface QrResult {
    image_base64: string;
    width: number;
    height: number;
    content: string;
  }
  
  interface QrHistoryEntry {
    id: string;
    content: QrContent;
    action: string;
    timestamp: number;
    image_base64?: string;
  }
  
  // State
  let activeTab: 'generate' | 'scan' | 'history' = defaultTab;
  let isLoading: boolean = false;
  let error: string | null = null;
  
  // Generate state
  let generateType: 'text' | 'wifi' | 'contact' | 'invite' = 'text';
  let textContent: string = '';
  let wifiSsid: string = '';
  let wifiPassword: string = '';
  let wifiEncryption: string = 'WPA';
  let contactName: string = '';
  let contactPhone: string = '';
  let contactEmail: string = '';
  let inviteCode: string = '';
  let serverName: string = '';
  
  // Options
  let qrSize: number = 256;
  let fgColor: string = '#000000';
  let bgColor: string = '#ffffff';
  let showAdvanced: boolean = false;
  
  // Results
  let generatedQr: QrResult | null = null;
  let history: QrHistoryEntry[] = [];
  
  // Scan state
  let dragOver: boolean = false;
  let scanResult: { content: string; contentType: QrContent } | null = null;
  
  /**
   * Generate QR code
   */
  async function generate(): Promise<void> {
    try {
      isLoading = true;
      error = null;
      
      let content: QrContent;
      
      switch (generateType) {
        case 'wifi':
          content = {
            type: 'Wifi',
            data: { ssid: wifiSsid, password: wifiPassword, encryption: wifiEncryption }
          };
          break;
        case 'contact':
          content = {
            type: 'Contact',
            data: { 
              name: contactName, 
              phone: contactPhone || undefined, 
              email: contactEmail || undefined 
            }
          };
          break;
        case 'invite':
          content = {
            type: 'ServerInvite',
            data: { code: inviteCode, server_name: serverName || undefined }
          };
          break;
        default:
          content = { type: 'Text', data: textContent };
      }
      
      const options: QrOptions = {
        size: qrSize,
        fg_color: fgColor,
        bg_color: bgColor,
        error_correction: 'M',
        quiet_zone: true
      };
      
      generatedQr = await invoke<QrResult>('qr_generate', { content, options });
      
      dispatch('generate', { result: generatedQr, content });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', { action: 'generate', error });
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Copy QR code image to clipboard
   */
  async function copyToClipboard(): Promise<void> {
    if (!generatedQr) return;
    
    try {
      await invoke('clipboard_copy_image', { 
        base64Data: generatedQr.image_base64,
        trackHistory: true
      });
      dispatch('copy', { result: generatedQr });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  
  /**
   * Download QR code as PNG
   */
  function downloadQr(): void {
    if (!generatedQr) return;
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedQr.image_base64}`;
    link.download = `qrcode-${Date.now()}.png`;
    link.click();
    
    dispatch('download', { result: generatedQr });
  }
  
  /**
   * Handle file drop for scanning
   */
  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragOver = false;
    
    const file = event.dataTransfer?.files[0];
    if (!file || !file.type.startsWith('image/')) {
      error = 'Please drop an image file';
      return;
    }
    
    try {
      isLoading = true;
      error = null;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        
        try {
          scanResult = await invoke('qr_scan', { imageBase64: base64 });
          dispatch('scan', { result: scanResult });
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        } finally {
          isLoading = false;
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      isLoading = false;
    }
  }
  
  /**
   * Load history
   */
  async function loadHistory(): Promise<void> {
    try {
      history = await invoke<QrHistoryEntry[]>('qr_get_history', { limit: 50 });
    } catch (err) {
      console.error('Failed to load QR history:', err);
    }
  }
  
  /**
   * Clear history
   */
  async function clearHistory(): Promise<void> {
    try {
      await invoke('qr_clear_history');
      history = [];
      dispatch('historyClear');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  
  /**
   * Format timestamp
   */
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }
  
  /**
   * Get content type display
   */
  function getContentDisplay(content: QrContent): string {
    switch (content.type) {
      case 'Text':
        const text = content.data as string;
        return text.length > 50 ? text.slice(0, 50) + '...' : text;
      case 'Wifi':
        return `WiFi: ${(content.data as WifiData).ssid}`;
      case 'Contact':
        return `Contact: ${(content.data as ContactData).name}`;
      case 'ServerInvite':
        const invite = content.data as InviteData;
        return invite.server_name ? `Invite: ${invite.server_name}` : `Invite: ${invite.code}`;
      case 'VoiceInvite':
        return 'Voice Channel Invite';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Get icon for content type
   */
  function getContentIcon(content: QrContent): string {
    switch (content.type) {
      case 'Text': return '📝';
      case 'Wifi': return '📶';
      case 'Contact': return '👤';
      case 'ServerInvite': return '🔗';
      case 'VoiceInvite': return '🎤';
      default: return '📱';
    }
  }
  
  // Switch tabs
  function switchTab(tab: 'generate' | 'scan' | 'history'): void {
    activeTab = tab;
    if (tab === 'history') {
      loadHistory();
    }
  }
  
  onMount(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  });
</script>

{#if showPanel}
  <div class="qr-manager">
    <div class="qr-header">
      <h3>📱 QR Code Manager</h3>
      <button class="close-button" on:click={() => showPanel = false}>✕</button>
    </div>
    
    <div class="qr-tabs">
      <button 
        class="tab-button" 
        class:active={activeTab === 'generate'}
        on:click={() => switchTab('generate')}
      >
        Generate
      </button>
      <button 
        class="tab-button" 
        class:active={activeTab === 'scan'}
        on:click={() => switchTab('scan')}
      >
        Scan
      </button>
      <button 
        class="tab-button" 
        class:active={activeTab === 'history'}
        on:click={() => switchTab('history')}
      >
        History
      </button>
    </div>
    
    {#if error}
      <div class="qr-error">
        ⚠️ {error}
        <button on:click={() => error = null}>✕</button>
      </div>
    {/if}
    
    <div class="qr-content">
      {#if activeTab === 'generate'}
        <div class="generate-panel">
          <div class="type-selector">
            <button 
              class="type-button" 
              class:active={generateType === 'text'}
              on:click={() => generateType = 'text'}
            >
              📝 Text/URL
            </button>
            <button 
              class="type-button" 
              class:active={generateType === 'wifi'}
              on:click={() => generateType = 'wifi'}
            >
              📶 WiFi
            </button>
            <button 
              class="type-button" 
              class:active={generateType === 'contact'}
              on:click={() => generateType = 'contact'}
            >
              👤 Contact
            </button>
            <button 
              class="type-button" 
              class:active={generateType === 'invite'}
              on:click={() => generateType = 'invite'}
            >
              🔗 Invite
            </button>
          </div>
          
          <div class="input-section">
            {#if generateType === 'text'}
              <textarea 
                bind:value={textContent}
                placeholder="Enter text or URL..."
                rows="3"
              ></textarea>
            {:else if generateType === 'wifi'}
              <input 
                type="text" 
                bind:value={wifiSsid}
                placeholder="Network Name (SSID)"
              />
              <input 
                type="password" 
                bind:value={wifiPassword}
                placeholder="Password"
              />
              <select bind:value={wifiEncryption}>
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">None</option>
              </select>
            {:else if generateType === 'contact'}
              <input 
                type="text" 
                bind:value={contactName}
                placeholder="Name"
              />
              <input 
                type="tel" 
                bind:value={contactPhone}
                placeholder="Phone (optional)"
              />
              <input 
                type="email" 
                bind:value={contactEmail}
                placeholder="Email (optional)"
              />
            {:else if generateType === 'invite'}
              <input 
                type="text" 
                bind:value={inviteCode}
                placeholder="Invite Code"
              />
              <input 
                type="text" 
                bind:value={serverName}
                placeholder="Server Name (optional)"
              />
            {/if}
          </div>
          
          <button 
            class="advanced-toggle"
            on:click={() => showAdvanced = !showAdvanced}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
          
          {#if showAdvanced}
            <div class="advanced-options">
              <label>
                Size: {qrSize}px
                <input type="range" min="128" max="512" step="32" bind:value={qrSize} />
              </label>
              <label>
                Foreground Color
                <input type="color" bind:value={fgColor} />
              </label>
              <label>
                Background Color
                <input type="color" bind:value={bgColor} />
              </label>
            </div>
          {/if}
          
          <button 
            class="generate-button"
            on:click={generate}
            disabled={isLoading || (generateType === 'text' && !textContent) || 
                     (generateType === 'wifi' && !wifiSsid) ||
                     (generateType === 'contact' && !contactName) ||
                     (generateType === 'invite' && !inviteCode)}
          >
            {#if isLoading}
              <span class="spinner"></span> Generating...
            {:else}
              Generate QR Code
            {/if}
          </button>
          
          {#if generatedQr}
            <div class="qr-result">
              <img 
                src="data:image/png;base64,{generatedQr.image_base64}"
                alt="Generated QR Code"
                width={generatedQr.width}
                height={generatedQr.height}
              />
              <div class="qr-actions">
                <button on:click={copyToClipboard} title="Copy to Clipboard">
                  📋 Copy
                </button>
                <button on:click={downloadQr} title="Download PNG">
                  💾 Download
                </button>
              </div>
            </div>
          {/if}
        </div>
        
      {:else if activeTab === 'scan'}
        <div class="scan-panel">
          <div 
            class="drop-zone"
            class:drag-over={dragOver}
            on:dragover|preventDefault={() => dragOver = true}
            on:dragleave={() => dragOver = false}
            on:drop={handleDrop}
          >
            {#if isLoading}
              <span class="spinner large"></span>
              <p>Scanning...</p>
            {:else}
              <span class="drop-icon">📷</span>
              <p>Drop an image with a QR code here</p>
              <span class="drop-hint">or paste from clipboard</span>
            {/if}
          </div>
          
          {#if scanResult}
            <div class="scan-result">
              <div class="result-header">
                <span>{getContentIcon(scanResult.contentType)}</span>
                <span class="result-type">{scanResult.contentType.type}</span>
              </div>
              <div class="result-content">
                {scanResult.content}
              </div>
              <div class="result-actions">
                <button on:click={() => navigator.clipboard.writeText(scanResult?.content || '')}>
                  📋 Copy
                </button>
                {#if scanResult.content.startsWith('http')}
                  <button on:click={() => window.open(scanResult?.content, '_blank')}>
                    🔗 Open Link
                  </button>
                {/if}
              </div>
            </div>
          {/if}
        </div>
        
      {:else if activeTab === 'history'}
        <div class="history-panel">
          {#if history.length === 0}
            <div class="history-empty">
              <span>📱</span>
              <p>No QR code history yet</p>
            </div>
          {:else}
            <div class="history-header">
              <span>{history.length} items</span>
              <button class="clear-button" on:click={clearHistory}>
                Clear All
              </button>
            </div>
            
            <ul class="history-list">
              {#each history as entry (entry.id)}
                <li class="history-entry">
                  <div class="entry-icon">
                    {getContentIcon(entry.content)}
                  </div>
                  <div class="entry-info">
                    <span class="entry-content">{getContentDisplay(entry.content)}</span>
                    <span class="entry-meta">
                      {entry.action === 'generated' ? 'Generated' : 'Scanned'} • {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  {#if entry.image_base64}
                    <img 
                      class="entry-preview"
                      src="data:image/png;base64,{entry.image_base64}"
                      alt="QR Preview"
                    />
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .qr-manager {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    width: 400px;
    max-height: 600px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .qr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #40444b);
  }
  
  .qr-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .close-button {
    background: transparent;
    border: none;
    color: var(--text-muted, #8e9297);
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    transition: color 0.15s ease;
  }
  
  .close-button:hover {
    color: var(--text-primary, #fff);
  }
  
  .qr-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #40444b);
    padding: 0 8px;
  }
  
  .tab-button {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-muted, #8e9297);
    padding: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s ease;
    border-bottom: 2px solid transparent;
  }
  
  .tab-button:hover {
    color: var(--text-primary, #fff);
  }
  
  .tab-button.active {
    color: var(--accent-color, #5865f2);
    border-bottom-color: var(--accent-color, #5865f2);
  }
  
  .qr-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
    color: var(--error-text, #ed4245);
    padding: 8px 12px;
    margin: 8px;
    border-radius: 4px;
    font-size: 13px;
  }
  
  .qr-error button {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    margin-left: auto;
  }
  
  .qr-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  
  .type-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .type-button {
    background: var(--bg-tertiary, #36393f);
    border: 1px solid transparent;
    color: var(--text-muted, #8e9297);
    padding: 8px 4px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    text-align: center;
    transition: all 0.15s ease;
  }
  
  .type-button:hover {
    background: var(--bg-hover, #40444b);
    color: var(--text-primary, #fff);
  }
  
  .type-button.active {
    background: var(--accent-color, #5865f2);
    color: white;
    border-color: var(--accent-color, #5865f2);
  }
  
  .input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .input-section input,
  .input-section textarea,
  .input-section select {
    background: var(--bg-tertiary, #36393f);
    border: 1px solid var(--border-color, #40444b);
    color: var(--text-primary, #fff);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }
  
  .input-section input:focus,
  .input-section textarea:focus,
  .input-section select:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }
  
  .input-section textarea {
    resize: vertical;
    min-height: 60px;
  }
  
  .advanced-toggle {
    background: transparent;
    border: none;
    color: var(--text-muted, #8e9297);
    cursor: pointer;
    font-size: 12px;
    padding: 8px 0;
    text-align: left;
    width: 100%;
  }
  
  .advanced-toggle:hover {
    color: var(--text-primary, #fff);
  }
  
  .advanced-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--bg-tertiary, #36393f);
    border-radius: 6px;
    margin-bottom: 12px;
  }
  
  .advanced-options label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text-muted, #8e9297);
    font-size: 12px;
  }
  
  .advanced-options input[type="range"] {
    width: 100%;
  }
  
  .advanced-options input[type="color"] {
    width: 60px;
    height: 30px;
    padding: 2px;
    cursor: pointer;
  }
  
  .generate-button {
    width: 100%;
    background: var(--accent-color, #5865f2);
    border: none;
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .generate-button:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }
  
  .generate-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .qr-result {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  
  .qr-result img {
    max-width: 200px;
    border-radius: 8px;
    background: white;
    padding: 8px;
  }
  
  .qr-actions {
    display: flex;
    gap: 8px;
  }
  
  .qr-actions button {
    background: var(--bg-tertiary, #36393f);
    border: 1px solid var(--border-color, #40444b);
    color: var(--text-primary, #fff);
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
  }
  
  .qr-actions button:hover {
    background: var(--bg-hover, #40444b);
  }
  
  .drop-zone {
    border: 2px dashed var(--border-color, #40444b);
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    transition: all 0.15s ease;
  }
  
  .drop-zone.drag-over {
    border-color: var(--accent-color, #5865f2);
    background: rgba(88, 101, 242, 0.1);
  }
  
  .drop-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }
  
  .drop-zone p {
    color: var(--text-primary, #fff);
    margin: 0 0 4px 0;
  }
  
  .drop-hint {
    color: var(--text-muted, #8e9297);
    font-size: 12px;
  }
  
  .scan-result {
    margin-top: 16px;
    background: var(--bg-tertiary, #36393f);
    border-radius: 8px;
    padding: 16px;
  }
  
  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .result-type {
    color: var(--text-muted, #8e9297);
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .result-content {
    color: var(--text-primary, #fff);
    word-break: break-all;
    font-size: 14px;
    margin-bottom: 12px;
  }
  
  .result-actions {
    display: flex;
    gap: 8px;
  }
  
  .result-actions button {
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--border-color, #40444b);
    color: var(--text-primary, #fff);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }
  
  .result-actions button:hover {
    background: var(--bg-hover, #40444b);
  }
  
  .history-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .history-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted, #8e9297);
  }
  
  .history-empty span {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted, #8e9297);
    font-size: 12px;
  }
  
  .clear-button {
    background: transparent;
    border: 1px solid var(--border-color, #40444b);
    color: var(--text-muted, #8e9297);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s ease;
  }
  
  .clear-button:hover {
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
    color: var(--error-text, #ed4245);
    border-color: var(--error-text, #ed4245);
  }
  
  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .history-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-tertiary, #36393f);
    padding: 12px;
    border-radius: 6px;
  }
  
  .entry-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .entry-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .entry-content {
    color: var(--text-primary, #fff);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .entry-meta {
    color: var(--text-muted, #8e9297);
    font-size: 11px;
  }
  
  .entry-preview {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    background: white;
    flex-shrink: 0;
  }
  
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .spinner.large {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
