<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import {
		notifications,
		unreadCount,
		hasUnread,
		type Notification
	} from '$lib/stores/notifications';
	import { goto } from '$app/navigation';

	export let open = false;
	export let onClose: () => void = () => {};

	type FilterTab = 'all' | 'mentions' | 'dms' | 'servers' | 'system';

	let activeTab: FilterTab = 'all';
	let dndActive = false;
	let panelRef: HTMLDivElement;
	let unlisteners: UnlistenFn[] = [];

	$: notificationList = $notifications.notifications;
	$: loading = $notifications.loading;

	$: filteredNotifications = filterNotifications(notificationList, activeTab);
	$: groupedNotifications = groupByDate(filteredNotifications);

	function filterNotifications(items: Notification[], tab: FilterTab): Notification[] {
		switch (tab) {
			case 'mentions':
				return items.filter(n => n.type === 'mention' || n.type === 'reply');
			case 'dms':
				return items.filter(n => n.type === 'direct_message');
			case 'servers':
				return items.filter(n => n.server_id != null);
			case 'system':
				return items.filter(
					n =>
						n.type === 'friend_request' ||
						n.type === 'friend_accept' ||
						n.type === 'server_invite' ||
						n.type === 'server_join' ||
						n.type === 'system'
				);
			default:
				return items;
		}
	}

	interface DateGroup {
		label: string;
		items: Notification[];
	}

	function groupByDate(items: Notification[]): DateGroup[] {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterday = new Date(today.getTime() - 86400000);
		const weekAgo = new Date(today.getTime() - 7 * 86400000);

		const groups: Record<string, Notification[]> = {};

		for (const item of items) {
			const date = new Date(item.created_at);
			let label: string;

			if (date >= today) {
				label = 'Today';
			} else if (date >= yesterday) {
				label = 'Yesterday';
			} else if (date >= weekAgo) {
				label = 'This Week';
			} else {
				label = 'Older';
			}

			if (!groups[label]) groups[label] = [];
			groups[label].push(item);
		}

		const order = ['Today', 'Yesterday', 'This Week', 'Older'];
		return order.filter(l => groups[l]).map(label => ({ label, items: groups[label] }));
	}

	function getNotificationIcon(type: string): string {
		switch (type) {
			case 'mention':
				return '@';
			case 'reply':
				return '\u21A9';
			case 'direct_message':
				return '\uD83D\uDCAC';
			case 'friend_request':
				return '\uD83D\uDC4B';
			case 'friend_accept':
				return '\uD83E\uDD1D';
			case 'server_invite':
				return '\uD83D\uDCE8';
			case 'server_join':
				return '\uD83D\uDC65';
			case 'reaction':
				return '\u2764\uFE0F';
			default:
				return '\uD83D\uDD14';
		}
	}

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;

		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;

		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function handleNotificationClick(notification: Notification) {
		if (!notification.read) {
			notifications.markAsRead(notification.id);
		}

		if (notification.channel_id) {
			if (notification.server_id) {
				goto(`/channels/${notification.server_id}/${notification.channel_id}`);
			} else {
				goto(`/channels/@me/${notification.channel_id}`);
			}
		}

		onClose();
	}

	async function toggleDnd() {
		dndActive = !dndActive;
		try {
			await invoke('set_notification_dnd', { active: dndActive });
		} catch {
			dndActive = !dndActive;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	const tabs: { id: FilterTab; label: string; countFn: (items: Notification[]) => number }[] = [
		{ id: 'all', label: 'All', countFn: (items) => items.filter(n => !n.read).length },
		{
			id: 'mentions',
			label: 'Mentions',
			countFn: (items) =>
				items.filter(n => !n.read && (n.type === 'mention' || n.type === 'reply')).length
		},
		{
			id: 'dms',
			label: 'DMs',
			countFn: (items) =>
				items.filter(n => !n.read && n.type === 'direct_message').length
		},
		{
			id: 'servers',
			label: 'Servers',
			countFn: (items) => items.filter(n => !n.read && n.server_id != null).length
		},
		{
			id: 'system',
			label: 'System',
			countFn: (items) =>
				items.filter(
					n =>
						!n.read &&
						['friend_request', 'friend_accept', 'server_invite', 'server_join', 'system'].includes(
							n.type
						)
				).length
		}
	];

	onMount(async () => {
		notifications.loadNotifications(true);

		try {
			const unlisten = await listen('notification:dnd-changed', (event) => {
				dndActive = event.payload as boolean;
			});
			unlisteners.push(unlisten);
		} catch {
			// Not in Tauri context
		}
	});

	onDestroy(() => {
		for (const unlisten of unlisteners) {
			unlisten();
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="panel-backdrop"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
		role="presentation"
	>
		<div
			class="panel"
			bind:this={panelRef}
			transition:fly={{ x: 320, duration: 250 }}
			role="dialog"
			aria-label="Notification Center"
		>
			<!-- Header -->
			<div class="panel-header">
				<div class="header-top">
					<h2>Notification Center</h2>
					<div class="header-actions">
						<button
							class="dnd-toggle"
							class:active={dndActive}
							on:click={toggleDnd}
							title={dndActive ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
							aria-pressed={dndActive}
						>
							{#if dndActive}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
									<path
										d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0112 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0112 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"
									/>
								</svg>
							{:else}
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
									<path d="M13.73 21a2 2 0 0 1-3.46 0" />
								</svg>
							{/if}
						</button>
						<button class="close-btn" on:click={onClose} aria-label="Close notification center">
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				{#if $hasUnread}
					<button class="mark-all-btn" on:click={() => notifications.markAllAsRead()}>
						Mark all as read ({$unreadCount})
					</button>
				{/if}

				{#if dndActive}
					<div class="dnd-banner">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0112 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0112 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"
							/>
						</svg>
						<span>Do Not Disturb is on</span>
					</div>
				{/if}
			</div>

			<!-- Filter Tabs -->
			<div class="tabs" role="tablist">
				{#each tabs as tab}
					{@const count = tab.countFn(notificationList)}
					<button
						class="tab"
						class:active={activeTab === tab.id}
						on:click={() => (activeTab = tab.id)}
						role="tab"
						aria-selected={activeTab === tab.id}
					>
						{tab.label}
						{#if count > 0}
							<span class="tab-badge">{count > 99 ? '99+' : count}</span>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Notification List -->
			<div class="notification-scroll">
				{#if loading && filteredNotifications.length === 0}
					<div class="empty-state">
						<div class="spinner"></div>
						<p>Loading notifications...</p>
					</div>
				{:else if filteredNotifications.length === 0}
					<div class="empty-state">
						<svg
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
						<p>No {activeTab === 'all' ? '' : activeTab + ' '}notifications</p>
					</div>
				{:else}
					{#each groupedNotifications as group}
						<div class="date-group">
							<div class="date-label">{group.label}</div>
							{#each group.items as notification (notification.id)}
								<button
									class="notification-row"
									class:unread={!notification.read}
									on:click={() => handleNotificationClick(notification)}
								>
									<div class="notif-icon">
										{#if notification.actor_avatar}
											<img
												src={notification.actor_avatar}
												alt=""
												class="notif-avatar"
											/>
										{:else}
											<span class="notif-icon-text"
												>{getNotificationIcon(notification.type)}</span
											>
										{/if}
									</div>
									<div class="notif-body">
										<div class="notif-title">{notification.title}</div>
										<div class="notif-text">{notification.body}</div>
										<div class="notif-meta">
											{#if notification.server_name}
												<span class="meta-server">{notification.server_name}</span>
												{#if notification.channel_name}
													<span class="meta-sep">&middot;</span>
													<span class="meta-channel"
														>#{notification.channel_name}</span
													>
												{/if}
												<span class="meta-sep">&middot;</span>
											{/if}
											<span class="meta-time"
												>{formatTime(notification.created_at)}</span
											>
										</div>
									</div>
									{#if !notification.read}
										<div class="unread-indicator" aria-label="Unread"></div>
									{/if}
								</button>
							{/each}
						</div>
					{/each}

					{#if $notifications.hasMore}
						<button
							class="load-more-btn"
							on:click={() => notifications.loadNotifications()}
							disabled={loading}
						>
							{loading ? 'Loading...' : 'Load more'}
						</button>
					{/if}
				{/if}
			</div>

			<!-- Footer -->
			{#if notificationList.some((n) => n.read)}
				<div class="panel-footer">
					<button class="clear-btn" on:click={() => notifications.deleteAllRead()}>
						Clear read notifications
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 9999;
		display: flex;
		justify-content: flex-end;
	}

	.panel {
		width: 420px;
		max-width: 100vw;
		height: 100%;
		background: var(--bg-primary, #313338);
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		padding: 20px 20px 12px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-top h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary, #f2f3f5);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.dnd-toggle,
	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 6px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		transition: color 0.15s, background-color 0.15s;
	}

	.dnd-toggle:hover,
	.close-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.dnd-toggle.active {
		color: var(--status-danger, #f23f43);
	}

	.mark-all-btn {
		margin-top: 8px;
		background: none;
		border: none;
		color: var(--brand-primary, #5865f2);
		font-size: 13px;
		cursor: pointer;
		padding: 4px 0;
		transition: opacity 0.15s;
	}

	.mark-all-btn:hover {
		opacity: 0.8;
	}

	.dnd-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 8px 12px;
		background: rgba(242, 63, 67, 0.1);
		border-radius: 6px;
		color: var(--status-danger, #f23f43);
		font-size: 13px;
		font-weight: 500;
	}

	.tabs {
		display: flex;
		gap: 2px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		overflow-x: auto;
	}

	.tab {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 13px;
		font-weight: 500;
		padding: 6px 12px;
		border-radius: 14px;
		cursor: pointer;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: color 0.15s, background-color 0.15s;
	}

	.tab:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.tab.active {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.32));
	}

	.tab-badge {
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: var(--status-danger, #f23f43);
		color: white;
		font-size: 11px;
		font-weight: 700;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.notification-scroll {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		color: var(--text-muted, #949ba4);
	}

	.empty-state svg {
		margin-bottom: 12px;
		opacity: 0.4;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-top-color: var(--brand-primary, #5865f2);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 12px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.date-group {
		padding: 0;
	}

	.date-label {
		padding: 12px 20px 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #949ba4);
		position: sticky;
		top: 0;
		background: var(--bg-primary, #313338);
		z-index: 1;
	}

	.notification-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 10px 20px;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.12s;
	}

	.notification-row:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.notification-row.unread {
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.24));
	}

	.notification-row.unread:hover {
		background: var(--bg-modifier-active, rgba(79, 84, 92, 0.32));
	}

	.notif-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #2b2d31);
	}

	.notif-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.notif-icon-text {
		font-size: 16px;
	}

	.notif-body {
		flex: 1;
		min-width: 0;
	}

	.notif-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notif-text {
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
		margin-top: 2px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.notif-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.meta-sep {
		opacity: 0.5;
	}

	.unread-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--brand-primary, #5865f2);
		flex-shrink: 0;
		margin-top: 6px;
	}

	.load-more-btn {
		width: 100%;
		padding: 14px;
		background: none;
		border: none;
		color: var(--brand-primary, #5865f2);
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.load-more-btn:hover:not(:disabled) {
		background: var(--brand-primary-alpha-10, rgba(88, 101, 242, 0.1));
	}

	.load-more-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.panel-footer {
		padding: 12px 20px;
		border-top: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.clear-btn {
		width: 100%;
		padding: 8px;
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 13px;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.15s, background-color 0.15s;
	}

	.clear-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}
</style>
