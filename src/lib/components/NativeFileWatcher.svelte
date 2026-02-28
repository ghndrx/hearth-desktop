<script lang="ts">
	/**
	 * NativeFileWatcher.svelte
	 *
	 * Watches local directories for file changes using native Tauri file watcher.
	 * Used to detect new screenshots, downloads, or file modifications
	 * that the user may want to share in chat.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface Props {
		enabled?: boolean;
		watchPaths?: string[];
		extensions?: string[];
		recursive?: boolean;
		debounceMs?: number;
		onfilecreated?: (detail: { path: string; name: string; extension: string; size: number }) => void;
		onfilemodified?: (detail: { path: string; name: string; size: number }) => void;
		onfileremoved?: (detail: { path: string; name: string }) => void;
		onerror?: (detail: { message: string }) => void;
		children?: import('svelte').Snippet<[{ isWatching: boolean; paths: string[] }]>;
	}

	let {
		enabled = true,
		watchPaths = [],
		extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'pdf'],
		recursive = false,
		debounceMs = 500,
		onfilecreated,
		onfilemodified,
		onfileremoved,
		onerror,
		children
	}: Props = $props();

	interface NativeFileChangeEvent {
		watcher_id: number;
		path: string;
		change_type: 'created' | 'modified' | 'deleted';
		file_name: string;
		size: number;
		timestamp: number;
	}

	let isWatching = $state(false);
	let watchedPaths = $state<string[]>([]);
	let watcherIds = $state<number[]>([]);
	let unlistenFileChange: UnlistenFn | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let recentEvents = new Set<string>();

	function getExtension(path: string): string {
		const parts = path.split('.');
		return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
	}

	function shouldProcess(path: string): boolean {
		if (extensions.length === 0) return true;
		const ext = getExtension(path);
		return extensions.includes(ext);
	}

	function handleFileEvent(event: NativeFileChangeEvent) {
		if (!shouldProcess(event.path)) return;

		// Deduplicate events within debounce window
		const eventKey = `${event.change_type}:${event.path}`;
		if (recentEvents.has(eventKey)) return;
		recentEvents.add(eventKey);

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			recentEvents.clear();
		}, debounceMs);

		const extension = getExtension(event.path);

		switch (event.change_type) {
			case 'created':
				onfilecreated?.({ path: event.path, name: event.file_name, extension, size: event.size });
				break;
			case 'modified':
				onfilemodified?.({ path: event.path, name: event.file_name, size: event.size });
				break;
			case 'deleted':
				onfileremoved?.({ path: event.path, name: event.file_name });
				break;
		}
	}

	async function startWatching() {
		if (!enabled || watchPaths.length === 0) return;

		try {
			unlistenFileChange = await listen<NativeFileChangeEvent>('filewatcher:change', (event) => {
				handleFileEvent(event.payload);
			});

			const ids: number[] = [];
			for (const path of watchPaths) {
				try {
					const id = await invoke<number>('watch_directory', { path, recursive });
					ids.push(id);
				} catch (err) {
					console.warn(`[FileWatcher] Failed to watch ${path}:`, err);
				}
			}

			watcherIds = ids;
			watchedPaths = watchPaths;
			isWatching = true;
		} catch (err) {
			console.warn('[FileWatcher] Failed to start:', err);
			onerror?.({ message: String(err) });
		}
	}

	async function stopWatching() {
		if (!isWatching) return;

		for (const id of watcherIds) {
			try {
				await invoke('unwatch_directory', { watcherId: id });
			} catch {
				// Ignore stop errors
			}
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
		watcherIds = [];
		isWatching = false;
		watchedPaths = [];
	}

	onMount(() => {
		if (enabled) startWatching();
	});

	onDestroy(() => {
		stopWatching();
	});

	$effect(() => {
		if (enabled && !isWatching) {
			startWatching();
		} else if (!enabled && isWatching) {
			stopWatching();
		}
	});
</script>

{#if children}
	{@render children({ isWatching, paths: watchedPaths })}
{/if}
