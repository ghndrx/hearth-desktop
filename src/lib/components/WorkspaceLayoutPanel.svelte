<script lang="ts">
  import { onMount } from 'svelte';
  import {
    workspaceLayouts,
    activeLayout,
    layoutPresets,
    layoutCount,
    saveLayout,
    loadLayout,
    deleteLayout,
    renameLayout,
    getAllLayouts,
    getActiveLayout,
    setDefaultLayout,
    getPresets,
    applyPreset,
    exportLayout,
    importLayout,
    duplicateLayout,
    type WorkspaceLayout,
    type LayoutPreset
  } from '$lib/stores/workspaceLayouts';

  let {
    compact = false
  }: {
    compact?: boolean;
  } = $props();

  let newLayoutName = $state('');
  let saving = $state(false);
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let confirmDeleteId = $state<string | null>(null);
  let importJson = $state('');
  let showImport = $state(false);
  let importError = $state('');

  const CATEGORY_COLORS: Record<string, string> = {
    focus: 'bg-[#5865f2]',
    collaboration: 'bg-[#57f287]',
    minimal: 'bg-[#fee75c] text-[#1e1f22]',
    presentation: 'bg-[#eb459e]',
    default: 'bg-[#9b59b6]'
  };

  onMount(async () => {
    await Promise.all([getAllLayouts(), getActiveLayout(), getPresets()]);
  });

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async function handleSaveLayout() {
    if (!newLayoutName.trim() || saving) return;
    saving = true;
    try {
      await saveLayout({
        name: newLayoutName.trim(),
        description: null,
        window_x: 0,
        window_y: 0,
        window_width: 1280,
        window_height: 720,
        is_maximized: false,
        is_fullscreen: false,
        sidebar_visible: true,
        sidebar_width: 240,
        member_list_visible: true,
        member_list_width: 240,
        split_view_enabled: false,
        split_view_panels: [],
        active_server_id: null,
        active_channel_id: null,
        zen_mode: false,
        theme_override: null,
        is_default: false,
        keyboard_shortcut: null
      });
      newLayoutName = '';
    } catch {
      // save failed
    } finally {
      saving = false;
    }
  }

  async function handleLoad(id: string) {
    try {
      await loadLayout(id);
    } catch {
      // load failed
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      confirmDeleteId = id;
      return;
    }
    try {
      await deleteLayout(id);
    } catch {
      // delete failed
    }
    confirmDeleteId = null;
  }

  function startRename(layout: WorkspaceLayout) {
    renamingId = layout.id;
    renameValue = layout.name;
  }

  async function submitRename() {
    if (!renamingId || !renameValue.trim()) return;
    try {
      await renameLayout(renamingId, renameValue.trim());
    } catch {
      // rename failed
    }
    renamingId = null;
  }

  function cancelRename() {
    renamingId = null;
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateLayout(id);
    } catch {
      // duplicate failed
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultLayout(id);
    } catch {
      // set default failed
    }
  }

  async function handleExport(id: string) {
    try {
      const json = await exportLayout(id);
      await navigator.clipboard.writeText(json);
    } catch {
      // export failed
    }
  }

  async function handleImport() {
    if (!importJson.trim()) return;
    importError = '';
    try {
      await importLayout(importJson.trim());
      importJson = '';
      showImport = false;
    } catch {
      importError = 'Invalid layout JSON';
    }
  }

  async function handleApplyPreset(presetId: string) {
    try {
      await applyPreset(presetId);
    } catch {
      // apply failed
    }
  }

  function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.default;
  }
</script>

