<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { onMount, onDestroy } from 'svelte';

  interface FileAssociation {
    extension: string;
    mime_type: string;
    description: string;
    registered: boolean;
  }

  interface AssociatedFile {
    path: string;
    name: string;
    extension: string | null;
    mime_type: string | null;
    size: number;
  }

  let associations: FileAssociation[] = [];
  let recentFiles: AssociatedFile[] = [];
  let loading = true;
  let error: string | null = null;
  
  const MAX_RECENT_FILES = 5;
  let unsubscribe: (() => void) | null = null;

  const iconMap: Record<string, string> = {
    hearth: '💬',
    hearthkey: '🔑',
    hearthbackup: '📦',
  };

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function loadAssociations() {
    try {
      loading = true;
      error = null;
      associations = await invoke<FileAssociation[]>('get_supported_file_associations');
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function handleFileOpen(file: AssociatedFile) {
    // Add to recent files (avoid duplicates)
    recentFiles = [
      file,
      ...recentFiles.filter(f => f.path !== file.path)
    ].slice(0, MAX_RECENT_FILES);
  }

  async function openRecentFile(file: AssociatedFile) {
    try {
      await invoke('handle_associated_file', { path: file.path });
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  function clearRecentFiles() {
    recentFiles = [];
  }

  onMount(async () => {
    await loadAssociations();
    
    // Listen for file association events
    const unlisten = await listen<AssociatedFile>('file-association-open', (event) => {
      handleFileOpen(event.payload);
    });
    unsubscribe = unlisten;
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<div class="file-association-settings">
  <div class="section">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      File Associations
    </h3>
    <p class="description">
      Hearth can open certain file types directly from your file manager.
    </p>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading file associations...</span>
    </div>
  {:else if error}
    <div class="error">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{error}</span>
      <button on:click={loadAssociations}>Retry</button>
    </div>
  {:else}
    <div class="associations-list">
      {#each associations as assoc}
        <div class="association-item">
          <div class="file-icon">
            {iconMap[assoc.extension] || '📄'}
          </div>
          <div class="file-info">
            <div class="file-ext">.{assoc.extension}</div>
            <div class="file-desc">{assoc.description}</div>
            <div class="file-mime">{assoc.mime_type}</div>
          </div>
          <div class="status" class:registered={assoc.registered}>
            {#if assoc.registered}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Registered
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              Not Registered
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if recentFiles.length > 0}
    <div class="section recent-section">
      <div class="section-header">
        <h4>Recently Opened Files</h4>
        <button class="clear-btn" on:click={clearRecentFiles}>
          Clear
        </button>
      </div>
      <div class="recent-files">
        {#each recentFiles as file}
          <button class="recent-file" on:click={() => openRecentFile(file)}>
            <span class="recent-icon">
              {iconMap[file.extension ?? ''] || '📄'}
            </span>
            <div class="recent-info">
              <span class="recent-name">{file.name}</span>
              <span class="recent-size">{formatFileSize(file.size)}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="section info-section">
    <h4>How File Associations Work</h4>
    <ul>
      <li>
        <strong>.hearth</strong> - Double-click to import chat exports
      </li>
      <li>
        <strong>.hearthkey</strong> - Encryption keys for secure chats
      </li>
      <li>
        <strong>.hearthbackup</strong> - Full chat backups with media
      </li>
    </ul>
    <p class="note">
      File associations are configured during installation. If files don't open 
      automatically, try reinstalling Hearth or setting it as the default app 
      in your system settings.
    </p>
  </div>
</div>

<style>
  .file-association-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
    max-width: 600px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .description {
    margin: 0;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    color: var(--text-secondary, #b5bac1);
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color, #3f4147);
    border-top-color: var(--accent-color, #5865f2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
    border: 1px solid var(--error-color, #ed4245);
    border-radius: 8px;
    color: var(--error-color, #ed4245);
    font-size: 0.875rem;
  }

  .error button {
    margin-left: auto;
    padding: 0.25rem 0.75rem;
    background: var(--error-color, #ed4245);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .associations-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .association-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    border: 1px solid var(--border-color, #3f4147);
  }

  .file-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .file-ext {
    font-weight: 600;
    color: var(--text-primary, #fff);
    font-family: monospace;
    font-size: 1rem;
  }

  .file-desc {
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
  }

  .file-mime {
    color: var(--text-muted, #6d6f78);
    font-size: 0.75rem;
    font-family: monospace;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-muted, #6d6f78);
  }

  .status.registered {
    background: var(--success-bg, rgba(35, 165, 90, 0.1));
    color: var(--success-color, #23a55a);
  }

  .recent-section {
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #3f4147);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .clear-btn {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 4px;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-btn:hover {
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #fff);
  }

  .recent-files {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .recent-file {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--bg-secondary, #2b2d31);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .recent-file:hover {
    background: var(--bg-tertiary, #1e1f22);
    border-color: var(--accent-color, #5865f2);
  }

  .recent-icon {
    font-size: 1.25rem;
  }

  .recent-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    flex: 1;
  }

  .recent-name {
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recent-size {
    color: var(--text-muted, #6d6f78);
    font-size: 0.75rem;
  }

  .info-section {
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #3f4147);
  }

  .info-section ul {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
  }

  .info-section li {
    margin-bottom: 0.5rem;
  }

  .info-section li strong {
    color: var(--text-primary, #fff);
    font-family: monospace;
  }

  .note {
    margin: 0;
    padding: 0.75rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 6px;
    color: var(--text-muted, #6d6f78);
    font-size: 0.8rem;
    line-height: 1.5;
  }
</style>
