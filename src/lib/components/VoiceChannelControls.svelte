<script lang="ts">
	import { onMount } from 'svelte';
	import {
		voiceState,
		voiceActions,
		isVoiceConnected,
		isSelfMuted,
		isSelfDeafened,
		currentVoiceChannel
	} from '../stores/voice';
	import {
		windowState,
		windowActions,
		isPiPActive,
		defaultPiPConfig
	} from '../stores/window';
	import { WindowAPI } from '../api/window';

	// Component state
	let showControls = false;
	let connecting = false;

	// Mock data for demonstration
	const mockChannelName = 'General Voice';
	const mockServerId = 'server_123';
	const mockChannelId = 'channel_456';

	onMount(() => {
		windowActions.init();
	});

	async function handleJoinVoice() {
		if ($isVoiceConnected) return;

		connecting = true;
		try {
			voiceActions.setConnecting();
			voiceActions.setChannelInfo(mockChannelId, mockServerId);

			// Simulate connection process
			await new Promise(resolve => setTimeout(resolve, 1000));

			voiceActions.setConnected();
			showControls = true;
		} catch (error) {
			voiceActions.setError('Failed to connect to voice channel');
			console.error('Voice connection failed:', error);
		} finally {
			connecting = false;
		}
	}

	async function handleLeaveVoice() {
		try {
			// If PiP is active, close it first
			if ($isPiPActive) {
				await WindowAPI.closePiPWindow().catch(console.error);
				windowActions.disablePiP();
			}

			voiceActions.setDisconnected();
			showControls = false;
		} catch (error) {
			console.error('Failed to disconnect from voice:', error);
		}
	}

	async function togglePiP() {
		try {
			if ($isPiPActive) {
				// Close PiP
				await WindowAPI.closePiPWindow();
				windowActions.disablePiP();
			} else {
				// Open PiP
				if (!$isVoiceConnected) {
					// Can't open PiP without voice connection
					return;
				}

				// Calculate default position (top-right corner)
				const screenSize = await WindowAPI.getScreenSize();
				const padding = 20;
				const position = {
					x: screenSize.width - defaultPiPConfig.width - padding,
					y: padding
				};

				const size = {
					width: defaultPiPConfig.width,
					height: defaultPiPConfig.height
				};

				await WindowAPI.createPiPWindow(position, size);
				windowActions.enablePiP();
				windowActions.setPiPPosition(position.x, position.y);
				windowActions.setPiPSize(size.width, size.height);
				windowActions.snapToCorner('top-right');
				windowActions.saveSettings();
			}
		} catch (error) {
			console.error('Failed to toggle PiP:', error);
			voiceActions.setError('Failed to open picture-in-picture window');
		}
	}

	function handleMuteToggle() {
		voiceActions.setMuted(!$isSelfMuted);
	}

	function handleDeafenToggle() {
		voiceActions.setDeafened(!$isSelfDeafened);
	}

	// Reactive statements
	$: connectedUsers = Object.keys($voiceState.speaking || {}).length;
	$: canTogglePiP = $isVoiceConnected;
</script>

