<script lang="ts">
	import { onMount } from 'svelte';
	import { servers, currentServer, loadServerChannels } from '$stores';
	import { isInVoiceCall, voiceCallChannel } from '$lib/stores/voiceCall';
	import type { Server } from '$lib/stores/servers';
	import { mentions, unreadMentionCount } from '$lib/stores/mentions';
	import MentionsPanel from './MentionsPanel.svelte';

	let showMentionsPanel = false;

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function selectServer(server: Server) {
		currentServer.set(server);
		loadServerChannels(server.id);
	}

	function toggleMentionsPanel() {
		showMentionsPanel = !showMentionsPanel;
	}

	function closeMentionsPanel() {
		showMentionsPanel = false;
	}

	onMount(() => {
		// Load initial mention count
		mentions.getUnreadCount();
	});
</script>

<aside class="w-[72px] bg-dark-950 flex flex-col items-center py-3 gap-2 shrink-0" role="navigation" aria-label="Server navigation">
	<!-- Home/DM button -->
	<button
		class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
		       flex items-center justify-center transition-all duration-200 group
		       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hearth-500"
		on:click={() => currentServer.set(null)}
		class:bg-hearth-500={!$currentServer}
		class:rounded-[16px]={!$currentServer}
		aria-label="Direct Messages"
		aria-current={!$currentServer ? 'page' : undefined}
		title="Direct Messages"
		type="button"
	>
		<svg
			class="w-7 h-7 text-gray-400 group-hover:text-white transition-colors"
			class:text-white={!$currentServer}
			fill="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
		</svg>
	</button>

	<!-- Voice connected indicator -->
	{#if $isInVoiceCall}
		<div class="w-10 h-1 bg-green-500 rounded-full animate-pulse" title="Voice Connected: {$voiceCallChannel || 'Unknown'}"></div>
	{/if}

	<div class="w-8 h-0.5 bg-dark-700 rounded-full my-1" role="separator"></div>

	<!-- Server list -->
	{#each $servers as server (server.id)}
		<button
			class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
			       flex items-center justify-center transition-all duration-200 relative group
			       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hearth-500"
			class:bg-hearth-500={$currentServer?.id === server.id}
			class:rounded-[16px]={$currentServer?.id === server.id}
			on:click={() => selectServer(server)}
			aria-label={server.name}
			aria-current={$currentServer?.id === server.id ? 'page' : undefined}
			type="button"
		>
			{#if server.icon}
				<img
					src={server.icon}
					alt={server.name}
					class="w-full h-full rounded-inherit object-cover"
				/>
			{:else}
				<span class="text-sm font-medium text-gray-300 group-hover:text-white">
					{getInitials(server.name)}
				</span>
			{/if}

			<!-- Active indicator -->
			{#if $currentServer?.id === server.id}
				<div class="absolute left-0 w-1 h-10 bg-white rounded-r-full -translate-x-3"></div>
			{/if}

			<!-- Tooltip -->
			<div
				class="absolute left-full ml-4 px-3 py-2 bg-dark-900 text-white text-sm rounded-md
				       opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
				       transition-opacity duration-150 shadow-lg"
				role="tooltip"
			>
				{server.name}
			</div>
		</button>
	{/each}

	<!-- Add server button -->
	<button
		class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-green-600 hover:rounded-[16px]
		       flex items-center justify-center transition-all duration-200 group
		       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
		aria-label="Add a Server"
		title="Add a Server"
		type="button"
	>
		<svg
			class="w-6 h-6 text-green-500 group-hover:text-white transition-colors"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
	</button>

	<div class="w-8 h-0.5 bg-dark-700 rounded-full my-1" role="separator"></div>

	<!-- Mentions button -->
	<div class="relative">
		<button
			class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
			       flex items-center justify-center transition-all duration-200 group relative
			       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hearth-500"
			class:bg-hearth-500={showMentionsPanel}
			class:rounded-[16px]={showMentionsPanel}
			on:click={toggleMentionsPanel}
			aria-label="Mentions"
			aria-expanded={showMentionsPanel}
			title="Mentions"
			type="button"
		>
			<svg
				class="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"
				class:text-white={showMentionsPanel}
				fill="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
			</svg>

			<!-- Unread badge -->
			{#if $unreadMentionCount > 0}
				<span
					class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white
					       text-xs font-bold rounded-full flex items-center justify-center px-1"
					aria-label="{$unreadMentionCount} unread mentions"
				>
					{$unreadMentionCount > 99 ? '99+' : $unreadMentionCount}
				</span>
			{/if}
		</button>

		<!-- Mentions Panel Popover -->
		{#if showMentionsPanel}
			<div class="absolute left-full ml-4 bottom-0 z-50">
				<MentionsPanel show={showMentionsPanel} />
			</div>
			<!-- Click outside to close -->
			<button
				class="fixed inset-0 z-40 cursor-default"
				on:click={closeMentionsPanel}
				aria-label="Close mentions panel"
				type="button"
			></button>
		{/if}
	</div>
</aside>
