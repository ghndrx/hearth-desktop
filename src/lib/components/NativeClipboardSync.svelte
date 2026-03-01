<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Types
  interface ClipboardEntry {
    id: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'url';
    source: 'local' | 'remote';
    deviceName: string;
    timestamp: string;
    pinned: boolean;
    size: number;
  }

  interface SyncDevice {
    id: string;
    name: string;
    platform: string;
    lastSeen: string;
    isOnline: boolean;
  }

  // State
  let isOpen = false;
  let activeTab: 'clipboard' | 'devices' | 'settings' = 'clipboard';
  let entries: ClipboardEntry[] = [];
  let devices: SyncDevice[] = [];
  let syncEnabled = true;
  let autoSync = true;
  let maxEntries = 50;
  let encryptClipboard = true;
  let filterType: 'all' | 'text' | 'url' | 'image' | 'file' = 'all';
  let searchQuery = '';

  const STORAGE_KEY = 'hearth-clipboard-sync';
  const SETTINGS_KEY = 'hearth-clipboard-sync-settings';

  let unregisterShortcut: (() => void) | null = null;
  let clipboardInterval: ReturnType<typeof setInterval> | null = null;
  let lastClipboardContent = '';

  onMount(async () => {
    loadData();
    await registerShortcut();
    startClipboardMonitor();
  });

  onDestroy(() => {
    if (unregisterShortcut) unregisterShortcut();
    if (clipboardInterval) clearInterval(clipboardInterval);
  });

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) entries = JSON.parse(saved);

      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        syncEnabled = s.syncEnabled ?? true;
        autoSync = s.autoSync ?? true;
        maxEntries = s.maxEntries ?? 50;
        encryptClipboard = s.encryptClipboard ?? true;
      }
    } catch (e) {
      console.error('Failed to load clipboard sync data:', e);
    }
  }

  function saveData() {
    try {
      const trimmed = entries.slice(-maxEntries);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save clipboard sync data:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        syncEnabled, autoSync, maxEntries, encryptClipboard,
      }));
    } catch (e) {
      console.error('Failed to save clipboard sync settings:', e);
    }
  }

  async function registerShortcut() {
    try {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await register('CommandOrControl+Shift+V', () => {
        isOpen = !isOpen;
      });
      unregisterShortcut = () => unregister('CommandOrControl+Shift+V');
    } catch (e) {
      console.warn('Global shortcut not available:', e);
    }
  }

  function startClipboardMonitor() {
    clipboardInterval = setInterval(async () => {
      if (!syncEnabled) return;
      try {
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        const text = await readText();
        if (text && text !== lastClipboardContent) {
          lastClipboardContent = text;
          addEntry(text);
        }
      } catch {
        // Clipboard not available
      }
    }, 2000);
  }

  function addEntry(content: string) {
    const type = detectType(content);
    const entry: ClipboardEntry = {
      id: crypto.randomUUID(),
      content,
      type,
      source: 'local',
      deviceName: 'This Device',
      timestamp: new Date().toISOString(),
      pinned: false,
      size: new Blob([content]).size,
    };

    // Deduplicate
    entries = entries.filter(e => e.content !== content);
    entries = [...entries, entry];
    saveData();
  }

  function detectType(content: string): 'text' | 'url' | 'image' | 'file' {
    try {
      const url = new URL(content.trim());
      if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname)) return 'image';
      return 'url';
    } catch {
      return 'text';
    }
  }

  async function copyToClipboard(content: string) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(content);
      lastClipboardContent = content;
    } catch {
      await navigator.clipboard.writeText(content);
    }
  }

  function togglePin(id: string) {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.pinned = !entry.pinned;
      entries = [...entries];
      saveData();
    }
  }

  function deleteEntry(id: string) {
    entries = entries.filter(e => e.id !== id);
    saveData();
  }

  function clearAll() {
    entries = entries.filter(e => e.pinned);
    saveData();
  }

  function filteredEntries(): ClipboardEntry[] {
    let filtered = entries;
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => e.content.toLowerCase().includes(q));
    }
    // Show pinned first, then reverse chronological
    return [...filtered.filter(e => e.pinned), ...filtered.filter(e => !e.pinned)].reverse();
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      text: 'M4 6h16M4 12h16M4 18h7',
      url: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    };
    return icons[type] || icons.text;
  }
</script>

<!-- Toggle Button -->
<button
  class="fixed bottom-68 right-4 z-40 w-10 h-10 bg-violet-600 hover:bg-violet-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
  on:click={() => isOpen = !isOpen}
  title="Clipboard Sync (Ctrl+Shift+V)"
