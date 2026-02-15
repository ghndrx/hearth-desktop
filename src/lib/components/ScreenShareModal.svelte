<script lang="ts">
	import { onDestroy } from 'svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import { 
		screenShare, 
		isScreenShareModalOpen, 
		isPreviewing, 
		screenShareStream,
		screenShareError,
		selectedScreenSource,
		type ScreenShareSourceType 
	} from '$lib/stores/screenShare';

	let previewVideo: HTMLVideoElement;
	let isCapturing = false;

	// Bind stream to video element when previewing
	$: if (previewVideo && $screenShareStream) {
		previewVideo.srcObject = $screenShareStream;
	}

	async function handleCaptureScreen() {
		if (isCapturing) return;
		isCapturing = true;
		try {
			await screenShare.requestCapture('screen');
		} finally {
			isCapturing = false;
		}
	}

	async function handleCaptureWindow() {
		if (isCapturing) return;
		isCapturing = true;
		try {
			await screenShare.requestCapture('window');
		} finally {
			isCapturing = false;
		}
	}

	function handleStartSharing() {
		screenShare.startSharing();
	}

	function handleCancel() {
		if ($isPreviewing) {
			screenShare.cancelPreview();
		} else {
			screenShare.closeModal();
		}
	}

	function handleClose() {
		screenShare.closeModal();
	}

	onDestroy(() => {
		// Clean up preview if component is destroyed while previewing
		if ($isPreviewing && !$screenShare.isSharing) {
			screenShare.cancelPreview();
		}
	});
</script>

<Modal 
	open={$isScreenShareModalOpen} 
	title={$isPreviewing ? 'Preview' : 'Share Your Screen'} 
	subtitle={$isPreviewing ? $selectedScreenSource?.name : 'Choose what you want to share'}
	size="large"
	on:close={handleClose}
>
	<div class="screen-share-content">
		{#if $screenShareError}
			<div class="error-message">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
				</svg>
				<span>{$screenShareError}</span>
			</div>
		{/if}

		{#if $isPreviewing && $screenShareStream}
			<!-- Preview Mode -->
			<div class="preview-container">
				<video 
					bind:this={previewVideo}
					autoplay
					muted
					playsinline
					class="preview-video"
				></video>
				<div class="preview-info">
					<div class="source-badge" class:screen={$selectedScreenSource?.type === 'screen'}>
						{#if $selectedScreenSource?.type === 'screen'}
							<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
								<path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
								<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
							</svg>
						{/if}
						<span>{$selectedScreenSource?.type === 'screen' ? 'Entire Screen' : 'Application Window'}</span>
					</div>
				</div>
			</div>
		{:else}
			<!-- Source Selection -->
			<div class="source-options">
				<button 
					class="source-option" 
					on:click={handleCaptureScreen}
					disabled={isCapturing}
				>
					<div class="source-icon">
						<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
							<path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
						</svg>
					</div>
					<div class="source-label">Entire Screen</div>
					<div class="source-description">Share your full screen</div>
				</button>

				<button 
					class="source-option"
					on:click={handleCaptureWindow}
					disabled={isCapturing}
				>
					<div class="source-icon">
						<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
							<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
							<path d="M7 7h10v2H7zM7 11h10v6H7z" opacity="0.3"/>
						</svg>
					</div>
					<div class="source-label">Application Window</div>
					<div class="source-description">Share a specific window</div>
				</button>
			</div>

			{#if isCapturing}
				<div class="capturing-indicator">
					<div class="spinner"></div>
					<span>Waiting for selection...</span>
				</div>
			{/if}
		{/if}
	</div>

	<svelte:fragment slot="footer">
		<Button variant="secondary" on:click={handleCancel}>
			{$isPreviewing ? 'Change Source' : 'Cancel'}
		</Button>
		{#if $isPreviewing}
			<Button variant="primary" on:click={handleStartSharing}>
				Start Sharing
			</Button>
		{/if}
	</svelte:fragment>
</Modal>

<style>
	.screen-share-content {
		min-height: 200px;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid rgba(242, 63, 67, 0.3);
		border-radius: 4px;
		color: #f23f43;
		margin-bottom: 16px;
		font-size: 14px;
	}

	.source-options {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		padding: 8px 0;
	}

	.source-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px 16px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.source-option:hover:not(:disabled) {
		background: var(--bg-tertiary, #232428);
		border-color: var(--blurple, #5865f2);
	}

	.source-option:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.source-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		background: var(--bg-tertiary, #232428);
		border-radius: 8px;
		color: var(--text-muted, #b5bac1);
		transition: all 0.15s ease;
	}

	.source-option:hover:not(:disabled) .source-icon {
		background: var(--blurple, #5865f2);
		color: white;
	}

	.source-label {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.source-description {
		font-size: 13px;
		color: var(--text-muted, #b5bac1);
		text-align: center;
	}

	.capturing-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px;
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--bg-tertiary, #232428);
		border-top-color: var(--blurple, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% { transform: rotate(360deg); }
	}

	.preview-container {
		position: relative;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
	}

	.preview-video {
		display: block;
		width: 100%;
		height: auto;
		max-height: 400px;
		object-fit: contain;
		background: #000;
	}

	.preview-info {
		position: absolute;
		bottom: 12px;
		left: 12px;
	}

	.source-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(0, 0, 0, 0.75);
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		color: white;
	}

	.source-badge.screen {
		background: rgba(88, 101, 242, 0.9);
	}
</style>
