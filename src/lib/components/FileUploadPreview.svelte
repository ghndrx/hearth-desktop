<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	export let files: File[] = [];
	export let maxFiles = 10;
	export let maxSizeMB = 25;
	export let accept = '';
	export let disabled = false;

	let isDragover = false;
	let fileInput: HTMLInputElement;
	let objectUrls = new Map<string, string>();

	const dispatch = createEventDispatcher<{
		add: File[];
		remove: { file: File; index: number };
		clear: void;
		error: { message: string };
	}>();

	$: atMaxFiles = files.length >= maxFiles;

	function getFileKey(file: File): string {
		return `${file.name}-${file.size}-${file.lastModified}`;
	}

	function getObjectUrl(file: File): string {
		const key = getFileKey(file);
		if (!objectUrls.has(key)) {
			objectUrls.set(key, URL.createObjectURL(file));
		}
		return objectUrls.get(key)!;
	}

	function revokeObjectUrl(file: File) {
		const key = getFileKey(file);
		const url = objectUrls.get(key);
		if (url) {
			URL.revokeObjectURL(url);
			objectUrls.delete(key);
		}
	}

	function revokeAllUrls() {
		for (const url of objectUrls.values()) {
			URL.revokeObjectURL(url);
		}
		objectUrls.clear();
	}

	function isImageFile(file: File): boolean {
		return file.type.startsWith('image/');
	}

	function getFileType(file: File): string {
		if (file.type.startsWith('image/')) return 'image';
		if (file.type.startsWith('video/')) return 'video';
		if (file.type.startsWith('audio/')) return 'audio';
		if (file.type === 'application/pdf') return 'pdf';
		return 'file';
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function handleFiles(newFiles: FileList | File[]) {
		const fileArray = Array.from(newFiles);
		const validFiles: File[] = [];

		for (const file of fileArray) {
			if (files.length + validFiles.length >= maxFiles) {
				dispatch('error', { message: `Maximum ${maxFiles} files allowed` });
				break;
			}
			if (file.size > maxSizeMB * 1024 * 1024) {
				dispatch('error', { message: `${file.name} exceeds ${maxSizeMB}MB limit` });
				continue;
			}
			validFiles.push(file);
		}

		if (validFiles.length > 0) {
			files = [...files, ...validFiles];
			dispatch('add', validFiles);
		}
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			handleFiles(target.files);
			target.value = '';
		}
	}

	function removeFile(index: number) {
		const file = files[index];
		revokeObjectUrl(file);
		files = files.filter((_, i) => i !== index);
		dispatch('remove', { file, index });
	}

	function clearAll() {
		revokeAllUrls();
		files = [];
		dispatch('clear');
	}

	function openFilePicker() {
		if (disabled || atMaxFiles) return;
		fileInput?.click();
	}

	function handleDragenter(e: DragEvent) {
		e.preventDefault();
		if (disabled) return;
		isDragover = true;
	}

	function handleDragover(e: DragEvent) {
		e.preventDefault();
	}

	function handleDragleave(e: DragEvent) {
		isDragover = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragover = false;
		if (disabled) return;
		if (e.dataTransfer?.files) {
			handleFiles(e.dataTransfer.files);
		}
	}

	function handleDropZoneKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openFilePicker();
		}
	}

	onDestroy(() => {
		revokeAllUrls();
	});
</script>

<div class="file-upload-preview" class:disabled>
	{#if files.length === 0}
		<div
			class="drop-zone"
			class:dragover={isDragover}
			role="button"
			tabindex={disabled ? -1 : 0}
			aria-label="Upload files by clicking or dragging"
			on:click={openFilePicker}
			on:keydown={handleDropZoneKeydown}
			on:dragenter={handleDragenter}
			on:dragover={handleDragover}
			on:dragleave={handleDragleave}
			on:drop={handleDrop}
		>
			<div class="drop-prompt">
				<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true">
					<path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
				</svg>
				<p>Drag and drop files here</p>
				<p class="drop-hint">or click to browse</p>
				<p class="drop-limits">Max {maxSizeMB}MB per file &middot; Up to {maxFiles} files</p>
			</div>
		</div>
	{:else}
		<div class="file-list">
			<div class="file-list-header">
				<span class="file-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
				<div class="file-list-actions">
					<button
						class="add-btn"
						type="button"
						disabled={atMaxFiles || disabled}
						on:click={openFilePicker}
					>
						Add more
					</button>
					<button
						class="clear-btn"
						type="button"
						disabled={disabled}
						on:click={clearAll}
					>
						Clear all
					</button>
				</div>
			</div>

			{#each files as file, index}
				<div class="file-item">
					{#if isImageFile(file)}
						<img
							class="file-thumbnail"
							src={getObjectUrl(file)}
							alt={file.name}
						/>
					{:else}
						<div class="file-icon" data-type={getFileType(file)}>
							<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
								<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
							</svg>
						</div>
					{/if}
					<div class="file-info">
						<span class="file-name">{file.name}</span>
						<span class="file-size">{formatFileSize(file.size)}</span>
					</div>
					<button
						class="remove-btn"
						type="button"
						disabled={disabled}
						aria-label="Remove {file.name}"
						on:click={() => removeFile(index)}
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
							<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<input
		bind:this={fileInput}
		class="hidden-input"
		type="file"
		multiple
		{accept}
		tabindex="-1"
		aria-hidden="true"
		disabled={disabled}
		on:change={handleInputChange}
	/>
</div>

<style>
	.file-upload-preview {
		width: 100%;
	}

	.file-upload-preview.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.drop-zone {
		border: 2px dashed var(--bg-modifier-active, #404249);
		border-radius: 8px;
		padding: 32px;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.drop-zone:hover,
	.drop-zone.dragover {
		border-color: var(--blurple, #5865f2);
		background: rgba(88, 101, 242, 0.05);
	}

	.drop-zone:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.drop-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: var(--text-muted, #b5bac1);
	}

	.drop-prompt p {
		margin: 0;
		font-size: 14px;
	}

	.drop-hint {
		font-size: 12px !important;
		color: var(--text-faint, #6d6f78);
	}

	.drop-limits {
		font-size: 12px !important;
		color: var(--text-faint, #6d6f78);
		margin-top: 4px !important;
	}

	.hidden-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.file-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.file-list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
	}

	.file-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
	}

	.file-list-actions {
		display: flex;
		gap: 8px;
	}

	.add-btn,
	.clear-btn {
		background: none;
		border: none;
		font-size: 12px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 3px;
		transition: background-color 0.1s ease;
	}

	.add-btn {
		color: var(--text-link, #00aff4);
	}

	.add-btn:hover:not(:disabled) {
		background: rgba(0, 175, 244, 0.1);
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.clear-btn {
		color: var(--red, #da373c);
	}

	.clear-btn:hover:not(:disabled) {
		background: rgba(218, 55, 60, 0.1);
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}

	.file-thumbnail {
		width: 40px;
		height: 40px;
		object-fit: cover;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.file-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	.file-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.file-name {
		font-size: 14px;
		color: var(--text-normal, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-size {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 6px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color 0.1s ease;
	}

	.remove-btn:hover:not(:disabled) {
		color: var(--red, #da373c);
	}

	.remove-btn:disabled {
		cursor: not-allowed;
	}
</style>