<div class="voice-channel-controls">
	{#if $isVoiceConnected || connecting}
		<!-- Voice Channel Header -->
		<div class="voice-header">
			<div class="channel-info">
				<div class="channel-icon">
					<svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
					</svg>
				</div>
				<div class="channel-details">
					<span class="channel-name">{mockChannelName}</span>
					<span class="connection-status">
						{#if connecting}
							Connecting...
						{:else if $isVoiceConnected}
							{connectedUsers} {connectedUsers === 1 ? 'user' : 'users'}
						{/if}
					</span>
				</div>
			</div>

			<div class="voice-actions">
				<!-- PiP Toggle -->
				<button
					class="action-btn pip-btn"
					class:active={$isPiPActive}
					disabled={!canTogglePiP}
					on:click={togglePiP}
					title={$isPiPActive ? 'Close Picture-in-Picture' : 'Open Picture-in-Picture'}
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
					</svg>
				</button>

				<!-- Disconnect -->
				<button
					class="action-btn disconnect-btn"
					on:click={handleLeaveVoice}
					title="Leave Voice Channel"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.5-.11-.7-.28C1.85 14.77 1 13.38 1 11.72c0-1.69.85-3.1 2.14-4.07C5.27 6.15 8.51 5.5 12 5.5c3.49 0 6.73.65 8.86 2.15C22.15 8.62 23 10.03 23 11.72c0 1.66-.85 3.05-2.14 3.85-.18.17-.42.28-.7.28-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
					</svg>
				</button>
			</div>
		</div>

		{#if showControls}
			<!-- Voice Controls -->
			<div class="voice-controls">
				<button
					class="control-btn"
					class:active={$isSelfMuted}
					on:click={handleMuteToggle}
					title="Toggle Mute"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						{#if $isSelfMuted}
							<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
						{:else}
							<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
						{/if}
					</svg>
					<span>{$isSelfMuted ? 'Unmute' : 'Mute'}</span>
				</button>

				<button
					class="control-btn"
					class:active={$isSelfDeafened}
					on:click={handleDeafenToggle}
					title="Toggle Deafen"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						{#if $isSelfDeafened}
							<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
						{:else}
							<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
						{/if}
					</svg>
					<span>{$isSelfDeafened ? 'Undeafen' : 'Deafen'}</span>
				</button>
			</div>
		{/if}
	{:else}
		<!-- Join Voice Channel Button -->
		<button class="join-voice-btn" on:click={handleJoinVoice} disabled={connecting}>
			<div class="join-voice-content">
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
				</svg>
				<div class="join-voice-text">
					<span class="channel-name">{mockChannelName}</span>
					<span class="join-text">Click to join</span>
				</div>
			</div>
		</button>
	{/if}

	{#if $voiceState.error}
		<div class="error-message">
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
			</svg>
			{$voiceState.error}
			<button class="close-error" on:click={() => voiceActions.clearError()}>
				<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
				</svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.voice-channel-controls {
		background: #2f3136;
		border-radius: 8px;
		border: 1px solid #40444b;
		overflow: hidden;
		margin: 8px 0;
	}

	.voice-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: #36393f;
		border-bottom: 1px solid #40444b;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.channel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.channel-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.channel-name {
		color: #f2f3f5;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.connection-status {
		color: #72767d;
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.voice-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		background: #4f545c;
		border: none;
		color: #b9bbbe;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		min-width: 32px;
		height: 32px;
	}

	.action-btn:hover {
		background: #5d6269;
		color: #fff;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pip-btn.active {
		background: #7289da;
		color: white;
	}

	.pip-btn.active:hover {
		background: #677bc4;
	}

	.disconnect-btn:hover {
		background: #f04747;
		color: white;
	}

	.voice-controls {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
	}

	.control-btn {
		flex: 1;
		background: #4f545c;
		border: none;
		color: #b9bbbe;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.15s ease;
		font-size: 12px;
		font-weight: 500;
	}

	.control-btn:hover {
		background: #5d6269;
		color: #fff;
	}

	.control-btn.active {
		background: #f04747;
		color: white;
	}

	.control-btn.active:hover {
		background: #d73d3d;
	}

	.join-voice-btn {
		width: 100%;
		background: #5865f2;
		border: none;
		color: white;
		padding: 16px;
		cursor: pointer;
		transition: all 0.15s ease;
		border-radius: 8px;
	}

	.join-voice-btn:hover {
		background: #4752c4;
	}

	.join-voice-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.join-voice-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.join-voice-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
	}

	.join-voice-text .channel-name {
		color: white;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 2px;
	}

	.join-text {
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: #f04747;
		color: white;
		font-size: 12px;
	}

	.close-error {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 2px;
		border-radius: 2px;
		margin-left: auto;
	}

	.close-error:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>