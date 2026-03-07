<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	interface ClipEntry {
		id: number;
		content: string;
		contentType: string;
		timestamp: string;
		pinned: boolean;
		charCount: number;
		wordCount: number;
	}

	interface ClipRingStats {
		entries: ClipEntry[];
		total: number;
		pinnedCount: number;
		capacity: number;
	}

	let stats = $state<ClipRingStats | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<ClipEntry[] | null>(null);
	let error = $state<string | null>(null);

	const typeColors: Record<string, string> = {
		text: '#43b581',
		url: '#5865f2',
		code: '#faa61a',
		path: '#b9bbbe'
	};

	async function loadEntries() {
		try {
			stats = await invoke<ClipRingStats>('clipring_list');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function addFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			if (!text || !text.trim()) return;
			stats = await invoke<ClipRingStats>('clipring_add', { content: text });
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function copyEntry(entry: ClipEntry) {
		try {
			await navigator.clipboard.writeText(entry.content);
		} catch {
			// silently ignore
		}
	}

	async function togglePin(entry: ClipEntry) {
		try {
			await invoke('clipring_pin', { id: entry.id, pinned: !entry.pinned });
			await loadEntries();
		} catch (e) {
			error = String(e);
		}
	}

	async function removeEntry(id: number) {
		try {
			await invoke('clipring_remove', { id });
			await loadEntries();
		} catch (e) {
			error = String(e);
		}
	}

	async function clearUnpinned() {
		try {
			await invoke('clipring_clear');
			await loadEntries();
		} catch (e) {
			error = String(e);
		}
	}

	async function doSearch() {
		if (!searchQuery.trim()) {
			searchResults = null;
			return;
		}
		try {
			searchResults = await invoke<ClipEntry[]>('clipring_search', { query: searchQuery });
		} catch (e) {
			error = String(e);
		}
	}

	function relativeTime(timestamp: string): string {
		const now = Date.now();
		const then = new Date(timestamp).getTime();
		const diff = Math.floor((now - then) / 1000);
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function truncate(text: string, max: number = 100): string {
		if (text.length <= max) return text;
		return text.slice(0, max) + '...';
	}

	$effect(() => {
		loadEntries();
	});

	let displayEntries = $derived(searchResults ?? stats?.entries ?? []);
</script>

<div class="clipring-panel" class:compact>
	<div class="header">
		<span class="title">Clipboard Ring</span>
		<button class="action-btn" onclick={addFromClipboard} title="Add from clipboard">+ Paste</button>
	</div>

	<div class="search-bar">
		<input
			type="text"
			placeholder="Search clips..."
			bind:value={searchQuery}
			oninput={doSearch}
		/>
	</div>

	{#if stats}
		<div class="stats-bar">
			<span class="stat">{stats.total}/{stats.capacity} entries</span>
			<span class="stat">{stats.pinnedCount} pinned</span>
		</div>
	{/if}

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="entries-list">
		{#each displayEntries as entry (entry.id)}
			<div class="entry" class:pinned={entry.pinned}>
				<div class="entry-header">
					<span class="type-badge" style="background: {typeColors[entry.contentType] ?? '#72767d'}">
						{entry.contentType}
					</span>
					<span class="timestamp">{relativeTime(entry.timestamp)}</span>
				</div>
				<div class="entry-content">{truncate(entry.content)}</div>
				<div class="entry-meta">
					<span class="meta-info">{entry.charCount} chars, {entry.wordCount} words</span>
					<div class="entry-actions">
						<button
							class="icon-btn"
							class:active={entry.pinned}
							onclick={() => togglePin(entry)}
							title={entry.pinned ? 'Unpin' : 'Pin'}
						>
							{entry.pinned ? '&#9733;' : '&#9734;'}
						</button>
						<button class="icon-btn" onclick={() => copyEntry(entry)} title="Copy">&#128203;</button>
						<button class="icon-btn delete" onclick={() => removeEntry(entry.id)} title="Delete">&#10005;</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				{searchQuery ? 'No matching clips' : 'No clipboard entries yet'}
			</div>
		{/each}
	</div>

	{#if stats && stats.total > stats.pinnedCount}
		<button class="clear-btn" onclick={clearUnpinned}>Clear unpinned</button>
	{/if}
</div>

<style>
	.clipring-panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
		max-height: 500px;
	}

	.clipring-panel.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.action-btn {
		background: var(--accent, #5865f2);
		border: none;
		color: #fff;
		font-size: 11px;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.action-btn:hover {
		filter: brightness(1.1);
	}

	.search-bar input {
		width: 100%;
		background: var(--bg-primary, #36393f);
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		border-radius: 4px;
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		padding: 6px 8px;
		outline: none;
		box-sizing: border-box;
	}

	.search-bar input:focus {
		border-color: var(--accent, #5865f2);
	}

	.search-bar input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.stats-bar {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-muted, #72767d);
		padding: 2px 0;
	}

	.error {
		font-size: 11px;
		color: #f04747;
		padding: 4px;
	}

	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		max-height: 360px;
	}

	.entry {
		background: var(--bg-secondary, #2f3136);
		border-radius: 6px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-left: 3px solid transparent;
	}

	.entry.pinned {
		border-left-color: var(--accent, #5865f2);
	}

	.entry-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.type-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		padding: 1px 5px;
		border-radius: 3px;
		color: #fff;
		letter-spacing: 0.5px;
	}

	.timestamp {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.entry-content {
		font-size: 12px;
		color: var(--text-primary, #dcddde);
		word-break: break-word;
		white-space: pre-wrap;
		line-height: 1.4;
		font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
	}

	.entry-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.meta-info {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.entry-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 13px;
		padding: 2px 4px;
		border-radius: 3px;
		line-height: 1;
	}

	.icon-btn:hover {
		color: var(--text-primary, #dcddde);
		background: var(--bg-modifier-accent, #4f545c);
	}

	.icon-btn.active {
		color: var(--accent, #5865f2);
	}

	.icon-btn.delete:hover {
		color: #f04747;
	}

	.empty-state {
		text-align: center;
		font-size: 12px;
		color: var(--text-muted, #72767d);
		padding: 16px 0;
	}

	.clear-btn {
		background: none;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		color: var(--text-muted, #72767d);
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		align-self: center;
	}

	.clear-btn:hover {
		color: var(--text-primary, #dcddde);
		border-color: var(--text-muted, #72767d);
	}
</style>
