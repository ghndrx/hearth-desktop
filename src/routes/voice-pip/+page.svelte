<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { page } from '$app/stores';
	import { voiceState, voiceChannelStates, currentVoiceUsers, isInVoice, voiceActions } from '$lib/stores/voice';
	import type { VoiceUser } from '$lib/stores/voice';

	// State
	let channelId: string | null = null;
	let channelName: string = 'Voice Channel';
	let users: VoiceUser[] = [];
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let isResizing = false;
	let resizeHandle: HTMLElement;
	let windowElement: HTMLElement;
	let unlistenChannelUpdate: UnlistenFn | null = null;
	let unlistenClose: UnlistenFn | null = null;

	// Get channel info from URL params
	onMount(async () => {
		// Parse channel info from URL if provided
		const urlParams = new URLSearchParams(window.location.search);
		const id = urlParams.get('id');
		const name = urlParams.get('name');
		if (id) channelId = id;
		if (name) channelName = decodeURIComponent(name || 'Voice Channel');

		// Listen for channel updates
		unlistenChannelUpdate = await listen('voice-pip:channel-update', (event: any) => {
			channelId = event.payload.channel_id;
			channelName = event.payload.channel_name;
		});

		// Listen for close request
		unlistenClose = await listen('voice-pip:close', async () => {
			await closePip();
		});

		// Handle window close request
		const window = getCurrentWindow();
		window.listen('tauri://close-requested', async () => {
			await closePip();
		});
	});

	onDestroy(() => {
		if (unlistenChannelUpdate) unlistenChannelUpdate();
		if (unlistenClose) unlistenClose();
	});

	// Subscribe to voice state
	$: if ($isInVoice && $voiceState.channelId) {
		channelId = $voiceState.channelId;
		channelName = $voiceState.channelName || 'Voice Channel';
	}

	// Get users for current channel
	$: {
		if (channelId && $voiceChannelStates[channelId]) {
			users = $voiceChannelStates[channelId];
		} else {
			users = $currentVoiceUsers;
		}
	}

	async function closePip() {
		try {
			await invoke('voice_pip_close');
		} catch (e) {
			console.error('Failed to close PiP:', e);
			// Fallback: try to hide the window
			const win = getCurrentWindow();
			await win.hide();
		}
	}

	async function hidePip() {
		try {
			await invoke('voice_pip_hide');
		} catch (e) {
			console.error('Failed to hide PiP:', e);
			const win = getCurrentWindow();
			await win.hide();
		}
	}

	function startDrag(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.controls')) return;
		isDragging = true;
		dragOffset = { x: e.clientX, y: e.clientY };
		windowElement.style.cursor = 'grabbing';
	}

	function onDrag(e: MouseEvent) {
		if (!isDragging) return;
		const dx = e.clientX - dragOffset.x;
		const dy = e.clientY - dragOffset.y;
		invoke('voice_pip_move', {
			x: dx,
			y: dy
		}).catch(console.error);
		dragOffset = { x: e.clientX, y: e.clientY };
	}

	function stopDrag() {
		isDragging = false;
		if (windowElement) {
			windowElement.style.cursor = '';
		}
	}

	function startResize(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		isResizing = true;
	}

	function onResize(e: MouseEvent) {
		if (!isResizing) return;
		const rect = windowElement.getBoundingClientRect();
		const width = Math.max(200, Math.min(400, e.clientX - rect.left));
		const height = Math.max(150, Math.min(400, e.clientY - rect.top));
		invoke('voice_pip_resize', { width, height }).catch(console.error);
	}

	function stopResize() {
		isResizing = false;
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging) onDrag(e);
		if (isResizing) onResize(e);
	}

	function handleMouseUp() {
		stopDrag();
		stopResize();
	}

	function getSpeakingIndicator(user: VoiceUser): string {
		if (user.speaking) return 'speaking';
		if (user.self_muted || user.muted) return 'muted';
		return 'idle';
	}

	function getUserDisplayName(user: VoiceUser): string {
		return user.display_name || user.username || 'Unknown';
	}

	function getAvatarUrl(user: VoiceUser): string {
		return user.avatar || '';
	}

	function toggleMute() {
		voiceActions.toggleMute();
	}

	function toggleDeafen() {
		voiceActions.toggleDeafen();
	}
</script>

<svelte:window
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
/>

<div
	class="voice-pip"
	bind:this={windowElement}
	on:mousedown={startDrag}
	role="dialog"
	aria-label="Voice channel picture-in-picture overlay"
