<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { Store } from '@tauri-apps/plugin-store';

  interface TextSnippet {
    id: string;
    trigger: string;
    expansion: string;
    description: string;
    category: string;
    variables: string[];
    usageCount: number;
    createdAt: number;
    updatedAt: number;
    enabled: boolean;
  }

  interface TextExpanderSettings {
    enabled: boolean;
    triggerDelay: number;
    caseSensitive: boolean;
    expandInAllFields: boolean;
    soundEnabled: boolean;
    showNotification: boolean;
    requireSpace: boolean;
  }

  // State
  let isOpen = $state(false);
  let searchQuery = $state('');
  let selectedCategory = $state<string>('all');
  let editingSnippet = $state<TextSnippet | null>(null);
  let showCreateForm = $state(false);
  let inputBuffer = $state('');
  let activeInput = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Form state
  let newTrigger = $state('');
  let newExpansion = $state('');
  let newDescription = $state('');
  let newCategory = $state('General');

  // Stores
  const snippets = writable<TextSnippet[]>([]);
  const settings = writable<TextExpanderSettings>({
    enabled: true,
    triggerDelay: 0,
    caseSensitive: false,
    expandInAllFields: true,
    soundEnabled: false,
    showNotification: false,
    requireSpace: true
  });

  // Derived stores
  const categories = derived(snippets, ($snippets) => {
    const cats = new Set(['General']);
    $snippets.forEach(s => cats.add(s.category));
    return Array.from(cats).sort();
  });

  const filteredSnippets = derived(snippets, ($snippets) => {
    let result = [...$snippets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.trigger.toLowerCase().includes(query) ||
        s.expansion.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(s => s.category === selectedCategory);
    }

    return result.sort((a, b) => b.usageCount - a.usageCount);
  });

  const statistics = derived(snippets, ($snippets) => ({
    total: $snippets.length,
    enabled: $snippets.filter(s => s.enabled).length,
    totalUsage: $snippets.reduce((sum, s) => sum + s.usageCount, 0),
    categories: new Set($snippets.map(s => s.category)).size
  }));

  let store: Store | null = null;

  // Default snippets
  const defaultSnippets: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
    { trigger: '/shrug', expansion: '¯\\_(ツ)_/¯', description: 'Shrug emoticon', category: 'Emoticons', variables: [], enabled: true },
    { trigger: '/tableflip', expansion: '(╯°□°）╯︵ ┻━┻', description: 'Table flip', category: 'Emoticons', variables: [], enabled: true },
    { trigger: '/lenny', expansion: '( ͡° ͜ʖ ͡°)', description: 'Lenny face', category: 'Emoticons', variables: [], enabled: true },
    { trigger: '/disapprove', expansion: 'ಠ_ಠ', description: 'Look of disapproval', category: 'Emoticons', variables: [], enabled: true },
    { trigger: '/ty', expansion: 'Thank you!', description: 'Thank you shortcut', category: 'Greetings', variables: [], enabled: true },
    { trigger: '/brb', expansion: 'Be right back!', description: 'Be right back', category: 'General', variables: [], enabled: true },
    { trigger: '/omw', expansion: 'On my way!', description: 'On my way', category: 'General', variables: [], enabled: true },
    { trigger: '/afk', expansion: 'Away from keyboard', description: 'Away from keyboard', category: 'General', variables: [], enabled: true },
    { trigger: '/np', expansion: 'No problem!', description: 'No problem', category: 'General', variables: [], enabled: true },
    { trigger: '/idk', expansion: "I don't know", description: "I don't know", category: 'General', variables: [], enabled: true },
    { trigger: '/fyi', expansion: 'For your information', description: 'For your information', category: 'General', variables: [], enabled: true },
    { trigger: '/tldr', expansion: "TL;DR: ", description: 'Too long; didn\'t read prefix', category: 'General', variables: [], enabled: true },
    { trigger: '/date', expansion: '{date}', description: 'Current date', category: 'Dynamic', variables: ['date'], enabled: true },
    { trigger: '/time', expansion: '{time}', description: 'Current time', category: 'Dynamic', variables: ['time'], enabled: true },
    { trigger: '/datetime', expansion: '{datetime}', description: 'Current date and time', category: 'Dynamic', variables: ['datetime'], enabled: true },
  ];

  onMount(async () => {
    store = await Store.load('text-expander.json');
    await loadData();

    // Set up global input listener
    document.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('focusin', handleFocusIn);
  });

  onDestroy(() => {
    document.removeEventListener('input', handleInput);
    document.removeEventListener('keydown', handleGlobalKeydown);
    document.removeEventListener('focusin', handleFocusIn);
  });

  async function loadData() {
    if (!store) return;

    const savedSnippets = await store.get<TextSnippet[]>('snippets');
    const savedSettings = await store.get<TextExpanderSettings>('settings');

    if (savedSnippets && savedSnippets.length > 0) {
      snippets.set(savedSnippets);
    } else {
      // Initialize with default snippets
      const initialSnippets = defaultSnippets.map(s => ({
        ...s,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0
      }));
      snippets.set(initialSnippets);
      await saveData();
    }

    if (savedSettings) {
      settings.set({ ...$settings, ...savedSettings });
    }
  }

  async function saveData() {
    if (!store) return;
    await store.set('snippets', $snippets);
    await store.set('settings', $settings);
    await store.save();
  }

  function handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      activeInput = target;
      inputBuffer = '';
    }
  }

  function handleInput(e: Event) {
    if (!$settings.enabled) return;
    
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    // Track the input buffer for trigger detection
    const inputEvent = e as InputEvent;
    if (inputEvent.data) {
      inputBuffer += inputEvent.data;
      
      // Check for triggers
      if ($settings.requireSpace && inputEvent.data === ' ') {
        checkAndExpand(target);
      } else if (!$settings.requireSpace) {
        checkAndExpand(target);
      }
    }

    // Reset buffer on certain actions
    if (inputEvent.inputType === 'deleteContentBackward' || 
        inputEvent.inputType === 'deleteContentForward') {
      inputBuffer = '';
    }
  }

  function checkAndExpand(target: HTMLInputElement | HTMLTextAreaElement) {
    const value = target.value;
    const cursorPos = target.selectionStart || 0;
    
    // Get word before cursor
    const textBeforeCursor = value.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Find matching snippet
    const match = $snippets.find(s => {
      if (!s.enabled) return false;
      if ($settings.caseSensitive) {
        return s.trigger === lastWord || s.trigger === lastWord.slice(0, -1);
      }
      return s.trigger.toLowerCase() === lastWord.toLowerCase() ||
             s.trigger.toLowerCase() === lastWord.slice(0, -1).toLowerCase();
    });

    if (match) {
      const triggerToReplace = $settings.requireSpace ? lastWord.slice(0, -1) : lastWord;
      const startPos = cursorPos - triggerToReplace.length - ($settings.requireSpace ? 1 : 0);
      const endPos = cursorPos;
      
      // Process expansion with variables
      let expansion = processVariables(match.expansion);
      
      // Replace trigger with expansion
      const newValue = value.slice(0, startPos) + expansion + ($settings.requireSpace ? ' ' : '') + value.slice(endPos);
      target.value = newValue;
      
      // Update cursor position
      const newCursorPos = startPos + expansion.length + ($settings.requireSpace ? 1 : 0);
      target.setSelectionRange(newCursorPos, newCursorPos);
      
      // Dispatch input event for frameworks
      target.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Update usage count
      snippets.update(items =>
        items.map(s => s.id === match.id
          ? { ...s, usageCount: s.usageCount + 1, updatedAt: Date.now() }
          : s
        )
      );
      
      saveData();
      inputBuffer = '';
    }
  }

  function processVariables(text: string): string {
    const now = new Date();
    const variables: Record<string, string> = {
      '{date}': now.toLocaleDateString(),
      '{time}': now.toLocaleTimeString(),
      '{datetime}': now.toLocaleString(),
      '{year}': now.getFullYear().toString(),
      '{month}': (now.getMonth() + 1).toString().padStart(2, '0'),
      '{day}': now.getDate().toString().padStart(2, '0'),
      '{hour}': now.getHours().toString().padStart(2, '0'),
      '{minute}': now.getMinutes().toString().padStart(2, '0'),
      '{timestamp}': now.getTime().toString(),
      '{random}': Math.random().toString(36).slice(2, 8),
      '{uuid}': crypto.randomUUID()
    };

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(key, value);
    }
    return result;
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd + Shift + E to open Text Expander
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      isOpen = !isOpen;
    }

    if (!isOpen) return;

    if (e.key === 'Escape') {
      if (showCreateForm || editingSnippet) {
        showCreateForm = false;
        editingSnippet = null;
      } else {
        isOpen = false;
      }
    }
  }

  function createSnippet() {
    if (!newTrigger.trim() || !newExpansion.trim()) return;

    // Check for duplicate trigger
    if ($snippets.some(s => s.trigger === newTrigger.trim())) {
      alert('A snippet with this trigger already exists!');
      return;
    }

    const snippet: TextSnippet = {
      id: crypto.randomUUID(),
      trigger: newTrigger.trim(),
      expansion: newExpansion,
      description: newDescription.trim() || '',
      category: newCategory || 'General',
      variables: extractVariables(newExpansion),
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true
    };

    snippets.update(items => [...items, snippet]);
    saveData();

    // Reset form
    newTrigger = '';
    newExpansion = '';
    newDescription = '';
    newCategory = 'General';
    showCreateForm = false;
  }

  function updateSnippet() {
    if (!editingSnippet) return;
    
    snippets.update(items =>
      items.map(s => s.id === editingSnippet!.id
        ? { ...editingSnippet!, updatedAt: Date.now(), variables: extractVariables(editingSnippet!.expansion) }
        : s
      )
    );
    
    saveData();
    editingSnippet = null;
  }

  function deleteSnippet(id: string) {
    if (confirm('Delete this snippet?')) {
      snippets.update(items => items.filter(s => s.id !== id));
      saveData();
    }
  }

  function toggleSnippet(id: string) {
    snippets.update(items =>
      items.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
    saveData();
  }

  function extractVariables(text: string): string[] {
    const matches = text.match(/\{[^}]+\}/g) || [];
    return [...new Set(matches)];
  }

  function duplicateSnippet(snippet: TextSnippet) {
    const newSnippet: TextSnippet = {
      ...snippet,
      id: crypto.randomUUID(),
      trigger: snippet.trigger + '_copy',
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    snippets.update(items => [...items, newSnippet]);
    saveData();
  }

  function exportSnippets() {
    const data = JSON.stringify($snippets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'text-expander-snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSnippets(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text) as TextSnippet[];
      
      // Validate and merge
      const existingTriggers = new Set($snippets.map(s => s.trigger));
      const newSnippets = imported.filter(s => 
        s.trigger && s.expansion && !existingTriggers.has(s.trigger)
      ).map(s => ({
        ...s,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0
      }));

      snippets.update(items => [...items, ...newSnippets]);
      saveData();
      
      alert(`Imported ${newSnippets.length} new snippets!`);
    } catch {
      alert('Failed to import snippets. Invalid file format.');
    }
    
    input.value = '';
  }

  // Reactive subscriptions
  let currentSnippets: TextSnippet[] = [];
  let currentCategories: string[] = [];
  let currentStats: typeof $statistics;
  let currentSettings: TextExpanderSettings;

  $effect(() => {
    const unsubSnippets = filteredSnippets.subscribe(v => currentSnippets = v);
    const unsubCategories = categories.subscribe(v => currentCategories = v);
    const unsubStats = statistics.subscribe(v => currentStats = v);
    const unsubSettings = settings.subscribe(v => currentSettings = v);

    return () => {
      unsubSnippets();
      unsubCategories();
      unsubStats();
      unsubSettings();
    };
  });
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    onclick={() => { if (!showCreateForm && !editingSnippet) isOpen = false; }}
    onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
    role="dialog"
    aria-modal="true"
    aria-label="Text Expander"
  >
    <div
      class="bg-gray-900 rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col overflow-hidden border border-gray-700"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Header -->
      <div class="p-4 border-b border-gray-700">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">⚡</span>
            <h2 class="text-lg font-semibold text-white">Text Expander</h2>
            <span class="px-2 py-0.5 rounded-full text-xs {currentSettings.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
              {currentSettings.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={() => { settings.update(s => ({ ...s, enabled: !s.enabled })); saveData(); }}
              class="p-2 rounded-lg hover:bg-gray-700 transition-colors {currentSettings.enabled ? 'text-green-400' : 'text-gray-400'}"
              title={currentSettings.enabled ? 'Disable' : 'Enable'}
            >
              {currentSettings.enabled ? '✓' : '○'}
            </button>
            <button
              onclick={() => showCreateForm = true}
              class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New Snippet
            </button>
            <button
              onclick={() => isOpen = false}
              class="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search snippets..."
            class="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>

        <!-- Category Filter -->
        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onclick={() => selectedCategory = 'all'}
            class="px-3 py-1 rounded-full text-sm transition-colors {selectedCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
          >
            All
          </button>
          {#each currentCategories as category}
            <button
              onclick={() => selectedCategory = category}
              class="px-3 py-1 rounded-full text-sm transition-colors {selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
            >
              {category}
            </button>
          {/each}
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-4 text-xs text-gray-400">
        <span>📊 {currentStats.total} snippets</span>
        <span>✓ {currentStats.enabled} enabled</span>
        <span>📁 {currentStats.categories} categories</span>
        <span>🔥 {currentStats.totalUsage} expansions</span>
        <div class="ml-auto flex items-center gap-2">
          <button
            onclick={exportSnippets}
            class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
          >
            📤 Export
          </button>
          <label class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer transition-colors">
            📥 Import
            <input
              type="file"
              accept=".json"
              onchange={importSnippets}
              class="hidden"
            />
          </label>
        </div>
      </div>

      <!-- Create/Edit Form -->
      {#if showCreateForm || editingSnippet}
        <div class="p-4 bg-gray-800 border-b border-gray-700">
          <h3 class="text-sm font-medium text-gray-300 mb-3">
            {editingSnippet ? 'Edit Snippet' : 'Create New Snippet'}
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Trigger (e.g., /hello)</label>
              <input
                type="text"
                bind:value={editingSnippet ? editingSnippet.trigger : newTrigger}
                placeholder="/shortcut"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Category</label>
              <input
                type="text"
                bind:value={editingSnippet ? editingSnippet.category : newCategory}
                placeholder="General"
                list="categories"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <datalist id="categories">
                {#each currentCategories as cat}
                  <option value={cat} />
                {/each}
              </datalist>
            </div>
            <div class="col-span-2">
              <label class="block text-xs text-gray-400 mb-1">Expansion Text</label>
              <textarea
                bind:value={editingSnippet ? editingSnippet.expansion : newExpansion}
                placeholder="Text to expand to..."
                rows="3"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">
                Variables: {'{date}'}, {'{time}'}, {'{datetime}'}, {'{random}'}, {'{uuid}'}
              </p>
            </div>
            <div class="col-span-2">
              <label class="block text-xs text-gray-400 mb-1">Description (optional)</label>
              <input
                type="text"
                bind:value={editingSnippet ? editingSnippet.description : newDescription}
                placeholder="What this snippet does..."
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button
              onclick={() => { showCreateForm = false; editingSnippet = null; }}
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onclick={editingSnippet ? updateSnippet : createSnippet}
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {editingSnippet ? 'Save Changes' : 'Create Snippet'}
            </button>
          </div>
        </div>
      {/if}

      <!-- Snippets List -->
      <div class="flex-1 overflow-y-auto">
        {#if currentSnippets.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <span class="text-4xl mb-2">⚡</span>
            <p>No snippets found</p>
            <button
              onclick={() => showCreateForm = true}
              class="mt-3 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
            >
              Create your first snippet
            </button>
          </div>
        {:else}
          <div class="divide-y divide-gray-700/50">
            {#each currentSnippets as snippet}
              <div
                class="p-4 hover:bg-gray-800 transition-colors group {!snippet.enabled ? 'opacity-50' : ''}"
              >
                <div class="flex items-start gap-4">
                  <!-- Trigger -->
                  <div class="flex-shrink-0">
                    <code class="px-3 py-1.5 bg-gray-700 rounded-lg text-sm font-mono {snippet.enabled ? 'text-blue-400' : 'text-gray-500'}">
                      {snippet.trigger}
                    </code>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">
                        {snippet.category}
                      </span>
                      {#if snippet.usageCount > 0}
                        <span class="text-xs text-gray-500">
                          Used {snippet.usageCount}×
                        </span>
                      {/if}
                      {#if snippet.variables.length > 0}
                        <span class="text-xs text-purple-400">
                          🔮 Dynamic
                        </span>
                      {/if}
                    </div>
                    <p class="text-sm text-gray-300 whitespace-pre-wrap break-words">
                      {snippet.expansion.length > 150 ? snippet.expansion.slice(0, 150) + '...' : snippet.expansion}
                    </p>
                    {#if snippet.description}
                      <p class="text-xs text-gray-500 mt-1">{snippet.description}</p>
                    {/if}
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onclick={() => toggleSnippet(snippet.id)}
                      class="p-1.5 rounded hover:bg-gray-700 transition-colors {snippet.enabled ? 'text-green-400' : 'text-gray-500'}"
                      title={snippet.enabled ? 'Disable' : 'Enable'}
                    >
                      {snippet.enabled ? '✓' : '○'}
                    </button>
                    <button
                      onclick={() => editingSnippet = { ...snippet }}
                      class="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onclick={() => duplicateSnippet(snippet)}
                      class="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onclick={() => deleteSnippet(snippet.id)}
                      class="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <span>Type a trigger (e.g., <kbd class="px-1 py-0.5 bg-gray-700 rounded">/shrug</kbd>) followed by <kbd class="px-1 py-0.5 bg-gray-700 rounded">Space</kbd> to expand</span>
        <span class="ml-3">⌨️ <kbd class="px-1 py-0.5 bg-gray-700 rounded">Ctrl+Shift+E</kbd> Toggle panel</span>
      </div>
    </div>
  </div>
{/if}

<style>
  kbd {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
  }
</style>
