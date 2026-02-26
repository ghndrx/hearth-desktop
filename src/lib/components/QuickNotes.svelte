<script lang="ts">
  import { onMount } from 'svelte';
  import { Store } from '@tauri-apps/plugin-store';
  
  interface Note {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    pinned: boolean;
    color: string;
  }
  
  let notes = $state<Note[]>([]);
  let newNoteContent = $state('');
  let editingNoteId = $state<string | null>(null);
  let editContent = $state('');
  let isExpanded = $state(false);
  let searchQuery = $state('');
  let selectedColor = $state('#1e1e2e');
  let store: Store | null = null;
  
  const colors = [
    { name: 'Default', value: '#1e1e2e' },
    { name: 'Red', value: '#3b1d1d' },
    { name: 'Orange', value: '#3b2d1d' },
    { name: 'Yellow', value: '#3b3b1d' },
    { name: 'Green', value: '#1d3b2d' },
    { name: 'Blue', value: '#1d2d3b' },
    { name: 'Purple', value: '#2d1d3b' },
  ];
  
  const filteredNotes = $derived(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.content.toLowerCase().includes(query)
    );
  });
  
  const sortedNotes = $derived(() => {
    return [...filteredNotes()].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  });
  
  onMount(async () => {
    store = new Store('quick-notes.json');
    await loadNotes();
  });
  
  async function loadNotes() {
    if (!store) return;
    const saved = await store.get<Note[]>('notes');
    if (saved) {
      notes = saved;
    }
  }
  
  async function saveNotes() {
    if (!store) return;
    await store.set('notes', notes);
    await store.save();
  }
  
  function generateId(): string {
    return crypto.randomUUID();
  }
  
  async function addNote() {
    if (!newNoteContent.trim()) return;
    
    const note: Note = {
      id: generateId(),
      content: newNoteContent.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      color: selectedColor,
    };
    
    notes = [note, ...notes];
    newNoteContent = '';
    selectedColor = '#1e1e2e';
    await saveNotes();
  }
  
  function startEditing(note: Note) {
    editingNoteId = note.id;
    editContent = note.content;
  }
  
  async function saveEdit() {
    if (!editingNoteId) return;
    
    notes = notes.map(note => 
      note.id === editingNoteId 
        ? { ...note, content: editContent.trim(), updatedAt: new Date().toISOString() }
        : note
    );
    
    editingNoteId = null;
    editContent = '';
    await saveNotes();
  }
  
  function cancelEdit() {
    editingNoteId = null;
    editContent = '';
  }
  
  async function deleteNote(id: string) {
    notes = notes.filter(note => note.id !== id);
    await saveNotes();
  }
  
  async function togglePin(id: string) {
    notes = notes.map(note => 
      note.id === id 
        ? { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() }
        : note
    );
    await saveNotes();
  }
  
  async function updateNoteColor(id: string, color: string) {
    notes = notes.map(note => 
      note.id === id 
        ? { ...note, color, updatedAt: new Date().toISOString() }
        : note
    );
    await saveNotes();
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      if (editingNoteId) {
        saveEdit();
      } else {
        addNote();
      }
    }
    if (event.key === 'Escape') {
      if (editingNoteId) {
        cancelEdit();
      }
    }
  }
</script>