>
  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
  {#if entries.length > 0}
    <span class="absolute -top-1 -right-1 w-5 h-5 bg-violet-400 rounded-full text-xs text-white flex items-center justify-center">
      {entries.length > 99 ? '99+' : entries.length}
    </span>
  {/if}
</button>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click|self={() => isOpen = false}>
    <div class="bg-gray-900 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <h2 class="text-lg font-semibold text-white">Clipboard Sync</h2>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2">
            <span class="text-sm text-gray-400">Sync</span>
            <button
              class="relative w-12 h-6 rounded-full transition-colors"
              class:bg-violet-600={syncEnabled}
              class:bg-gray-600={!syncEnabled}
              on:click={() => { syncEnabled = !syncEnabled; saveSettings(); }}
            >
              <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-6={syncEnabled} />
            </button>
          </label>
          <button class="text-gray-400 hover:text-white" on:click={() => isOpen = false}>
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700">
        {#each ['clipboard', 'devices', 'settings'] as tab}
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            class:text-violet-400={activeTab === tab}
            class:border-b-2={activeTab === tab}
            class:border-violet-400={activeTab === tab}
            class:text-gray-400={activeTab !== tab}
            on:click={() => activeTab = tab}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {#if tab === 'clipboard'}
              <span class="ml-1 text-xs text-gray-500">({entries.length})</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'clipboard'}
          <div class="space-y-3">
            <!-- Filters -->
            <div class="flex items-center gap-2">
              <input
                type="text"
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Search clipboard..."
                bind:value={searchQuery}
              />
              <select
                class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                bind:value={filterType}
              >
                <option value="all">All</option>
                <option value="text">Text</option>
                <option value="url">URLs</option>
                <option value="image">Images</option>
                <option value="file">Files</option>
              </select>
              <button
                class="px-3 py-2 bg-red-600/30 text-red-400 rounded-lg hover:bg-red-600/50 text-sm"
                on:click={clearAll}
                title="Clear unpinned entries"
              >
                Clear
              </button>
            </div>

            {#if filteredEntries().length === 0}
              <div class="text-center py-8 text-gray-400">
                <p>No clipboard entries</p>
                <p class="text-sm mt-1">Copy something to start tracking</p>
              </div>
            {:else}
              <div class="space-y-2 max-h-[400px] overflow-y-auto">
                {#each filteredEntries() as entry (entry.id)}
                  <div
                    class="bg-gray-800 rounded-lg p-3 group cursor-pointer hover:bg-gray-750 transition-colors"
                    class:border-l-2={entry.pinned}
                    class:border-violet-500={entry.pinned}
                    on:click={() => copyToClipboard(entry.content)}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex items-start gap-2 flex-1 min-w-0">
                        <svg class="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getTypeIcon(entry.type)} />
                        </svg>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-white truncate">{entry.content}</p>
                          <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{formatTime(entry.timestamp)}</span>
                            <span>{formatSize(entry.size)}</span>
                            <span class="capitalize">{entry.type}</span>
                            {#if entry.source === 'remote'}
                              <span class="text-violet-400">{entry.deviceName}</span>
                            {/if}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button
                          class="p-1 hover:bg-gray-700 rounded"
                          on:click|stopPropagation={() => togglePin(entry.id)}
                          title={entry.pinned ? 'Unpin' : 'Pin'}
                        >
                          <svg class="w-4 h-4" class:text-violet-400={entry.pinned} class:text-gray-400={!entry.pinned} fill={entry.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <button
                          class="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                          on:click|stopPropagation={() => deleteEntry(entry.id)}
                          title="Delete"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'devices'}
          <div class="space-y-3">
            <div class="bg-gray-800 rounded-lg p-4">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <span class="text-white font-medium">This Device</span>
                <span class="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full">Active</span>
              </div>
              <div class="text-xs text-gray-500">
                <span>Platform: {navigator.platform}</span>
              </div>
            </div>

            {#if devices.length === 0}
              <div class="text-center py-8 text-gray-400">
                <p>No other devices connected</p>
                <p class="text-sm mt-1">Sign in on other devices to sync clipboard</p>
              </div>
            {:else}
              {#each devices as device (device.id)}
                <div class="bg-gray-800 rounded-lg p-4">
                  <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full" class:bg-green-500={device.isOnline} class:bg-gray-500={!device.isOnline}></div>
                    <span class="text-white">{device.name}</span>
                    <span class="text-xs text-gray-500">{device.platform}</span>
                  </div>
                  <div class="text-xs text-gray-500 mt-1 ml-6">
                    Last seen: {formatTime(device.lastSeen)}
                  </div>
                </div>
              {/each}
            {/if}
          </div>

        {:else if activeTab === 'settings'}
          <div class="space-y-4">
            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Sync</h3>
              {#each [
                { label: 'Auto-sync clipboard', value: autoSync, toggle: () => { autoSync = !autoSync; saveSettings(); } },
                { label: 'Encrypt clipboard data', value: encryptClipboard, toggle: () => { encryptClipboard = !encryptClipboard; saveSettings(); } },
              ] as setting}
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-sm text-gray-300">{setting.label}</span>
                  <button
                    class="relative w-12 h-6 rounded-full transition-colors"
                    class:bg-violet-600={setting.value}
                    class:bg-gray-600={!setting.value}
                    on:click={setting.toggle}
                  >
                    <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-6={setting.value} />
                  </button>
                </label>
              {/each}
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-3">Storage</h3>
              <div>
                <label class="block text-sm text-gray-300 mb-2">Max clipboard entries</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  class="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  bind:value={maxEntries}
                  on:change={saveSettings}
                />
              </div>
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-2">Keyboard Shortcut</h3>
              <div class="flex items-center gap-2">
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Shift</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">V</kbd>
                <span class="text-gray-400 ml-2">Toggle Clipboard Sync</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
</script>
