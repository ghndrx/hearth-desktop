<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { voiceState, voiceActions, isInVoice, voiceChannel } from '$lib/stores/voice';
	import { VoiceService } from '../../services/webrtc/VoiceService';

	export let voiceService: VoiceService | null = null;

	const dispatch = createEventDispatcher<{
		disconnect: void;
		'open-settings': void;
	}>();

	let elapsedTime = '00:00';
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let connectionStartTime: Date | null = null;

	$: if ($isInVoice && !connectionStartTime) {
		connectionStartTime = new Date();
		startTimer();
	} else if (!$isInVoice && connectionStartTime) {
		connectionStartTime = null;
		stopTimer();
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

	function handleDisconnect() {
		if (voiceService) {
			voiceService.leave();
		}
		voiceActions.leave();
		dispatch('disconnect');
	}

	function handleMuteToggle() {
		voiceActions.toggleMute();
		if (voiceService) {
			voiceService.setMuted($voiceState.selfMuted);
		}
	}

	function handleDeafenToggle() {
		voiceActions.toggleDeafen();
		if (voiceService) {
			voiceService.setMuted($voiceState.selfMuted);
			voiceService.setDeafened($voiceState.selfDeafened);
		}
	}

	function handleOpenSettings() {
		dispatch('open-settings');
	}

	onDestroy(() => {
		stopTimer();
	});
</script>

{#if $isInVoice}
	<div class="voice-controls" role="region" aria-label="Voice controls">
		<button
			class="connection-info"
			on:click={handleOpenSettings}
			title="Open voice settings"
		>
			<div
				class="status-dot"
				class:connected={$voiceState.isConnected}
				class:connecting={$voiceState.isConnecting}
			></div>
			<div class="info-text">
				<span class="status-label" class:connected={$voiceState.isConnected}>
					{#if $voiceState.isConnecting}
						Connecting...
					{:else if $voiceState.connectionState === 'reconnecting'}
						Reconnecting...
					{:else}
						Voice Connected
					{/if}
				</span>
				<span class="channel-name">
					{$voiceChannel.name || 'Voice Channel'} / {elapsedTime}
				</span>
			</div>
		</button>

		<div class="buttons">
			<!-- Mute -->
			<button
				class="ctrl-btn"
				class:active={$voiceState.selfMuted}
				on:click={handleMuteToggle}
				aria-label={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
				title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
			>
				{#if $voiceState.selfMuted}
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.3.43-2.05H19zm-4-2V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.17l6 6V9zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
					</svg>
				{/if}
			</button>

			<!-- Deafen -->
			<button
				class="ctrl-btn"
				class:active={$voiceState.selfDeafened}
				on:click={handleDeafenToggle}
				aria-label={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
				title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
			>
				{#if $voiceState.selfDeafened}
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4zM2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				{/if}
			</button>

			<!-- Disconnect -->
			<button
				class="ctrl-btn disconnect"
				on:click={handleDisconnect}
				aria-label="Disconnect"
				title="Disconnect from voice channel"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-8c-.55 0-1-.45-1-1s.45-1 1-1h8c.55 0 1 .45 1 1s-.45 1-1 1z"/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.voice-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 8px;
		height: 52px;
		background: #232428;
		border-top: 1px solid #1e1f22;
	}

	.connection-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		margin: -8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.connection-info:hover {
		background: rgba(79, 84, 92, 0.32);
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #949ba4;
		flex-shrink: 0;
	}

	.status-dot.connected {
		background: #23a559;
	}

	.status-dot.connecting {
		background: #faa61a;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.info-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		text-align: left;
	}

	.status-label {
		font-size: 13px;
		font-weight: 600;
		color: #949ba4;
	}

	.status-label.connected {
		color: #23a559;
	}

	.channel-name {
		font-size: 12px;
		color: #6d6f78;
	}

	.buttons {
		display: flex;
		gap: 4px;
	}

	.ctrl-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: #2b2d31;
		border: none;
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.ctrl-btn:hover {
		background: #36383f;
		color: #dbdee1;
	}

	.ctrl-btn.active {
		background: #f23f42;
		color: white;
	}

	.ctrl-btn.active:hover {
		background: #d93336;
	}

	.ctrl-btn.disconnect {
		color: #f23f42;
	}

	.ctrl-btn.disconnect:hover {
		background: #f23f42;
		color: white;
	}
</style>
