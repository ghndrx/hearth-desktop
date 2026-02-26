<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  export let messages: Array<{
    id: string;
    author: string;
    content: string;
    timestamp: string;
    attachments?: Array<{ name: string; url: string }>;
  }> = [];
  export let channelName = '';
  export let serverName = '';
  export let dateRange: { start?: Date; end?: Date } = {};
  export let includeAttachments = false;
  export let includeTimestamps = true;
  export let theme: 'light' | 'dark' | 'system' = 'light';
  
  const dispatch = createEventDispatcher<{
    print: { success: boolean; pageCount?: number };
    export: { success: boolean; path?: string; format: string };
    preview: { html: string };
    error: { message: string; code: string };
  }>();
  
  type ExportFormat = 'pdf' | 'html' | 'txt' | 'json' | 'csv';
  
  interface PrintOptions {
    orientation: 'portrait' | 'landscape';
    paperSize: 'a4' | 'letter' | 'legal';
    margins: { top: number; bottom: number; left: number; right: number };
    headerFooter: boolean;
    pageNumbers: boolean;
    colorMode: 'color' | 'grayscale';
  }
  
  interface ExportOptions {
    format: ExportFormat;
    includeMetadata: boolean;
    compression: boolean;
    splitByDate: boolean;
  }
  
  let isPrinting = false;
  let isExporting = false;
  let previewHtml = '';
  let showPreview = false;
  let progress = 0;
  let statusMessage = '';
  let unlistenFns: UnlistenFn[] = [];
  
  let printOptions: PrintOptions = {
    orientation: 'portrait',
    paperSize: 'letter',
    margins: { top: 20, bottom: 20, left: 15, right: 15 },
    headerFooter: true,
    pageNumbers: true,
    colorMode: 'color'
  };
  
  let exportOptions: ExportOptions = {
    format: 'pdf',
    includeMetadata: true,
    compression: false,
    splitByDate: false
  };
  
  onMount(async () => {
    try {
      const progressUnsub = await listen<{ progress: number; status: string }>('print:progress', (event) => {
        progress = event.payload.progress;
        statusMessage = event.payload.status;
      });
      unlistenFns.push(progressUnsub);
      
      const completeUnsub = await listen<{ success: boolean; error?: string }>('print:complete', (event) => {
        isPrinting = false;
        isExporting = false;
        progress = 0;
        
        if (event.payload.success) {
          dispatch('print', { success: true });
        } else {
          dispatch('error', { 
            message: event.payload.error || 'Print operation failed', 
            code: 'PRINT_FAILED' 
          });
        }
      });
      unlistenFns.push(completeUnsub);
    } catch (e) {
      console.warn('Print event listeners not available:', e);
    }
  });
  
  onDestroy(() => {
    unlistenFns.forEach(fn => fn());
  });
  
  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function filterMessagesByDateRange(msgs: typeof messages): typeof messages {
    return msgs.filter(msg => {
      const msgDate = new Date(msg.timestamp);
      if (dateRange.start && msgDate < dateRange.start) return false;
      if (dateRange.end && msgDate > dateRange.end) return false;
      return true;
    });
  }
  
  function generateHtmlContent(): string {
    const filteredMessages = filterMessagesByDateRange(messages);
    const themeStyles = theme === 'dark' ? `
      body { background: #1a1a2e; color: #eaeaea; }
      .message { background: #2d2d44; border-color: #3d3d5c; }
      .author { color: #7289da; }
      .timestamp { color: #72767d; }
      .attachment { background: #3d3d5c; }
    ` : `
      body { background: #ffffff; color: #2e3338; }
      .message { background: #f2f3f5; border-color: #e3e5e8; }
      .author { color: #5865f2; }
      .timestamp { color: #747f8d; }
      .attachment { background: #ebedef; }
    `;
    
    const messagesHtml = filteredMessages.map(msg => `
      <div class="message">
        <div class="message-header">
          <span class="author">${escapeHtml(msg.author)}</span>
          ${includeTimestamps ? `<span class="timestamp">${formatTimestamp(msg.timestamp)}</span>` : ''}
        </div>
        <div class="content">${escapeHtml(msg.content)}</div>
        ${includeAttachments && msg.attachments?.length ? `
          <div class="attachments">
            ${msg.attachments.map(att => `
              <div class="attachment">📎 ${escapeHtml(att.name)}</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(channelName)} - ${escapeHtml(serverName)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            padding: 20px;
          }
          ${themeStyles}
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid currentColor;
          }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header h2 { font-size: 16px; font-weight: normal; opacity: 0.8; }
          .header .date-range { font-size: 12px; margin-top: 10px; opacity: 0.6; }
          .message {
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 8px;
            border: 1px solid;
          }
          .message-header {
            display: flex;
            align-items: baseline;
            gap: 12px;
            margin-bottom: 6px;
          }
          .author { font-weight: 600; }
          .timestamp { font-size: 12px; }
          .content { white-space: pre-wrap; word-wrap: break-word; }
          .attachments { margin-top: 8px; }
          .attachment {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin: 2px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid currentColor;
            text-align: center;
            font-size: 12px;
            opacity: 0.6;
          }
          @media print {
            body { padding: 0; }
            .message { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${printOptions.headerFooter ? `
          <div class="header">
            <h1>#${escapeHtml(channelName)}</h1>
            <h2>${escapeHtml(serverName)}</h2>
            ${dateRange.start || dateRange.end ? `
              <div class="date-range">
                ${dateRange.start ? formatTimestamp(dateRange.start.toISOString()) : 'Beginning'} 
                to 
                ${dateRange.end ? formatTimestamp(dateRange.end.toISOString()) : 'Present'}
              </div>
            ` : ''}
          </div>
        ` : ''}
        <div class="messages">
          ${messagesHtml}
        </div>
        ${printOptions.headerFooter ? `
          <div class="footer">
            Exported from Hearth Desktop • ${filteredMessages.length} messages • ${new Date().toLocaleDateString()}
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }
  
  function generateTextContent(): string {
    const filteredMessages = filterMessagesByDateRange(messages);
    const lines: string[] = [];
    
    if (exportOptions.includeMetadata) {
      lines.push(`# ${channelName} - ${serverName}`);
      lines.push(`# Exported: ${new Date().toISOString()}`);
      lines.push(`# Messages: ${filteredMessages.length}`);
      lines.push('');
    }
    
    for (const msg of filteredMessages) {
      const timestamp = includeTimestamps ? `[${formatTimestamp(msg.timestamp)}] ` : '';
      lines.push(`${timestamp}${msg.author}: ${msg.content}`);
      
      if (includeAttachments && msg.attachments?.length) {
        for (const att of msg.attachments) {
          lines.push(`  📎 ${att.name}`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  function generateJsonContent(): string {
    const filteredMessages = filterMessagesByDateRange(messages);
    const data = {
      metadata: exportOptions.includeMetadata ? {
        channelName,
        serverName,
        exportedAt: new Date().toISOString(),
        messageCount: filteredMessages.length,
        dateRange: {
          start: dateRange.start?.toISOString() || null,
          end: dateRange.end?.toISOString() || null
        }
      } : undefined,
      messages: filteredMessages.map(msg => ({
        id: msg.id,
        author: msg.author,
        content: msg.content,
        timestamp: msg.timestamp,
        ...(includeAttachments && msg.attachments?.length ? { attachments: msg.attachments } : {})
      }))
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  function generateCsvContent(): string {
    const filteredMessages = filterMessagesByDateRange(messages);
    const headers = ['ID', 'Author', 'Content', 'Timestamp'];
    if (includeAttachments) headers.push('Attachments');
    
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    
    const rows = filteredMessages.map(msg => {
      const row = [
        msg.id,
        msg.author,
        msg.content,
        msg.timestamp
      ];
      if (includeAttachments) {
        row.push(msg.attachments?.map(a => a.name).join('; ') || '');
      }
      return row.map(escapeCsv).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  export async function print(): Promise<void> {
    if (isPrinting || messages.length === 0) return;
    
    isPrinting = true;
    progress = 0;
    statusMessage = 'Preparing document...';
    
    try {
      const html = generateHtmlContent();
      
      await invoke('plugin:print|print_document', {
        html,
        options: {
          orientation: printOptions.orientation,
          paper_size: printOptions.paperSize,
          margins: printOptions.margins,
          page_numbers: printOptions.pageNumbers,
          color_mode: printOptions.colorMode
        }
      });
      
      dispatch('print', { success: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Print failed';
      dispatch('error', { message, code: 'PRINT_ERROR' });
    } finally {
      isPrinting = false;
      progress = 0;
    }
  }
  
  export async function exportTo(format?: ExportFormat): Promise<void> {
    if (isExporting || messages.length === 0) return;
    
    const targetFormat = format || exportOptions.format;
    isExporting = true;
    progress = 0;
    statusMessage = `Generating ${targetFormat.toUpperCase()}...`;
    
    try {
      let content: string;
      let mimeType: string;
      let extension: string;
      
      switch (targetFormat) {
        case 'pdf':
          content = generateHtmlContent();
          mimeType = 'application/pdf';
          extension = 'pdf';
          break;
        case 'html':
          content = generateHtmlContent();
          mimeType = 'text/html';
          extension = 'html';
          break;
        case 'txt':
          content = generateTextContent();
          mimeType = 'text/plain';
          extension = 'txt';
          break;
        case 'json':
          content = generateJsonContent();
          mimeType = 'application/json';
          extension = 'json';
          break;
        case 'csv':
          content = generateCsvContent();
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        default:
          throw new Error(`Unsupported format: ${targetFormat}`);
      }
      
      const filename = `${serverName}-${channelName}-${new Date().toISOString().split('T')[0]}.${extension}`;
      
      if (targetFormat === 'pdf') {
        const path = await invoke<string>('plugin:print|export_pdf', {
          html: content,
          filename,
          options: {
            orientation: printOptions.orientation,
            paper_size: printOptions.paperSize,
            margins: printOptions.margins
          }
        });
        dispatch('export', { success: true, path, format: targetFormat });
      } else {
        const path = await invoke<string>('plugin:fs|save_file', {
          content,
          filename,
          mimeType
        });
        dispatch('export', { success: true, path, format: targetFormat });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export failed';
      dispatch('error', { message, code: 'EXPORT_ERROR' });
    } finally {
      isExporting = false;
      progress = 0;
    }
  }
  
  export function showPrintPreview(): void {
    previewHtml = generateHtmlContent();
    showPreview = true;
    dispatch('preview', { html: previewHtml });
  }
  
  export function closePrintPreview(): void {
    showPreview = false;
    previewHtml = '';
  }
  
  export function setPrintOptions(options: Partial<PrintOptions>): void {
    printOptions = { ...printOptions, ...options };
  }
  
  export function setExportOptions(options: Partial<ExportOptions>): void {
    exportOptions = { ...exportOptions, ...options };
  }
  
  export function getMessageCount(): number {
    return filterMessagesByDateRange(messages).length;
  }
</script>

<div class="print-manager" class:printing={isPrinting} class:exporting={isExporting}>
  <div class="print-options">
    <h3>Print Options</h3>
    
    <div class="option-group">
      <label>
        <span>Orientation</span>
        <select bind:value={printOptions.orientation}>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      
      <label>
        <span>Paper Size</span>
        <select bind:value={printOptions.paperSize}>
          <option value="letter">Letter</option>
          <option value="a4">A4</option>
          <option value="legal">Legal</option>
        </select>
      </label>
    </div>
    
    <div class="option-group">
      <label class="checkbox">
        <input type="checkbox" bind:checked={printOptions.headerFooter} />
        <span>Include header & footer</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" bind:checked={printOptions.pageNumbers} />
        <span>Page numbers</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" bind:checked={includeTimestamps} />
        <span>Include timestamps</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" bind:checked={includeAttachments} />
        <span>List attachments</span>
      </label>
    </div>
    
    <label>
      <span>Color Mode</span>
      <select bind:value={printOptions.colorMode}>
        <option value="color">Color</option>
        <option value="grayscale">Grayscale</option>
      </select>
    </label>
  </div>
  
  <div class="export-options">
    <h3>Export Options</h3>
    
    <label>
      <span>Format</span>
      <select bind:value={exportOptions.format}>
        <option value="pdf">PDF Document</option>
        <option value="html">HTML Page</option>
        <option value="txt">Plain Text</option>
        <option value="json">JSON Data</option>
        <option value="csv">CSV Spreadsheet</option>
      </select>
    </label>
    
    <label class="checkbox">
      <input type="checkbox" bind:checked={exportOptions.includeMetadata} />
      <span>Include metadata</span>
    </label>
  </div>
  
  <div class="message-info">
    <span class="count">{getMessageCount()} messages</span>
    {#if channelName}
      <span class="channel">#{channelName}</span>
    {/if}
  </div>
  
  {#if isPrinting || isExporting}
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <span class="status">{statusMessage}</span>
    </div>
  {/if}
  
  <div class="actions">
    <button 
      class="preview-btn"
      on:click={showPrintPreview}
      disabled={isPrinting || isExporting || messages.length === 0}
    >
      👁️ Preview
    </button>
    
    <button 
      class="print-btn"
      on:click={print}
      disabled={isPrinting || isExporting || messages.length === 0}
    >
      🖨️ Print
    </button>
    
    <button 
      class="export-btn"
      on:click={() => exportTo()}
      disabled={isPrinting || isExporting || messages.length === 0}
    >
      📤 Export {exportOptions.format.toUpperCase()}
    </button>
  </div>
</div>

{#if showPreview}
  <div class="preview-overlay" on:click={closePrintPreview} on:keydown={(e) => e.key === 'Escape' && closePrintPreview()} role="dialog" tabindex="-1">
    <div class="preview-modal" on:click|stopPropagation on:keydown|stopPropagation role="document">
      <div class="preview-header">
        <h3>Print Preview</h3>
        <button class="close-btn" on:click={closePrintPreview}>✕</button>
      </div>
      <div class="preview-content">
        <iframe 
          srcdoc={previewHtml} 
          title="Print Preview"
          sandbox="allow-same-origin"
        ></iframe>
      </div>
      <div class="preview-actions">
        <button on:click={closePrintPreview}>Cancel</button>
        <button class="primary" on:click={print}>Print</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .print-manager {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    color: var(--text-normal, #dcddde);
  }
  
  .print-manager.printing,
  .print-manager.exporting {
    opacity: 0.9;
    pointer-events: none;
  }
  
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-muted, #96989d);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .print-options,
  .export-options {
    padding: 12px;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
  }
  
  .option-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
  
  label span {
    color: var(--text-muted, #96989d);
  }
  
  label.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  
  label.checkbox span {
    color: var(--text-normal, #dcddde);
  }
  
  select {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: var(--bg-secondary, #2f3136);
    color: var(--text-normal, #dcddde);
    font-size: 13px;
    cursor: pointer;
  }
  
  select:focus {
    outline: 2px solid var(--brand-experiment, #5865f2);
  }
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--brand-experiment, #5865f2);
  }
  
  .message-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
    font-size: 13px;
  }
  
  .count {
    color: var(--text-normal, #dcddde);
    font-weight: 500;
  }
  
  .channel {
    color: var(--text-muted, #96989d);
  }
  
  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .progress-bar {
    height: 4px;
    background: var(--bg-tertiary, #202225);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--brand-experiment, #5865f2);
    transition: width 0.3s ease;
  }
  
  .status {
    font-size: 12px;
    color: var(--text-muted, #96989d);
  }
  
  .actions {
    display: flex;
    gap: 8px;
  }
  
  button {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  button:not(:disabled):hover {
    filter: brightness(1.1);
  }
  
  button:not(:disabled):active {
    transform: scale(0.98);
  }
  
  .preview-btn {
    background: var(--bg-tertiary, #202225);
    color: var(--text-normal, #dcddde);
  }
  
  .print-btn {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }
  
  .export-btn {
    background: var(--green-360, #3ba55c);
    color: white;
  }
  
  .preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .preview-modal {
    width: 90vw;
    max-width: 900px;
    height: 85vh;
    background: var(--bg-primary, #36393f);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--bg-tertiary, #202225);
  }
  
  .preview-header h3 {
    margin: 0;
    font-size: 16px;
    text-transform: none;
    letter-spacing: normal;
    color: var(--text-normal, #dcddde);
  }
  
  .close-btn {
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    color: var(--text-muted, #96989d);
    font-size: 18px;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: var(--bg-secondary, #2f3136);
    color: var(--text-normal, #dcddde);
  }
  
  .preview-content {
    flex: 1;
    padding: 16px;
    overflow: hidden;
  }
  
  .preview-content iframe {
    width: 100%;
    height: 100%;
    border: 1px solid var(--bg-tertiary, #202225);
    border-radius: 4px;
    background: white;
  }
  
  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--bg-tertiary, #202225);
  }
  
  .preview-actions button {
    flex: none;
    min-width: 80px;
  }
  
  .preview-actions button.primary {
    background: var(--brand-experiment, #5865f2);
    color: white;
  }
</style>
