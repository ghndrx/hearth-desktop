<script lang="ts">
  /**
   * NativeFileWatcher.svelte
   *
   * Watches local directories for file changes using Tauri FS events.
   * Used to detect new screenshots, downloads, or file modifications
   * that the user may want to share in chat.
   */
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { createEventDispatcher } from 'svelte';

  export let enabled: boolean = true;
  export let watchPaths: string[] = [];
  export let extensions: string[] = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'pdf'];
  export let debounceMs: number = 500;

  interface FileChangeEvent {
    path: string;
    kind: 'create' | 'modify' | 'remove' | 'rename';
    timestamp: number;
  }

  const dispatch = createEventDispatcher<{
    fileCreated: { path: string; name: string; extension: string };
    fileModified: { path: string; name: string };
    fileRemoved: { path: string; name: string };
    error: { message: string };
  }>();

  let isWatching = false;
  let watchedPaths: string[] = [];
  let unlistenFileChange: UnlistenFn | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let recentEvents = new Set<string>();

  function getExtension(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  function getFileName(path: string): string {
    const separator = path.includes('\\') ? '\\' : '/';
    const parts = path.split(separator);
    return parts[parts.length - 1] || '';
  }

  function shouldProcess(path: string): boolean {
    if (extensions.length === 0) return true;
    const ext = getExtension(path);
    return extensions.includes(ext);
  }

  function handleFileEvent(event: FileChangeEvent) {
    if (!shouldProcess(event.path)) return;

    // Deduplicate events within debounce window
    const eventKey = `${event.kind}:${event.path}`;
    if (recentEvents.has(eventKey)) return;
    recentEvents.add(eventKey);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      recentEvents.clear();
    }, debounceMs);

    const name = getFileName(event.path);
    const extension = getExtension(event.path);

    switch (event.kind) {
      case 'create':
        dispatch('fileCreated', { path: event.path, name, extension });
        break;
      case 'modify':
        dispatch('fileModified', { path: event.path, name });
        break;
      case 'remove':
        dispatch('fileRemoved', { path: event.path, name });
        break;
    }
  }

  async function startWatching() {
    if (!enabled || watchPaths.length === 0) return;

    try {
      // Resolve default paths if none provided
      const paths = watchPaths.length > 0
        ? watchPaths
        : await invoke<string[]>('get_default_watch_paths');

      await invoke('start_file_watcher', { paths });

      unlistenFileChange = await listen<FileChangeEvent>('file-change', (event) => {
        handleFileEvent(event.payload);
      });

      watchedPaths = paths;
      isWatching = true;
    } catch (err) {
      console.warn('[FileWatcher] Failed to start:', err);
      dispatch('error', { message: String(err) });
    }
  }

  async function stopWatching() {
    if (!isWatching) return;

    try {
      await invoke('stop_file_watcher');
    } catch {
      // Ignore stop errors
    }

    if (unlistenFileChange) {
      unlistenFileChange();
      unlistenFileChange = null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    recentEvents.clear();
    isWatching = false;
    watchedPaths = [];
  }

  onMount(() => {
    if (enabled) startWatching();
  });

  onDestroy(() => {
    stopWatching();
  });

  $: if (enabled && !isWatching) {
    startWatching();
  } else if (!enabled && isWatching) {
    stopWatching();
  }
</script>

{#if $$slots.default}
  <slot {isWatching} paths={watchedPaths} />
{/if}
