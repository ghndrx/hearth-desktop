<script lang="ts">
	import { onMount } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import {
		notificationGroups,
		groupConfig,
		unreadGroupCount,
		getAllGroups,
		markGroupRead,
		markAllGroupsRead,
		dismissGroup,
		dismissAllGroups,
		muteGroup,
		unmuteGroup,
		getGroupConfig,
		setGroupConfig,
		getGroupNotifications,
		type NotificationGroup,
		type GroupedNotification,
		type GroupConfig,
		type GroupType,
		type GroupByStrategy
	} from '$lib/stores/notificationGroups';

	let { compact = false }: { compact?: boolean } = $props();

	let expandedGroupId: string | null = $state(null);
	let expandedNotifications: GroupedNotification[] = $state([]);
	let loadingExpanded: boolean = $state(false);
	let showSettings: boolean = $state(false);
	let loading: boolean = $state(true);

	let localConfig: GroupConfig = $state({
		group_by: 'Channel',
		batch_delay_ms: 2000,
		max_group_size: 50,
		collapse_threshold: 3,
		show_preview: true
	});

	let groups = $derived($notificationGroups);
	let config = $derived($groupConfig);
	let unreadCount = $derived($unreadGroupCount);

	const groupTypeIcons: Record<GroupType, { symbol: string; label: string }> = {
		Channel: { symbol: '#', label: 'Channel' },
		Server: { symbol: '\u{1F310}', label: 'Server' },
		DirectMessage: { symbol: '@', label: 'Direct Message' },
		Mention: { symbol: '@!', label: 'Mention' },
		System: { symbol: '\u2699', label: 'System' }
	};

	function getGroupIcon(type: GroupType): string {
		return groupTypeIcons[type]?.symbol ?? '#';
	}

	function formatTimestamp(epochMs: number): string {
		const date = new Date(epochMs);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHour / 24);

		if (diffSec < 60) return 'Just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHour < 24) return `${diffHour}h ago`;
		if (diffDay < 7) return `${diffDay}d ago`;
		return date.toLocaleDateString();
	}

	async function toggleGroup(group: NotificationGroup) {
		if (expandedGroupId === group.id) {
			expandedGroupId = null;
			expandedNotifications = [];
			return;
		}

		expandedGroupId = group.id;
		loadingExpanded = true;
		try {
			const result = await getGroupNotifications(group.id);
			expandedNotifications = result.notifications;
		} catch {
			expandedNotifications = [];
		} finally {
			loadingExpanded = false;
		}
	}

	async function handleMarkGroupRead(e: MouseEvent, groupId: string) {
		e.stopPropagation();
		await markGroupRead(groupId);
	}

	async function handleMuteToggle(e: MouseEvent, group: NotificationGroup) {
		e.stopPropagation();
		if (group.is_muted) {
			await unmuteGroup(group.id);
		} else {
			await muteGroup(group.id);
		}
	}

	async function handleDismissGroup(e: MouseEvent, groupId: string) {
		e.stopPropagation();
		if (expandedGroupId === groupId) {
			expandedGroupId = null;
			expandedNotifications = [];
		}
		await dismissGroup(groupId);
	}

	async function handleMarkAllRead() {
		await markAllGroupsRead();
	}

	async function handleDismissAll() {
		expandedGroupId = null;
		expandedNotifications = [];
		await dismissAllGroups();
	}

	function openSettings() {
		if (config) {
			localConfig = { ...config };
		}
		showSettings = !showSettings;
	}

	async function saveSettings() {
		await setGroupConfig(localConfig);
		showSettings = false;
		await getAllGroups();
	}

	function cancelSettings() {
		showSettings = false;
	}

	onMount(async () => {
		loading = true;
		try {
			await getAllGroups();
			await getGroupConfig();
		} catch {
			// Failed to load
		} finally {
			loading = false;
		}
	});
</script>

<div
	class="notification-group-panel flex flex-col h-full bg-[#2b2d31] text-[#f2f3f5] rounded-lg overflow-hidden"
	class:compact
	role="region"
	aria-label="Notification Groups"
