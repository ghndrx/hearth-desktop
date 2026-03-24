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
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import NotificationCenterPanel from '$lib/components/NotificationCenterPanel.svelte';
	import FavoriteChannelsPanel from '$lib/components/FavoriteChannelsPanel.svelte';
	import LinkInspectorPanel from '$lib/components/LinkInspectorPanel.svelte';
	import AutoUpdaterPanel from '$lib/components/AutoUpdaterPanel.svelte';
	import SpellCheckPanel from '$lib/components/SpellCheckPanel.svelte';
	import GlobalMediaPanel from '$lib/components/GlobalMediaPanel.svelte';
	import ProxySettingsPanel from '$lib/components/ProxySettingsPanel.svelte';
	import NativeNotificationPrefsPanel from '$lib/components/NativeNotificationPrefsPanel.svelte';
	import TextExpanderPanel from '$lib/components/TextExpanderPanel.svelte';
	import ClipManagerPanel from '$lib/components/ClipManagerPanel.svelte';
	import SysDashboardPanel from '$lib/components/SysDashboardPanel.svelte';
	import FileQuickSharePanel from '$lib/components/FileQuickSharePanel.svelte';
	import ScreenCapturePanel from '$lib/components/ScreenCapturePanel.svelte';
	import WorkspaceSwitcherPanel from '$lib/components/WorkspaceSwitcherPanel.svelte';
	import IpGeoPanel from '$lib/components/IpGeoPanel.svelte';
	import BrightnessPanel from '$lib/components/BrightnessPanel.svelte';
	import VolumeControlPanel from '$lib/components/VolumeControlPanel.svelte';
	import HttpTesterPanel from '$lib/components/HttpTesterPanel.svelte';
	import GameLibraryPanel from '$lib/components/GameLibraryPanel.svelte';

	let quickSwitcherOpen = false;
	let notificationCenterOpen = false;
	let favoritesOpen = false;
	let linkInspectorOpen = false;
	let autoUpdaterOpen = false;
	let spellCheckOpen = false;
	let globalMediaOpen = false;
	let proxySettingsOpen = false;
	let notificationPrefsOpen = false;
	let textExpanderOpen = false;
	let clipManagerOpen = false;
	let sysDashboardOpen = false;
	let fileQuickShareOpen = false;
	let screenCaptureOpen = false;
	let workspaceSwitcherOpen = false;
	let ipGeoOpen = false;
	let brightnessOpen = false;
	let volumeControlOpen = false;
	let httpTesterOpen = false;
	let gameLibraryOpen = false;

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
		// Ctrl+Shift+F to open favorites
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
			e.preventDefault();
			favoritesOpen = !favoritesOpen;
		}
		// Ctrl+Shift+L to open link inspector
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
			e.preventDefault();
			linkInspectorOpen = !linkInspectorOpen;
		}
		// Ctrl+Shift+U to open auto updater
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
			e.preventDefault();
			autoUpdaterOpen = !autoUpdaterOpen;
		}
		// Ctrl+Shift+; to open spell check
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ':') {
			e.preventDefault();
			spellCheckOpen = !spellCheckOpen;
		}
		// Ctrl+Shift+M to open global media controls
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
			e.preventDefault();
			globalMediaOpen = !globalMediaOpen;
		}
		// Ctrl+Shift+E to open text expander
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
			e.preventDefault();
			textExpanderOpen = !textExpanderOpen;
		}
		// Ctrl+Shift+B to open clipboard manager
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
			e.preventDefault();
			clipManagerOpen = !clipManagerOpen;
		}
		// Ctrl+Shift+D to open system dashboard
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
			e.preventDefault();
			sysDashboardOpen = !sysDashboardOpen;
		}
		// Ctrl+Shift+Q to open file quick share
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Q') {
			e.preventDefault();
			fileQuickShareOpen = !fileQuickShareOpen;
		}
		// Ctrl+Shift+Y to open screen capture
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Y') {
			e.preventDefault();
			screenCaptureOpen = !screenCaptureOpen;
		}
		// Ctrl+Shift+W to open workspace switcher
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
			e.preventDefault();
			workspaceSwitcherOpen = !workspaceSwitcherOpen;
		}
		// Ctrl+Shift+G to open IP geolocation
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
			e.preventDefault();
			ipGeoOpen = !ipGeoOpen;
		}
		// Ctrl+Shift+J to open brightness control
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
			e.preventDefault();
			brightnessOpen = !brightnessOpen;
		}
		// Ctrl+Shift+V to open volume control
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
			e.preventDefault();
			volumeControlOpen = !volumeControlOpen;
		}
		// Ctrl+Shift+H to open HTTP tester
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
			e.preventDefault();
			httpTesterOpen = !httpTesterOpen;
		}
		// Ctrl+Shift+R to open game library
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
			e.preventDefault();
			gameLibraryOpen = !gameLibraryOpen;
		}
		// Escape to close modals
		if (e.key === 'Escape') {
			if (gameLibraryOpen) {
				gameLibraryOpen = false;
				e.preventDefault();
			} else if (httpTesterOpen) {
				httpTesterOpen = false;
				e.preventDefault();
			} else if (volumeControlOpen) {
				volumeControlOpen = false;
				e.preventDefault();
			} else if (brightnessOpen) {
				brightnessOpen = false;
				e.preventDefault();
			} else if (ipGeoOpen) {
				ipGeoOpen = false;
				e.preventDefault();
			} else if (workspaceSwitcherOpen) {
				workspaceSwitcherOpen = false;
				e.preventDefault();
			} else if (screenCaptureOpen) {
				screenCaptureOpen = false;
				e.preventDefault();
			} else if (fileQuickShareOpen) {
				fileQuickShareOpen = false;
				e.preventDefault();
			} else if (sysDashboardOpen) {
				sysDashboardOpen = false;
				e.preventDefault();
			} else if (clipManagerOpen) {
				clipManagerOpen = false;
				e.preventDefault();
			} else if (textExpanderOpen) {
				textExpanderOpen = false;
				e.preventDefault();
			} else if (autoUpdaterOpen) {
				autoUpdaterOpen = false;
				e.preventDefault();
			} else if (spellCheckOpen) {
				spellCheckOpen = false;
				e.preventDefault();
			} else if (globalMediaOpen) {
				globalMediaOpen = false;
				e.preventDefault();
			} else if (proxySettingsOpen) {
				proxySettingsOpen = false;
				e.preventDefault();
			} else if (notificationPrefsOpen) {
				notificationPrefsOpen = false;
				e.preventDefault();
			} else if (linkInspectorOpen) {
				linkInspectorOpen = false;
				e.preventDefault();
			} else if (favoritesOpen) {
				favoritesOpen = false;
				e.preventDefault();
			} else if (quickSwitcherOpen) {
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

<!-- Command Palette (Ctrl+.) -->
<CommandPalette />

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

<!-- Notification Center Panel -->
<NotificationCenterPanel
	bind:open={notificationCenterOpen}
	onClose={() => notificationCenterOpen = false}
/>

<!-- Favorite Channels Panel (Ctrl+Shift+F) -->
<FavoriteChannelsPanel
	bind:open={favoritesOpen}
	onClose={() => favoritesOpen = false}
/>

<!-- Link Inspector Panel (Ctrl+Shift+I) -->
<LinkInspectorPanel
	bind:open={linkInspectorOpen}
	onClose={() => linkInspectorOpen = false}
/>

<!-- Auto Updater Panel (Ctrl+Shift+U) -->
<AutoUpdaterPanel
	bind:open={autoUpdaterOpen}
	onClose={() => autoUpdaterOpen = false}
/>

<!-- Spell Check Panel (Ctrl+Shift+;) -->
<SpellCheckPanel
	bind:open={spellCheckOpen}
	onClose={() => spellCheckOpen = false}
/>

<!-- Global Media Controls (Ctrl+Shift+M) -->
<GlobalMediaPanel
	bind:open={globalMediaOpen}
	onClose={() => globalMediaOpen = false}
/>

<!-- Proxy Settings Panel -->
<ProxySettingsPanel
	bind:open={proxySettingsOpen}
	onClose={() => proxySettingsOpen = false}
/>

<!-- Native Notification Preferences Panel -->
<NativeNotificationPrefsPanel
	bind:open={notificationPrefsOpen}
	onClose={() => notificationPrefsOpen = false}
/>

<!-- Text Expander Panel (Ctrl+Shift+E) -->
<TextExpanderPanel
	bind:open={textExpanderOpen}
	onClose={() => textExpanderOpen = false}
/>

<!-- Clipboard Manager Panel (Ctrl+Shift+B) -->
<ClipManagerPanel
	bind:open={clipManagerOpen}
	onClose={() => clipManagerOpen = false}
/>

<!-- System Dashboard Panel (Ctrl+Shift+D) -->
<SysDashboardPanel
	bind:open={sysDashboardOpen}
	onClose={() => sysDashboardOpen = false}
/>

<!-- File Quick Share Panel (Ctrl+Shift+Q) -->
<FileQuickSharePanel
	bind:open={fileQuickShareOpen}
	onClose={() => fileQuickShareOpen = false}
/>

<!-- Screen Capture Panel (Ctrl+Shift+Y) -->
<ScreenCapturePanel
	bind:open={screenCaptureOpen}
	onClose={() => screenCaptureOpen = false}
/>

<!-- Workspace Switcher Panel (Ctrl+Shift+W) -->
<WorkspaceSwitcherPanel
	bind:open={workspaceSwitcherOpen}
	onClose={() => workspaceSwitcherOpen = false}
/>

<!-- IP Geolocation Panel (Ctrl+Shift+G) -->
<IpGeoPanel
	bind:open={ipGeoOpen}
	onClose={() => ipGeoOpen = false}
/>

<!-- Brightness Control Panel (Ctrl+Shift+J) -->
<BrightnessPanel
	bind:open={brightnessOpen}
	onClose={() => brightnessOpen = false}
/>

<!-- Volume Control Panel (Ctrl+Shift+V) -->
<VolumeControlPanel
	bind:open={volumeControlOpen}
	onClose={() => volumeControlOpen = false}
/>

<!-- HTTP Request Tester (Ctrl+Shift+H) -->
<HttpTesterPanel
	bind:open={httpTesterOpen}
	onClose={() => httpTesterOpen = false}
/>

<!-- Game Library Panel (Ctrl+Shift+R) -->
<GameLibraryPanel
	bind:open={gameLibraryOpen}
	onClose={() => gameLibraryOpen = false}
/>

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
