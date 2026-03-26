<script lang="ts">
	import { onMount, afterUpdate, tick } from 'svelte';
	import { createChannelMessagesStore, messagesStore, type Message, type PendingMessage, MessageStatus } from '../index';

	export let channelId: string;

	let messagesContainer: HTMLDivElement;
	let shouldAutoScroll = true;

	// Create channel-specific store
	$: channelStore = createChannelMessagesStore(channelId);

	// Load messages when channel changes
	$: if (channelId && $messagesStore.initialized) {
		loadMessages();
	}

	// Auto-scroll when new messages arrive
	$: if ($channelStore.messages.length > 0) {
		handleNewMessages();
	}

	onMount(() => {
		loadMessages();
	});

	afterUpdate(() => {
		if (shouldAutoScroll) {
			scrollToBottom();
		}
	});

	async function loadMessages() {
		if (!$channelStore.loaded) {
			await messagesStore.loadMessages(channelId);
		}
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTo({
				top: messagesContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	async function handleNewMessages() {
		await tick();
		if (shouldAutoScroll) {
			scrollToBottom();
		}
	}

	function handleScroll() {
		if (messagesContainer) {
			const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

			// Auto-scroll if user is within 100px of the bottom
			shouldAutoScroll = distanceFromBottom < 100;
		}
	}

	function formatTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			// Today - show time only
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			});
		} else if (diffDays === 1) {
			// Yesterday
			return 'Yesterday ' + date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			});
		} else if (diffDays < 7) {
			// This week - show day name
			return date.toLocaleDateString([], {
				weekday: 'short',
				hour: '2-digit',
				minute: '2-digit'
			});
		} else {
			// Older - show date
			return date.toLocaleDateString([], {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
	}

	function getUserDisplayName(userId: string): string {
		// TODO: Get actual user data from store
		// For now, return a placeholder
		return `User ${userId.slice(-4)}`;
	}

	function getUserAvatar(userId: string): string {
		// TODO: Get actual avatar URLs
		// For now, return a placeholder
		return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
	}

	function getStatusColor(status: MessageStatus): string {
		switch (status) {
			case MessageStatus.PENDING:
				return 'text-yellow-500';
			case MessageStatus.SENT:
				return 'text-green-500';
			case MessageStatus.FAILED:
				return 'text-red-500';
			default:
				return 'text-gray-500';
		}
	}

	function getStatusIcon(status: MessageStatus): string {
		switch (status) {
			case MessageStatus.PENDING:
				return '⏱️';
			case MessageStatus.SENT:
				return '✓';
			case MessageStatus.FAILED:
				return '❌';
			default:
				return '';
		}
	}
</script>

<div class="message-list-container">
	{#if $channelStore.loading}
		<div class="loading-state">
			<div class="loading-spinner">
				<svg class="animate-spin w-6 h-6 text-gray-500" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
						fill="none"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			</div>
			<p class="text-sm text-gray-500">Loading messages...</p>
		</div>
	{:else}
		<div
			bind:this={messagesContainer}
			class="messages-container"
			on:scroll={handleScroll}
		>
			{#if $channelStore.messages.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">
						<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">No messages yet</h3>
					<p class="text-sm text-gray-500">Be the first to say something!</p>
				</div>
			{:else}
				<!-- Regular messages -->
				{#each $channelStore.messages as message (message.id)}
					<div class="message-item">
						<div class="message-avatar">
							<img
								src={getUserAvatar(message.user_id)}
								alt={getUserDisplayName(message.user_id)}
								class="avatar-image"
							/>
						</div>
						<div class="message-content">
							<div class="message-header">
								<span class="user-name">
									{getUserDisplayName(message.user_id)}
								</span>
								<span class="message-time">
									{formatTime(message.created_at)}
								</span>
								{#if message.edited_at}
									<span class="edited-indicator">edited</span>
								{/if}
							</div>
							<div class="message-body">
								<p class="message-text">{message.content}</p>
							</div>
						</div>
					</div>
				{/each}

				<!-- Pending messages -->
				{#each $channelStore.pendingMessages as pendingMessage (pendingMessage.id)}
					<div class="message-item pending-message">
						<div class="message-avatar">
							<img
								src={getUserAvatar('current-user')}
								alt="You"
								class="avatar-image opacity-70"
							/>
						</div>
						<div class="message-content">
							<div class="message-header">
								<span class="user-name">You</span>
								<span class="message-time">
									{formatTime(pendingMessage.created_at)}
								</span>
								<span class={`status-indicator ${getStatusColor(pendingMessage.status)}`}>
									{getStatusIcon(pendingMessage.status)}
								</span>
							</div>
							<div class="message-body">
								<p class="message-text opacity-70">{pendingMessage.content}</p>
							</div>
						</div>
					</div>
				{/each}
			{/if}

			<!-- Typing indicators -->
			{#if $channelStore.typing.length > 0}
				<div class="typing-indicator">
					<div class="typing-avatar">
						<div class="typing-dots">
							<span></span>
							<span></span>
							<span></span>
						</div>
					</div>
					<span class="typing-text">
						{$channelStore.typing.map(userId => getUserDisplayName(userId)).join(', ')}
						{$channelStore.typing.length === 1 ? 'is' : 'are'} typing...
					</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.message-list-container {
		@apply flex-1 flex flex-col overflow-hidden;
	}

	.loading-state {
		@apply flex flex-col items-center justify-center h-full space-y-4;
	}

	.messages-container {
		@apply flex-1 overflow-y-auto p-4 space-y-4;
		scrollbar-width: thin;
		scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
	}

	.messages-container::-webkit-scrollbar {
		width: 8px;
	}

	.messages-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.messages-container::-webkit-scrollbar-thumb {
		background: rgba(156, 163, 175, 0.5);
		border-radius: 4px;
	}

	.messages-container::-webkit-scrollbar-thumb:hover {
		background: rgba(156, 163, 175, 0.7);
	}

	.empty-state {
		@apply flex flex-col items-center justify-center h-full text-center space-y-4;
	}

	.empty-state-icon {
		@apply p-3 bg-gray-100 dark:bg-gray-800 rounded-full;
	}

	.message-item {
		@apply flex space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 -mx-2 rounded-lg transition-colors;
	}

	.pending-message {
		@apply opacity-75;
	}

	.message-avatar {
		@apply flex-shrink-0;
	}

	.avatar-image {
		@apply w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700;
	}

	.message-content {
		@apply flex-1 min-w-0;
	}

	.message-header {
		@apply flex items-center space-x-2 mb-1;
	}

	.user-name {
		@apply font-medium text-sm text-gray-900 dark:text-gray-100;
	}

	.message-time {
		@apply text-xs text-gray-500 dark:text-gray-400;
	}

	.edited-indicator {
		@apply text-xs text-gray-400 dark:text-gray-500 italic;
	}

	.status-indicator {
		@apply text-xs;
	}

	.message-body {
		@apply text-sm text-gray-700 dark:text-gray-300;
	}

	.message-text {
		@apply break-words;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.typing-indicator {
		@apply flex items-center space-x-3 p-2 text-sm text-gray-500 dark:text-gray-400;
	}

	.typing-avatar {
		@apply w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full;
	}

	.typing-dots {
		@apply flex space-x-1;
	}

	.typing-dots span {
		@apply w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse;
		animation-delay: calc(var(--i) * 0.2s);
	}

	.typing-dots span:nth-child(1) {
		--i: 0;
	}

	.typing-dots span:nth-child(2) {
		--i: 1;
	}

	.typing-dots span:nth-child(3) {
		--i: 2;
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>