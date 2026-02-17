<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		notifications, 
		unreadCount, 
		hasUnread,
		requestNotificationPermission,
		getNotificationPermission,
		type Notification 
	} from '$lib/stores/notifications';
	import { goto } from '$app/navigation';

	let showDropdown = false;
	let dropdownRef: HTMLDivElement;
	let bellRef: HTMLButtonElement;

	$: notificationList = $notifications.notifications;
	$: loading = $notifications.loading;

	onMount(() => {
		// Load initial notifications
		notifications.loadStats();
		
		// Request notification permission on first interaction
		const handleInteraction = () => {
			if (getNotificationPermission() === 'default') {
				requestNotificationPermission();
			}
			document.removeEventListener('click', handleInteraction);
		};
		document.addEventListener('click', handleInteraction, { once: true });

		// Click outside to close
		const handleClickOutside = (e: MouseEvent) => {
			if (showDropdown && 
				dropdownRef && 
				!dropdownRef.contains(e.target as Node) &&
				bellRef &&
				!bellRef.contains(e.target as Node)) {
				showDropdown = false;
			}
		};
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function toggleDropdown() {
		showDropdown = !showDropdown;
		if (showDropdown && notificationList.length === 0) {
			notifications.loadNotifications(true);
		}
	}

	function handleNotificationClick(notification: Notification) {
		// Mark as read
		if (!notification.read) {
			notifications.markAsRead(notification.id);
		}

		// Navigate to the content
		if (notification.channel_id) {
			if (notification.server_id) {
				goto(`/channels/${notification.server_id}/${notification.channel_id}`);
			} else {
				goto(`/channels/@me/${notification.channel_id}`);
			}
		}

		showDropdown = false;
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
		
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		
		return date.toLocaleDateString();
	}

	function getNotificationIcon(type: string): string {
		switch (type) {
			case 'mention': return '@';
			case 'reply': return '↩';
			case 'direct_message': return '💬';
			case 'friend_request': return '👋';
			case 'friend_accept': return '🤝';
			case 'server_invite': return '📨';
			case 'server_join': return '👥';
			case 'reaction': return '❤️';
			default: return '🔔';
		}
	}
</script>

<div class="notification-bell-container">
	<button 
		bind:this={bellRef}
		class="bell-button" 
		on:click={toggleDropdown}
		aria-label="Notifications"
		aria-expanded={showDropdown}
		aria-haspopup="true"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 0 1-3.46 0" />
		</svg>
		{#if $hasUnread}
			<span class="badge" aria-label="{$unreadCount} unread notifications">
				{$unreadCount > 99 ? '99+' : $unreadCount}
			</span>
		{/if}
	</button>

	{#if showDropdown}
		<div bind:this={dropdownRef} class="dropdown" role="menu" aria-label="Notifications">
			<div class="dropdown-header">
				<h3>Notifications</h3>
				{#if $hasUnread}
					<button class="mark-all-read" on:click={() => notifications.markAllAsRead()}>
						Mark all read
					</button>
				{/if}
			</div>

			<div class="notification-list" role="list">
				{#if loading && notificationList.length === 0}
					<div class="loading">Loading...</div>
				{:else if notificationList.length === 0}
					<div class="empty">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
						<p>No notifications yet</p>
					</div>
				{:else}
					{#each notificationList as notification (notification.id)}
						<button
							class="notification-item"
							class:unread={!notification.read}
							on:click={() => handleNotificationClick(notification)}
							role="menuitem"
						>
							<div class="notification-icon">
								{#if notification.actor_avatar}
									<img src={notification.actor_avatar} alt="" class="avatar" />
								{:else}
									<span class="icon-placeholder">{getNotificationIcon(notification.type)}</span>
								{/if}
							</div>
							<div class="notification-content">
								<div class="notification-title">{notification.title}</div>
								<div class="notification-body">{notification.body}</div>
								<div class="notification-meta">
									{#if notification.server_name}
										<span class="server-name">{notification.server_name}</span>
										{#if notification.channel_name}
											<span class="separator">·</span>
											<span class="channel-name">#{notification.channel_name}</span>
										{/if}
										<span class="separator">·</span>
									{/if}
									<span class="time">{formatTime(notification.created_at)}</span>
								</div>
							</div>
							{#if !notification.read}
								<div class="unread-dot" aria-label="Unread"></div>
							{/if}
						</button>
					{/each}
					
					{#if $notifications.hasMore}
						<button 
							class="load-more" 
							on:click={() => notifications.loadNotifications()}
							disabled={loading}
						>
							{loading ? 'Loading...' : 'Load more'}
						</button>
					{/if}
				{/if}
			</div>

			{#if notificationList.some(n => n.read)}
				<div class="dropdown-footer">
					<button class="clear-read" on:click={() => notifications.deleteAllRead()}>
						Clear read notifications
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.notification-bell-container {
		position: relative;
	}

	.bell-button {
		position: relative;
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 8px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s, background-color 0.15s;
	}

	.bell-button:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		background: var(--status-danger, #f23f43);
		color: white;
		font-size: 11px;
		font-weight: 600;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		width: 400px;
		max-height: 500px;
		background: var(--bg-floating, #111214);
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		overflow: hidden;
		z-index: 1000;
		display: flex;
		flex-direction: column;
	}

	.dropdown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.dropdown-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	.mark-all-read {
		background: none;
		border: none;
		color: var(--brand-primary, #5865f2);
		font-size: 14px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.mark-all-read:hover {
		background: var(--brand-primary-alpha-10, rgba(88, 101, 242, 0.1));
	}

	.notification-list {
		flex: 1;
		overflow-y: auto;
		max-height: 350px;
	}

	.loading, .empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-muted, #949ba4);
	}

	.empty svg {
		margin-bottom: 12px;
		opacity: 0.5;
	}

	.notification-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.notification-item:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.notification-item.unread {
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.24));
	}

	.notification-icon {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #2b2d31);
	}

	.notification-icon .avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.icon-placeholder {
		font-size: 18px;
	}

	.notification-content {
		flex: 1;
		min-width: 0;
	}

	.notification-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notification-body {
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
		margin-top: 2px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.notification-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.separator {
		color: var(--text-muted, #949ba4);
	}

	.unread-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--brand-primary, #5865f2);
		flex-shrink: 0;
	}

	.load-more {
		width: 100%;
		padding: 12px;
		background: none;
		border: none;
		color: var(--brand-primary, #5865f2);
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.load-more:hover:not(:disabled) {
		background: var(--brand-primary-alpha-10, rgba(88, 101, 242, 0.1));
	}

	.load-more:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-footer {
		padding: 12px 16px;
		border-top: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.clear-read {
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

	.clear-read:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}
</style>
