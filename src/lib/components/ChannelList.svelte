<script lang="ts">
	import { channels, currentChannel, currentServer, user, type Channel } from '$lib/stores/app';
	import UserPanel from './UserPanel.svelte';
	import ServerHeader from './ServerHeader.svelte';
	import ChannelCategory from './ChannelCategory.svelte';
	import ChannelItem from './ChannelItem.svelte';

	interface Props {
		onOpenSettings?: () => void;
	}

	let { onOpenSettings }: Props = $props();

	let textCategoryCollapsed = $state(false);
	let voiceCategoryCollapsed = $state(false);

	let serverChannels = $derived($channels.filter((c) => c.server_id === $currentServer?.id));
	let textChannels = $derived(serverChannels.filter((c) => c.type === 'text'));
	let voiceChannels = $derived(serverChannels.filter((c) => c.type === 'voice'));
	let isOwner = $derived($currentServer?.owner_id === $user?.id);

	function selectChannel(channel: Channel) {
		currentChannel.set(channel);
	}

	function openServerSettings() {
		onOpenSettings?.();
	}

	function handleLeaveServer() {
		if (!$currentServer) return;
		if (!confirm(`Are you sure you want to leave ${$currentServer.name}?`)) return;
		// TODO: Implement leave server
		currentServer.set(null);
	}

	function handleInvitePeople() {
		// TODO: Open invite modal
	}

	function handleAddTextChannel() {
		// TODO: Open create channel modal
	}

	function handleAddVoiceChannel() {
		// TODO: Open create voice channel modal
	}

	function handleChannelSettings(channel: Channel) {
		// TODO: Open channel settings
		console.log('Open settings for channel:', channel.name);
	}
</script>

<div class="channel-list">
	<div class="channel-list-content">
		{#if $currentServer}
			<ServerHeader
				server={$currentServer}
				{isOwner}
				onOpenSettings={openServerSettings}
				onLeaveServer={handleLeaveServer}
				onInvitePeople={handleInvitePeople}
			/>

			<!-- Text Channels -->
			{#if textChannels.length > 0}
				<ChannelCategory
					name="Text Channels"
					bind:collapsed={textCategoryCollapsed}
					onAddChannel={handleAddTextChannel}
				>
					{#each textChannels as channel (channel.id)}
						<ChannelItem
							{channel}
							active={$currentChannel?.id === channel.id}
							onSelect={selectChannel}
							onOpenSettings={handleChannelSettings}
						/>
					{/each}
				</ChannelCategory>
			{/if}

			<!-- Voice Channels -->
			{#if voiceChannels.length > 0}
				<ChannelCategory
					name="Voice Channels"
					bind:collapsed={voiceCategoryCollapsed}
					onAddChannel={handleAddVoiceChannel}
				>
					{#each voiceChannels as channel (channel.id)}
						<ChannelItem
							{channel}
							active={$currentChannel?.id === channel.id}
							onSelect={selectChannel}
							onOpenSettings={handleChannelSettings}
						/>
					{/each}
				</ChannelCategory>
			{/if}

			<!-- Empty state if no channels -->
			{#if textChannels.length === 0 && voiceChannels.length === 0}
				<div class="empty-channels">
					<p>No channels yet</p>
				</div>
			{/if}
		{:else}
			<!-- DM List placeholder -->
			<div class="dm-header">
				<button class="dm-search">Find or start a conversation</button>
			</div>

			<div class="dm-section">
				<span>DIRECT MESSAGES</span>
			</div>

			<div class="empty-dms">
				<p>No conversations yet</p>
			</div>
		{/if}
	</div>

	<UserPanel onOpenSettings={onOpenSettings} />
</div>

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

	.empty-channels,
	.empty-dms {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		color: #949ba4;
		font-size: 14px;
	}
</style>
