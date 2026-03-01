<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { Store } from '@tauri-apps/plugin-store';
  import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

  interface ClipboardEntry {
    id: string;
    content: string;
    type: 'text' | 'url' | 'code' | 'email' | 'phone' | 'color';
    timestamp: number;
    pinned: boolean;
    usageCount: number;
    preview: string;
    tags: string[];
  }

  interface ClipboardSettings {
    maxEntries: number;
    autoPaste: boolean;
    deduplication: boolean;
    showNotifications: boolean;
    shortcutEnabled: boolean;
    excludePatterns: string[];
  }

  // State
  let isOpen = $state(false);
  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let filterType = $state<ClipboardEntry['type'] | 'all'>('all');
  let showPinnedOnly = $state(false);
  let showSettings = $state(false);

  // Stores
  const entries = writable<ClipboardEntry[]>([]);
  const settings = writable<ClipboardSettings>({
    maxEntries: 100,
    autoPaste: false,
    deduplication: true,
    showNotifications: false,
    shortcutEnabled: true,
    excludePatterns: ['password', 'secret', 'token', 'api_key']
  });

  // Derived stores
  const filteredEntries = derived(
    [entries, settings],
    ([$entries, $settings]) => {
      let result = [...$entries];

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(e => 
          e.content.toLowerCase().includes(query) ||
          e.tags.some(t => t.toLowerCase().includes(query))
        );
      }

      // Apply type filter
      if (filterType !== 'all') {
        result = result.filter(e => e.type === filterType);
      }

      // Apply pinned filter
      if (showPinnedOnly) {
        result = result.filter(e => e.pinned);
      }

      // Sort: pinned first, then by timestamp
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.timestamp - a.timestamp;
      });

      return result;
    }
  );

  const statistics = derived(entries, ($entries) => ({
    total: $entries.length,
    pinned: $entries.filter(e => e.pinned).length,
    text: $entries.filter(e => e.type === 'text').length,
    urls: $entries.filter(e => e.type === 'url').length,
    code: $entries.filter(e => e.type === 'code').length,
    totalUsage: $entries.reduce((sum, e) => sum + e.usageCount, 0)
  }));

  let store: Store | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastClipboard = '';

  onMount(async () => {
    store = await Store.load('clipboard-history.json');
    await loadData();
    startPolling();

    // Global keyboard shortcut
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    window.removeEventListener('keydown', handleGlobalKeydown);
  });

  async function loadData() {
    if (!store) return;
    
    const savedEntries = await store.get<ClipboardEntry[]>('entries');
    const savedSettings = await store.get<ClipboardSettings>('settings');
    
    if (savedEntries) entries.set(savedEntries);
    if (savedSettings) settings.set({ ...$settings, ...savedSettings });
  }

  async function saveData() {
    if (!store) return;
    await store.set('entries', $entries);
    await store.set('settings', $settings);
    await store.save();
  }

  function startPolling() {
    // Poll clipboard every 500ms
    pollInterval = setInterval(async () => {
      try {
        const text = await readText();
        if (text && text !== lastClipboard) {
          lastClipboard = text;
          addEntry(text);
        }
      } catch {
        // Clipboard access failed, ignore
      }
    }, 500);
  }

  function detectType(content: string): ClipboardEntry['type'] {
    // URL detection
    if (/^https?:\/\/[^\s]+$/i.test(content.trim())) {
      return 'url';
    }
    
    // Email detection
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(content.trim())) {
      return 'email';
    }
    
    // Phone detection
    if (/^[\d\s\-\+\(\)]{7,}$/.test(content.trim())) {
      return 'phone';
    }
    
    // Color detection (hex, rgb, hsl)
    if (/^#[0-9a-f]{3,8}$/i.test(content.trim()) ||
        /^rgba?\([^)]+\)$/i.test(content.trim()) ||
        /^hsla?\([^)]+\)$/i.test(content.trim())) {
      return 'color';
    }
    
    // Code detection (contains common code patterns)
    if (/[{}\[\]();]/.test(content) && 
        (content.includes('\n') || /^(const|let|var|function|class|import|export|if|for|while)/.test(content))) {
      return 'code';
    }
    
    return 'text';
  }

  function createPreview(content: string, maxLength = 100): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength) + '...';
  }

  function shouldExclude(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return $settings.excludePatterns.some(pattern => 
      lowerContent.includes(pattern.toLowerCase())
    );
  }

  function addEntry(content: string) {
    if (!content.trim()) return;
    if (shouldExclude(content)) return;

    // Check for duplicates
    if ($settings.deduplication) {
      const existing = $entries.find(e => e.content === content);
      if (existing) {
        // Update timestamp and move to top
        entries.update(items => 
          items.map(e => e.id === existing.id 
            ? { ...e, timestamp: Date.now(), usageCount: e.usageCount + 1 }
            : e
          )
        );
        saveData();
        return;
      }
    }

    const entry: ClipboardEntry = {
      id: crypto.randomUUID(),
      content,
      type: detectType(content),
      timestamp: Date.now(),
      pinned: false,
      usageCount: 1,
      preview: createPreview(content),
      tags: []
    };

    entries.update(items => {
      const newItems = [entry, ...items];
      // Enforce max entries (keep pinned)
      const pinned = newItems.filter(e => e.pinned);
      const unpinned = newItems.filter(e => !e.pinned);
      if (unpinned.length > $settings.maxEntries) {
        unpinned.splice($settings.maxEntries);
      }
      return [...pinned, ...unpinned];
    });

    saveData();
  }

  async function pasteEntry(entry: ClipboardEntry) {
    try {
      await writeText(entry.content);
      lastClipboard = entry.content;
      
      // Update usage count
      entries.update(items =>
        items.map(e => e.id === entry.id
          ? { ...e, usageCount: e.usageCount + 1 }
          : e
        )
      );
      
      saveData();
      
      if ($settings.autoPaste) {
        isOpen = false;
      }
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
    }
  }

  function togglePin(entry: ClipboardEntry) {
    entries.update(items =>
      items.map(e => e.id === entry.id
        ? { ...e, pinned: !e.pinned }
        : e
      )
    );
    saveData();
  }

  function deleteEntry(entry: ClipboardEntry) {
    entries.update(items => items.filter(e => e.id !== entry.id));
    saveData();
  }

  function clearAll() {
    if (confirm('Clear all non-pinned clipboard entries?')) {
      entries.update(items => items.filter(e => e.pinned));
      saveData();
    }
  }

  function addTag(entry: ClipboardEntry, tag: string) {
    if (!tag.trim() || entry.tags.includes(tag)) return;
    entries.update(items =>
      items.map(e => e.id === entry.id
        ? { ...e, tags: [...e.tags, tag.trim()] }
        : e
      )
    );
    saveData();
  }

  function removeTag(entry: ClipboardEntry, tag: string) {
    entries.update(items =>
      items.map(e => e.id === entry.id
        ? { ...e, tags: e.tags.filter(t => t !== tag) }
        : e
      )
    );
    saveData();
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd + Shift + V to open clipboard history
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V' && $settings.shortcutEnabled) {
      e.preventDefault();
      isOpen = !isOpen;
      if (isOpen) {
        selectedIndex = 0;
        searchQuery = '';
      }
    }

    if (!isOpen) return;

    // Navigation
    if (e.key === 'Escape') {
      isOpen = false;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const filtered = $filteredEntries;
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const filtered = $filteredEntries;
      if (filtered[selectedIndex]) {
        pasteEntry(filtered[selectedIndex]);
      }
    } else if (e.key === 'Delete' && e.shiftKey) {
      e.preventDefault();
      const filtered = $filteredEntries;
      if (filtered[selectedIndex]) {
        deleteEntry(filtered[selectedIndex]);
      }
    }
  }

  function formatTimestamp(ts: number): string {
    const now = Date.now();
    const diff = now - ts;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function getTypeIcon(type: ClipboardEntry['type']): string {
    switch (type) {
      case 'url': return '🔗';
      case 'code': return '💻';
      case 'email': return '📧';
      case 'phone': return '📞';
      case 'color': return '🎨';
      default: return '📝';
    }
  }

  function getColorPreview(content: string): string | null {
    if (content.startsWith('#') || content.startsWith('rgb') || content.startsWith('hsl')) {
      return content.trim();
    }
    return null;
  }

  // Reactive subscriptions
  let currentEntries: ClipboardEntry[] = [];
  let currentSettings: ClipboardSettings;
  let currentStats: typeof $statistics;
  
  $effect(() => {
    const unsubEntries = filteredEntries.subscribe(v => currentEntries = v);
    const unsubSettings = settings.subscribe(v => currentSettings = v);
    const unsubStats = statistics.subscribe(v => currentStats = v);
    
    return () => {
      unsubEntries();
      unsubSettings();
      unsubStats();
    };
  });
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    onclick={() => isOpen = false}
    onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
    role="dialog"
    aria-modal="true"
    aria-label="Clipboard History"
  >
    <div 
      class="bg-gray-900 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-700"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Header -->
      <div class="p-4 border-b border-gray-700">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">📋</span>
            <h2 class="text-lg font-semibold text-white">Clipboard History</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={() => showSettings = !showSettings}
              class="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onclick={clearAll}
              class="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear All"
            >
              🗑️
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
            placeholder="Search clipboard history..."
            class="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>

        <!-- Filters -->
        <div class="flex items-center gap-2 mt-3">
          <button
            onclick={() => filterType = 'all'}
            class="px-3 py-1 rounded-full text-sm transition-colors {filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
          >
            All
          </button>
          {#each ['text', 'url', 'code', 'email', 'color'] as type}
            <button
              onclick={() => filterType = type as ClipboardEntry['type']}
              class="px-3 py-1 rounded-full text-sm transition-colors {filterType === type ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
            >
              {getTypeIcon(type as ClipboardEntry['type'])} {type}
            </button>
          {/each}
          <button
            onclick={() => showPinnedOnly = !showPinnedOnly}
            class="px-3 py-1 rounded-full text-sm transition-colors ml-auto {showPinnedOnly ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
          >
            📌 Pinned
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
      {#if showSettings}
        <div class="p-4 bg-gray-800 border-b border-gray-700">
          <h3 class="text-sm font-medium text-gray-300 mb-3">Settings</h3>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={currentSettings.autoPaste}
                onchange={saveData}
                class="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-300">Auto-close after paste</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={currentSettings.deduplication}
                onchange={saveData}
                class="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-300">Remove duplicates</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                bind:checked={currentSettings.shortcutEnabled}
                onchange={saveData}
                class="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-300">Ctrl+Shift+V shortcut</span>
            </label>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-300">Max entries:</span>
              <input
                type="number"
                bind:value={currentSettings.maxEntries}
                onchange={saveData}
                min="10"
                max="500"
                class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          </div>
        </div>
      {/if}

      <!-- Stats Bar -->
      <div class="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-4 text-xs text-gray-400">
        <span>📊 {currentStats.total} items</span>
        <span>📌 {currentStats.pinned} pinned</span>
        <span>🔗 {currentStats.urls} URLs</span>
        <span>💻 {currentStats.code} code</span>
        <span>📧 {currentStats.text} text</span>
      </div>

      <!-- Entries List -->
      <div class="flex-1 overflow-y-auto">
        {#if currentEntries.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <span class="text-4xl mb-2">📋</span>
            <p>No clipboard entries</p>
            <p class="text-sm">Copy something to get started</p>
          </div>
        {:else}
          <div class="divide-y divide-gray-700/50">
            {#each currentEntries as entry, index}
              <div
                class="p-3 hover:bg-gray-800 cursor-pointer transition-colors group {index === selectedIndex ? 'bg-blue-500/20' : ''}"
                onclick={() => pasteEntry(entry)}
                onkeydown={(e) => e.key === 'Enter' && pasteEntry(entry)}
                role="button"
                tabindex="0"
              >
                <div class="flex items-start gap-3">
                  <!-- Type Icon -->
                  <div class="text-xl flex-shrink-0 mt-1">
                    {getTypeIcon(entry.type)}
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      {#if entry.pinned}
                        <span class="text-yellow-400">📌</span>
                      {/if}
                      <span class="text-xs text-gray-500">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      {#if entry.usageCount > 1}
                        <span class="text-xs text-gray-500">
                          • Used {entry.usageCount}x
                        </span>
                      {/if}
                    </div>

                    <!-- Color Preview -->
                    {#if entry.type === 'color'}
                      {@const color = getColorPreview(entry.content)}
                      {#if color}
                        <div class="flex items-center gap-2 mb-1">
                          <div 
                            class="w-6 h-6 rounded border border-gray-600"
                            style="background-color: {color}"
                          ></div>
                          <code class="text-sm text-gray-300">{entry.content}</code>
                        </div>
                      {/if}
                    {:else if entry.type === 'code'}
                      <pre class="text-sm text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">{entry.preview}</pre>
                    {:else if entry.type === 'url'}
                      <a 
                        href={entry.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-400 hover:underline text-sm truncate block"
                        onclick={(e) => e.stopPropagation()}
                      >
                        {entry.preview}
                      </a>
                    {:else}
                      <p class="text-sm text-gray-300 whitespace-pre-wrap break-words">
                        {entry.preview}
                      </p>
                    {/if}

                    <!-- Tags -->
                    {#if entry.tags.length > 0}
                      <div class="flex flex-wrap gap-1 mt-2">
                        {#each entry.tags as tag}
                          <span class="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300 flex items-center gap-1">
                            {tag}
                            <button
                              onclick={(e) => { e.stopPropagation(); removeTag(entry, tag); }}
                              class="text-gray-500 hover:text-red-400"
                            >
                              ×
                            </button>
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onclick={(e) => { e.stopPropagation(); togglePin(entry); }}
                      class="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-yellow-400 transition-colors"
                      title={entry.pinned ? 'Unpin' : 'Pin'}
                    >
                      {entry.pinned ? '📌' : '📍'}
                    </button>
                    <button
                      onclick={(e) => { e.stopPropagation(); deleteEntry(entry); }}
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
        <span>⌨️ <kbd class="px-1 py-0.5 bg-gray-700 rounded">↑↓</kbd> Navigate</span>
        <span class="ml-3"><kbd class="px-1 py-0.5 bg-gray-700 rounded">Enter</kbd> Paste</span>
        <span class="ml-3"><kbd class="px-1 py-0.5 bg-gray-700 rounded">Shift+Del</kbd> Delete</span>
        <span class="ml-3"><kbd class="px-1 py-0.5 bg-gray-700 rounded">Esc</kbd> Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  kbd {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
  }
</style>
