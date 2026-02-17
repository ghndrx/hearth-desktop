<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Reaction } from '$lib/types';

	export let reactions: Reaction[] = [];

	const dispatch = createEventDispatcher<{
		react: string;
	}>();

	function handleReactionClick(emoji: string) {
		dispatch('react', emoji);
	}
</script>

<div class="reactions">
	{#each reactions as reaction}
		<button
			class="reaction-pill"
			class:reacted={(reaction.user_ids?.length ?? 0) > 0}
			title={(reaction.user_ids?.length ?? 0) > 0
				? 'You reacted with {reaction.emoji}'
				: 'React with {reaction.emoji}'}
			on:click={() => handleReactionClick(reaction.emoji)}
		>
			<span class="emoji">{reaction.emoji}</span>
			<span class="count">{reaction.count}</span>
		</button>
	{/each}
</div>

<style>
	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}

	.reaction-pill {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		background: var(--bg-tertiary, #202225);
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			transform 0.1s;
	}

	.reaction-pill:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		border-color: var(--text-muted, #949ba4);
		transform: scale(1.05);
	}

	.reaction-pill.reacted {
		background: rgba(88, 101, 242, 0.15);
		border-color: #5865f2;
	}

	.reaction-pill.reacted:hover {
		background: rgba(88, 101, 242, 0.3);
	}

	.emoji {
		font-size: 16px;
		line-height: 1;
	}

	.count {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		font-weight: 600;
		min-width: 12px;
		text-align: center;
	}

	.reaction-pill.reacted .count {
		color: #5865f2;
	}
</style>
