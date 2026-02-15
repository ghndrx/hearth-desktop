<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { focusModeStore } from '$lib/stores/focusMode';
	import { toasts } from '$lib/stores/toasts';

	let isHovered = false;

	async function handleClick() {
		await focusModeStore.toggle();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

{#if $focusModeStore.active}
	<button
		class="focus-indicator"
		class:hovered={isHovered}
		on:click={handleClick}
		on:keydown={handleKeydown}
		on:mouseenter={() => isHovered = true}
		on:mouseleave={() => isHovered = false}
		transition:fade={{ duration: 200 }}
		title={isHovered ? 'Click to exit focus mode' : 'Focus mode active - only mentions and DMs'}
		aria-label="Focus mode is active. Click to disable."
		type="button"
	>
		<span class="icon">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
				<path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm3.5 8.5L12 13l-1.5 1.5L9 13l-1.5 1.5L6 13l3-3 1.5 1.5L12 10l3 4.5z" opacity="0.3"/>
			</svg>
		</span>
		<span class="text" transition:slide={{ axis: 'x', duration: 150 }}>
			{#if isHovered}
				Exit Focus
			{:else}
				Focus Mode
			{/if}
		</span>
	</button>
{/if}

<style>
	.focus-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 16px;
		background: rgba(88, 101, 242, 0.15);
		border: 1px solid rgba(88, 101, 242, 0.3);
		color: #5865f2;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
	}

	.focus-indicator:hover {
		background: rgba(88, 101, 242, 0.25);
		border-color: rgba(88, 101, 242, 0.5);
	}

	.focus-indicator:active {
		transform: scale(0.98);
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.text {
		white-space: nowrap;
	}
</style>
