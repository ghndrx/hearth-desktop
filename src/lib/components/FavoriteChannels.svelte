<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface FavoriteChannel {
		id: string;
		channel_id: string;
		channel_name: string;
		server_id: string | null;
		server_name: string | null;
		channel_type: string;
		position: number;
		added_at: number;
	}

	export let collapsed = false;

	const dispatch = createEventDispatcher<{
		navigate: { channelId: string; serverId: string | null };
	}>();

	let favorites: FavoriteChannel[] = [];
	let loading = true;
	let dragIndex: number | null = null;
	let dropIndex: number | null = null;

	onMount(async () => {
		await loadFavorites();

		const unlistenAdd = await listen('favorites:added', () => loadFavorites());
		const unlistenRemove = await listen('favorites:removed', () => loadFavorites());
		const unlistenReorder = await listen('favorites:reordered', () => loadFavorites());
		const unlistenClear = await listen('favorites:cleared', () => {
			favorites = [];
		});

		return () => {
			unlistenAdd();
			unlistenRemove();
			unlistenReorder();
			unlistenClear();
		};
	});

	async function loadFavorites() {
		try {
			favorites = await invoke<FavoriteChannel[]>('favorites_list');
		} catch (e) {
			console.error('Failed to load favorites:', e);
			favorites = [];
		} finally {
			loading = false;
		}
	}

	async function removeFavorite(channelId: string) {
		try {
			await invoke('favorites_remove', { channelId });
		} catch (e) {
			console.error('Failed to remove favorite:', e);
		}
	}

	function navigateToChannel(fav: FavoriteChannel) {
		dispatch('navigate', { channelId: fav.channel_id, serverId: fav.server_id });
	}

	function getChannelIcon(type: string): string {
		switch (type) {
			case 'voice':
				return '\u{1F50A}';
			case 'dm':
				return '\u{1F4AC}';
			case 'announcement':
				return '\u{1F4E2}';
			default:
				return '#';
		}
	}

	function handleDragStart(index: number) {
		dragIndex = index;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dropIndex = index;
	}

	async function handleDrop(index: number) {
		if (dragIndex === null || dragIndex === index) {
			dragIndex = null;
			dropIndex = null;
			return;
		}
		const reordered = [...favorites];
		const [moved] = reordered.splice(dragIndex, 1);
		reordered.splice(index, 0, moved);
		favorites = reordered;
		dragIndex = null;
		dropIndex = null;

		try {
			await invoke('favorites_reorder', {
				channelIds: reordered.map((f) => f.channel_id)
			});
		} catch (e) {
			console.error('Failed to reorder favorites:', e);
			await loadFavorites();
		}
	}

	function toggleCollapsed() {
		collapsed = !collapsed;
	}
</script>

{#if !loading && favorites.length > 0}
	<div class="favorites-section">
		<button class="favorites-header" on:click={toggleCollapsed}>
			<svg
				class="collapse-icon"
				class:collapsed
				width="12"
				height="12"
				viewBox="0 0 12 12"
				fill="currentColor"
			>
				<path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" fill="none" stroke-width="1.5" />
			</svg>
			<span class="header-label">FAVORITES</span>
			<span class="header-count">{favorites.length}</span>
		</button>

		{#if !collapsed}
			<div class="favorites-list">
				{#each favorites as fav, i (fav.id)}
					<div
						class="favorite-item"
						class:drag-over={dropIndex === i && dragIndex !== i}
						draggable="true"
						role="button"
						tabindex="0"
						on:click={() => navigateToChannel(fav)}
						on:keydown={(e) => e.key === 'Enter' && navigateToChannel(fav)}
						on:dragstart={() => handleDragStart(i)}
						on:dragover={(e) => handleDragOver(e, i)}
						on:drop={() => handleDrop(i)}
						on:dragend={() => {
							dragIndex = null;
							dropIndex = null;
						}}
					>
						<span class="channel-icon">{getChannelIcon(fav.channel_type)}</span>
						<span class="channel-name">{fav.channel_name}</span>
						{#if fav.server_name}
							<span class="server-badge">{fav.server_name}</span>
						{/if}
						<button
							class="remove-btn"
							title="Remove from favorites"
							on:click|stopPropagation={() => removeFavorite(fav.channel_id)}
						>
							&times;
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.favorites-section {
		padding: 4px 0;
		border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
	}

	.favorites-header {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 6px 8px;
		border: none;
		background: none;
		color: var(--text-muted, #96989d);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		cursor: pointer;
	}

	.favorites-header:hover {
		color: var(--text-secondary, #dcddde);
	}

	.collapse-icon {
		transition: transform 0.15s ease;
		flex-shrink: 0;
	}

	.collapse-icon.collapsed {
		transform: rotate(-90deg);
	}

	.header-label {
		flex: 1;
		text-align: left;
	}

	.header-count {
		font-size: 10px;
		background: var(--bg-tertiary, rgba(255, 255, 255, 0.06));
		border-radius: 8px;
		padding: 0 5px;
		min-width: 16px;
		text-align: center;
	}

	.favorites-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 0 4px;
	}

	.favorite-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-muted, #96989d);
		font-size: 14px;
		transition: background 0.1s ease;
		user-select: none;
	}

	.favorite-item:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.04));
		color: var(--text-primary, #fff);
	}

	.favorite-item:hover .remove-btn {
		opacity: 1;
	}

	.favorite-item.drag-over {
		border-top: 2px solid var(--accent-color, #5865f2);
	}

	.channel-icon {
		font-size: 14px;
		width: 18px;
		text-align: center;
		flex-shrink: 0;
		opacity: 0.6;
	}

	.channel-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.server-badge {
		font-size: 10px;
		background: var(--bg-tertiary, rgba(255, 255, 255, 0.06));
		color: var(--text-muted, #96989d);
		padding: 1px 5px;
		border-radius: 3px;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.remove-btn {
		opacity: 0;
		border: none;
		background: none;
		color: var(--text-muted, #96989d);
		font-size: 16px;
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		flex-shrink: 0;
		transition: opacity 0.1s ease;
	}

	.remove-btn:hover {
		color: var(--text-danger, #ed4245);
	}
</style>
