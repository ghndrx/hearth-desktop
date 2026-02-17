<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let name: string;
	export let collapsed = false;
	export let showAddButton = true;

	const dispatch = createEventDispatcher<{
		toggle: { collapsed: boolean };
		addChannel: void;
	}>();

	function handleToggle() {
		collapsed = !collapsed;
		dispatch('toggle', { collapsed });
	}

	function handleAddChannel(e: MouseEvent) {
		e.stopPropagation();
		dispatch('addChannel');
	}
</script>

<div class="channel-category" class:collapsed>
	<button 
		class="category-header" 
		on:click={handleToggle}
		aria-expanded={!collapsed}
		aria-label="{name} category, {collapsed ? 'collapsed' : 'expanded'}"
		type="button"
	>
		<svg
			viewBox="0 0 24 24"
			width="12"
			height="12"
			fill="currentColor"
			class="collapse-icon"
			class:rotated={!collapsed}
			aria-hidden="true"
		>
			<path d="M9.29 15.88L13.17 12 9.29 8.12a1 1 0 0 1 1.42-1.42l4.59 4.59a1 1 0 0 1 0 1.42l-4.59 4.59a1 1 0 0 1-1.42 0 1 1 0 0 1 0-1.42z"/>
		</svg>
		<span class="category-name">{name.toUpperCase()}</span>
	</button>

	{#if showAddButton}
		<button
			class="add-channel"
			title="Create Channel"
			aria-label="Create channel in {name}"
			on:click={handleAddChannel}
			type="button"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
				<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
			</svg>
		</button>
	{/if}
</div>

{#if !collapsed}
	<div class="category-channels" role="group" aria-label="{name} channels">
		<slot />
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

	.category-header:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
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

	.add-channel:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
		opacity: 1;
	}

	.channel-category:hover .add-channel {
		opacity: 1;
	}

	.category-channels {
		display: flex;
		flex-direction: column;
	}
</style>
