<script lang="ts">
	import { voiceCall, formatDuration } from '$lib/stores/voiceCall';
	import { voiceSettings, isPTTPressed } from '$lib/stores';
	import Avatar from './Avatar.svelte';
	import Tooltip from './Tooltip.svelte';

	$: channelName = $voiceCall.channel?.name || 'Voice Connected';
	$: isPushToTalk = $voiceSettings.inputMode === 'push_to_talk';
	$: pttKeyDisplay = $voiceSettings.pushToTalkKeyDisplay;
	$: participantCount = $voiceCall.participants.length;
	$: formattedDuration = formatDuration($voiceCall.callDuration);
	$: qualityColor = {
		excellent: '#23a559',
		good: '#23a559',
		poor: '#f0b232',
		disconnected: '#f23f43'
	}[$voiceCall.connectionQuality];

	function handleDisconnect() {
		voiceCall.disconnect();
	}

	function handleToggleMute() {
		voiceCall.toggleMute();
	}

	function handleToggleDeafen() {
		voiceCall.toggleDeafen();
	}

	function handleToggleScreenShare() {
		voiceCall.toggleScreenShare();
	}
</script>

{#if $voiceCall.connected || $voiceCall.connecting}
	<div class="voice-call-panel" class:connecting={$voiceCall.connecting}>
		<!-- Connection Info -->
		<div class="connection-info">
			<div class="connection-status">
				<div class="status-indicator" style="background: {qualityColor}">
					{#if $voiceCall.connecting}
						<div class="connecting-spinner"></div>
					{:else}
						<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
							<path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904Z"/>
							<path d="M14 9C14 9 16 10.5 16 12C16 13.5 14 15 14 15" stroke="currentColor" stroke-width="1.5" fill="none"/>
						</svg>
					{/if}
				</div>
				<div class="status-text">
					<span class="status-label">
						{#if $voiceCall.connecting}
							Connecting...
						{:else}
							Voice Connected
						{/if}
					</span>
					<span class="channel-name">{channelName}</span>
				</div>
			</div>
			{#if !$voiceCall.connecting}
				<span class="call-duration">{formattedDuration}</span>
			{/if}
		</div>

		<!-- Participants Preview -->
		{#if $voiceCall.participants.length > 0 && !$voiceCall.connecting}
			<div class="participants-preview">
				{#each $voiceCall.participants.slice(0, 4) as participant (participant.id)}
					<div 
						class="participant-avatar" 
						class:speaking={participant.speaking}
						class:muted={participant.muted}
					>
						<Avatar 
							src={participant.avatar} 
							username={participant.displayName || participant.username} 
							size="xs" 
						/>
						{#if participant.muted}
							<div class="muted-badge">
								<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
									<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
									<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="3" stroke-linecap="round"/>
								</svg>
							</div>
						{/if}
						{#if participant.screenSharing}
							<div class="screen-badge">
								<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
									<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
								</svg>
							</div>
						{/if}
					</div>
				{/each}
				{#if participantCount > 4}
					<div class="more-participants">+{participantCount - 4}</div>
				{/if}
			</div>
		{/if}

		<!-- Push to Talk Indicator -->
		{#if isPushToTalk && !$voiceCall.connecting}
			<div class="ptt-indicator" class:active={$isPTTPressed}>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
				</svg>
				<span class="ptt-text">
					{#if $isPTTPressed}
						Transmitting...
					{:else}
						Press <kbd>{pttKeyDisplay}</kbd> to talk
					{/if}
				</span>
			</div>
		{/if}

		<!-- Controls -->
		<div class="voice-controls">
			<Tooltip text={$voiceCall.screenSharing ? 'Stop Sharing' : 'Share Screen'} position="top">
				<button 
					class="control-btn screen-share"
					class:active={$voiceCall.screenSharing}
					on:click={handleToggleScreenShare}
					disabled={$voiceCall.connecting}
					aria-label={$voiceCall.screenSharing ? 'Stop Sharing' : 'Share Screen'}
				>
					{#if $voiceCall.screenSharing}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
							<path d="M12 8l4 4h-3v4h-2v-4H8l4-4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
						</svg>
					{/if}
				</button>
			</Tooltip>

			<Tooltip text={$voiceCall.muted ? 'Unmute' : 'Mute'} position="top">
				<button 
					class="control-btn" 
					class:active={$voiceCall.muted}
					on:click={handleToggleMute}
					disabled={$voiceCall.connecting}
					aria-label={$voiceCall.muted ? 'Unmute' : 'Mute'}
				>
					{#if $voiceCall.muted}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
							<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
						</svg>
					{/if}
				</button>
			</Tooltip>

			<Tooltip text={$voiceCall.deafened ? 'Undeafen' : 'Deafen'} position="top">
				<button 
					class="control-btn" 
					class:active={$voiceCall.deafened}
					on:click={handleToggleDeafen}
					disabled={$voiceCall.connecting}
					aria-label={$voiceCall.deafened ? 'Undeafen' : 'Deafen'}
				>
					{#if $voiceCall.deafened}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
							<rect x="6" y="12" width="4" height="8" rx="1"/>
							<rect x="14" y="12" width="4" height="8" rx="1"/>
							<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
							<rect x="6" y="12" width="4" height="8" rx="1"/>
							<rect x="14" y="12" width="4" height="8" rx="1"/>
						</svg>
					{/if}
				</button>
			</Tooltip>

			<Tooltip text="Disconnect" position="top">
				<button 
					class="control-btn disconnect" 
					on:click={handleDisconnect}
					aria-label="Disconnect from voice"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
					</svg>
				</button>
			</Tooltip>
		</div>
	</div>
{/if}

<style>
	.voice-call-panel {
		display: flex;
		flex-direction: column;
		padding: 8px;
		background: #232428;
		border-bottom: 1px solid #1e1f22;
	}

	.voice-call-panel.connecting {
		opacity: 0.8;
	}

	.connection-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		color: white;
	}

	.connecting-spinner {
		width: 12px;
		height: 12px;
		border: 2px solid transparent;
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% { transform: rotate(360deg); }
	}

	.status-text {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.status-label {
		font-size: 12px;
		font-weight: 600;
		color: #23a559;
	}

	.voice-call-panel.connecting .status-label {
		color: #f0b232;
	}

	.channel-name {
		font-size: 11px;
		color: #949ba4;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.call-duration {
		font-size: 11px;
		color: #949ba4;
		font-variant-numeric: tabular-nums;
	}

	.participants-preview {
		display: flex;
		gap: 4px;
		margin-bottom: 8px;
		padding-left: 4px;
	}

	.participant-avatar {
		position: relative;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		transition: box-shadow 0.15s ease;
	}

	.participant-avatar.speaking {
		box-shadow: 0 0 0 2px #23a559;
	}

	.participant-avatar.muted :global(.avatar-wrapper) {
		opacity: 0.6;
	}

	.muted-badge,
	.screen-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		background: #232428;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.screen-badge {
		background: #5865f2;
		color: white;
	}

	.more-participants {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #404249;
		font-size: 10px;
		color: #dbdee1;
		font-weight: 600;
	}

	.voice-controls {
		display: flex;
		gap: 4px;
		justify-content: center;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: #404249;
		border: none;
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.control-btn:hover:not(:disabled) {
		background: #4e5058;
		color: #dbdee1;
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.control-btn.active {
		background: #f23f43;
		color: white;
	}

	.control-btn.active:hover:not(:disabled) {
		background: #da373c;
	}

	.control-btn.screen-share.active {
		background: #5865f2;
	}

	.control-btn.screen-share.active:hover:not(:disabled) {
		background: #4752c4;
	}

	.control-btn.disconnect {
		background: #f23f43;
		color: white;
	}

	.control-btn.disconnect:hover {
		background: #da373c;
	}

	.ptt-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		margin-bottom: 8px;
		background: #2b2d31;
		border-radius: 4px;
		font-size: 11px;
		color: #949ba4;
		transition: all 0.15s ease;
	}

	.ptt-indicator.active {
		background: rgba(35, 165, 89, 0.15);
		color: #23a559;
	}

	.ptt-indicator svg {
		flex-shrink: 0;
	}

	.ptt-indicator.active svg {
		animation: pulse 1s ease infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.ptt-text {
		flex: 1;
	}

	.ptt-indicator kbd {
		display: inline-block;
		padding: 1px 4px;
		background: #404249;
		border-radius: 3px;
		font-family: inherit;
		font-size: 10px;
		font-weight: 600;
		color: #dbdee1;
	}

	.ptt-indicator.active kbd {
		background: rgba(35, 165, 89, 0.3);
		color: #23a559;
	}
</style>
