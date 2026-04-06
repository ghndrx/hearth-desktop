<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { voiceState, voiceActions, isVoiceConnected, isSelfMuted, isSelfDeafened } from '../stores/voice';
	import { windowState, windowActions } from '../stores/window';
	import { WindowAPI } from '../api/window';
	import SnapZoneOverlay from './SnapZoneOverlay.svelte';

	// Props
	export let channelName = 'Voice Channel';

	// Local state
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let isHovered = false;
	let volume = 100;
	let snapZoneOverlay: SnapZoneOverlay;
	let pendingSnapCorner: string | null = null;

	// Reactive variables
	$: connectedPeers = Object.keys($voiceState.speaking || {});
	$: activeSpeakers = Object.entries($voiceState.speaking || {})
		.filter(([_, isSpeaking]) => isSpeaking)
		.map(([userId, _]) => userId);

	// Mock user data - in a real app this would come from a user store
	const mockUsers: { [userId: string]: { username: string; avatar?: string } } = {
		'user1': { username: 'Alice' },
		'user2': { username: 'Bob' },
		'user3': { username: 'Charlie' },
		'currentUser': { username: 'You' }
	};

	function getInitials(username: string): string {
		return username.split(' ')
			.map(word => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.target !== event.currentTarget) return;

		isDragging = true;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dragOffset = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;

		const newX = event.clientX - dragOffset.x;
		const newY = event.clientY - dragOffset.y;

		// Update position in store and Tauri backend
		windowActions.setPiPPosition(newX, newY);
		WindowAPI.updatePiPPosition({ x: newX, y: newY }).catch(console.error);
	}

	function handleMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);

		// If there's a pending snap, apply it
		if (pendingSnapCorner) {
			windowActions.snapToCorner(pendingSnapCorner as any);

			// Get the snap position and update Tauri
			if (snapZoneOverlay) {
				const snapPos = snapZoneOverlay.getSnapPosition(pendingSnapCorner);
				if (snapPos) {
					WindowAPI.updatePiPPosition(snapPos).catch(console.error);
				}
			}

			pendingSnapCorner = null;
		}

		// Save settings after position change
		windowActions.saveSettings();
	}

	function handleMuteToggle() {
		voiceActions.setMuted(!$isSelfMuted);
	}

	function handleDeafenToggle() {
		voiceActions.setDeafened(!$isSelfDeafened);
	}

	function handleVolumeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		volume = parseInt(target.value);
		// In a real implementation, this would adjust the audio gain
	}

	function handleLeaveChannel() {
		// Close PiP window and disconnect from voice
		windowActions.disablePiP();
		WindowAPI.closePiPWindow().catch(console.error);
		voiceActions.setDisconnected();
	}

	function handleMinimize() {
		// Hide the PiP window but keep the connection
		windowActions.hidePiP();
		WindowAPI.hidePiPWindow().catch(console.error);
	}

	function handleSnapZone(event: CustomEvent<{ corner: string | null }>) {
		pendingSnapCorner = event.detail.corner;
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (isDragging) {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		}
	});
</script>

<!-- PiP Window Container -->
<div
	class="pip-container"
	class:dragging={isDragging}
	class:hovered={isHovered}
	style="opacity: {$windowState.transparency}"
	on:mousedown={handleMouseDown}
	on:mouseenter={() => isHovered = true}
	on:mouseleave={() => isHovered = false}
	role="dialog"
	aria-label="Picture in Picture Voice Channel"
	tabindex="-1"
