<script lang="ts">
	import { onMount } from 'svelte';
	import {
		clipboardPreviewState,
		clipboardEntries,
		pinnedEntries,
		imageEntries,
		textEntries,
		loadClipboardPreviewState,
		pinClipboardEntry,
		deleteClipboardEntry,
		clearClipboardPreview,
		searchClipboard,
		listenToClipboardPreviewEvents,
		type ClipboardMediaEntry
	} from '$lib/stores/clipboardPreview';

	let filter: 'all' | 'images' | 'text' | 'pinned' = 'all';
	let searchQuery = '';
	let searchResults: ClipboardMediaEntry[] | null = null;

	onMount(() => {
		loadClipboardPreviewState();
		listenToClipboardPreviewEvents();
	});

	async function handleSearch() {
		if (!searchQuery.trim()) {
			searchResults = null;
			return;
		}
		searchResults = await searchClipboard(searchQuery);
	}

	async function handlePin(id: string) {
		await pinClipboardEntry(id);
	}

	async function handleDelete(id: string) {
		await deleteClipboardEntry(id);
	}

	async function handleClear() {
		await clearClipboardPreview(true);
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDate(ts: string): string {
		return new Date(ts).toLocaleTimeString();
	}

	$: displayEntries = (() => {
		if (searchResults) return searchResults;
		switch (filter) {
			case 'images': return $imageEntries;
			case 'text': return $textEntries;
			case 'pinned': return $pinnedEntries;
			default: return $clipboardEntries;
		}
	})();
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
			</svg>
			<h2 class="text-lg font-semibold">Clipboard Preview</h2>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-xs text-dark-300">{$clipboardPreviewState.totalCaptured} captured</span>
			<button
				onclick={handleClear}
				class="rounded bg-dark-600 px-3 py-1 text-xs hover:bg-dark-500"
			>Clear</button>
		</div>
	</div>

	<div class="flex border-b border-dark-600">
		{#each [
			{ key: 'all', label: 'All' },
			{ key: 'images', label: 'Images' },
			{ key: 'text', label: 'Text' },
			{ key: 'pinned', label: 'Pinned' }
		] as tab}
			<button
				onclick={() => { filter = tab.key as typeof filter; searchResults = null; }}
				class="flex-1 py-2 text-xs transition-colors {filter === tab.key ? 'border-b-2 border-hearth-500 text-hearth-400' : 'text-dark-300 hover:text-gray-100'}"
			>{tab.label}</button>
		{/each}
	</div>

	<div class="border-b border-dark-600 p-3">
		<input
			bind:value={searchQuery}
			oninput={handleSearch}
			placeholder="Search clipboard..."
			class="w-full rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
		/>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if displayEntries.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-dark-400">
				<svg class="mb-3 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				<p class="text-sm">No clipboard entries</p>
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#each displayEntries as entry}
					<div class="group relative rounded-lg bg-dark-700 p-3">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="rounded bg-dark-600 px-2 py-0.5 text-xs {entry.contentType === 'image' ? 'text-purple-400' : 'text-blue-400'}">
									{entry.contentType}
								</span>
								<span class="text-xs text-dark-400">{formatBytes(entry.sizeBytes)}</span>
								{#if entry.isPinned}
									<span class="text-xs text-hearth-400">pinned</span>
								{/if}
							</div>
							<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button
									onclick={() => handlePin(entry.id)}
									class="rounded p-1 text-dark-300 hover:bg-dark-600 hover:text-hearth-400"
									title={entry.isPinned ? 'Unpin' : 'Pin'}
								>
									<svg class="h-3.5 w-3.5" fill={entry.isPinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
									</svg>
								</button>
								<button
									onclick={() => handleDelete(entry.id)}
									class="rounded p-1 text-dark-300 hover:bg-red-600 hover:text-white"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>

						{#if entry.contentType === 'image' && entry.thumbnailBase64}
							<div class="flex items-center gap-3">
								<img
									src="data:image/png;base64,{entry.thumbnailBase64}"
									alt="Clipboard image"
									class="h-16 w-16 rounded object-cover"
								/>
								<div class="text-xs text-dark-400">
									{#if entry.width && entry.height}
										<p>{entry.width} x {entry.height}</p>
									{/if}
									{#if entry.format}
										<p>{entry.format.toUpperCase()}</p>
									{/if}
								</div>
							</div>
						{:else if entry.textPreview}
							<p class="text-sm text-dark-200 line-clamp-3">{entry.textPreview}</p>
						{/if}

						<p class="mt-2 text-right text-xs text-dark-500">{formatDate(entry.timestamp)}</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
