<script lang="ts">
  import { onMount } from 'svelte';
  import {
    indexedFiles,
    fileIndexStats,
    fileSearchResults,
    searchFiles,
    getRecentFiles,
    removeFromIndex,
    getFilesByType,
    getFileIndexStats,
    type IndexedFile,
    type FileIndexStats
  } from '$lib/stores/fileIndexer';

  let {
    compact = false
  }: {
    compact?: boolean;
  } = $props();

  type FileCategory = 'all' | 'documents' | 'images' | 'audio' | 'video' | 'archives';

  const CATEGORY_EXTENSIONS: Record<FileCategory, string[]> = {
    all: [],
    documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'md'],
    images: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a'],
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'flv'],
    archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  };

  const TYPE_ICONS: Record<string, string> = {
    documents: '\u{1F4C4}',
    images: '\u{1F5BC}',
    audio: '\u{1F3B5}',
    video: '\u{1F3AC}',
    archives: '\u{1F4E6}',
    unknown: '\u{1F4CE}',
  };

  const CATEGORY_LABELS: Record<FileCategory, string> = {
    all: 'All',
    documents: 'Documents',
    images: 'Images',
    audio: 'Audio',
    video: 'Video',
    archives: 'Archives',
  };

  let searchQuery = $state('');
  let activeCategory = $state<FileCategory>('all');
  let expandedFileId = $state<string | null>(null);
  let files = $state<IndexedFile[]>([]);
  let stats = $state<FileIndexStats | null>(null);
  let loading = $state(false);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function getFileCategory(fileType: string): string {
    const ext = fileType.toLowerCase().replace('.', '');
    for (const [category, extensions] of Object.entries(CATEGORY_EXTENSIONS)) {
      if (category === 'all') continue;
      if (extensions.includes(ext)) return category;
    }
    return 'unknown';
  }

  function getFileIcon(fileType: string): string {
    const category = getFileCategory(fileType);
    return TYPE_ICONS[category] || TYPE_ICONS.unknown;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  onMount(async () => {
    await loadFiles();
    await loadStats();
  });

  async function loadFiles() {
    loading = true;
    try {
      await getRecentFiles();
      files = $indexedFiles;
    } catch (e) {
      console.error('Failed to load indexed files:', e);
      files = [];
    }
    loading = false;
  }

  async function loadStats() {
    try {
      stats = await getFileIndexStats();
    } catch (e) {
      console.error('Failed to load file index stats:', e);
    }
  }

  async function handleSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (searchQuery.trim()) {
        loading = true;
        try {
          await searchFiles(searchQuery.trim());
          files = $fileSearchResults;
        } catch (e) {
          console.error('Search failed:', e);
        }
        loading = false;
      } else {
        await loadFiles();
      }
    }, 300);
  }

  async function handleCategoryChange(category: FileCategory) {
    activeCategory = category;
    loading = true;
    try {
      if (category === 'all') {
        await getRecentFiles();
        files = $indexedFiles;
      } else {
        const results = await getFilesByType(category);
        files = results;
      }
    } catch (e) {
      console.error('Failed to filter files:', e);
    }
    loading = false;
  }

  function toggleExpand(id: string) {
    expandedFileId = expandedFileId === id ? null : id;
  }

  async function handleRemove(id: string) {
    try {
      await removeFromIndex(id);
      files = files.filter(f => f.id !== id);
      if (expandedFileId === id) expandedFileId = null;
      await loadStats();
    } catch (e) {
      console.error('Failed to remove file:', e);
    }
  }

  async function handleCopyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
    } catch (e) {
      console.error('Failed to copy path:', e);
    }
  }

  let filteredFiles = $derived(
    activeCategory === 'all'
      ? files
      : files.filter(f => getFileCategory(f.file_type) === activeCategory)
  );
</script>

