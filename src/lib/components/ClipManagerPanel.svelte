<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface ClipEntry {
		id: string;
		content: string;
		content_type: string;
		preview: string;
		byte_size: number;
		pinned: boolean;
		created_at: number;
		source_app: string;
	}

	interface ClipManagerState {
		entries: ClipEntry[];
		max_entries: number;
		total_clips: number;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let state = $state<ClipManagerState | null>(null);
	let searchQuery = $state('');
	let filterType = $state('all');
	let error = $state<string | null>(null);

	let filteredEntries = $derived<ClipEntry[]>(() => {
		if (!state) return [];
		let items = state.entries;
		if (filterType !== 'all') {
			items = items.filter(e => e.content_type === filterType);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter(e => e.content.toLowerCase().includes(q));
		}
		return items;
	});

	let pinnedCount = $derived(() => state?.entries.filter(e => e.pinned).length ?? 0);

	onMount(() => {
		if (open) loadState();
	});

	$effect(() => {
		if (open) loadState();
	});

	async function loadState() {
		try {
			error = null;
			state = await invoke<ClipManagerState>('clipmgr_get_state');
		} catch (e) {
			error = String(e);
		}
	}

	async function copyEntry(id: string) {
		try {
			const content = await invoke<string>('clipmgr_copy_entry', { id });
			await navigator.clipboard.writeText(content);
		} catch (e) {
			error = String(e);
		}
	}

	async function togglePin(id: string, pinned: boolean) {
		try {
			state = await invoke<ClipManagerState>('clipmgr_pin', { id, pinned: !pinned });
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteEntry(id: string) {
		try {
			state = await invoke<ClipManagerState>('clipmgr_delete', { id });
		} catch (e) {
			error = String(e);
		}
	}

	async function clearAll() {
		try {
			state = await invoke<ClipManagerState>('clipmgr_clear', { keepPinned: true });
		} catch (e) {
			error = String(e);
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function timeAgo(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function handleClose() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
			e.preventDefault();
		}
	}

	const typeIcons: Record<string, string> = {
		text: 'T',
		url: '#',
		code: '<>',
		image: 'img',
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div class="panel-backdrop" transition:fade={{ duration: 100 }} onclick={handleClose} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="panel" transition:slide={{ duration: 200, axis: 'x' }} onclick={(e) => e.stopPropagation()}>
			<div class="panel-header">
				<div class="header-left">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
						<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
					</svg>
					<h2>Clipboard Manager</h2>
				</div>
				<div class="header-actions">
					<button class="action-btn" onclick={clearAll} title="Clear unpinned">Clear</button>
					<button class="close-btn" onclick={handleClose} title="Close">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="toolbar">
				<input type="text" bind:value={searchQuery} placeholder="Search clipboard..." class="search-input" />
			</div>

			<div class="filter-bar">
				{#each ['all', 'text', 'url', 'code'] as t}
					<button class="filter-chip" class:active={filterType === t} onclick={() => filterType = t}>
						{t}
					</button>
				{/each}
			</div>

			<div class="clip-list">
				{#each filteredEntries() as entry (entry.id)}
					<div class="clip-item" class:pinned={entry.pinned} transition:slide={{ duration: 100 }}>
						<div class="clip-meta">
							<span class="type-badge" class:url={entry.content_type === 'url'} class:code={entry.content_type === 'code'}>
								{typeIcons[entry.content_type] || 'T'}
							</span>
							<span class="clip-time">{timeAgo(entry.created_at)}</span>
							<span class="clip-size">{formatSize(entry.byte_size)}</span>
						</div>
						<div class="clip-preview">{entry.preview}</div>
						<div class="clip-actions">
							<button class="icon-btn" onclick={() => copyEntry(entry.id)} title="Copy">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="9" y="9" width="13" height="13" rx="2" />
									<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
								</svg>
							</button>
							<button class="icon-btn" class:active={entry.pinned} onclick={() => togglePin(entry.id, entry.pinned)} title={entry.pinned ? 'Unpin' : 'Pin'}>
								<svg viewBox="0 0 24 24" width="14" height="14" fill={entry.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
								</svg>
							</button>
							<button class="icon-btn danger" onclick={() => deleteEntry(entry.id)} title="Delete">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
								</svg>
							</button>
						</div>
					</div>
				{:else}
					<div class="empty-state">
						<span class="empty-icon">C</span>
						<p>No clipboard entries</p>
						<p class="hint">Copy text to start tracking</p>
					</div>
				{/each}
			</div>

			{#if state}
				<div class="panel-footer">
					<span class="stats">{state.entries.length} entries ({pinnedCount()} pinned)</span>
					<span class="hint">Total: {state.total_clips} clips</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end; }
	.panel { width: 420px; max-width: 90vw; height: 100%; background: var(--bg-secondary, #2b2d31); display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,0.3); }
	.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.header-left { display: flex; align-items: center; gap: 10px; color: var(--text-primary, #f2f3f5); }
	.header-left h2 { font-size: 16px; font-weight: 600; margin: 0; }
	.header-actions { display: flex; align-items: center; gap: 8px; }
	.action-btn { padding: 4px 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); }
	.action-btn:hover { color: var(--text-primary, #f2f3f5); }
	.close-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.close-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.error-bar { padding: 8px 16px; background: var(--status-danger, #f23f43); color: white; font-size: 13px; }
	.toolbar { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.search-input { flex: 1; background: var(--bg-tertiary, #1e1f22); border: none; border-radius: 6px; padding: 8px 12px; color: var(--text-primary, #f2f3f5); font-size: 13px; outline: none; }
	.search-input::placeholder { color: var(--text-muted, #949ba4); }
	.search-input:focus { box-shadow: 0 0 0 2px var(--brand-primary, #5865f2); }
	.filter-bar { display: flex; gap: 4px; padding: 8px 16px; }
	.filter-chip { padding: 3px 10px; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); border: none; border-radius: 12px; font-size: 11px; font-weight: 500; cursor: pointer; text-transform: capitalize; }
	.filter-chip.active { background: var(--brand-primary, #5865f2); color: white; }
	.clip-list { flex: 1; overflow-y: auto; padding: 4px 12px; }
	.clip-item { padding: 10px 12px; border-radius: 6px; margin-bottom: 4px; background: var(--bg-tertiary, #1e1f22); }
	.clip-item:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); }
	.clip-item.pinned { border-left: 3px solid var(--brand-primary, #5865f2); }
	.clip-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
	.type-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); font-family: monospace; }
	.type-badge.url { color: #5865f2; background: rgba(88,101,242,0.1); }
	.type-badge.code { color: #23a55a; background: rgba(35,165,90,0.1); }
	.clip-time { font-size: 11px; color: var(--text-muted, #949ba4); }
	.clip-size { font-size: 11px; color: var(--text-muted, #949ba4); margin-left: auto; }
	.clip-preview { font-size: 13px; color: var(--text-secondary, #b5bac1); white-space: pre-wrap; word-break: break-word; max-height: 48px; overflow: hidden; line-height: 1.4; }
	.clip-actions { display: flex; gap: 4px; margin-top: 6px; justify-content: flex-end; opacity: 0; transition: opacity 0.1s; }
	.clip-item:hover .clip-actions { opacity: 1; }
	.icon-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.icon-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.icon-btn.active { color: var(--brand-primary, #5865f2); }
	.icon-btn.danger:hover { color: var(--status-danger, #f23f43); }
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; color: var(--text-muted, #949ba4); gap: 8px; }
	.empty-icon { font-size: 36px; font-weight: 700; opacity: 0.3; color: var(--text-primary, #f2f3f5); }
	.empty-state p { margin: 0; font-size: 14px; }
	.hint { opacity: 0.6; font-size: 12px; }
	.panel-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border-faint, rgba(255,255,255,0.06)); font-size: 11px; color: var(--text-muted, #949ba4); }
	.stats { font-weight: 500; }
	.clip-list::-webkit-scrollbar { width: 6px; }
	.clip-list::-webkit-scrollbar-track { background: transparent; }
	.clip-list::-webkit-scrollbar-thumb { background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; }
</style>
