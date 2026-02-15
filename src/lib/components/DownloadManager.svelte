<script lang="ts">
	import { fade, slide, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { downloadsStore, downloadsIsOpen, downloadsActions, downloadStats, hasActiveDownloads, formatFileSize, formatSpeed, formatDuration } from '$lib/stores/downloads';
	import { invoke } from '@tauri-apps/api/core';
	import { browser } from '$app/environment';
	import Tooltip from './Tooltip.svelte';

	let expanded = true;
	let hoveredItem: string | null = null;

	$: stats = $downloadStats;
	$: activeDownloads = $downloadsStore.filter(d => d.status === 'downloading' || d.status === 'pending');
	$: completedDownloads = $downloadsStore.filter(d => d.status === 'completed');
	$: failedDownloads = $downloadsStore.filter(d => d.status === 'failed');

	async function openFile(filepath: string) {
		if (!browser) return;
		try {
			await invoke('open_file', { filepath });
		} catch (error) {
			console.error('Failed to open file:', error);
		}
	}

	async function revealInFolder(filepath: string) {
		if (!browser) return;
		try {
			await invoke('reveal_in_folder', { filepath });
		} catch (error) {
			console.error('Failed to reveal file:', error);
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'completed': return '✓';
			case 'failed': return '✕';
			case 'cancelled': return '⊘';
			case 'downloading': return '↓';
			case 'pending': return '◐';
			default: return '?';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'completed': return '#23a559';
			case 'failed': return '#f23f43';
			case 'cancelled': return '#949ba4';
			case 'downloading': return '#5865f2';
			case 'pending': return '#f0b232';
			default: return '#949ba4';
		}
	}

	function getFileIcon(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'pdf': return '📄';
			case 'jpg':
			case 'jpeg':
			case 'png':
			case 'gif':
			case 'webp': return '🖼️';
			case 'mp4':
			case 'mov':
			case 'avi': return '🎬';
			case 'mp3':
			case 'wav':
			case 'ogg': return '🎵';
			case 'zip':
			case 'rar':
			case '7z': return '📦';
			case 'doc':
			case 'docx': return '📝';
			case 'xls':
			case 'xlsx': return '📊';
			case 'ppt':
			case 'pptx': return '📽️';
			default: return '📎';
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			downloadsActions.close();
		}
	}
</script>

