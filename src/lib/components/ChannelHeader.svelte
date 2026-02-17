<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { splitViewStore, canAddSplitPanel, splitViewEnabled } from '$lib/stores/splitView';
	import type { Channel } from '$lib/stores/channels';
	import Tooltip from './Tooltip.svelte';

	export let channelName: string = '';
	export let channelType: 'text' | 'voice' | 'announcement' | 'stage' | 'forum' = 'text';
	export let topic: string | null = null;
	export let isPrivate: boolean = false;
	export let memberListVisible: boolean = true;
	export let pinnedCount: number = 0;
	// FEAT-003: Split view support
	export let channel: Channel | null = null;
	export let serverId: string = '';
	
	// FEAT-003: Compute split view pin state
	$: isPinnedToSplitView = channel ? splitViewStore.isPinned(channel.id, channel.type === 1 ? 'dm' : 'channel') : false;
	$: canPinToSplitView = $splitViewEnabled && channel && ($canAddSplitPanel || isPinnedToSplitView) && channelType !== 'voice';

	const dispatch = createEventDispatcher<{
		toggleMemberList: void;
		openPinnedMessages: void;
		openSearch: void;
		openInbox: void;
		openHelp: void;
		openThreads: void;
		openNotificationSettings: void;
		pinToSplitView: void;
		unpinFromSplitView: void;
	}>();

	// Channel type icons
	const channelIcons: Record<string, string> = {
		text: '#',
		voice: '🔊',
		announcement: '📢',
		stage: '🎭',
		forum: '💬'
	};

	$: channelIcon = channelIcons[channelType] || '#';
	$: displayIcon = isPrivate ? '🔒' : channelIcon;

	function handleToggleMemberList() {
		dispatch('toggleMemberList');
	}

	function handleOpenPinnedMessages() {
		dispatch('openPinnedMessages');
	}

	function handleOpenSearch() {
		dispatch('openSearch');
	}

	function handleOpenInbox() {
		dispatch('openInbox');
	}

	function handleOpenHelp() {
		dispatch('openHelp');
	}

	function handleOpenThreads() {
		dispatch('openThreads');
	}

	function handleOpenNotificationSettings() {
		dispatch('openNotificationSettings');
	}

	// FEAT-003: Handle pin/unpin to split view
	function handleToggleSplitViewPin() {
		if (!channel) return;
		
		if (isPinnedToSplitView) {
			splitViewStore.unpinByTarget(channel.id, channel.type === 1 ? 'dm' : 'channel');
			dispatch('unpinFromSplitView');
		} else {
			if (channel.type === 1) {
				splitViewStore.pinDM(channel, serverId);
			} else {
				splitViewStore.pinChannel(channel, serverId);
			}
			dispatch('pinToSplitView');
		}
	}
</script>

