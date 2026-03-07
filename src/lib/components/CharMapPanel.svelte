<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface CharEntry {
		char: string;
		name: string;
		codepoint: string;
	}

	interface CharCategory {
		id: string;
		name: string;
		icon: string;
		chars: CharEntry[];
	}

	let categories = $state<CharCategory[]>([]);
	let activeCategory = $state<string>('');
	let searchQuery = $state('');
	let searchResults = $state<CharEntry[]>([]);
	let copiedChar = $state<string | null>(null);
	let recentChars = $state<CharEntry[]>([]);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			categories = await invoke<CharCategory[]>('charmap_get_categories');
			if (categories.length > 0) activeCategory = categories[0].id;
			const stored = localStorage.getItem('charmap_recent');
			if (stored) recentChars = JSON.parse(stored);
		} catch (e) {
			error = String(e);
		}
	});

	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(async () => {
			if (!searchQuery.trim()) {
				searchResults = [];
				return;
			}
			try {
				searchResults = await invoke<CharEntry[]>('charmap_search', { query: searchQuery });
			} catch (e) {
				error = String(e);
			}
		}, 200);
	}

	async function copyChar(entry: CharEntry) {
		try {
			await navigator.clipboard.writeText(entry.char);
			copiedChar = entry.char;
			setTimeout(() => { copiedChar = null; }, 1500);

			// Add to recent, dedup, keep 20 max
			recentChars = [entry, ...recentChars.filter(r => r.char !== entry.char)].slice(0, 20);
			localStorage.setItem('charmap_recent', JSON.stringify(recentChars));
		} catch {
			error = 'Failed to copy';
		}
	}

	let displayChars = $derived(
		searchQuery.trim()
			? searchResults
			: categories.find(c => c.id === activeCategory)?.chars ?? []
	);
</script>

<div class="charmap-panel">
	<div class="panel-header">
		<h3>Character Map</h3>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<input
		type="text"
		class="search-input"
		placeholder="Search characters..."
		bind:value={searchQuery}
		oninput={handleSearch}
	/>

	{#if !searchQuery.trim()}
		<div class="category-tabs">
			{#each categories as cat (cat.id)}
				<button
					class="cat-tab"
					class:active={activeCategory === cat.id}
					onclick={() => activeCategory = cat.id}
					title={cat.name}
				>
					{cat.name}
				</button>
			{/each}
		</div>
	{/if}

	{#if recentChars.length > 0 && !searchQuery.trim()}
		<div class="section-label">Recent</div>
		<div class="char-grid">
			{#each recentChars as entry (entry.char + '_recent')}
				<button
					class="char-cell"
					class:copied={copiedChar === entry.char}
					onclick={() => copyChar(entry)}
					title="{entry.name}\n{entry.codepoint}"
				>
					<span class="char-display">{entry.char}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if searchQuery.trim()}
		<div class="section-label">Results ({searchResults.length})</div>
	{/if}

	<div class="char-grid">
		{#each displayChars as entry (entry.codepoint)}
			<button
				class="char-cell"
				class:copied={copiedChar === entry.char}
				onclick={() => copyChar(entry)}
				title="{entry.name}\n{entry.codepoint}"
			>
				<span class="char-display">{entry.char}</span>
			</button>
		{:else}
			{#if searchQuery.trim()}
				<div class="empty-state">No characters found.</div>
			{/if}
		{/each}
	</div>

	{#if copiedChar}
		<div class="toast">Copied {copiedChar}</div>
	{/if}
</div>

<style>
	.charmap-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
		position: relative;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.error { font-size: 12px; color: #ed4245; }

	.search-input {
		width: 100%; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px;
		box-sizing: border-box;
	}
	.search-input:focus { outline: none; border-color: #5865f2; }
	.search-input::placeholder { color: var(--text-muted, #6d6f78); }

	.category-tabs {
		display: flex; gap: 4px; flex-wrap: wrap;
	}
	.cat-tab {
		padding: 4px 8px; border-radius: 12px; border: none;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px; cursor: pointer; white-space: nowrap;
	}
	.cat-tab:hover { color: var(--text-primary, #dbdee1); }
	.cat-tab.active { background: #5865f2; color: white; }

	.section-label {
		font-size: 10px; font-weight: 600;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase; letter-spacing: 0.5px;
	}

	.char-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		gap: 4px;
		max-height: 320px;
		overflow-y: auto;
	}

	.char-cell {
		display: flex; align-items: center; justify-content: center;
		width: 100%; aspect-ratio: 1;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		cursor: pointer;
		transition: all 0.15s;
		padding: 0;
	}
	.char-cell:hover {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.1);
		transform: scale(1.1);
	}
	.char-cell.copied {
		border-color: #3ba55d;
		background: rgba(59, 165, 93, 0.15);
	}

	.char-display {
		font-size: 18px;
		line-height: 1;
		color: var(--text-primary, #dbdee1);
	}

	.empty-state {
		grid-column: 1 / -1;
		text-align: center; padding: 24px 16px;
		font-size: 12px; color: var(--text-muted, #6d6f78);
	}

	.toast {
		position: absolute; bottom: 12px; left: 50%;
		transform: translateX(-50%);
		background: #3ba55d; color: white;
		padding: 6px 14px; border-radius: 6px;
		font-size: 12px; font-weight: 500;
		animation: fadeIn 0.2s ease;
		pointer-events: none;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateX(-50%) translateY(4px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
</style>
