<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { voiceManager } from '$lib/VoiceManager';
	import { isInVoice, voiceState, currentVoiceUsers } from '$lib/stores/voice';
	import VoiceControls from './VoiceControls.svelte';
	import VoiceChannelIndicator from './VoiceChannelIndicator.svelte';

	export let channelId: string;
	export let channelName: string;
	export let serverId: string;
	export let serverName: string;
	export let signalingUrl: string = '';
	export let token: string = '';

	let isJoining = false;
	let error: string | null = null;
	let audioDevices = { input: [], output: [] };
	let selectedInputDevice = '';
	let selectedOutputDevice = '';
	let showDeviceSettings = false;

	$: isConnected = $isInVoice;
	$: users = $currentVoiceUsers;
	$: connectionState = $voiceState.connectionState;

	onMount(() => {
		loadAudioDevices();
	});

	onDestroy(() => {
		if (isConnected) {
			handleLeave();
		}
	});

	async function handleJoin() {
		if (!signalingUrl || !token) {
			error = 'Missing signaling URL or token';
			return;
		}

		try {
			isJoining = true;
			error = null;

			await voiceManager.joinChannel(
				channelId,
				channelName,
				serverId,
				serverName,
				signalingUrl,
				token
			);

			console.log('Successfully joined voice channel');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to join voice channel';
			console.error('Failed to join voice channel:', err);
		} finally {
			isJoining = false;
		}
	}

	async function handleLeave() {
		try {
			await voiceManager.leaveChannel();
		} catch (err) {
			console.error('Error leaving voice channel:', err);
		}
	}

	function handleMute() {
		voiceManager.toggleMute();
	}

	function handleDeafen() {
		voiceManager.toggleDeafen();
	}

	async function loadAudioDevices() {
		try {
			audioDevices = await voiceManager.getAudioDevices();

			// Set default selections
			if (audioDevices.input.length > 0 && !selectedInputDevice) {
				selectedInputDevice = audioDevices.input.find(d => d.isDefault)?.deviceId ||
					audioDevices.input[0].deviceId;
			}
			if (audioDevices.output.length > 0 && !selectedOutputDevice) {
				selectedOutputDevice = audioDevices.output.find(d => d.isDefault)?.deviceId ||
					audioDevices.output[0].deviceId;
			}
		} catch (err) {
			console.error('Failed to load audio devices:', err);
		}
	}

	async function handleInputDeviceChange() {
		if (!selectedInputDevice || !isConnected) return;

		try {
			await voiceManager.switchInputDevice(selectedInputDevice);
		} catch (err) {
			console.error('Failed to switch input device:', err);
			error = 'Failed to switch microphone';
		}
	}

	async function handleOutputDeviceChange() {
		if (!selectedOutputDevice) return;

		try {
			await voiceManager.setOutputDevice(selectedOutputDevice);
		} catch (err) {
			console.error('Failed to switch output device:', err);
			error = 'Failed to switch speaker';
		}
	}

	function toggleDeviceSettings() {
		showDeviceSettings = !showDeviceSettings;
	}

	function getSpeakingUsers() {
		return users.filter(user => user.speaking);
	}

	function getMutedUsers() {
		return users.filter(user => user.self_muted || user.self_deafened);
	}
</script>

