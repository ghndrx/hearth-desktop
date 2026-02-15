<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentChannel } from '$lib/stores/channels';
	import { sendTypingIndicator } from '$lib/stores/messages';
	import EmojiPicker from './EmojiPicker.svelte';

	const dispatch = createEventDispatcher<{
		send: { content: string; attachments: File[]; replyTo?: string };
		typing: void;
	}>();

	export let placeholder = '';
	export let replyTo: { id: string; content: string; author: { username: string } } | null = null;

	let content = '';
	let files: FileList | null = null;
	let textarea: HTMLTextAreaElement;
	let lastTypingTime = 0;
	let showEmojiPicker = false;

	$: actualPlaceholder = placeholder || getPlaceholder($currentChannel);

	function getPlaceholder(channel: typeof $currentChannel) {
		if (!channel) return 'Message';
		if (channel.type === 1) {
			return `Message @${channel.recipients?.[0]?.username || 'Unknown'}`;
		}
		if (channel.type === 3) {
			return `Message ${channel.name || 'group'}`;
		}
		return `Message #${channel.name}`;
	}

	function handleInput() {
		autoResize();
		handleTyping();
	}

	function autoResize() {
		textarea.style.height = 'auto';
		textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
	}

	function handleTyping() {
		const now = Date.now();
		if (now - lastTypingTime > 3000) {
			lastTypingTime = now;
			if ($currentChannel) {
				sendTypingIndicator($currentChannel.id);
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function send() {
		if (!content.trim() && !files?.length) return;

		dispatch('send', {
			content: content.trim(),
			attachments: files ? Array.from(files) : [],
			replyTo: replyTo?.id
		});

		content = '';
		files = null;
		textarea.style.height = 'auto';
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					const dt = new DataTransfer();
					if (files) {
						for (const f of files) dt.items.add(f);
					}
					dt.items.add(file);
					files = dt.files;
				}
			}
		}
	}

	function removeFile(index: number) {
		if (!files) return;
		const dt = new DataTransfer();
		for (let i = 0; i < files.length; i++) {
			if (i !== index) dt.items.add(files[i]);
		}
		files = dt.files;
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			const dt = new DataTransfer();
			if (files) {
				for (const f of files) dt.items.add(f);
			}
			for (const f of input.files) {
				dt.items.add(f);
			}
			files = dt.files;
		}
	}

	function handleEmojiSelect(emoji: string) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const before = content.substring(0, start);
		const after = content.substring(end);
		content = before + emoji + after;
		showEmojiPicker = false;
		// Focus back on textarea after selection
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + emoji.length, start + emoji.length);
		}, 0);
	}

	function clearReply() {
		replyTo = null;
	}
</script>

<div class="message-input-container">
	<!-- Reply Preview -->
	{#if replyTo}
		<div class="reply-preview-bar">
			<div class="reply-bar"></div>
			<div class="reply-info">
				<span class="reply-label">Replying to</span>
				<span class="reply-author">{replyTo.author.username}</span>
				<p class="reply-content">
					{replyTo.content.slice(0, 100)}{replyTo.content.length > 100 ? '...' : ''}
				</p>
			</div>
			<button class="close-reply-btn" on:click={clearReply}>
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

	<!-- Attachments Preview -->
	{#if files?.length}
		<div class="attachments-preview">
			{#each Array.from(files) as file, i}
				<div class="attachment-preview">
					{#if file.type.startsWith('image/')}
						<img src={URL.createObjectURL(file)} alt={file.name} />
					{:else}
						<div class="file-preview">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
								/>
							</svg>
							<span>{file.name}</span>
						</div>
					{/if}
					<button class="remove-attachment" on:click={() => removeFile(i)}>
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
			{/each}
		</div>
	{/if}

	<!-- Input Area -->
	<div class="input-wrapper">
		<!-- Attach Button -->
		<div class="input-button attach-button">
			<input
				type="file"
				id="file-upload"
				multiple
				accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
				on:change={handleFileSelect}
				disabled={!$currentChannel}
			/>
			<label for="file-upload" class="icon-button" title="Upload a file">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
					/>
				</svg>
			</label>
		</div>

		<!-- Text Area -->
		<textarea
			bind:this={textarea}
			bind:value={content}
			on:input={handleInput}
			on:keydown={handleKeydown}
			on:paste={handlePaste}
			placeholder={actualPlaceholder}
			rows="1"
			disabled={!$currentChannel}
			spellcheck="true"
		></textarea>

		<!-- Right Buttons -->
		<div class="input-buttons-right">
			<!-- Gift Button (Placeholder) -->
			<button
				class="icon-button gift-button"
				title="Upgrade to Hearth Nitro to send gifts!"
				disabled={!$currentChannel}
			>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="20 12 20 22 4 22 4 12" />
					<rect x="2" y="7" width="20" height="5" />
					<line x1="12" y1="22" x2="12" y2="7" />
					<path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
					<path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
				</svg>
			</button>

			<!-- Emoji Button -->
			<div class="emoji-button-container">
				<button
					class="icon-button emoji-button"
					title="Select emoji"
					on:click={() => (showEmojiPicker = !showEmojiPicker)}
					disabled={!$currentChannel}
				>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M8 14s1.5 2 4 2 4-2 4-2" />
						<line x1="9" y1="9" x2="9.01" y2="9" />
						<line x1="15" y1="9" x2="15.01" y2="9" />
					</svg>
				</button>

				<EmojiPicker
					show={showEmojiPicker}
					on:select={(e) => handleEmojiSelect(e.detail)}
					on:close={() => (showEmojiPicker = false)}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.message-input-container {
		padding: 0 16px 24px;
	}

	/* Reply Preview Bar */
	.reply-preview-bar {
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

	.reply-info {
		flex: 1;
		min-width: 0;
	}

	.reply-label {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		margin-right: 4px;
	}

	.reply-author {
		font-size: 12px;
		font-weight: 600;
		color: var(--brand-primary, #5865f2);
	}

	.reply-content {
		margin: 2px 0 0 0;
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.close-reply-btn {
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

	.close-reply-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	/* Attachments Preview */
	.attachments-preview {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 8px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 0;
	}

	.attachment-preview {
		position: relative;
		max-width: 200px;
	}

	.attachment-preview img {
		max-width: 200px;
		max-height: 150px;
		border-radius: 4px;
	}

	.file-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}

	.remove-attachment {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--status-danger, #f23f43);
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s;
	}

	.remove-attachment:hover {
		transform: scale(1.1);
	}

	/* Input Wrapper */
	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		padding: 0 4px;
		min-height: 44px;
	}

	.reply-preview-bar + .input-wrapper,
	.attachments-preview + .input-wrapper {
		border-radius: 0 0 8px 8px;
	}

	/* Attach Button */
	.attach-button input[type='file'] {
		display: none;
	}

	.icon-button {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 10px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.icon-button:hover:not(:disabled) {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	.icon-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Text Area */
	textarea {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary, #f2f3f5);
		font-size: 16px;
		padding: 11px 0;
		resize: none;
		max-height: 300px;
		line-height: 1.375;
		font-family: inherit;
	}

	textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}

	textarea:focus {
		outline: none;
	}

	textarea:disabled {
		cursor: not-allowed;
	}

	/* Right Buttons */
	.input-buttons-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	/* Gift Button */
	.gift-button:hover:not(:disabled) {
		color: var(--status-danger, #f23f43);
	}

	/* Emoji Button Container */
	.emoji-button-container {
		position: relative;
	}

	.emoji-button:hover:not(:disabled) {
		color: #ffd700;
	}
</style>
