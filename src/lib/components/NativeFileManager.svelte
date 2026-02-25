<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open, save } from '@tauri-apps/plugin-dialog';
  import { readFile, writeFile, exists, mkdir, readDir, remove } from '@tauri-apps/plugin-fs';
  import { join, appDataDir, downloadDir, documentDir } from '@tauri-apps/api/path';
  
  interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    modifiedAt?: Date;
    mimeType?: string;
  }
  
  interface UploadResult {
    localPath: string;
    fileName: string;
    mimeType: string;
    size: number;
    data?: Uint8Array;
  }
  
  const dispatch = createEventDispatcher<{
    fileSelected: UploadResult;
    filesSelected: UploadResult[];
    dirSelected: string;
    error: Error;
    saved: string;
  }>();
  
  export let multiple = false;
  export let acceptedTypes: string[] = [];
  export let showRecent = true;
  export let maxRecentFiles = 10;
  
  let recentFiles: FileEntry[] = [];
  let quickAccessPaths: { label: string; path: string }[] = [];
  let isLoading = false;
  let dragOver = false;
  
  onMount(async () => {
    await loadQuickAccessPaths();
    await loadRecentFiles();
  });
  
  async function loadQuickAccessPaths() {
    try {
      const downloads = await downloadDir();
      const documents = await documentDir();
      const appData = await appDataDir();
      
      quickAccessPaths = [
        { label: 'Downloads', path: downloads },
        { label: 'Documents', path: documents },
        { label: 'App Data', path: appData }
      ];
    } catch (error) {
      console.error('Failed to load quick access paths:', error);
    }
  }
  
  async function loadRecentFiles() {
    try {
      const appData = await appDataDir();
      const recentPath = await join(appData, 'recent-files.json');
      
      if (await exists(recentPath)) {
        const data = await readFile(recentPath);
        const json = new TextDecoder().decode(data);
        recentFiles = JSON.parse(json);
      }
    } catch (error) {
      console.error('Failed to load recent files:', error);
      recentFiles = [];
    }
  }
  
  async function saveRecentFile(file: FileEntry) {
    try {
      // Remove if already exists
      recentFiles = recentFiles.filter(f => f.path !== file.path);
      
      // Add to front
      recentFiles.unshift(file);
      
      // Limit size
      if (recentFiles.length > maxRecentFiles) {
        recentFiles = recentFiles.slice(0, maxRecentFiles);
      }
      
      // Save to disk
      const appData = await appDataDir();
      await mkdir(appData, { recursive: true });
      const recentPath = await join(appData, 'recent-files.json');
      await writeFile(recentPath, new TextEncoder().encode(JSON.stringify(recentFiles)));
    } catch (error) {
      console.error('Failed to save recent files:', error);
    }
  }
  
  function getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'json': 'application/json',
      'zip': 'application/zip',
      'tar': 'application/x-tar',
      'gz': 'application/gzip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  function buildFilters(): Array<{ name: string; extensions: string[] }> {
    if (acceptedTypes.length === 0) {
      return [{ name: 'All Files', extensions: ['*'] }];
    }
    
    const filters: Array<{ name: string; extensions: string[] }> = [];
    
    if (acceptedTypes.some(t => t.startsWith('image/'))) {
      filters.push({ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] });
    }
    if (acceptedTypes.some(t => t.startsWith('video/'))) {
      filters.push({ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi'] });
    }
    if (acceptedTypes.some(t => t.startsWith('audio/'))) {
      filters.push({ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] });
    }
    if (acceptedTypes.includes('application/pdf')) {
      filters.push({ name: 'PDF', extensions: ['pdf'] });
    }
    
    filters.push({ name: 'All Files', extensions: ['*'] });
    return filters;
  }
  
  export async function openFilePicker(): Promise<UploadResult | UploadResult[] | null> {
    isLoading = true;
    
    try {
      const result = await open({
        multiple,
        filters: buildFilters()
      });
      
      if (!result) return null;
      
      const paths = Array.isArray(result) ? result : [result];
      const uploadResults: UploadResult[] = [];
      
      for (const filePath of paths) {
        const data = await readFile(filePath);
        const fileName = filePath.split(/[/\\]/).pop() || 'file';
        const mimeType = getMimeType(fileName);
        
        const uploadResult: UploadResult = {
          localPath: filePath,
          fileName,
          mimeType,
          size: data.length,
          data
        };
        
        uploadResults.push(uploadResult);
        
        await saveRecentFile({
          name: fileName,
          path: filePath,
          isDirectory: false,
          size: data.length,
          mimeType
        });
      }
      
      if (multiple) {
        dispatch('filesSelected', uploadResults);
        return uploadResults;
      } else {
        dispatch('fileSelected', uploadResults[0]);
        return uploadResults[0];
      }
    } catch (error) {
      dispatch('error', error as Error);
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  export async function openDirectoryPicker(): Promise<string | null> {
    isLoading = true;
    
    try {
      const result = await open({
        directory: true,
        multiple: false
      });
      
      if (result && typeof result === 'string') {
        dispatch('dirSelected', result);
        return result;
      }
      return null;
    } catch (error) {
      dispatch('error', error as Error);
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  export async function saveFileTo(data: Uint8Array, defaultName: string): Promise<string | null> {
    isLoading = true;
    
    try {
      const result = await save({
        defaultPath: defaultName,
        filters: buildFilters()
      });
      
      if (result) {
        await writeFile(result, data);
        dispatch('saved', result);
        return result;
      }
      return null;
    } catch (error) {
      dispatch('error', error as Error);
      return null;
    } finally {
      isLoading = false;
    }
  }
  
  export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await readDir(dirPath);
      return entries.map(entry => ({
        name: entry.name,
        path: dirPath + '/' + entry.name,
        isDirectory: entry.isDirectory
      }));
    } catch (error) {
      console.error('Failed to list directory:', error);
      return [];
    }
  }
  
  async function selectRecentFile(file: FileEntry) {
    isLoading = true;
    
    try {
      if (await exists(file.path)) {
        const data = await readFile(file.path);
        const uploadResult: UploadResult = {
          localPath: file.path,
          fileName: file.name,
          mimeType: file.mimeType || getMimeType(file.name),
          size: data.length,
          data
        };
        
        dispatch('fileSelected', uploadResult);
        
        // Move to front of recent
        await saveRecentFile(file);
      } else {
        // Remove stale entry
        recentFiles = recentFiles.filter(f => f.path !== file.path);
        throw new Error('File no longer exists');
      }
    } catch (error) {
      dispatch('error', error as Error);
    } finally {
      isLoading = false;
    }
  }
  
  async function clearRecentFile(file: FileEntry, event: MouseEvent) {
    event.stopPropagation();
    recentFiles = recentFiles.filter(f => f.path !== file.path);
    
    try {
      const appData = await appDataDir();
      const recentPath = await join(appData, 'recent-files.json');
      await writeFile(recentPath, new TextEncoder().encode(JSON.stringify(recentFiles)));
    } catch (error) {
      console.error('Failed to update recent files:', error);
    }
  }
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }
  
  function handleDragLeave() {
    dragOver = false;
  }
  
  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    // Note: In Tauri, dropped files come as paths
    // This is a simplified handler - real implementation would use Tauri's drag-drop API
  }
  
  function formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  function getFileIcon(mimeType?: string): string {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('zip') || mimeType.includes('tar')) return '📦';
    return '📄';
  }
