<script lang="ts" context="module">
	export interface UploadItem {
		id: string;
		file: File;
		progress: number;
		status: 'pending' | 'uploading' | 'completed' | 'error';
		error?: string;
		url?: string;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	export let uploads: UploadItem[] = [];
	export let show = false;

	const dispatch = createEventDispatcher<{
		cancel: { id: string };
		retry: { id: string };
		remove: { id: string };
	}>();

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function getFileIcon(contentType: string): string {
		if (contentType.startsWith('image/')) return '🖼️';
		if (contentType.startsWith('video/')) return '🎬';
		if (contentType.startsWith('audio/')) return '🎵';
		if (contentType.includes('pdf')) return '📄';
		if (contentType.includes('zip') || contentType.includes('rar')) return '📦';
		if (contentType.includes('word') || contentType.includes('document')) return '📝';
		return '📎';
	}

	function handleCancel(id: string) {
		dispatch('cancel', { id });
	}

	function handleRetry(id: string) {
		dispatch('retry', { id });
	}

	function handleRemove(id: string) {
		dispatch('remove', { id });
	}

	$: activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending');
	$: hasUploads = uploads.length > 0;
	$: overallProgress = uploads.length > 0 
		? Math.round(uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length)
		: 0;
</script>

{#if show && hasUploads}
	<div class="upload-progress-container" transition:slide={{ duration: 200 }}>
		<!-- Header -->
		<div class="progress-header">
			<div class="header-left">
				<span class="upload-icon">
					{#if activeUploads.length > 0}
						<svg class="spinner" viewBox="0 0 24 24" width="18" height="18">
							<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4" stroke-dashoffset="10" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
						</svg>
					{/if}
				</span>
				<span class="header-text">
					{#if activeUploads.length > 0}
						Uploading {activeUploads.length} file{activeUploads.length > 1 ? 's' : ''} - {overallProgress}%
					{:else}
						Upload complete
					{/if}
				</span>
			</div>
		</div>

		<!-- Upload List -->
		<div class="upload-list">
			{#each uploads as upload (upload.id)}
				<div 
					class="upload-item"
					class:error={upload.status === 'error'}
					class:completed={upload.status === 'completed'}
					transition:fade={{ duration: 150 }}
				>
					<div class="file-info">
						<span class="file-icon">{getFileIcon(upload.file.type)}</span>
						<div class="file-details">
							<span class="file-name" title={upload.file.name}>
								{upload.file.name}
							</span>
							<span class="file-size">{formatFileSize(upload.file.size)}</span>
						</div>
					</div>

					<div class="upload-status">
						{#if upload.status === 'uploading' || upload.status === 'pending'}
							<div class="progress-bar">
								<div class="progress-fill" style="width: {upload.progress}%"></div>
							</div>
							<span class="progress-text">{upload.progress}%</span>
							<button 
								class="cancel-btn" 
								on:click={() => handleCancel(upload.id)}
								title="Cancel upload"
								aria-label="Cancel upload of {upload.file.name}"
							>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
								</svg>
							</button>
						{:else if upload.status === 'completed'}
							<span class="status-icon success">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
								</svg>
							</span>
							<button 
								class="remove-btn" 
								on:click={() => handleRemove(upload.id)}
								title="Remove from list"
								aria-label="Remove {upload.file.name} from list"
							>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
								</svg>
							</button>
						{:else if upload.status === 'error'}
							<span class="error-text" title={upload.error}>{upload.error || 'Failed'}</span>
							<button 
								class="retry-btn" 
								on:click={() => handleRetry(upload.id)}
								title="Retry upload"
								aria-label="Retry upload of {upload.file.name}"
							>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
								</svg>
							</button>
							<button 
								class="remove-btn" 
								on:click={() => handleRemove(upload.id)}
								title="Remove from list"
								aria-label="Remove {upload.file.name} from list"
							>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
								</svg>
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.upload-progress-container {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px 8px 0 0;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-bottom: none;
		overflow: hidden;
	}

	.progress-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.upload-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--blurple, #5865f2);
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.header-text {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary, #f2f3f5);
	}

	.upload-list {
		max-height: 200px;
		overflow-y: auto;
	}

	.upload-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		gap: 12px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.upload-item:last-child {
		border-bottom: none;
	}

	.upload-item.error {
		background: rgba(242, 63, 67, 0.1);
	}

	.file-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1;
	}

	.file-icon {
		font-size: 18px;
		flex-shrink: 0;
	}

	.file-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.file-name {
		font-size: 13px;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}

	.file-size {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.upload-status {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.progress-bar {
		width: 80px;
		height: 4px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--blurple, #5865f2);
		border-radius: 2px;
		transition: width 0.2s ease;
	}

	.progress-text {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		min-width: 32px;
		text-align: right;
	}

	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-icon.success {
		color: var(--status-positive, #3ba55d);
	}

	.error-text {
		font-size: 11px;
		color: var(--status-danger, #f23f43);
		max-width: 100px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cancel-btn,
	.retry-btn,
	.remove-btn {
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
		transition: all 0.15s;
	}

	.cancel-btn:hover,
	.remove-btn:hover {
		background: rgba(242, 63, 67, 0.2);
		color: var(--status-danger, #f23f43);
	}

	.retry-btn:hover {
		background: rgba(88, 101, 242, 0.2);
		color: var(--blurple, #5865f2);
	}
</style>
