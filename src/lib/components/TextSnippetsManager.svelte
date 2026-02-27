<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, get } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

  // Types
  interface TextSnippet {
    id: string;
    trigger: string;
    content: string;
    category: string;
    description: string;
    usageCount: number;
    lastUsed: number | null;
    createdAt: number;
    variables: SnippetVariable[];
    isEnabled: boolean;
  }

  interface SnippetVariable {
    name: string;
    type: 'text' | 'date' | 'time' | 'datetime' | 'clipboard' | 'cursor';
    format?: string;
    defaultValue?: string;
  }

  interface SnippetCategory {
    id: string;
    name: string;
    color: string;
    icon: string;
  }

  // Props
  export let triggerPrefix: string = ';';
  export let autoExpand: boolean = true;
  export let showNotificationOnExpand: boolean = false;
  export let preserveFormatting: boolean = true;

  const dispatch = createEventDispatcher();

  // Stores
  const snippets = writable<TextSnippet[]>([]);
  const categories = writable<SnippetCategory[]>([
    { id: 'general', name: 'General', color: '#6366f1', icon: '📝' },
    { id: 'email', name: 'Email', color: '#10b981', icon: '📧' },
    { id: 'code', name: 'Code', color: '#f59e0b', icon: '💻' },
    { id: 'personal', name: 'Personal', color: '#ec4899', icon: '👤' },
  ]);
  const searchQuery = writable('');
  const selectedCategory = writable<string | null>(null);
  const editingSnippet = writable<TextSnippet | null>(null);
  const isCreating = writable(false);
  const typingBuffer = writable('');
  const lastExpansion = writable<{ trigger: string; content: string; time: number } | null>(null);

  // Filtered snippets
  const filteredSnippets = derived(
    [snippets, searchQuery, selectedCategory],
    ([$snippets, $searchQuery, $selectedCategory]) => {
      let result = $snippets.filter((s) => s.isEnabled);

      if ($selectedCategory) {
        result = result.filter((s) => s.category === $selectedCategory);
      }

      if ($searchQuery) {
        const query = $searchQuery.toLowerCase();
        result = result.filter(
          (s) =>
            s.trigger.toLowerCase().includes(query) ||
            s.content.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query)
        );
      }

      return result.sort((a, b) => b.usageCount - a.usageCount);
    }
  );

  // Stats
  const stats = derived(snippets, ($snippets) => ({
    total: $snippets.length,
    enabled: $snippets.filter((s) => s.isEnabled).length,
    totalUsage: $snippets.reduce((sum, s) => sum + s.usageCount, 0),
    mostUsed: [...$snippets].sort((a, b) => b.usageCount - a.usageCount)[0] || null,
  }));

  // Generate unique ID
  function generateId(): string {
    return `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Process variables in content
  function processVariables(content: string, variables: SnippetVariable[]): string {
    let processed = content;

    for (const variable of variables) {
      const placeholder = `{{${variable.name}}}`;
      let replacement = '';

      switch (variable.type) {
        case 'date':
          replacement = new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          break;
        case 'time':
          replacement = new Date().toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          });
          break;
        case 'datetime':
          replacement = new Date().toLocaleString();
          break;
        case 'clipboard':
          // Clipboard content would be injected by Tauri
          replacement = variable.defaultValue || '';
          break;
        case 'cursor':
          replacement = '|CURSOR|';
          break;
        default:
          replacement = variable.defaultValue || '';
      }

      processed = processed.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return processed;
  }

  // Expand a snippet
  async function expandSnippet(snippet: TextSnippet): Promise<void> {
    const expandedContent = processVariables(snippet.content, snippet.variables);

    try {
      // Use Tauri to type the expanded text
      await invoke('type_text', {
        text: expandedContent,
        preserveFormatting,
      });

      // Update usage stats
      snippets.update((items) =>
        items.map((s) =>
          s.id === snippet.id
            ? { ...s, usageCount: s.usageCount + 1, lastUsed: Date.now() }
            : s
        )
      );

      lastExpansion.set({
        trigger: snippet.trigger,
        content: expandedContent,
        time: Date.now(),
      });

      if (showNotificationOnExpand) {
        dispatch('notification', {
          title: 'Snippet Expanded',
          body: `"${snippet.trigger}" → ${expandedContent.substring(0, 50)}...`,
        });
      }

      dispatch('expand', { snippet, expandedContent });
      await saveSnippets();
    } catch (error) {
      console.error('Failed to expand snippet:', error);
      dispatch('error', { message: 'Failed to expand snippet', error });
    }
  }

  // Handle keyboard input for trigger detection
  async function handleKeyboardInput(key: string): Promise<void> {
    if (!autoExpand) return;

    const buffer = get(typingBuffer);
    const newBuffer = buffer + key;

    // Reset buffer if it gets too long
    if (newBuffer.length > 50) {
      typingBuffer.set(key);
      return;
    }

    typingBuffer.set(newBuffer);

    // Check for trigger matches
    const allSnippets = get(snippets);
    for (const snippet of allSnippets) {
      if (!snippet.isEnabled) continue;

      const fullTrigger = triggerPrefix + snippet.trigger;
      if (newBuffer.endsWith(fullTrigger)) {
        // Delete the trigger text first
        const deleteCount = fullTrigger.length;
        await invoke('delete_chars', { count: deleteCount });

        // Expand the snippet
        await expandSnippet(snippet);
        typingBuffer.set('');
        return;
      }
    }

    // Reset buffer on space or enter
    if (key === ' ' || key === '\n') {
      typingBuffer.set('');
    }
  }

  // Create a new snippet
  function createSnippet(data: Partial<TextSnippet>): TextSnippet {
    const newSnippet: TextSnippet = {
      id: generateId(),
      trigger: data.trigger || '',
      content: data.content || '',
      category: data.category || 'general',
      description: data.description || '',
      usageCount: 0,
      lastUsed: null,
      createdAt: Date.now(),
      variables: data.variables || [],
      isEnabled: true,
    };

    snippets.update((items) => [...items, newSnippet]);
    dispatch('create', { snippet: newSnippet });
    saveSnippets();

    return newSnippet;
  }

  // Update a snippet
  function updateSnippet(id: string, updates: Partial<TextSnippet>): void {
    snippets.update((items) =>
      items.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    dispatch('update', { id, updates });
    saveSnippets();
  }

  // Delete a snippet
  function deleteSnippet(id: string): void {
    snippets.update((items) => items.filter((s) => s.id !== id));
    dispatch('delete', { id });
    saveSnippets();
  }

  // Toggle snippet enabled state
  function toggleSnippet(id: string): void {
    snippets.update((items) =>
      items.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s))
    );
    saveSnippets();
  }

  // Duplicate a snippet
  function duplicateSnippet(snippet: TextSnippet): void {
    createSnippet({
      ...snippet,
      trigger: snippet.trigger + '_copy',
      description: `Copy of ${snippet.description}`,
    });
  }

  // Import snippets from JSON
  async function importSnippets(jsonString: string): Promise<number> {
    try {
      const imported = JSON.parse(jsonString) as TextSnippet[];
      let count = 0;

      snippets.update((items) => {
        const existingTriggers = new Set(items.map((s) => s.trigger));
        const newSnippets = imported
          .filter((s) => !existingTriggers.has(s.trigger))
          .map((s) => ({
            ...s,
            id: generateId(),
            usageCount: 0,
            lastUsed: null,
            createdAt: Date.now(),
          }));

        count = newSnippets.length;
        return [...items, ...newSnippets];
      });

      await saveSnippets();
      dispatch('import', { count });
      return count;
    } catch (error) {
      dispatch('error', { message: 'Failed to import snippets', error });
      return 0;
    }
  }

  // Export snippets to JSON
  function exportSnippets(): string {
    const currentSnippets = get(snippets);
    return JSON.stringify(currentSnippets, null, 2);
  }

  // Create category
  function createCategory(data: Omit<SnippetCategory, 'id'>): void {
    const newCategory: SnippetCategory = {
      id: `category-${Date.now()}`,
      ...data,
    };
    categories.update((items) => [...items, newCategory]);
    saveCategories();
  }

  // Save snippets to storage
  async function saveSnippets(): Promise<void> {
    try {
      const data = get(snippets);
      await invoke('store_set', {
        key: 'text_snippets',
        value: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to save snippets:', error);
    }
  }

  // Save categories to storage
  async function saveCategories(): Promise<void> {
    try {
      const data = get(categories);
      await invoke('store_set', {
        key: 'snippet_categories',
        value: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to save categories:', error);
    }
  }

  // Load snippets from storage
  async function loadSnippets(): Promise<void> {
    try {
      const stored = await invoke<string | null>('store_get', {
        key: 'text_snippets',
      });
      if (stored) {
        snippets.set(JSON.parse(stored));
      } else {
        // Initialize with default snippets
        snippets.set([
          {
            id: generateId(),
            trigger: 'sig',
            content: 'Best regards,\n{{name}}\n{{email}}',
            category: 'email',
            description: 'Email signature',
            usageCount: 0,
            lastUsed: null,
            createdAt: Date.now(),
            variables: [
              { name: 'name', type: 'text', defaultValue: 'Your Name' },
              { name: 'email', type: 'text', defaultValue: 'your@email.com' },
            ],
            isEnabled: true,
          },
          {
            id: generateId(),
            trigger: 'today',
            content: '{{date}}',
            category: 'general',
            description: "Insert today's date",
            usageCount: 0,
            lastUsed: null,
            createdAt: Date.now(),
            variables: [{ name: 'date', type: 'date' }],
            isEnabled: true,
          },
          {
            id: generateId(),
            trigger: 'now',
            content: '{{datetime}}',
            category: 'general',
            description: 'Insert current date and time',
            usageCount: 0,
            lastUsed: null,
            createdAt: Date.now(),
            variables: [{ name: 'datetime', type: 'datetime' }],
            isEnabled: true,
          },
          {
            id: generateId(),
            trigger: 'omw',
            content: "On my way! Be there in about 10 minutes. 🚗",
            category: 'personal',
            description: 'On my way message',
            usageCount: 0,
            lastUsed: null,
            createdAt: Date.now(),
            variables: [],
            isEnabled: true,
          },
        ]);
        await saveSnippets();
      }
    } catch (error) {
      console.error('Failed to load snippets:', error);
    }
  }

  // Load categories from storage
  async function loadCategories(): Promise<void> {
    try {
      const stored = await invoke<string | null>('store_get', {
        key: 'snippet_categories',
      });
      if (stored) {
        categories.set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  // Register global keyboard listener
  async function setupKeyboardListener(): Promise<void> {
    try {
      await invoke('register_keyboard_listener', {
        callback: 'text_snippets_input',
      });
    } catch (error) {
      console.error('Failed to register keyboard listener:', error);
    }
  }

  // Cleanup keyboard listener
  async function cleanupKeyboardListener(): Promise<void> {
    try {
      await invoke('unregister_keyboard_listener', {
        callback: 'text_snippets_input',
      });
    } catch (error) {
      console.error('Failed to unregister keyboard listener:', error);
    }
  }

  // Format date for display
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Lifecycle
  onMount(async () => {
    await loadSnippets();
    await loadCategories();
    if (autoExpand) {
      await setupKeyboardListener();
    }
    dispatch('ready');
  });

  onDestroy(async () => {
    await cleanupKeyboardListener();
  });

  // Form state for creating/editing
  let formTrigger = '';
  let formContent = '';
  let formCategory = 'general';
  let formDescription = '';
  let formVariables: SnippetVariable[] = [];

  function openCreateModal(): void {
    formTrigger = '';
    formContent = '';
    formCategory = 'general';
    formDescription = '';
    formVariables = [];
    isCreating.set(true);
    editingSnippet.set(null);
  }

  function openEditModal(snippet: TextSnippet): void {
    formTrigger = snippet.trigger;
    formContent = snippet.content;
    formCategory = snippet.category;
    formDescription = snippet.description;
    formVariables = [...snippet.variables];
    editingSnippet.set(snippet);
    isCreating.set(false);
  }

  function closeModal(): void {
    editingSnippet.set(null);
    isCreating.set(false);
  }

  function handleSubmit(): void {
    const editing = get(editingSnippet);

    if (editing) {
      updateSnippet(editing.id, {
        trigger: formTrigger,
        content: formContent,
        category: formCategory,
        description: formDescription,
        variables: formVariables,
      });
    } else {
      createSnippet({
        trigger: formTrigger,
        content: formContent,
        category: formCategory,
        description: formDescription,
        variables: formVariables,
      });
    }

    closeModal();
  }

  function addVariable(): void {
    formVariables = [
      ...formVariables,
      { name: `var${formVariables.length + 1}`, type: 'text', defaultValue: '' },
    ];
  }

  function removeVariable(index: number): void {
    formVariables = formVariables.filter((_, i) => i !== index);
  }
</script>

<div class="text-snippets-manager">
  <header class="manager-header">
    <div class="header-info">
      <h2>Text Snippets</h2>
      <p class="description">
        Create text shortcuts that expand automatically. Type <code>{triggerPrefix}</code> followed by your trigger.
      </p>
    </div>
    <button class="create-button" on:click={openCreateModal}>
      <span class="icon">+</span>
      New Snippet
    </button>
  </header>

  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">{$stats.total}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat">
      <span class="stat-value">{$stats.enabled}</span>
      <span class="stat-label">Active</span>
    </div>
    <div class="stat">
      <span class="stat-value">{$stats.totalUsage}</span>
      <span class="stat-label">Expansions</span>
    </div>
    {#if $stats.mostUsed}
      <div class="stat highlight">
        <span class="stat-value">{triggerPrefix}{$stats.mostUsed.trigger}</span>
        <span class="stat-label">Most Used</span>
      </div>
    {/if}
  </div>

  <div class="filters">
    <input
      type="text"
      class="search-input"
      placeholder="Search snippets..."
      bind:value={$searchQuery}
    />
    <div class="category-filters">
      <button
        class="category-chip"
        class:active={$selectedCategory === null}
        on:click={() => selectedCategory.set(null)}
      >
        All
      </button>
      {#each $categories as category}
        <button
          class="category-chip"
          class:active={$selectedCategory === category.id}
          style="--category-color: {category.color}"
          on:click={() => selectedCategory.set(category.id)}
        >
          <span class="category-icon">{category.icon}</span>
          {category.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="snippets-list">
    {#if $filteredSnippets.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <p>No snippets found</p>
        <button class="create-link" on:click={openCreateModal}>Create your first snippet</button>
      </div>
    {:else}
      {#each $filteredSnippets as snippet (snippet.id)}
        <div class="snippet-card" class:disabled={!snippet.isEnabled}>
          <div class="snippet-header">
            <div class="trigger-badge">
              <code>{triggerPrefix}{snippet.trigger}</code>
            </div>
            <div class="snippet-actions">
              <button
                class="action-button"
                title={snippet.isEnabled ? 'Disable' : 'Enable'}
                on:click={() => toggleSnippet(snippet.id)}
              >
                {snippet.isEnabled ? '✓' : '○'}
              </button>
              <button
                class="action-button"
                title="Edit"
                on:click={() => openEditModal(snippet)}
              >
                ✏️
              </button>
              <button
                class="action-button"
                title="Duplicate"
                on:click={() => duplicateSnippet(snippet)}
              >
                📋
              </button>
              <button
                class="action-button danger"
                title="Delete"
                on:click={() => deleteSnippet(snippet.id)}
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="snippet-content">
            <pre>{snippet.content}</pre>
          </div>

          <div class="snippet-meta">
            {#if snippet.description}
              <span class="meta-description">{snippet.description}</span>
            {/if}
            <span class="meta-stats">
              Used {snippet.usageCount} time{snippet.usageCount !== 1 ? 's' : ''}
              {#if snippet.lastUsed}
                · Last: {formatDate(snippet.lastUsed)}
              {/if}
            </span>
          </div>

          {#if snippet.variables.length > 0}
            <div class="snippet-variables">
              {#each snippet.variables as variable}
                <span class="variable-tag" title={`Type: ${variable.type}`}>
                  {`{{${variable.name}}}`}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if $lastExpansion}
    <div class="expansion-toast" class:visible={Date.now() - $lastExpansion.time < 3000}>
      <span class="toast-icon">✨</span>
      <span class="toast-text">
        Expanded <code>{triggerPrefix}{$lastExpansion.trigger}</code>
      </span>
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if $isCreating || $editingSnippet}
  <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
      <header class="modal-header">
        <h3>{$editingSnippet ? 'Edit Snippet' : 'Create Snippet'}</h3>
        <button class="close-button" on:click={closeModal}>×</button>
      </header>

      <form class="modal-body" on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
          <label for="trigger">Trigger</label>
          <div class="trigger-input-wrapper">
            <span class="trigger-prefix">{triggerPrefix}</span>
            <input
              id="trigger"
              type="text"
              bind:value={formTrigger}
              placeholder="e.g., sig, addr, ty"
              required
              pattern="[a-zA-Z0-9_-]+"
            />
          </div>
          <span class="form-hint">Letters, numbers, hyphens, and underscores only</span>
        </div>

        <div class="form-group">
          <label for="content">Content</label>
          <textarea
            id="content"
            bind:value={formContent}
            placeholder="The text that will be inserted..."
            rows="4"
            required
          ></textarea>
          <span class="form-hint">Use {`{{variableName}}`} for dynamic content</span>
        </div>

        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" bind:value={formCategory}>
            {#each $categories as category}
              <option value={category.id}>
                {category.icon} {category.name}
              </option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="description">Description (optional)</label>
          <input
            id="description"
            type="text"
            bind:value={formDescription}
            placeholder="What this snippet is for..."
          />
        </div>

        <div class="form-group">
          <label>Variables</label>
          <div class="variables-list">
            {#each formVariables as variable, index}
              <div class="variable-row">
                <input
                  type="text"
                  bind:value={variable.name}
                  placeholder="Name"
                  class="variable-name"
                />
                <select bind:value={variable.type} class="variable-type">
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="time">Time</option>
                  <option value="datetime">DateTime</option>
                  <option value="clipboard">Clipboard</option>
                  <option value="cursor">Cursor Position</option>
                </select>
                {#if variable.type === 'text'}
                  <input
                    type="text"
                    bind:value={variable.defaultValue}
                    placeholder="Default"
                    class="variable-default"
                  />
                {/if}
                <button
                  type="button"
                  class="remove-variable"
                  on:click={() => removeVariable(index)}
                >
                  ×
                </button>
              </div>
            {/each}
            <button type="button" class="add-variable" on:click={addVariable}>
              + Add Variable
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="cancel-button" on:click={closeModal}>
            Cancel
          </button>
          <button type="submit" class="save-button">
            {$editingSnippet ? 'Save Changes' : 'Create Snippet'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .text-snippets-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #e4e4e7);
    font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  }

  .manager-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .header-info h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .description {
    margin: 0;
    color: var(--text-secondary, #a1a1aa);
    font-size: 0.875rem;
  }

  .description code {
    background: var(--bg-tertiary, #2d2d44);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .create-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--accent-primary, #6366f1);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .create-button:hover {
    background: var(--accent-primary-hover, #4f46e5);
  }

  .create-button .icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .stats-bar {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: var(--bg-secondary, #232340);
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #e4e4e7);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #a1a1aa);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat.highlight .stat-value {
    color: var(--accent-primary, #6366f1);
    font-family: monospace;
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 1rem;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 8px;
    color: var(--text-primary, #e4e4e7);
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-primary, #6366f1);
  }

  .category-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .category-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 20px;
    color: var(--text-secondary, #a1a1aa);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-chip:hover {
    border-color: var(--category-color, var(--accent-primary, #6366f1));
    color: var(--text-primary, #e4e4e7);
  }

  .category-chip.active {
    background: var(--category-color, var(--accent-primary, #6366f1));
    border-color: var(--category-color, var(--accent-primary, #6366f1));
    color: white;
  }

  .category-icon {
    font-size: 1rem;
  }

  .snippets-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--text-secondary, #a1a1aa);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .create-link {
    margin-top: 0.5rem;
    background: none;
    border: none;
    color: var(--accent-primary, #6366f1);
    cursor: pointer;
    text-decoration: underline;
  }

  .snippet-card {
    background: var(--bg-secondary, #232340);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 12px;
    padding: 1rem;
    transition: border-color 0.2s;
  }

  .snippet-card:hover {
    border-color: var(--accent-primary, #6366f1);
  }

  .snippet-card.disabled {
    opacity: 0.5;
  }

  .snippet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .trigger-badge {
    display: inline-flex;
  }

  .trigger-badge code {
    background: var(--accent-primary, #6366f1);
    color: white;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .snippet-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-button {
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s;
  }

  .action-button:hover {
    background: var(--bg-tertiary, #2d2d44);
    opacity: 1;
  }

  .action-button.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .snippet-content {
    margin-bottom: 0.75rem;
  }

  .snippet-content pre {
    margin: 0;
    padding: 0.75rem;
    background: var(--bg-primary, #1a1a2e);
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.8125rem;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-primary, #e4e4e7);
    max-height: 100px;
    overflow-y: auto;
  }

  .snippet-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #a1a1aa);
  }

  .snippet-variables {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #2d2d44);
  }

  .variable-tag {
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary, #2d2d44);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--accent-secondary, #10b981);
  }

  .expansion-toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--accent-primary, #6366f1);
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .expansion-toast.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .toast-text code {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  /* Modal Styles */
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
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    background: var(--bg-primary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #2d2d44);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .close-button {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary, #a1a1aa);
    font-size: 1.5rem;
    cursor: pointer;
    border-radius: 8px;
  }

  .close-button:hover {
    background: var(--bg-tertiary, #2d2d44);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #e4e4e7);
  }

  .trigger-input-wrapper {
    display: flex;
    align-items: stretch;
  }

  .trigger-prefix {
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    background: var(--accent-primary, #6366f1);
    color: white;
    border-radius: 8px 0 0 8px;
    font-family: monospace;
    font-weight: 500;
  }

  .trigger-input-wrapper input {
    flex: 1;
    padding: 0.625rem 1rem;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-left: none;
    border-radius: 0 8px 8px 0;
    color: var(--text-primary, #e4e4e7);
    font-family: monospace;
    font-size: 0.875rem;
  }

  .form-group input:not(.trigger-input-wrapper input),
  .form-group select,
  .form-group textarea {
    padding: 0.625rem 1rem;
    background: var(--bg-tertiary, #2d2d44);
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 8px;
    color: var(--text-primary, #e4e4e7);
    font-size: 0.875rem;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
    font-family: monospace;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent-primary, #6366f1);
  }

  .form-hint {
    font-size: 0.75rem;
    color: var(--text-secondary, #a1a1aa);
  }

  .variables-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variable-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .variable-name {
    flex: 1;
    min-width: 0;
  }

  .variable-type {
    width: 120px;
  }

  .variable-default {
    flex: 1;
    min-width: 0;
  }

  .remove-variable {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary, #a1a1aa);
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: 6px;
  }

  .remove-variable:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .add-variable {
    padding: 0.5rem;
    background: transparent;
    border: 1px dashed var(--border-color, #3d3d54);
    border-radius: 8px;
    color: var(--text-secondary, #a1a1aa);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-variable:hover {
    border-color: var(--accent-primary, #6366f1);
    color: var(--accent-primary, #6366f1);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .cancel-button {
    padding: 0.625rem 1.25rem;
    background: transparent;
    border: 1px solid var(--border-color, #3d3d54);
    border-radius: 8px;
    color: var(--text-secondary, #a1a1aa);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .cancel-button:hover {
    border-color: var(--text-secondary, #a1a1aa);
    color: var(--text-primary, #e4e4e7);
  }

  .save-button {
    padding: 0.625rem 1.25rem;
    background: var(--accent-primary, #6366f1);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .save-button:hover {
    background: var(--accent-primary-hover, #4f46e5);
  }
</style>
