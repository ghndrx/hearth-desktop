<script lang="ts">
	import { fly } from 'svelte/transition';
	import { updater, updateAvailable, updateInfo, updateStatus, updateProgress } from '$lib/stores/updater';

	let installing = false;

	async function handleUpdate() {
		installing = true;
		await updater.downloadAndInstall();
	}
</script>

{#if $updateAvailable && $updateInfo}
	<div class="update-banner" transition:fly={{ y: -40, duration: 300 }}>
		<div class="update-content">
			<svg class="update-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			<span class="update-text">
				A new version of Hearth is available: <strong>v{$updateInfo.version}</strong>
			</span>
		</div>
		<div class="update-actions">
			{#if $updateStatus === 'downloading'}
				<div class="download-progress">
					<div class="progress-bar">
						<div
							class="progress-fill"
							style="width: {$updateProgress?.percent ?? 0}%"
						></div>
					</div>
					<span class="progress-text">
						{$updateProgress?.percent ? `${Math.round($updateProgress.percent)}%` : 'Downloading...'}
					</span>
				</div>
			{:else if $updateStatus === 'installing'}
				<span class="installing-text">Installing...</span>
			{:else}
				<button class="update-btn" on:click={handleUpdate} disabled={installing}>
					Update Now
				</button>
				<button class="dismiss-btn" on:click={() => updater.dismiss()}>
					Later
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.update-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 20px;
		background: var(--brand-primary, #5865f2);
		color: #fff;
		font-size: 14px;
		gap: 16px;
	}

	.update-content {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.update-icon {
		flex-shrink: 0;
	}

	.update-text strong {
		font-weight: 600;
	}

	.update-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.update-btn {
		padding: 6px 16px;
		border: none;
		border-radius: 4px;
		background: #fff;
		color: var(--brand-primary, #5865f2);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.update-btn:hover {
		opacity: 0.9;
	}

	.update-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.dismiss-btn {
		padding: 6px 12px;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 4px;
		background: transparent;
		color: #fff;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.dismiss-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.download-progress {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.progress-bar {
		width: 120px;
		height: 6px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #fff;
		border-radius: 3px;
		transition: width 0.2s ease;
	}

	.progress-text {
		font-size: 13px;
		font-weight: 500;
		min-width: 50px;
	}

	.installing-text {
		font-size: 13px;
		font-weight: 500;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}
</style>