</script>

<div 
  class="native-file-manager"
  class:drag-over={dragOver}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="region"
  aria-label="File manager"
>
  <div class="actions">
    <button 
      class="action-btn primary"
      on:click={openFilePicker}
      disabled={isLoading}
    >
      {#if isLoading}
        <span class="spinner"></span>
      {:else}
        📁 {multiple ? 'Select Files' : 'Select File'}
      {/if}
    </button>
    
    <button 
      class="action-btn"
      on:click={openDirectoryPicker}
      disabled={isLoading}
    >
      📂 Select Folder
    </button>
  </div>
  
  {#if quickAccessPaths.length > 0}
    <div class="quick-access">
      <h4>Quick Access</h4>
      <div class="path-list">
        {#each quickAccessPaths as qPath}
          <button 
            class="path-item"
            on:click={() => dispatch('dirSelected', qPath.path)}
            title={qPath.path}
          >
            📁 {qPath.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  {#if showRecent && recentFiles.length > 0}
    <div class="recent-files">
      <h4>Recent Files</h4>
      <div class="file-list">
        {#each recentFiles as file}
          <button 
            class="file-item"
            on:click={() => selectRecentFile(file)}
            title={file.path}
          >
            <span class="file-icon">{getFileIcon(file.mimeType)}</span>
            <span class="file-name">{file.name}</span>
            {#if file.size}
              <span class="file-size">{formatSize(file.size)}</span>
            {/if}
            <button 
              class="remove-btn"
              on:click={(e) => clearRecentFile(file, e)}
              title="Remove from recent"
            >
              ×
            </button>
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  <div class="drop-zone">
    <span class="drop-icon">📥</span>
    <span class="drop-text">Drop files here</span>
  </div>
</div>

<style>
  .native-file-manager {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    border: 2px dashed transparent;
    transition: border-color 0.2s, background 0.2s;
  }
  
  .native-file-manager.drag-over {
    border-color: var(--accent, #5865f2);
    background: var(--bg-tertiary, #202225);
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover, #36393f);
  }
  
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-btn.primary {
    background: var(--accent, #5865f2);
    color: white;
  }
  
  .action-btn.primary:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .quick-access, .recent-files {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  h4 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
  }
  
  .path-list, .file-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .path-item, .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .path-item:hover, .file-item:hover {
    background: var(--bg-tertiary, #202225);
  }
  
  .file-icon {
    flex-shrink: 0;
  }
  
  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .file-size {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }
  
  .remove-btn {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--text-muted, #72767d);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
  }
  
  .file-item:hover .remove-btn {
    opacity: 1;
  }
  
  .remove-btn:hover {
    background: var(--danger, #ed4245);
    color: white;
  }
  
  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    border: 2px dashed var(--border-muted, #4f545c);
    border-radius: 8px;
    color: var(--text-muted, #72767d);
    transition: border-color 0.2s, color 0.2s;
  }
  
  .drag-over .drop-zone {
    border-color: var(--accent, #5865f2);
    color: var(--accent, #5865f2);
  }
  
  .drop-icon {
    font-size: 2rem;
  }
  
  .drop-text {
    font-size: 0.875rem;
  }
</style>
