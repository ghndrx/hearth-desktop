<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { clipboardHistory, type ClipboardEntry, type ClipboardContentType } from '$lib/tauri';

	interface Props {
		compact?: boolean;
		maxItems?: number;
	}

	let { compact = false, maxItems = 10 }: Props = $props();

	let entries = $state<ClipboardEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let copiedId = $state<string | null>(null);

	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await loadHistory();
		// Refresh every 5 seconds to catch new clipboard entries
		refreshInterval = setInterval(loadHistory, 5000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});

	async function loadHistory() {
		try {
			entries = await clipboardHistory.getHistory(maxItems);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load clipboard history';
		} finally {
			loading = false;
		}
	}

	async function pasteEntry(id: string) {
		try {
			await clipboardHistory.pasteEntry(id);
			copiedId = id;
			setTimeout(() => {
				copiedId = null;
			}, 1500);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to paste entry';
		}
	}

	async function removeEntry(id: string) {
		try {
			await clipboardHistory.removeEntry(id);
			entries = entries.filter((e) => e.id !== id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove entry';
		}
	}

	async function clearHistory() {
		try {
			await clipboardHistory.clearHistory();
			entries = [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to clear history';
		}
	}

	function getContentPreview(content: ClipboardContentType): string {
		switch (content.type) {
			case 'Text':
				return content.data.length > 100 ? content.data.substring(0, 100) + '...' : content.data;
			case 'Html':
				const text = content.data.plain || content.data.html;
				return text.length > 100 ? text.substring(0, 100) + '...' : text;
			case 'Image':
				return `Image (${content.data.width}×${content.data.height})`;
			case 'Files':
				return `${content.data.length} file(s)`;
			case 'Empty':
				return '(empty)';
			default:
				return '(unknown)';
		}
	}

	function getContentIcon(content: ClipboardContentType): string {
		switch (content.type) {
			case 'Text':
				return '📝';
			case 'Html':
				return '🌐';
			case 'Image':
				return '🖼️';
			case 'Files':
				return '📁';
			default:
				return '📋';
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) {
			return 'Just now';
		} else if (diff < 3600000) {
			const mins = Math.floor(diff / 60000);
			return `${mins}m ago`;
		} else if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}h ago`;
		} else {
			return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
	}

	const filteredEntries = $derived(
		searchQuery
			? entries.filter((e) => {
					const preview = getContentPreview(e.content).toLowerCase();
					return preview.includes(searchQuery.toLowerCase());
				})
			: entries
	);
</script>

<div class="clipboard-widget" class:compact>
	<div class="header">
		<span class="icon">📋</span>
		{#if !compact}
			<span class="title">Clipboard History</span>
		{/if}
		{#if entries.length > 0}
			<button class="clear-btn" onclick={clearHistory} title="Clear history">🗑️</button>
		{/if}
	</div>

	{#if !compact && entries.length > 3}
		<div class="search-box">
			<input
				type="text"
				placeholder="Search..."
				bind:value={searchQuery}
				class="search-input"
			/>
		</div>
	{/if}

	{#if loading}
		<div class="loading">Loading...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if filteredEntries.length === 0}
		<div class="empty">
			{searchQuery ? 'No matches found' : 'No clipboard history'}
		</div>
	{:else}
		<div class="entries-list" class:compact>
			{#each filteredEntries as entry (entry.id)}
				<button
					class="entry-item"
					class:copied={copiedId === entry.id}
					onclick={() => pasteEntry(entry.id)}
					title="Click to copy back to clipboard"
				>
					<span class="entry-icon">{getContentIcon(entry.content)}</span>
					<div class="entry-content">
						<span class="entry-preview">{getContentPreview(entry.content)}</span>
						{#if !compact}
							<span class="entry-time">{formatTimestamp(entry.timestamp)}</span>
						{/if}
					</div>
					{#if copiedId === entry.id}
						<span class="copied-badge">✓</span>
					{:else}
						<button
							class="remove-btn"
							onclick={(e) => {
								e.stopPropagation();
								removeEntry(entry.id);
							}}
							title="Remove"
						>
							×
						</button>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if !compact && entries.length > 0}
		<div class="footer">
			<span class="count">{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
			<button class="refresh-btn" onclick={loadHistory} title="Refresh">↻</button>
		</div>
	{/if}
</div>

<style>
	.clipboard-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
		min-width: 200px;
	}

	.clipboard-widget.compact {
		padding: 8px;
		gap: 6px;
		min-width: 150px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.icon {
		font-size: 14px;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
		flex: 1;
	}

	.clear-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 4px;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.clear-btn:hover {
		opacity: 1;
	}

	.search-box {
		margin-bottom: 4px;
	}

	.search-input {
		width: 100%;
		padding: 6px 10px;
		border: none;
		border-radius: 4px;
		background: var(--bg-primary, #36393f);
		color: var(--text-primary, #dcddde);
		font-size: 12px;
	}

	.search-input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.search-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent, #5865f2);
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 12px;
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	.error {
		color: var(--error, #ed4245);
	}

	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
	}

	.entries-list.compact {
		max-height: 120px;
	}

	.entry-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s ease, transform 0.1s ease;
		border: none;
		width: 100%;
		text-align: left;
	}

	.entry-item:hover {
		background: var(--bg-modifier-hover, #4f545c);
	}

	.entry-item:active {
		transform: scale(0.98);
	}

	.entry-item.copied {
		background: rgba(87, 242, 135, 0.2);
		border-left: 3px solid var(--success, #3ba55c);
	}

	.entry-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.entry-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.entry-preview {
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.entry-time {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.copied-badge {
		color: var(--success, #3ba55c);
		font-weight: bold;
		font-size: 14px;
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 16px;
		padding: 0 4px;
		opacity: 0;
		transition: opacity 0.2s ease, color 0.2s ease;
	}

	.entry-item:hover .remove-btn {
		opacity: 1;
	}

	.remove-btn:hover {
		color: var(--error, #ed4245);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 4px;
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
	}

	.count {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.refresh-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 4px;
		transition: color 0.2s ease, transform 0.2s ease;
	}

	.refresh-btn:hover {
		color: var(--text-primary, #dcddde);
		transform: rotate(180deg);
	}

	/* Scrollbar styling */
	.entries-list::-webkit-scrollbar {
		width: 6px;
	}

	.entries-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.entries-list::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-hover, #4f545c);
		border-radius: 3px;
	}

	.entries-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #72767d);
	}
</style>
