<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { 
		screenShare, 
		isScreenSharing, 
		screenShareStream,
		selectedScreenSource 
	} from '$lib/stores/screenShare';
	import Tooltip from './Tooltip.svelte';

	let previewVideo: HTMLVideoElement;
	let isMinimized = false;
	let isHovered = false;

	// Bind stream to video element
	$: if (previewVideo && $screenShareStream) {
		previewVideo.srcObject = $screenShareStream;
	}

	function handleStopSharing() {
		screenShare.stopSharing();
	}

	function toggleMinimize() {
		isMinimized = !isMinimized;
	}
</script>

{#if $isScreenSharing && $screenShareStream}
	<div 
		class="screen-share-preview"
		class:minimized={isMinimized}
		role="region"
		aria-label="Screen share preview"
		transition:fly={{ y: 20, duration: 200 }}
		on:mouseenter={() => isHovered = true}
		on:mouseleave={() => isHovered = false}
	>
		{#if !isMinimized}
			<div class="preview-header">
				<div class="sharing-indicator">
					<div class="pulse-dot"></div>
					<span>Sharing {$selectedScreenSource?.type === 'screen' ? 'Screen' : 'Window'}</span>
				</div>
				<div class="header-actions">
					<Tooltip text="Minimize" position="top">
						<button class="icon-btn" on:click={toggleMinimize} aria-label="Minimize preview">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
								<path d="M19 13H5v-2h14v2z"/>
							</svg>
						</button>
					</Tooltip>
				</div>
			</div>

			<div class="preview-content">
				<video 
					bind:this={previewVideo}
					autoplay
					muted
					playsinline
					class="preview-video"
				></video>
			</div>
		{/if}

		<div class="preview-controls" class:show={isHovered || isMinimized}>
			{#if isMinimized}
				<Tooltip text="Expand preview" position="top">
					<button class="control-btn expand" on:click={toggleMinimize}>
						<div class="pulse-dot small"></div>
						<span>Sharing</span>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
							<path d="M7 14l5-5 5 5z"/>
						</svg>
					</button>
				</Tooltip>
			{/if}
			
			<button class="control-btn stop" on:click={handleStopSharing}>
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
					<path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				<span>Stop Sharing</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.screen-share-preview {
		position: fixed;
		bottom: 80px;
		right: 20px;
		width: 320px;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		z-index: 100;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.screen-share-preview.minimized {
		width: auto;
		background: transparent;
		box-shadow: none;
		border: none;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid rgba(0, 0, 0, 0.2);
	}

	.sharing-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background: #f23f43;
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	.pulse-dot.small {
		width: 6px;
		height: 6px;
	}

	@keyframes pulse {
		0%, 100% { 
			opacity: 1;
			transform: scale(1);
		}
		50% { 
			opacity: 0.6;
			transform: scale(0.9);
		}
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: var(--bg-tertiary, #232428);
		color: var(--text-normal, #f2f3f5);
	}

	.preview-content {
		background: #000;
	}

	.preview-video {
		display: block;
		width: 100%;
		height: auto;
		max-height: 180px;
		object-fit: contain;
	}

	.preview-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.preview-controls.show {
		opacity: 1;
	}

	.minimized .preview-controls {
		background: transparent;
		padding: 0;
	}

	.control-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--bg-tertiary, #232428);
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: #404249;
	}

	.control-btn.stop {
		background: #f23f43;
		color: white;
	}

	.control-btn.stop:hover {
		background: #da373c;
	}

	.control-btn.expand {
		background: var(--bg-primary, #313338);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.control-btn.expand:hover {
		background: var(--bg-secondary, #2b2d31);
	}
</style>
