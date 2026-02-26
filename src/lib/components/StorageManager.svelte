<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { storage, type StorageInfo, type StorageStats, type CleanupResult, type StorageCategory } from '$lib/tauri';

	export let showDetails = true;
	export let compact = false;
	export let autoRefresh = true;
	export let refreshInterval = 30000; // 30 seconds

	let storageInfo: StorageInfo | null = null;
	let loading = true;
	let error: string | null = null;
	let cleaning = false;
	let cleaningCategory: StorageCategory | null = null;
	let lastCleanupResult: CleanupResult | null = null;
	let showCleanupConfirm = false;
	let pendingCleanCategory: StorageCategory | null = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	$: totalSizePercent = getTotalSizePercent(storageInfo);
	$: sizeColor = getSizeColor(storageInfo?.total_size_bytes ?? 0);

	function getTotalSizePercent(info: StorageInfo | null): number {
		if (!info) return 0;
		// Use 1GB as "full" reference for visualization
		const maxBytes = 1024 * 1024 * 1024;
		return Math.min((info.total_size_bytes / maxBytes) * 100, 100);
	}

	function getSizeColor(bytes: number): string {
		const MB = 1024 * 1024;
		if (bytes < 100 * MB) return 'var(--status-positive, #3ba55c)';
		if (bytes < 500 * MB) return 'var(--status-warning, #faa61a)';
		return 'var(--status-danger, #ed4245)';
	}

	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'cache':
				return '📦';
			case 'logs':
				return '📋';
			case 'temp_files':
				return '🗑️';
			case 'all':
				return '🧹';
			default:
				return '📁';
		}
	}

	function getCategoryLabel(category: StorageCategory): string {
		switch (category) {
			case 'cache':
				return 'Cache';
			case 'logs':
				return 'Logs';
			case 'temp_files':
				return 'Temp Files';
			case 'all':
				return 'All Temporary Data';
			default:
				return category;
		}
	}

	async function loadStorageInfo(): Promise<void> {
		try {
			loading = true;
			error = null;
			storageInfo = await storage.getInfo();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load storage info';
			console.error('Failed to load storage info:', e);
		} finally {
			loading = false;
		}
	}

	function requestCleanup(category: StorageCategory): void {
		pendingCleanCategory = category;
		showCleanupConfirm = true;
	}

	async function confirmCleanup(): Promise<void> {
		if (!pendingCleanCategory) return;
		
		const category = pendingCleanCategory;
		showCleanupConfirm = false;
		pendingCleanCategory = null;
		
		await clearCategory(category);
	}

	function cancelCleanup(): void {
		showCleanupConfirm = false;
		pendingCleanCategory = null;
	}

	async function clearCategory(category: StorageCategory): Promise<void> {
		try {
			cleaning = true;
			cleaningCategory = category;
			lastCleanupResult = null;
			
			const result = await storage.clear(category);
			lastCleanupResult = result;
			
			// Reload storage info after cleanup
			await loadStorageInfo();
			
			// Clear the result after 5 seconds
			setTimeout(() => {
				lastCleanupResult = null;
			}, 5000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to clear storage';
			console.error('Failed to clear storage:', e);
		} finally {
			cleaning = false;
			cleaningCategory = null;
		}
	}

	async function openLocation(category: StorageCategory): Promise<void> {
		try {
			await storage.openLocation(category);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open location';
			console.error('Failed to open storage location:', e);
		}
	}

	function formatBytes(bytes: number): string {
		const KB = 1024;
		const MB = KB * 1024;
		const GB = MB * 1024;

		if (bytes >= GB) {
			return `${(bytes / GB).toFixed(2)} GB`;
		} else if (bytes >= MB) {
			return `${(bytes / MB).toFixed(2)} MB`;
		} else if (bytes >= KB) {
			return `${(bytes / KB).toFixed(2)} KB`;
		} else {
			return `${bytes} B`;
		}
	}

	onMount(() => {
		loadStorageInfo();
		
		if (autoRefresh && refreshInterval > 0) {
			intervalId = setInterval(loadStorageInfo, refreshInterval);
		}

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});
</script>

<div class="storage-manager" class:compact transition:fade={{ duration: 200 }}>
	{#if loading && !storageInfo}
		<div class="loading">
			<div class="spinner"></div>
			<span>Loading storage info...</span>
		</div>
	{:else if error}
		<div class="error" transition:fade>
			<span class="error-icon">⚠️</span>
			<span>{error}</span>
			<button class="retry-btn" on:click={loadStorageInfo}>Retry</button>
		</div>
	{:else if storageInfo}
		<!-- Summary Header -->
		<div class="storage-summary">
			<div class="summary-header">
				<h3>💾 Storage Usage</h3>
				{#if loading}
					<div class="refresh-indicator" transition:fade>
						<div class="mini-spinner"></div>
					</div>
				{/if}
			</div>
			
			<div class="total-storage">
				<div class="storage-bar">
					<div 
						class="storage-fill" 
						style="width: {totalSizePercent}%; background-color: {sizeColor};"
					></div>
				</div>
				<div class="storage-stats">
					<span class="total-size">{storageInfo.total_size_formatted}</span>
					<span class="file-count">{storageInfo.total_files.toLocaleString()} files</span>
				</div>
			</div>
		</div>

		<!-- Category Details -->
		{#if showDetails}
			<div class="storage-categories" transition:slide>
				<!-- Cache -->
				<div class="category-item">
					<div class="category-info">
						<span class="category-icon">📦</span>
						<div class="category-details">
							<span class="category-name">Cache</span>
							<span class="category-size">{storageInfo.app_cache.size_formatted}</span>
							<span class="category-files">{storageInfo.app_cache.file_count} files</span>
						</div>
					</div>
					<div class="category-actions">
						<button 
							class="action-btn open-btn"
							on:click={() => openLocation('cache')}
							title="Open in file manager"
							disabled={!storageInfo.app_cache.exists}
						>
							📂
						</button>
						<button 
							class="action-btn clear-btn"
							on:click={() => requestCleanup('cache')}
							disabled={cleaning || storageInfo.app_cache.size_bytes === 0}
							title="Clear cache"
						>
							{#if cleaning && cleaningCategory === 'cache'}
								<div class="mini-spinner"></div>
							{:else}
								🗑️
							{/if}
						</button>
					</div>
				</div>

				<!-- Logs -->
				<div class="category-item">
					<div class="category-info">
						<span class="category-icon">📋</span>
						<div class="category-details">
							<span class="category-name">Logs</span>
							<span class="category-size">{storageInfo.app_log.size_formatted}</span>
							<span class="category-files">{storageInfo.app_log.file_count} files</span>
						</div>
					</div>
					<div class="category-actions">
						<button 
							class="action-btn open-btn"
							on:click={() => openLocation('logs')}
							title="Open in file manager"
							disabled={!storageInfo.app_log.exists}
						>
							📂
						</button>
						<button 
							class="action-btn clear-btn"
							on:click={() => requestCleanup('logs')}
							disabled={cleaning || storageInfo.app_log.size_bytes === 0}
							title="Clear logs"
						>
							{#if cleaning && cleaningCategory === 'logs'}
								<div class="mini-spinner"></div>
							{:else}
								🗑️
							{/if}
						</button>
					</div>
				</div>

				<!-- App Data (Read-only, for info) -->
				<div class="category-item readonly">
					<div class="category-info">
						<span class="category-icon">💼</span>
						<div class="category-details">
							<span class="category-name">App Data</span>
							<span class="category-size">{storageInfo.app_data.size_formatted}</span>
							<span class="category-files">{storageInfo.app_data.file_count} files</span>
						</div>
					</div>
					<div class="category-actions">
						<button 
							class="action-btn open-btn"
							on:click={() => openLocation('all')}
							title="Open in file manager"
							disabled={!storageInfo.app_data.exists}
						>
							📂
						</button>
					</div>
				</div>

				<!-- Config (Read-only, for info) -->
				<div class="category-item readonly">
					<div class="category-info">
						<span class="category-icon">⚙️</span>
						<div class="category-details">
							<span class="category-name">Configuration</span>
							<span class="category-size">{storageInfo.app_config.size_formatted}</span>
							<span class="category-files">{storageInfo.app_config.file_count} files</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="quick-actions">
				<button 
					class="clear-all-btn"
					on:click={() => requestCleanup('all')}
					disabled={cleaning || (storageInfo.app_cache.size_bytes === 0 && storageInfo.app_log.size_bytes === 0)}
				>
					{#if cleaning && cleaningCategory === 'all'}
						<div class="mini-spinner"></div>
						<span>Cleaning...</span>
					{:else}
						<span>🧹</span>
						<span>Clear All Temporary Data</span>
					{/if}
				</button>
				
				<button 
					class="refresh-btn"
					on:click={loadStorageInfo}
					disabled={loading}
					title="Refresh storage info"
				>
					🔄
				</button>
			</div>
		{/if}

		<!-- Cleanup Result Toast -->
		{#if lastCleanupResult}
			<div class="cleanup-result" class:success={lastCleanupResult.success} transition:slide>
				{#if lastCleanupResult.success}
					<span class="result-icon">✅</span>
					<span class="result-text">
						Freed {lastCleanupResult.freed_formatted} ({lastCleanupResult.deleted_files} files)
					</span>
				{:else}
					<span class="result-icon">⚠️</span>
					<span class="result-text">
						Completed with {lastCleanupResult.errors.length} error(s)
					</span>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Cleanup Confirmation Modal -->
	{#if showCleanupConfirm && pendingCleanCategory}
		<div class="modal-overlay" transition:fade on:click={cancelCleanup} role="presentation">
			<div class="confirm-modal" on:click|stopPropagation role="dialog" aria-modal="true" transition:slide>
				<h4>Confirm Cleanup</h4>
				<p>
					Are you sure you want to clear <strong>{getCategoryLabel(pendingCleanCategory)}</strong>?
				</p>
				<p class="warning">This action cannot be undone.</p>
				<div class="modal-actions">
					<button class="cancel-btn" on:click={cancelCleanup}>Cancel</button>
					<button class="confirm-btn" on:click={confirmCleanup}>
						{getCategoryIcon(pendingCleanCategory)} Clear
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.storage-manager {
		padding: 16px;
		background: var(--background-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-normal, #dbdee1);
		position: relative;
	}

	.storage-manager.compact {
		padding: 12px;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		color: var(--text-muted, #b5bac1);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--background-modifier-accent, #4e5058);
		border-top-color: var(--brand-experiment, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.mini-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--background-modifier-accent, #4e5058);
		border-top-color: var(--brand-experiment, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid rgba(237, 66, 69, 0.3);
		border-radius: 6px;
		color: var(--status-danger, #ed4245);
	}

	.error-icon {
		font-size: 18px;
	}

	.retry-btn {
		margin-left: auto;
		padding: 4px 12px;
		background: var(--brand-experiment, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.retry-btn:hover {
		background: var(--brand-experiment-560, #4752c4);
	}

	.storage-summary {
		margin-bottom: 16px;
	}

	.summary-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.summary-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.refresh-indicator {
		padding: 4px;
	}

	.total-storage {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.storage-bar {
		height: 8px;
		background: var(--background-modifier-accent, #4e5058);
		border-radius: 4px;
		overflow: hidden;
	}

	.storage-fill {
		height: 100%;
		transition: width 0.3s ease, background-color 0.3s ease;
		border-radius: 4px;
	}

	.storage-stats {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}

	.total-size {
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
	}

	.file-count {
		color: var(--text-muted, #b5bac1);
	}

	.storage-categories {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.category-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--background-tertiary, #1e1f22);
		border-radius: 6px;
		transition: background 0.2s;
	}

	.category-item:hover {
		background: var(--background-modifier-hover, #36373d);
	}

	.category-item.readonly {
		opacity: 0.8;
	}

	.category-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.category-icon {
		font-size: 20px;
	}

	.category-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.category-name {
		font-weight: 500;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}

	.category-size {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.category-files {
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
	}

	.category-actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background-secondary-alt, #232428);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 14px;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--background-modifier-accent, #4e5058);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.clear-btn:hover:not(:disabled) {
		background: rgba(237, 66, 69, 0.2);
	}

	.quick-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.clear-all-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--status-danger, #ed4245);
		border: none;
		border-radius: 6px;
		color: white;
		font-weight: 500;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-all-btn:hover:not(:disabled) {
		background: #d93a3d;
	}

	.clear-all-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background-secondary-alt, #232428);
		border: none;
		border-radius: 6px;
		font-size: 18px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--background-modifier-accent, #4e5058);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cleanup-result {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		padding: 10px 12px;
		background: rgba(59, 165, 92, 0.1);
		border: 1px solid rgba(59, 165, 92, 0.3);
		border-radius: 6px;
	}

	.cleanup-result:not(.success) {
		background: rgba(250, 166, 26, 0.1);
		border-color: rgba(250, 166, 26, 0.3);
	}

	.result-icon {
		font-size: 16px;
	}

	.result-text {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}

	/* Confirmation Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.confirm-modal {
		background: var(--background-primary, #313338);
		border-radius: 8px;
		padding: 24px;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.confirm-modal h4 {
		margin: 0 0 12px;
		font-size: 18px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.confirm-modal p {
		margin: 0 0 8px;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}

	.confirm-modal .warning {
		font-size: 12px;
		color: var(--status-warning, #faa61a);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 20px;
	}

	.cancel-btn {
		padding: 8px 16px;
		background: var(--background-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.cancel-btn:hover {
		background: var(--background-modifier-hover, #36373d);
	}

	.confirm-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--status-danger, #ed4245);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.confirm-btn:hover {
		background: #d93a3d;
	}

	/* Compact mode adjustments */
	.compact .storage-categories {
		gap: 6px;
	}

	.compact .category-item {
		padding: 8px 10px;
	}

	.compact .category-icon {
		font-size: 16px;
	}

	.compact .category-name {
		font-size: 13px;
	}

	.compact .action-btn {
		width: 28px;
		height: 28px;
		font-size: 12px;
	}

	.compact .clear-all-btn {
		padding: 8px 12px;
		font-size: 13px;
	}

	.compact .refresh-btn {
		width: 36px;
		height: 36px;
		font-size: 16px;
	}
</style>
