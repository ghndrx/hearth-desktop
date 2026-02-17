<script lang="ts">
	/**
	 * VoiceMiniPlayer.svelte
	 * FEAT-002: Voice Channel Mini-Player
	 * 
	 * Persistent docked mini-player for active voice calls with:
	 * - Voice channel name and connected users count
	 * - Quick mute/deafen controls
	 * - Expandable panel showing connected users
	 * - Disconnect button
	 * - Click to expand full voice view
	 */
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { voiceState, voiceActions, isInVoice, voiceChannel, currentVoiceUsers } from '$lib/stores/voice';
	import { getVoiceConnectionManager } from '$lib/voice';
	import { user as currentUser } from '$lib/stores/auth';
	import Avatar from './Avatar.svelte';
	import VoiceParticipant from './VoiceParticipant.svelte';

	const dispatch = createEventDispatcher<{
		disconnect: void;
		expandFullView: void;
	}>();

	// State
	let isExpanded = false;
	let elapsedTime = '00:00';
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let connectionStartTime: Date | null = null;

	// Track connection start time
	$: if ($isInVoice && !connectionStartTime) {
		connectionStartTime = new Date();
		startTimer();
	} else if (!$isInVoice && connectionStartTime) {
		connectionStartTime = null;
		stopTimer();
		isExpanded = false;
	}

	// Computed values
	$: userCount = $currentVoiceUsers.length;
	$: channelName = $voiceChannel.name || 'Voice Channel';
	$: serverName = $voiceChannel.serverName || '';
	$: connectionStateText = getConnectionStateText($voiceState.connectionState);

	function getConnectionStateText(state: string): string {
		switch (state) {
			case 'connecting': return 'Connecting...';
			case 'connected': return 'Voice Connected';
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

	function handleToggleExpand() {
		isExpanded = !isExpanded;
	}

	function handleDisconnect() {
		const manager = getVoiceConnectionManager();
		manager.disconnect();
		voiceActions.leave();
		dispatch('disconnect');
	}

	function handleMuteToggle() {
		voiceActions.toggleMute();
		const manager = getVoiceConnectionManager();
		manager.setMuted($voiceState.selfMuted);
	}

	function handleDeafenToggle() {
		voiceActions.toggleDeafen();
		const manager = getVoiceConnectionManager();
		manager.setDeafened($voiceState.selfDeafened);
	}

	function handleExpandFullView() {
		dispatch('expandFullView');
	}

	onDestroy(() => {
		stopTimer();
	});
</script>

{#if $isInVoice}
	<div 
		class="voice-mini-player" 
		role="region" 
		aria-label="Voice call controls"
		data-testid="voice-mini-player"
	>
		<!-- Main Bar (Always Visible) -->
		<div class="mini-player-bar">
			<!-- Left Section: Status & Channel Info -->
			<button 
				class="voice-info" 
				on:click={handleToggleExpand}
				aria-expanded={isExpanded}
				aria-controls="voice-expanded-panel"
				type="button"
			>
				<div class="voice-status">
					<div 
						class="status-icon" 
						class:connected={$voiceState.connectionState === 'connected'}
						class:connecting={$voiceState.connectionState === 'connecting' || $voiceState.connectionState === 'reconnecting'}
						aria-hidden="true"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
							<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
						</svg>
					</div>
					<span class="status-text" class:connected={$voiceState.connectionState === 'connected'}>
						{connectionStateText}
					</span>
				</div>
				<div class="voice-details">
					<span class="channel-name">{channelName}</span>
					<span class="separator">/</span>
					<span class="elapsed-time">{elapsedTime}</span>
					{#if userCount > 0}
						<span class="user-count" title="{userCount} {userCount === 1 ? 'user' : 'users'} connected">
							<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
								<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
							</svg>
							<span>{userCount}</span>
						</span>
					{/if}
					<!-- Expand indicator -->
					<svg 
						class="expand-icon" 
						class:expanded={isExpanded}
						viewBox="0 0 24 24" 
						width="14" 
						height="14" 
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M7 10l5 5 5-5H7z"/>
					</svg>
				</div>
			</button>

			<!-- Right Section: Controls -->
			<div class="voice-controls" role="group" aria-label="Voice controls">
				<button
					class="control-btn"
					class:active={$voiceState.selfMuted}
					on:click={handleMuteToggle}
					aria-label={$voiceState.selfMuted ? 'Unmute microphone' : 'Mute microphone'}
					aria-pressed={$voiceState.selfMuted}
					title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
					type="button"
				>
					{#if $voiceState.selfMuted}
						<!-- Muted icon -->
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
							<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
						</svg>
					{:else}
						<!-- Unmuted icon -->
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
						</svg>
					{/if}
				</button>

				<button
					class="control-btn"
					class:active={$voiceState.selfDeafened}
					on:click={handleDeafenToggle}
					aria-label={$voiceState.selfDeafened ? 'Undeafen audio' : 'Deafen audio'}
					aria-pressed={$voiceState.selfDeafened}
					title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
					type="button"
				>
					{#if $voiceState.selfDeafened}
						<!-- Deafened icon -->
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4zM2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
						</svg>
					{:else}
						<!-- Not deafened icon -->
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
							<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
						</svg>
					{/if}
				</button>

				<button
					class="control-btn disconnect"
					on:click={handleDisconnect}
					aria-label="Disconnect from voice"
					title="Disconnect"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
						<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Expanded Panel -->
		{#if isExpanded}
			<div 
				id="voice-expanded-panel"
				class="expanded-panel" 
				transition:slide={{ duration: 200 }}
				role="region"
				aria-label="Voice channel participants"
			>
				<!-- Server/Channel Info -->
				{#if serverName}
					<div class="server-info">
						<span class="server-name">{serverName}</span>
					</div>
				{/if}

				<!-- Participants List -->
				<div class="participants-section">
					<div class="participants-header">
						<span class="participants-label">
							In Voice — {userCount}
						</span>
					</div>
					
					<div class="participants-list" role="list" aria-label="Connected users">
						{#each $currentVoiceUsers as voiceUser (voiceUser.id)}
							<VoiceParticipant 
								user={voiceUser} 
								isCurrentUser={voiceUser.id === $currentUser?.id}
							/>
						{/each}
						
						{#if userCount === 0}
							<div class="no-participants">
								<span>Waiting for others to join...</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Actions Footer -->
				<div class="expanded-footer">
					<button 
						class="expand-full-btn"
						on:click={handleExpandFullView}
						type="button"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
							<path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/>
						</svg>
						<span>Open Full View</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.voice-mini-player {
		display: flex;
		flex-direction: column;
		background: #232428;
		border-top: 1px solid #1e1f22;
	}

	/* Main Bar */
	.mini-player-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 8px 8px 12px;
	}

	/* Voice Info (Left Side) */
	.voice-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		margin-right: 8px;
	}

	.voice-info:hover {
		background: rgba(79, 84, 92, 0.16);
	}

	.voice-info:focus {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
	}

	.voice-status {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #f0b232;
	}

	.status-icon.connected {
		color: #23a559;
	}

	.status-icon.connecting {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.status-text {
		font-size: 13px;
		font-weight: 600;
		color: #f0b232;
	}

	.status-text.connected {
		color: #23a559;
	}

	.voice-details {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: #949ba4;
	}

	.channel-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100px;
	}

	.separator {
		color: #6d6f78;
	}

	.elapsed-time {
		color: #6d6f78;
		font-variant-numeric: tabular-nums;
	}

	.user-count {
		display: flex;
		align-items: center;
		gap: 2px;
		color: #949ba4;
		margin-left: 4px;
		padding: 2px 4px;
		background: rgba(79, 84, 92, 0.24);
		border-radius: 3px;
		font-size: 11px;
	}

	.expand-icon {
		margin-left: auto;
		color: #949ba4;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.expand-icon.expanded {
		transform: rotate(180deg);
	}

	/* Voice Controls (Right Side) */
	.voice-controls {
		display: flex;
		gap: 4px;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: #2b2d31;
		border: none;
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.control-btn:hover {
		background: #36383f;
		color: #dbdee1;
	}

	.control-btn:focus {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
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
		background: #f23f42;
		color: white;
	}

	/* Expanded Panel */
	.expanded-panel {
		display: flex;
		flex-direction: column;
		background: #2b2d31;
		border-top: 1px solid #1e1f22;
		max-height: 300px;
		overflow: hidden;
	}

	.server-info {
		padding: 8px 12px;
		border-bottom: 1px solid #1e1f22;
	}

	.server-name {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: #949ba4;
		letter-spacing: 0.02em;
	}

	.participants-section {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.participants-header {
		padding: 8px 12px 4px;
	}

	.participants-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: #949ba4;
		letter-spacing: 0.02em;
	}

	.participants-list {
		padding: 4px 8px;
	}

	.no-participants {
		padding: 16px;
		text-align: center;
		color: #949ba4;
		font-size: 13px;
	}

	/* Expanded Footer */
	.expanded-footer {
		padding: 8px;
		border-top: 1px solid #1e1f22;
	}

	.expand-full-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: rgba(88, 101, 242, 0.1);
		border: none;
		border-radius: 4px;
		color: #949ba4;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.expand-full-btn:hover {
		background: rgba(88, 101, 242, 0.2);
		color: #dbdee1;
	}

	.expand-full-btn:focus {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
	}
</style>