<header class="channel-header" role="banner">
	<!-- Channel info section -->
	<div class="channel-info">
		<span class="channel-icon" class:private={isPrivate} aria-hidden="true">
			{displayIcon}
		</span>
		<h2 class="channel-name" id="channel-name">{channelName}</h2>

		{#if topic}
			<div class="topic-divider" aria-hidden="true"></div>
			<p class="channel-topic" title={topic} id="channel-topic">
				{topic}
			</p>
		{/if}
	</div>

	<!-- Action buttons -->
	<div class="header-actions">
		<!-- Threads (for text channels) -->
		{#if channelType === 'text' || channelType === 'announcement'}
			<Tooltip text="Threads">
				<button
					class="header-action-btn"
					on:click={handleOpenThreads}
					aria-label="Threads"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06819 17 2.01168 16.9327 2.02453 16.8593L2.33253 15.0993C2.34258 15.0419 2.39244 15 2.45074 15H6.34991L7.40991 9H3.55274C3.47819 9 3.42168 8.93274 3.43453 8.85931L3.74253 7.09931C3.75258 7.04189 3.80244 7 3.86074 7H7.75991L8.45234 3.09903C8.46251 3.04174 8.51231 3 8.57049 3H10.3267C10.4014 3 10.4579 3.06746 10.4449 3.14097L9.75991 7H15.7599L16.4523 3.09903C16.4625 3.04174 16.5123 3 16.5765 3H18.3267C18.4014 3 18.4579 3.06746 18.4449 3.14097L17.7599 7H21.6171C21.6916 7 21.7481 7.06725 21.7353 7.14069L21.4273 8.90069C21.4172 8.95811 21.3674 9 21.3091 9H17.4099L17.0495 11.03C17.8221 11.0757 18.5508 11.3589 19.1558 11.8248C20.0283 12.4992 20.5 13.4941 20.5 14.5C20.5 15.5052 20.0283 16.5008 19.1558 17.1752C18.5508 17.6411 17.8221 17.9243 17.0495 17.97L16.8053 19.3495C16.7807 19.4901 16.6588 19.5939 16.5157 19.5939H14.6343C14.5451 19.5939 14.4797 19.5123 14.4988 19.4254L14.7197 18.3495C14.0943 18.2499 13.5125 18.001 13.0134 17.6271L12.8643 18.859C12.8515 18.9325 12.7948 19 12.7203 19H6.44991L5.75748 22.901C5.74731 22.9583 5.69751 23 5.63933 23H3.88309C3.80842 23 3.75189 22.9325 3.76494 22.859L4.44991 19H4.44991L4.44991 19L4.44991 19H4.44987C4.44993 19 4.44999 19 4.45005 19L5.14234 15.099C5.15251 15.0417 5.20231 15 5.26049 15H5.26049C5.31867 15 5.36847 14.9583 5.37864 14.901L5.43309 21ZM8.34991 15L9.40991 9H15.4099L14.3499 15H8.34991Z" />
					</svg>
				</button>
			</Tooltip>
		{/if}

		<!-- FEAT-003: Pin to Split View button -->
		{#if canPinToSplitView}
			<Tooltip text={isPinnedToSplitView ? 'Unpin from Split View' : 'Pin to Split View'}>
				<button
					class="header-action-btn"
					class:pinned={isPinnedToSplitView}
					on:click={handleToggleSplitViewPin}
					aria-label={isPinnedToSplitView ? 'Unpin from Split View' : 'Pin to Split View'}
					aria-pressed={isPinnedToSplitView}
				>
					{#if isPinnedToSplitView}
						<!-- Pinned icon (filled) -->
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M19 12V10C19 9.45 18.55 9 18 9H14V4C14 3.45 13.55 3 13 3H11C10.45 3 10 3.45 10 4V9H6C5.45 9 5 9.45 5 10V12C5 12.55 5.45 13 6 13H10V21H14V13H18C18.55 13 19 12.55 19 12Z"/>
						</svg>
					{:else}
						<!-- Unpin icon (outline) -->
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 17V21M8 12V8H16V12H8Z"/>
							<path d="M18 12H6L8 8H16L18 12Z"/>
							<path d="M10 8V5C10 4.45 10.45 4 11 4H13C13.55 4 14 4.45 14 5V8"/>
						</svg>
					{/if}
				</button>
			</Tooltip>
		{/if}

		<!-- Notification settings -->
		<Tooltip text="Notification Settings">
			<button
				class="header-action-btn"
				on:click={handleOpenNotificationSettings}
				aria-label="Notification Settings"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 22C10.8954 22 10 21.1046 10 20H14C14 21.1046 13.1046 22 12 22ZM20 19H4V17L6 16V10.5C6 7.038 7.421 4.793 10 4.18V2H14V4.18C16.579 4.793 18 7.038 18 10.5V16L20 17V19Z" />
				</svg>
			</button>
		</Tooltip>

		<!-- Pinned messages -->
		<Tooltip text="Pinned Messages">
			<button
				class="header-action-btn"
				class:has-pins={pinnedCount > 0}
				on:click={handleOpenPinnedMessages}
				aria-label="Pinned Messages"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M22 12L12.101 2.10101L10.686 3.51401L12.101 4.92901L7.15096 9.87801V9.88001L5.73596 8.46501L4.32196 9.88001L8.56496 14.122L2.90796 19.778L4.32196 21.192L9.97896 15.536L14.222 19.778L15.636 18.364L14.222 16.95L19.171 12H19.172L20.586 13.414L22 12Z" />
				</svg>
				{#if pinnedCount > 0}
					<span class="pin-badge">{pinnedCount}</span>
				{/if}
			</button>
		</Tooltip>

		<!-- Member list toggle -->
		<Tooltip text={memberListVisible ? 'Hide Member List' : 'Show Member List'}>
			<button
				class="header-action-btn"
				class:active={memberListVisible}
				on:click={handleToggleMemberList}
				aria-label={memberListVisible ? 'Hide Member List' : 'Show Member List'}
				aria-pressed={memberListVisible}
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
					<path d="M20 19.006C20 16.4919 18.5683 14.4614 16.1839 13.2754C17.2174 13.7021 18.1 14.3261 18.7959 15.1061C19.6919 16.1101 20.1109 17.3301 20.0239 18.614L20 19.006Z" />
					<path d="M14 7.00598C14 9.76498 11.762 12.006 9 12.006C6.239 12.006 4 9.76498 4 7.00598C4 4.24598 6.238 2.00598 9 2.00598C11.762 2.00598 14 4.24598 14 7.00598Z" />
					<path d="M18 8.00598C18 9.38998 16.878 10.506 15.5 10.506C14.122 10.506 13 9.38998 13 8.00598C13 6.62198 14.122 5.50598 15.5 5.50598C16.878 5.50598 18 6.62198 18 8.00598Z" />
				</svg>
			</button>
		</Tooltip>

		<!-- Search divider -->
		<div class="action-divider" aria-hidden="true"></div>

		<!-- Search -->
		<div class="search-container">
			<input
				type="text"
				class="search-input"
				placeholder="Search"
				on:focus={handleOpenSearch}
				readonly
			/>
			<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
				<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
			</svg>
		</div>

		<!-- Inbox -->
		<Tooltip text="Inbox">
			<button
				class="header-action-btn"
				on:click={handleOpenInbox}
				aria-label="Inbox"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3ZM19 15H15C15 16.66 13.66 18 12 18C10.34 18 9 16.66 9 15H5V5H19V15Z" />
				</svg>
			</button>
		</Tooltip>

		<!-- Help -->
		<Tooltip text="Help">
			<button
				class="header-action-btn"
				on:click={handleOpenHelp}
				aria-label="Help"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.486 2 2 6.487 2 12C2 17.515 6.486 22 12 22C17.514 22 22 17.515 22 12C22 6.487 17.514 2 12 2ZM12 18.25C11.31 18.25 10.75 17.691 10.75 17C10.75 16.31 11.31 15.75 12 15.75C12.69 15.75 13.25 16.31 13.25 17C13.25 17.691 12.69 18.25 12 18.25ZM13 13.875V15H11V12H12C13.104 12 14 11.103 14 10C14 8.896 13.104 8 12 8C10.896 8 10 8.896 10 10H8C8 7.795 9.795 6 12 6C14.205 6 16 7.795 16 10C16 11.861 14.723 13.429 13 13.875Z" />
				</svg>
			</button>
		</Tooltip>
	</div>
</header>

<style>
	.channel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		min-height: 48px;
		padding: 0 8px 0 16px;
		background-color: var(--bg-primary, #313338);
		border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2), 0 1.5px 0 rgba(0, 0, 0, 0.05), 0 2px 0 rgba(0, 0, 0, 0.05);
		z-index: 100;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1;
	}

	.channel-icon {
		font-size: 20px;
		font-weight: 500;
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.channel-icon.private {
		font-size: 16px;
	}

	.channel-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
		line-height: 20px;
	}

	.topic-divider {
		width: 1px;
		height: 24px;
		background-color: var(--bg-modifier-accent, #4e5058);
		flex-shrink: 0;
		margin: 0 8px;
	}

	.channel-topic {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
		cursor: pointer;
		flex: 1;
		min-width: 0;
	}

	.channel-topic:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.header-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: color 0.15s ease;
		position: relative;
	}

	.header-action-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.header-action-btn.active {
		color: var(--text-normal, #f2f3f5);
	}

	.header-action-btn.has-pins {
		color: var(--text-normal, #f2f3f5);
	}

	/* FEAT-003: Split view pin button states */
	.header-action-btn.pinned {
		color: var(--brand-primary, #5865f2);
	}

	.header-action-btn.pinned:hover {
		color: var(--red, #da373c);
	}

	.header-action-btn svg {
		width: 24px;
		height: 24px;
	}

	.pin-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		background-color: var(--red, #da373c);
		border-radius: 8px;
		font-size: 10px;
		font-weight: 700;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-divider {
		width: 1px;
		height: 24px;
		background-color: var(--bg-modifier-accent, #4e5058);
		margin: 0 8px;
	}

	.search-container {
		position: relative;
		width: 144px;
	}

	.search-input {
		width: 100%;
		height: 24px;
		padding: 0 8px 0 6px;
		background-color: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		font-size: 14px;
		color: var(--text-normal, #f2f3f5);
		cursor: pointer;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.search-input:focus {
		outline: none;
		cursor: text;
	}

	.search-icon {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted, #949ba4);
		pointer-events: none;
	}

	/* Responsive: hide some actions on smaller screens */
	@media (max-width: 768px) {
		.search-container {
			display: none;
		}

		.action-divider {
			display: none;
		}

		.channel-topic {
			display: none;
		}

		.topic-divider {
			display: none;
		}
	}
</style>
