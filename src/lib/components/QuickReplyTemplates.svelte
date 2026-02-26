<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';

  interface ReplyTemplate {
    id: string;
    name: string;
    content: string;
    shortcut?: string;
    category: string;
    usageCount: number;
    lastUsed?: string;
    createdAt: string;
  }

  interface TemplateCategory {
    id: string;
    name: string;
    color: string;
  }

  export let onInsert: ((content: string) => void) | undefined = undefined;
  export let compact = false;

  const templates = writable<ReplyTemplate[]>([]);
  const categories = writable<TemplateCategory[]>([
    { id: 'general', name: 'General', color: '#6366f1' },
    { id: 'greetings', name: 'Greetings', color: '#22c55e' },
    { id: 'support', name: 'Support', color: '#f59e0b' },
    { id: 'farewells', name: 'Farewells', color: '#ec4899' }
  ]);

  let searchQuery = '';
  let selectedCategory = 'all';
  let editingTemplate: ReplyTemplate | null = null;
  let showAddModal = false;
  let newTemplate: Partial<ReplyTemplate> = {
    name: '',
    content: '',
    shortcut: '',
    category: 'general'
  };

  const STORAGE_KEY = 'quick-reply-templates';

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    try {
      const stored = await invoke<string>('plugin:store|get', {
        key: STORAGE_KEY
      }).catch(() => null);

      if (stored) {
        const parsed = JSON.parse(stored);
        templates.set(parsed.templates || []);
        if (parsed.categories) {
          categories.set(parsed.categories);
        }
      } else {
        // Load default templates
        templates.set(getDefaultTemplates());
        await saveTemplates();
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      templates.set(getDefaultTemplates());
    }
  }

  async function saveTemplates() {
    try {
      const data = JSON.stringify({
        templates: $templates,
        categories: $categories
      });
      await invoke('plugin:store|set', {
        key: STORAGE_KEY,
        value: data
      });
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }

  function getDefaultTemplates(): ReplyTemplate[] {
    return [
      {
        id: crypto.randomUUID(),
        name: 'Welcome',
        content: 'Welcome to the server! Feel free to introduce yourself and check out our rules channel.',
        shortcut: '/welcome',
        category: 'greetings',
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'BRB',
        content: 'Be right back! 🚶',
        shortcut: '/brb',
        category: 'general',
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Thanks',
        content: 'Thank you so much! I really appreciate it. 🙏',
        shortcut: '/thanks',
        category: 'general',
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Good night',
        content: 'Good night everyone! See you tomorrow! 🌙',
        shortcut: '/gn',
        category: 'farewells',
        usageCount: 0,
        createdAt: new Date().toISOString()
      }
    ];
  }

  function generateId(): string {
    return crypto.randomUUID();
  }

  $: filteredTemplates = $templates.filter(t => {
    const matchesSearch = searchQuery === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.shortcut && t.shortcut.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  $: sortedTemplates = [...filteredTemplates].sort((a, b) => b.usageCount - a.usageCount);

  async function insertTemplate(template: ReplyTemplate) {
    // Update usage stats
    templates.update(list =>
      list.map(t =>
        t.id === template.id
          ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date().toISOString() }
          : t
      )
    );
    await saveTemplates();

    if (onInsert) {
      onInsert(template.content);
    } else {
      // Copy to clipboard as fallback
      await navigator.clipboard.writeText(template.content);
    }
  }

  async function addTemplate() {
    if (!newTemplate.name || !newTemplate.content) return;

    const template: ReplyTemplate = {
      id: generateId(),
      name: newTemplate.name,
      content: newTemplate.content,
      shortcut: newTemplate.shortcut || undefined,
      category: newTemplate.category || 'general',
      usageCount: 0,
      createdAt: new Date().toISOString()
    };

    templates.update(list => [...list, template]);
    await saveTemplates();

    newTemplate = { name: '', content: '', shortcut: '', category: 'general' };
    showAddModal = false;
  }

  async function updateTemplate() {
    if (!editingTemplate) return;

    templates.update(list =>
      list.map(t => (t.id === editingTemplate!.id ? editingTemplate! : t))
    );
    await saveTemplates();
    editingTemplate = null;
  }

  async function deleteTemplate(id: string) {
    templates.update(list => list.filter(t => t.id !== id));
    await saveTemplates();
  }

  function getCategoryColor(categoryId: string): string {
    return $categories.find(c => c.id === categoryId)?.color || '#6b7280';
  }

  function getCategoryName(categoryId: string): string {
    return $categories.find(c => c.id === categoryId)?.name || categoryId;
  }

  function handleKeydown(event: KeyboardEvent) {
    // Check for template shortcuts
    if (event.key === '/') {
      const input = event.target as HTMLInputElement;
      if (input?.tagName === 'INPUT' || input?.tagName === 'TEXTAREA') {
        return; // Don't intercept when typing in inputs
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="quick-reply-templates" class:compact>
  <header class="templates-header">
    <h3>Quick Replies</h3>
    <button class="add-btn" on:click={() => (showAddModal = true)} title="Add template">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  </header>

  <div class="search-filter">
    <input
      type="text"
      placeholder="Search templates..."
      bind:value={searchQuery}
      class="search-input"
    />
    <select bind:value={selectedCategory} class="category-filter">
      <option value="all">All Categories</option>
      {#each $categories as category}
        <option value={category.id}>{category.name}</option>
      {/each}
    </select>
  </div>

  <div class="templates-list">
    {#each sortedTemplates as template (template.id)}
      <div class="template-item" on:click={() => insertTemplate(template)} on:keypress={() => insertTemplate(template)} role="button" tabindex="0">
        <div class="template-header">
          <span class="template-name">{template.name}</span>
          <span class="category-badge" style="background-color: {getCategoryColor(template.category)}">
            {getCategoryName(template.category)}
          </span>
        </div>
        <p class="template-preview">{template.content.slice(0, 80)}{template.content.length > 80 ? '...' : ''}</p>
        <div class="template-footer">
          {#if template.shortcut}
            <code class="shortcut">{template.shortcut}</code>
          {/if}
          <span class="usage-count" title="Times used">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {template.usageCount}
          </span>
          <div class="template-actions">
            <button class="action-btn" on:click|stopPropagation={() => (editingTemplate = { ...template })} title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="action-btn delete" on:click|stopPropagation={() => deleteTemplate(template.id)} title="Delete">
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
        <p>No templates found</p>
        <button on:click={() => (showAddModal = true)}>Create your first template</button>
      </div>
    {/each}
  </div>

  {#if $templates.length > 0}
    <div class="templates-stats">
      <span>{$templates.length} templates</span>
      <span>•</span>
      <span>{$templates.reduce((sum, t) => sum + t.usageCount, 0)} total uses</span>
    </div>
  {/if}
</div>

<!-- Add/Edit Modal -->
{#if showAddModal || editingTemplate}
  <div class="modal-overlay" on:click={() => { showAddModal = false; editingTemplate = null; }} on:keypress={() => { showAddModal = false; editingTemplate = null; }} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keypress|stopPropagation role="dialog" aria-modal="true">
      <h3>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
      
      <div class="form-group">
        <label for="template-name">Name</label>
        <input
          id="template-name"
          type="text"
          placeholder="Template name"
          bind:value={editingTemplate ? editingTemplate.name : newTemplate.name}
        />
      </div>

      <div class="form-group">
        <label for="template-content">Content</label>
        <textarea
          id="template-content"
          placeholder="Template content..."
          rows="4"
          bind:value={editingTemplate ? editingTemplate.content : newTemplate.content}
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="template-shortcut">Shortcut (optional)</label>
          <input
            id="template-shortcut"
            type="text"
            placeholder="/shortcut"
            bind:value={editingTemplate ? editingTemplate.shortcut : newTemplate.shortcut}
          />
        </div>

        <div class="form-group">
          <label for="template-category">Category</label>
          <select
            id="template-category"
            bind:value={editingTemplate ? editingTemplate.category : newTemplate.category}
          >
            {#each $categories as category}
              <option value={category.id}>{category.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" on:click={() => { showAddModal = false; editingTemplate = null; }}>
          Cancel
        </button>
        <button class="save-btn" on:click={() => editingTemplate ? updateTemplate() : addTemplate()}>
          {editingTemplate ? 'Save Changes' : 'Add Template'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-reply-templates {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 8px;
    max-height: 500px;
    overflow: hidden;
  }

  .quick-reply-templates.compact {
    padding: 0.5rem;
    max-height: 300px;
  }

  .templates-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .templates-header h3 {
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

  .search-filter {
    display: flex;
    gap: 0.5rem;
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

  .category-filter {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .templates-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .template-item {
    padding: 0.75rem;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .template-item:hover {
    border-color: var(--accent-primary, #6366f1);
    background: var(--bg-hover, #333);
  }

  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .template-name {
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .category-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .template-preview {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary, #aaa);
    line-height: 1.4;
  }

  .template-footer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .shortcut {
    font-size: 0.7rem;
    padding: 0.15rem 0.4rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 4px;
    color: var(--text-muted, #888);
  }

  .usage-count {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-muted, #888);
  }

  .template-actions {
    display: flex;
    gap: 0.25rem;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .template-item:hover .template-actions {
    opacity: 1;
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

  .templates-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted, #888);
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color, #333);
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
    min-height: 80px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
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

  .save-btn {
    background: var(--accent-primary, #6366f1);
    color: white;
  }

  .save-btn:hover {
    background: var(--accent-primary-hover, #4f46e5);
  }
</style>
