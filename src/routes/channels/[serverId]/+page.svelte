<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentServer, servers } from '$lib/stores/servers';
	import { loadServerChannels, channels, channelsLoading } from '$lib/stores/channels';
	
	$: serverId = $page.params.serverId;
	let hasRedirected = false;
	
	// Reset redirect flag when server changes
	$: if (serverId) {
		hasRedirected = false;
	}
	
	// Set currentServer from URL
	$: if (serverId && $servers.length > 0) {
		const server = $servers.find(s => s.id === serverId);
		if (server && $currentServer?.id !== serverId) {
			currentServer.set(server);
		}
	}
	
	onMount(async () => {
		if (serverId && serverId !== '@me') {
			await loadServerChannels(serverId);
		}
	});
	
	// Redirect to first channel when channels load
	$: if ($channels.length > 0 && serverId && !hasRedirected) {
		const serverChannels = $channels.filter(c => c.server_id === serverId);
		const firstChannel = serverChannels.find(c => c.type === 0) || serverChannels[0];
		if (firstChannel) {
			hasRedirected = true;
			goto(`/channels/${serverId}/${firstChannel.id}`, { replaceState: true });
		}
	}
</script>

<svelte:head>
	<title>{$currentServer?.name || 'Server'} | Hearth</title>
</svelte:head>

<div class="server-view">
	<!-- Header -->
	<div class="channel-header">
		<div class="channel-info">
			<span class="channel-name">Select a channel</span>
			<span class="topic">Select a channel to start chatting</span>
		</div>
	</div>

	<!-- Message Area -->
	<div class="message-area">
		<div class="empty-content">
			<div class="icon">💬</div>
			<h2>Select a channel</h2>
			<p>Choose a channel from the sidebar to start chatting</p>
		</div>
	</div>

	<!-- Input Bar (disabled) -->
	<div class="input-bar">
		<div class="input-wrapper">
			<button class="attach-btn" disabled aria-label="Attach file">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
				</svg>
			</button>
			<input type="text" placeholder="Select a channel to chat" disabled />
		</div>
	</div>
</div>

<style>
	.server-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: #313338;
	}

	.channel-header {
		display: flex;
		align-items: center;
		padding: 0 16px;
		height: 48px;
		min-height: 48px;
		border-bottom: 1px solid #1e1f22;
		background: #313338;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.channel-name {
		font-weight: 600;
		color: #f2f3f5;
	}

	.topic {
		color: #949ba4;
		font-size: 14px;
	}

	.message-area {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-y: auto;
	}

	.empty-content {
		text-align: center;
		max-width: 400px;
		padding: 32px;
	}

	.icon {
		font-size: 64px;
		margin-bottom: 16px;
	}

	h2 {
		font-size: 24px;
		font-weight: 600;
		color: #f2f3f5;
		margin-bottom: 8px;
	}

	p {
		color: #949ba4;
		font-size: 16px;
	}

	.input-bar {
		padding: 0 16px 24px;
		background: #313338;
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		background: #383a40;
		border-radius: 8px;
		padding: 0 16px;
	}

	.attach-btn {
		background: none;
		border: none;
		color: #b5bac1;
		cursor: not-allowed;
		padding: 10px 16px 10px 0;
		opacity: 0.5;
	}

	.input-wrapper input {
		flex: 1;
		background: none;
		border: none;
		color: #949ba4;
		font-size: 16px;
		padding: 11px 0;
		outline: none;
	}

	.input-wrapper input::placeholder {
		color: #6d6f78;
	}

	.input-wrapper input:disabled {
		cursor: not-allowed;
	}
</style>
