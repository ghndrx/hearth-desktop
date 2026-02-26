<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  
  interface RecentFile {
    id: string;
    path: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
    size: number;
    accessedAt: number;
    thumbnailUrl?: string;
    serverId?: string;
    channelId?: string;
  }

  interface RecentFilesConfig {
    maxFiles: number;
    retentionDays: number;
    showThumbnails: boolean;
    groupByServer: boolean;
    enableQuickAccess: boolean;
  }

  // Props
  export let maxFiles: number = 50;
  export let retentionDays: number = 30;
  export let showThumbnails: boolean = true;
  export let groupByServer: boolean = false;
  export let onFileSelect: ((file: RecentFile) => void) | null = null;
  export let onFileRemove: ((fileId: string) => void) | null = null;
  export let testMode: boolean = false;

  // Stores
  const recentFiles = writable<RecentFile[]>([]);
  const config = writable<RecentFilesConfig>({
    maxFiles,
    retentionDays,
    showThumbnails,
    groupByServer,
    enableQuickAccess: true
  });
  const searchQuery = writable('');
  const selectedType = writable<string>('all');
  const isLoading = writable(true);
  const error = writable<string | null>(null);

  // Derived stores
  const filteredFiles = derived(
    [recentFiles, searchQuery, selectedType],
    ([$files, $query, $type]) => {
      let result = $files;
      
      if ($query) {
        const lowerQuery = $query.toLowerCase();
        result = result.filter(f => 
          f.name.toLowerCase().includes(lowerQuery) ||
          f.path.toLowerCase().includes(lowerQuery)
        );
      }
      
      if ($type !== 'all') {
        result = result.filter(f => f.type === $type);
      }
      
      return result;
    }
  );

  const groupedFiles = derived(
    [filteredFiles, config],
    ([$files, $config]) => {
      if (!$config.groupByServer) {
        return { ungrouped: $files };
      }
      
      const groups: Record<string, RecentFile[]> = {};
      for (const file of $files) {
        const key = file.serverId || 'Direct Messages';
        if (!groups[key]) groups[key] = [];
        groups[key].push(file);
      }
      return groups;
    }
  );

  const fileStats = derived(recentFiles, ($files) => {
    const totalSize = $files.reduce((acc, f) => acc + f.size, 0);
    const byType: Record<string, number> = {};
    for (const file of $files) {
      byType[file.type] = (byType[file.type] || 0) + 1;
    }
    return { totalFiles: $files.length, totalSize, byType };
  });

  // File type detection
  function detectFileType(filename: string): RecentFile['type'] {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (docExts.includes(ext)) return 'document';
    if (archiveExts.includes(ext)) return 'archive';
    return 'other';
  }

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format relative time
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // Get type icon
  function getTypeIcon(type: RecentFile['type']): string {
    const icons: Record<string, string> = {
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      document: '📄',
      archive: '📦',
      other: '📎'
    };
    return icons[type] || '📎';
  }

  // Tauri API integration
  async function loadRecentFiles(): Promise<void> {
    if (testMode) {
      // Test data
      recentFiles.set([
        {
          id: '1',
          path: '/downloads/screenshot.png',
          name: 'screenshot.png',
          type: 'image',
          size: 245000,
          accessedAt: Date.now() - 3600000,
          serverId: 'server-1'
        },
        {
          id: '2',
          path: '/downloads/meeting-notes.pdf',
          name: 'meeting-notes.pdf',
          type: 'document',
          size: 1250000,
          accessedAt: Date.now() - 86400000
        },
        {
          id: '3',
          path: '/downloads/video-clip.mp4',
          name: 'video-clip.mp4',
          type: 'video',
          size: 52400000,
          accessedAt: Date.now() - 172800000,
          serverId: 'server-2'
        }
      ]);
      isLoading.set(false);
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<RecentFile[]>('get_recent_files', {
        limit: maxFiles
      });
      
      // Filter out expired files
      const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      const validFiles = files.filter(f => f.accessedAt > cutoff);
      
      recentFiles.set(validFiles);
      error.set(null);
    } catch (err) {
      console.error('Failed to load recent files:', err);
      error.set('Failed to load recent files');
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('hearth_recent_files');
        if (stored) {
          recentFiles.set(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage errors
      }
    } finally {
      isLoading.set(false);
    }
  }

  async function addRecentFile(file: Omit<RecentFile, 'id' | 'accessedAt' | 'type'>): Promise<void> {
    const newFile: RecentFile = {
      ...file,
      id: crypto.randomUUID(),
      type: detectFileType(file.name),
      accessedAt: Date.now()
    };

    recentFiles.update(files => {
      // Remove duplicate paths
      const filtered = files.filter(f => f.path !== file.path);
      // Add new file at the beginning
      const updated = [newFile, ...filtered].slice(0, maxFiles);
      
      // Persist to localStorage as backup
      try {
        localStorage.setItem('hearth_recent_files', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      
      return updated;
    });

    if (!testMode) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_recent_file', { file: newFile });
      } catch (err) {
        console.error('Failed to persist recent file:', err);
      }
    }
  }

  async function removeFile(fileId: string): Promise<void> {
    recentFiles.update(files => files.filter(f => f.id !== fileId));
    
    if (onFileRemove) {
      onFileRemove(fileId);
    }

    if (!testMode) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('remove_recent_file', { fileId });
      } catch (err) {
        console.error('Failed to remove recent file:', err);
      }
    }
  }

  async function clearAllFiles(): Promise<void> {
    recentFiles.set([]);
    localStorage.removeItem('hearth_recent_files');
    
    if (!testMode) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('clear_recent_files');
      } catch (err) {
        console.error('Failed to clear recent files:', err);
      }
    }
  }

  async function openFile(file: RecentFile): Promise<void> {
    if (onFileSelect) {
      onFileSelect(file);
      return;
    }

    // Update access time
    recentFiles.update(files => 
      files.map(f => f.id === file.id ? { ...f, accessedAt: Date.now() } : f)
    );

    if (!testMode) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_file', { path: file.path });
      } catch (err) {
        console.error('Failed to open file:', err);
        error.set(`Failed to open ${file.name}`);
      }
    }
  }

  async function showInFolder(file: RecentFile): Promise<void> {
    if (!testMode) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('show_in_folder', { path: file.path });
      } catch (err) {
        console.error('Failed to show in folder:', err);
      }
    }
  }

  // Export public methods
  export { addRecentFile, removeFile, clearAllFiles, openFile };

  // Lifecycle
  onMount(() => {
    loadRecentFiles();
  });

  // Watch config changes
  $: config.set({
    maxFiles,
    retentionDays,
    showThumbnails,
    groupByServer,
    enableQuickAccess: true
  });
