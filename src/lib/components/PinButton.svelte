<script lang="ts">
	import { pinnedPanels, type PanelType } from '$lib/stores/pinnedPanels';
	import { derived } from 'svelte/store';

	interface Props {
		/** Type of item being pinned */
		type: PanelType;
		/** ID of the item */
		targetId: string;
		/** Display title for the pinned panel */
		title: string;
		/** Server ID (for channels) */
		serverId?: string;
		/** Icon/avatar URL */
		iconUrl?: string;
		/** Button size */
		size?: 'sm' | 'md';
		/** Show label text */
		showLabel?: boolean;
	}

	let {
		type,
		targetId,
		title,
		serverId,
		iconUrl,
		size = 'sm',
		showLabel = false
	}: Props = $props();

	// Reactive check if this item is pinned
	const isPinned = derived(pinnedPanels, ($store) =>
		$store.panels.some((p) => p.type === type && p.targetId === targetId)
	);

	function handleClick(event: MouseEvent) {
		event.stopPropagation();

		if ($isPinned) {
			pinnedPanels.unpinByTarget(type, targetId);
		} else {
			pinnedPanels.pinPanel({
				type,
				targetId,
				title,
				serverId,
				iconUrl
			});
		}
	}
</script>

<button
	class="pin-button"
	class:pinned={$isPinned}
	class:size-sm={size === 'sm'}
	class:size-md={size === 'md'}
	onclick={handleClick}
	title={$isPinned ? 'Unpin from split view' : 'Pin to split view'}
	aria-pressed={$isPinned}
>
	{#if $isPinned}
		<!-- Pinned icon -->
		<svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor">
			<path
				d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"
			/>
		</svg>
		{#if showLabel}
			<span>Unpin</span>
		{/if}
	{:else}
		<!-- Unpinned icon -->
		<svg class="pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"
			/>
		</svg>
		{#if showLabel}
			<span>Pin</span>
		{/if}
	{/if}
</button>

<style>
	.pin-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--text-muted, #949ba4);
	}

	.pin-button:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-primary, #f2f3f5);
	}

	.pin-button.pinned {
		color: var(--brand-primary, #ef4444);
	}

	.pin-button.pinned:hover {
		color: var(--brand-primary-hover, #dc2626);
	}

	.size-sm {
		width: 28px;
		height: 28px;
		padding: 4px;
	}

	.size-sm .pin-icon {
		width: 16px;
		height: 16px;
	}

	.size-md {
		padding: 6px 10px;
		height: 32px;
	}

	.size-md .pin-icon {
		width: 18px;
		height: 18px;
	}

	.pin-button span {
		font-size: 13px;
		font-weight: 500;
	}
</style>
