<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { voiceState, voiceActions, isVoiceConnected } from '$lib/stores/voice';
	import { channels, currentChannel } from '$lib/stores/app';
	import { fly } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';

	let isMinimized = false;
	let isAlwaysOnTop = false;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let overlayX = 20;
	let overlayY = 20;
	let overlayElement: HTMLDivElement;

	// Voice state
	let connected = false;
	let channelId: string | null = null;
	let selfMuted = false;
	let selfDeafened = false;
	let speaking: { [userId: string]: boolean } = {};
	let connecting = false;
	let error: string | null = null;

	// Channel info
	let channelName = '';

	// Mock connected users for now (will be replaced with real data from voice manager)
	let connectedUsers = [
		{ id: '1', username: 'John', speaking: false },
		{ id: '2', username: 'Alice', speaking: false },
		{ id: '3', username: 'Bob', speaking: true }
	];

	// Subscribe to voice state
	const unsubscribeVoice = voiceState.subscribe(state => {
		connected = state.isConnected;
		channelId = state.channelId;
		selfMuted = state.selfMuted;
		selfDeafened = state.selfDeafened;
		speaking = state.speaking;
		connecting = state.connecting;
		error = state.error;
	});

	// Subscribe to channels to get channel name
	const unsubscribeChannels = channels.subscribe(channelList => {
		if (channelId) {
			const channel = channelList.find(c => c.id === channelId);
			channelName = channel?.name || 'Voice Channel';
		}
	});

	// Dragging functionality
	function startDrag(event: MouseEvent) {
		if (event.button !== 0) return; // Only left mouse button

		isDragging = true;
		dragStartX = event.clientX - overlayX;
		dragStartY = event.clientY - overlayY;

		document.addEventListener('mousemove', handleDrag);
		document.addEventListener('mouseup', stopDrag);

		event.preventDefault();
	}

	function handleDrag(event: MouseEvent) {
		if (!isDragging) return;

		overlayX = event.clientX - dragStartX;
		overlayY = event.clientY - dragStartY;

		// Keep overlay within window bounds
		const rect = overlayElement.getBoundingClientRect();
		overlayX = Math.max(0, Math.min(window.innerWidth - rect.width, overlayX));
		overlayY = Math.max(0, Math.min(window.innerHeight - rect.height, overlayY));
	}

	function stopDrag() {
		isDragging = false;
		document.removeEventListener('mousemove', handleDrag);
		document.removeEventListener('mouseup', stopDrag);
	}

	// Voice control actions
	function toggleMute() {
		voiceActions.setMuted(!selfMuted);
		// TODO: Call actual voice manager mute/unmute
	}

	function toggleDeafen() {
		voiceActions.setDeafened(!selfDeafened);
		// TODO: Call actual voice manager deafen/undeafen
	}

	async function disconnect() {
		voiceActions.setDisconnected();
		try {
			await invoke('hide_voice_overlay');
		} catch (e) {
			console.warn('[VoiceOverlay] Failed to hide overlay:', e);
		}
	}

	function toggleMinimize() {
		isMinimized = !isMinimized;
	}

	async function toggleAlwaysOnTop() {
		try {
			const newState = !isAlwaysOnTop;
			await invoke('set_always_on_top', { alwaysOnTop: newState, windowLabel: 'voice-overlay' });
			isAlwaysOnTop = newState;

			// Save state immediately
			localStorage.setItem('hearth_voice_overlay_always_on_top', JSON.stringify(isAlwaysOnTop));
		} catch (error) {
			console.error('[VoiceOverlay] Failed to set always on top:', error);
		}
	}

	onMount(() => {
		// Load saved position
		const savedPosition = localStorage.getItem('hearth_voice_overlay_position');
		if (savedPosition) {
			try {
				const { x, y } = JSON.parse(savedPosition);
				overlayX = x;
				overlayY = y;
			} catch (e) {
				console.warn('[VoiceOverlay] Failed to load position:', e);
			}
		}

		// Load saved always-on-top state
		const savedAlwaysOnTop = localStorage.getItem('hearth_voice_overlay_always_on_top');
		if (savedAlwaysOnTop) {
			try {
				isAlwaysOnTop = JSON.parse(savedAlwaysOnTop);
				// Apply the saved state
				invoke('set_always_on_top', { alwaysOnTop: isAlwaysOnTop, windowLabel: 'voice-overlay' }).catch(error => {
					console.warn('[VoiceOverlay] Failed to apply always-on-top state on mount:', error);
				});
			} catch (e) {
				console.warn('[VoiceOverlay] Failed to load always-on-top state:', e);
			}
		}
	});

	onDestroy(() => {
		unsubscribeVoice();
		unsubscribeChannels();
		document.removeEventListener('mousemove', handleDrag);
		document.removeEventListener('mouseup', stopDrag);

		// Save position
		try {
			localStorage.setItem('hearth_voice_overlay_position', JSON.stringify({ x: overlayX, y: overlayY }));
		} catch (e) {
			console.warn('[VoiceOverlay] Failed to save position:', e);
		}

		// Save always-on-top state
		try {
			localStorage.setItem('hearth_voice_overlay_always_on_top', JSON.stringify(isAlwaysOnTop));
		} catch (e) {
			console.warn('[VoiceOverlay] Failed to save always-on-top state:', e);
		}
	});

	// Update connected users based on speaking state
	$: {
		connectedUsers = connectedUsers.map(user => ({
			...user,
			speaking: speaking[user.id] || false
		}));
	}

	// Calculate overlay height for smooth transitions
	$: overlayHeight = isMinimized ? 52 : (connectedUsers.length > 0 ? 140 + (connectedUsers.length * 32) : 140);
</script>