</script>

<div class="recent-files-manager" data-testid="recent-files-manager">
  <header class="rfm-header">
    <h3>Recent Files</h3>
    <div class="rfm-actions">
      <input
        type="text"
        placeholder="Search files..."
        class="rfm-search"
        bind:value={$searchQuery}
        data-testid="search-input"
      />
      <select
        class="rfm-filter"
        bind:value={$selectedType}
        data-testid="type-filter"
      >
        <option value="all">All Types</option>
        <option value="image">Images</option>
        <option value="video">Videos</option>
        <option value="audio">Audio</option>
        <option value="document">Documents</option>
        <option value="archive">Archives</option>
        <option value="other">Other</option>
      </select>
      <button
        class="rfm-clear-btn"
        on:click={clearAllFiles}
        disabled={$recentFiles.length === 0}
        data-testid="clear-all-btn"
      >
        Clear All
      </button>
    </div>
  </header>

  {#if $error}
    <div class="rfm-error" data-testid="error-message">
      {$error}
    </div>
  {/if}

  <div class="rfm-stats" data-testid="file-stats">
    <span>{$fileStats.totalFiles} files</span>
    <span>•</span>
    <span>{formatSize($fileStats.totalSize)} total</span>
  </div>

  {#if $isLoading}
    <div class="rfm-loading" data-testid="loading-indicator">
      <div class="rfm-spinner"></div>
      <span>Loading recent files...</span>
    </div>
  {:else if $filteredFiles.length === 0}
    <div class="rfm-empty" data-testid="empty-state">
      {#if $searchQuery || $selectedType !== 'all'}
        <p>No files match your filters</p>
      {:else}
        <p>No recent files</p>
        <span>Files you open or download will appear here</span>
      {/if}
    </div>
  {:else}
    <div class="rfm-file-list" data-testid="file-list">
      {#each Object.entries($groupedFiles) as [group, files]}
        {#if groupByServer && group !== 'ungrouped'}
          <div class="rfm-group-header">{group}</div>
        {/if}
        {#each files as file (file.id)}
          <div
            class="rfm-file-item"
            data-testid={`file-item-${file.id}`}
            role="button"
            tabindex="0"
            on:click={() => openFile(file)}
            on:keydown={(e) => e.key === 'Enter' && openFile(file)}
          >
            {#if showThumbnails && file.thumbnailUrl && file.type === 'image'}
              <img
                src={file.thumbnailUrl}
                alt={file.name}
                class="rfm-thumbnail"
              />
            {:else}
              <span class="rfm-type-icon">{getTypeIcon(file.type)}</span>
            {/if}
            
            <div class="rfm-file-info">
              <span class="rfm-file-name" title={file.path}>{file.name}</span>
              <span class="rfm-file-meta">
                {formatSize(file.size)} • {formatRelativeTime(file.accessedAt)}
              </span>
            </div>
            
            <div class="rfm-file-actions">
              <button
                class="rfm-action-btn"
                title="Show in folder"
                on:click|stopPropagation={() => showInFolder(file)}
                data-testid={`show-folder-${file.id}`}
              >
                📁
              </button>
              <button
                class="rfm-action-btn rfm-remove-btn"
                title="Remove from recent"
                on:click|stopPropagation={() => removeFile(file.id)}
                data-testid={`remove-${file.id}`}
              >
                ✕
              </button>
            </div>
          </div>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .recent-files-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    overflow: hidden;
  }

  .rfm-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #3f4147);
  }

  .rfm-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }

  .rfm-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rfm-search {
    flex: 1;
    min-width: 150px;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #f2f3f5);
    font-size: 14px;
  }

  .rfm-search:focus {
    outline: 2px solid var(--accent-color, #5865f2);
    outline-offset: -2px;
  }

  .rfm-filter {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #f2f3f5);
    font-size: 14px;
    cursor: pointer;
  }

  .rfm-clear-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--danger-color, #ed4245);
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .rfm-clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rfm-clear-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .rfm-stats {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-muted, #949ba4);
  }

  .rfm-error {
    margin: 8px 16px;
    padding: 12px;
    border-radius: 4px;
    background: rgba(237, 66, 69, 0.1);
    color: var(--danger-color, #ed4245);
    font-size: 14px;
  }

  .rfm-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: var(--text-muted, #949ba4);
  }

  .rfm-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--bg-tertiary, #1e1f22);
    border-top-color: var(--accent-color, #5865f2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .rfm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px;
    text-align: center;
  }

  .rfm-empty p {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary, #f2f3f5);
  }

  .rfm-empty span {
    font-size: 14px;
    color: var(--text-muted, #949ba4);
  }

  .rfm-file-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .rfm-group-header {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #949ba4);
  }

  .rfm-file-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .rfm-file-item:hover {
    background: var(--bg-hover, #35373c);
  }

  .rfm-file-item:focus {
    outline: 2px solid var(--accent-color, #5865f2);
    outline-offset: -2px;
  }

  .rfm-thumbnail {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }

  .rfm-type-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 20px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 4px;
  }

  .rfm-file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rfm-file-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #f2f3f5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rfm-file-meta {
    font-size: 12px;
    color: var(--text-muted, #949ba4);
  }

  .rfm-file-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .rfm-file-item:hover .rfm-file-actions {
    opacity: 1;
  }

  .rfm-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted, #949ba4);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .rfm-action-btn:hover {
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #f2f3f5);
  }

  .rfm-remove-btn:hover {
    color: var(--danger-color, #ed4245);
  }
</style>
