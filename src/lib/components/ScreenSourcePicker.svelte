<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	export let isOpen = false;
	export let onSelect: (sourceId: string) => void = () => {};
	export let onCancel: () => void = () => {};

	interface ScreenSource {
		id: string;
		name: string;
		sourceType: 'screen' | 'window';
		thumbnail?: string;
		appIcon?: string;
		isPrimary: boolean;
	}

	let sources: ScreenSource[] = [];
	let selectedSourceId: string | null = null;
	let loading = false;
	let error: string | null = null;

	async function loadSources() {
		loading = true;
		error = null;
		try {
			sources = await invoke<ScreenSource[]>('get_screen_sources');
			// Auto-select the primary screen by default
			const primaryScreen = sources.find(s => s.isPrimary);
			if (primaryScreen) {
				selectedSourceId = primaryScreen.id;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			console.error('Failed to load screen sources:', err);
		} finally {
			loading = false;
		}
	}

	function handleSelect(sourceId: string) {
		selectedSourceId = sourceId;
	}

	function handleConfirm() {
		if (selectedSourceId) {
			onSelect(selectedSourceId);
			close();
		}
	}

	function handleCancel() {
		onCancel();
		close();
	}

	function close() {
		isOpen = false;
		selectedSourceId = null;
		sources = [];
	}

	// Load sources when modal opens
	$: if (isOpen) {
		loadSources();
	}

	// Group sources by type
	$: screens = sources.filter(s => s.sourceType === 'screen');
	$: windows = sources.filter(s => s.sourceType === 'window');
</script>

<Modal
	open={isOpen}
	title="Share Your Screen"
	subtitle="Select a screen or window to share"
	size="large"
	on:close={handleCancel}
>
	<div class="screen-source-picker">
		{#if loading}
			<div class="loading">
				<div class="spinner"></div>
				<p>Loading available sources...</p>
			</div>
		{:else if error}
			<div class="error">
				<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
				</svg>
				<p>{error}</p>
				<Button variant="primary" on:click={loadSources}>Retry</Button>
			</div>
		{:else}
			<!-- Screens Section -->
			{#if screens.length > 0}
				<div class="source-section">
					<h3 class="source-section-title">Screens</h3>
					<div class="source-grid">
						{#each screens as source}
							<button
								class="source-item"
								class:selected={selectedSourceId === source.id}
								on:click={() => handleSelect(source.id)}
							>
								<div class="source-preview">
									{#if source.thumbnail}
										<img src={source.thumbnail} alt={source.name} />
									{:else}
										<div class="source-placeholder">
											<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
												<path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
											</svg>
										</div>
									{/if}
								</div>
								<div class="source-info">
									<p class="source-name">{source.name}</p>
									{#if source.isPrimary}
										<span class="primary-badge">Primary</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Windows Section -->
			{#if windows.length > 0}
				<div class="source-section">
					<h3 class="source-section-title">Windows ({windows.length})</h3>
					<div class="source-list">
						{#each windows as source}
							<button
								class="source-item source-item-list"
								class:selected={selectedSourceId === source.id}
								on:click={() => handleSelect(source.id)}
							>
								<div class="source-icon">
									{#if source.appIcon}
										<img src={source.appIcon} alt="" />
									{:else}
										<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
											<path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V8h14v10z"/>
										</svg>
									{/if}
								</div>
								<div class="source-info">
									<p class="source-name">{source.name}</p>
								</div>
								{#if selectedSourceId === source.id}
									<div class="check-icon">
										<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
											<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
										</svg>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if sources.length === 0}
				<div class="empty-state">
					<p>No screens or windows available to share</p>
				</div>
			{/if}
		{/if}
	</div>

	<svelte:fragment slot="footer">
		<Button variant="secondary" on:click={handleCancel}>Cancel</Button>
		<Button 
			variant="primary" 
			on:click={handleConfirm}
			disabled={!selectedSourceId || loading}
		>
			Share
		</Button>
	</svelte:fragment>
</Modal>

<style>
	.screen-source-picker {
		min-height: 400px;
		max-height: 600px;
		overflow-y: auto;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		color: var(--danger);
		text-align: center;
	}

	.source-section {
		margin-bottom: 2rem;
	}

	.source-section:last-child {
		margin-bottom: 0;
	}

	.source-section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
	}

	.source-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.source-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 300px;
		overflow-y: auto;
	}

	.source-item {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		padding: 0;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.source-item:hover {
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.source-item.selected {
		border-color: var(--primary);
		background: var(--primary-alpha-10);
	}

	.source-item-list {
		flex-direction: row;
		align-items: center;
		padding: 0.75rem;
		gap: 0.75rem;
	}

	.source-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: var(--bg-tertiary);
		border-radius: 6px 6px 0 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.source-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.source-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--text-tertiary);
	}

	.source-icon {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
	}

	.source-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.source-info {
		padding: 0.75rem;
		text-align: left;
		flex: 1;
	}

	.source-item-list .source-info {
		padding: 0;
	}

	.source-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.primary-badge {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0.125rem 0.5rem;
		background: var(--primary-alpha-20);
		color: var(--primary);
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 4px;
	}

	.check-icon {
		flex-shrink: 0;
		color: var(--primary);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: var(--text-secondary);
		text-align: center;
	}
</style>
