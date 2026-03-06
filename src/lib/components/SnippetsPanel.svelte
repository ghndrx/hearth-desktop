<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface Snippet {
		id: string;
		title: string;
		content: string;
		category: string;
		language: string | null;
		tags: string[];
		useCount: number;
		isFavorite: boolean;
		createdAt: string;
		updatedAt: string;
	}

	interface SnippetState {
		snippets: Snippet[];
		categories: string[];
		activeCategory: string | null;
		isVisible: boolean;
	}

	let state = $state<SnippetState | null>(null);
	let filteredSnippets = $state<Snippet[]>([]);
	let searchQuery = $state('');
	let activeCategory = $state<string | null>(null);
	let showCreate = $state(false);
	let editingId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let copied = $state<string | null>(null);

	// Create form
	let newTitle = $state('');
	let newContent = $state('');
	let newCategory = $state('General');
	let newLanguage = $state('');

	onMount(async () => {
		await loadState();
	});

	async function loadState() {
		try {
			state = await invoke<SnippetState>('snippets_get_state');
			filterSnippets();
		} catch (e) {
			error = String(e);
		}
	}

	function filterSnippets() {
		if (!state) return;
		let results = state.snippets;
		if (activeCategory) {
			results = results.filter(s => s.category === activeCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			results = results.filter(s =>
				s.title.toLowerCase().includes(q) ||
				s.content.toLowerCase().includes(q) ||
				s.tags.some(t => t.toLowerCase().includes(q))
			);
		}
		filteredSnippets = results;
	}

	async function createSnippet() {
		if (!newTitle.trim() || !newContent.trim()) return;
		try {
			await invoke('snippets_create', {
				title: newTitle.trim(),
				content: newContent,
				category: newCategory
			});
			newTitle = '';
			newContent = '';
			newLanguage = '';
			showCreate = false;
			await loadState();
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteSnippet(id: string) {
		try {
			await invoke('snippets_delete', { id });
			await loadState();
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleFavorite(id: string) {
		try {
			await invoke('snippets_toggle_favorite', { id });
			await loadState();
		} catch (e) {
			error = String(e);
		}
	}

	async function copySnippet(snippet: Snippet) {
		try {
			await navigator.clipboard.writeText(snippet.content);
			await invoke('snippets_record_use', { id: snippet.id });
			copied = snippet.id;
			setTimeout(() => copied = null, 1500);
			await loadState();
		} catch (e) {
			error = String(e);
		}
	}

	$effect(() => {
		searchQuery;
		activeCategory;
		filterSnippets();
	});
</script>

<div class="flex flex-col gap-3 p-4 h-full overflow-y-auto bg-dark-800 text-gray-200">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-white">Snippets</h2>
		<button
			onclick={() => showCreate = !showCreate}
			class="px-2 py-1 text-xs rounded bg-hearth-600 hover:bg-hearth-700 text-white transition-colors"
		>
			{showCreate ? 'Cancel' : '+ New'}
		</button>
	</div>

	{#if error}
		<div class="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">{error}</div>
	{/if}

	<!-- Search -->
	<input
		type="text"
		bind:value={searchQuery}
		placeholder="Search snippets..."
		class="bg-dark-700 border border-dark-500 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-hearth-500 focus:outline-none"
	/>

	<!-- Categories -->
	{#if state}
		<div class="flex gap-1 flex-wrap">
			<button
				onclick={() => activeCategory = null}
				class="px-2 py-0.5 text-xs rounded-full transition-colors {activeCategory === null ? 'bg-hearth-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}"
			>
				All
			</button>
			{#each state.categories as cat}
				<button
					onclick={() => activeCategory = cat}
					class="px-2 py-0.5 text-xs rounded-full transition-colors {activeCategory === cat ? 'bg-hearth-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}"
				>
					{cat}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Create Form -->
	{#if showCreate && state}
		<div class="bg-dark-700 rounded-lg p-3 flex flex-col gap-2 border border-dark-500">
			<input
				type="text"
				bind:value={newTitle}
				placeholder="Snippet title"
				class="bg-dark-600 border border-dark-500 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none"
			/>
			<textarea
				bind:value={newContent}
				placeholder="Snippet content..."
				rows="4"
				class="bg-dark-600 border border-dark-500 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 font-mono focus:outline-none resize-none"
			></textarea>
			<div class="flex gap-2">
				<select bind:value={newCategory} class="flex-1 text-xs bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-gray-300">
					{#each state.categories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
				<button
					onclick={createSnippet}
					disabled={!newTitle.trim() || !newContent.trim()}
					class="px-4 py-1.5 text-xs bg-hearth-600 hover:bg-hearth-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	{/if}

	<!-- Snippet List -->
	<div class="flex flex-col gap-2">
		{#each filteredSnippets as snippet (snippet.id)}
			<div class="bg-dark-700 rounded-lg p-3 group">
				<div class="flex items-start justify-between mb-1">
					<div class="flex items-center gap-2">
						<button
							onclick={() => toggleFavorite(snippet.id)}
							class="text-xs {snippet.isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'} transition-colors"
							title={snippet.isFavorite ? 'Unfavorite' : 'Favorite'}
						>
							{snippet.isFavorite ? '\u2605' : '\u2606'}
						</button>
						<span class="text-sm font-medium text-white">{snippet.title}</span>
					</div>
					<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							onclick={() => copySnippet(snippet)}
							class="px-2 py-0.5 text-xs bg-dark-600 hover:bg-dark-500 rounded text-gray-300 transition-colors"
						>
							{copied === snippet.id ? 'Copied!' : 'Copy'}
						</button>
						<button
							onclick={() => deleteSnippet(snippet.id)}
							class="px-2 py-0.5 text-xs bg-red-900/50 hover:bg-red-800/50 rounded text-red-400 transition-colors"
						>
							Delete
						</button>
					</div>
				</div>
				<pre class="text-xs text-gray-300 font-mono bg-dark-800 rounded p-2 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">{snippet.content}</pre>
				<div class="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
					<span class="px-1.5 py-0.5 rounded bg-dark-600">{snippet.category}</span>
					{#if snippet.useCount > 0}
						<span>Used {snippet.useCount}x</span>
					{/if}
					{#each snippet.tags as tag}
						<span class="px-1 py-0.5 rounded bg-dark-600">#{tag}</span>
					{/each}
				</div>
			</div>
		{:else}
			<div class="text-center text-gray-500 text-sm py-8">
				{searchQuery ? 'No matching snippets' : 'No snippets yet. Create one!'}
			</div>
		{/each}
	</div>
</div>
