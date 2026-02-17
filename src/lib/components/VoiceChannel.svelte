<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { voiceState, voiceActions, voiceChannelStates, currentVoiceUsers, isInVoice } from '$lib/stores/voice';
	import { getLiveKitManager } from '$lib/voice';
	import { user as authUser } from '$lib/stores/auth';
	import VoiceParticipant from './VoiceParticipant.svelte';
	import VoiceIcon from './icons/VoiceIcon.svelte';

	export let channel: {
		id: string;
		name: string;
		server_id?: string;
		serverId?: string;
	};
	export let serverName = '';
	export let expanded = true;

	const dispatch = createEventDispatcher<{
		join: { channelId: string };
		leave: void;
	}>();

	$: serverId = channel.server_id || channel.serverId || '';
	$: isCurrentChannel = $voiceState.channelId === channel.id;
	$: channelUsers = $voiceChannelStates[channel.id] || [];
	$: hasUsers = channelUsers.length > 0;

	async function handleJoin() {
		if (isCurrentChannel) return;

		// If already in a voice channel, leave first
		if ($voiceState.channelId) {
			await handleLeave();
		}

		try {
			// Update state to show we're joining this channel
			voiceActions.join({
				id: channel.id,
				name: channel.name,
				serverId: serverId,
				serverName: serverName
			});

			// Connect via LiveKit
			const manager = getLiveKitManager();
			await manager.connect(channel.id, serverId);

			dispatch('join', { channelId: channel.id });
		} catch (error) {
			console.error('Failed to join voice channel:', error);
		}
	}

	async function handleLeave() {
		try {
			const manager = getLiveKitManager();
			await manager.disconnect();
			voiceActions.leave();
			dispatch('leave');
		} catch (error) {
			console.error('Failed to leave voice channel:', error);
		}
	}

	function handleToggleMute() {
		voiceActions.toggleMute();
		const manager = getLiveKitManager();
		manager.setMuted($voiceState.selfMuted);
	}

	function handleToggleDeafen() {
		voiceActions.toggleDeafen();
		const manager = getLiveKitManager();
		manager.setDeafened($voiceState.selfDeafened);
	}
</script>

<div class="voice-channel" class:active={isCurrentChannel} class:expanded>
	<!-- Channel Header -->
	<button
		class="channel-header"
		on:click={handleJoin}
		aria-label={isCurrentChannel ? `Connected to ${channel.name}` : `Join ${channel.name}`}
		title={isCurrentChannel ? 'Connected' : 'Click to join'}
	>
		<div class="channel-icon" aria-hidden="true">
			<VoiceIcon />
		</div>
		<span class="channel-name">{channel.name}</span>
		{#if hasUsers}
			<span class="user-count" aria-label="{channelUsers.length} users">{channelUsers.length}</span>
		{/if}
	</button>

	<!-- Connected Users -->
	{#if hasUsers && expanded}
		<div class="channel-users" role="list" aria-label="Users in voice channel">
			{#each channelUsers as voiceUser (voiceUser.id)}
				<VoiceParticipant
					user={voiceUser}
					isCurrentUser={voiceUser.id === $authUser?.id}
					showControls={isCurrentChannel}
				/>
			{/each}
		</div>
	{/if}

	<!-- Quick Controls (shown when in this channel) -->
	{#if isCurrentChannel}
		<div class="quick-controls">
			<button
				class="control-btn"
				class:active={$voiceState.selfMuted}
				on:click|stopPropagation={handleToggleMute}
				aria-label={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
				title={$voiceState.selfMuted ? 'Unmute' : 'Mute'}
			>
				{#if $voiceState.selfMuted}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M7.72 21.78c.39.39 1.02.39 1.41 0L12 18.91l2.87 2.87c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L13.41 17.5l2.87-2.87c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L12 16.09l-2.87-2.87c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.87 2.87-2.87 2.87c-.39.39-.39 1.02 0 1.41zM12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn"
				class:active={$voiceState.selfDeafened}
				on:click|stopPropagation={handleToggleDeafen}
				aria-label={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
				title={$voiceState.selfDeafened ? 'Undeafen' : 'Deafen'}
			>
				{#if $voiceState.selfDeafened}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4zM2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				{/if}
			</button>

			<button
				class="control-btn disconnect"
				on:click|stopPropagation={handleLeave}
				aria-label="Disconnect"
				title="Disconnect"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11h-8c-.55 0-1-.45-1-1s.45-1 1-1h8c.55 0 1 .45 1 1s-.45 1-1 1z"/>
				</svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.voice-channel {
		display: flex;
		flex-direction: column;
		margin: 1px 0;
	}

	.channel-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: #949ba4;
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.1s ease, color 0.1s ease;
		text-align: left;
	}

	.channel-header:hover {
		background: rgba(79, 84, 92, 0.32);
		color: #dbdee1;
	}

	.voice-channel.active .channel-header {
		background: rgba(79, 84, 92, 0.32);
		color: #fff;
	}

	.channel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: inherit;
	}

	.channel-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-count {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		background: #5865f2;
		border-radius: 8px;
		font-size: 11px;
		font-weight: 600;
		color: #fff;
	}

	.channel-users {
		display: flex;
		flex-direction: column;
		padding-left: 24px;
		margin-top: 2px;
	}

	.quick-controls {
		display: flex;
		gap: 4px;
		padding: 4px 8px 4px 30px;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
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