<div class="quick-notes" class:expanded={isExpanded}>
  <button 
    class="toggle-button"
    onclick={() => isExpanded = !isExpanded}
    title={isExpanded ? 'Collapse notes' : 'Expand notes'}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
    {#if !isExpanded}
      <span class="note-count">{notes.length}</span>
    {/if}
  </button>
  
  {#if isExpanded}
    <div class="notes-panel">
      <div class="panel-header">
        <h3>Quick Notes</h3>
        <span class="count">{notes.length} notes</span>
      </div>
      
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search notes..."
          bind:value={searchQuery}
        />
      </div>
      
      <div class="new-note">
        <textarea
          placeholder="Write a quick note... (Ctrl+Enter to save)"
          bind:value={newNoteContent}
          onkeydown={handleKeydown}
          rows="3"
        ></textarea>
        <div class="note-actions">
          <div class="color-picker">
            {#each colors as color}
              <button
                class="color-swatch"
                class:selected={selectedColor === color.value}
                style="background-color: {color.value}"
                onclick={() => selectedColor = color.value}
                title={color.name}
              ></button>
            {/each}
          </div>
          <button class="add-btn" onclick={addNote} disabled={!newNoteContent.trim()}>
            Add Note
          </button>
        </div>
      </div>
      
      <div class="notes-list">
        {#each sortedNotes() as note (note.id)}
          <div 
            class="note-card"
            class:pinned={note.pinned}
            style="background-color: {note.color}"
          >
            {#if editingNoteId === note.id}
              <textarea
                bind:value={editContent}
                onkeydown={handleKeydown}
                rows="4"
                class="edit-textarea"
              ></textarea>
              <div class="edit-actions">
                <button class="save-btn" onclick={saveEdit}>Save</button>
                <button class="cancel-btn" onclick={cancelEdit}>Cancel</button>
              </div>
            {:else}
              <div class="note-content">
                {note.content}
              </div>
              <div class="note-footer">
                <span class="note-date">{formatDate(note.updatedAt)}</span>
                <div class="note-buttons">
                  <button 
                    class="icon-btn"
                    class:active={note.pinned}
                    onclick={() => togglePin(note.id)}
                    title={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                      <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
                    </svg>
                  </button>
                  <div class="color-dropdown">
                    <button class="icon-btn" title="Change color">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
                      </svg>
                    </button>
                    <div class="dropdown-content">
                      {#each colors as color}
                        <button
                          class="color-option"
                          style="background-color: {color.value}"
                          onclick={() => updateNoteColor(note.id, color.value)}
                          title={color.name}
                        ></button>
                      {/each}
                    </div>
                  </div>
                  <button 
                    class="icon-btn"
                    onclick={() => startEditing(note)}
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                  </button>
                  <button 
                    class="icon-btn delete"
                    onclick={() => deleteNote(note.id)}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
        
        {#if sortedNotes().length === 0}
          <div class="empty-state">
            {#if searchQuery}
              <p>No notes match your search</p>
            {:else}
              <p>No notes yet</p>
              <p class="hint">Write your first note above!</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .quick-notes {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 1000;
  }
  
  .toggle-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #5865f2;
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s, background 0.2s;
    position: relative;
  }
  
  .toggle-button:hover {
    background: #4752c4;
    transform: scale(1.05);
  }
  
  .note-count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ed4245;
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
  
  .notes-panel {
    position: absolute;
    bottom: 60px;
    right: 0;
    width: 320px;
    max-height: 480px;
    background: #2b2d31;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #3f4147;
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f2f3f5;
  }
  
  .count {
    font-size: 12px;
    color: #b5bac1;
  }
  
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #1e1f22;
    margin: 8px 16px;
    border-radius: 6px;
  }
  
  .search-bar svg {
    color: #b5bac1;
    flex-shrink: 0;
  }
  
  .search-bar input {
    flex: 1;
    background: none;
    border: none;
    color: #f2f3f5;
    font-size: 14px;
    outline: none;
  }
  
  .search-bar input::placeholder {
    color: #6d6f78;
  }
  
  .new-note {
    padding: 0 16px 16px;
  }
  
  .new-note textarea {
    width: 100%;
    background: #1e1f22;
    border: 1px solid #3f4147;
    border-radius: 8px;
    color: #f2f3f5;
    font-size: 14px;
    padding: 12px;
    resize: none;
    outline: none;
    font-family: inherit;
  }
  
  .new-note textarea:focus {
    border-color: #5865f2;
  }
  
  .note-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  
  .color-picker {
    display: flex;
    gap: 4px;
  }
  
  .color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s;
  }
  
  .color-swatch:hover {
    transform: scale(1.1);
  }
  
  .color-swatch.selected {
    border-color: #5865f2;
  }
  
  .add-btn {
    background: #5865f2;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .add-btn:hover:not(:disabled) {
    background: #4752c4;
  }
  
  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .notes-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .note-card {
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #3f4147;
    transition: border-color 0.2s;
  }
  
  .note-card:hover {
    border-color: #5865f2;
  }
  
  .note-card.pinned {
    border-color: #faa81a;
  }
  
  .note-content {
    color: #f2f3f5;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .note-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .note-date {
    font-size: 11px;
    color: #b5bac1;
  }
  
  .note-buttons {
    display: flex;
    gap: 4px;
  }
  
  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #b5bac1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f2f3f5;
  }
  
  .icon-btn.active {
    color: #faa81a;
  }
  
  .icon-btn.delete:hover {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }
  
  .color-dropdown {
    position: relative;
  }
  
  .dropdown-content {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1e1f22;
    border-radius: 8px;
    padding: 8px;
    gap: 4px;
    flex-wrap: wrap;
    width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    margin-bottom: 4px;
  }
  
  .color-dropdown:hover .dropdown-content {
    display: flex;
  }
  
  .color-option {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: transform 0.15s;
  }
  
  .color-option:hover {
    transform: scale(1.1);
  }
  
  .edit-textarea {
    width: 100%;
    background: #1e1f22;
    border: 1px solid #5865f2;
    border-radius: 6px;
    color: #f2f3f5;
    font-size: 14px;
    padding: 8px;
    resize: none;
    outline: none;
    font-family: inherit;
  }
  
  .edit-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  
  .save-btn, .cancel-btn {
    flex: 1;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
  }
  
  .save-btn {
    background: #5865f2;
    color: white;
  }
  
  .save-btn:hover {
    background: #4752c4;
  }
  
  .cancel-btn {
    background: #4e5058;
    color: #f2f3f5;
  }
  
  .cancel-btn:hover {
    background: #6d6f78;
  }
  
  .empty-state {
    text-align: center;
    padding: 24px;
    color: #b5bac1;
  }
  
  .empty-state p {
    margin: 0;
  }
  
  .empty-state .hint {
    font-size: 13px;
    margin-top: 4px;
    color: #6d6f78;
  }
</style>
