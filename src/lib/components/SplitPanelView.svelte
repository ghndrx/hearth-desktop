<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PinnedPanel } from '$lib/stores/pinnedPanels';
	import { channels, messages } from '$stores';
	import { loadMessages, sendMessage as sendMessageFn } from '$lib/stores/messages';
	import { websocket } from '$lib/stores/websocket';
	import type { Message } from '$lib/stores/messages';
	import TypingIndicator from './TypingIndicator.svelte';

	interface Props {
		panel: PinnedPanel;
	}

	let { panel }: Props = $props();

	let messageInput = $state('');
	let messagesContainer: HTMLDivElement;
	let textareaEl: HTMLTextAreaElement;
	let unsubscribeWS: (() => void) | null = null;

	// Get the channel for this panel (using $derived)
	let channel = $derived($channels.find((c) => c.id === panel.targetId));
	let panelMessages = $derived(panel.targetId ? $messages[panel.targetId] || [] : []);

	// Load messages when panel mounts or targetId changes
	$effect(() => {
		if (panel.targetId) {
			loadMessages(panel.targetId);
		}
	});

	onMount(() => {
		unsubscribeWS = websocket.on('MESSAGE_CREATE', (event) => {
			const message = event.data as Message;
			if (message.channel_id === panel.targetId) {
				scrollToBottom();
			}
		});
	});

	onDestroy(() => {
		unsubscribeWS?.();
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 0);
	}

	async function handleSendMessage() {
		if (!messageInput.trim() || !panel.targetId) return;

		const content = messageInput.trim();
		messageInput = '';

		await sendMessageFn(panel.targetId, content);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function shouldGroupWithPrevious(messages: Message[], index: number): boolean {
		if (index === 0) return false;
		const current = messages[index];
		const previous = messages[index - 1];

		if (current.author_id !== previous.author_id) return false;
		const timeDiff =
			new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
		return timeDiff < 7 * 60 * 1000;
	}
</script>

<div class="split-panel-view">
	{#if panel.targetId}
		<!-- Messages -->
		<div class="messages-scroll" bind:this={messagesContainer}>
			{#each panelMessages as message, index (message.id)}
				<div
					class="message-row"
					class:grouped={shouldGroupWithPrevious(panelMessages, index)}
				>
					{#if !shouldGroupWithPrevious(panelMessages, index)}
						<div class="message-header">
							<div class="avatar">
								<span>{message.author?.username?.charAt(0).toUpperCase() || 'U'}</span>
							</div>
							<div class="message-meta">
								<span class="author-name">
									{message.author?.username || 'Unknown'}
								</span>
								<span class="timestamp">{formatTime(message.created_at)}</span>
							</div>
						</div>
					{/if}
					<div class="message-content" class:grouped={shouldGroupWithPrevious(panelMessages, index)}>
						{message.content}
					</div>
				</div>
			{/each}

			{#if panelMessages.length === 0}
				<div class="empty-state">
					<p>No messages yet</p>
				</div>
			{/if}
		</div>

		<!-- Typing indicator -->
		<TypingIndicator channelId={panel.targetId} />

		<!-- Input -->
		<div class="input-area">
			<textarea
				bind:this={textareaEl}
				class="message-textarea"
				placeholder="Send a message..."
				rows="1"
				bind:value={messageInput}
				onkeydown={handleKeydown}
				spellcheck="true"
			></textarea>
			<button
				class="send-btn"
				onclick={handleSendMessage}
				disabled={!messageInput.trim()}
			>
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
				</svg>
			</button>
		</div>
	{:else}
		<div class="empty-state">
			<p>Panel content not found</p>
		</div>
	{/if}
</div>

<style>
	.split-panel-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
	}

	.messages-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 16px 12px;
	}

	.message-row {
		margin-bottom: 4px;
	}

	.message-row.grouped {
		margin-top: -2px;
	}

	.message-header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 2px;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--brand-primary, #ef4444);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.avatar span {
		color: white;
		font-weight: 600;
		font-size: 14px;
	}

	.message-meta {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.author-name {
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.timestamp {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.message-content {
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		line-height: 1.4;
		margin-left: 42px;
		word-break: break-word;
		white-space: pre-wrap;
	}

	.message-content.grouped {
		margin-left: 42px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted, #949ba4);
		padding: 24px;
		text-align: center;
	}

	.input-area {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid var(--bg-tertiary, #1e1f22);
	}

	.message-textarea {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 8px;
		padding: 10px 12px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		resize: none;
		max-height: 120px;
		line-height: 1.4;
	}

	.message-textarea:focus {
		outline: none;
	}

	.message-textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--brand-primary, #ef4444);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--brand-primary-hover, #dc2626);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
