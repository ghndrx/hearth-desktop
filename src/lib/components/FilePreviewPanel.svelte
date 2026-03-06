<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		filePreview,
		formatFileSize,
		fileTypeColor,
		fileTypeLabel,
		type FilePreviewInfo,
		type ThumbnailData,
		type TextPreviewContent,
		type FileMetadataInfo
	} from '$lib/stores/filePreview';

	interface Props {
		filePath?: string;
	}

	let { filePath = '' }: Props = $props();

	let preview = $state<FilePreviewInfo | null>(null);
	let thumbnail = $state<ThumbnailData | null>(null);
	let textPreview = $state<TextPreviewContent | null>(null);
	let metadata = $state<FileMetadataInfo | null>(null);
	let isLoading = $state(false);
	let errorMsg = $state<string | null>(null);
	let isDragOver = $state(false);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		filePreview.init();
		unsubs.push(filePreview.currentPreview.subscribe((v) => (preview = v)));
		unsubs.push(filePreview.thumbnailData.subscribe((v) => (thumbnail = v)));
		unsubs.push(filePreview.textContent.subscribe((v) => (textPreview = v)));
		unsubs.push(filePreview.metadata.subscribe((v) => (metadata = v)));
		unsubs.push(filePreview.loading.subscribe((v) => (isLoading = v)));
		unsubs.push(filePreview.error.subscribe((v) => (errorMsg = v)));

		if (filePath) {
			filePreview.previewFile(filePath);
		}
	});

	onDestroy(() => {
		filePreview.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			const path = (file as any).path ?? file.name;
			if (path) {
				filePreview.previewFile(path);
			}
		}
	}

	function handleClear() {
		filePreview.clearPreview();
	}

	function handleSendToChat() {
		if (preview) {
			const event = new CustomEvent('filepreview:send', {
				detail: { filePath: preview.filePath, fileName: preview.fileName },
				bubbles: true
			});
			document.dispatchEvent(event);
		}
	}

	function handleOpenInSystem() {
		if (preview) {
			const event = new CustomEvent('filepreview:open', {
				detail: { filePath: preview.filePath },
				bubbles: true
			});
			document.dispatchEvent(event);
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '--';
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}
</script>

<div class="filepreview-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
			<h3>File Preview</h3>
		</div>
		<div class="header-actions">
			{#if preview}
				<button class="clear-btn" onclick={handleClear} title="Clear preview">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if isLoading}
		<div class="loading-state">
			<div class="spinner"></div>
			<span>Loading preview...</span>
		</div>
	{:else if errorMsg}
		<div class="error-state">
			<span class="error-icon">!</span>
			<span>{errorMsg}</span>
		</div>
	{:else if preview}
		<!-- File info header -->
		<div class="file-header">
			<div
				class="file-icon"
				style="background-color: {fileTypeColor(preview.previewType)}"
			>
				<span class="file-icon-label">{fileTypeLabel(preview.previewType).slice(0, 3).toUpperCase()}</span>
			</div>
			<div class="file-info">
				<span class="file-name">{preview.fileName}</span>
				<span class="file-meta">
					{formatFileSize(preview.fileSize)} &middot; {preview.mimeType}
				</span>
			</div>
		</div>

		<!-- Image thumbnail -->
		{#if preview.previewType === 'image' && thumbnail}
			<div class="thumbnail-container">
				<img
					src="data:image/{thumbnail.format};base64,{thumbnail.base64}"
					alt={preview.fileName}
					width={thumbnail.width}
					height={thumbnail.height}
					class="thumbnail-img"
				/>
				{#if preview.dimensions}
					<span class="dimensions-badge">
						{preview.dimensions.width} x {preview.dimensions.height}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Text / code preview -->
		{#if (preview.previewType === 'text' || preview.previewType === 'code') && textPreview}
			<div class="text-preview">
				<div class="text-header">
					<span>{textPreview.lineCount} lines</span>
					{#if textPreview.truncated}
						<span class="truncated-badge">truncated</span>
					{/if}
				</div>
				<pre class="text-content">{textPreview.content}</pre>
			</div>
		{/if}

		<!-- Archive entries -->
		{#if preview.previewType === 'archive' && preview.entries}
			<div class="archive-list">
				<div class="archive-header">
					{preview.entries.length} entries
				</div>
				<div class="archive-entries">
					{#each preview.entries.slice(0, 50) as entry}
						<div class="archive-entry" class:is-dir={entry.isDirectory}>
							<span class="entry-icon">{entry.isDirectory ? '/' : ' '}</span>
							<span class="entry-path">{entry.path}</span>
							{#if !entry.isDirectory}
								<span class="entry-size">{formatFileSize(entry.size)}</span>
							{/if}
						</div>
					{/each}
					{#if preview.entries.length > 50}
						<div class="archive-more">...and {preview.entries.length - 50} more</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Metadata -->
		{#if metadata}
			<div class="metadata-section">
				<div class="meta-row">
					<span class="meta-label">Created</span>
					<span class="meta-value">{formatDate(metadata.created)}</span>
				</div>
				<div class="meta-row">
					<span class="meta-label">Modified</span>
					<span class="meta-value">{formatDate(metadata.modified)}</span>
				</div>
				{#if metadata.isReadonly}
					<div class="meta-row">
						<span class="meta-label">Access</span>
						<span class="meta-value readonly-badge">Read-only</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Actions -->
		<div class="actions">
			<button class="action-btn primary" onclick={handleSendToChat}>
				Send to Chat
			</button>
			<button class="action-btn secondary" onclick={handleOpenInSystem}>
				Open in System
			</button>
		</div>
	{:else}
		<!-- Empty / drop zone -->
		<div
			class="drop-zone"
			class:drag-over={isDragOver}
			role="region"
			aria-label="Drop zone"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<span class="drop-text">Drop a file here to preview</span>
			<span class="drop-hint">or pass a file path as a prop</span>
		</div>
	{/if}
</div>

<style>
	.filepreview-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
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
		gap: 4px;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.clear-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	/* Loading */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px;
		color: var(--text-secondary, #949ba4);
		font-size: 13px;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--bg-tertiary, #1e1f22);
		border-top-color: var(--accent, #5865f2);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Error */
	.error-state {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: rgba(237, 66, 69, 0.1);
		border-radius: 6px;
		font-size: 13px;
		color: var(--danger, #ed4245);
	}

	.error-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger, #ed4245);
		color: white;
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
	}

	/* File header */
	.file-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.file-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.file-icon-label {
		font-size: 10px;
		font-weight: 700;
		color: white;
		letter-spacing: 0.5px;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.file-name {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-meta {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	/* Thumbnail */
	.thumbnail-container {
		position: relative;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
	}

	.thumbnail-img {
		max-width: 100%;
		max-height: 200px;
		object-fit: contain;
		border-radius: 4px;
	}

	.dimensions-badge {
		position: absolute;
		bottom: 6px;
		right: 6px;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: var(--text-secondary, #949ba4);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}

	/* Text preview */
	.text-preview {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		overflow: hidden;
	}

	.text-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		border-bottom: 1px solid var(--border, #3f4147);
	}

	.truncated-badge {
		padding: 1px 6px;
		border-radius: 4px;
		background: rgba(254, 231, 92, 0.15);
		color: #fee75c;
		font-size: 10px;
	}

	.text-content {
		margin: 0;
		padding: 10px;
		font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-primary, #dbdee1);
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 200px;
		overflow-y: auto;
	}

	/* Archive list */
	.archive-list {
		display: flex;
		flex-direction: column;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		overflow: hidden;
	}

	.archive-header {
		padding: 6px 10px;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		border-bottom: 1px solid var(--border, #3f4147);
	}

	.archive-entries {
		max-height: 180px;
		overflow-y: auto;
	}

	.archive-entry {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		font-size: 11px;
		font-family: 'Fira Code', 'Cascadia Code', monospace;
	}
	.archive-entry.is-dir {
		color: var(--accent, #5865f2);
	}

	.entry-icon {
		width: 12px;
		text-align: center;
		color: var(--text-secondary, #949ba4);
	}

	.entry-path {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.entry-size {
		color: var(--text-secondary, #949ba4);
		font-size: 10px;
		flex-shrink: 0;
	}

	.archive-more {
		padding: 4px 10px;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		text-align: center;
		border-top: 1px solid var(--border, #3f4147);
	}

	/* Metadata */
	.metadata-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		font-size: 11px;
	}

	.meta-label {
		color: var(--text-secondary, #949ba4);
	}

	.meta-value {
		color: var(--text-primary, #dbdee1);
	}

	.readonly-badge {
		padding: 1px 6px;
		border-radius: 4px;
		background: rgba(237, 66, 69, 0.15);
		color: var(--danger, #ed4245);
		font-size: 10px;
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		flex: 1;
		padding: 8px;
		border-radius: 4px;
		border: none;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.action-btn.primary {
		background: var(--accent, #5865f2);
		color: white;
	}
	.action-btn.primary:hover {
		background: var(--accent-hover, #4752c4);
	}

	.action-btn.secondary {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
	}
	.action-btn.secondary:hover {
		color: var(--text-primary, #dbdee1);
	}

	/* Drop zone */
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 32px 16px;
		border: 2px dashed var(--border, #3f4147);
		border-radius: 8px;
		transition: border-color 0.2s, background 0.2s;
		cursor: default;
	}
	.drop-zone.drag-over {
		border-color: var(--accent, #5865f2);
		background: rgba(88, 101, 242, 0.08);
	}

	.drop-icon {
		width: 32px;
		height: 32px;
		color: var(--text-secondary, #949ba4);
	}

	.drop-text {
		font-size: 13px;
		color: var(--text-primary, #dbdee1);
		font-weight: 500;
	}

	.drop-hint {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}
</style>
