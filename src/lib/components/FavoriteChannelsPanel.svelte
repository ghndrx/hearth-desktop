<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { goto } from '$app/navigation';

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

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let favorites = $state<FavoriteChannel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let dragIndex = $state<number | null>(null);
	let dropIndex = $state<number | null>(null);
	let confirmClearAll = $state(false);
	let filter = $state('');

	const filteredFavorites = $derived(
		filter
			? favorites.filter(
					(f) =>
						f.channel_name.toLowerCase().includes(filter.toLowerCase()) ||
						(f.server_name?.toLowerCase().includes(filter.toLowerCase()) ?? false)
				)
			: favorites
	);

	onMount(() => {
		loadFavorites();

		const unlistenAdded = listen('favorites:added', () => loadFavorites());
		const unlistenRemoved = listen('favorites:removed', () => loadFavorites());
		const unlistenReordered = listen('favorites:reordered', () => loadFavorites());
		const unlistenCleared = listen('favorites:cleared', () => {
			favorites = [];
		});

		return () => {
			unlistenAdded.then((fn) => fn());
			unlistenRemoved.then((fn) => fn());
			unlistenReordered.then((fn) => fn());
			unlistenCleared.then((fn) => fn());
		};
	});

	async function loadFavorites() {
		try {
			favorites = await invoke<FavoriteChannel[]>('favorites_list');
			loading = false;
			error = null;
		} catch (e) {
			error = String(e);
			loading = false;
		}
	}

	async function removeFavorite(channelId: string) {
		try {
			await invoke('favorites_remove', { channelId });
			favorites = favorites.filter((f) => f.channel_id !== channelId);
		} catch (e) {
			error = String(e);
		}
	}

	async function clearAll() {
		try {
			await invoke('favorites_clear');
			favorites = [];
			confirmClearAll = false;
		} catch (e) {
			error = String(e);
		}
	}

	function navigateToChannel(fav: FavoriteChannel) {
		if (fav.server_id) {
			goto(`/channels/${fav.server_id}/${fav.channel_id}`);
		} else {
			goto(`/channels/@me/${fav.channel_id}`);
		}
		onClose?.();
	}

	function getChannelIcon(type: string): string {
		switch (type) {
			case 'voice':
				return '\u{1F50A}';
			case 'announcement':
				return '\u{1F4E2}';
			case 'dm':
				return '@';
			default:
				return '#';
		}
	}

	function formatDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
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
			error = String(e);
			await loadFavorites();
		}
	}

	function handleDragEnd() {
		dragIndex = null;
		dropIndex = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="panel-overlay" onclick={onClose} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="favorites-panel"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-label="Favorite Channels"
		>
			<div class="panel-header">
				<div class="header-left">
					<span class="header-icon">{'\u2B50'}</span>
					<h3>Favorite Channels</h3>
					<span class="count-badge">{favorites.length}</span>
				</div>
				<div class="header-right">
					{#if favorites.length > 0}
						{#if confirmClearAll}
							<button class="action-btn danger" onclick={clearAll}>Confirm</button>
							<button class="action-btn" onclick={() => (confirmClearAll = false)}>Cancel</button>
						{:else}
							<button class="action-btn danger" onclick={() => (confirmClearAll = true)}
								>Clear All</button
							>
						{/if}
					{/if}
					<button class="close-btn" onclick={onClose} aria-label="Close">{'\u2715'}</button>
				</div>
			</div>

			{#if favorites.length > 3}
				<div class="search-bar">
					<input
						class="search-input"
						type="text"
						placeholder="Filter favorites..."
						bind:value={filter}
					/>
				</div>
			{/if}

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<div class="favorites-list">
				{#if loading}
					<div class="empty-state">Loading favorites...</div>
				{:else if filteredFavorites.length === 0}
					<div class="empty-state">
						{#if filter}
							<p>No favorites match "{filter}"</p>
						{:else}
							<span class="empty-icon">{'\u2B50'}</span>
							<p>No favorite channels yet</p>
							<p class="empty-hint">
								Right-click a channel and select "Add to Favorites" to pin it here.
							</p>
						{/if}
					</div>
				{:else}
					{#each filteredFavorites as fav, i (fav.id)}
						<div
							class="favorite-item"
							class:dragging={dragIndex === i}
							class:drop-target={dropIndex === i && dragIndex !== i}
							draggable="true"
							ondragstart={() => handleDragStart(i)}
							ondragover={(e) => handleDragOver(e, i)}
							ondrop={() => handleDrop(i)}
							ondragend={handleDragEnd}
							role="listitem"
						>
							<button class="fav-main" onclick={() => navigateToChannel(fav)}>
								<span class="channel-icon" class:voice={fav.channel_type === 'voice'}>
									{getChannelIcon(fav.channel_type)}
								</span>
								<div class="fav-info">
									<span class="channel-name">{fav.channel_name}</span>
									{#if fav.server_name}
										<span class="server-name">{fav.server_name}</span>
									{:else}
										<span class="server-name">Direct Message</span>
									{/if}
								</div>
								<span class="added-date">{formatDate(fav.added_at)}</span>
							</button>
							<button
								class="remove-btn"
								onclick={() => removeFavorite(fav.channel_id)}
								aria-label="Remove from favorites"
								title="Remove from favorites"
							>
								{'\u2715'}
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.panel-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.15s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.favorites-panel {
		width: 440px;
		max-height: 520px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: slideIn 0.2s ease;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border, #3f4147);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		font-size: 18px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #dbdee1);
	}

	.count-badge {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78);
		font-weight: 600;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.action-btn {
		padding: 4px 10px;
		border-radius: 4px;
		border: none;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.action-btn:hover {
		color: var(--text-primary, #dbdee1);
	}
	.action-btn.danger {
		color: #ed4245;
	}
	.action-btn.danger:hover {
		background: rgba(237, 66, 69, 0.15);
	}

	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: none;
		background: none;
		color: var(--text-muted, #6d6f78);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}
	.close-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	.search-bar {
		padding: 0 16px 12px;
	}
	.search-input {
		width: 100%;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}
	.search-input:focus {
		border-color: #5865f2;
	}
	.search-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.error {
		margin: 0 16px;
		padding: 8px 12px;
		border-radius: 6px;
		background: rgba(237, 66, 69, 0.1);
		color: #ed4245;
		font-size: 12px;
	}

	.favorites-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 16px;
		color: var(--text-muted, #6d6f78);
		text-align: center;
		gap: 4px;
	}
	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
		opacity: 0.4;
	}
	.empty-state p {
		margin: 0;
		font-size: 13px;
	}
	.empty-hint {
		font-size: 12px !important;
		color: var(--text-muted, #6d6f78);
		opacity: 0.7;
		margin-top: 4px !important;
	}

	.favorite-item {
		display: flex;
		align-items: center;
		border-radius: 6px;
		transition: background 0.1s;
		margin-bottom: 2px;
	}
	.favorite-item:hover {
		background: var(--bg-tertiary, #1e1f22);
	}
	.favorite-item.dragging {
		opacity: 0.4;
	}
	.favorite-item.drop-target {
		border-top: 2px solid #5865f2;
	}

	.fav-main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border: none;
		background: none;
		color: var(--text-primary, #dbdee1);
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}
	.fav-main:hover {
		color: #fff;
	}

	.channel-icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: rgba(88, 101, 242, 0.12);
		color: #5865f2;
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.channel-icon.voice {
		background: rgba(35, 165, 90, 0.12);
		color: #23a55a;
	}

	.fav-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.channel-name {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.server-name {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.added-date {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.remove-btn {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: none;
		background: none;
		color: var(--text-muted, #6d6f78);
		font-size: 10px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: all 0.15s;
		flex-shrink: 0;
		margin-right: 4px;
	}
	.favorite-item:hover .remove-btn {
		opacity: 1;
	}
	.remove-btn:hover {
		color: #ed4245;
		background: rgba(237, 66, 69, 0.1);
	}
</style>
