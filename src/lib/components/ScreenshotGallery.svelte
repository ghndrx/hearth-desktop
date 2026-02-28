<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { join, appDataDir } from '@tauri-apps/api/path';
  import { readDir, readFile, writeFile, remove, mkdir, exists } from '@tauri-apps/plugin-fs';
  import { open, save } from '@tauri-apps/plugin-dialog';
  
  interface ScreenshotEntry {
    id: string;
    filename: string;
    path: string;
    thumbnail: string;
    width: number;
    height: number;
    size: number;
    capturedAt: Date;
    type: 'fullscreen' | 'window' | 'selection';
    tags: string[];
    favorite: boolean;
  }
  
  interface GalleryMetadata {
    version: number;
    entries: Array<Omit<ScreenshotEntry, 'thumbnail'>>;
  }
  
  const dispatch = createEventDispatcher<{
    select: ScreenshotEntry;
    delete: string;
    export: string;
    error: Error;
  }>();
  
  export let maxEntries = 100;
  export let thumbnailSize = 200;
  export let showFavoritesFirst = true;
  
  let entries: ScreenshotEntry[] = [];
  let filteredEntries: ScreenshotEntry[] = [];
  let selectedEntry: ScreenshotEntry | null = null;
  let searchQuery = '';
  let filterType: 'all' | 'fullscreen' | 'window' | 'selection' | 'favorites' = 'all';
  let sortBy: 'date' | 'size' | 'name' = 'date';
  let sortDesc = true;
  let isLoading = true;
  let galleryPath = '';
  let metadataPath = '';
  let showDeleteConfirm = false;
  let deleteTarget: ScreenshotEntry | null = null;
  let viewMode: 'grid' | 'list' = 'grid';
  let previewModal: ScreenshotEntry | null = null;
  let tagInput = '';
  let editingTags: ScreenshotEntry | null = null;
  
  onMount(async () => {
    await initializeGallery();
    await loadEntries();
  });
  
  async function initializeGallery() {
    try {
      const dataDir = await appDataDir();
      galleryPath = await join(dataDir, 'screenshots');
      metadataPath = await join(galleryPath, 'metadata.json');
      
      if (!(await exists(galleryPath))) {
        await mkdir(galleryPath, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to initialize gallery:', error);
      dispatch('error', error as Error);
    }
  }
  
  async function loadEntries() {
    isLoading = true;
    
    try {
      let metadata: GalleryMetadata = { version: 1, entries: [] };
      
      if (await exists(metadataPath)) {
        const data = await readFile(metadataPath);
        metadata = JSON.parse(new TextDecoder().decode(data));
      }
      
      // Load entries and generate thumbnails
      entries = await Promise.all(
        metadata.entries.map(async (entry) => {
          const thumbnail = await generateThumbnail(entry.path);
          return {
            ...entry,
            capturedAt: new Date(entry.capturedAt),
            thumbnail
          };
        })
      );
      
      applyFiltersAndSort();
    } catch (error) {
      console.error('Failed to load entries:', error);
      dispatch('error', error as Error);
    } finally {
      isLoading = false;
    }
  }
  
  async function generateThumbnail(imagePath: string): Promise<string> {
    try {
      const data = await readFile(imagePath);
      const blob = new Blob([data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      
      // Create thumbnail using canvas
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const scale = Math.min(thumbnailSize / img.width, thumbnailSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve('');
        };
        img.src = url;
      });
    } catch {
      return '';
    }
  }
  
  async function saveMetadata() {
    try {
      const metadata: GalleryMetadata = {
        version: 1,
        entries: entries.map(({ thumbnail, ...entry }) => ({
          ...entry,
          capturedAt: entry.capturedAt
        }))
      };
      
      await writeFile(
        metadataPath,
        new TextEncoder().encode(JSON.stringify(metadata, null, 2))
      );
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }
  
  export async function addScreenshot(
    data: Uint8Array,
    width: number,
    height: number,
    type: 'fullscreen' | 'window' | 'selection'
  ): Promise<ScreenshotEntry | null> {
    try {
      const id = `ss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filename = `${id}.png`;
      const path = await join(galleryPath, filename);
      
      await writeFile(path, data);
      
      const thumbnail = await generateThumbnail(path);
      
      const entry: ScreenshotEntry = {
        id,
        filename,
        path,
        thumbnail,
        width,
        height,
        size: data.length,
        capturedAt: new Date(),
        type,
        tags: [],
        favorite: false
      };
      
      entries = [entry, ...entries];
      
      // Prune old entries if over limit
      if (entries.length > maxEntries) {
        const removed = entries.splice(maxEntries);
        for (const entry of removed) {
          await remove(entry.path);
        }
      }
      
      await saveMetadata();
      applyFiltersAndSort();
      
      return entry;
    } catch (error) {
      console.error('Failed to add screenshot:', error);
      dispatch('error', error as Error);
      return null;
    }
  }
  
  function applyFiltersAndSort() {
    let result = [...entries];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(entry => 
        entry.filename.toLowerCase().includes(query) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply type filter
    if (filterType === 'favorites') {
      result = result.filter(entry => entry.favorite);
    } else if (filterType !== 'all') {
      result = result.filter(entry => entry.type === filterType);
    }
    
    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.capturedAt.getTime() - b.capturedAt.getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
      }
      
      return sortDesc ? -comparison : comparison;
    });
    
    // Move favorites to top if enabled
    if (showFavoritesFirst && filterType !== 'favorites') {
      const favorites = result.filter(e => e.favorite);
      const nonFavorites = result.filter(e => !e.favorite);
      result = [...favorites, ...nonFavorites];
    }
    
    filteredEntries = result;
  }
  
  $: {
    searchQuery;
    filterType;
    sortBy;
    sortDesc;
    applyFiltersAndSort();
  }
  
  function selectEntry(entry: ScreenshotEntry) {
    selectedEntry = entry;
    dispatch('select', entry);
  }
  
  function openPreview(entry: ScreenshotEntry) {
    previewModal = entry;
  }
  
  function closePreview() {
    previewModal = null;
  }
  
  async function toggleFavorite(entry: ScreenshotEntry) {
    entry.favorite = !entry.favorite;
    entries = entries;
    await saveMetadata();
    applyFiltersAndSort();
  }
  
  function confirmDelete(entry: ScreenshotEntry) {
    deleteTarget = entry;
    showDeleteConfirm = true;
  }
  
  async function deleteEntry() {
    if (!deleteTarget) return;
    
    try {
      await remove(deleteTarget.path);
      entries = entries.filter(e => e.id !== deleteTarget!.id);
      await saveMetadata();
      applyFiltersAndSort();
      
      dispatch('delete', deleteTarget.id);
      
      if (selectedEntry?.id === deleteTarget.id) {
        selectedEntry = null;
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
      dispatch('error', error as Error);
    } finally {
      showDeleteConfirm = false;
      deleteTarget = null;
    }
  }
  
  async function exportEntry(entry: ScreenshotEntry) {
    try {
      const data = await readFile(entry.path);
      
      const savePath = await save({
        defaultPath: entry.filename,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });
      
      if (savePath) {
        await writeFile(savePath, data);
        dispatch('export', savePath);
      }
    } catch (error) {
      console.error('Failed to export entry:', error);
      dispatch('error', error as Error);
    }
  }
  
  async function copyToClipboard(entry: ScreenshotEntry) {
    try {
      const data = await readFile(entry.path);
      await invoke('copy_image_to_clipboard', { imageData: Array.from(data) });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      dispatch('error', error as Error);
    }
  }
  
  function startEditingTags(entry: ScreenshotEntry) {
    editingTags = entry;
    tagInput = '';
  }
  
  async function addTag() {
    if (!editingTags || !tagInput.trim()) return;
    
    const tag = tagInput.trim().toLowerCase();
    if (!editingTags.tags.includes(tag)) {
      editingTags.tags = [...editingTags.tags, tag];
      entries = entries;
      await saveMetadata();
      applyFiltersAndSort();
    }
    tagInput = '';
  }
  
  async function removeTag(entry: ScreenshotEntry, tag: string) {
    entry.tags = entry.tags.filter(t => t !== tag);
    entries = entries;
    await saveMetadata();
    applyFiltersAndSort();
  }
  
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    }
    
    return date.toLocaleDateString();
  }
  
  function getTypeIcon(type: string): string {
    switch (type) {
      case 'fullscreen': return '🖥️';
      case 'window': return '🪟';
      case 'selection': return '✂️';
      default: return '📷';
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (previewModal) {
      if (event.key === 'Escape') {
        closePreview();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        navigatePreview(event.key === 'ArrowRight' ? 1 : -1);
      }
    }
  }
  
  function navigatePreview(direction: number) {
    if (!previewModal) return;
    
    const currentIndex = filteredEntries.findIndex(e => e.id === previewModal!.id);
    const newIndex = currentIndex + direction;
    
    if (newIndex >= 0 && newIndex < filteredEntries.length) {
      previewModal = filteredEntries[newIndex];
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="screenshot-gallery">
  <div class="gallery-header">
    <h2>📸 Screenshot Gallery</h2>
    <span class="entry-count">{filteredEntries.length} of {entries.length}</span>
  </div>
  
  <div class="gallery-controls">
    <div class="search-box">
      <input
        type="text"
        placeholder="Search screenshots..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-search" on:click={() => searchQuery = ''}>✕</button>
      {/if}
    </div>
    
    <div class="filter-group">
      <select bind:value={filterType} class="filter-select">
        <option value="all">All Types</option>
        <option value="fullscreen">🖥️ Fullscreen</option>
        <option value="window">🪟 Window</option>
        <option value="selection">✂️ Selection</option>
        <option value="favorites">⭐ Favorites</option>
      </select>
      
      <select bind:value={sortBy} class="filter-select">
        <option value="date">Sort by Date</option>
        <option value="size">Sort by Size</option>
        <option value="name">Sort by Name</option>
      </select>
      
      <button 
        class="sort-direction"
        on:click={() => sortDesc = !sortDesc}
        title={sortDesc ? 'Descending' : 'Ascending'}
      >
        {sortDesc ? '↓' : '↑'}
      </button>
    </div>
    
    <div class="view-toggle">
      <button 
        class="view-btn"
        class:active={viewMode === 'grid'}
        on:click={() => viewMode = 'grid'}
        title="Grid view"
      >
        ⊞
      </button>
      <button 
        class="view-btn"
        class:active={viewMode === 'list'}
        on:click={() => viewMode = 'list'}
        title="List view"
      >
        ☰
      </button>
    </div>
  </div>
  
  {#if isLoading}
    <div class="loading-state">
      <span class="spinner"></span>
      Loading screenshots...
    </div>
  {:else if filteredEntries.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📷</span>
      <p>No screenshots found</p>
      {#if searchQuery || filterType !== 'all'}
        <button class="clear-filters" on:click={() => { searchQuery = ''; filterType = 'all'; }}>
          Clear filters
        </button>
      {:else}
        <p class="empty-hint">Capture screenshots to see them here</p>
      {/if}
    </div>
  {:else}
    <div class="gallery-content" class:grid-view={viewMode === 'grid'} class:list-view={viewMode === 'list'}>
      {#each filteredEntries as entry (entry.id)}
        <div 
          class="gallery-item"
          class:selected={selectedEntry?.id === entry.id}
          class:favorite={entry.favorite}
          on:click={() => selectEntry(entry)}
          on:dblclick={() => openPreview(entry)}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && openPreview(entry)}
        >
          <div class="item-thumbnail">
            {#if entry.thumbnail}
              <img src={entry.thumbnail} alt={entry.filename} loading="lazy" />
            {:else}
              <span class="no-thumbnail">📷</span>
            {/if}
            
            <div class="item-overlay">
              <button 
                class="overlay-btn"
                on:click|stopPropagation={() => openPreview(entry)}
                title="Preview"
              >
                🔍
              </button>
              <button 
                class="overlay-btn"
                on:click|stopPropagation={() => copyToClipboard(entry)}
                title="Copy"
              >
                📋
              </button>
              <button 
                class="overlay-btn"
                on:click|stopPropagation={() => toggleFavorite(entry)}
                title={entry.favorite ? 'Unfavorite' : 'Favorite'}
              >
                {entry.favorite ? '⭐' : '☆'}
              </button>
            </div>
            
            {#if entry.favorite}
              <span class="favorite-badge">⭐</span>
            {/if}
          </div>
          
          <div class="item-info">
            <div class="item-header">
              <span class="type-icon">{getTypeIcon(entry.type)}</span>
              <span class="item-date">{formatDate(entry.capturedAt)}</span>
            </div>
            
            <div class="item-meta">
              <span>{entry.width}×{entry.height}</span>
              <span>{formatSize(entry.size)}</span>
            </div>
            
            {#if entry.tags.length > 0}
              <div class="item-tags">
                {#each entry.tags.slice(0, 3) as tag}
                  <span class="tag">{tag}</span>
                {/each}
                {#if entry.tags.length > 3}
                  <span class="tag more">+{entry.tags.length - 3}</span>
                {/if}
              </div>
            {/if}
          </div>
          
          <div class="item-actions">
            <button 
              class="action-btn"
              on:click|stopPropagation={() => exportEntry(entry)}
              title="Export"
            >
              💾
            </button>
            <button 
              class="action-btn"
              on:click|stopPropagation={() => startEditingTags(entry)}
              title="Edit tags"
            >
              🏷️
            </button>
            <button 
              class="action-btn danger"
              on:click|stopPropagation={() => confirmDelete(entry)}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deleteTarget}
  <div class="modal-overlay" on:click={() => showDeleteConfirm = false} role="dialog">
    <div class="modal-content" on:click|stopPropagation role="document">
      <h3>Delete Screenshot?</h3>
      <p>Are you sure you want to delete this screenshot? This action cannot be undone.</p>
      
      {#if deleteTarget.thumbnail}
        <img src={deleteTarget.thumbnail} alt="Screenshot to delete" class="delete-preview" />
      {/if}
      
      <div class="modal-actions">
        <button class="modal-btn" on:click={() => showDeleteConfirm = false}>Cancel</button>
        <button class="modal-btn danger" on:click={deleteEntry}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<!-- Tag Editor Modal -->
{#if editingTags}
  <div class="modal-overlay" on:click={() => editingTags = null} role="dialog">
    <div class="modal-content" on:click|stopPropagation role="document">
      <h3>Edit Tags</h3>
      
      <div class="tag-editor">
        <div class="current-tags">
          {#each editingTags.tags as tag}
            <span class="tag editable">
              {tag}
              <button class="remove-tag" on:click={() => removeTag(editingTags, tag)}>✕</button>
            </span>
          {/each}
        </div>
        
        <form on:submit|preventDefault={addTag} class="tag-form">
          <input
            type="text"
            placeholder="Add tag..."
            bind:value={tagInput}
            class="tag-input"
          />
          <button type="submit" class="add-tag-btn" disabled={!tagInput.trim()}>Add</button>
        </form>
      </div>
      
      <div class="modal-actions">
        <button class="modal-btn" on:click={() => editingTags = null}>Done</button>
      </div>
    </div>
  </div>
{/if}

<!-- Preview Modal -->
{#if previewModal}
  <div class="preview-overlay" on:click={closePreview} role="dialog">
    <div class="preview-content" on:click|stopPropagation role="document">
      <div class="preview-header">
        <span class="preview-info">
          {getTypeIcon(previewModal.type)} {previewModal.width}×{previewModal.height} • 
          {formatSize(previewModal.size)} • {formatDate(previewModal.capturedAt)}
        </span>
        <button class="close-preview" on:click={closePreview}>✕</button>
      </div>
      
      <div class="preview-image-container">
        <button 
          class="nav-btn prev"
          on:click|stopPropagation={() => navigatePreview(-1)}
          disabled={filteredEntries.findIndex(e => e.id === previewModal.id) === 0}
        >
          ‹
        </button>
        
        <img 
          src={previewModal.thumbnail} 
          alt={previewModal.filename}
          class="preview-image"
        />
        
        <button 
          class="nav-btn next"
          on:click|stopPropagation={() => navigatePreview(1)}
          disabled={filteredEntries.findIndex(e => e.id === previewModal.id) === filteredEntries.length - 1}
        >
          ›
        </button>
      </div>
      
      <div class="preview-actions">
        <button class="preview-btn" on:click={() => copyToClipboard(previewModal)}>
          📋 Copy
        </button>
        <button class="preview-btn" on:click={() => exportEntry(previewModal)}>
          💾 Export
        </button>
        <button class="preview-btn" on:click={() => toggleFavorite(previewModal)}>
          {previewModal.favorite ? '⭐ Unfavorite' : '☆ Favorite'}
        </button>
        <button class="preview-btn danger" on:click={() => { confirmDelete(previewModal); closePreview(); }}>
          🗑️ Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .screenshot-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #36393f);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary, #2f3136);
    border-bottom: 1px solid var(--border-subtle, #1e2124);
  }
  
  .gallery-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .entry-count {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }
  
  .gallery-controls {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #2f3136);
    border-bottom: 1px solid var(--border-subtle, #1e2124);
    flex-wrap: wrap;
  }
  
  .search-box {
    position: relative;
    flex: 1;
    min-width: 200px;
  }
  
  .search-input {
    width: 100%;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.875rem;
  }
  
  .search-input::placeholder {
    color: var(--text-muted, #72767d);
  }
  
  .clear-search {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 0.25rem;
  }
  
  .filter-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .filter-select {
    padding: 0.5rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.75rem;
    cursor: pointer;
  }
  
  .sort-direction {
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .view-toggle {
    display: flex;
    gap: 0.25rem;
  }
  
  .view-btn {
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-muted, #72767d);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .view-btn.active {
    background: var(--accent, #5865f2);
    color: white;
  }
  
  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-muted, #72767d);
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-top-color: var(--accent, #5865f2);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-bottom: 0.5rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .empty-hint {
    font-size: 0.75rem;
  }
  
  .clear-filters {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--accent, #5865f2);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
  
  .gallery-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .gallery-content.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .gallery-content.list-view {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .gallery-item {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }
  
  .gallery-item:hover {
    background: var(--bg-hover, #42464d);
  }
  
  .gallery-item.selected {
    border-color: var(--accent, #5865f2);
  }
  
  .gallery-item.favorite {
    box-shadow: 0 0 0 1px rgba(255, 215, 0, 0.3);
  }
  
  .list-view .gallery-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
  }
  
  .list-view .item-thumbnail {
    width: 80px;
    height: 60px;
    flex-shrink: 0;
  }
  
  .item-thumbnail {
    position: relative;
    aspect-ratio: 4/3;
    background: var(--bg-tertiary, #202225);
    overflow: hidden;
  }
  
  .item-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .no-thumbnail {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 2rem;
    opacity: 0.5;
  }
  
  .item-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .gallery-item:hover .item-overlay {
    opacity: 1;
  }
  
  .overlay-btn {
    width: 32px;
    height: 32px;
    background: var(--bg-secondary, #2f3136);
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .overlay-btn:hover {
    background: var(--accent, #5865f2);
  }
  
  .favorite-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 1rem;
  }
  
  .item-info {
    padding: 0.75rem;
  }
  
  .list-view .item-info {
    flex: 1;
  }
  
  .item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .type-icon {
    font-size: 0.875rem;
  }
  
  .item-date {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }
  
  .item-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.6875rem;
    color: var(--text-muted, #72767d);
  }
  
  .item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  
  .tag {
    padding: 0.125rem 0.375rem;
    background: var(--bg-tertiary, #202225);
    border-radius: 2px;
    font-size: 0.625rem;
    color: var(--text-secondary, #b9bbbe);
  }
  
  .tag.more {
    background: var(--accent, #5865f2);
    color: white;
  }
  
  .item-actions {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border-subtle, #1e2124);
  }
  
  .list-view .item-actions {
    border-top: none;
    padding: 0;
  }
  
  .action-btn {
    flex: 1;
    padding: 0.375rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .action-btn:hover {
    background: var(--bg-hover, #42464d);
  }
  
  .action-btn.danger:hover {
    background: var(--danger, #ed4245);
  }
  
  /* Modals */
  .modal-overlay, .preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 400px;
    width: 90%;
  }
  
  .modal-content h3 {
    margin: 0 0 1rem;
    color: var(--text-primary, #fff);
  }
  
  .modal-content p {
    color: var(--text-secondary, #b9bbbe);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
  
  .delete-preview {
    width: 100%;
    max-height: 150px;
    object-fit: contain;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  
  .modal-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    cursor: pointer;
  }
  
  .modal-btn.danger {
    background: var(--danger, #ed4245);
    color: white;
  }
  
  .tag-editor {
    margin-bottom: 1rem;
  }
  
  .current-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .tag.editable {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-right: 0.25rem;
  }
  
  .remove-tag {
    background: none;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
  }
  
  .tag-form {
    display: flex;
    gap: 0.5rem;
  }
  
  .tag-input {
    flex: 1;
    padding: 0.5rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
  }
  
  .add-tag-btn {
    padding: 0.5rem 1rem;
    background: var(--accent, #5865f2);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
  
  .add-tag-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Preview Modal */
  .preview-content {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-subtle, #1e2124);
  }
  
  .preview-info {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }
  
  .close-preview {
    background: none;
    border: none;
    color: var(--text-muted, #72767d);
    font-size: 1.25rem;
    cursor: pointer;
  }
  
  .preview-image-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }
  
  .preview-image {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: 4px;
  }
  
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 50%;
    color: var(--text-primary, #dcddde);
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .nav-btn:hover:not(:disabled) {
    opacity: 1;
  }
  
  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .nav-btn.prev {
    left: 1rem;
  }
  
  .nav-btn.next {
    right: 1rem;
  }
  
  .preview-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border-subtle, #1e2124);
    justify-content: center;
  }
  
  .preview-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .preview-btn:hover {
    background: var(--bg-hover, #42464d);
  }
  
  .preview-btn.danger:hover {
    background: var(--danger, #ed4245);
    color: white;
  }
</style>
