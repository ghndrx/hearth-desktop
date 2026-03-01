<script lang="ts">
  import { onMount } from 'svelte';

  // Types
  interface FileAssociation {
    extension: string;
    mimeType: string;
    description: string;
    icon: string;
    action: 'open' | 'preview' | 'share' | 'upload';
    enabled: boolean;
  }

  interface RecentFile {
    path: string;
    name: string;
    extension: string;
    size: number;
    openedAt: string;
  }

  // State
  let isOpen = false;
  let activeTab: 'associations' | 'recent' | 'settings' = 'associations';
  let associations: FileAssociation[] = [];
  let recentFiles: RecentFile[] = [];
  let searchQuery = '';
  let registerAsDefault = false;
  let openInApp = true;
  let showPreviewOnHover = true;

  const STORAGE_KEY = 'hearth-file-associations';
  const RECENT_KEY = 'hearth-recent-files';

  const defaultAssociations: FileAssociation[] = [
    { extension: '.hearth', mimeType: 'application/x-hearth', description: 'Hearth Chat Export', icon: 'chat', action: 'open', enabled: true },
    { extension: '.htheme', mimeType: 'application/x-hearth-theme', description: 'Hearth Theme Pack', icon: 'palette', action: 'open', enabled: true },
    { extension: '.hbak', mimeType: 'application/x-hearth-backup', description: 'Hearth Backup', icon: 'archive', action: 'open', enabled: true },
    { extension: '.png', mimeType: 'image/png', description: 'PNG Image', icon: 'image', action: 'preview', enabled: true },
    { extension: '.jpg', mimeType: 'image/jpeg', description: 'JPEG Image', icon: 'image', action: 'preview', enabled: true },
    { extension: '.gif', mimeType: 'image/gif', description: 'GIF Image', icon: 'image', action: 'preview', enabled: true },
    { extension: '.webp', mimeType: 'image/webp', description: 'WebP Image', icon: 'image', action: 'preview', enabled: true },
    { extension: '.mp4', mimeType: 'video/mp4', description: 'MP4 Video', icon: 'video', action: 'preview', enabled: true },
    { extension: '.mp3', mimeType: 'audio/mpeg', description: 'MP3 Audio', icon: 'audio', action: 'preview', enabled: true },
    { extension: '.pdf', mimeType: 'application/pdf', description: 'PDF Document', icon: 'document', action: 'preview', enabled: false },
    { extension: '.txt', mimeType: 'text/plain', description: 'Text File', icon: 'document', action: 'share', enabled: false },
    { extension: '.zip', mimeType: 'application/zip', description: 'ZIP Archive', icon: 'archive', action: 'upload', enabled: false },
  ];

  onMount(() => {
    loadData();
  });

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        associations = data.associations || defaultAssociations;
        registerAsDefault = data.registerAsDefault ?? false;
        openInApp = data.openInApp ?? true;
        showPreviewOnHover = data.showPreviewOnHover ?? true;
      } else {
        associations = [...defaultAssociations];
      }

      const savedRecent = localStorage.getItem(RECENT_KEY);
      if (savedRecent) recentFiles = JSON.parse(savedRecent);
    } catch (e) {
      console.error('Failed to load file association data:', e);
      associations = [...defaultAssociations];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        associations, registerAsDefault, openInApp, showPreviewOnHover,
      }));
    } catch (e) {
      console.error('Failed to save file association data:', e);
    }
  }

  function toggleAssociation(ext: string) {
    const assoc = associations.find(a => a.extension === ext);
    if (assoc) {
      assoc.enabled = !assoc.enabled;
      associations = [...associations];
      saveData();
    }
  }

  function setAction(ext: string, action: FileAssociation['action']) {
    const assoc = associations.find(a => a.extension === ext);
    if (assoc) {
      assoc.action = action;
      associations = [...associations];
      saveData();
    }
  }

  function clearRecent() {
    recentFiles = [];
    localStorage.setItem(RECENT_KEY, '[]');
  }

  function filteredAssociations(): FileAssociation[] {
    if (!searchQuery) return associations;
    const q = searchQuery.toLowerCase();
    return associations.filter(a =>
      a.extension.includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.mimeType.includes(q)
    );
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  function getIconPath(icon: string): string {
    const icons: Record<string, string> = {
      chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      palette: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
      archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
      image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      audio: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
      document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    };
    return icons[icon] || icons.document;
  }

  function getActionColor(action: string): string {
    const colors: Record<string, string> = {
      open: 'text-blue-400',
      preview: 'text-green-400',
      share: 'text-orange-400',
      upload: 'text-violet-400',
    };
    return colors[action] || 'text-gray-400';
  }
</script>

<!-- Toggle Button -->
<button
  class="fixed bottom-84 right-4 z-40 w-10 h-10 bg-amber-600 hover:bg-amber-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
  on:click={() => isOpen = !isOpen}
  title="File Associations"
>
  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
</button>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click|self={() => isOpen = false}>
    <div class="bg-gray-900 rounded-xl shadow-2xl w-[650px] max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h2 class="text-lg font-semibold text-white">File Associations</h2>
        </div>
        <button class="text-gray-400 hover:text-white" on:click={() => isOpen = false}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700">
        {#each ['associations', 'recent', 'settings'] as tab}
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            class:text-amber-400={activeTab === tab}
            class:border-b-2={activeTab === tab}
            class:border-amber-400={activeTab === tab}
            class:text-gray-400={activeTab !== tab}
            on:click={() => activeTab = tab}
          >
            {tab === 'associations' ? 'File Types' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {#if tab === 'associations'}
              <span class="ml-1 text-xs text-gray-500">({associations.filter(a => a.enabled).length})</span>
            {:else if tab === 'recent'}
              <span class="ml-1 text-xs text-gray-500">({recentFiles.length})</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'associations'}
          <div class="space-y-3">
            <input
              type="text"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Search file types..."
              bind:value={searchQuery}
            />

            <div class="space-y-2">
              {#each filteredAssociations() as assoc (assoc.extension)}
                <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIconPath(assoc.icon)} />
                    </svg>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-white font-medium">{assoc.extension}</span>
                        <span class="text-xs text-gray-500">{assoc.description}</span>
                      </div>
                      <span class="text-xs text-gray-500">{assoc.mimeType}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <select
                      class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm {getActionColor(assoc.action)}"
                      value={assoc.action}
                      on:change={(e) => setAction(assoc.extension, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="preview">Preview</option>
                      <option value="share">Share</option>
                      <option value="upload">Upload</option>
                    </select>
                    <button
                      class="relative w-10 h-5 rounded-full transition-colors"
                      class:bg-amber-600={assoc.enabled}
                      class:bg-gray-600={!assoc.enabled}
                      on:click={() => toggleAssociation(assoc.extension)}
                    >
                      <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-5={assoc.enabled} />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

        {:else if activeTab === 'recent'}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-400">{recentFiles.length} recently opened files</span>
              <button
                class="px-3 py-1.5 bg-red-600/30 text-red-400 rounded-lg hover:bg-red-600/50 text-sm"
                on:click={clearRecent}
              >
                Clear History
              </button>
            </div>

            {#if recentFiles.length === 0}
              <div class="text-center py-8 text-gray-400">
                <p>No recently opened files</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each recentFiles as file (file.path)}
                  <div class="bg-gray-800 rounded-lg p-3">
                    <div class="text-white">{file.name}</div>
                    <div class="text-xs text-gray-500 mt-1">
                      <span>{file.path}</span>
                      <span class="mx-2">|</span>
                      <span>{formatSize(file.size)}</span>
                      <span class="mx-2">|</span>
                      <span>{formatDate(file.openedAt)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'settings'}
          <div class="space-y-4">
            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Default Behavior</h3>
              {#each [
                { label: 'Open files in Hearth', value: openInApp, toggle: () => { openInApp = !openInApp; saveData(); } },
                { label: 'Show preview on hover', value: showPreviewOnHover, toggle: () => { showPreviewOnHover = !showPreviewOnHover; saveData(); } },
                { label: 'Register as default handler', value: registerAsDefault, toggle: () => { registerAsDefault = !registerAsDefault; saveData(); } },
              ] as setting}
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-sm text-gray-300">{setting.label}</span>
                  <button
                    class="relative w-12 h-6 rounded-full transition-colors"
                    class:bg-amber-600={setting.value}
                    class:bg-gray-600={!setting.value}
                    on:click={setting.toggle}
                  >
                    <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-6={setting.value} />
                  </button>
                </label>
              {/each}
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-2">Supported Formats</h3>
              <div class="flex flex-wrap gap-2">
                {#each associations.filter(a => a.enabled) as assoc}
                  <span class="text-xs bg-amber-600/30 text-amber-400 px-2 py-1 rounded-full">{assoc.extension}</span>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
</script>
