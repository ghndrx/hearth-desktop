<script lang="ts">
	/**
	 * PinnedPanel.svelte
	 * FEAT-003: Split View (Desktop)
	 * 
	 * Individual pinned panel in the split view using Svelte 5 runes.
	 * Displays DM conversations, threads, or channels with:
	 * - Real-time message updates via WebSocket
	 * - Resize handles and collapse functionality
	 * - Message input with send capability
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PinnedPanel as PinnedPanelType } from '$lib/stores/splitView';
	import { api } from '$lib/api';
	import { user as currentUser } from '$lib/stores/auth';
	import { sendMessage } from '$lib/stores/messages';
	import { gateway, onGatewayEvent } from '$lib/gateway';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ResizeHandle from './ResizeHandle.svelte';
	import type { Message as MessageType } from '$lib/stores/messages';

	// Props using Svelte 5 runes
	interface Props {
		panel: PinnedPanelType;
		index: number;
		onclose?: () => void;
		oncollapse?: () => void;
		onresizestart?: (clientX: number) => void;
	}

	let { panel, index, onclose, oncollapse, onresizestart }: Props = $props();

	// Local state using Svelte 5 runes
	let messages: MessageType[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);
	let messageInput = $state('');
	let sending = $state(false);
	let messagesEl: HTMLDivElement | undefined = $state();
	let unsubscribeWS: (() => void) | null = $state(null);

	// Derived state
	let isCollapsed = $derived(panel.isCollapsed);
	let panelWidth = $derived(isCollapsed ? 48 : panel.width);
	let channelId = $derived(panel.channelId);
	let isThread = $derived(panel.type === 'thread');
	let typeIcon = $derived(panel.type === 'dm' ? '@' : panel.type === 'thread' ? '🧵' : '#');

	// Load messages when panel is opened
	onMount(() => {
		if (panel.channelId && !isCollapsed) {
			loadMessages().then(() => {
				subscribeToMessages();
			});
		}

		return () => {
			if (unsubscribeWS) {
				unsubscribeWS();
			}
		};
	});

	// Reload messages when panel is uncollapsed
	$effect(() => {
		if (!isCollapsed && panel.channelId && messages.length === 0 && !loading) {
			loadMessages();
		}
	});

	async function loadMessages() {
		if (!panel.channelId) return;
		
		loading = true;
		error = null;

		try {
			if (isThread && panel.threadId) {
				// Load thread messages
				const response = await api.get<MessageType[]>(
					`/channels/${panel.channelId}/messages/${panel.parentMessageId}/thread`
				);
				messages = Array.isArray(response) ? response : [];
			} else {
				// Load channel messages
				const response = await api.get<MessageType[]>(
					`/channels/${panel.channelId}/messages?limit=50`
				);
				messages = Array.isArray(response) ? response : [];
			}
			scrollToBottom();
		} catch (err: any) {
			error = err.message || 'Failed to load messages';
		} finally {
			loading = false;
		}
	}

	function subscribeToMessages() {
		if (!panel.channelId) return;

		unsubscribeWS = onGatewayEvent('MESSAGE_CREATE', (data: unknown) => {
			const message = data as MessageType;
			
			if (isThread) {
				// For threads, only add messages that are replies to the thread
				if (message.reply_to === panel.parentMessageId) {
					messages = [...messages, message];
					scrollToBottom();
				}
			} else {
				// For channels/DMs, add messages to this channel
				if (message.channel_id === panel.channelId) {
					messages = [...messages, message];
					scrollToBottom();
				}
			}
		});
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesEl) {
				messagesEl.scrollTop = messagesEl.scrollHeight;
			}
		}, 0);
	}

	async function handleSend() {
		if (!messageInput.trim() || sending || !panel.channelId) return;

		const content = messageInput.trim();
		messageInput = '';
		sending = true;

		try {
			if (isThread && panel.parentMessageId) {
				// Send as thread reply
				await sendMessage(panel.channelId, content, [], panel.parentMessageId);
			} else {
				// Send as regular message
				await sendMessage(panel.channelId, content, []);
			}
		} catch (err) {
			console.error('Failed to send message:', err);
			messageInput = content; // Restore message on error
		} finally {
			sending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		if (e.key === 'Escape') {
			onclose?.();
		}
	}

	function handleResizeStart(coords: { clientX: number }) {
		onresizestart?.(coords.clientX);
	}

	function handleClose() {
		onclose?.();
	}

	function handleCollapse() {
		oncollapse?.();
	}

	function handlePopOut() {
		// Navigate to the full view of this channel/thread
		if (isThread && panel.serverId && panel.channelId) {
			goto(`/channels/${panel.serverId}/${panel.channelId}?thread=${panel.threadId}`);
		} else if (panel.type === 'dm' && panel.channelId) {
			goto(`/channels/@me/${panel.channelId}`);
		} else if (panel.serverId && panel.channelId) {
			goto(`/channels/${panel.serverId}/${panel.channelId}`);
		}
		onclose?.();
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function shouldGroupWithPrevious(msgs: MessageType[], idx: number): boolean {
		if (idx === 0) return false;
		const current = msgs[idx];
		const previous = msgs[idx - 1];
		
		if (current.author_id !== previous.author_id) return false;
		const timeDiff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
		return timeDiff < 7 * 60 * 1000; // 7 minutes
	}
</script>

<div 
	class="pinned-panel"
	class:collapsed={isCollapsed}
	style:width="{panelWidth}px"
	style:--panel-width="{panelWidth}px"
	role="region"
	aria-label="{panel.type === 'dm' ? 'Direct message with' : 'Channel'} {panel.title}"
>
	<!-- Resize handle (left edge) -->
	<ResizeHandle 
		position="left"
		direction="horizontal"
		disabled={isCollapsed}
		ariaLabel="Resize {panel.title} panel"
		onresizestart={handleResizeStart}
	/>

	{#if isCollapsed}
		<!-- Collapsed state - just show icon and title vertically -->
		<button 
			class="collapsed-toggle"
			onclick={handleCollapse}
			title="Expand {panel.title}"
			aria-label="Expand {panel.title}"
		>
			<span class="collapsed-icon">{typeIcon}</span>
			<span class="collapsed-title">{panel.title}</span>
		</button>
	{:else}
		<!-- Panel header -->
		<header class="panel-header">
			<div class="panel-header-info">
				<span class="panel-icon">{typeIcon}</span>
				<div class="panel-title-group">
					<h3 class="panel-title">{panel.title}</h3>
					{#if panel.subtitle}
						<span class="panel-subtitle">{panel.subtitle}</span>
					{/if}
				</div>
			</div>
			<div class="panel-actions">
				<button 
					class="panel-btn" 
					onclick={handlePopOut}
					title="Open in main view"
					aria-label="Open in main view"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v8h-2V6.413l-7.293 7.294-1.414-1.414L17.585 5H13V3h8z"/>
					</svg>
				</button>
				<button 
					class="panel-btn" 
					onclick={handleCollapse}
					title="Collapse panel"
					aria-label="Collapse panel"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
					</svg>
				</button>
				<button 
					class="panel-btn close-btn" 
					onclick={handleClose}
					title="Close panel"
					aria-label="Close panel"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
					</svg>
				</button>
			</div>
		</header>

		<!-- Thread parent message (for threads only) -->
		{#if isThread && panel.thread?.parent_message}
			<div class="thread-parent">
				<div class="thread-parent-label">Thread started from</div>
				<div class="thread-parent-content">
					<Avatar
						src={panel.thread.parent_message.author?.avatar}
						username={panel.thread.parent_message.author?.display_name || panel.thread.parent_message.author?.username || 'Unknown'}
						size="xs"
					/>
					<span class="thread-parent-text">
						{panel.thread.parent_message.content.slice(0, 100)}{panel.thread.parent_message.content.length > 100 ? '...' : ''}
					</span>
				</div>
			</div>
		{/if}

		<!-- Messages area -->
		<div class="panel-messages" bind:this={messagesEl}>
			{#if loading}
				<div class="panel-loading">
					<LoadingSpinner />
					<span>Loading messages...</span>
				</div>
			{:else if error}
				<div class="panel-error">
					<span>⚠️ {error}</span>
					<button class="retry-btn" onclick={loadMessages}>Retry</button>
				</div>
			{:else if messages.length === 0}
				<div class="panel-empty">
					<span class="empty-icon">{typeIcon}</span>
					<p>No messages yet</p>
					<p class="empty-hint">Start the conversation!</p>
				</div>
			{:else}
				{#each messages as message, idx (message.id)}
					<div 
						class="panel-message"
						class:grouped={shouldGroupWithPrevious(messages, idx)}
					>
						{#if !shouldGroupWithPrevious(messages, idx)}
							<div class="message-header">
								<Avatar
									src={message.author?.avatar}
									username={message.author?.display_name || message.author?.username || 'Unknown'}
									size="xs"
								/>
								<span class="message-author">
									{message.author?.display_name || message.author?.username || 'Unknown'}
								</span>
								<span class="message-time">{formatTime(message.created_at)}</span>
							</div>
						{/if}
						<div class="message-content" class:with-avatar={!shouldGroupWithPrevious(messages, idx)}>
							{message.content}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Message input -->
		<div class="panel-input">
			<textarea
				bind:value={messageInput}
				onkeydown={handleKeydown}
				placeholder={isThread ? "Reply in thread..." : `Message ${panel.title}`}
				rows="1"
				disabled={sending}
				aria-label={isThread ? "Reply in thread" : `Message ${panel.title}`}
			></textarea>
			<button
				class="send-btn"
				onclick={handleSend}
				disabled={!messageInput.trim() || sending}
				title="Send message"
				aria-label="Send message"
			>
				{#if sending}
					<LoadingSpinner size="sm" />
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
					</svg>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.pinned-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--bg-secondary, #2b2d31);
		border-left: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
		overflow: hidden;
		transition: width 0.2s ease;
	}

	.pinned-panel.collapsed {
		width: 48px !important;
	}

	/* Collapsed state */
	.collapsed-toggle {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: 12px 4px;
		gap: 8px;
		background: transparent;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		width: 100%;
		height: 100%;
		transition: color 0.15s, background-color 0.15s;
	}

	.collapsed-toggle:hover {
		background-color: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}

	.collapsed-icon {
		font-size: 20px;
		font-weight: 600;
	}

	.collapsed-title {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-height: 200px;
	}

	/* Panel header */
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		min-height: 48px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.panel-header-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1;
	}

	.panel-icon {
		font-size: 18px;
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.panel-title-group {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.panel-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.panel-subtitle {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.panel-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.panel-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: color 0.15s, background-color 0.15s;
	}

	.panel-btn:hover {
		color: var(--text-normal, #f2f3f5);
		background-color: var(--bg-modifier-hover, #35373c);
	}

	.panel-btn.close-btn:hover {
		color: var(--red, #da373c);
	}

	/* Thread parent */
	.thread-parent {
		padding: 8px 12px;
		background-color: var(--bg-tertiary, #232428);
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.thread-parent-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
		margin-bottom: 6px;
	}

	.thread-parent-content {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.thread-parent-text {
		font-size: 12px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.4;
	}

	/* Messages area */
	.panel-messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 12px;
	}

	.panel-loading,
	.panel-error,
	.panel-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
		color: var(--text-muted, #949ba4);
		text-align: center;
		padding: 16px;
	}

	.panel-error {
		color: var(--red, #da373c);
	}

	.retry-btn {
		background-color: var(--brand-primary, #5865f2);
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.retry-btn:hover {
		background-color: var(--brand-hover, #4752c4);
	}

	.empty-icon {
		font-size: 32px;
		opacity: 0.5;
	}

	.empty-hint {
		font-size: 12px;
		margin: 0;
	}

	/* Messages */
	.panel-message {
		padding: 2px 0;
	}

	.panel-message.grouped {
		padding-left: 28px;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.message-author {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.message-time {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
	}

	.message-content {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.375;
		word-wrap: break-word;
	}

	.message-content.with-avatar {
		padding-left: 28px;
	}

	/* Message input */
	.panel-input {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 8px 12px;
		border-top: 1px solid var(--border-subtle, #1e1f22);
		background-color: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
	}

	.panel-input textarea {
		flex: 1;
		background-color: var(--bg-tertiary, #383a40);
		border: none;
		border-radius: 4px;
		padding: 8px 10px;
		color: var(--text-normal, #f2f3f5);
		font-size: 13px;
		font-family: inherit;
		resize: none;
		max-height: 100px;
		line-height: 1.375;
	}

	.panel-input textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.panel-input textarea:focus {
		outline: none;
	}

	.panel-input textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background-color: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: background-color 0.15s;
	}

	.send-btn:hover:not(:disabled) {
		background-color: var(--brand-hover, #4752c4);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
