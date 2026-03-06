<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { quickReply, type QuickReplyContext } from '$lib/stores/quickReply';

	let isOpen = $state(false);
	let context = $state<QuickReplyContext | null>(null);
	let replyContent = $state('');
	let sending = $state(false);
	let error = $state('');
	let inputEl: HTMLTextAreaElement | undefined = $state();

	const unsubs: (() => void)[] = [];

	onMount(() => {
		quickReply.init();
		unsubs.push(quickReply.isQuickReplyOpen.subscribe((v) => {
			isOpen = v;
			if (v) {
				replyContent = '';
				error = '';
				sending = false;
				// Auto-focus input when opened
				setTimeout(() => inputEl?.focus(), 50);
			}
		}));
		unsubs.push(quickReply.quickReplyContext.subscribe((c) => (context = c)));
	});

	onDestroy(() => {
		quickReply.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleClose() {
		quickReply.closeQuickReply();
	}

	async function handleSend() {
		const content = replyContent.trim();
		if (!content || sending) return;

		sending = true;
		error = '';

		try {
			await quickReply.sendQuickReply(content);
			replyContent = '';
		} catch (e) {
			error = 'Failed to send reply. Please try again.';
			sending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}
</script>

{#if isOpen && context}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="quickreply-backdrop" onkeydown={handleKeydown}>
		<div class="quickreply-overlay">
			<div class="panel-header">
				<div class="header-left">
					<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
					<h3>Quick Reply</h3>
				</div>
				<div class="header-actions">
					<span class="server-badge">{context.serverName}</span>
					<span class="channel-badge">#{context.channelName}</span>
					<button class="close-btn" onclick={handleClose} title="Close (Esc)">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div class="original-message">
				<span class="message-author">{context.messageAuthor}</span>
				<span class="message-content">{truncate(context.messageContent, 120)}</span>
			</div>

			<div class="reply-input-area">
				<textarea
					bind:this={inputEl}
					class="reply-input"
					placeholder="Type your reply..."
					bind:value={replyContent}
					onkeydown={handleKeydown}
					rows="2"
					disabled={sending}
				></textarea>
				{#if error}
					<span class="error-text">{error}</span>
				{/if}
				<div class="reply-actions">
					<span class="hint-text">Enter to send, Shift+Enter for new line, Esc to close</span>
					<button
						class="send-btn"
						onclick={handleSend}
						disabled={!replyContent.trim() || sending}
					>
						{#if sending}
							Sending...
						{:else}
							Send
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.quickreply-backdrop {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 9999;
	}

	.quickreply-overlay {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
		width: 380px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		border: 1px solid var(--border, #3f4147);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.server-badge,
	.channel-badge {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.close-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	.original-message {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		border-left: 3px solid var(--accent, #5865f2);
	}

	.message-author {
		font-size: 12px;
		font-weight: 600;
		color: var(--accent, #5865f2);
	}

	.message-content {
		font-size: 13px;
		color: var(--text-secondary, #949ba4);
		line-height: 1.4;
	}

	.reply-input-area {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reply-input {
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: inherit;
		resize: none;
		box-sizing: border-box;
	}
	.reply-input:focus {
		outline: none;
		border-color: var(--accent, #5865f2);
	}
	.reply-input:disabled {
		opacity: 0.6;
	}

	.error-text {
		font-size: 12px;
		color: var(--danger, #ed4245);
	}

	.reply-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hint-text {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	.send-btn {
		padding: 6px 16px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.send-btn:hover {
		background: var(--accent-hover, #4752c4);
	}
	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