{#if $downloadsIsOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="download-manager-overlay" on:click={handleBackdropClick} transition:fade={{ duration: 200 }}>
		<div 
			class="download-manager"
			transition:fly={{ y: 20, duration: 300, easing: quintOut }}
		>
			<!-- Header -->
			<div class="dm-header">
				<div class="dm-title">
					<span class="dm-icon">📥</span>
					<h3>Downloads</h3>
					{#if stats.active > 0}
						<span class="dm-badge active">{stats.active}</span>
					{/if}
				</div>
				<div class="dm-actions">
					<button 
						class="dm-btn dm-btn-icon"
						on:click={() => expanded = !expanded}
						title={expanded ? "Collapse" : "Expand"}
					>
						{expanded ? '▼' : '▶'}
					</button>
					<button 
						class="dm-btn dm-btn-icon"
						on:click={() => downloadsActions.clearCompleted()}
						disabled={completedDownloads.length === 0}
						title="Clear completed"
					>
						🗑️
					</button>
					<button 
						class="dm-btn dm-btn-icon dm-btn-close"
						on:click={() => downloadsActions.close()}
						title="Close"
					>
						✕
					</button>
				</div>
			</div>

			{#if expanded}
				<div class="dm-content" transition:slide={{ duration: 200 }}>
					<!-- Stats Bar -->
					<div class="dm-stats">
						<div class="dm-stat">
							<span class="dm-stat-value">{stats.active}</span>
							<span class="dm-stat-label">Active</span>
						</div>
						<div class="dm-stat">
							<span class="dm-stat-value">{stats.completed}</span>
							<span class="dm-stat-label">Completed</span>
						</div>
						<div class="dm-stat">
							<span class="dm-stat-value">{formatFileSize(stats.downloadedBytes)}</span>
							<span class="dm-stat-label">Downloaded</span>
						</div>
					</div>

					<!-- Downloads List -->
					<div class="dm-list">
						{#if $downloadsStore.length === 0}
							<div class="dm-empty">
								<span class="dm-empty-icon">📂</span>
								<p>No downloads yet</p>
								<p class="dm-empty-hint">Files you download will appear here</p>
							</div>
						{:else}
							{#each $downloadsStore as download (download.id)}
								<div 
									class="dm-item"
									class:active={download.status === 'downloading'}
									on:mouseenter={() => hoveredItem = download.id}
									on:mouseleave={() => hoveredItem = null}
									transition:slide={{ duration: 150 }}
								>
									<!-- File Icon -->
									<div class="dm-item-icon">
										{getFileIcon(download.filename)}
									</div>

									<!-- File Info -->
									<div class="dm-item-info">
										<div class="dm-item-name" title={download.filename}>
											{download.filename}
										</div>
										<div class="dm-item-meta">
											{#if download.status === 'downloading'}
												<span class="dm-item-speed">{formatSpeed(download.speed)}</span>
												<span class="dm-item-size">
													{formatFileSize(download.downloaded)} / {formatFileSize(download.size)}
												</span>
											{:else if download.status === 'completed' && download.endTime}
												<span class="dm-item-size">{formatFileSize(download.size)}</span>
												<span class="dm-item-time">
													Completed {formatDuration(Date.now() - download.endTime)} ago
												</span>
											{:else if download.status === 'failed'}
												<span class="dm-item-error" title={download.error}>Failed: {download.error}</span>
											{:else}
												<span class="dm-item-size">{formatFileSize(download.size)}</span>
											{/if}
										</div>

										<!-- Progress Bar -->
										{#if download.status === 'downloading'}
											<div class="dm-progress">
												<div 
													class="dm-progress-bar"
													style="width: {download.progress}%"
												></div>
											</div>
										{/if}
									</div>

									<!-- Status -->
									<div class="dm-item-status" style="color: {getStatusColor(download.status)}">
										{#if download.status === 'downloading'}
											<span class="dm-status-text">{download.progress}%</span>
										{/if}
										<span class="dm-status-icon">{getStatusIcon(download.status)}</span>
									</div>

									<!-- Actions -->
									<div class="dm-item-actions" class:visible={hoveredItem === download.id}>
										{#if download.status === 'completed' && download.filepath}
											<Tooltip text="Open file" position="top">
												<button 
													class="dm-btn dm-btn-sm"
													on:click={() => openFile(download.filepath!)}
												>
													📂
												</button>
											</Tooltip>
											<Tooltip text="Show in folder" position="top">
												<button 
													class="dm-btn dm-btn-sm"
													on:click={() => revealInFolder(download.filepath!)}
												>
													📁
												</button>
											</Tooltip>
										{/if}
										<button 
											class="dm-btn dm-btn-sm dm-btn-danger"
											on:click={() => downloadsActions.remove(download.id)}
											title="Remove from list"
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.download-manager-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.download-manager {
		width: 500px;
		max-width: 90vw;
		max-height: 80vh;
		background: var(--background-primary, #313338);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		border: 1px solid var(--background-tertiary, #1e1f22);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dm-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--background-tertiary, #1e1f22);
		background: var(--background-secondary, #2b2d31);
	}

	.dm-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.dm-icon {
		font-size: 20px;
	}

	.dm-title h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.dm-badge {
		background: var(--brand-experiment, #5865f2);
		color: white;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		min-width: 20px;
		text-align: center;
	}

	.dm-badge.active {
		background: #23a559;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.dm-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dm-btn {
		background: transparent;
		border: none;
		color: var(--interactive-normal, #b5bac1);
		cursor: pointer;
		padding: 6px;
		border-radius: 4px;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
	}

	.dm-btn:hover:not(:disabled) {
		background: var(--background-modifier-hover, rgba(255, 255, 255, 0.05));
		color: var(--interactive-hover, #dbdee1);
	}

	.dm-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.dm-btn-close:hover {
		background: #f23f43 !important;
		color: white !important;
	}

	.dm-btn-sm {
		padding: 4px;
		font-size: 12px;
	}

	.dm-btn-danger:hover {
		background: #f23f43 !important;
		color: white !important;
	}

	.dm-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.dm-stats {
		display: flex;
		padding: 12px 20px;
		gap: 24px;
		border-bottom: 1px solid var(--background-modifier-accent, rgba(255, 255, 255, 0.06));
		background: rgba(0, 0, 0, 0.2);
	}

	.dm-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dm-stat-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
	}

	.dm-stat-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.dm-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		max-height: 400px;
	}

	.dm-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 20px;
		color: var(--text-muted, #949ba4);
		text-align: center;
	}

	.dm-empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.dm-empty p {
		margin: 0;
		font-size: 16px;
		color: var(--header-primary, #f2f3f5);
	}

	.dm-empty-hint {
		font-size: 13px !important;
		margin-top: 4px !important;
		opacity: 0.7;
	}

	.dm-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		background: var(--background-secondary, #2b2d31);
		margin-bottom: 8px;
		transition: all 0.15s ease;
		position: relative;
		overflow: hidden;
	}

	.dm-item:hover {
		background: var(--background-modifier-hover, rgba(255, 255, 255, 0.05));
	}

	.dm-item.active {
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.3);
	}

	.dm-item-icon {
		font-size: 24px;
		flex-shrink: 0;
	}

	.dm-item-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.dm-item-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--header-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dm-item-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.dm-item-speed {
		color: var(--brand-experiment, #5865f2);
		font-weight: 500;
	}

	.dm-item-error {
		color: #f23f43;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}

	.dm-progress {
		height: 4px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 2px;
		overflow: hidden;
		margin-top: 4px;
	}

	.dm-progress-bar {
		height: 100%;
		background: linear-gradient(90deg, var(--brand-experiment, #5865f2), #949cf7);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.dm-item-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		flex-shrink: 0;
	}

	.dm-status-text {
		font-variant-numeric: tabular-nums;
	}

	.dm-status-icon {
		font-size: 14px;
	}

	.dm-item-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.dm-item:hover .dm-item-actions,
	.dm-item-actions.visible {
		opacity: 1;
	}

	/* Scrollbar styling */
	.dm-list::-webkit-scrollbar {
		width: 8px;
	}

	.dm-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.dm-list::-webkit-scrollbar-thumb {
		background: var(--background-tertiary, #1e1f22);
		border-radius: 4px;
	}

	.dm-list::-webkit-scrollbar-thumb:hover {
		background: var(--background-modifier-hover, rgba(255, 255, 255, 0.1));
	}
</style>
