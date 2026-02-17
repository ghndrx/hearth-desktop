<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { pinnedMessagesStore, pinnedMessages, pinnedMessagesLoading } from '$lib/stores/pinnedMessages';
	import { currentChannel } from '$lib/stores/channels';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher<{
		jumpToMessage: { channelId: string; messageId: string };
	}>();

	function close() {
		pinnedMessagesStore.close();
	}

	async function handleUnpin(messageId: string) {
		if (!$currentChannel) return;
		
		try {
			await pinnedMessagesStore.unpin($currentChannel.id, messageId);
		} catch (error) {
			console.error('Failed to unpin message:', error);
		}
	}

	function jumpToMessage(messageId: string) {
		if (!$currentChannel) return;
		dispatch('jumpToMessage', { channelId: $currentChannel.id, messageId });
	}

	function formatTime(date: string | Date): string {
		const d = new Date(date);
		return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	}

	function formatDate(date: string | Date): string {
		const d = new Date(date);
		const now = new Date();
		const isToday = d.toDateString() === now.toDateString();
		const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

		if (isToday) return 'Today';
		if (isYesterday) return 'Yesterday';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDateTime(date: string | Date): string {
		const d = new Date(date);
		return `${formatDate(d)} at ${formatTime(d)}`;
	}

	function truncateContent(content: string, maxLength: number = 200): string {
		if (!content) return '';
		if (content.length <= maxLength) return content;
		return content.slice(0, maxLength).trim() + '...';
	}

	$: channelName = $currentChannel?.name || 'this channel';
</script>

<aside class="pinned-panel">
	<!-- Header -->
	<header class="pinned-header">
		<div class="header-left">
			<svg class="pin-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M22 12L12.101 2.10101L10.686 3.51401L12.101 4.92901L7.15096 9.87801V9.88001L5.73596 8.46501L4.32196 9.88001L8.56496 14.122L2.90796 19.778L4.32196 21.192L9.97896 15.536L14.222 19.778L15.636 18.364L14.222 16.95L19.171 12H19.172L20.586 13.414L22 12Z" />
			</svg>
			<span class="header-title">Pinned Messages</span>
		</div>
		<button class="close-btn" on:click={close} title="Close">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</header>

	<!-- Content -->
	<div class="pinned-content">
		{#if $pinnedMessagesLoading}
			<div class="loading-container">
				<LoadingSpinner />
				<span>Loading pinned messages...</span>
			</div>
		{:else if $pinnedMessages.length === 0}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
					<path d="M22 12L12.101 2.10101L10.686 3.51401L12.101 4.92901L7.15096 9.87801V9.88001L5.73596 8.46501L4.32196 9.88001L8.56496 14.122L2.90796 19.778L4.32196 21.192L9.97896 15.536L14.222 19.778L15.636 18.364L14.222 16.95L19.171 12H19.172L20.586 13.414L22 12Z" />
				</svg>
				<p class="empty-title">No pinned messages</p>
				<p class="empty-subtitle">
					Pin important messages to easily find them later. Right-click a message and select "Pin Message".
				</p>
			</div>
		{:else}
			<div class="pinned-list">
				{#each $pinnedMessages as message (message.id)}
					{@const authorName = message.author?.display_name || message.author?.username || 'Unknown'}
					<div class="pinned-message">
						<!-- Message header -->
						<div class="message-header">
							<Avatar
								src={message.author?.avatar}
								username={authorName}
								size="sm"
								userId={message.author?.id}
							/>
							<div class="message-meta">
								<span class="author-name">{authorName}</span>
								<span class="message-time">{formatDateTime(message.created_at)}</span>
							</div>
						</div>

						<!-- Message content -->
						<div class="message-body">
							<p class="message-text">{truncateContent(message.content)}</p>

							{#if message.attachments && message.attachments.length > 0}
								<div class="attachment-indicator">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
										<path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
									</svg>
									<span>{message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}</span>
								</div>
							{/if}
						</div>

						<!-- Message actions -->
						<div class="message-actions">
							<button
								class="action-btn jump-btn"
								on:click={() => jumpToMessage(message.id)}
								title="Jump to message"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path d="M8 4l8 8-8 8V4z"/>
								</svg>
								<span>Jump</span>
							</button>
							<button
								class="action-btn unpin-btn"
								on:click={() => handleUnpin(message.id)}
								title="Unpin message"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path d="M22 12L12.101 2.10101L10.686 3.51401L12.101 4.92901L7.15096 9.87801V9.88001L5.73596 8.46501L4.32196 9.88001L8.56496 14.122L2.90796 19.778L4.32196 21.192L9.97896 15.536L14.222 19.778L15.636 18.364L14.222 16.95L19.171 12H19.172L20.586 13.414L22 12Z" />
								</svg>
								<span>Unpin</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<footer class="pinned-footer">
		<span class="pin-tip">
			💡 Pinned messages help you keep track of important info in {channelName}
		</span>
	</footer>
</aside>

<style>
	.pinned-panel {
		width: 420px;
		height: 100%;
		background-color: var(--bg-secondary, #2b2d31);
		border-left: 1px solid var(--border-subtle, #1e1f22);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	/* Header */
	.pinned-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		background-color: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pin-icon {
		color: var(--text-muted, #949ba4);
	}

	.header-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
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
		transition: background-color 0.15s, color 0.15s;
	}

	.close-btn:hover {
		background-color: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}

	/* Content */
	.pinned-content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 40px 20px;
		color: var(--text-muted, #949ba4);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 24px;
		text-align: center;
	}

	.empty-icon {
		color: var(--text-muted, #949ba4);
		opacity: 0.5;
		margin-bottom: 16px;
	}

	.empty-title {
		margin: 0 0 8px;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.empty-subtitle {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
		line-height: 1.4;
	}

	/* Pinned List */
	.pinned-list {
		padding: 8px;
	}

	.pinned-message {
		background-color: var(--bg-tertiary, #232428);
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 8px;
		transition: background-color 0.15s;
	}

	.pinned-message:hover {
		background-color: var(--bg-modifier-hover, #2e3035);
	}

	.pinned-message:last-child {
		margin-bottom: 0;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.message-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.author-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.message-time {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.message-body {
		margin-bottom: 10px;
	}

	.message-text {
		margin: 0;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.375;
		word-break: break-word;
	}

	.attachment-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.attachment-indicator svg {
		opacity: 0.8;
	}

	.message-actions {
		display: flex;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle, #3f4147);
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background-color: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.action-btn:hover {
		background-color: var(--bg-modifier-hover, #35373c);
	}

	.jump-btn {
		flex: 1;
		justify-content: center;
	}

	.jump-btn:hover {
		background-color: var(--brand-primary, #5865f2);
	}

	.unpin-btn {
		color: var(--text-muted, #949ba4);
	}

	.unpin-btn:hover {
		color: var(--text-danger, #da373c);
		background-color: rgba(218, 55, 60, 0.1);
	}

	/* Footer */
	.pinned-footer {
		padding: 12px 16px;
		border-top: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.pin-tip {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		line-height: 1.4;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.pinned-panel {
			width: 100%;
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			z-index: 1000;
		}
	}
</style>
