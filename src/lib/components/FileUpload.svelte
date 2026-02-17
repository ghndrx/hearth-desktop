<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	/**
	 * FileUpload Component
	 *
	 * A reusable file upload component with drag-drop zone, file picker,
	 * upload progress indicator, and preview thumbnails.
	 */

	// Extended type for files with alt text (A11Y-004)
	interface FileWithAltText {
		file: File;
		altText: string;
	}

	const dispatch = createEventDispatcher<{
		select: { files: File[] };
		remove: { file: File; index: number };
		upload: { files: File[]; altTexts: Record<string, string> };
	}>();

	export let files: File[] = [];
	export let accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar';
	export let multiple = true;
	export let maxFiles = 10;
	export let maxFileSize = 50 * 1024 * 1024; // 50MB default
	export let disabled = false;
	export let uploading = false;
	export let uploadProgress: Record<string, number> = {}; // filename -> progress (0-100)
	export let showPreview = true;
	export let compact = false;

	let dragOver = false;
	let dragCounter = 0;
	let fileInputElement: HTMLInputElement;
	let errorMessage = '';
	
	// Alt text storage for accessibility (A11Y-004)
	let altTexts: Record<string, string> = {}; // filename -> alt text
	
	function isImageFile(file: File): boolean {
		return file.type.startsWith('image/');
	}
	
	function updateAltText(filename: string, text: string) {
		altTexts[filename] = text;
		altTexts = altTexts; // trigger reactivity
	}

	$: totalProgress = files.length
		? Math.round(
				files.reduce((sum, f) => sum + (uploadProgress[f.name] || 0), 0) / files.length
			)
		: 0;

	function validateFile(file: File): string | null {
		if (file.size > maxFileSize) {
			return `File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}`;
		}
		return null;
	}

	function addFiles(newFiles: FileList | File[]) {
		errorMessage = '';
		const fileArray = Array.from(newFiles);

		// Check max files limit
		if (files.length + fileArray.length > maxFiles) {
			errorMessage = `Maximum ${maxFiles} files allowed`;
			return;
		}

		// Validate each file
		for (const file of fileArray) {
			const error = validateFile(file);
			if (error) {
				errorMessage = error;
				return;
			}
		}

		// Filter out duplicates
		const uniqueFiles = fileArray.filter(
			(newFile) => !files.some((f) => f.name === newFile.name && f.size === newFile.size)
		);

		if (uniqueFiles.length === 0) {
			errorMessage = 'Files already added';
			return;
		}

		files = [...files, ...uniqueFiles];
		dispatch('select', { files: uniqueFiles });
	}

	function removeFile(index: number) {
		const removed = files[index];
		// Clean up alt text for removed file (A11Y-004)
		if (altTexts[removed.name]) {
			delete altTexts[removed.name];
			altTexts = altTexts; // trigger reactivity
		}
		files = files.filter((_, i) => i !== index);
		dispatch('remove', { file: removed, index });
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.types.includes('Files')) {
			dragOver = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			dragOver = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragOver = false;
		dragCounter = 0;

		if (disabled || uploading) return;

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles?.length) {
			addFiles(droppedFiles);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			addFiles(input.files);
			// Reset input so same file can be selected again
			input.value = '';
		}
	}

	function openFilePicker() {
		fileInputElement?.click();
	}

	function handlePaste(e: ClipboardEvent) {
		if (disabled || uploading) return;

		const items = e.clipboardData?.items;
		if (!items) return;

		const pastedFiles: File[] = [];
		for (const item of items) {
			if (item.kind === 'file') {
				const file = item.getAsFile();
				if (file) pastedFiles.push(file);
			}
		}

		if (pastedFiles.length) {
			e.preventDefault();
			addFiles(pastedFiles);
		}
	}

	function triggerUpload() {
		if (files.length && !uploading) {
			dispatch('upload', { files, altTexts });
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function getFileIcon(file: File): string {
		const type = file.type;
		if (type.startsWith('image/')) return 'image';
		if (type.startsWith('video/')) return 'video';
		if (type.startsWith('audio/')) return 'audio';
		if (type.includes('pdf')) return 'pdf';
		if (type.includes('document') || type.includes('word')) return 'doc';
		if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return 'archive';
		return 'file';
	}

	function createPreviewUrl(file: File): string | null {
		if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
			return URL.createObjectURL(file);
		}
		return null;
	}

	function clearError() {
		errorMessage = '';
	}
</script>

<svelte:window on:paste={handlePaste} />

<div
	class="file-upload"
	class:compact
	class:disabled
	class:uploading
	role="region"
	aria-label="File upload area"
>
	<!-- Hidden File Input -->
	<input
		type="file"
		bind:this={fileInputElement}
		{accept}
		{multiple}
		{disabled}
		on:change={handleFileInput}
		class="hidden-input"
		aria-hidden="true"
		tabindex="-1"
	/>

	<!-- Drop Zone -->
	<div
		class="drop-zone"
		class:drag-over={dragOver}
		class:has-files={files.length > 0}
		on:dragenter={handleDragEnter}
		on:dragleave={handleDragLeave}
		on:dragover={handleDragOver}
		on:drop={handleDrop}
		on:click={openFilePicker}
		on:keydown={(e) => e.key === 'Enter' && openFilePicker()}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-label="Click or drag files to upload"
		aria-disabled={disabled}
	>
		{#if dragOver}
			<div class="drag-overlay" transition:fade={{ duration: 100 }}>
				<svg class="upload-icon pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				<p class="drag-text">Drop files here</p>
			</div>
		{:else if files.length === 0}
			<div class="empty-state">
				<svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				<p class="drop-text">
					{#if compact}
						Drop files or <span class="link">browse</span>
					{:else}
						Drag and drop files here, or <span class="link">click to browse</span>
					{/if}
				</p>
				<p class="drop-hint">
					Max {maxFiles} files, up to {formatFileSize(maxFileSize)} each
				</p>
			</div>
		{/if}
	</div>

	<!-- Error Message -->
	{#if errorMessage}
		<div class="error-message" role="alert" transition:fade={{ duration: 150 }}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<span>{errorMessage}</span>
			<button class="error-close" on:click={clearError} aria-label="Dismiss error">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- File Previews -->
	{#if files.length > 0 && showPreview}
		<div class="file-list" role="list" aria-label="Selected files">
			{#each files as file, index (file.name + file.size)}
				{@const previewUrl = createPreviewUrl(file)}
				{@const fileIcon = getFileIcon(file)}
				{@const progress = uploadProgress[file.name] ?? 0}
				{@const isUploading = uploading && progress < 100}
				{@const isComplete = progress === 100}

				<div
					class="file-item"
					class:uploading={isUploading}
					class:complete={isComplete}
					role="listitem"
					transition:scale={{ duration: 150, start: 0.9 }}
				>
					<!-- Thumbnail / Icon -->
					<div class="file-thumbnail">
						{#if previewUrl && file.type.startsWith('image/')}
							<img src={previewUrl} alt={file.name} loading="lazy" />
						{:else if previewUrl && file.type.startsWith('video/')}
							<video src={previewUrl} muted preload="metadata">
								<track kind="captions" />
							</video>
							<div class="video-overlay">
								<svg viewBox="0 0 24 24" fill="currentColor">
									<polygon points="5 3 19 12 5 21 5 3" />
								</svg>
							</div>
						{:else}
							<div class="file-icon file-icon-{fileIcon}">
								{#if fileIcon === 'image'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<polyline points="21 15 16 10 5 21" />
									</svg>
								{:else if fileIcon === 'video'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polygon points="23 7 16 12 23 17 23 7" />
										<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
									</svg>
								{:else if fileIcon === 'audio'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M9 18V5l12-2v13" />
										<circle cx="6" cy="18" r="3" />
										<circle cx="18" cy="16" r="3" />
									</svg>
								{:else if fileIcon === 'pdf'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14 2 14 8 20 8" />
										<line x1="16" y1="13" x2="8" y2="13" />
										<line x1="16" y1="17" x2="8" y2="17" />
									</svg>
								{:else if fileIcon === 'archive'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
									</svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14 2 14 8 20 8" />
									</svg>
								{/if}
							</div>
						{/if}

						<!-- Progress Overlay -->
						{#if isUploading}
							<div class="progress-overlay">
								<svg class="progress-ring" viewBox="0 0 36 36">
									<path
										class="progress-ring-bg"
										d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									/>
									<path
										class="progress-ring-fill"
										stroke-dasharray="{progress}, 100"
										d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
									/>
								</svg>
								<span class="progress-text">{progress}%</span>
							</div>
						{/if}

						<!-- Complete Checkmark -->
						{#if isComplete}
							<div class="complete-overlay" transition:scale={{ duration: 200 }}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							</div>
						{/if}
					</div>

					<!-- File Info -->
					<div class="file-info">
						<span class="file-name" title={file.name}>{file.name}</span>
						<span class="file-size">{formatFileSize(file.size)}</span>
						
						<!-- Alt Text Input for Images (A11Y-004) -->
						{#if isImageFile(file) && !uploading}
							<input
								type="text"
								class="alt-text-input"
								placeholder="Add description (alt text)"
								value={altTexts[file.name] || ''}
								on:input={(e) => updateAltText(file.name, e.currentTarget.value)}
								on:click|stopPropagation
								aria-label="Image description for {file.name}"
								maxlength="500"
							/>
						{:else if isImageFile(file) && altTexts[file.name]}
							<span class="alt-text-preview" title={altTexts[file.name]}>
								📝 {altTexts[file.name].substring(0, 30)}{altTexts[file.name].length > 30 ? '...' : ''}
							</span>
						{/if}
					</div>

					<!-- Remove Button -->
					{#if !uploading}
						<button
							class="remove-btn"
							on:click|stopPropagation={() => removeFile(index)}
							aria-label="Remove {file.name}"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Overall Upload Progress Bar (when uploading) -->
	{#if uploading && files.length > 0}
		<div class="upload-progress-bar" role="progressbar" aria-valuenow={totalProgress} aria-valuemin="0" aria-valuemax="100">
			<div class="progress-track">
				<div class="progress-fill" style="width: {totalProgress}%"></div>
			</div>
			<span class="progress-label">Uploading... {totalProgress}%</span>
		</div>
	{/if}

	<!-- Action Buttons -->
	{#if files.length > 0 && !compact}
		<div class="actions">
			<button
				class="action-btn secondary"
				on:click={openFilePicker}
				disabled={disabled || uploading || files.length >= maxFiles}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Add More
			</button>
			<button
				class="action-btn primary"
				on:click={triggerUpload}
				disabled={disabled || uploading}
			>
				{#if uploading}
					<span class="spinner"></span>
					Uploading...
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
					Upload {files.length} file{files.length !== 1 ? 's' : ''}
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.file-upload {
		width: 100%;
	}

	.hidden-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	/* Drop Zone */
	.drop-zone {
		position: relative;
		border: 2px dashed var(--bg-modifier-accent, #4f545c);
		border-radius: 8px;
		padding: 32px 24px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s ease;
		background: var(--bg-secondary, #2b2d31);
	}

	.drop-zone:hover:not(.disabled) {
		border-color: var(--brand-primary, #5865f2);
		background: var(--bg-tertiary, #1e1f22);
	}

	.drop-zone:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
	}

	.drop-zone.drag-over {
		border-color: var(--brand-primary, #5865f2);
		background: rgba(88, 101, 242, 0.1);
	}

	.drop-zone.has-files {
		padding: 16px;
		border-style: solid;
	}

	.compact .drop-zone {
		padding: 16px;
	}

	.disabled .drop-zone,
	.uploading .drop-zone {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Drag Overlay */
	.drag-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(88, 101, 242, 0.15);
		border-radius: 6px;
		z-index: 10;
	}

	.drag-text {
		margin: 8px 0 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--brand-primary, #5865f2);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.upload-icon {
		width: 48px;
		height: 48px;
		color: var(--text-muted, #949ba4);
		margin-bottom: 8px;
	}

	.upload-icon.pulse {
		animation: pulse 1s ease-in-out infinite;
		color: var(--brand-primary, #5865f2);
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); opacity: 1; }
		50% { transform: scale(1.1); opacity: 0.8; }
	}

	.compact .upload-icon {
		width: 32px;
		height: 32px;
		margin-bottom: 4px;
	}

	.drop-text {
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
		margin: 0;
	}

	.drop-text .link {
		color: var(--brand-primary, #5865f2);
		font-weight: 500;
	}

	.drop-hint {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		margin: 0;
	}

	/* Error Message */
	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		margin-top: 8px;
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid var(--status-danger, #f23f43);
		border-radius: 4px;
		color: var(--status-danger, #f23f43);
		font-size: 14px;
	}

	.error-message svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.error-message span {
		flex: 1;
	}

	.error-close {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: inherit;
		border-radius: 4px;
		display: flex;
	}

	.error-close:hover {
		background: rgba(242, 63, 67, 0.2);
	}

	.error-close svg {
		width: 16px;
		height: 16px;
	}

	/* File List */
	.file-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
		margin-top: 16px;
	}

	.compact .file-list {
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 8px;
		margin-top: 12px;
	}

	/* File Item */
	.file-item {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.15s ease;
	}

	.file-item:hover {
		transform: translateY(-2px);
	}

	.file-item.uploading {
		opacity: 0.9;
	}

	.file-item.complete {
		border: 2px solid var(--status-positive, #23a55a);
	}

	/* File Thumbnail */
	.file-thumbnail {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #2b2d31);
		overflow: hidden;
	}

	.file-thumbnail img,
	.file-thumbnail video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.video-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
	}

	.video-overlay svg {
		width: 32px;
		height: 32px;
		color: white;
	}

	/* File Icon */
	.file-icon {
		width: 48px;
		height: 48px;
		padding: 12px;
		border-radius: 8px;
		color: var(--text-muted, #949ba4);
	}

	.file-icon svg {
		width: 100%;
		height: 100%;
	}

	.file-icon-image { background: rgba(88, 101, 242, 0.2); color: var(--brand-primary, #5865f2); }
	.file-icon-video { background: rgba(235, 69, 158, 0.2); color: #eb459e; }
	.file-icon-audio { background: rgba(87, 242, 135, 0.2); color: #57f287; }
	.file-icon-pdf { background: rgba(237, 66, 69, 0.2); color: #ed4245; }
	.file-icon-doc { background: rgba(88, 101, 242, 0.2); color: #5865f2; }
	.file-icon-archive { background: rgba(254, 231, 92, 0.2); color: #fee75c; }

	/* Progress Overlay */
	.progress-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
	}

	.progress-ring {
		width: 48px;
		height: 48px;
		transform: rotate(-90deg);
	}

	.progress-ring-bg,
	.progress-ring-fill {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
	}

	.progress-ring-bg {
		stroke: rgba(255, 255, 255, 0.2);
	}

	.progress-ring-fill {
		stroke: var(--brand-primary, #5865f2);
		transition: stroke-dasharray 0.3s ease;
	}

	.progress-text {
		position: absolute;
		font-size: 11px;
		font-weight: 600;
		color: white;
	}

	/* Complete Overlay */
	.complete-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(35, 165, 90, 0.8);
	}

	.complete-overlay svg {
		width: 32px;
		height: 32px;
		color: white;
	}

	/* File Info */
	.file-info {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.file-name {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-size {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	/* Alt Text Input (A11Y-004) */
	.alt-text-input {
		margin-top: 4px;
		padding: 4px 8px;
		font-size: 11px;
		color: var(--text-normal, #f2f3f5);
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		border-radius: 4px;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.15s ease;
	}

	.alt-text-input:focus {
		outline: none;
		border-color: var(--brand-primary, #5865f2);
	}

	.alt-text-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.alt-text-preview {
		margin-top: 4px;
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Remove Button */
	.remove-btn {
		position: absolute;
		top: 4px;
		right: 4px;
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
		opacity: 0;
		transition: all 0.15s ease;
		z-index: 5;
	}

	.file-item:hover .remove-btn {
		opacity: 1;
	}

	.remove-btn:hover {
		transform: scale(1.1);
		background: #d83c3e;
	}

	.remove-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Upload Progress Bar */
	.upload-progress-bar {
		margin-top: 16px;
	}

	.progress-track {
		height: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--brand-primary, #5865f2);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-label {
		display: block;
		margin-top: 8px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		text-align: center;
	}

	/* Action Buttons */
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn svg {
		width: 18px;
		height: 18px;
	}

	.action-btn.primary {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.action-btn.primary:hover:not(:disabled) {
		background: var(--brand-primary-dark, #4752c4);
	}

	.action-btn.secondary {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #f2f3f5);
	}

	.action-btn.secondary:hover:not(:disabled) {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Spinner */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
