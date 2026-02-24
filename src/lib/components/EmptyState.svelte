<script lang="ts">
	/**
	 * EmptyState Component
	 * 
	 * A consistent empty state component for use throughout the UI.
	 * Supports multiple variants: default, compact, and illustration.
	 */
	import { createEventDispatcher } from 'svelte';

	export let variant: 'default' | 'compact' | 'illustration' = 'default';
	export let icon: string | null = null;
	export let title: string;
	export let description: string | null = null;
	export let actionLabel: string | null = null;
	export let actionIcon: string | null = null;

	// Allow custom SVG icon via slot
	export let customIcon = false;

	const dispatch = createEventDispatcher<{
		action: void;
	}>();

	function handleAction() {
		dispatch('action');
	}

	// Size configurations for variants
	const iconSizes = {
		default: 48,
		compact: 32,
		illustration: 80
	};

	$: iconSize = iconSizes[variant];
</script>

<div 
	class="empty-state"
	class:compact={variant === 'compact'}
	class:illustration={variant === 'illustration'}
	role="status"
	aria-label={title}
>
	{#if customIcon}
		<div class="icon-container" style="--icon-size: {iconSize}px" aria-hidden="true">
			<slot name="icon" />
		</div>
	{:else if icon}
		<div class="icon-container" style="--icon-size: {iconSize}px" aria-hidden="true">
			<span class="icon-text">{icon}</span>
		</div>
	{/if}

	<div class="content">
		<h3 class="title">{title}</h3>
		{#if description}
			<p class="description">{description}</p>
		{/if}
	</div>

	{#if actionLabel}
		<button 
			type="button"
			class="action-button"
			on:click={handleAction}
			aria-label={actionLabel}
		>
			{#if actionIcon}
				<span class="action-icon" aria-hidden="true">{actionIcon}</span>
			{/if}
			{actionLabel}
		</button>
	{/if}

	<slot />
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 40px 24px;
		gap: 16px;
		min-height: 200px;
	}

	.empty-state.compact {
		padding: 24px 16px;
		gap: 12px;
		min-height: 120px;
	}

	.empty-state.illustration {
		padding: 48px 32px;
		gap: 20px;
		min-height: 280px;
	}

	.icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--icon-size);
		height: var(--icon-size);
		border-radius: 50%;
		background-color: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.illustration .icon-container {
		background-color: var(--bg-modifier-accent, #4e5058);
	}

	.icon-text {
		font-size: calc(var(--icon-size) * 0.45);
		line-height: 1;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 300px;
	}

	.compact .content {
		gap: 4px;
		max-width: 220px;
	}

	.title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		line-height: 1.25;
	}

	.compact .title {
		font-size: 14px;
	}

	.illustration .title {
		font-size: 20px;
	}

	.description {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
		line-height: 1.4;
	}

	.compact .description {
		font-size: 12px;
	}

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 20px;
		margin-top: 8px;
		background-color: var(--brand-primary, #5865f2);
		color: white;
		font-size: 14px;
		font-weight: 500;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.action-button:hover {
		background-color: var(--brand-hover, #4752c4);
	}

	.action-button:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
	}

	.compact .action-button {
		padding: 8px 16px;
		font-size: 13px;
	}

	.action-icon {
		font-size: 1em;
	}

	/* Support custom SVG icons in slot */
	.icon-container :global(svg) {
		width: calc(var(--icon-size) * 0.5);
		height: calc(var(--icon-size) * 0.5);
		color: var(--text-muted, #949ba4);
	}
</style>
