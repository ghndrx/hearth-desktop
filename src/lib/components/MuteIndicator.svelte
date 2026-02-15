<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { muteStore } from '$lib/stores/mute';
	import { toasts } from '$lib/stores/toasts';

	let isHovered = false;

	async function handleClick() {
		const newState = await muteStore.toggle();
		// Toast is already shown in the store, but we can add haptic feedback here later
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

{#if $muteStore.muted}
	<button
		class="mute-indicator"
		class:hovered={isHovered}
		on:click={handleClick}
		on:keydown={handleKeydown}
		on:mouseenter={() => isHovered = true}
		on:mouseleave={() => isHovered = false}
		transition:fade={{ duration: 200 }}
		title={isHovered ? 'Click to unmute notifications' : 'Notifications muted'}
		aria-label="Notifications are muted. Click to unmute."
		type="button"
	>
		<span class="icon">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
				<path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
				<path d="M6.5 4.5L19.5 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		</span>
		<span class="text" transition:slide={{ axis: 'x', duration: 150 }}>
			{#if isHovered}
				Unmute
			{:else}
				Muted
			{/if}
		</span>
	</button>
{/if}

<style>
	.mute-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 16px;
		background: rgba(237, 66, 69, 0.15);
		border: 1px solid rgba(237, 66, 69, 0.3);
		color: #ed4245;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
	}

	.mute-indicator:hover {
		background: rgba(237, 66, 69, 0.25);
		border-color: rgba(237, 66, 69, 0.5);
	}

	.mute-indicator:active {
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