<div class="file-index-panel" class:compact>
  <div class="panel-header">
    <div class="panel-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <span>File Index</span>
      {#if stats}
        <span class="file-count">{stats.total_files} files</span>
      {/if}
    </div>
  </div>

  <div class="search-bar">
    <div class="search-input-wrapper">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        bind:value={searchQuery}
        oninput={handleSearch}
        placeholder="Search indexed files..."
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-btn" onclick={() => { searchQuery = ''; loadFiles(); }}>&times;</button>
      {/if}
    </div>
  </div>

  <div class="filter-tabs">
    {#each Object.entries(CATEGORY_LABELS) as [key, label]}
      <button
        class="filter-tab"
        class:active={activeCategory === key}
        onclick={() => handleCategoryChange(key as FileCategory)}
      >{label}</button>
    {/each}
  </div>

  <div class="file-list">
    {#if loading}
      <div class="loading-state">Loading...</div>
    {:else if filteredFiles.length === 0}
      <div class="empty-state">
        <span class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span class="empty-text">No files found</span>
      </div>
    {:else}
      {#each filteredFiles as file (file.id)}
        <div class="file-item" class:expanded={expandedFileId === file.id}>
          <button class="file-row" onclick={() => toggleExpand(file.id)}>
            <span class="file-icon">{getFileIcon(file.file_type)}</span>
            <div class="file-info">
              <span class="file-name">{file.file_name}</span>
              <div class="file-meta">
                <span class="file-type">{file.file_type.toUpperCase()}</span>
                <span class="meta-sep">&middot;</span>
                <span class="file-uploader">{file.uploader_name}</span>
                <span class="meta-sep">&middot;</span>
                <span class="file-size">{formatFileSize(file.file_size)}</span>
                <span class="meta-sep">&middot;</span>
                <span class="file-date">{formatDate(file.indexed_at)}</span>
              </div>
            </div>
            <span class="expand-arrow">{expandedFileId === file.id ? '\u25B2' : '\u25BC'}</span>
          </button>

          {#if expandedFileId === file.id}
            <div class="file-details">
              {#if file.content_preview}
                <div class="detail-section">
                  <span class="detail-label">Preview</span>
                  <span class="detail-value preview-text">{file.content_preview}</span>
                </div>
              {/if}
              <div class="detail-section">
                <span class="detail-label">Channel</span>
                <span class="detail-value">{file.channel_id}</span>
              </div>
              <div class="detail-section">
                <span class="detail-label">Path</span>
                <span class="detail-value path-text">{file.file_path}</span>
              </div>
              {#if file.tags.length > 0}
                <div class="detail-section">
                  <span class="detail-label">Tags</span>
                  <div class="tags-list">
                    {#each file.tags as tag}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              <div class="detail-actions">
                <button class="action-btn copy-btn" onclick={() => handleCopyPath(file.file_path)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Path
                </button>
                <button class="action-btn remove-btn" onclick={() => handleRemove(file.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Remove
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if stats}
    <div class="stats-bar">
      <span class="stat-item">{stats.total_files} files</span>
      <span class="stat-sep">&middot;</span>
      <span class="stat-item">{formatFileSize(stats.total_size)} total</span>
      {#each stats.type_counts as tc}
        <span class="stat-sep">&middot;</span>
        <span class="stat-item">{tc.count} {tc.file_type}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-index-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #2b2d31;
    border-radius: 8px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #1e1f22;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: #f2f3f5;
  }

  .file-count {
    font-size: 12px;
    color: #b5bac1;
    font-weight: 400;
  }

  .search-bar {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1f22;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    background: #1e1f22;
    border-radius: 6px;
    padding: 0 10px;
    gap: 8px;
  }

  .search-icon {
    color: #b5bac1;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 8px 0;
    font-size: 13px;
    background: transparent;
    border: none;
    color: #f2f3f5;
    outline: none;
    font-family: inherit;
  }

  .search-input::placeholder {
    color: #6d6f78;
  }

  .clear-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #b5bac1;
    cursor: pointer;
    font-size: 16px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .clear-btn:hover {
    color: #f2f3f5;
    background: #383a40;
  }

  .filter-tabs {
    display: flex;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid #1e1f22;
    overflow-x: auto;
  }

  .filter-tab {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    color: #b5bac1;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .filter-tab:hover {
    background: #383a40;
    color: #f2f3f5;
  }

  .filter-tab.active {
    background: #5865f2;
    color: #fff;
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: #b5bac1;
    font-size: 13px;
    gap: 8px;
  }

  .empty-icon {
    color: #6d6f78;
  }

  .empty-text {
    color: #6d6f78;
  }

  .file-item {
    background: #313338;
    border-radius: 6px;
    border: 1px solid #1e1f22;
    overflow: hidden;
    transition: background 0.15s;
  }

  .file-item:hover {
    background: #383a40;
  }

  .file-item.expanded {
    background: #313338;
    border-color: #5865f2;
  }

  .file-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    width: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-family: inherit;
  }

  .file-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    font-size: 11px;
    color: #b5bac1;
    flex-wrap: wrap;
  }

  .file-type {
    font-weight: 600;
    font-size: 10px;
    background: #1e1f22;
    padding: 1px 5px;
    border-radius: 3px;
    color: #b5bac1;
  }

  .meta-sep {
    color: #6d6f78;
  }

  .file-uploader,
  .file-size,
  .file-date {
    color: #b5bac1;
  }

  .expand-arrow {
    font-size: 10px;
    color: #6d6f78;
    flex-shrink: 0;
  }

  .file-details {
    padding: 0 10px 10px;
    border-top: 1px solid #1e1f22;
    margin-top: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-label {
    font-size: 10px;
    font-weight: 600;
    color: #6d6f78;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-value {
    font-size: 12px;
    color: #b5bac1;
    word-break: break-all;
  }

  .preview-text {
    background: #1e1f22;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 1.4;
    max-height: 80px;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  .path-text {
    font-family: monospace;
    font-size: 11px;
    background: #1e1f22;
    padding: 4px 6px;
    border-radius: 3px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    font-size: 10px;
    background: #1e1f22;
    color: #b5bac1;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .detail-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .copy-btn {
    background: #5865f2;
    color: #fff;
  }

  .copy-btn:hover {
    background: #4752c4;
  }

  .remove-btn {
    background: transparent;
    color: #b5bac1;
    border: 1px solid #1e1f22;
  }

  .remove-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .stats-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid #1e1f22;
    font-size: 11px;
    color: #b5bac1;
    background: #2b2d31;
    flex-wrap: wrap;
  }

  .stat-sep {
    color: #6d6f78;
  }

  .stat-item {
    white-space: nowrap;
  }

  .compact .file-row {
    padding: 6px 8px;
  }

  .compact .file-name {
    font-size: 12px;
  }

  .compact .file-meta {
    font-size: 10px;
  }

  .compact .file-icon {
    font-size: 14px;
    width: 20px;
  }

  .compact .filter-tab {
    padding: 3px 8px;
    font-size: 11px;
  }
</style>
