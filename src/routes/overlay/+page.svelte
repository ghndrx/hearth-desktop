<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { voiceState, voiceActions } from '$lib/stores/voice';
	import { invoke } from '@tauri-apps/api/core';

	let mounted = false;
	let dragging = false;
	let dragStart = { x: 0, y: 0 };
	let overlayElement: HTMLElement;

	// Voice state
	$: isConnected = $voiceState.isConnected;
	$: isMuted = $voiceState.selfMuted;
	$: isDeafened = $voiceState.selfDeafened;
	$: channelId = $voiceState.channelId;

	onMount(async () => {
		mounted = true;

		// Set initial opacity
		try {
			await invoke('set_overlay_opacity', { opacity: 0.9 });
		} catch (error) {
			console.error('Failed to set overlay opacity:', error);
		}

		// Add global hotkey listeners (placeholder for now)
		// In a real implementation, you'd register global hotkeys here
		document.addEventListener('keydown', handleGlobalHotkey);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleGlobalHotkey);
	});

	function handleGlobalHotkey(event: KeyboardEvent) {
		// Handle global hotkeys for mute/deafen/PTT
		// This is a simplified implementation - in reality you'd want proper global hotkeys
		if (event.ctrlKey && event.shiftKey) {
			switch (event.code) {
				case 'KeyM':
					event.preventDefault();
					toggleMute();
					break;
				case 'KeyD':
					event.preventDefault();
					toggleDeafen();
					break;
			}
		}
	}

	async function toggleMute() {
		if (isConnected) {
			voiceActions.setMuted(!isMuted);
		}
	}

	async function toggleDeafen() {
		if (isConnected) {
			voiceActions.setDeafened(!isDeafened);
		}
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.button === 0) { // Left click only
			dragging = true;
			dragStart.x = event.clientX;
			dragStart.y = event.clientY;
			event.preventDefault();
		}
	}

	async function handleMouseMove(event: MouseEvent) {
		if (dragging) {
			const deltaX = event.screenX - dragStart.x;
			const deltaY = event.screenY - dragStart.y;

			try {
				const position = await invoke('get_overlay_position');
				if (position) {
					const [currentX, currentY] = position as [number, number];
					await invoke('move_overlay', {
						x: currentX + deltaX,
						y: currentY + deltaY
					});
				}
			} catch (error) {
				console.error('Failed to move overlay:', error);
			}
		}
	}

	function handleMouseUp() {
		dragging = false;
	}

	async function hideOverlay() {
		try {
			await invoke('hide_overlay');
		} catch (error) {
			console.error('Failed to hide overlay:', error);
		}
	}
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div
	class="overlay-container"
	bind:this={overlayElement}
	on:mousedown={handleMouseDown}
	role="dialog"
	aria-label="Voice Controls Overlay"
>
	<div class="overlay-header">
		<div class="overlay-title">
			{#if channelId}
				Voice Chat
			{:else}
				Not Connected
			{/if}
		</div>
		<button
			class="close-btn"
			on:click={hideOverlay}
			aria-label="Hide overlay"
			type="button"
		>
			×
		</button>
	</div>

	<div class="controls">
		<button
			class="control-btn {isMuted ? 'muted' : 'unmuted'}"
			on:click={toggleMute}
			disabled={!isConnected}
			aria-label={isMuted ? 'Unmute' : 'Mute'}
			title="Ctrl+Shift+M"
			type="button"
		>
			{#if isMuted}
				🔇
			{:else}
				🎙️
			{/if}
		</button>

		<button
			class="control-btn {isDeafened ? 'deafened' : 'listening'}"
			on:click={toggleDeafen}
			disabled={!isConnected}
			aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
			title="Ctrl+Shift+D"
			type="button"
		>
			{#if isDeafened}
				🔇
			{:else}
				🎧
			{/if}
		</button>
	</div>

	{#if isConnected}
		<div class="status connected">Connected</div>
	{:else}
		<div class="status disconnected">Disconnected</div>
	{/if}
</div>

<style>
	.overlay-container {
		width: 300px;
		height: 200px;
		background: rgba(30, 30, 30, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 14px;
		cursor: move;
		user-select: none;
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
	}

	.overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px 8px 0 0;
	}

	.overlay-title {
		font-weight: 600;
		font-size: 13px;
	}

	.close-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 2px;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.controls {
		display: flex;
		justify-content: center;
		gap: 16px;
		padding: 20px;
		flex: 1;
		align-items: center;
	}

	.control-btn {
		width: 48px;
		height: 48px;
		border: none;
		border-radius: 50%;
		font-size: 20px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.control-btn.unmuted {
		background: rgba(76, 175, 80, 0.8);
		color: white;
	}

	.control-btn.unmuted:hover:not(:disabled) {
		background: rgba(76, 175, 80, 1);
		transform: scale(1.1);
	}

	.control-btn.muted {
		background: rgba(244, 67, 54, 0.8);
		color: white;
	}

	.control-btn.muted:hover:not(:disabled) {
		background: rgba(244, 67, 54, 1);
		transform: scale(1.1);
	}

	.control-btn.listening {
		background: rgba(33, 150, 243, 0.8);
		color: white;
	}

	.control-btn.listening:hover:not(:disabled) {
		background: rgba(33, 150, 243, 1);
		transform: scale(1.1);
	}

	.control-btn.deafened {
		background: rgba(156, 39, 176, 0.8);
		color: white;
	}

	.control-btn.deafened:hover:not(:disabled) {
		background: rgba(156, 39, 176, 1);
		transform: scale(1.1);
	}

	.status {
		text-align: center;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 500;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0 0 8px 8px;
	}

	.status.connected {
		background: rgba(76, 175, 80, 0.2);
		color: #81C784;
	}

	.status.disconnected {
		background: rgba(244, 67, 54, 0.2);
		color: #E57373;
	}
</style>