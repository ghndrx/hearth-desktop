<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { loadServers } from '$lib/stores/servers';
	import { loadDMChannels, currentChannel } from '$lib/stores/channels';
	import { isSettingsOpen, isServerSettingsOpen, settings } from '$lib/stores/settings';
	import { currentServer } from '$lib/stores/servers';
	import { popoutStore } from '$lib/stores/popout';
	import { threadStore } from '$lib/stores/thread';
	import { pinnedMessagesStore, pinnedMessagesOpen } from '$lib/stores/pinnedMessages';
	import { searchStore, isSearchOpen } from '$lib/stores/search';
	import { splitViewStore, splitViewEnabled, canAddSplitPanel } from '$lib/stores/splitView';
	import ServerList from '$lib/components/ServerList.svelte';
	import ChannelList from '$lib/components/ChannelList.svelte';
	import MemberList from '$lib/components/MemberList.svelte';
	import ThreadSidebar from '$lib/components/ThreadSidebar.svelte';
	import PinnedMessages from '$lib/components/PinnedMessages.svelte';
	import UserSettings from '$lib/components/UserSettings.svelte';
	import ServerSettings from '$lib/components/ServerSettings.svelte';
	import UserPopout from '$lib/components/UserPopout.svelte';
	import VoiceCallOverlay from '$lib/components/VoiceCallOverlay.svelte';
	import ImagePreviewModal from '$lib/components/ImagePreviewModal.svelte';
	import QuickSwitcher from '$lib/components/QuickSwitcher.svelte';
	import SearchResults from '$lib/components/SearchResults.svelte';
	import SplitView from '$lib/components/SplitView.svelte';

	let quickSwitcherOpen = false;

	function handleKeydown(e: KeyboardEvent) {
		// Don't trigger shortcuts when typing in an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			// But allow Escape to close modals
			if (e.key === 'Escape') {
				if (quickSwitcherOpen) {
					quickSwitcherOpen = false;
					e.preventDefault();
				} else if ($isSearchOpen) {
					searchStore.close();
					e.preventDefault();
				}
			}
			return;
		}

		// Ctrl+K or Cmd+K to open quick switcher
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			quickSwitcherOpen = true;
		}
		// Ctrl+F or Cmd+F to open search (when in a channel)
		if ((e.ctrlKey || e.metaKey) && e.key === 'f' && $currentChannel) {
			e.preventDefault();
			searchStore.open($currentServer?.id, $currentChannel?.id);
		}
		// FEAT-003: Alt+P to pin current channel/DM to split view
		if (e.altKey && e.key === 'p' && $currentChannel && $canAddSplitPanel) {
			e.preventDefault();
			if ($currentChannel.type === 1) {
				// DM channel
				splitViewStore.pinDM($currentChannel);
			} else if ($currentServer) {
				// Server channel
				splitViewStore.pinChannel($currentChannel, $currentServer.id);
			}
		}
		// FEAT-003: Alt+Shift+P to toggle split view
		if (e.altKey && e.shiftKey && e.key === 'P') {
			e.preventDefault();
			splitViewStore.toggle();
		}
		// Escape to close modals
		if (e.key === 'Escape') {
			if (quickSwitcherOpen) {
				quickSwitcherOpen = false;
				e.preventDefault();
			} else if ($isSearchOpen) {
				searchStore.close();
				e.preventDefault();
			}
		}
	}

	function handleQuickSwitcherOpen() {
		quickSwitcherOpen = true;
	}

	function handleSearchJumpToMessage(event: CustomEvent<{ channelId: string; messageId: string }>) {
		const { channelId, messageId } = event.detail;
		searchStore.close();
		// Navigate to the channel with the message
		if ($currentServer) {
			goto(`/channels/${$currentServer.id}/${channelId}?message=${messageId}`);
		} else {
			goto(`/channels/@me/${channelId}?message=${messageId}`);
		}
	}

	onMount(async () => {
		if (!$isAuthenticated) {
			goto('/login');
			return;
		}

		// Force load servers and DM channels on mount
		// Use await to ensure they complete before render
		await Promise.all([
			loadServers(),
			loadDMChannels()
		]);

		// Add global keyboard listener
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
	});

	$: if ($isAuthenticated === false) {
		goto('/login');
	}

	// Reload servers/channels when user becomes authenticated (fixes post-login loading)
	let previouslyAuthenticated = false;
	$: if ($isAuthenticated && !previouslyAuthenticated) {
		previouslyAuthenticated = true;
		loadServers();
		loadDMChannels();
	}

	// Handle popout events
	function handlePopoutClose() {
		popoutStore.close();
	}

	function handlePopoutMessage(event: CustomEvent<{ userId: string }>) {
		// TODO: Navigate to DM with user
		console.log('Message user:', event.detail.userId);
		popoutStore.close();
	}

	function handlePopoutCall(event: CustomEvent<{ userId: string; type: 'voice' | 'video' }>) {
		// TODO: Initiate call with user
		console.log('Call user:', event.detail.userId, event.detail.type);
		popoutStore.close();
	}

	function handlePopoutServerClick(event: CustomEvent<{ serverId: string }>) {
		// Navigate to server
		goto(`/channels/${event.detail.serverId}`);
		popoutStore.close();
	}

	function handleJumpToMessage(event: CustomEvent<{ channelId: string; messageId: string }>) {
		// Close the pinned messages panel
		pinnedMessagesStore.close();
		
		// TODO: Scroll to message in MessageList
		// For now, we just close the panel - scrolling to message would require
		// additional coordination with the MessageList component
		console.log('Jump to message:', event.detail.messageId);
	}