<div class="voice-channel-panel">
	<div class="panel-header">
		<h3>Voice Channel</h3>
		<span class="channel-name">{channelName}</span>
	</div>

	{#if error}
		<div class="error-message" role="alert">
			<svg viewBox="0 0 24 24" width="16" height="16">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
			</svg>
			{error}
			<button type="button" onclick={() => error = null} aria-label="Dismiss error">×</button>
		</div>
	{/if}

	<div class="connection-section">
		{#if !isConnected}
			<button
				type="button"
				class="join-button"
				onclick={handleJoin}
				disabled={isJoining || !signalingUrl || !token}
			>
				{#if isJoining}
					<div class="spinner" aria-hidden="true"></div>
					Joining...
				{:else}
					<svg viewBox="0 0 24 24" width="20" height="20">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z" fill="currentColor"/>
					</svg>
					Join Voice
				{/if}
			</button>
		{:else}
			<VoiceControls voiceService={voiceManager.getVoiceService()} on:open-settings={toggleDeviceSettings} />
		{/if}
	</div>

	{#if isConnected}
		<div class="participants-section">
			<div class="section-header">
				<span class="participant-count">{users.length} participant{users.length !== 1 ? 's' : ''}</span>

				{#if connectionState !== 'connected'}
					<span class="connection-status {connectionState}">
						{#if connectionState === 'connecting'}
							<div class="spinner small" aria-hidden="true"></div>
							Connecting...
						{:else if connectionState === 'reconnecting'}
							<div class="spinner small" aria-hidden="true"></div>
							Reconnecting...
						{/if}
					</span>
				{/if}
			</div>

			<VoiceChannelIndicator {channelId} compact={false} />

			{#if getSpeakingUsers().length > 0}
				<div class="speaking-indicator">
					<span class="speaking-label">Speaking:</span>
					{#each getSpeakingUsers() as user}
						<span class="speaking-user">{user.display_name || user.username}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if showDeviceSettings}
		<div class="device-settings">
			<div class="settings-header">
				<h4>Audio Settings</h4>
				<button type="button" onclick={toggleDeviceSettings} class="close-settings" aria-label="Close settings">×</button>
			</div>

			<div class="device-section">
				<label for="input-device">Microphone</label>
				<select
					id="input-device"
					bind:value={selectedInputDevice}
					onchange={handleInputDeviceChange}
					disabled={!isConnected}
				>
					{#each audioDevices.input as device (device.deviceId)}
						<option value={device.deviceId}>{device.label}</option>
					{/each}
				</select>
			</div>

			<div class="device-section">
				<label for="output-device">Speaker</label>
				<select
					id="output-device"
					bind:value={selectedOutputDevice}
					onchange={handleOutputDeviceChange}
				>
					{#each audioDevices.output as device (device.deviceId)}
						<option value={device.deviceId}>{device.label}</option>
					{/each}
				</select>
			</div>

			<div class="device-actions">
				<button type="button" onclick={loadAudioDevices} class="refresh-devices">
					<svg viewBox="0 0 24 24" width="16" height="16">
						<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/>
					</svg>
					Refresh Devices
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.voice-channel-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		background: #2b2d31;
		border-radius: 8px;
		min-width: 280px;
	}

	.panel-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.channel-name {
		font-size: 14px;
		color: #b5bac1;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: #f23f42;
		border-radius: 4px;
		color: white;
		font-size: 14px;
	}

	.error-message button {
		margin-left: auto;
		background: none;
		border: none;
		color: white;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.join-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 16px;
		background: #5865f2;
		border: none;
		border-radius: 4px;
		color: white;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.join-button:hover:not(:disabled) {
		background: #4752c4;
	}

	.join-button:disabled {
		background: #5c6bc0;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.participants-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.participant-count {
		font-size: 14px;
		font-weight: 500;
		color: #b5bac1;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.connection-status.connecting {
		color: #faa61a;
	}

	.connection-status.reconnecting {
		color: #f23f42;
	}

	.speaking-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(35, 165, 89, 0.1);
		border-radius: 4px;
		font-size: 13px;
	}

	.speaking-label {
		color: #23a559;
		font-weight: 500;
	}

	.speaking-user {
		color: #f2f3f5;
	}

	.device-settings {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		background: #1e1f22;
		border-radius: 8px;
		border: 1px solid #41434a;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.settings-header h4 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.close-settings {
		background: none;
		border: none;
		color: #b5bac1;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-settings:hover {
		color: #f2f3f5;
	}

	.device-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.device-section label {
		font-size: 12px;
		font-weight: 500;
		color: #b5bac1;
		text-transform: uppercase;
	}

	.device-section select {
		padding: 8px 12px;
		background: #313338;
		border: 1px solid #41434a;
		border-radius: 4px;
		color: #f2f3f5;
		font-size: 14px;
	}

	.device-section select:focus {
		outline: none;
		border-color: #5865f2;
	}

	.device-section select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.device-actions {
		display: flex;
		justify-content: flex-start;
	}

	.refresh-devices {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: 1px solid #41434a;
		border-radius: 4px;
		color: #b5bac1;
		font-size: 13px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-devices:hover {
		background: #41434a;
		color: #f2f3f5;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner.small {
		width: 12px;
		height: 12px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>