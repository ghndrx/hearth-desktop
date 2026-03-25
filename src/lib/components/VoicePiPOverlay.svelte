<script lang="ts">
	/**
	 * VoicePiPOverlay.svelte
	 * MW-002: Basic picture-in-picture voice channel overlay
	 *
	 * Floating overlay for voice channels with:
	 * - Compact voice channel info and participant display
	 * - Quick voice controls (mic, speaker, call, exit)
	 * - Picture-in-picture mode integration
	 * - Always-on-top floating behavior over games/apps
	 */
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import {
		voiceState,
		voiceActions,
		isInVoice,
		voiceChannel,
		currentVoiceUsers
	} from '$lib/stores/voice';
	import {
		voicePiPState,
		voicePiPActions,
		isPiPActive,
		isPiPTransitioning
	} from '$lib/stores/voicePiP';
	import { getVoiceConnectionManager } from '$lib/voice/connection';
	import { user as currentUser } from '$lib/stores/auth';
	import Avatar from './Avatar.svelte';

	const dispatch = createEventDispatcher<{
		exit: void;
		toggleFullView: void;
		pipModeChanged: { active: boolean };
	}>();

	// Local state
	export let isDragging = false;

	// Component state
	let elapsedTime = '00:00';
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let connectionStartTime: Date | null = null;
	let overlayElement: HTMLElement;

	// Drag state
	let dragStart = { x: 0, y: 0, elementX: 0, elementY: 0 };
	let dragOffset = { x: 0, y: 0 };

	// Track connection time
	$: if ($isInVoice && !connectionStartTime) {
		connectionStartTime = new Date();
		startTimer();
	} else if (!$isInVoice) {
		connectionStartTime = null;
		stopTimer();
	}

	// Computed values
	$: userCount = $currentVoiceUsers.length;
	$: channelName = $voiceChannel.name || 'Voice Channel';
	$: connectionStateText = getConnectionStateText($voiceState.connectionState);
	$: participantsToShow = $currentVoiceUsers.slice(0, 6); // Show max 6 participants
	$: hasMoreParticipants = $currentVoiceUsers.length > 6;

	function getConnectionStateText(state: string): string {
		switch (state) {
			case 'connecting': return 'Connecting...';
			case 'connected': return 'Connected';
			case 'reconnecting': return 'Reconnecting...';
			default: return 'Disconnected';
		}
	}

	function startTimer() {
		stopTimer();
		updateElapsedTime();
		timeInterval = setInterval(updateElapsedTime, 1000);
	}

	function stopTimer() {
		if (timeInterval) {
			clearInterval(timeInterval);
			timeInterval = null;
		}
		elapsedTime = '00:00';
	}

	function updateElapsedTime() {
		if (!connectionStartTime) return;
		const now = new Date();
		const diff = Math.floor((now.getTime() - connectionStartTime.getTime()) / 1000);
		const hours = Math.floor(diff / 3600);
		const minutes = Math.floor((diff % 3600) / 60);
		const seconds = diff % 60;

		if (hours > 0) {
			elapsedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		} else {
			elapsedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
	}

	// Voice control handlers
	function handleMuteToggle() {
		voiceActions.toggleMute();
		const manager = getVoiceConnectionManager();
		manager.setMuted($voiceState.selfMuted);
	}

	function handleSpeakerToggle() {
		voiceActions.toggleDeafen();
		const manager = getVoiceConnectionManager();
		manager.setDeafened($voiceState.selfDeafened);
	}

	function handleDisconnect() {
		const manager = getVoiceConnectionManager();
		manager.disconnect();
		voiceActions.leave();
		dispatch('exit');
	}

	function handleExpandFullView() {
		dispatch('toggleFullView');
	}

	// PiP Mode management
	export async function enterPiPMode() {
		const success = await voicePiPActions.enter('bottom-right');
		if (success) {
			dispatch('pipModeChanged', { active: true });
		}
	}

	export async function exitPiPMode() {
		const success = await voicePiPActions.exit();
		if (success) {
			dispatch('pipModeChanged', { active: false });
		}
	}

	// Drag functionality for repositioning
	function handleDragStart(event: MouseEvent) {
		if (!$isPiPActive) return;

		isDragging = true;
		dragStart.x = event.clientX;
		dragStart.y = event.clientY;
		dragStart.elementX = $voicePiPState.position.x;
		dragStart.elementY = $voicePiPState.position.y;

		document.addEventListener('mousemove', handleDragMove);
		document.addEventListener('mouseup', handleDragEnd);
	}

	function handleDragMove(event: MouseEvent) {
		if (!isDragging) return;

		dragOffset.x = event.clientX - dragStart.x;
		dragOffset.y = event.clientY - dragStart.y;

		const newX = dragStart.elementX + dragOffset.x;
		const newY = dragStart.elementY + dragOffset.y;

		voicePiPActions.updatePosition(newX, newY);
	}

	function handleDragEnd() {
		isDragging = false;
		document.removeEventListener('mousemove', handleDragMove);
		document.removeEventListener('mouseup', handleDragEnd);
	}

	onDestroy(() => {
		stopTimer();
		if (isDragging) {
			handleDragEnd();
		}
	});
</script>

{#if $isInVoice && $isPiPActive}
	<div
		bind:this={overlayElement}
		class="voice-pip-overlay"
		class:dragging={isDragging}
		style="left: {$voicePiPState.position.x}px; top: {$voicePiPState.position.y}px;"
		transition:scale={{ duration: 200, start: 0.8 }}
		role="dialog"
		aria-label="Voice channel picture-in-picture overlay"
		data-testid="voice-pip-overlay"
	>
		<!-- Header with drag handle and channel info -->
		<div
			class="pip-header"
			on:mousedown={handleDragStart}
			role="button"
			tabindex="-1"
			aria-label="Drag to move overlay"
		>
			<div class="channel-info">
				<div
					class="status-indicator"
					class:connected={$voiceState.connectionState === 'connected'}
					class:connecting={$voiceState.connectionState === 'connecting' || $voiceState.connectionState === 'reconnecting'}
				/>
				<span class="channel-name">{channelName}</span>
			</div>
			<div class="connection-time">
				{elapsedTime}
			</div>
		</div>

		<!-- Participants Grid -->
		<div class="participants-grid">
			{#each participantsToShow as participant (participant.id)}
				<div
					class="participant"
					class:speaking={participant.speaking}
					class:muted={participant.self_muted}
					title="{participant.display_name || participant.username}{participant.self_muted ? ' (muted)' : ''}{participant.speaking ? ' (speaking)' : ''}"
				>
					<Avatar
						username={participant.display_name || participant.username}
						userId={participant.id}
						size="sm"
					/>
					{#if participant.speaking}
						<div class="speaking-indicator" />
					{/if}
					{#if participant.self_muted}
						<div class="muted-indicator">
							<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
								<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
								<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
								<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</div>
					{/if}
				</div>
			{/each}

			{#if hasMoreParticipants}
				<div class="participant more-indicator" title="+{$currentVoiceUsers.length - 6} more">
					<div class="more-count">
						+{$currentVoiceUsers.length - 6}
					</div>
				</div>
			{/if}
		</div>

		<!-- Controls -->
		<div class="pip-controls">
			<button
				class="control-btn mic"
				class:active={$voiceState.selfMuted}
				on:click={handleMuteToggle}
				aria-label={$voiceState.selfMuted ? 'Unmute microphone' : 'Mute microphone'}
				title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
			>
				{#if $voiceState.selfMuted}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
						<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
						<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2" stroke-linecap="round"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
						<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn speaker"
				class:active={$voiceState.selfDeafened}
				on:click={handleSpeakerToggle}
				aria-label={$voiceState.selfDeafened ? 'Undeafen audio' : 'Deafen audio'}
				title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
			>
				{#if $voiceState.selfDeafened}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4z"/>
						<path d="M2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn expand"
				on:click={handleExpandFullView}
				aria-label="Expand to full view"
				title="Full View"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6z"/>
				</svg>
			</button>

			<button
				class="control-btn disconnect"
				on:click={handleDisconnect}
				aria-label="Disconnect from voice"
				title="Exit Call"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.voice-pip-overlay {
		position: fixed;
		z-index: 9999;
		background: rgba(35, 36, 40, 0.95);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(79, 84, 92, 0.4);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		user-select: none;
		width: 240px;
		min-height: 160px;
		overflow: hidden;
		transition: transform 0.15s ease;
	}

	.voice-pip-overlay.dragging {
		transform: scale(1.02);
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
	}

	/* Header */
	.pip-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: rgba(43, 45, 49, 0.8);
		border-bottom: 1px solid rgba(79, 84, 92, 0.3);
		cursor: move;
	}

	.pip-header:hover {
		background: rgba(54, 57, 63, 0.8);
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f0b232;
		flex-shrink: 0;
	}

	.status-indicator.connected {
		background: #23a559;
	}

	.status-indicator.connecting {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.channel-name {
		font-size: 12px;
		font-weight: 600;
		color: #dbdee1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.connection-time {
		font-size: 10px;
		color: #949ba4;
		font-variant-numeric: tabular-nums;
	}

	/* Participants Grid */
	.participants-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		padding: 12px;
	}

	.participant {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		border-radius: 8px;
		background: rgba(79, 84, 92, 0.3);
		transition: all 0.15s ease;
	}

	.participant.speaking {
		background: rgba(35, 165, 89, 0.2);
		box-shadow: 0 0 0 2px #23a559;
	}

	.participant.muted {
		opacity: 0.6;
	}

	.more-indicator {
		background: rgba(88, 101, 242, 0.2);
		border: 1px dashed rgba(88, 101, 242, 0.4);
	}

	.more-count {
		font-size: 11px;
		font-weight: 600;
		color: #5865f2;
	}

	/* Participant indicators */
	.speaking-indicator {
		position: absolute;
		bottom: 2px;
		right: 2px;
		width: 8px;
		height: 8px;
		background: #23a559;
		border-radius: 50%;
		animation: speaking-pulse 1s ease-in-out infinite alternate;
	}

	@keyframes speaking-pulse {
		from { opacity: 0.6; transform: scale(0.8); }
		to { opacity: 1; transform: scale(1); }
	}

	.muted-indicator {
		position: absolute;
		bottom: 2px;
		right: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		background: rgba(242, 63, 67, 0.9);
		border-radius: 50%;
		color: white;
	}

	/* Controls */
	.pip-controls {
		display: flex;
		justify-content: space-between;
		padding: 8px 12px;
		background: rgba(43, 45, 49, 0.8);
		border-top: 1px solid rgba(79, 84, 92, 0.3);
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: rgba(79, 84, 92, 0.4);
		border: none;
		border-radius: 6px;
		color: #b5bac1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: rgba(79, 84, 92, 0.6);
		color: #dbdee1;
		transform: scale(1.05);
	}

	.control-btn:active {
		transform: scale(0.95);
	}

	.control-btn.active {
		background: #f23f42;
		color: white;
	}

	.control-btn.active:hover {
		background: #d93336;
	}

	.control-btn.disconnect {
		color: #f23f42;
	}

	.control-btn.disconnect:hover {
		background: rgba(242, 63, 67, 0.2);
	}

	.control-btn.expand {
		color: #5865f2;
	}

	.control-btn.expand:hover {
		background: rgba(88, 101, 242, 0.2);
	}
</style>