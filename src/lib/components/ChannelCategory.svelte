<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		name: string;
		collapsed?: boolean;
		showAddButton?: boolean;
		onToggle?: (collapsed: boolean) => void;
		onAddChannel?: () => void;
		children?: Snippet;
	}

	let {
		name,
		collapsed = $bindable(false),
		showAddButton = true,
		onToggle,
		onAddChannel,
		children
	}: Props = $props();

	function handleToggle() {
		collapsed = !collapsed;
		onToggle?.(collapsed);
	}

	function handleAddChannel(e: MouseEvent) {
		e.stopPropagation();
		onAddChannel?.();
	}
</script>

<div class="channel-category" class:collapsed>
	<button class="category-header" onclick={handleToggle}>
		<svg
			viewBox="0 0 24 24"
			width="12"
			height="12"
			fill="currentColor"
			class="collapse-icon"
			class:rotated={!collapsed}
		>
			<path
				d="M9.29 15.88L13.17 12 9.29 8.12a1 1 0 0 1 1.42-1.42l4.59 4.59a1 1 0 0 1 0 1.42l-4.59 4.59a1 1 0 0 1-1.42 0 1 1 0 0 1 0-1.42z"
			/>
		</svg>
		<span class="category-name">{name.toUpperCase()}</span>
	</button>

	{#if showAddButton}
		<button class="add-channel" title="Create Channel" onclick={handleAddChannel}>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
				<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
			</svg>
		</button>
	{/if}
</div>

{#if !collapsed && children}
	<div class="category-channels">
		{@render children()}
	</div>
{/if}

<style>
	.channel-category {
		display: flex;
		align-items: center;
		padding: 16px 8px 4px 2px;
		user-select: none;
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: 2px;
		background: none;
		border: none;
		color: #949ba4;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		cursor: pointer;
		flex: 1;
		text-align: left;
		padding: 0;
		text-transform: uppercase;
	}

	.category-header:hover {
		color: #dbdee1;
	}

	.collapse-icon {
		transition: transform 0.1s ease;
		flex-shrink: 0;
	}

	.collapse-icon.rotated {
		transform: rotate(90deg);
	}

	.category-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.add-channel {
		background: none;
		border: none;
		color: #949ba4;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
	}

	.add-channel:hover {
		color: #dbdee1;
	}

	.channel-category:hover .add-channel {
		opacity: 1;
	}

	.category-channels {
		display: flex;
		flex-direction: column;
	}
</style>
