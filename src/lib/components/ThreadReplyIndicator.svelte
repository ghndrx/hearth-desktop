<script lang="ts">
	/**
	 * ThreadReplyIndicator.svelte
	 * FEAT-001: Message Threading Enhancements
	 * 
	 * Shows a compact indicator under messages that have thread replies.
	 * Displays participant avatars and reply count.
	 */
	import { createEventDispatcher } from 'svelte';
	import ThreadParticipants from './ThreadParticipants.svelte';

	export let threadId: string;
	export let replyCount: number = 0;
	export let lastReplyAt: string | undefined = undefined;
	export let participants: Array<{
		id: string;
		username: string;
		display_name?: string | null;
		avatar?: string | null;
	}> = [];

	const dispatch = createEventDispatcher<{
		openThread: { threadId: string };
	}>();

	function handleClick() {
		dispatch('openThread', { threadId });
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	$: replyText = replyCount === 1 ? '1 reply' : `${replyCount} replies`;
	$: lastReplyText = lastReplyAt ? formatRelativeTime(lastReplyAt) : '';
</script>

{#if replyCount > 0}
	<button
		class="thread-indicator"
		on:click={handleClick}
		aria-label="View thread with {replyText}"
		type="button"
	>
		<!-- Thread icon -->
		<svg class="thread-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06148 17 1.99906 16.9254 2.01378 16.8459L2.24541 15.5459C2.25692 15.4846 2.31082 15.4393 2.37276 15.4393H6.35988L7.25 10.5H3.14274C3.06148 10.5 2.99906 10.4254 3.01378 10.3459L3.24541 9.0459C3.25692 8.9846 3.31082 8.9393 3.37276 8.9393H7.60988L8.47733 4.141C8.48884 4.07967 8.54274 4.0343 8.60489 4.0343H9.93021C10.0049 4.0343 10.0614 4.10179 10.0483 4.1753L9.19991 9H13.6599L14.5274 4.141C14.5389 4.07967 14.5928 4.0343 14.6549 4.0343H15.9802C16.0549 4.0343 16.1114 4.10179 16.0983 4.1753L15.2499 9H19.1073C19.1885 9 19.2509 9.0746 19.2362 9.1541L19.0046 10.4541C18.9931 10.5154 18.9392 10.5607 18.8772 10.5607H14.8899L14.0299 15.5H17.8572C17.9385 15.5 18.0009 15.5746 17.9862 15.6541L17.7546 16.9541C17.7431 17.0154 17.6892 17.0607 17.6272 17.0607H13.6699L12.7692 21.859C12.7577 21.9203 12.7038 21.9657 12.6418 21.9657H11.3165C11.2418 21.9657 11.1853 21.8982 11.1984 21.8247L12.0699 17H7.60988L6.70891 21.859C6.69739 21.9203 6.6435 21.9657 6.58155 21.9657H5.25623C5.18156 21.9657 5.12503 21.8982 5.13808 21.8247L5.43309 21ZM7.96991 15.5H12.4299L13.29 10.5607H8.82991L7.96991 15.5Z"/>
		</svg>

		<!-- Participants -->
		{#if participants.length > 0}
			<div class="participants-wrapper">
				<ThreadParticipants 
					{participants}
					maxDisplay={3}
					size="xs"
					showNames={false}
				/>
			</div>
		{/if}

		<!-- Reply count and time -->
		<span class="reply-info">
			<span class="reply-count">{replyText}</span>
			{#if lastReplyText}
				<span class="last-reply">Last reply {lastReplyText}</span>
			{/if}
		</span>

		<!-- Arrow indicator -->
		<svg class="arrow-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
			<polyline points="9 18 15 12 9 6"></polyline>
		</svg>
	</button>
{/if}

<style>
	.thread-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		margin-top: 4px;
		margin-left: 56px; /* Align with message content (avatar width + gap) */
		background-color: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s;
		color: var(--text-link, #00a8fc);
		font-size: 13px;
	}

	.thread-indicator:hover {
		background-color: var(--bg-modifier-hover, rgba(0, 168, 252, 0.08));
	}

	.thread-indicator:hover .reply-count {
		text-decoration: underline;
	}

	.thread-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.participants-wrapper {
		flex-shrink: 0;
	}

	.reply-info {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.reply-count {
		font-weight: 500;
		color: var(--text-link, #00a8fc);
	}

	.last-reply {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
	}

	.arrow-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
		opacity: 0;
		transform: translateX(-4px);
		transition: opacity 0.15s, transform 0.15s;
	}

	.thread-indicator:hover .arrow-icon {
		opacity: 1;
		transform: translateX(0);
	}
</style>
