<script lang="ts">
	import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
	import { threadStore, currentThread, threadMessages, threadLoading } from '$lib/stores/thread';
	import { user as currentUser } from '$lib/stores/auth';
	import Avatar from './Avatar.svelte';
	import Message from './Message.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher();

	let replyContent = '';
	let messageListEl: HTMLDivElement;
	let textarea: HTMLTextAreaElement;
	let sending = false;

	// Auto-scroll to bottom when new messages arrive
	afterUpdate(() => {
		if (messageListEl && $threadMessages.length > 0) {
			messageListEl.scrollTop = messageListEl.scrollHeight;
		}
	});

	function close() {
		threadStore.close();
	}

	async function sendReply() {
		if (!replyContent.trim() || sending) return;

		sending = true;
		try {
			await threadStore.sendReply(replyContent);
			replyContent = '';
			if (textarea) {
				textarea.style.height = 'auto';
			}
		} catch (error) {
			console.error('Failed to send reply:', error);
		} finally {
			sending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendReply();
		}
		if (e.key === 'Escape') {
			close();
		}
	}

	function handleInput() {
		if (textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
		}
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

	$: parentMessage = $currentThread?.parent_message;
	$: threadTitle = $currentThread?.name || 'Thread';
	$: authorName = parentMessage?.author?.display_name || parentMessage?.author?.username || 'Unknown';
</script>

{#if $currentThread}
	<aside class="thread-panel" aria-label="Thread: {threadTitle}" role="complementary">
		<!-- Thread Header -->
		<header class="thread-header">
			<div class="thread-header-left">
				<svg class="thread-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06148 17 1.99906 16.9254 2.01378 16.8459L2.24541 15.5459C2.25692 15.4846 2.31082 15.4393 2.37276 15.4393H6.35988L7.25 10.5H3.14274C3.06148 10.5 2.99906 10.4254 3.01378 10.3459L3.24541 9.0459C3.25692 8.9846 3.31082 8.9393 3.37276 8.9393H7.60988L8.47733 4.141C8.48884 4.07967 8.54274 4.0343 8.60489 4.0343H9.93021C10.0049 4.0343 10.0614 4.10179 10.0483 4.1753L9.19991 9H13.6599L14.5274 4.141C14.5389 4.07967 14.5928 4.0343 14.6549 4.0343H15.9802C16.0549 4.0343 16.1114 4.10179 16.0983 4.1753L15.2499 9H19.1073C19.1885 9 19.2509 9.0746 19.2362 9.1541L19.0046 10.4541C18.9931 10.5154 18.9392 10.5607 18.8772 10.5607H14.8899L14.0299 15.5H17.8572C17.9385 15.5 18.0009 15.5746 17.9862 15.6541L17.7546 16.9541C17.7431 17.0154 17.6892 17.0607 17.6272 17.0607H13.6699L12.7692 21.859C12.7577 21.9203 12.7038 21.9657 12.6418 21.9657H11.3165C11.2418 21.9657 11.1853 21.8982 11.1984 21.8247L12.0699 17H7.60988L6.70891 21.859C6.69739 21.9203 6.6435 21.9657 6.58155 21.9657H5.25623C5.18156 21.9657 5.12503 21.8982 5.13808 21.8247L5.43309 21ZM7.96991 15.5H12.4299L13.29 10.5607H8.82991L7.96991 15.5Z"/>
				</svg>
				<h3 class="thread-title" id="thread-title">{threadTitle}</h3>
			</div>
			<button class="close-btn" on:click={close} title="Close thread" aria-label="Close thread panel" type="button">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<!-- Parent Message -->
		{#if parentMessage}
			<div class="parent-message">
				<div class="parent-message-header">
					<span class="parent-label">Replying to</span>
				</div>
				<div class="parent-message-content">
					<div class="parent-avatar">
						<Avatar
							src={parentMessage.author?.avatar}
							username={authorName}
							size="sm"
						/>
					</div>
					<div class="parent-details">
						<div class="parent-meta">
							<span class="parent-author">{authorName}</span>
							<span class="parent-time">{formatTime(parentMessage.created_at)}</span>
						</div>
						<p class="parent-text">{parentMessage.content}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Thread Messages -->
		<div class="thread-messages" bind:this={messageListEl} role="log" aria-label="Thread replies" aria-live="polite" aria-relevant="additions">
			{#if $threadLoading}
				<div class="loading-container" role="status" aria-live="polite">
					<LoadingSpinner />
					<span>Loading thread...</span>
				</div>
			{:else if $threadMessages.length === 0}
				<div class="empty-thread" role="status">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="empty-icon" aria-hidden="true">
						<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06148 17 1.99906 16.9254 2.01378 16.8459L2.24541 15.5459C2.25692 15.4846 2.31082 15.4393 2.37276 15.4393H6.35988L7.25 10.5H3.14274C3.06148 10.5 2.99906 10.4254 3.01378 10.3459L3.24541 9.0459C3.25692 8.9846 3.31082 8.9393 3.37276 8.9393H7.60988L8.47733 4.141C8.48884 4.07967 8.54274 4.0343 8.60489 4.0343H9.93021C10.0049 4.0343 10.0614 4.10179 10.0483 4.1753L9.19991 9H13.6599L14.5274 4.141C14.5389 4.07967 14.5928 4.0343 14.6549 4.0343H15.9802C16.0549 4.0343 16.1114 4.10179 16.0983 4.1753L15.2499 9H19.1073C19.1885 9 19.2509 9.0746 19.2362 9.1541L19.0046 10.4541C18.9931 10.5154 18.9392 10.5607 18.8772 10.5607H14.8899L14.0299 15.5H17.8572C17.9385 15.5 18.0009 15.5746 17.9862 15.6541L17.7546 16.9541C17.7431 17.0154 17.6892 17.0607 17.6272 17.0607H13.6699L12.7692 21.859C12.7577 21.9203 12.7038 21.9657 12.6418 21.9657H11.3165C11.2418 21.9657 11.1853 21.8982 11.1984 21.8247L12.0699 17H7.60988L6.70891 21.859C6.69739 21.9203 6.6435 21.9657 6.58155 21.9657H5.25623C5.18156 21.9657 5.12503 21.8982 5.13808 21.8247L5.43309 21ZM7.96991 15.5H12.4299L13.29 10.5607H8.82991L7.96991 15.5Z"/>
					</svg>
					<p class="empty-title">No replies yet</p>
					<p class="empty-subtitle">Be the first to reply to this message!</p>
				</div>
			{:else}
				{#each $threadMessages as message, i}
					{@const prevMessage = $threadMessages[i - 1]}
					{@const showDate = !prevMessage || formatDate(message.created_at) !== formatDate(prevMessage.created_at)}
					
					{#if showDate}
						<div class="date-divider">
							<span>{formatDate(message.created_at)}</span>
						</div>
					{/if}
					
					<Message
						{message}
						grouped={prevMessage?.author_id === message.author_id && !showDate}
						isOwn={message.author_id === $currentUser?.id}
					/>
				{/each}
			{/if}
		</div>

		<!-- Reply Input -->
		<div class="reply-input-container" role="group" aria-label="Thread reply composition">
			<div class="reply-input-wrapper">
				<textarea
					bind:this={textarea}
					bind:value={replyContent}
					on:input={handleInput}
					on:keydown={handleKeydown}
					placeholder="Reply in thread..."
					rows="1"
					disabled={sending}
					aria-label="Reply in thread"
					aria-describedby="thread-reply-hint"
				></textarea>
				<span id="thread-reply-hint" class="sr-only">Press Enter to send, Shift+Enter for new line, Escape to close</span>
				<button
					class="send-btn"
					on:click={sendReply}
					disabled={!replyContent.trim() || sending}
					title="Send reply"
					aria-label={sending ? "Sending reply..." : "Send reply"}
					type="button"
				>
					{#if sending}
						<LoadingSpinner size="sm" />
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</aside>
{/if}

<style>
	.thread-panel {
		width: 420px;
		height: 100%;
		background-color: var(--bg-secondary, #2b2d31);
		border-left: 1px solid var(--border-subtle, #1e1f22);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	/* Header */
	.thread-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		background-color: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
	}

	.thread-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.thread-icon {
		color: var(--text-muted, #949ba4);
	}

	.thread-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300px;
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

	/* Parent Message */
	.parent-message {
		padding: 12px 16px;
		background-color: var(--bg-tertiary, #232428);
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.parent-message-header {
		margin-bottom: 8px;
	}

	.parent-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
	}

	.parent-message-content {
		display: flex;
		gap: 12px;
	}

	.parent-avatar {
		flex-shrink: 0;
	}

	.parent-details {
		flex: 1;
		min-width: 0;
	}

	.parent-meta {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}

	.parent-author {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.parent-time {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.parent-text {
		margin: 0;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.375;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	/* Thread Messages */
	.thread-messages {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 0;
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

	.empty-thread {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
	}

	.empty-icon {
		color: var(--text-muted, #949ba4);
		opacity: 0.5;
		margin-bottom: 16px;
	}

	.empty-title {
		margin: 0 0 4px;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.empty-subtitle {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
	}

	.date-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		position: relative;
	}

	.date-divider::before,
	.date-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: var(--border-subtle, #3f4147);
	}

	.date-divider span {
		padding: 0 8px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
	}

	/* Reply Input */
	.reply-input-container {
		padding: 16px;
		border-top: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.reply-input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		background-color: var(--bg-tertiary, #383a40);
		border-radius: 8px;
		padding: 4px 4px 4px 12px;
	}

	.reply-input-wrapper textarea {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		padding: 8px 0;
		resize: none;
		max-height: 150px;
		line-height: 1.375;
		font-family: inherit;
	}

	.reply-input-wrapper textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.reply-input-wrapper textarea:focus {
		outline: none;
	}

	.reply-input-wrapper textarea:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.send-btn {
		background-color: var(--brand-primary, #5865f2);
		border: none;
		color: white;
		cursor: pointer;
		padding: 8px 12px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s;
	}

	.send-btn:hover:not(:disabled) {
		background-color: var(--brand-hover, #4752c4);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Screen reader only - visually hidden but accessible */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
