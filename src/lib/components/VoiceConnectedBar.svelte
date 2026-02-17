<script lang="ts">
	import { voiceState, voiceActions, isInVoice, voiceChannel } from '$lib/stores/voice';
	import { getLiveKitManager } from '$lib/voice';
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher<{
		disconnect: void;
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

	async function handleDisconnect() {
		const manager = getLiveKitManager();
		await manager.disconnect();
		voiceActions.leave();
		dispatch('disconnect');
	}

	function handleMuteToggle() {
		voiceActions.toggleMute();
		const manager = getLiveKitManager();
		manager.setMuted($voiceState.selfMuted);
	}

	function handleDeafenToggle() {
		voiceActions.toggleDeafen();
		const manager = getLiveKitManager();
		manager.setDeafened($voiceState.selfDeafened);
	}

	onDestroy(() => {
		stopTimer();
	});
</script>

{#if $isInVoice}
	<div class="voice-connected-bar">
		<div class="voice-info">
			<div class="voice-status">
				<div class="status-icon connected" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				</div>
				<span class="status-text">Voice Connected</span>
			</div>
			<div class="voice-details">
				<span class="channel-name">{$voiceChannel.name || 'Voice Channel'}</span>
				<span class="elapsed-time">/ {elapsedTime}</span>
			</div>
		</div>

		<div class="voice-controls">
			<button
				class="control-btn"
				class:active={$voiceState.selfMuted}
				on:click={handleMuteToggle}
				aria-label={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
				title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
			>
				{#if $voiceState.selfMuted}
					<!-- Muted icon -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M7.72 21.78c.39.39 1.02.39 1.41 0L12 18.91l2.87 2.87c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L13.41 17.5l2.87-2.87c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L12 16.09l-2.87-2.87c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.87 2.87-2.87 2.87c-.39.39-.39 1.02 0 1.41zM12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					</svg>
				{:else}
					<!-- Unmuted icon -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn"
				class:active={$voiceState.selfDeafened}
				on:click={handleDeafenToggle}
				aria-label={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
				title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
			>
				{#if $voiceState.selfDeafened}
					<!-- Deafened icon -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4zM2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
					</svg>
				{:else}
					<!-- Not deafened icon -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn disconnect"
				on:click={handleDisconnect}
				aria-label="Disconnect"
				title="Disconnect"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-8c-.55 0-1-.45-1-1s.45-1 1-1h8c.55 0 1 .45 1 1s-.45 1-1 1z"/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.voice-connected-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 8px 8px 12px;
		background: #232428;
		border-top: 1px solid #1e1f22;
	}

	.voice-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
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
	}

	.status-icon.connected {
		color: #23a559;
	}

	.status-text {
		font-size: 13px;
		font-weight: 600;
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
	}

	.elapsed-time {
		color: #6d6f78;
	}

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
</style>
