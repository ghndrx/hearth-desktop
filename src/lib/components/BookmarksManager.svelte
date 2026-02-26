<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, slide, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  // Types
  interface Bookmark {
    id: string;
    messageId: string;
    channelId: string;
    channelName: string;
    serverId?: string;
    serverName?: string;
    content: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    timestamp: Date;
    createdAt: Date;
    tags: string[];
    note?: string;
    pinned: boolean;
  }

  interface BookmarkFolder {
    id: string;
    name: string;
    icon: string;
    color: string;
    bookmarkIds: string[];
    createdAt: Date;
  }

  // Props
  export let isOpen = false;
  export let storageKey = 'hearth-bookmarks';

  const dispatch = createEventDispatcher<{
    close: void;
    navigate: { messageId: string; channelId: string };
    bookmarkAdded: Bookmark;
    bookmarkRemoved: string;
  }>();

  // State
  const bookmarks: Writable<Bookmark[]> = writable([]);
  const folders: Writable<BookmarkFolder[]> = writable([]);
  const selectedFolderId: Writable<string | null> = writable(null);
  const searchQuery = writable('');
  const selectedTags: Writable<string[]> = writable([]);
  const sortBy: Writable<'newest' | 'oldest' | 'pinned' | 'channel'> = writable('newest');
  const viewMode: Writable<'list' | 'grid' | 'compact'> = writable('list');

  let showAddFolderModal = false;
  let showEditBookmarkModal = false;
  let editingBookmark: Bookmark | null = null;
  let newFolderName = '';
  let newFolderIcon = '📁';
  let newFolderColor = '#6366f1';
  let draggedBookmarkId: string | null = null;
  let dropTargetFolderId: string | null = null;

  // Derived stores
  const allTags = derived(bookmarks, $bookmarks => {
    const tagSet = new Set<string>();
    $bookmarks.forEach(b => b.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  });

  const filteredBookmarks = derived(
    [bookmarks, selectedFolderId, searchQuery, selectedTags, sortBy, folders],
    ([$bookmarks, $selectedFolderId, $searchQuery, $selectedTags, $sortBy, $folders]) => {
      let result = [...$bookmarks];

      // Filter by folder
      if ($selectedFolderId) {
        const folder = $folders.find(f => f.id === $selectedFolderId);
        if (folder) {
          result = result.filter(b => folder.bookmarkIds.includes(b.id));
        }
      }

      // Filter by search query
      if ($searchQuery) {
        const query = $searchQuery.toLowerCase();
        result = result.filter(b =>
          b.content.toLowerCase().includes(query) ||
          b.author.name.toLowerCase().includes(query) ||
          b.channelName.toLowerCase().includes(query) ||
          b.note?.toLowerCase().includes(query) ||
          b.tags.some(t => t.toLowerCase().includes(query))
        );
      }

      // Filter by selected tags
      if ($selectedTags.length > 0) {
        result = result.filter(b =>
          $selectedTags.every(t => b.tags.includes(t))
        );
      }

      // Sort
      switch ($sortBy) {
        case 'newest':
          result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        case 'oldest':
          result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          break;
        case 'pinned':
          result.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          break;
        case 'channel':
          result.sort((a, b) => a.channelName.localeCompare(b.channelName));
          break;
      }

      return result;
    }
  );

  const pinnedCount = derived(bookmarks, $bookmarks =>
    $bookmarks.filter(b => b.pinned).length
  );

  // Lifecycle
  onMount(() => {
    loadFromStorage();
    window.addEventListener('storage', handleStorageChange);
  });

  onDestroy(() => {
    window.removeEventListener('storage', handleStorageChange);
  });

  // Storage
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        bookmarks.set(data.bookmarks || []);
        folders.set(data.folders || []);
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        bookmarks: $bookmarks,
        folders: $folders
      }));
    } catch (err) {
      console.error('Failed to save bookmarks:', err);
    }
  }

  function handleStorageChange(e: StorageEvent) {
    if (e.key === storageKey) {
      loadFromStorage();
    }
  }

  // Bookmark actions
  export function addBookmark(message: {
    id: string;
    channelId: string;
    channelName: string;
    serverId?: string;
    serverName?: string;
    content: string;
    author: { id: string; name: string; avatar?: string };
    timestamp: Date;
  }) {
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      messageId: message.id,
      channelId: message.channelId,
      channelName: message.channelName,
      serverId: message.serverId,
      serverName: message.serverName,
      content: message.content,
      author: message.author,
      timestamp: message.timestamp,
      createdAt: new Date(),
      tags: [],
      pinned: false
    };

    bookmarks.update(b => [...b, bookmark]);
    saveToStorage();
    dispatch('bookmarkAdded', bookmark);
    return bookmark;
  }

  function removeBookmark(id: string) {
    bookmarks.update(b => b.filter(bm => bm.id !== id));
    folders.update(f => f.map(folder => ({
      ...folder,
      bookmarkIds: folder.bookmarkIds.filter(bid => bid !== id)
    })));
    saveToStorage();
    dispatch('bookmarkRemoved', id);
  }

  function togglePin(id: string) {
    bookmarks.update(b => b.map(bm =>
      bm.id === id ? { ...bm, pinned: !bm.pinned } : bm
    ));
    saveToStorage();
  }

  function updateBookmark(id: string, updates: Partial<Bookmark>) {
    bookmarks.update(b => b.map(bm =>
      bm.id === id ? { ...bm, ...updates } : bm
    ));
    saveToStorage();
  }

  function openEditModal(bookmark: Bookmark) {
    editingBookmark = { ...bookmark };
    showEditBookmarkModal = true;
  }

  function saveBookmarkEdit() {
    if (editingBookmark) {
      updateBookmark(editingBookmark.id, editingBookmark);
      showEditBookmarkModal = false;
      editingBookmark = null;
    }
  }

  // Folder actions
  function createFolder() {
    if (!newFolderName.trim()) return;

    const folder: BookmarkFolder = {
      id: crypto.randomUUID(),
      name: newFolderName.trim(),
      icon: newFolderIcon,
      color: newFolderColor,
      bookmarkIds: [],
      createdAt: new Date()
    };

    folders.update(f => [...f, folder]);
    saveToStorage();

    newFolderName = '';
    newFolderIcon = '📁';
    newFolderColor = '#6366f1';
    showAddFolderModal = false;
  }

  function deleteFolder(id: string) {
    folders.update(f => f.filter(folder => folder.id !== id));
    if ($selectedFolderId === id) {
      selectedFolderId.set(null);
    }
    saveToStorage();
  }

  function addBookmarkToFolder(bookmarkId: string, folderId: string) {
    folders.update(f => f.map(folder => {
      if (folder.id === folderId && !folder.bookmarkIds.includes(bookmarkId)) {
        return { ...folder, bookmarkIds: [...folder.bookmarkIds, bookmarkId] };
      }
      return folder;
    }));
    saveToStorage();
  }

  function removeBookmarkFromFolder(bookmarkId: string, folderId: string) {
    folders.update(f => f.map(folder => {
      if (folder.id === folderId) {
        return { ...folder, bookmarkIds: folder.bookmarkIds.filter(id => id !== bookmarkId) };
      }
      return folder;
    }));
    saveToStorage();
  }

  // Tag actions
  function addTag(bookmarkId: string, tag: string) {
    const trimmedTag = tag.trim().toLowerCase();
    if (!trimmedTag) return;

    bookmarks.update(b => b.map(bm => {
      if (bm.id === bookmarkId && !bm.tags.includes(trimmedTag)) {
        return { ...bm, tags: [...bm.tags, trimmedTag] };
      }
      return bm;
    }));
    saveToStorage();
  }

  function removeTag(bookmarkId: string, tag: string) {
    bookmarks.update(b => b.map(bm => {
      if (bm.id === bookmarkId) {
        return { ...bm, tags: bm.tags.filter(t => t !== tag) };
      }
      return bm;
    }));
    saveToStorage();
  }

  function toggleTagFilter(tag: string) {
    selectedTags.update(tags => {
      if (tags.includes(tag)) {
        return tags.filter(t => t !== tag);
      }
      return [...tags, tag];
    });
  }

  // Drag and drop
  function handleDragStart(e: DragEvent, bookmarkId: string) {
    draggedBookmarkId = bookmarkId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, folderId: string) {
    e.preventDefault();
    dropTargetFolderId = folderId;
  }

  function handleDragLeave() {
    dropTargetFolderId = null;
  }

  function handleDrop(e: DragEvent, folderId: string) {
    e.preventDefault();
    if (draggedBookmarkId) {
      addBookmarkToFolder(draggedBookmarkId, folderId);
    }
    draggedBookmarkId = null;
    dropTargetFolderId = null;
  }

  // Navigation
  function navigateToMessage(bookmark: Bookmark) {
    dispatch('navigate', {
      messageId: bookmark.messageId,
      channelId: bookmark.channelId
    });
  }

  // Export
  function exportBookmarks() {
    const data = JSON.stringify({ bookmarks: $bookmarks, folders: $folders }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hearth-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Format helpers
  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  // Reactive subscriptions for saveToStorage
  $: $bookmarks, $folders, typeof localStorage !== 'undefined' && saveToStorage();

  // Folder icons
  const folderIcons = ['📁', '⭐', '💼', '📌', '🔖', '💡', '🎯', '📚', '🏷️', '🗂️'];
  const folderColors = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#84cc16'];
</script>

{#if isOpen}
  <div
    class="bookmarks-manager"
    transition:fly={{ x: 300, duration: 200 }}
  >
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <h2>Bookmarks</h2>
        <span class="count">{$bookmarks.length}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" on:click={exportBookmarks} title="Export bookmarks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button class="icon-btn close-btn" on:click={() => dispatch('close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search bookmarks..."
        bind:value={$searchQuery}
      />
    </div>

    <div class="controls">
      <div class="view-modes">
        <button
          class="view-btn"
          class:active={$viewMode === 'list'}
          on:click={() => viewMode.set('list')}
          title="List view"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          class="view-btn"
          class:active={$viewMode === 'grid'}
          on:click={() => viewMode.set('grid')}
          title="Grid view"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
        <button
          class="view-btn"
          class:active={$viewMode === 'compact'}
          on:click={() => viewMode.set('compact')}
          title="Compact view"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="10" x2="20" y2="10" />
            <line x1="4" y1="14" x2="20" y2="14" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>

      <select bind:value={$sortBy} class="sort-select">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="pinned">Pinned first</option>
        <option value="channel">By channel</option>
      </select>
    </div>

    <!-- Tags filter -->
    {#if $allTags.length > 0}
      <div class="tags-filter" transition:slide>
        {#each $allTags as tag}
          <button
            class="tag-filter"
            class:selected={$selectedTags.includes(tag)}
            on:click={() => toggleTagFilter(tag)}
          >
            #{tag}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Folders sidebar -->
    <div class="content-wrapper">
      <div class="folders-sidebar">
        <div class="folders-header">
          <span>Folders</span>
          <button class="add-folder-btn" on:click={() => showAddFolderModal = true}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <button
          class="folder-item"
          class:selected={$selectedFolderId === null}
          on:click={() => selectedFolderId.set(null)}
        >
          <span class="folder-icon">📑</span>
          <span class="folder-name">All Bookmarks</span>
          <span class="folder-count">{$bookmarks.length}</span>
        </button>

        <button
          class="folder-item"
          class:selected={$selectedFolderId === 'pinned'}
          on:click={() => selectedFolderId.set('pinned')}
        >
          <span class="folder-icon">📌</span>
          <span class="folder-name">Pinned</span>
          <span class="folder-count">{$pinnedCount}</span>
        </button>

        {#each $folders as folder (folder.id)}
          <div
            class="folder-item"
            class:selected={$selectedFolderId === folder.id}
            class:drop-target={dropTargetFolderId === folder.id}
            on:click={() => selectedFolderId.set(folder.id)}
            on:dragover={e => handleDragOver(e, folder.id)}
            on:dragleave={handleDragLeave}
            on:drop={e => handleDrop(e, folder.id)}
            role="button"
            tabindex="0"
            animate:flip={{ duration: 200 }}
          >
            <span class="folder-icon" style="color: {folder.color}">{folder.icon}</span>
            <span class="folder-name">{folder.name}</span>
            <span class="folder-count">{folder.bookmarkIds.length}</span>
            <button
              class="delete-folder-btn"
              on:click|stopPropagation={() => deleteFolder(folder.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        {/each}
      </div>

      <!-- Bookmarks list -->
      <div class="bookmarks-list" class:grid={$viewMode === 'grid'} class:compact={$viewMode === 'compact'}>
        {#if $filteredBookmarks.length === 0}
          <div class="empty-state" transition:fade>
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <h3>No bookmarks</h3>
            <p>Bookmark messages to save them here for later reference.</p>
          </div>
        {:else}
          {#each $filteredBookmarks as bookmark (bookmark.id)}
            <div
              class="bookmark-item"
              class:pinned={bookmark.pinned}
              draggable="true"
              on:dragstart={e => handleDragStart(e, bookmark.id)}
              transition:fade={{ duration: 150 }}
              animate:flip={{ duration: 200 }}
            >
              <div class="bookmark-header">
                <div class="author-info">
                  {#if bookmark.author.avatar}
                    <img src={bookmark.author.avatar} alt="" class="avatar" />
                  {:else}
                    <div class="avatar-placeholder">
                      {bookmark.author.name.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                  <span class="author-name">{bookmark.author.name}</span>
                </div>
                <div class="bookmark-actions">
                  <button
                    class="action-btn"
                    class:active={bookmark.pinned}
                    on:click={() => togglePin(bookmark.id)}
                    title={bookmark.pinned ? 'Unpin' : 'Pin'}
                  >
                    <svg viewBox="0 0 24 24" fill={bookmark.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                      <path d="M12 2L9 9H2l6 5-2 8 6-4 6 4-2-8 6-5h-7z" />
                    </svg>
                  </button>
                  <button class="action-btn" on:click={() => openEditModal(bookmark)} title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button class="action-btn delete" on:click={() => removeBookmark(bookmark.id)} title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="bookmark-content" on:click={() => navigateToMessage(bookmark)}>
                <p>{$viewMode === 'compact' ? truncate(bookmark.content, 100) : bookmark.content}</p>
              </div>

              {#if bookmark.note}
                <div class="bookmark-note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>{bookmark.note}</span>
                </div>
              {/if}

              {#if bookmark.tags.length > 0}
                <div class="bookmark-tags">
                  {#each bookmark.tags as tag}
                    <span class="tag">#{tag}</span>
                  {/each}
                </div>
              {/if}

              <div class="bookmark-meta">
                <span class="channel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 11a9 9 0 0 1 9 9" />
                    <path d="M4 4a16 16 0 0 1 16 16" />
                    <circle cx="5" cy="19" r="1" />
                  </svg>
                  {bookmark.channelName}
                </span>
                <span class="date">
                  {formatDate(bookmark.timestamp)} at {formatTime(bookmark.timestamp)}
                </span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Add Folder Modal -->
{#if showAddFolderModal}
  <div class="modal-overlay" transition:fade on:click={() => showAddFolderModal = false}>
    <div class="modal" on:click|stopPropagation transition:fly={{ y: 20 }}>
      <h3>Create Folder</h3>

      <div class="form-group">
        <label for="folder-name">Name</label>
        <input
          id="folder-name"
          type="text"
          bind:value={newFolderName}
          placeholder="Enter folder name..."
        />
      </div>

      <div class="form-group">
        <label>Icon</label>
        <div class="icon-picker">
          {#each folderIcons as icon}
            <button
              class="icon-option"
              class:selected={newFolderIcon === icon}
              on:click={() => newFolderIcon = icon}
            >
              {icon}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          {#each folderColors as color}
            <button
              class="color-option"
              class:selected={newFolderColor === color}
              style="background-color: {color}"
              on:click={() => newFolderColor = color}
            />
          {/each}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => showAddFolderModal = false}>Cancel</button>
        <button class="btn-primary" on:click={createFolder} disabled={!newFolderName.trim()}>
          Create Folder
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Bookmark Modal -->
{#if showEditBookmarkModal && editingBookmark}
  <div class="modal-overlay" transition:fade on:click={() => showEditBookmarkModal = false}>
    <div class="modal" on:click|stopPropagation transition:fly={{ y: 20 }}>
      <h3>Edit Bookmark</h3>

      <div class="form-group">
        <label for="bookmark-note">Note</label>
        <textarea
          id="bookmark-note"
          bind:value={editingBookmark.note}
          placeholder="Add a note..."
          rows="3"
        />
      </div>

      <div class="form-group">
        <label for="bookmark-tags">Tags (comma-separated)</label>
        <input
          id="bookmark-tags"
          type="text"
          value={editingBookmark.tags.join(', ')}
          on:input={e => editingBookmark.tags = e.currentTarget.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)}
          placeholder="work, important, todo..."
        />
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => showEditBookmarkModal = false}>Cancel</button>
        <button class="btn-primary" on:click={saveBookmarkEdit}>Save Changes</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bookmarks-manager {
    position: fixed;
    top: 0;
    right: 0;
    width: 450px;
    max-width: 100%;
    height: 100vh;
    background: var(--bg-primary, #1e1e2e);
    border-left: 1px solid var(--border-color, #313244);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title .icon {
    width: 24px;
    height: 24px;
    color: var(--accent-color, #cba6f7);
  }

  .header-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .count {
    background: var(--bg-secondary, #313244);
    color: var(--text-secondary, #a6adc8);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-secondary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
  }

  .search-bar {
    position: relative;
    padding: 12px 16px;
  }

  .search-icon {
    position: absolute;
    left: 28px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--text-secondary, #a6adc8);
  }

  .search-bar input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    background: var(--bg-secondary, #313244);
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-bar input:focus {
    border-color: var(--accent-color, #cba6f7);
  }

  .search-bar input::placeholder {
    color: var(--text-secondary, #a6adc8);
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 12px;
    gap: 12px;
  }

  .view-modes {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary, #313244);
    padding: 4px;
    border-radius: 8px;
  }

  .view-btn {
    background: transparent;
    border: none;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .view-btn:hover {
    color: var(--text-primary, #cdd6f4);
  }

  .view-btn.active {
    background: var(--bg-primary, #1e1e2e);
    color: var(--accent-color, #cba6f7);
  }

  .view-btn svg {
    width: 16px;
    height: 16px;
  }

  .sort-select {
    padding: 6px 12px;
    background: var(--bg-secondary, #313244);
    border: none;
    border-radius: 6px;
    color: var(--text-primary, #cdd6f4);
    font-size: 13px;
    cursor: pointer;
  }

  .tags-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 12px;
  }

  .tag-filter {
    background: var(--bg-secondary, #313244);
    border: none;
    padding: 4px 10px;
    border-radius: 12px;
    color: var(--text-secondary, #a6adc8);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tag-filter:hover {
    background: var(--bg-tertiary, #45475a);
  }

  .tag-filter.selected {
    background: var(--accent-color, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .folders-sidebar {
    width: 140px;
    border-right: 1px solid var(--border-color, #313244);
    padding: 12px 8px;
    overflow-y: auto;
  }

  .folders-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary, #a6adc8);
  }

  .add-folder-btn {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    border-radius: 4px;
    transition: all 0.2s;
  }

  .add-folder-btn:hover {
    background: var(--bg-secondary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .add-folder-btn svg {
    width: 14px;
    height: 14px;
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-primary, #cdd6f4);
    font-size: 13px;
    text-align: left;
    transition: all 0.2s;
    position: relative;
  }

  .folder-item:hover {
    background: var(--bg-secondary, #313244);
  }

  .folder-item.selected {
    background: var(--accent-color, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .folder-item.drop-target {
    background: rgba(203, 166, 247, 0.3);
    border: 2px dashed var(--accent-color, #cba6f7);
  }

  .folder-icon {
    font-size: 14px;
  }

  .folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-count {
    font-size: 11px;
    opacity: 0.7;
  }

  .delete-folder-btn {
    position: absolute;
    right: 4px;
    opacity: 0;
    background: transparent;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    border-radius: 4px;
    transition: opacity 0.2s;
  }

  .folder-item:hover .delete-folder-btn {
    opacity: 1;
  }

  .delete-folder-btn:hover {
    color: #f38ba8;
  }

  .delete-folder-btn svg {
    width: 12px;
    height: 12px;
  }

  .bookmarks-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .bookmarks-list.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    align-content: start;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-secondary, #a6adc8);
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--text-primary, #cdd6f4);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .bookmark-item {
    background: var(--bg-secondary, #313244);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 12px;
    cursor: grab;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .bookmark-item:hover {
    border-color: var(--border-color, #45475a);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .bookmark-item.pinned {
    border-left: 3px solid var(--accent-color, #cba6f7);
  }

  .bookmarks-list.grid .bookmark-item {
    margin-bottom: 0;
  }

  .bookmarks-list.compact .bookmark-item {
    padding: 10px 14px;
  }

  .bookmark-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-color, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .author-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
  }

  .bookmark-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .bookmark-item:hover .bookmark-actions {
    opacity: 1;
  }

  .action-btn {
    background: transparent;
    border: none;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-tertiary, #45475a);
    color: var(--text-primary, #cdd6f4);
  }

  .action-btn.active {
    color: #f9e2af;
  }

  .action-btn.delete:hover {
    color: #f38ba8;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .bookmark-content {
    cursor: pointer;
  }

  .bookmark-content p {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary, #cdd6f4);
    line-height: 1.5;
  }

  .bookmark-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 10px;
    padding: 8px 10px;
    background: var(--bg-tertiary, #45475a);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
  }

  .bookmark-note svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .bookmark-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .tag {
    background: var(--bg-tertiary, #45475a);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .bookmark-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .channel {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .channel svg {
    width: 12px;
    height: 12px;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .modal {
    background: var(--bg-primary, #1e1e2e);
    border-radius: 12px;
    padding: 24px;
    width: 360px;
    max-width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal h3 {
    margin: 0 0 20px;
    font-size: 18px;
    color: var(--text-primary, #cdd6f4);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #a6adc8);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-secondary, #313244);
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-primary, #cdd6f4);
    font-size: 14px;
    outline: none;
    resize: vertical;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    border-color: var(--accent-color, #cba6f7);
  }

  .icon-picker,
  .color-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .icon-option {
    width: 36px;
    height: 36px;
    background: var(--bg-secondary, #313244);
    border: 2px solid transparent;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-option:hover {
    background: var(--bg-tertiary, #45475a);
  }

  .icon-option.selected {
    border-color: var(--accent-color, #cba6f7);
  }

  .color-option {
    width: 28px;
    height: 28px;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--bg-primary, #1e1e2e);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: var(--bg-secondary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary, #45475a);
  }

  .btn-primary {
    background: var(--accent-color, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
