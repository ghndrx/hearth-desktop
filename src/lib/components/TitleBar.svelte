<script lang="ts">
	import { onMount } from 'svelte';
	import { window as tauriWindow } from '$lib/tauri';
	import { browser } from '$app/environment';

	// Platform detection for button placement
	let platform: 'macos' | 'windows' | 'linux' = 'windows';
	let isMaximized = false;
	let isFullscreen = false;

	onMount(() => {
		if (!browser) return;
		
		// Detect platform
		const userAgent = navigator.userAgent.toLowerCase();
		if (userAgent.includes('mac') || userAgent.includes('darwin')) {
			platform = 'macos';
		} else if (userAgent.includes('linux')) {
			platform = 'linux';
		} else {
			platform = 'windows';
		}
	});

	async function handleMinimize() {
		try {
			await tauriWindow.minimize();
		} catch (error) {
			console.error('Failed to minimize window:', error);
		}
	}

	async function handleMaximize() {
		try {
			await tauriWindow.maximize();
			isMaximized = !isMaximized;
		} catch (error) {
			console.error('Failed to maximize window:', error);
		}
	}

	async function handleClose() {
		try {
			await tauriWindow.close();
		} catch (error) {
			console.error('Failed to close window:', error);
		}
	}

	async function handleFullscreen() {
		try {
			await tauriWindow.toggleFullscreen();
			isFullscreen = !isFullscreen;
		} catch (error) {
			console.error('Failed to toggle fullscreen:', error);
		}
	}
</script>

<div class="titlebar" data-platform={platform}>
	<!-- macOS-style traffic lights (left side) -->
	{#if platform === 'macos'}
		<div class="window-controls macos">
			<button 
				class="traffic-light close" 
				on:click={handleClose}
				aria-label="Close"
				title="Close"
			>
				<span class="traffic-icon">×</span>
			</button>
			<button 
				class="traffic-light minimize" 
				on:click={handleMinimize}
				aria-label="Minimize"
				title="Minimize"
			>
				<span class="traffic-icon">−</span>
			</button>
			<button 
				class="traffic-light maximize" 
				on:click={handleMaximize}
				aria-label="Maximize"
				title="Maximize"
			>
				<span class="traffic-icon">+</span>
			</button>
		</div>
	{/if}

	<!-- App title/logo area (center) -->
	<div class="titlebar-content" data-tauri-drag-region>
		<div class="app-branding">
			<svg class="app-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
			</svg>
			<span class="app-title">Hearth</span>
		</div>
	</div>

	<!-- Window controls (right side for Windows/Linux) -->
	{#if platform !== 'macos'}
		<div class="window-controls standard">
			<button 
				class="window-btn minimize" 
				on:click={handleMinimize}
				aria-label="Minimize"
				title="Minimize"
			>
				<svg viewBox="0 0 24 24" width="12" height="12">
					<rect x="3" y="11" width="18" height="2" fill="currentColor"/>
				</svg>
			</button>
			<button 
				class="window-btn maximize" 
				on:click={handleMaximize}
				aria-label={isMaximized ? 'Restore' : 'Maximize'}
				title={isMaximized ? 'Restore' : 'Maximize'}
			>
				{#if isMaximized}
					<svg viewBox="0 0 24 24" width="12" height="12">
						<path d="M3 5h18v14H3V5zm2 2v10h14V7H5z" fill="currentColor"/>
						<path d="M5 7h14v10H5V7z" fill="none" stroke="currentColor" stroke-width="2"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="12" height="12">
						<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
					</svg>
				{/if}
			</button>
			<button 
				class="window-btn close" 
				on:click={handleClose}
				aria-label="Close"
				title="Close"
			>
				<svg viewBox="0 0 24 24" width="12" height="12">
					<path d="M18.3 5.71a.996.996 0 00-1.41 0L12 10.59 7.11 5.7A.996.996 0 105.7 7.11L10.59 12 5.7 16.89a.996.996 0 101.41 1.41L12 13.41l4.89 4.89a.996.996 0 101.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" fill="currentColor"/>
				</svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.titlebar {
		display: flex;
		align-items: center;
		height: 32px;
		background: #1e1f22;
		border-bottom: 1px solid #2b2d31;
		user-select: none;
		-webkit-app-region: drag;
		app-region: drag;
	}

	.titlebar-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		-webkit-app-region: drag;
		app-region: drag;
	}

	.app-branding {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #949ba4;
		font-size: 13px;
		font-weight: 600;
	}

	.app-icon {
		opacity: 0.8;
	}

	.app-title {
		letter-spacing: 0.3px;
	}

	/* Window Controls - Standard (Windows/Linux) */
	.window-controls {
		display: flex;
		height: 100%;
		-webkit-app-region: no-drag;
		app-region: no-drag;
	}

	.window-controls.standard {
		margin-left: auto;
	}

	.window-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 100%;
		background: transparent;
		border: none;
		color: #949ba4;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.window-btn:hover {
		background: #2b2d31;
		color: #dbdee1;
	}

	.window-btn.close:hover {
		background: #f23f43;
		color: white;
	}

	.window-btn:active {
		transform: scale(0.95);
	}

	/* Window Controls - macOS Traffic Lights */
	.window-controls.macos {
		gap: 8px;
		padding: 0 12px;
		align-items: center;
		-webkit-app-region: no-drag;
		app-region: no-drag;
	}

	.traffic-light {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		position: relative;
	}

	.traffic-light .traffic-icon {
		font-size: 10px;
		font-weight: 600;
		opacity: 0;
		transition: opacity 0.15s ease;
		color: rgba(0, 0, 0, 0.7);
	}

	.traffic-light:hover .traffic-icon {
		opacity: 1;
	}

	.traffic-light.close {
		background: #ff5f57;
	}

	.traffic-light.close:hover {
		background: #ff5f57;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset;
	}

	.traffic-light.minimize {
		background: #febc2e;
	}

	.traffic-light.minimize:hover {
		background: #febc2e;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset;
	}

	.traffic-light.maximize {
		background: #28c840;
	}

	.traffic-light.maximize:hover {
		background: #28c840;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) inset;
	}

	.traffic-light:active {
		transform: scale(0.9);
	}

	/* Platform-specific adjustments */
	.titlebar[data-platform="macos"] .app-branding {
		padding-right: 80px; /* Make room for traffic lights on left */
	}

	/* Hover effects for the entire titlebar */
	.titlebar:hover .app-branding {
		color: #dbdee1;
	}

	/* Responsive adjustments */
	@media (max-width: 600px) {
		.app-title {
			display: none;
		}
	}
</style>
