<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

  // Export format types
  type ExportFormat = 'json' | 'csv' | 'html' | 'markdown';
  
  // Data category types
  type DataCategory = 'messages' | 'settings' | 'contacts' | 'channels' | 'servers' | 'activity' | 'bookmarks';

  interface ExportOptions {
    format: ExportFormat;
    categories: DataCategory[];
    dateRange: {
      start: Date | null;
      end: Date | null;
    };
    includeAttachments: boolean;
    compress: boolean;
  }

  interface ExportProgress {
    category: DataCategory;
    current: number;
    total: number;
    status: 'pending' | 'processing' | 'complete' | 'error';
    error?: string;
  }

  // Props
  export let visible: boolean = false;
  export let onClose: () => void = () => {};
  export let onExportComplete: (filePath: string) => void = () => {};

  // State
  let selectedFormat: ExportFormat = 'json';
  let selectedCategories: Set<DataCategory> = new Set(['messages', 'settings']);
  let startDate: string = '';
  let endDate: string = '';
  let includeAttachments: boolean = false;
  let compressOutput: boolean = false;
  let isExporting: boolean = false;
  let exportProgress: Map<DataCategory, ExportProgress> = new Map();
  let overallProgress: number = 0;
  let exportError: string | null = null;
  let estimatedSize: string = '0 KB';

  const formatOptions: { value: ExportFormat; label: string; description: string; icon: string }[] = [
    { value: 'json', label: 'JSON', description: 'Structured data format', icon: '{ }' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet compatible', icon: '📊' },
    { value: 'html', label: 'HTML', description: 'Web viewable archive', icon: '🌐' },
    { value: 'markdown', label: 'Markdown', description: 'Human readable text', icon: '📝' },
  ];

  const categoryOptions: { value: DataCategory; label: string; description: string; icon: string }[] = [
    { value: 'messages', label: 'Messages', description: 'Chat history and DMs', icon: '💬' },
    { value: 'settings', label: 'Settings', description: 'App preferences', icon: '⚙️' },
    { value: 'contacts', label: 'Contacts', description: 'Friends and connections', icon: '👥' },
    { value: 'channels', label: 'Channels', description: 'Channel configurations', icon: '📢' },
    { value: 'servers', label: 'Servers', description: 'Server memberships', icon: '🏠' },
    { value: 'activity', label: 'Activity', description: 'Usage and activity logs', icon: '📈' },
    { value: 'bookmarks', label: 'Bookmarks', description: 'Saved items and links', icon: '🔖' },
  ];

  // Toggle category selection
  function toggleCategory(category: DataCategory) {
    if (selectedCategories.has(category)) {
      selectedCategories.delete(category);
    } else {
      selectedCategories.add(category);
    }
    selectedCategories = new Set(selectedCategories);
    updateEstimatedSize();
  }

  // Select all categories
  function selectAllCategories() {
    selectedCategories = new Set(categoryOptions.map(c => c.value));
    updateEstimatedSize();
  }

  // Clear all categories
  function clearCategories() {
    selectedCategories = new Set();
    updateEstimatedSize();
  }

  // Update estimated export size
  async function updateEstimatedSize() {
    try {
      const estimate = await invoke<number>('estimate_export_size', {
        categories: Array.from(selectedCategories),
        includeAttachments,
      });
      
      if (estimate < 1024) {
        estimatedSize = `${estimate} B`;
      } else if (estimate < 1024 * 1024) {
        estimatedSize = `${(estimate / 1024).toFixed(1)} KB`;
      } else if (estimate < 1024 * 1024 * 1024) {
        estimatedSize = `${(estimate / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        estimatedSize = `${(estimate / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      }
    } catch (err) {
      estimatedSize = 'Unknown';
    }
  }

  // Start the export process
  async function startExport() {
    if (selectedCategories.size === 0) {
      exportError = 'Please select at least one category to export';
      return;
    }

    exportError = null;
    isExporting = true;
    overallProgress = 0;

    // Initialize progress for each category
    exportProgress = new Map();
    selectedCategories.forEach(cat => {
      exportProgress.set(cat, {
        category: cat,
        current: 0,
        total: 100,
        status: 'pending',
      });
    });
    exportProgress = new Map(exportProgress);

    // Get save path from user
    const extensions = {
      json: ['json'],
      csv: ['csv'],
      html: ['html', 'htm'],
      markdown: ['md', 'markdown'],
    };

    const filePath = await save({
      title: 'Export Data',
      defaultPath: `hearth-export-${new Date().toISOString().split('T')[0]}.${compressOutput ? 'zip' : selectedFormat}`,
      filters: [
        {
          name: formatOptions.find(f => f.value === selectedFormat)?.label || 'Export',
          extensions: compressOutput ? ['zip'] : extensions[selectedFormat],
        },
      ],
    });

    if (!filePath) {
      isExporting = false;
      return;
    }

    try {
      // Process each category
      const categories = Array.from(selectedCategories);
      let completedCategories = 0;

      for (const category of categories) {
        // Update status to processing
        const progress = exportProgress.get(category)!;
        progress.status = 'processing';
        exportProgress = new Map(exportProgress);

        try {
          // Fetch data for category
          const data = await fetchCategoryData(category);
          
          // Update progress
          progress.current = 50;
          exportProgress = new Map(exportProgress);

          // Format data
          const formattedData = formatData(category, data, selectedFormat);
          
          // Update progress
          progress.current = 100;
          progress.status = 'complete';
          exportProgress = new Map(exportProgress);

          completedCategories++;
          overallProgress = Math.round((completedCategories / categories.length) * 100);
        } catch (err) {
          progress.status = 'error';
          progress.error = err instanceof Error ? err.message : 'Unknown error';
          exportProgress = new Map(exportProgress);
        }
      }

      // Compile final export
      const exportData = compileExport(selectedFormat);
      
      // Write to file
      if (selectedFormat === 'json') {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
      } else {
        await writeTextFile(filePath, exportData as string);
      }

      onExportComplete(filePath);
    } catch (err) {
      exportError = err instanceof Error ? err.message : 'Export failed';
    } finally {
      isExporting = false;
    }
  }

  // Fetch data for a specific category
  async function fetchCategoryData(category: DataCategory): Promise<any> {
    const options: ExportOptions = {
      format: selectedFormat,
      categories: [category],
      dateRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null,
      },
      includeAttachments,
      compress: compressOutput,
    };

    return await invoke('export_category_data', {
      category,
      options,
    });
  }

  // Format data based on export format
  function formatData(category: DataCategory, data: any, format: ExportFormat): string | object {
    switch (format) {
      case 'json':
        return data;
      
      case 'csv':
        return convertToCSV(data);
      
      case 'html':
        return convertToHTML(category, data);
      
      case 'markdown':
        return convertToMarkdown(category, data);
      
      default:
        return data;
    }
  }

  // Convert data to CSV format
  function convertToCSV(data: any): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((item: any) => 
      headers.map(header => {
        const value = item[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  // Convert data to HTML format
  function convertToHTML(category: DataCategory, data: any): string {
    const title = categoryOptions.find(c => c.value === category)?.label || category;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hearth Export - ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #7c3aed; }
    .item { background: #252542; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
    .timestamp { color: #888; font-size: 0.85em; }
    pre { background: #1a1a2e; padding: 12px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${title} Export</h1>
  <p>Exported on ${new Date().toLocaleString()}</p>
  <div class="content">
    ${Array.isArray(data) ? data.map((item: any) => `
      <div class="item">
        <pre>${JSON.stringify(item, null, 2)}</pre>
      </div>
    `).join('') : `<pre>${JSON.stringify(data, null, 2)}</pre>`}
  </div>
</body>
</html>`;
  }

  // Convert data to Markdown format
  function convertToMarkdown(category: DataCategory, data: any): string {
    const title = categoryOptions.find(c => c.value === category)?.label || category;
    
    let md = `# ${title} Export\n\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    md += `---\n\n`;

    if (Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        md += `## Item ${index + 1}\n\n`;
        md += '```json\n';
        md += JSON.stringify(item, null, 2);
        md += '\n```\n\n';
      });
    } else {
      md += '```json\n';
      md += JSON.stringify(data, null, 2);
      md += '\n```\n';
    }

    return md;
  }

  // Compile all exported data
  function compileExport(format: ExportFormat): any {
    const compiled: any = {
      exportDate: new Date().toISOString(),
      format,
      categories: Array.from(selectedCategories),
      data: {},
    };

    // In real implementation, this would aggregate all category data
    return compiled;
  }

  // Cancel export
  function cancelExport() {
    isExporting = false;
    exportProgress = new Map();
    overallProgress = 0;
  }

  // Close modal
  function handleClose() {
    if (!isExporting) {
      onClose();
    }
  }

  // Keyboard handling
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isExporting) {
      handleClose();
    }
  }

  onMount(() => {
    updateEstimatedSize();
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if visible}
  <div 
    class="data-exporter-overlay"
    on:click|self={handleClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-title"
  >
    <div class="data-exporter-modal">
      <header class="modal-header">
        <h2 id="export-title">📦 Export Your Data</h2>
        <button 
          class="close-button" 
          on:click={handleClose}
          disabled={isExporting}
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      <div class="modal-content">
        {#if !isExporting}
          <!-- Format Selection -->
          <section class="export-section">
            <h3>Export Format</h3>
            <div class="format-grid">
              {#each formatOptions as format}
                <button
                  class="format-option"
                  class:selected={selectedFormat === format.value}
                  on:click={() => selectedFormat = format.value}
                >
                  <span class="format-icon">{format.icon}</span>
                  <span class="format-label">{format.label}</span>
                  <span class="format-description">{format.description}</span>
                </button>
              {/each}
            </div>
          </section>

          <!-- Category Selection -->
          <section class="export-section">
            <div class="section-header">
              <h3>Data Categories</h3>
              <div class="category-actions">
                <button class="text-button" on:click={selectAllCategories}>Select All</button>
                <button class="text-button" on:click={clearCategories}>Clear</button>
              </div>
            </div>
            <div class="category-grid">
              {#each categoryOptions as category}
                <button
                  class="category-option"
                  class:selected={selectedCategories.has(category.value)}
                  on:click={() => toggleCategory(category.value)}
                >
                  <span class="category-icon">{category.icon}</span>
                  <div class="category-info">
                    <span class="category-label">{category.label}</span>
                    <span class="category-description">{category.description}</span>
                  </div>
                  <span class="checkbox" class:checked={selectedCategories.has(category.value)}>
                    {selectedCategories.has(category.value) ? '✓' : ''}
                  </span>
                </button>
              {/each}
            </div>
          </section>

          <!-- Date Range -->
          <section class="export-section">
            <h3>Date Range (Optional)</h3>
            <div class="date-range">
              <div class="date-input">
                <label for="start-date">From</label>
                <input 
                  type="date" 
                  id="start-date" 
                  bind:value={startDate}
                />
              </div>
              <div class="date-input">
                <label for="end-date">To</label>
                <input 
                  type="date" 
                  id="end-date" 
                  bind:value={endDate}
                />
              </div>
            </div>
          </section>

          <!-- Options -->
          <section class="export-section">
            <h3>Options</h3>
            <div class="options-list">
              <label class="option-toggle">
                <input type="checkbox" bind:checked={includeAttachments} on:change={updateEstimatedSize} />
                <span class="toggle-label">
                  <span class="toggle-title">Include Attachments</span>
                  <span class="toggle-description">Export images, files, and media</span>
                </span>
              </label>
              <label class="option-toggle">
                <input type="checkbox" bind:checked={compressOutput} />
                <span class="toggle-label">
                  <span class="toggle-title">Compress Output</span>
                  <span class="toggle-description">Create a ZIP archive</span>
                </span>
              </label>
            </div>
          </section>

          <!-- Estimated Size -->
          <div class="estimated-size">
            <span class="size-label">Estimated Size:</span>
            <span class="size-value">{estimatedSize}</span>
          </div>

          {#if exportError}
            <div class="export-error" role="alert">
              ⚠️ {exportError}
            </div>
          {/if}
        {:else}
          <!-- Export Progress -->
          <section class="export-progress">
            <div class="overall-progress">
              <div class="progress-header">
                <span>Exporting...</span>
                <span>{overallProgress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {overallProgress}%"></div>
              </div>
            </div>

            <div class="category-progress-list">
              {#each Array.from(exportProgress.entries()) as [category, progress]}
                {@const categoryInfo = categoryOptions.find(c => c.value === category)}
                <div class="category-progress-item">
                  <span class="progress-icon">{categoryInfo?.icon || '📁'}</span>
                  <span class="progress-label">{categoryInfo?.label || category}</span>
                  <span class="progress-status" class:complete={progress.status === 'complete'} class:error={progress.status === 'error'}>
                    {#if progress.status === 'pending'}
                      ⏳ Pending
                    {:else if progress.status === 'processing'}
                      🔄 Processing...
                    {:else if progress.status === 'complete'}
                      ✅ Complete
                    {:else if progress.status === 'error'}
                      ❌ {progress.error || 'Error'}
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <footer class="modal-footer">
        {#if !isExporting}
          <button class="cancel-button" on:click={handleClose}>
            Cancel
          </button>
          <button 
            class="export-button" 
            on:click={startExport}
            disabled={selectedCategories.size === 0}
          >
            📦 Export Data
          </button>
        {:else}
          <button class="cancel-button" on:click={cancelExport}>
            Cancel Export
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .data-exporter-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .data-exporter-modal {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 16px;
    width: 90%;
    max-width: 640px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border-color, #333);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .close-button {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover:not(:disabled) {
    background: var(--bg-tertiary, #2a2a3e);
    color: var(--text-primary, #fff);
  }

  .close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-content {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .export-section {
    margin-bottom: 24px;
  }

  .export-section h3 {
    margin: 0 0 12px 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #aaa);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
  }

  .category-actions {
    display: flex;
    gap: 8px;
  }

  .text-button {
    background: none;
    border: none;
    color: var(--accent-color, #7c3aed);
    font-size: 0.8rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .text-button:hover {
    background: var(--bg-tertiary, #2a2a3e);
  }

  .format-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .format-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px;
    background: var(--bg-tertiary, #2a2a3e);
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .format-option:hover {
    background: var(--bg-hover, #333);
  }

  .format-option.selected {
    border-color: var(--accent-color, #7c3aed);
    background: var(--accent-bg, rgba(124, 58, 237, 0.1));
  }

  .format-icon {
    font-size: 1.5rem;
  }

  .format-label {
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .format-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .category-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-tertiary, #2a2a3e);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .category-option:hover {
    background: var(--bg-hover, #333);
  }

  .category-option.selected {
    border-color: var(--accent-color, #7c3aed);
    background: var(--accent-bg, rgba(124, 58, 237, 0.1));
  }

  .category-icon {
    font-size: 1.25rem;
  }

  .category-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .category-label {
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .category-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid var(--text-secondary, #666);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--accent-color, #7c3aed);
    transition: all 0.2s;
  }

  .checkbox.checked {
    background: var(--accent-color, #7c3aed);
    border-color: var(--accent-color, #7c3aed);
    color: white;
  }

  .date-range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .date-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .date-input label {
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
  }

  .date-input input {
    padding: 10px 12px;
    background: var(--bg-tertiary, #2a2a3e);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px;
    color: var(--text-primary, #fff);
    font-size: 0.9rem;
  }

  .date-input input:focus {
    outline: none;
    border-color: var(--accent-color, #7c3aed);
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .option-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .option-toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent-color, #7c3aed);
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
  }

  .toggle-title {
    color: var(--text-primary, #fff);
    font-weight: 500;
  }

  .toggle-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .estimated-size {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-tertiary, #2a2a3e);
    border-radius: 8px;
  }

  .size-label {
    color: var(--text-secondary, #888);
  }

  .size-value {
    font-weight: 600;
    color: var(--accent-color, #7c3aed);
  }

  .export-error {
    margin-top: 16px;
    padding: 12px 16px;
    background: var(--error-bg, rgba(239, 68, 68, 0.1));
    border: 1px solid var(--error-color, #ef4444);
    border-radius: 8px;
    color: var(--error-color, #ef4444);
    font-size: 0.9rem;
  }

  .export-progress {
    padding: 16px 0;
  }

  .overall-progress {
    margin-bottom: 24px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .progress-bar {
    height: 8px;
    background: var(--bg-tertiary, #2a2a3e);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color, #7c3aed);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .category-progress-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .category-progress-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-tertiary, #2a2a3e);
    border-radius: 8px;
  }

  .progress-icon {
    font-size: 1.25rem;
  }

  .progress-label {
    flex: 1;
    color: var(--text-primary, #fff);
    font-weight: 500;
  }

  .progress-status {
    font-size: 0.85rem;
    color: var(--text-secondary, #888);
  }

  .progress-status.complete {
    color: var(--success-color, #22c55e);
  }

  .progress-status.error {
    color: var(--error-color, #ef4444);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color, #333);
  }

  .cancel-button {
    padding: 10px 20px;
    background: var(--bg-tertiary, #2a2a3e);
    border: none;
    border-radius: 8px;
    color: var(--text-primary, #fff);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .cancel-button:hover {
    background: var(--bg-hover, #333);
  }

  .export-button {
    padding: 10px 24px;
    background: var(--accent-color, #7c3aed);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .export-button:hover:not(:disabled) {
    background: var(--accent-hover, #6d28d9);
    transform: translateY(-1px);
  }

  .export-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .format-grid {
      grid-template-columns: 1fr;
    }

    .date-range {
      grid-template-columns: 1fr;
    }
  }
</style>
