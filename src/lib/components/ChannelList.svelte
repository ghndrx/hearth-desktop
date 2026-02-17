<script lang="ts">
	import { channels, currentChannel, type Channel, type ChannelTypeString } from '$lib/stores/channels';
	import { currentServer, leaveServer } from '$lib/stores/servers';
	import { user } from '$lib/stores/auth';
	import { settings } from '$lib/stores/settings';
	import { voiceChannelStates, voiceState, voiceActions, isInVoice } from '$lib/stores/voice';
	import { getVoiceConnectionManager } from '$lib/voice';
	import { api } from '$lib/api';
	import { createEventDispatcher, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import UserPanel from './UserPanel.svelte';
	import ServerHeader from './ServerHeader.svelte';
	import ChannelCategory from './ChannelCategory.svelte';
	import ChannelItem from './ChannelItem.svelte';
	import VoiceMiniPlayer from './VoiceMiniPlayer.svelte';
	import InviteModal from './InviteModal.svelte';
	import CreateChannelModal from './CreateChannelModal.svelte';
	import NewDMModal from './NewDMModal.svelte';

	const dispatch = createEventDispatcher<{
		openQuickSwitcher: void;
	}>();

	let showNewDMModal = false;

	function openQuickSwitcher() {
		dispatch('openQuickSwitcher');
	}

	let textCategoryCollapsed = false;
	let voiceCategoryCollapsed = false;
	let showInviteModal = false;
	let showCreateChannelModal = false;
	let createChannelType: ChannelTypeString = 'text';
	let inviteModalComponent: InviteModal;

	// Get voice users from store, transformed to match ChannelItem's expected format
	$: voiceConnectedUsers = Object.fromEntries(
		Object.entries($voiceChannelStates).map(([channelId, users]) => [
			channelId,
			users.map(u => ({
				id: u.id,
				username: u.display_name || u.username,
				avatar: u.avatar || null,
				speaking: u.speaking
			}))
		])
	);

	// Fetch voice states when server changes
	onMount(() => {
		if ($currentServer?.id) {
			fetchVoiceStates($currentServer.id);
		}
	});

	$: if ($currentServer?.id) {
		fetchVoiceStates($currentServer.id);
	}

	async function fetchVoiceStates(serverId: string) {
		try {
			const states = await api.get<Array<{
				user_id: string;
				username: string;
				display_name?: string;
				avatar?: string;
				channel_id: string;
				self_muted: boolean;
				self_deafened: boolean;
				self_video: boolean;
				self_stream: boolean;
				muted: boolean;
				deafened: boolean;
			}>>(`/servers/${serverId}/voice-states`);

			// Group by channel
			const byChannel: Record<string, typeof states> = {};
			for (const state of states) {
				if (!byChannel[state.channel_id]) {
					byChannel[state.channel_id] = [];
				}
				byChannel[state.channel_id].push(state);
			}

			// Update voice channel states store
			for (const [channelId, channelUsers] of Object.entries(byChannel)) {
				voiceChannelStates.setChannelUsers(channelId, channelUsers.map(u => ({
					id: u.user_id,
					username: u.username,
					display_name: u.display_name,
					avatar: u.avatar,
					self_muted: u.self_muted,
					self_deafened: u.self_deafened,
					self_video: u.self_video,
					self_stream: u.self_stream,
					muted: u.muted,
					deafened: u.deafened,
					speaking: false
				})));
			}
		} catch (error) {
			console.error('Failed to fetch voice states:', error);
		}
	}

	$: serverChannels = $channels.filter((c) => c.server_id === $currentServer?.id);
	$: textChannels = serverChannels.filter((c) => c.type === 0);
	$: voiceChannels = serverChannels.filter((c) => c.type === 2);
	$: isOwner = $currentServer?.owner_id === $user?.id;

	function selectChannel(channel: Channel) {
		console.log('[ChannelList] selectChannel called with:', channel.id, channel.name);
		currentChannel.set(channel);
		if (channel.server_id) {
			console.log('[ChannelList] Navigating to server channel:', `/channels/${channel.server_id}/${channel.id}`);
			goto(`/channels/${channel.server_id}/${channel.id}`);
		} else {
			console.log('[ChannelList] Navigating to DM:', `/channels/@me/${channel.id}`);
			goto(`/channels/@me/${channel.id}`);
		}
	}

	function openServerSettings() {
		settings.openServerSettings();
	}

	async function handleLeaveServer() {
		if (!$currentServer) return;
		if (!confirm(`Are you sure you want to leave ${$currentServer.name}?`)) return;
		try {
			await leaveServer($currentServer.id);
			currentServer.set(null);
			goto('/channels/@me');
		} catch (error) {
			console.error('Failed to leave server:', error);
		}
	}

	function handleInvitePeople() {
		showInviteModal = true;
	}

	function handleInviteClose() {
		showInviteModal = false;
	}

	function handleInviteCreated(event: CustomEvent<{ code: string; maxUses: number; expiresIn: number }>) {
		console.log('Invite created:', event.detail);
	}

	async function handleGenerateInvite(event: CustomEvent<{ maxUses: number; expiresIn: number }>) {
		if (!$currentServer) return;
		
		try {
			const channelId = $currentChannel?.id;
			const response = await api.post<{ code: string }>(`/servers/${$currentServer.id}/invites`, {
				channel_id: channelId,
				max_uses: event.detail.maxUses || 0,
				max_age: event.detail.expiresIn || 604800
			});
			
			// Call the modal's method to set the generated invite code
			if (inviteModalComponent && response?.code) {
				inviteModalComponent.onInviteGenerated(response.code);
			}
		} catch (error) {
			console.error('Failed to generate invite:', error);
		}
	}

	function handleAddTextChannel() {
		createChannelType = 'text';
		showCreateChannelModal = true;
	}

	function handleAddVoiceChannel() {
		createChannelType = 'voice';
		showCreateChannelModal = true;
	}

	function handleCreateChannelClose() {
		showCreateChannelModal = false;
	}

	function handleChannelCreated(event: CustomEvent<Channel>) {
		const channel = event.detail;
		// Navigate to the newly created channel
		if (channel.server_id) {
			goto(`/channels/${channel.server_id}/${channel.id}`);
		}
	}

	function handleChannelSettings(event: CustomEvent<Channel>) {
		// TODO: Open channel settings
		console.log('Open settings for channel:', event.detail.name);
	}

	function handleOpenNewDM() {
		showNewDMModal = true;
	}

	function handleNewDMClose() {
		showNewDMModal = false;
	}

	function handleDMSelected(event: CustomEvent<{ channelId: string }>) {
		showNewDMModal = false;
		// Navigation is handled in the modal
	}
</script>

<nav class="channel-list" aria-label="Channels and direct messages">
	<div class="channel-list-content">
		{#if $currentServer}
			<ServerHeader
				server={$currentServer}
				{isOwner}
				on:openSettings={openServerSettings}
				on:leaveServer={handleLeaveServer}
				on:invitePeople={handleInvitePeople}
			/>

			<!-- Text Channels - Always show category to allow creating first channel -->
			<ChannelCategory
				name="Text Channels"
				collapsed={textCategoryCollapsed}
				on:toggle={(e) => textCategoryCollapsed = e.detail.collapsed}
				on:addChannel={handleAddTextChannel}
			>
				{#if textChannels.length > 0}
					{#each textChannels as channel (channel.id)}
						<ChannelItem
							{channel}
							active={$currentChannel?.id === channel.id}
							on:select={(e) => selectChannel(e.detail)}
							on:openSettings={handleChannelSettings}
						/>
					{/each}
				{:else}
					<div class="no-channels-hint">
						<span>No text channels yet</span>
					</div>
				{/if}
			</ChannelCategory>

			<!-- Voice Channels - Always show category -->
			<ChannelCategory
				name="Voice Channels"
				collapsed={voiceCategoryCollapsed}
				on:toggle={(e) => voiceCategoryCollapsed = e.detail.collapsed}
				on:addChannel={handleAddVoiceChannel}
			>
				{#if voiceChannels.length > 0}
					{#each voiceChannels as channel (channel.id)}
						<ChannelItem
							{channel}
							active={$currentChannel?.id === channel.id}
							connectedUsers={voiceConnectedUsers[channel.id] || []}
							on:select={(e) => selectChannel(e.detail)}
							on:openSettings={handleChannelSettings}
						/>
					{/each}
				{:else}
					<div class="no-channels-hint">
						<span>No voice channels yet</span>
					</div>
				{/if}
			</ChannelCategory>
		{:else}
			<!-- DM List -->
			<div class="dm-header">
				<button class="dm-search" aria-label="Find or start a conversation" type="button" on:click={handleOpenNewDM}>Find or start a conversation</button>
			</div>

			<div class="dm-section" role="heading" aria-level="2">
				<span>DIRECT MESSAGES</span>
			</div>

			<ul role="list" aria-label="Direct messages" class="dm-list">
				{#each $channels.filter((c) => c.type === 1 || c.type === 3) as dm (dm.id)}
					<li role="listitem">
						<button
							class="dm-item"
							class:active={$currentChannel?.id === dm.id}
							on:click={() => selectChannel(dm)}
							aria-current={$currentChannel?.id === dm.id ? 'page' : undefined}
							aria-label="Direct message with {dm.name || dm.recipients?.map((r) => r.display_name || r.username).join(', ') || 'Unknown'}{dm.e2ee_enabled ? ', encrypted' : ''}"
							type="button"
						>
							<div class="dm-avatar">
								{#if dm.recipients?.[0]?.avatar}
									<img src={dm.recipients[0].avatar} alt="" />
								{:else}
									<div class="avatar-placeholder">
										{(dm.recipients?.[0]?.username || '?')[0].toUpperCase()}
									</div>
								{/if}
							</div>
							<span class="dm-name">
								{dm.name || dm.recipients?.map((r) => r.display_name || r.username).join(', ') || 'Unknown'}
							</span>
							{#if dm.e2ee_enabled}
								<span class="e2ee-indicator" aria-hidden="true">🔒</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- FEAT-002: Voice Mini-Player - Shows when in a voice channel -->
	<VoiceMiniPlayer 
		on:disconnect={() => {
			// Voice disconnected - mini-player will hide automatically
		}}
		on:expandFullView={() => {
			// TODO: Open full voice overlay or navigate to voice channel
			// Could dispatch event to parent or use voiceCallStore
		}}
	/>

	<UserPanel />
</nav>

<!-- Invite Modal -->
{#if $currentServer}
	<InviteModal
		bind:this={inviteModalComponent}
		open={showInviteModal}
		serverName={$currentServer.name}
		serverId={$currentServer.id}
		channelName={$currentChannel?.name ?? ''}
		channelId={$currentChannel?.id ?? ''}
		on:close={handleInviteClose}
		on:invite={handleInviteCreated}
		on:generateInvite={handleGenerateInvite}
	/>

	<!-- Create Channel Modal -->
	<CreateChannelModal
		open={showCreateChannelModal}
		defaultType={createChannelType}
		on:close={handleCreateChannelClose}
		on:created={handleChannelCreated}
	/>
{/if}

<!-- New DM Modal -->
<NewDMModal
	open={showNewDMModal}
	on:close={handleNewDMClose}
	on:select={handleDMSelected}
/>

<style>
	.channel-list {
		display: flex;
		flex-direction: column;
		width: 240px;
		height: 100%;
		background: #2b2d31;
		flex-shrink: 0;
	}

	.channel-list-content {
		flex: 1;
		overflow-y: auto;
	}

	/* DM styles */
	.dm-header {
		padding: 10px 8px;
	}

	.dm-search {
		width: 100%;
		padding: 6px 8px;
		background: #1e1f22;
		border: none;
		border-radius: 4px;
		color: #949ba4;
		font-size: 14px;
		cursor: pointer;
		text-align: left;
	}

	.dm-search:hover {
		background: #404249;
	}

	.dm-section {
		padding: 16px 8px 4px 16px;
		font-size: 12px;
		font-weight: 600;
		color: #949ba4;
		letter-spacing: 0.02em;
	}

	.dm-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dm-list li {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dm-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		margin: 1px 8px;
		border-radius: 4px;
		background: none;
		border: none;
		cursor: pointer;
		width: calc(100% - 16px);
	}

	.dm-item:hover {
		background: #35373c;
	}

	.dm-item.active {
		background: #404249;
	}

	.dm-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		background: #5865f2;
		flex-shrink: 0;
	}

	.dm-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 500;
		font-size: 14px;
	}

	.dm-name {
		flex: 1;
		color: #949ba4;
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}

	.dm-item.active .dm-name,
	.dm-item:hover .dm-name {
		color: #dbdee1;
	}

	.e2ee-indicator {
		font-size: 12px;
		opacity: 0.6;
	}

	.no-channels-hint {
		padding: 8px 8px 8px 48px;
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