>
	<!-- Header -->
	<header class="flex items-center justify-between px-4 py-3 border-b border-[#1e1f22]">
		<div class="flex items-center gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-[#b5bac1]">Notifications</h2>
			{#if unreadCount > 0}
				<span
					class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-[#ed4245] text-white rounded-full"
				>
					{unreadCount}
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			{#if groups.length > 0}
				<button
					class="px-2 py-1 text-xs text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
					onclick={handleMarkAllRead}
					aria-label="Mark all groups as read"
				>
					Mark All Read
				</button>
				<button
					class="px-2 py-1 text-xs text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
					onclick={handleDismissAll}
					aria-label="Dismiss all groups"
				>
					Dismiss All
				</button>
			{/if}
			<button
				class="p-1.5 text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
				onclick={openSettings}
				aria-label="Group settings"
				title="Group settings"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</button>
		</div>
	</header>

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="px-4 py-3 border-b border-[#1e1f22] bg-[#232428]" transition:slide={{ duration: 200 }}>
			<h3 class="text-xs font-semibold uppercase tracking-wide text-[#b5bac1] mb-3">
				Group Configuration
			</h3>

			<div class="space-y-3">
				<div>
					<label class="block text-xs text-[#b5bac1] mb-1" for="group-by-select">Group By</label>
					<select
						id="group-by-select"
						class="w-full text-xs bg-[#1e1f22] text-[#f2f3f5] border border-[#3f4147] rounded px-2 py-1.5 focus:outline-none focus:border-[#5865f2]"
						bind:value={localConfig.group_by}
					>
						<option value="Channel">Channel</option>
						<option value="Server">Server</option>
						<option value="Type">Type</option>
					</select>
				</div>

				<div>
					<label class="block text-xs text-[#b5bac1] mb-1" for="batch-delay-input">
						Batch Delay (ms)
					</label>
					<input
						id="batch-delay-input"
						type="number"
						min="0"
						max="30000"
						step="500"
						class="w-full text-xs bg-[#1e1f22] text-[#f2f3f5] border border-[#3f4147] rounded px-2 py-1.5 focus:outline-none focus:border-[#5865f2]"
						bind:value={localConfig.batch_delay_ms}
					/>
				</div>

				<div>
					<label class="block text-xs text-[#b5bac1] mb-1" for="max-group-size-input">
						Max Group Size
					</label>
					<input
						id="max-group-size-input"
						type="number"
						min="1"
						max="200"
						class="w-full text-xs bg-[#1e1f22] text-[#f2f3f5] border border-[#3f4147] rounded px-2 py-1.5 focus:outline-none focus:border-[#5865f2]"
						bind:value={localConfig.max_group_size}
					/>
				</div>

				<div>
					<label class="block text-xs text-[#b5bac1] mb-1" for="collapse-threshold-input">
						Collapse Threshold
					</label>
					<input
						id="collapse-threshold-input"
						type="number"
						min="1"
						max="50"
						class="w-full text-xs bg-[#1e1f22] text-[#f2f3f5] border border-[#3f4147] rounded px-2 py-1.5 focus:outline-none focus:border-[#5865f2]"
						bind:value={localConfig.collapse_threshold}
					/>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="show-preview-check"
						type="checkbox"
						class="accent-[#5865f2]"
						bind:checked={localConfig.show_preview}
					/>
					<label class="text-xs text-[#b5bac1]" for="show-preview-check">Show Preview</label>
				</div>

				<div class="flex items-center gap-2 pt-1">
					<button
						class="px-3 py-1.5 text-xs font-medium bg-[#5865f2] hover:bg-[#4752c4] text-white rounded transition-colors"
						onclick={saveSettings}
					>
						Save
					</button>
					<button
						class="px-3 py-1.5 text-xs text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
						onclick={cancelSettings}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Group List -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center h-32">
				<div
					class="animate-spin rounded-full h-8 w-8 border-2 border-[#3f4147] border-t-[#5865f2]"
				></div>
			</div>
		{:else if groups.length === 0}
			<!-- Empty State -->
			<div class="flex flex-col items-center justify-center h-48 text-[#b5bac1]">
				<svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
				<p class="text-sm font-medium">No notifications</p>
				<p class="text-xs mt-1 opacity-60">You're all caught up!</p>
			</div>
		{:else}
			{#each groups as group (group.id)}
				{@const isExpanded = expandedGroupId === group.id}
				<div
					class="border-b border-[#1e1f22] last:border-b-0"
					class:opacity-60={group.is_muted}
					transition:fade={{ duration: 150 }}
				>
					<!-- Group Row -->
					<button
						class="w-full flex items-center gap-3 px-4 py-2.5 bg-[#313338] hover:bg-[#383a40] transition-colors text-left"
						class:border-l-2={!group.is_read}
						class:border-l-[#5865f2]={!group.is_read}
						onclick={() => toggleGroup(group)}
						aria-expanded={isExpanded}
					>
						<!-- Group Type Icon -->
						<div
							class="flex-shrink-0 w-8 h-8 rounded-full bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] text-sm font-bold"
						>
							{getGroupIcon(group.group_type)}
						</div>

						<!-- Group Info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span
									class="text-sm font-medium truncate"
									class:text-[#f2f3f5]={!group.is_read}
									class:text-[#b5bac1]={group.is_read}
								>
									{group.title}
								</span>
								{#if group.is_muted}
									<svg
										class="w-3.5 h-3.5 text-[#b5bac1] flex-shrink-0"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
										/>
									</svg>
								{/if}
							</div>
							{#if !compact && config?.show_preview !== false}
								<p class="text-xs text-[#b5bac1] truncate mt-0.5">
									<span class="font-medium text-[#dcdee1]">{group.latest_sender}:</span>
									{group.latest_content}
								</p>
							{/if}
						</div>

						<!-- Count Badge -->
						{#if group.count > 1}
							<span
								class="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full"
								class:bg-[#ed4245]={!group.is_read}
								class:text-white={!group.is_read}
								class:bg-[#3f4147]={group.is_read}
								class:text-[#b5bac1]={group.is_read}
							>
								{group.count}
							</span>
						{/if}

						<!-- Timestamp -->
						<span class="flex-shrink-0 text-xs text-[#b5bac1]">
							{formatTimestamp(group.updated_at)}
						</span>

						<!-- Expand Arrow -->
						<svg
							class="w-4 h-4 text-[#b5bac1] flex-shrink-0 transition-transform duration-200"
							class:rotate-90={isExpanded}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>

					<!-- Group Actions (shown on hover via CSS) -->
					<div
						class="group-actions flex items-center gap-1 px-4 py-1.5 bg-[#2b2d31] border-t border-[#1e1f22]"
					>
						{#if !group.is_read}
							<button
								class="px-2 py-0.5 text-xs text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
								onclick={(e) => handleMarkGroupRead(e, group.id)}
							>
								Mark Read
							</button>
						{/if}
						<button
							class="px-2 py-0.5 text-xs text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#383a40] rounded transition-colors"
							onclick={(e) => handleMuteToggle(e, group)}
						>
							{group.is_muted ? 'Unmute' : 'Mute'}
						</button>
						<button
							class="px-2 py-0.5 text-xs text-[#ed4245] hover:text-white hover:bg-[#ed4245]/20 rounded transition-colors"
							onclick={(e) => handleDismissGroup(e, group.id)}
						>
							Dismiss
						</button>
					</div>

					<!-- Expanded Notifications -->
					{#if isExpanded}
						<div
							class="bg-[#2b2d31] border-t border-[#1e1f22]"
							transition:slide={{ duration: 200 }}
						>
							{#if loadingExpanded}
								<div class="flex items-center justify-center py-4">
									<div
										class="animate-spin rounded-full h-5 w-5 border-2 border-[#3f4147] border-t-[#5865f2]"
									></div>
								</div>
							{:else if expandedNotifications.length === 0}
								<p class="text-xs text-[#b5bac1] text-center py-4">No notifications in this group</p>
							{:else}
								{#each expandedNotifications as notif (notif.id)}
									<div
										class="flex items-start gap-3 px-6 py-2 hover:bg-[#313338] transition-colors"
										class:border-l-2={!notif.is_read}
										class:border-l-[#5865f2]={!notif.is_read}
									>
										<!-- Sender Avatar or Placeholder -->
										{#if notif.sender_avatar}
											<img
												src={notif.sender_avatar}
												alt={notif.sender_name}
												class="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
											/>
										{:else}
											<div
												class="w-6 h-6 rounded-full bg-[#5865f2] flex items-center justify-center flex-shrink-0 mt-0.5"
											>
												<span class="text-xs font-bold text-white">
													{notif.sender_name.charAt(0).toUpperCase()}
												</span>
											</div>
										{/if}

										<div class="flex-1 min-w-0">
											<div class="flex items-baseline gap-2">
												<span class="text-xs font-medium text-[#f2f3f5]">
													{notif.sender_name}
												</span>
												<span class="text-[10px] text-[#b5bac1]">
													{formatTimestamp(notif.created_at)}
												</span>
											</div>
											<p class="text-xs text-[#b5bac1] mt-0.5 break-words">
												{notif.content}
											</p>
										</div>

										{#if !notif.is_read}
											<div class="w-2 h-2 rounded-full bg-[#5865f2] flex-shrink-0 mt-1.5"></div>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Footer -->
	{#if groups.length > 0}
		<footer class="px-4 py-2 border-t border-[#1e1f22] flex items-center justify-between">
			<span class="text-[10px] text-[#b5bac1]">
				{groups.length} group{groups.length !== 1 ? 's' : ''}
			</span>
			{#if config}
				<span class="text-[10px] text-[#b5bac1]">
					Grouped by {config.group_by}
				</span>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.notification-group-panel {
		min-height: 200px;
		max-height: 600px;
	}

	.notification-group-panel.compact {
		max-height: 400px;
	}

	.notification-group-panel ::-webkit-scrollbar {
		width: 6px;
	}

	.notification-group-panel ::-webkit-scrollbar-track {
		background: transparent;
	}

	.notification-group-panel ::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
	}

	.notification-group-panel ::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.25);
	}
</style>