>
	<!-- Header / Drag Handle -->
	<div class="header">
		<div class="channel-info">
			<span class="channel-icon">🔊</span>
			<span class="channel-name" title={channelName}>{channelName}</span>
		</div>
		<div class="controls">
			<button class="control-btn minimize" on:click={hidePip} title="Minimize" aria-label="Minimize">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M5 12h14"/>
				</svg>
			</button>
			<button class="control-btn close" on:click={closePip} title="Close" aria-label="Close">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Participants List -->
	<div class="participants">
		{#if users.length === 0}
			<div class="empty-state">
				<span class="empty-icon">👤</span>
				<span class="empty-text">No participants</span>
			</div>
		{:else}
			{#each users as user (user.id)}
				<div class="participant" class:speaking={user.speaking} class:muted={user.self_muted || user.muted}>
					<div class="avatar" class:speaking={user.speaking}>
						{#if getAvatarUrl(user)}
							<img src={getAvatarUrl(user)} alt={getUserDisplayName(user)} />
						{:else}
							<span class="avatar-fallback">{getUserDisplayName(user).charAt(0).toUpperCase()}</span>
						{/if}
						<div class="speaking-ring" class:active={user.speaking}></div>
					</div>
					<div class="user-info">
						<span class="username">{getUserDisplayName(user)}</span>
						<span class="status">
							{#if user.self_muted || user.muted}
								🔇
							{:else if user.self_deafened || user.deafened}
								🔇🔇
							{:else if user.speaking}
								Speaking
							{:else}
								In call
							{/if}
						</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Self Controls -->
	<div class="self-controls">
		<button
			class="control-btn"
			class:active={$voiceState.selfMuted}
			on:click={toggleMute}
			title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
			aria-label={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
		>
			{#if $voiceState.selfMuted}
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a1 1 0 0 1 1 1 8 8 0 0 1-7 7.938V22h-2v-2.062A8 8 0 0 1 4 12a1 1 0 1 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
					<path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
					<line x1="12" y1="19" x2="12" y2="23"/>
					<line x1="8" y1="23" x2="16" y2="23"/>
				</svg>
			{/if}
		</button>
		<button
			class="control-btn"
			class:active={$voiceState.selfDeafened}
			on:click={toggleDeafen}
			title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
			aria-label={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
		>
			{#if $voiceState.selfDeafened}
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M3.27 3L2 4.27l4.18 4.18C6.06 8.75 6 9.12 6 9.5V12a6 6 0 0 0 12 0 6 6 0 0 0-2.18-4.45L20 4.27 18.73 3 3.27 3zM12 22a8 8 0 0 1-8-8v-2.5c0-.38.06-.75.18-1.1l4.32 4.32a5 5 0 0 0 7.4 0l.1-.1V14a6 6 0 0 1-3.1 5.2l-.9.9z"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3.27 3L2 4.27l4.18 4.18C6.06 8.75 6 9.12 6 9.5V12a6 6 0 0 0 12 0 6 6 0 0 0-2.18-4.45L20 4.27 18.73 3 3.27 3z"/>
					<path d="M15 9.5a5 5 0 0 0-7 7"/>
					<path d="M12 17v4"/>
					<path d="M8 21h8"/>
				</svg>
			{/if}
		</button>
	</div>

	<!-- Resize Handle -->
	<div
		class="resize-handle"
		bind:this={resizeHandle}
		on:mousedown={startResize}
		role="slider"
		aria-label="Resize"
	></div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: transparent;
	}

	.voice-pip {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: rgba(32, 34, 37, 0.95);
		border: 1px solid rgba(79, 84, 92, 0.6);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		-webkit-app-region: drag;
		position: relative;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: rgba(47, 49, 54, 0.8);
		border-bottom: 1px solid rgba(79, 84, 92, 0.4);
		-webkit-app-region: drag;
		min-height: 36px;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	.channel-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.channel-name {
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 4px;
		-webkit-app-region: no-drag;
	}

	.control-btn {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: #b9bbbe;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
	}

	.control-btn:hover {
		background: rgba(79, 84, 92, 0.4);
		color: #fff;
	}

	.control-btn.active {
		color: #ed4245;
	}

	.control-btn.minimize:hover {
		background: rgba(79, 84, 92, 0.4);
	}

	.control-btn.close:hover {
		background: rgba(237, 66, 69, 0.3);
		color: #ed4245;
	}

	.control-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Participants */
	.participants {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 8px;
		padding: 12px;
		overflow-y: auto;
		min-height: 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #72767d;
		gap: 4px;
	}

	.empty-icon {
		font-size: 24px;
		opacity: 0.6;
	}

	.empty-text {
		font-size: 11px;
	}

	.participant {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border-radius: 8px;
		background: rgba(79, 84, 92, 0.2);
		transition: background 0.15s ease;
		min-width: 60px;
	}

	.participant:hover {
		background: rgba(79, 84, 92, 0.4);
	}

	.participant.speaking {
		background: rgba(88, 101, 242, 0.3);
	}

	.avatar {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #4f545c;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		font-size: 16px;
		font-weight: 600;
		color: #fff;
	}

	.speaking-ring {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 3px solid transparent;
		transition: all 0.15s ease;
	}

	.speaking-ring.active {
		border-color: #3ba55c;
		box-shadow: 0 0 8px rgba(59, 165, 92, 0.6);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.user-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		max-width: 70px;
	}

	.username {
		font-size: 11px;
		font-weight: 500;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.status {
		font-size: 9px;
		color: #72767d;
	}

	.participant.muted .status {
		color: #ed4245;
	}

	/* Self Controls */
	.self-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(47, 49, 54, 0.8);
		border-top: 1px solid rgba(79, 84, 92, 0.4);
	}

	.self-controls .control-btn {
		width: 32px;
		height: 32px;
		background: rgba(79, 84, 92, 0.4);
	}

	.self-controls .control-btn:hover {
		background: rgba(79, 84, 92, 0.6);
	}

	.self-controls .control-btn.active {
		background: rgba(237, 66, 69, 0.4);
		color: #ed4245;
	}

	.self-controls .control-btn svg {
		width: 16px;
		height: 16px;
	}

	/* Resize Handle */
	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: se-resize;
		-webkit-app-region: no-drag;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 8px;
		height: 8px;
		border-right: 2px solid rgba(179, 181, 185, 0.4);
		border-bottom: 2px solid rgba(179, 181, 185, 0.4);
	}

	.resize-handle:hover::after {
		border-color: rgba(179, 181, 185, 0.8);
	}
</style>