<div class="flex flex-col h-full bg-[#2b2d31] text-[#f2f3f5]" class:text-sm={compact}>
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-[#1e1f22]">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-[#5865f2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
      <h2 class="text-sm font-semibold uppercase tracking-wide text-[#b5bac1]">Workspace Layouts</h2>
      {#if $layoutCount > 0}
        <span class="bg-[#313338] text-[#b5bac1] text-xs px-1.5 py-0.5 rounded-full">{$layoutCount}</span>
      {/if}
    </div>
    <button
      class="text-[#b5bac1] hover:text-[#f2f3f5] p-1 rounded hover:bg-[#383a40] transition-colors"
      onclick={() => { showImport = !showImport; importError = ''; }}
      title="Import layout"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
  </div>

  <div class="flex-1 overflow-y-auto">
    <!-- Save Current Layout -->
    <div class="px-4 py-3 border-b border-[#1e1f22]">
      <form
        class="flex gap-2"
        onsubmit={(e) => { e.preventDefault(); handleSaveLayout(); }}
      >
        <input
          type="text"
          placeholder="Layout name..."
          bind:value={newLayoutName}
          class="flex-1 bg-[#1e1f22] border border-transparent rounded-md px-3 py-1.5 text-sm text-[#f2f3f5] placeholder-[#4e5058] outline-none focus:border-[#5865f2] transition-colors"
        />
        <button
          type="submit"
          disabled={!newLayoutName.trim() || saving}
          class="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          {saving ? 'Saving...' : 'Save Current'}
        </button>
      </form>
    </div>

    <!-- Import Section -->
    {#if showImport}
      <div class="px-4 py-3 border-b border-[#1e1f22] bg-[#232428]">
        <p class="text-xs text-[#b5bac1] mb-2">Paste layout JSON to import:</p>
        <textarea
          bind:value={importJson}
          placeholder='{"name": "My Layout", ...}'
          rows="3"
          class="w-full bg-[#1e1f22] border border-transparent rounded-md px-3 py-2 text-sm text-[#f2f3f5] placeholder-[#4e5058] outline-none focus:border-[#5865f2] resize-none font-mono transition-colors"
        ></textarea>
        {#if importError}
          <p class="text-xs text-[#ed4245] mt-1">{importError}</p>
        {/if}
        <div class="flex justify-end gap-2 mt-2">
          <button
            onclick={() => { showImport = false; importJson = ''; importError = ''; }}
            class="text-xs text-[#b5bac1] hover:text-[#f2f3f5] px-3 py-1.5 rounded-md hover:bg-[#383a40] transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={handleImport}
            disabled={!importJson.trim()}
            class="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            Import
          </button>
        </div>
      </div>
    {/if}

    <!-- Saved Layouts -->
    <div class="px-4 py-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">Saved Layouts</h3>

      {#if $workspaceLayouts.length === 0}
        <div class="flex flex-col items-center py-8 text-center">
          <svg class="w-10 h-10 text-[#4e5058] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p class="text-sm text-[#b5bac1]">No saved layouts</p>
          <p class="text-xs text-[#4e5058] mt-1">Save your current window arrangement to get started.</p>
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          {#each $workspaceLayouts as layout (layout.id)}
            <div
              class="bg-[#313338] rounded-lg p-3 hover:bg-[#383a40] transition-colors group"
              class:border-l-2={$activeLayout?.id === layout.id}
              class:border-[#5865f2]={$activeLayout?.id === layout.id}
              class:border-l-0={$activeLayout?.id !== layout.id}
            >
              {#if renamingId === layout.id}
                <!-- Rename form -->
                <form
                  class="flex gap-2"
                  onsubmit={(e) => { e.preventDefault(); submitRename(); }}
                >
                  <input
                    type="text"
                    bind:value={renameValue}
                    class="flex-1 bg-[#1e1f22] border border-[#5865f2] rounded px-2 py-1 text-sm text-[#f2f3f5] outline-none"
                    autofocus
                  />
                  <button type="submit" class="text-xs text-[#57f287] hover:underline">Save</button>
                  <button type="button" onclick={cancelRename} class="text-xs text-[#b5bac1] hover:underline">Cancel</button>
                </form>
              {:else}
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      {#if layout.is_default}
                        <svg class="w-3.5 h-3.5 text-[#fee75c] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                        </svg>
                      {/if}
                      <span class="text-sm font-medium text-[#f2f3f5] truncate">{layout.name}</span>
                      {#if $activeLayout?.id === layout.id}
                        <span class="text-[10px] bg-[#5865f2] text-white px-1.5 py-0.5 rounded-full flex-shrink-0">Active</span>
                      {/if}
                    </div>
                    {#if layout.description}
                      <p class="text-xs text-[#b5bac1] mt-0.5 truncate">{layout.description}</p>
                    {/if}
                    <p class="text-[11px] text-[#4e5058] mt-1">{formatDate(layout.updated_at)}</p>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onclick={() => handleLoad(layout.id)}
                    class="text-xs bg-[#5865f2] hover:bg-[#4752c4] text-white px-2 py-1 rounded transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onclick={() => startRename(layout)}
                    class="text-xs bg-[#4e5058] hover:bg-[#6d6f78] text-[#f2f3f5] px-2 py-1 rounded transition-colors"
                    title="Rename"
                  >
                    Rename
                  </button>
                  <button
                    onclick={() => handleDuplicate(layout.id)}
                    class="text-xs bg-[#4e5058] hover:bg-[#6d6f78] text-[#f2f3f5] px-2 py-1 rounded transition-colors"
                    title="Duplicate"
                  >
                    Duplicate
                  </button>
                  <button
                    onclick={() => handleSetDefault(layout.id)}
                    class="text-xs bg-[#4e5058] hover:bg-[#6d6f78] text-[#f2f3f5] px-2 py-1 rounded transition-colors"
                    title={layout.is_default ? 'Already default' : 'Set as default'}
                    disabled={layout.is_default}
                    class:opacity-40={layout.is_default}
                    class:cursor-not-allowed={layout.is_default}
                  >
                    {layout.is_default ? 'Default' : 'Set Default'}
                  </button>
                  <button
                    onclick={() => handleExport(layout.id)}
                    class="text-xs bg-[#4e5058] hover:bg-[#6d6f78] text-[#f2f3f5] px-2 py-1 rounded transition-colors"
                    title="Export to clipboard"
                  >
                    Export
                  </button>
                  <button
                    onclick={() => handleDelete(layout.id)}
                    class="text-xs px-2 py-1 rounded transition-colors"
                    class:bg-[#4e5058]={confirmDeleteId !== layout.id}
                    class:hover:bg-[#ed4245]={confirmDeleteId !== layout.id}
                    class:hover:text-white={confirmDeleteId !== layout.id}
                    class:text-[#f2f3f5]={confirmDeleteId !== layout.id}
                    class:bg-[#ed4245]={confirmDeleteId === layout.id}
                    class:text-white={confirmDeleteId === layout.id}
                    onblur={() => { confirmDeleteId = null; }}
                    title="Delete"
                  >
                    {confirmDeleteId === layout.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Presets -->
    <div class="px-4 py-3 border-t border-[#1e1f22]">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-2">Presets</h3>

      {#if $layoutPresets.length === 0}
        <p class="text-xs text-[#4e5058] py-4 text-center">No presets available</p>
      {:else}
        <div class="flex flex-col gap-2">
          {#each $layoutPresets as preset (preset.id)}
            <div class="bg-[#313338] rounded-lg p-3 hover:bg-[#383a40] transition-colors group">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-[#f2f3f5]">{preset.name}</span>
                    <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white {getCategoryColor(preset.category)}">
                      {preset.category}
                    </span>
                  </div>
                  {#if preset.layout.description}
                    <p class="text-xs text-[#b5bac1] mt-1">{preset.layout.description}</p>
                  {/if}
                </div>
                <button
                  onclick={() => handleApplyPreset(preset.id)}
                  class="text-xs bg-[#5865f2] hover:bg-[#4752c4] text-white px-3 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                >
                  Apply
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
