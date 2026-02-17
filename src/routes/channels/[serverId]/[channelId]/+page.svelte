<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { currentServer, servers } from '$lib/stores/servers';
	import { currentChannel, loadServerChannels, channels } from '$lib/stores/channels';
	import { sendMessage } from '$lib/stores/messages';
	import { splitViewStore, canAddSplitPanel, splitViewEnabled } from '$lib/stores/splitView';
	import MessageList from '$lib/components/MessageList.svelte';
	import MessageInput from '$lib/components/MessageInput.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	
	$: serverId = $page.params.serverId;
	$: channelId = $page.params.channelId;
	
	// Set currentServer from URL if not already set
	$: if (serverId && serverId !== '@me' && $servers.length > 0) {
		const server = $servers.find(s => s.id === serverId);
		if (server && $currentServer?.id !== serverId) {
			currentServer.set(server);
		}
	}
	
	// Set currentChannel from URL if not already set
	$: if (channelId && $channels.length > 0) {
		const channel = $channels.find(c => c.id === channelId);
		if (channel && $currentChannel?.id !== channelId) {
			currentChannel.set(channel);
		}
	}
	
	$: pageTitle = $currentChannel
		? `${$currentChannel.type === 1 
			? $currentChannel.recipients?.[0]?.username 
			: '#' + $currentChannel.name} | ${$currentServer?.name || 'Hearth'}`
		: $currentServer?.name || 'Hearth';
	
	// FEAT-003: Split view pin state
	$: isPinnedToSplitView = $currentChannel 
		? splitViewStore.isPinned($currentChannel.id, $currentChannel.type === 1 ? 'dm' : 'channel') 
		: false;
	$: canPinToSplitView = $splitViewEnabled && $currentChannel && ($canAddSplitPanel || isPinnedToSplitView);
	
	function handleToggleSplitViewPin() {
		if (!$currentChannel) return;
		
		if (isPinnedToSplitView) {
			splitViewStore.unpinByTarget($currentChannel.id, $currentChannel.type === 1 ? 'dm' : 'channel');
		} else if ($currentChannel.type === 1) {
			splitViewStore.pinDM($currentChannel, serverId || '');
		} else if (serverId) {
			splitViewStore.pinChannel($currentChannel, serverId);
		}
	}
	
	onMount(() => {
		if (serverId && serverId !== '@me') {
			loadServerChannels(serverId);
		}
	});
	
	async function handleSend(event: CustomEvent<{ content: string; attachments: File[] }>) {
		console.log('[Page] handleSend called, currentChannel:', $currentChannel?.id, $currentChannel?.name);
		if (!$currentChannel) {
			console.error('[Page] handleSend: No currentChannel!');
			return;
		}
		
		const { content, attachments } = event.detail;
		console.log('[Page] Sending message:', { channelId: $currentChannel.id, content: content?.substring(0, 50) });
		
		try {
			await sendMessage($currentChannel.id, content, attachments);
			console.log('[Page] Message sent successfully');
		} catch (error) {
			console.error('[Page] Failed to send message:', error);
		}
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="channel-view">
<div class="channel-header">
	{#if $currentChannel}
		<div class="channel-info">
			{#if $currentChannel.type === 0}
				<span class="hash">#</span>
			{:else if $currentChannel.type === 2}
				<span class="voice-icon">🔊</span>
			{:else}
				<span class="at">@</span>
			{/if}
			<span class="channel-name">
				{$currentChannel.type === 1 
					? $currentChannel.recipients?.[0]?.display_name || $currentChannel.recipients?.[0]?.username
					: $currentChannel.name}
			</span>
			{#if $currentChannel.topic}
				<span class="divider"></span>
				<span class="topic">{$currentChannel.topic}</span>
			{/if}
			{#if $currentChannel.e2ee_enabled}
				<span class="e2ee" title="End-to-End Encrypted">🔒</span>
			{/if}
		</div>
	{/if}
	
	<div class="header-actions">
		<!-- FEAT-003: Pin to Split View button -->
		{#if canPinToSplitView}
			<Tooltip text={isPinnedToSplitView ? 'Unpin from Split View' : 'Pin to Split View'}>
				<button 
					class="action-btn"
					class:pinned={isPinnedToSplitView}
					on:click={handleToggleSplitViewPin}
					title={isPinnedToSplitView ? 'Unpin from Split View' : 'Pin to Split View'}
					aria-pressed={isPinnedToSplitView}
				>
					{#if isPinnedToSplitView}
						📌
					{:else}
						📍
					{/if}
				</button>
			</Tooltip>
		{/if}
		<button class="action-btn" title="Search">🔍</button>
		<button class="action-btn" title="Members">👥</button>
	</div>
</div>

<div class="messages-wrapper">
	<MessageList />
</div>

<div class="input-wrapper">
	<MessageInput on:send={handleSend} />
</div>
</div>

<style>
	.channel-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		min-height: 0; /* Critical for flex children to shrink */
		overflow: hidden;
	}

	.channel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		height: 48px;
		min-height: 48px;
		border-bottom: 1px solid var(--bg-modifier-accent);
		background: var(--bg-primary);
		flex-shrink: 0;
	}
	
	.channel-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	
	.hash, .voice-icon, .at {
		color: var(--text-muted);
		font-size: 24px;
		font-weight: 500;
	}
	
	.channel-name {
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.divider {
		width: 1px;
		height: 24px;
		background: var(--bg-modifier-accent);
	}
	
	.topic {
		color: var(--text-muted);
		font-size: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.e2ee {
		font-size: 14px;
	}
	
	.header-actions {
		display: flex;
		gap: 8px;
	}
	
	.header-actions .action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 6px;
		font-size: 18px;
		opacity: 0.8;
		border-radius: 4px;
		transition: opacity 0.15s, background-color 0.15s;
	}
	
	.header-actions .action-btn:hover {
		opacity: 1;
		background-color: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}
	
	/* FEAT-003: Split view pin button pinned state */
	.header-actions .action-btn.pinned {
		opacity: 1;
		color: var(--brand-primary, #5865f2);
	}
	
	.header-actions .action-btn.pinned:hover {
		color: var(--red, #da373c);
	}

	/* Messages wrapper fills remaining space */
	.messages-wrapper {
		flex: 1;
		min-height: 0; /* Critical for overflow scrolling */
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Input stays at bottom, doesn't grow */
	.input-wrapper {
		flex-shrink: 0;
		background: var(--bg-primary, #313338);
	}
</style>
