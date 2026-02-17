<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { api } from '$lib/api';

	export let serverId: string;
	export let canManageEmoji = false;

	const dispatch = createEventDispatcher<{
		close: void;
		emojiAdded: { emoji: CustomEmoji };
		emojiDeleted: { emojiId: string };
	}>();

	interface CustomEmoji {
		id: string;
		name: string;
		url: string;
		animated: boolean;
		require_colons: boolean;
		managed: boolean;
		creator_id?: string;
		created_at: string;
	}

	let emojis: CustomEmoji[] = [];
	let loading = true;
	let error = '';
	let uploading = false;
	let uploadProgress = 0;
	let uploadError = '';
	let newEmojiName = '';
	let selectedFile: File | null = null;
	let previewUrl: string | null = null;
	let fileInput: HTMLInputElement;
	let searchQuery = '';

	const MAX_EMOJI_SIZE = 256 * 1024; // 256KB
	const ALLOWED_TYPES = ['image/png', 'image/gif', 'image/jpeg', 'image/webp'];

	async function loadEmojis() {
		loading = true;
		error = '';
		
		try {
			emojis = await api.get<CustomEmoji[]>(`/servers/${serverId}/emojis`);
		} catch (err) {
			error = 'Failed to load emojis';
			console.error('Failed to load emojis:', err);
		} finally {
			loading = false;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		
		if (!file) return;
		
		uploadError = '';
		
		// Validate file type
		if (!ALLOWED_TYPES.includes(file.type)) {
			uploadError = 'Invalid file type. Use PNG, GIF, JPEG, or WebP.';
			return;
		}
		
		// Validate file size
		if (file.size > MAX_EMOJI_SIZE) {
			uploadError = 'File too large. Maximum size is 256KB.';
			return;
		}
		
		selectedFile = file;
		
		// Generate preview
		const reader = new FileReader();
		reader.onload = (e) => {
			previewUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
		
		// Auto-generate name from filename
		if (!newEmojiName) {
			const baseName = file.name.replace(/\.[^.]+$/, ''); // Remove extension
			newEmojiName = baseName
				.replace(/[^a-zA-Z0-9_]/g, '_') // Replace invalid chars
				.replace(/_+/g, '_') // Collapse multiple underscores
				.slice(0, 32); // Max length
		}
	}

	function clearSelection() {
		selectedFile = null;
		previewUrl = null;
		newEmojiName = '';
		uploadError = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function uploadEmoji() {
		if (!selectedFile || !newEmojiName || !canManageEmoji) return;
		
		// Validate name
		if (!/^[a-zA-Z0-9_]{2,32}$/.test(newEmojiName)) {
			uploadError = 'Name must be 2-32 characters, alphanumeric and underscores only.';
			return;
		}
		
		uploading = true;
		uploadProgress = 0;
		uploadError = '';
		
		try {
			const formData = new FormData();
			formData.append('name', newEmojiName);
			formData.append('image', selectedFile);
			
			const newEmoji = await api.post<CustomEmoji>(`/servers/${serverId}/emojis`, formData);
			
			emojis = [...emojis, newEmoji];
			dispatch('emojiAdded', { emoji: newEmoji });
			clearSelection();
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Failed to upload emoji';
		} finally {
			uploading = false;
		}
	}

	async function deleteEmoji(emojiId: string) {
		if (!canManageEmoji) return;
		
		if (!confirm('Are you sure you want to delete this emoji?')) return;
		
		try {
			await api.delete(`/servers/${serverId}/emojis/${emojiId}`);
			emojis = emojis.filter(e => e.id !== emojiId);
			dispatch('emojiDeleted', { emojiId });
		} catch (err) {
			console.error('Failed to delete emoji:', err);
		}
	}

	function copyEmojiCode(emoji: CustomEmoji) {
		const code = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
		navigator.clipboard.writeText(code);
	}

	$: filteredEmojis = searchQuery
		? emojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: emojis;

	onMount(() => {
		loadEmojis();
	});
</script>

<div class="emoji-manager">
	<div class="header">
		<h2>Server Emojis</h2>
		<button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
			<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
				<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
			</svg>
		</button>
	</div>

	<!-- Upload Section -->
	{#if canManageEmoji}
		<div class="upload-section">
			<h3>Upload Emoji</h3>
			
			<div class="upload-form">
				{#if previewUrl}
					<div class="preview-container">
						<img src={previewUrl} alt="Emoji preview" class="emoji-preview" />
						<button class="remove-btn" on:click={clearSelection} aria-label="Remove">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
								<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
							</svg>
						</button>
					</div>
				{:else}
					<label class="upload-area" for="emoji-file">
						<input
							bind:this={fileInput}
							type="file"
							id="emoji-file"
							accept=".png,.gif,.jpg,.jpeg,.webp"
							on:change={handleFileSelect}
						/>
						<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
							<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
						</svg>
						<span>Click to upload</span>
						<span class="hint">PNG, GIF, JPEG, WebP • Max 256KB</span>
					</label>
				{/if}

				{#if selectedFile}
					<div class="name-input">
						<label for="emoji-name">Name</label>
						<div class="name-preview">
							<span>:</span>
							<input
								type="text"
								id="emoji-name"
								bind:value={newEmojiName}
								placeholder="emoji_name"
								maxlength="32"
								pattern="[a-zA-Z0-9_]+"
							/>
							<span>:</span>
						</div>
					</div>

					<button
						class="upload-btn"
						on:click={uploadEmoji}
						disabled={uploading || !newEmojiName}
					>
						{#if uploading}
							Uploading...
						{:else}
							Upload Emoji
						{/if}
					</button>
				{/if}

				{#if uploadError}
					<div class="upload-error" role="alert">{uploadError}</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Search -->
	<div class="search-section">
		<input
			type="text"
			placeholder="Search emojis..."
			bind:value={searchQuery}
			class="search-input"
		/>
		<span class="emoji-count">{emojis.length} emojis</span>
	</div>

	<!-- Emoji List -->
	<div class="emoji-list">
		{#if loading}
			<div class="loading">Loading emojis...</div>
		{:else if error}
			<div class="error">{error}</div>
		{:else if filteredEmojis.length === 0}
			<div class="empty">
				{#if searchQuery}
					No emojis matching "{searchQuery}"
				{:else}
					No custom emojis yet
				{/if}
			</div>
		{:else}
			{#each filteredEmojis as emoji (emoji.id)}
				<div class="emoji-item" class:animated={emoji.animated}>
					<img src={emoji.url} alt={emoji.name} class="emoji-image" />
					<div class="emoji-info">
						<span class="emoji-name">:{emoji.name}:</span>
						{#if emoji.animated}
							<span class="badge animated">GIF</span>
						{/if}
					</div>
					<div class="emoji-actions">
						<button
							class="action-btn"
							on:click={() => copyEmojiCode(emoji)}
							title="Copy code"
						>
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
								<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
							</svg>
						</button>
						{#if canManageEmoji && !emoji.managed}
							<button
								class="action-btn delete"
								on:click={() => deleteEmoji(emoji.id)}
								title="Delete emoji"
							>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
								</svg>
							</button>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.emoji-manager {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 600px;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	h3 {
		margin: 0 0 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	.upload-section {
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.upload-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.upload-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px dashed var(--bg-modifier-accent, #3f4147);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.upload-area:hover {
		border-color: var(--blurple, #5865f2);
		background: var(--bg-tertiary, #1e1f22);
	}

	.upload-area input {
		display: none;
	}

	.upload-area svg {
		color: var(--text-muted, #949ba4);
	}

	.upload-area span {
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
	}

	.upload-area .hint {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.preview-container {
		position: relative;
		display: inline-flex;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.emoji-preview {
		width: 64px;
		height: 64px;
		object-fit: contain;
	}

	.remove-btn {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 24px;
		height: 24px;
		padding: 0;
		background: var(--status-danger, #f23f43);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.name-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.name-input label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #949ba4);
	}

	.name-preview {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		font-family: monospace;
		color: var(--text-primary, #f2f3f5);
	}

	.name-preview input {
		flex: 1;
		background: transparent;
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: 14px;
		padding: 0;
	}

	.name-preview input:focus {
		outline: none;
	}

	.upload-btn {
		padding: 12px 16px;
		background: var(--blurple, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.upload-btn:hover:not(:disabled) {
		background: var(--blurple-dark, #4752c4);
	}

	.upload-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-error {
		padding: 8px 12px;
		background: rgba(242, 63, 67, 0.1);
		border-radius: 4px;
		font-size: 13px;
		color: var(--status-danger, #f23f43);
	}

	.search-section {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.search-input {
		flex: 1;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.search-input:focus {
		outline: none;
	}

	.emoji-count {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
	}

	.emoji-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.loading,
	.error,
	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-muted, #949ba4);
		text-align: center;
	}

	.error {
		color: var(--status-danger, #f23f43);
	}

	.emoji-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.emoji-item:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.emoji-image {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	.emoji-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.emoji-name {
		font-size: 14px;
		color: var(--text-primary, #f2f3f5);
		font-family: monospace;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge {
		padding: 2px 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge.animated {
		background: var(--blurple, #5865f2);
		color: white;
	}

	.emoji-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.emoji-item:hover .emoji-actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	.action-btn.delete:hover {
		background: rgba(242, 63, 67, 0.2);
		color: var(--status-danger, #f23f43);
	}
</style>