{#if connected}
	<div
		bind:this={overlayElement}
		class="voice-overlay"
		style="left: {overlayX}px; top: {overlayY}px; height: {overlayHeight}px;"
		transition:fly={{ y: -20, duration: 300 }}
	>
		<!-- Header -->
		<div
			class="voice-header"
			class:cursor-grabbing={isDragging}
			on:mousedown={startDrag}
			role="button"
			tabindex="0"
		>
			<div class="flex items-center gap-2 flex-1">
				<div class="w-2 h-2 rounded-full bg-green-400"></div>
				<span class="text-sm font-medium text-white truncate">
					{channelName}
				</span>
			</div>

			<div class="flex items-center gap-1">
				<button
					class="control-btn"
					class:active={isAlwaysOnTop}
					on:click={toggleAlwaysOnTop}
					title={isAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
				>
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
					</svg>
				</button>
				<button
					class="control-btn"
					on:click={toggleMinimize}
					title={isMinimized ? 'Expand overlay' : 'Minimize overlay'}
				>
					{#if isMinimized}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					{:else}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
			</div>
		</div>

		{#if !isMinimized}
			<!-- Control buttons -->
			<div class="voice-controls">
				<button
					class="voice-btn"
					class:active={selfMuted}
					on:click={toggleMute}
					title={selfMuted ? 'Unmute' : 'Mute'}
				>
					{#if selfMuted}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2C13.1 2 14 2.9 14 4V12C14 13.1 13.1 14 12 14C10.9 14 10 13.1 10 12V4C10 2.9 10.9 2 12 2ZM19 10V12C19 15.3 16.3 18 13 18V20C17.4 20 21 16.4 21 12V10H19ZM5 10V12C5 16.4 8.6 20 13 20V18C9.7 18 7 15.3 7 12V10H5Z"/>
						</svg>
					{/if}
				</button>

				<button
					class="voice-btn"
					class:active={selfDeafened}
					on:click={toggleDeafen}
					title={selfDeafened ? 'Undeafen' : 'Deafen'}
				>
					{#if selfDeafened}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M3 7v10c0 1.1.9 2 2 2h4v-1.8L7.8 16H5V8h2.8L9 6.2V5H5c-1.1 0-2 .9-2 2zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
						</svg>
					{/if}
				</button>

				<button
					class="voice-btn disconnect-btn"
					on:click={disconnect}
					title="Disconnect"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12h3m0 0l-3-3m3 3l-3 3m-6 2a9 9 0 110-18 9 9 0 010 18zm5-9a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
				</button>
			</div>

			<!-- Connected users -->
			{#if connectedUsers.length > 0}
				<div class="voice-users">
					{#each connectedUsers as user (user.id)}
						<div class="user-item" class:speaking={user.speaking}>
							<div class="user-avatar">
								{user.username.charAt(0).toUpperCase()}
							</div>
							<span class="user-name">{user.username}</span>
							{#if user.speaking}
								<div class="speaking-indicator"></div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.voice-overlay {
		position: fixed;
		z-index: 1000;
		background: rgba(31, 41, 55, 0.95);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(75, 85, 99, 0.3);
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		min-width: 200px;
		max-width: 280px;
		transition: height 0.2s ease;
		overflow: hidden;
		user-select: none;
	}

	.voice-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: rgba(55, 65, 81, 0.8);
		border-bottom: 1px solid rgba(75, 85, 99, 0.3);
		cursor: grab;
	}

	.voice-header:active {
		cursor: grabbing;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		color: rgb(156, 163, 175);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: rgba(75, 85, 99, 0.5);
		color: white;
	}

	.control-btn.active {
		background: rgba(34, 197, 94, 0.2);
		color: rgb(34, 197, 94);
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.control-btn.active:hover {
		background: rgba(34, 197, 94, 0.3);
		color: rgb(34, 197, 94);
	}

	.voice-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
	}

	.voice-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: 2px solid transparent;
		background: rgba(75, 85, 99, 0.6);
		color: rgb(156, 163, 175);
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.voice-btn:hover {
		background: rgba(75, 85, 99, 0.8);
		color: white;
	}

	.voice-btn.active {
		background: rgb(239, 68, 68);
		color: white;
		border-color: rgb(220, 38, 38);
	}

	.voice-btn.disconnect-btn {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgb(239, 68, 68);
		color: rgb(239, 68, 68);
	}

	.voice-btn.disconnect-btn:hover {
		background: rgb(239, 68, 68);
		color: white;
	}

	.voice-users {
		padding: 0 16px 12px;
		max-height: 200px;
		overflow-y: auto;
	}

	.user-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		transition: all 0.15s ease;
	}

	.user-item.speaking {
		background: rgba(34, 197, 94, 0.1);
		border-radius: 6px;
		padding: 6px 8px;
		margin: 0 -8px;
	}

	.user-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: rgb(75, 85, 99);
		color: white;
		border-radius: 50%;
		font-size: 10px;
		font-weight: 600;
		flex-shrink: 0;
	}

	.user-item.speaking .user-avatar {
		background: rgb(34, 197, 94);
	}

	.user-name {
		flex: 1;
		color: rgb(209, 213, 219);
		font-size: 13px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.speaking-indicator {
		width: 8px;
		height: 8px;
		background: rgb(34, 197, 94);
		border-radius: 50%;
		flex-shrink: 0;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	/* Scrollbar styling */
	.voice-users::-webkit-scrollbar {
		width: 4px;
	}

	.voice-users::-webkit-scrollbar-track {
		background: transparent;
	}

	.voice-users::-webkit-scrollbar-thumb {
		background: rgba(75, 85, 99, 0.6);
		border-radius: 2px;
	}

	.voice-users::-webkit-scrollbar-thumb:hover {
		background: rgba(75, 85, 99, 0.8);
	}
</style>