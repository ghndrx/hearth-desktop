<script lang="ts">
	import EmojiPicker from './EmojiPicker.svelte';

	interface Props {
		placeholder?: string;
		disabled?: boolean;
		onSend?: (data: { content: string; attachments: File[] }) => void;
	}

	let { placeholder = 'Message', disabled = false, onSend }: Props = $props();

	let content = $state('');
	let files: FileList | null = $state(null);
	let textarea: HTMLTextAreaElement | undefined = $state();
	let showEmojiPicker = $state(false);

	function handleInput() {
		autoResize();
	}

	function autoResize() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function send() {
		if (!content.trim() && !files?.length) return;

		onSend?.({
			content: content.trim(),
			attachments: files ? Array.from(files) : []
		});

		content = '';
		files = null;
		if (textarea) textarea.style.height = 'auto';
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
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const before = content.substring(0, start);
		const after = content.substring(end);
		content = before + emoji + after;
		showEmojiPicker = false;
		setTimeout(() => {
			textarea?.focus();
			textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
		}, 0);
	}
</script>

<div class="message-input-container">
	<!-- Attachments Preview -->
	{#if files?.length}
		<div class="attachments-preview">
			{#each Array.from(files) as file, i (`${file.name}-${i}`)}
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
					<button class="remove-attachment" onclick={() => removeFile(i)} aria-label="Remove attachment">
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
				onchange={handleFileSelect}
				{disabled}
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
			oninput={handleInput}
			onkeydown={handleKeydown}
			onpaste={handlePaste}
			{placeholder}
			rows="1"
			{disabled}
		></textarea>

		<!-- Right Buttons -->
		<div class="input-buttons-right">
			<!-- Emoji Button -->
			<div class="emoji-button-container">
				<button
					class="icon-button emoji-button"
					title="Select emoji"
					onclick={() => (showEmojiPicker = !showEmojiPicker)}
					{disabled}
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
					onSelect={handleEmojiSelect}
					onClose={() => (showEmojiPicker = false)}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.message-input-container {
		padding: 0;
	}

	/* Attachments Preview */
	.attachments-preview {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 8px 16px;
		background: #2b2d31;
		border-radius: 8px 8px 0 0;
		margin-bottom: 2px;
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
		background: #1e1f22;
		border-radius: 4px;
		color: #f2f3f5;
	}

	.remove-attachment {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #f23f43;
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
		background: #383a40;
		border-radius: 8px;
		padding: 0 4px;
		min-height: 44px;
	}

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
		color: #949ba4;
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
		background: rgba(79, 84, 92, 0.16);
		color: #f2f3f5;
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
		color: #f2f3f5;
		font-size: 16px;
		padding: 11px 0;
		resize: none;
		max-height: 300px;
		line-height: 1.375;
		font-family: inherit;
	}

	textarea::placeholder {
		color: #949ba4;
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

	/* Emoji Button Container */
	.emoji-button-container {
		position: relative;
	}

	.emoji-button:hover:not(:disabled) {
		color: #ffd700;
	}
</style>
