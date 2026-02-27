<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-shell';

  interface ReadingItem {
    id: string;
    url: string;
    title: string;
    description?: string;
    favicon?: string;
    status: 'unread' | 'reading' | 'completed' | 'archived';
    tags: string[];
    priority: 'low' | 'normal' | 'high';
    progress?: number; // 0-100 for reading progress
    addedAt: string;
    completedAt?: string;
    estimatedReadTime?: number; // minutes
    notes?: string;
  }

  export let compact = false;
  export let onOpenUrl: ((url: string) => void) | undefined = undefined;

  const items = writable<ReadingItem[]>([]);
  const allTags = writable<string[]>([]);

  let searchQuery = '';
  let statusFilter: 'all' | 'unread' | 'reading' | 'completed' | 'archived' = 'all';
  let tagFilter = '';
  let sortBy: 'addedAt' | 'priority' | 'title' = 'addedAt';
  let sortOrder: 'asc' | 'desc' = 'desc';

  let showAddModal = false;
  let editingItem: ReadingItem | null = null;
  let newUrl = '';
  let isLoading = false;
  let loadingMessage = '';

  const STORAGE_KEY = 'reading-list-items';

  onMount(async () => {
    await loadItems();
  });

  async function loadItems() {
    try {
      const stored = await invoke<string>('plugin:store|get', {
        key: STORAGE_KEY
      }).catch(() => null);

      if (stored) {
        const parsed = JSON.parse(stored);
        items.set(parsed.items || []);
        updateAllTags();
      }
    } catch (error) {
      console.error('Failed to load reading list:', error);
    }
  }

  async function saveItems() {
    try {
      const data = JSON.stringify({ items: $items });
      await invoke('plugin:store|set', {
        key: STORAGE_KEY,
        value: data
      });
    } catch (error) {
      console.error('Failed to save reading list:', error);
    }
  }

  function updateAllTags() {
    const tags = new Set<string>();
    $items.forEach(item => item.tags.forEach(tag => tags.add(tag)));
    allTags.set(Array.from(tags).sort());
  }

  async function addItem() {
    if (!newUrl.trim()) return;

    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    isLoading = true;
    loadingMessage = 'Fetching page info...';

    try {
      // Try to fetch page metadata
      const metadata = await fetchPageMetadata(url);
      
      const item: ReadingItem = {
        id: crypto.randomUUID(),
        url,
        title: metadata.title || extractDomain(url),
        description: metadata.description,
        favicon: metadata.favicon,
        status: 'unread',
        tags: [],
        priority: 'normal',
        addedAt: new Date().toISOString(),
        estimatedReadTime: metadata.readTime
      };

      items.update(list => [item, ...list]);
      await saveItems();
      
      newUrl = '';
      showAddModal = false;
    } catch (error) {
      console.error('Failed to add item:', error);
      // Add with basic info
      const item: ReadingItem = {
        id: crypto.randomUUID(),
        url,
        title: extractDomain(url),
        status: 'unread',
        tags: [],
        priority: 'normal',
        addedAt: new Date().toISOString()
      };

      items.update(list => [item, ...list]);
      await saveItems();
      
      newUrl = '';
      showAddModal = false;
    } finally {
      isLoading = false;
      loadingMessage = '';
    }
  }

  async function fetchPageMetadata(url: string): Promise<{
    title?: string;
    description?: string;
    favicon?: string;
    readTime?: number;
  }> {
    try {
      // Use Tauri to fetch the page (avoids CORS issues)
      const html = await invoke<string>('fetch_page_html', { url }).catch(() => null);
      
      if (!html) {
        return { title: extractDomain(url) };
      }

      // Parse title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

      // Parse meta description
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
      const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : undefined;

      // Parse favicon
      const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
                        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
      let favicon = iconMatch ? iconMatch[1] : undefined;
      
      if (favicon && !favicon.startsWith('http')) {
        const urlObj = new URL(url);
        favicon = favicon.startsWith('/') 
          ? `${urlObj.origin}${favicon}`
          : `${urlObj.origin}/${favicon}`;
      }

      // Estimate read time (rough calculation based on text content)
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const wordCount = textContent.split(' ').length;
      const readTime = Math.ceil(wordCount / 200); // 200 words per minute

      return { title, description, favicon, readTime };
    } catch {
      return { title: extractDomain(url) };
    }
  }

  function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };
    return text.replace(/&[^;]+;/g, match => entities[match] || match);
  }

  function extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  async function updateItem(item: ReadingItem) {
    items.update(list => list.map(i => i.id === item.id ? item : i));
    await saveItems();
    updateAllTags();
  }

  async function deleteItem(id: string) {
    items.update(list => list.filter(i => i.id !== id));
    await saveItems();
    updateAllTags();
  }

  async function setStatus(id: string, status: ReadingItem['status']) {
    items.update(list => list.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status,
          completedAt: status === 'completed' ? new Date().toISOString() : item.completedAt,
          progress: status === 'completed' ? 100 : item.progress
        };
      }
      return item;
    }));
    await saveItems();
  }

  async function togglePriority(id: string) {
    const priorities: ReadingItem['priority'][] = ['low', 'normal', 'high'];
    items.update(list => list.map(item => {
      if (item.id === id) {
        const currentIndex = priorities.indexOf(item.priority);
        const nextIndex = (currentIndex + 1) % priorities.length;
        return { ...item, priority: priorities[nextIndex] };
      }
      return item;
    }));
    await saveItems();
  }

  async function addTag(id: string, tag: string) {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;

    items.update(list => list.map(item => {
      if (item.id === id && !item.tags.includes(normalizedTag)) {
        return { ...item, tags: [...item.tags, normalizedTag] };
      }
      return item;
    }));
    await saveItems();
    updateAllTags();
  }

  async function removeTag(id: string, tag: string) {
    items.update(list => list.map(item => {
      if (item.id === id) {
        return { ...item, tags: item.tags.filter(t => t !== tag) };
      }
      return item;
    }));
    await saveItems();
    updateAllTags();
  }

  function openUrl(url: string) {
    if (onOpenUrl) {
      onOpenUrl(url);
    } else {
      open(url);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  }

  function getPriorityIcon(priority: ReadingItem['priority']): string {
    switch (priority) {
      case 'high': return '🔴';
      case 'normal': return '🟡';
      case 'low': return '🟢';
    }
  }

  function getStatusIcon(status: ReadingItem['status']): string {
    switch (status) {
      case 'unread': return '📖';
      case 'reading': return '📚';
      case 'completed': return '✅';
      case 'archived': return '📦';
    }
  }

  $: filteredItems = $items
    .filter(item => {
      const matchesSearch = searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesTag = tagFilter === '' || item.tags.includes(tagFilter);
      
      return matchesSearch && matchesStatus && matchesTag;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'addedAt':
          cmp = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

  $: stats = {
    total: $items.length,
    unread: $items.filter(i => i.status === 'unread').length,
    reading: $items.filter(i => i.status === 'reading').length,
    completed: $items.filter(i => i.status === 'completed').length,
    archived: $items.filter(i => i.status === 'archived').length
  };
</script>

<div class="reading-list-manager" class:compact>
  <header class="header">
    <h3>📚 Reading List</h3>
    <button class="add-btn" on:click={() => showAddModal = true} title="Add article">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  </header>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <button class="stat-item" class:active={statusFilter === 'all'} on:click={() => statusFilter = 'all'}>
      <span class="stat-count">{stats.total}</span>
      <span class="stat-label">All</span>
    </button>
    <button class="stat-item" class:active={statusFilter === 'unread'} on:click={() => statusFilter = 'unread'}>
      <span class="stat-count">{stats.unread}</span>
      <span class="stat-label">Unread</span>
    </button>
    <button class="stat-item" class:active={statusFilter === 'reading'} on:click={() => statusFilter = 'reading'}>
      <span class="stat-count">{stats.reading}</span>
      <span class="stat-label">Reading</span>
    </button>
    <button class="stat-item" class:active={statusFilter === 'completed'} on:click={() => statusFilter = 'completed'}>
      <span class="stat-count">{stats.completed}</span>
      <span class="stat-label">Done</span>
    </button>
  </div>

  <!-- Search & Filter -->
  <div class="search-filter">
    <input
      type="text"
      placeholder="Search articles..."
      bind:value={searchQuery}
      class="search-input"
    />
    {#if $allTags.length > 0}
      <select bind:value={tagFilter} class="tag-filter">
        <option value="">All Tags</option>
        {#each $allTags as tag}
          <option value={tag}>#{tag}</option>
        {/each}
      </select>
    {/if}
    <select bind:value={sortBy} class="sort-select">
      <option value="addedAt">Date Added</option>
      <option value="priority">Priority</option>
      <option value="title">Title</option>
    </select>
    <button 
      class="sort-order-btn" 
      on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
      title="Toggle sort order"
    >
      {sortOrder === 'asc' ? '↑' : '↓'}
    </button>
  </div>

  <!-- Items List -->
  <div class="items-list">
    {#each filteredItems as item (item.id)}
      <div class="item" class:completed={item.status === 'completed'} class:archived={item.status === 'archived'}>
        <div class="item-header">
          <button 
            class="priority-btn" 
            on:click|stopPropagation={() => togglePriority(item.id)}
            title="Priority: {item.priority}"
          >
            {getPriorityIcon(item.priority)}
          </button>
          
          {#if item.favicon}
            <img src={item.favicon} alt="" class="favicon" />
          {/if}
          
          <div class="item-info">
            <button class="item-title" on:click={() => openUrl(item.url)}>
              {item.title}
            </button>
            <span class="item-domain">{extractDomain(item.url)}</span>
          </div>
          
          <div class="item-meta">
            {#if item.estimatedReadTime}
              <span class="read-time" title="Estimated read time">
                ⏱️ {item.estimatedReadTime}m
              </span>
            {/if}
            <span class="date-added">{formatDate(item.addedAt)}</span>
          </div>
        </div>
        
        {#if item.description && !compact}
          <p class="item-description">{item.description.slice(0, 150)}{item.description.length > 150 ? '...' : ''}</p>
        {/if}
        
        <div class="item-footer">
          <div class="tags">
            {#each item.tags as tag}
              <span class="tag">
                #{tag}
                <button class="tag-remove" on:click|stopPropagation={() => removeTag(item.id, tag)}>×</button>
              </span>
            {/each}
            <input
              type="text"
              class="tag-input"
              placeholder="+ tag"
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  addTag(item.id, e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
          
          <div class="item-actions">
            <select 
              class="status-select"
              value={item.status}
              on:change={(e) => setStatus(item.id, e.currentTarget.value as ReadingItem['status'])}
            >
              <option value="unread">📖 Unread</option>
              <option value="reading">📚 Reading</option>
              <option value="completed">✅ Completed</option>
              <option value="archived">📦 Archived</option>
            </select>
            
            <button 
              class="action-btn"
              on:click={() => editingItem = { ...item }}
              title="Edit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            
            <button 
              class="action-btn delete"
              on:click={() => deleteItem(item.id)}
              title="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    {:else}
      <div class="empty-state">
        {#if searchQuery || statusFilter !== 'all' || tagFilter}
          <p>No matching articles found</p>
          <button on:click={() => { searchQuery = ''; statusFilter = 'all'; tagFilter = ''; }}>
            Clear filters
          </button>
        {:else}
          <p>Your reading list is empty</p>
          <button on:click={() => showAddModal = true}>Add your first article</button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<!-- Add Modal -->
{#if showAddModal}
  <div class="modal-overlay" on:click={() => { if (!isLoading) showAddModal = false; }} on:keypress={() => { if (!isLoading) showAddModal = false; }} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keypress|stopPropagation role="dialog" aria-modal="true">
      <h3>Add to Reading List</h3>
      
      <div class="form-group">
        <label for="new-url">URL</label>
        <input
          id="new-url"
          type="url"
          placeholder="https://example.com/article"
          bind:value={newUrl}
          disabled={isLoading}
          on:keydown={(e) => e.key === 'Enter' && addItem()}
        />
      </div>

      {#if isLoading}
        <div class="loading-indicator">
          <span class="spinner"></span>
          {loadingMessage}
        </div>
      {/if}

      <div class="modal-actions">
        <button class="cancel-btn" on:click={() => showAddModal = false} disabled={isLoading}>
          Cancel
        </button>
        <button class="save-btn" on:click={addItem} disabled={isLoading || !newUrl.trim()}>
          Add Article
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if editingItem}
  <div class="modal-overlay" on:click={() => editingItem = null} on:keypress={() => editingItem = null} role="button" tabindex="0">
    <div class="modal edit-modal" on:click|stopPropagation on:keypress|stopPropagation role="dialog" aria-modal="true">
      <h3>Edit Article</h3>
      
      <div class="form-group">
        <label for="edit-title">Title</label>
        <input id="edit-title" type="text" bind:value={editingItem.title} />
      </div>

      <div class="form-group">
        <label for="edit-url">URL</label>
        <input id="edit-url" type="url" bind:value={editingItem.url} />
      </div>

      <div class="form-group">
        <label for="edit-description">Description</label>
        <textarea id="edit-description" bind:value={editingItem.description} rows="3"></textarea>
      </div>

      <div class="form-group">
        <label for="edit-notes">Personal Notes</label>
        <textarea id="edit-notes" bind:value={editingItem.notes} rows="3" placeholder="Add your notes..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="edit-priority">Priority</label>
          <select id="edit-priority" bind:value={editingItem.priority}>
            <option value="low">🟢 Low</option>
            <option value="normal">🟡 Normal</option>
            <option value="high">🔴 High</option>
          </select>
        </div>

        <div class="form-group">
          <label for="edit-status">Status</label>
          <select id="edit-status" bind:value={editingItem.status}>
            <option value="unread">📖 Unread</option>
            <option value="reading">📚 Reading</option>
            <option value="completed">✅ Completed</option>
            <option value="archived">📦 Archived</option>
          </select>
        </div>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" on:click={() => editingItem = null}>Cancel</button>
        <button class="save-btn" on:click={() => { updateItem(editingItem!); editingItem = null; }}>
          Save Changes
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reading-list-manager {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 8px;
    max-height: 600px;
    overflow: hidden;
  }

  .reading-list-manager.compact {
    padding: 0.75rem;
    max-height: 400px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary, #6366f1);
    color: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-btn:hover {
    background: var(--accent-primary-hover, #4f46e5);
  }

  .stats-bar {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 8px;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary, #aaa);
    cursor: pointer;
    transition: all 0.2s;
  }

  .stat-item:hover, .stat-item.active {
    background: var(--bg-secondary, #1e1e1e);
    color: var(--text-primary, #fff);
  }

  .stat-item.active {
    background: var(--accent-primary, #6366f1);
    color: white;
  }

  .stat-count {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .search-filter {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
  }

  .search-input::placeholder {
    color: var(--text-muted, #888);
  }

  .tag-filter, .sort-select {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .sort-order-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    cursor: pointer;
    font-size: 1rem;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .item {
    padding: 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .item:hover {
    border-color: var(--accent-primary, #6366f1);
  }

  .item.completed {
    opacity: 0.75;
  }

  .item.archived {
    opacity: 0.5;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .priority-btn {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .favicon {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    object-fit: contain;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    display: block;
    border: none;
    background: none;
    padding: 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary, #fff);
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .item-title:hover {
    text-decoration: underline;
    color: var(--accent-primary, #6366f1);
  }

  .item-domain {
    font-size: 0.75rem;
    color: var(--text-muted, #888);
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .read-time, .date-added {
    font-size: 0.7rem;
    color: var(--text-muted, #888);
  }

  .item-description {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--text-secondary, #aaa);
    line-height: 1.4;
  }

  .item-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    flex: 1;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--accent-primary, #6366f1);
  }

  .tag-remove {
    border: none;
    background: none;
    padding: 0;
    color: var(--text-muted, #888);
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1;
  }

  .tag-remove:hover {
    color: var(--error-text, #ef4444);
  }

  .tag-input {
    border: none;
    background: transparent;
    padding: 0.125rem;
    font-size: 0.7rem;
    color: var(--text-muted, #888);
    width: 50px;
  }

  .tag-input:focus {
    outline: none;
    color: var(--text-primary, #fff);
    width: 80px;
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .status-select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    background: var(--bg-secondary, #1e1e1e);
    color: var(--text-primary, #fff);
    font-size: 0.7rem;
    cursor: pointer;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-secondary, #1e1e1e);
    color: var(--text-primary, #fff);
  }

  .action-btn.delete:hover {
    color: #ef4444;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted, #888);
  }

  .empty-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--accent-primary, #6366f1);
    color: white;
    cursor: pointer;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 450px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  }

  .modal.edit-modal {
    max-width: 550px;
  }

  .modal h3 {
    margin: 0 0 1rem;
    color: var(--text-primary, #fff);
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary, #aaa);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 60px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 6px;
    color: var(--text-secondary, #aaa);
    font-size: 0.875rem;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #333);
    border-top-color: var(--accent-primary, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-btn,
  .save-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .cancel-btn {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-secondary, #aaa);
  }

  .cancel-btn:hover {
    background: var(--bg-hover, #333);
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-btn {
    background: var(--accent-primary, #6366f1);
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--accent-primary-hover, #4f46e5);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