>
	<!-- Header with channel name and controls -->
	<div class="pip-header">
		<div class="channel-info">
			<div class="channel-icon">
				<svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
				</svg>
			</div>
			<span class="channel-name">{channelName}</span>
		</div>

		<div class="window-controls">
			<button
				class="control-btn minimize"
				on:click|stopPropagation={handleMinimize}
				title="Minimize"
			>
				<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19 13H5v-2h14v2z"/>
				</svg>
			</button>

			<button
				class="control-btn close"
				on:click|stopPropagation={handleLeaveChannel}
				title="Leave Channel"
			>
				<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Participants Area -->
	<div class="participants-area">
		{#if connectedPeers.length > 0}
			<div class="participants-grid">
				<!-- Current user -->
				<div class="participant self" class:speaking={$voiceState.speaking?.currentUser}>
					<div class="avatar">
						{#if mockUsers.currentUser.avatar}
							<img src={mockUsers.currentUser.avatar} alt={mockUsers.currentUser.username} />
						{:else}
							<div class="avatar-initials">{getInitials(mockUsers.currentUser.username)}</div>
						{/if}
					</div>
					<span class="username">{mockUsers.currentUser.username}</span>
					{#if $isSelfMuted}
						<div class="status-indicator muted">
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
								<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
							</svg>
						</div>
					{/if}
					{#if $isSelfDeafened}
						<div class="status-indicator deafened">
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
								<path d="M16 7c1.66 0 3 1.34 3 3v2c0 1.66-1.34 3-3 3h-2V7h2zm-5.5 7.5l2-2V9.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v3.5l1 1zM5 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
							</svg>
						</div>
					{/if}
				</div>

				<!-- Other participants -->
				{#each connectedPeers.slice(0, 3) as peerId}
					{@const user = mockUsers[peerId] || { username: `User ${peerId}`, avatar: null }}
					<div class="participant" class:speaking={activeSpeakers.includes(peerId)}>
						<div class="avatar">
							{#if user.avatar}
								<img src={user.avatar} alt={user.username} />
							{:else}
								<div class="avatar-initials">{getInitials(user.username)}</div>
							{/if}
						</div>
						<span class="username">{user.username}</span>
					</div>
				{/each}

				<!-- Show count if more participants -->
				{#if connectedPeers.length > 3}
					<div class="participant-count">
						+{connectedPeers.length - 3}
					</div>
				{/if}
			</div>
		{:else}
			<div class="empty-state">
				<svg class="w-8 h-8 text-gray-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
				</svg>
				<p class="text-xs text-gray-500 text-center">Waiting for others...</p>
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="controls-area">
		<div class="voice-controls">
			<button
				class="control-btn voice-btn"
				class:active={$isSelfMuted}
				on:click|stopPropagation={handleMuteToggle}
				title="Toggle Mute"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					{#if $isSelfMuted}
						<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
					{:else}
						<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
					{/if}
				</svg>
			</button>

			<button
				class="control-btn voice-btn"
				class:active={$isSelfDeafened}
				on:click|stopPropagation={handleDeafenToggle}
				title="Toggle Deafen"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					{#if $isSelfDeafened}
						<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
					{:else}
						<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
					{/if}
				</svg>
			</button>
		</div>

		<!-- Volume slider (shown on hover) -->
		{#if isHovered}
			<div class="volume-control">
				<svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
					<path d="M3 9v6h4l5 5V4L7 9H3z"/>
				</svg>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={volume}
					on:input={handleVolumeChange}
					class="volume-slider"
				/>
				<span class="volume-text">{volume}%</span>
			</div>
		{/if}
	</div>
</div>

<!-- Snap Zone Overlay for drag-and-snap functionality -->
<SnapZoneOverlay
	bind:this={snapZoneOverlay}
	{isDragging}
	currentPosition={$windowState.pipPosition || { x: 0, y: 0 }}
	windowSize={$windowState.pipSize}
	on:snap={handleSnapZone}
/>

<style>
	.pip-container {
		width: 100%;
		height: 100%;
		min-height: 150px;
		background: rgba(40, 41, 47, 0.95);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		user-select: none;
		cursor: move;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
	}

	.pip-container:hover {
		border-color: rgba(114, 137, 218, 0.3);
	}

	.pip-container.dragging {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
	}

	.pip-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px 8px 0 0;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.channel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.channel-name {
		color: #f2f3f5;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.window-controls {
		display: flex;
		gap: 4px;
	}

	.control-btn {
		background: transparent;
		border: none;
		color: #b9bbbe;
		padding: 2px;
		border-radius: 3px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.control-btn.minimize:hover {
		background: rgba(255, 193, 7, 0.2);
		color: #ffc107;
	}

	.control-btn.close:hover {
		background: rgba(220, 53, 69, 0.2);
		color: #dc3545;
	}

	.participants-area {
		flex: 1;
		padding: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}

	.participants-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.participant {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		position: relative;
		transition: all 0.2s ease;
	}

	.participant.speaking .avatar {
		box-shadow: 0 0 0 2px #7289da, 0 0 8px rgba(114, 137, 218, 0.4);
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 2px #7289da, 0 0 8px rgba(114, 137, 218, 0.4); }
		50% { box-shadow: 0 0 0 3px #7289da, 0 0 12px rgba(114, 137, 218, 0.6); }
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid #4f545c;
		transition: all 0.2s ease;
		position: relative;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initials {
		width: 100%;
		height: 100%;
		background: #7289da;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
	}

	.username {
		font-size: 10px;
		color: #b9bbbe;
		max-width: 50px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
	}

	.participant-count {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: #b9bbbe;
		font-size: 10px;
		font-weight: 600;
		border: 2px solid #4f545c;
	}

	.status-indicator {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #40444b;
	}

	.status-indicator.muted {
		background: #f04747;
	}

	.status-indicator.deafened {
		background: #747f8d;
	}

	.empty-state {
		text-align: center;
		color: #747f8d;
		padding: 16px;
	}

	.controls-area {
		padding: 8px 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(0, 0, 0, 0.1);
		border-radius: 0 0 8px 8px;
	}

	.voice-controls {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.voice-btn {
		background: #4f545c;
		border-radius: 4px;
		padding: 6px 8px;
		transition: all 0.15s ease;
	}

	.voice-btn:hover {
		background: #5d6269;
	}

	.voice-btn.active {
		background: #f04747;
		color: white;
	}

	.voice-btn.active:hover {
		background: #d73d3d;
	}

	.volume-control {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		animation: slideIn 0.2s ease;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.volume-slider {
		flex: 1;
		height: 3px;
		background: #4f545c;
		border-radius: 3px;
		outline: none;
		appearance: none;
		cursor: pointer;
	}

	.volume-slider::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #7289da;
		cursor: pointer;
	}

	.volume-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #7289da;
		cursor: pointer;
		border: none;
	}

	.volume-text {
		font-size: 10px;
		color: #b9bbbe;
		min-width: 30px;
		text-align: right;
	}
</style>