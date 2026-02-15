<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Message as MessageType, User } from '$lib/types';

	export let message: (MessageType & { author?: User }) | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	function handleClose() {
		dispatch('close');
	}
</script>

{#if message}
	<div class="reply-preview">
		<div class="reply-bar"></div>
		<div class="reply-content">
			<div class="reply-header">
				<span class="reply-label">Replying to</span>
				<span class="reply-author">{message.author?.username || 'Unknown'}</span>
			</div>
			<div class="reply-message">
				{message.content?.slice(0, 100) || ''}{message.content?.length > 100 ? '...' : ''}
			</div>
		</div>
		<button class="close-btn" on:click={handleClose} title="Cancel reply">
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.reply-preview {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px 8px 0 0;
		margin-bottom: 2px;
	}

	.reply-bar {
		width: 2px;
		background: var(--text-muted, #949ba4);
		border-radius: 1px;
		align-self: stretch;
		flex-shrink: 0;
	}

	.reply-content {
		flex: 1;
		min-width: 0;
	}

	.reply-header {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 2px;
	}

	.reply-label {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.reply-author {
		font-size: 12px;
		font-weight: 600;
		color: var(--brand-primary, #5865f2);
	}

	.reply-message {
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.close-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}
</style>