</script>

<div class="app-container">
	<!-- Skip link for keyboard users -->
	<a href="#main-content" class="skip-link">Skip to main content</a>
	
	<!-- Visually hidden app title for screen readers -->
	<h1 class="sr-only">Hearth Chat Application</h1>
	
	<!-- Server List - Leftmost sidebar -->
	<ServerList />

	<!-- Channel List - Second sidebar -->
	<ChannelList on:openQuickSwitcher={handleQuickSwitcherOpen} />

	<!-- Main Content with FEAT-003: Split View Container -->
	<main id="main-content" aria-label="Main content area">
		<SplitView>
			<slot />
		</SplitView>
	</main>

	<!-- Member List - Right sidebar (only in servers) -->
	{#if $currentServer}
		<MemberList />
	{/if}

	<!-- FEAT-001: Thread Sidebar - Enhanced right sidebar panel for viewing threads -->
	{#if $threadStore.currentThread}
		<ThreadSidebar />
	{/if}

	<!-- Pinned Messages - Right sidebar panel for viewing pinned messages -->
	{#if $pinnedMessagesOpen}
		<PinnedMessages on:jumpToMessage={handleJumpToMessage} />
	{/if}

	<!-- Search Results - Right sidebar panel for message search -->
	{#if $isSearchOpen}
		<SearchResults 
			on:jumpToMessage={handleSearchJumpToMessage}
			on:close={() => searchStore.close()}
		/>
	{/if}
</div>

<!-- Quick Switcher Modal (Ctrl+K) -->
<QuickSwitcher 
	bind:open={quickSwitcherOpen}
	on:close={() => quickSwitcherOpen = false}
/>

<!-- User Popout -->
{#if $popoutStore.isOpen && $popoutStore.user}
	<UserPopout
		user={$popoutStore.user}
		member={$popoutStore.member}
		position={$popoutStore.position}
		anchor={$popoutStore.anchor}
		mutualServers={$popoutStore.mutualServers}
		mutualFriends={$popoutStore.mutualFriends}
		sharedChannels={$popoutStore.sharedChannels}
		recentActivity={$popoutStore.recentActivity}
		totalMutual={$popoutStore.totalMutual}
		loading={$popoutStore.loading}
		on:close={handlePopoutClose}
		on:message={handlePopoutMessage}
		on:call={handlePopoutCall}
		on:serverClick={handlePopoutServerClick}
	/>
{/if}

{#if $isSettingsOpen}
<div class="settings-overlay-wrapper">
	<UserSettings open={$isSettingsOpen} on:close={() => settings.close()} />
</div>
{/if}

{#if $isServerSettingsOpen}
<div class="settings-overlay-wrapper">
	<ServerSettings open={$isServerSettingsOpen} on:close={() => settings.closeServerSettings()} />
</div>
{/if}

<!-- Voice Call Overlay - Floating mini-view during active calls -->
<VoiceCallOverlay />

<!-- Image Preview Modal - Full screen image viewer -->
<ImagePreviewModal />

<style>
	/* Skip link for keyboard navigation */
	.skip-link {
		position: absolute;
		top: -40px;
		left: 0;
		background: var(--brand-primary, #5865f2);
		color: white;
		padding: 8px 16px;
		z-index: 10000;
		text-decoration: none;
		font-weight: 600;
		border-radius: 0 0 4px 0;
		transition: top 0.2s;
	}

	.skip-link:focus {
		top: 0;
		outline: 2px solid white;
		outline-offset: 2px;
	}

	/* Screen reader only - visually hidden but accessible */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.settings-overlay-wrapper {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		pointer-events: auto;
	}

	/* Main app container - Discord-style horizontal layout */
	.app-container {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: #313338;
	}

	/* Ensure main content fills remaining space */
	.app-container :global(#main-content) {
		flex: 1 1 0%;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		overflow: hidden;
	}
</style>
