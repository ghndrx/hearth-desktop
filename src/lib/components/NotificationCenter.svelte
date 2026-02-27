<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { writable, derived, type Writable } from 'svelte/store';
	import { fade, fly, slide } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';

	const dispatch = createEventDispatcher();

	// Types
	interface Notification {
		id: string;
		type: 'message' | 'mention' | 'system' | 'update' | 'error' | 'warning' | 'success';
		title: string;
		body: string;
		timestamp: number;
		read: boolean;
		pinned: boolean;
		groupId?: string;
		actionUrl?: string;
		avatar?: string;
		metadata?: Record<string, unknown>;
	}

	interface NotificationGroup {
		id: string;
		name: string;
		notifications: Notification[];
		collapsed: boolean;
	}

	// Props
	export let maxNotifications = 100;
	export let groupByType = true;
	export let autoMarkReadMs = 5000;
	export let persistToStorage = true;

	// State
	const notifications: Writable<Notification[]> = writable([]);
	const filter: Writable<'all' | 'unread' | 'pinned'> = writable('all');
	const searchQuery: Writable<string> = writable('');
	const isOpen: Writable<boolean> = writable(false);
	const collapsedGroups: Writable<Set<string>> = writable(new Set());
	const dndEnabled: Writable<boolean> = writable(false);
	const selectedNotification: Writable<string | null> = writable(null);

	// Storage key
	const STORAGE_KEY = 'hearth-notification-center';

	// Derived stores
	const unreadCount = derived(notifications, ($notifications) =>
		$notifications.filter((n) => !n.read).length
	);

	const filteredNotifications = derived(
		[notifications, filter, searchQuery],
		([$notifications, $filter, $searchQuery]) => {
			let result = [...$notifications];

			// Apply filter
			switch ($filter) {
				case 'unread':
					result = result.filter((n) => !n.read);
					break;
				case 'pinned':
					result = result.filter((n) => n.pinned);
					break;
			}

			// Apply search
			if ($searchQuery.trim()) {
				const query = $searchQuery.toLowerCase();
				result = result.filter(
					(n) =>
						n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query)
				);
			}

			return result.sort((a, b) => {
				// Pinned first, then by timestamp
				if (a.pinned && !b.pinned) return -1;
				if (!a.pinned && b.pinned) return 1;
				return b.timestamp - a.timestamp;
			});
		}
	);

	const groupedNotifications = derived(
		[filteredNotifications, collapsedGroups],
		([$filtered, $collapsed]) => {
			if (!groupByType) {
				return [{ id: 'all', name: 'All Notifications', notifications: $filtered, collapsed: false }];
			}

			const groups: Map<string, Notification[]> = new Map();
			for (const notif of $filtered) {
				const groupId = notif.type;
				if (!groups.has(groupId)) {
					groups.set(groupId, []);
				}
				groups.get(groupId)!.push(notif);
			}

			const typeLabels: Record<string, string> = {
				message: '💬 Messages',
				mention: '🔔 Mentions',
				system: '⚙️ System',
				update: '🚀 Updates',
				error: '❌ Errors',
				warning: '⚠️ Warnings',
				success: '✅ Success'
			};

			return Array.from(groups.entries()).map(([id, notifs]) => ({
				id,
				name: typeLabels[id] || id,
				notifications: notifs,
				collapsed: $collapsed.has(id)
			}));
		}
	);

	// Functions
	function generateId(): string {
		return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	}

	export function addNotification(
		notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'pinned'>
	): string {
		const id = generateId();
		const newNotification: Notification = {
			...notification,
			id,
			timestamp: Date.now(),
			read: false,
			pinned: false
		};

		notifications.update((current) => {
			const updated = [newNotification, ...current];
			// Trim to max
			if (updated.length > maxNotifications) {
				return updated.slice(0, maxNotifications);
			}
			return updated;
		});

		// Dispatch event for external listeners
		dispatch('notification', newNotification);

		// Show native notification if not in DND mode
		if (!$dndEnabled) {
			showNativeNotification(newNotification);
		}

		saveToStorage();
		return id;
	}

	async function showNativeNotification(notification: Notification): Promise<void> {
		try {
			await invoke('show_notification', {
				title: notification.title,
				body: notification.body,
				icon: notification.avatar
			});
		} catch {
			// Fallback to browser notification
			if ('Notification' in window && Notification.permission === 'granted') {
				new Notification(notification.title, {
					body: notification.body,
					icon: notification.avatar
				});
			}
		}
	}

	export function markAsRead(id: string): void {
		notifications.update((current) =>
			current.map((n) => (n.id === id ? { ...n, read: true } : n))
		);
		saveToStorage();
	}

	export function markAllAsRead(): void {
		notifications.update((current) => current.map((n) => ({ ...n, read: true })));
		saveToStorage();
	}

	export function togglePin(id: string): void {
		notifications.update((current) =>
			current.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
		);
		saveToStorage();
	}

	export function removeNotification(id: string): void {
		notifications.update((current) => current.filter((n) => n.id !== id));
		saveToStorage();
	}

	export function clearAll(): void {
		notifications.update((current) => current.filter((n) => n.pinned));
		saveToStorage();
	}

	export function clearRead(): void {
		notifications.update((current) => current.filter((n) => !n.read || n.pinned));
		saveToStorage();
	}

	function toggleGroup(groupId: string): void {
		collapsedGroups.update((current) => {
			const updated = new Set(current);
			if (updated.has(groupId)) {
				updated.delete(groupId);
			} else {
				updated.add(groupId);
			}
			return updated;
		});
	}

	function handleNotificationClick(notification: Notification): void {
		markAsRead(notification.id);
		selectedNotification.set(notification.id);
		dispatch('click', notification);

		if (notification.actionUrl) {
			dispatch('navigate', notification.actionUrl);
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			isOpen.set(false);
		}
	}

	function formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	function saveToStorage(): void {
		if (!persistToStorage) return;
		try {
			const data = {
				notifications: $notifications,
				dndEnabled: $dndEnabled
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (e) {
			console.warn('Failed to save notifications to storage:', e);
		}
	}

	function loadFromStorage(): void {
		if (!persistToStorage) return;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const data = JSON.parse(stored);
				notifications.set(data.notifications || []);
				dndEnabled.set(data.dndEnabled || false);
			}
		} catch (e) {
			console.warn('Failed to load notifications from storage:', e);
		}
	}

	// Auto-mark read timer
	let autoReadTimeout: ReturnType<typeof setTimeout> | null = null;

	function startAutoReadTimer(id: string): void {
		if (autoMarkReadMs <= 0) return;
		autoReadTimeout = setTimeout(() => {
			markAsRead(id);
		}, autoMarkReadMs);
	}

	function cancelAutoReadTimer(): void {
		if (autoReadTimeout) {
			clearTimeout(autoReadTimeout);
			autoReadTimeout = null;
		}
	}

	// Lifecycle
	onMount(() => {
		loadFromStorage();
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		cancelAutoReadTimer();
	});

	// Export for external access
	export { isOpen, dndEnabled, unreadCount };
</script>

<div class="notification-center" class:open={$isOpen}>
	<!-- Toggle Button -->
	<button
		class="toggle-button"
		on:click={() => isOpen.update((v) => !v)}
		aria-label="Toggle notification center"
		aria-expanded={$isOpen}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 0 1-3.46 0" />
		</svg>
		{#if $unreadCount > 0}
			<span class="badge" transition:fade={{ duration: 150 }}>
				{$unreadCount > 99 ? '99+' : $unreadCount}
			</span>
		{/if}
	</button>

	<!-- Panel -->
	{#if $isOpen}
		<div class="panel" transition:fly={{ x: 300, duration: 200 }}>
			<!-- Header -->
			<header class="panel-header">
				<h2>Notifications</h2>
				<div class="header-actions">
					<button
						class="dnd-toggle"
						class:active={$dndEnabled}
						on:click={() => {
							dndEnabled.update((v) => !v);
							saveToStorage();
						}}
						title={$dndEnabled ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
					>
						{$dndEnabled ? '🔕' : '🔔'}
					</button>
					<button class="close-button" on:click={() => isOpen.set(false)} aria-label="Close">
						×
					</button>
				</div>
			</header>

			<!-- Search & Filter -->
			<div class="toolbar">
				<input
					type="search"
					placeholder="Search notifications..."
					bind:value={$searchQuery}
					class="search-input"
				/>
				<div class="filter-tabs">
					<button class:active={$filter === 'all'} on:click={() => filter.set('all')}>
						All
					</button>
					<button class:active={$filter === 'unread'} on:click={() => filter.set('unread')}>
						Unread ({$unreadCount})
					</button>
					<button class:active={$filter === 'pinned'} on:click={() => filter.set('pinned')}>
						Pinned
					</button>
				</div>
			</div>

			<!-- Actions Bar -->
			<div class="actions-bar">
				<button on:click={markAllAsRead} disabled={$unreadCount === 0}>
					Mark all read
				</button>
				<button on:click={clearRead}>Clear read</button>
				<button on:click={clearAll} class="danger">Clear all</button>
			</div>

			<!-- Notification List -->
			<div class="notification-list">
				{#if $filteredNotifications.length === 0}
					<div class="empty-state">
						<span class="emoji">📭</span>
						<p>No notifications</p>
					</div>
				{:else}
					{#each $groupedNotifications as group (group.id)}
						{#if groupByType}
							<div class="notification-group">
								<button
									class="group-header"
									on:click={() => toggleGroup(group.id)}
									aria-expanded={!group.collapsed}
								>
									<span class="group-name">{group.name}</span>
									<span class="group-count">{group.notifications.length}</span>
									<span class="chevron" class:collapsed={group.collapsed}>▼</span>
								</button>
								{#if !group.collapsed}
									<div class="group-items" transition:slide={{ duration: 150 }}>
										{#each group.notifications as notification (notification.id)}
											<div
												class="notification-item"
												class:unread={!notification.read}
												class:pinned={notification.pinned}
												class:selected={$selectedNotification === notification.id}
												on:click={() => handleNotificationClick(notification)}
												on:mouseenter={() => startAutoReadTimer(notification.id)}
												on:mouseleave={cancelAutoReadTimer}
												on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
												role="button"
												tabindex="0"
											>
												{#if notification.avatar}
													<img
														src={notification.avatar}
														alt=""
														class="notification-avatar"
													/>
												{:else}
													<div class="notification-icon type-{notification.type}">
														{#if notification.type === 'message'}💬
														{:else if notification.type === 'mention'}@
														{:else if notification.type === 'system'}⚙️
														{:else if notification.type === 'update'}🚀
														{:else if notification.type === 'error'}❌
														{:else if notification.type === 'warning'}⚠️
														{:else if notification.type === 'success'}✅
														{:else}📌{/if}
													</div>
												{/if}
												<div class="notification-content">
													<div class="notification-title">{notification.title}</div>
													<div class="notification-body">{notification.body}</div>
													<div class="notification-time">
														{formatTimestamp(notification.timestamp)}
													</div>
												</div>
												<div class="notification-actions">
													<button
														class="pin-button"
														class:pinned={notification.pinned}
														on:click|stopPropagation={() => togglePin(notification.id)}
														title={notification.pinned ? 'Unpin' : 'Pin'}
													>
														📌
													</button>
													<button
														class="remove-button"
														on:click|stopPropagation={() => removeNotification(notification.id)}
														title="Remove"
													>
														×
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{:else}
							{#each group.notifications as notification (notification.id)}
								<div
									class="notification-item"
									class:unread={!notification.read}
									class:pinned={notification.pinned}
									on:click={() => handleNotificationClick(notification)}
									on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
									role="button"
									tabindex="0"
								>
									<div class="notification-content">
										<div class="notification-title">{notification.title}</div>
										<div class="notification-body">{notification.body}</div>
										<div class="notification-time">
											{formatTimestamp(notification.timestamp)}
										</div>
									</div>
								</div>
							{/each}
						{/if}
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<footer class="panel-footer">
				<span class="notification-count">
					{$filteredNotifications.length} notification{$filteredNotifications.length !== 1 ? 's' : ''}
				</span>
				{#if $dndEnabled}
					<span class="dnd-status">🔕 Do Not Disturb</span>
				{/if}
			</footer>
		</div>
	{/if}
</div>

<style>
	.notification-center {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.toggle-button {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-button:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
		color: var(--text-primary, #fff);
	}

	.badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: var(--accent-error, #ed4245);
		color: white;
		font-size: 10px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 380px;
		height: 100vh;
		background: var(--bg-primary, #36393f);
		border-left: 1px solid var(--border-color, #202225);
		display: flex;
		flex-direction: column;
		z-index: 1000;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-color, #202225);
	}

	.panel-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dnd-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		font-size: 14px;
		opacity: 0.7;
		transition: all 0.15s ease;
	}

	.dnd-toggle:hover,
	.dnd-toggle.active {
		opacity: 1;
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary, #b9bbbe);
		font-size: 20px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-button:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
		color: var(--text-primary, #fff);
	}

	.toolbar {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
	}

	.search-input {
		width: 100%;
		padding: 8px 12px;
		border: none;
		border-radius: 6px;
		background: var(--bg-secondary, #2f3136);
		color: var(--text-primary, #fff);
		font-size: 14px;
		outline: none;
		margin-bottom: 10px;
	}

	.search-input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.filter-tabs {
		display: flex;
		gap: 4px;
	}

	.filter-tabs button {
		flex: 1;
		padding: 6px 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-secondary, #b9bbbe);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-tabs button:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
	}

	.filter-tabs button.active {
		background: var(--accent-primary, #5865f2);
		color: white;
	}

	.actions-bar {
		display: flex;
		gap: 8px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
	}

	.actions-bar button {
		padding: 4px 8px;
		border: none;
		border-radius: 4px;
		background: var(--bg-secondary, #2f3136);
		color: var(--text-secondary, #b9bbbe);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.actions-bar button:hover:not(:disabled) {
		background: var(--bg-hover, rgba(255, 255, 255, 0.15));
		color: var(--text-primary, #fff);
	}

	.actions-bar button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.actions-bar button.danger:hover:not(:disabled) {
		background: var(--accent-error, #ed4245);
		color: white;
	}

	.notification-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--text-muted, #72767d);
	}

	.empty-state .emoji {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.notification-group {
		margin-bottom: 8px;
	}

	.group-header {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 8px 12px;
		border: none;
		border-radius: 6px;
		background: var(--bg-secondary, #2f3136);
		color: var(--text-secondary, #b9bbbe);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.group-header:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
	}

	.group-name {
		flex: 1;
		text-align: left;
	}

	.group-count {
		padding: 2px 6px;
		border-radius: 10px;
		background: var(--bg-tertiary, #202225);
		font-size: 10px;
		margin-right: 8px;
	}

	.chevron {
		transition: transform 0.15s ease;
	}

	.chevron.collapsed {
		transform: rotate(-90deg);
	}

	.group-items {
		padding: 4px 0 4px 8px;
	}

	.notification-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 4px;
	}

	.notification-item:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.05));
	}

	.notification-item.unread {
		background: var(--bg-unread, rgba(88, 101, 242, 0.1));
		border-left: 3px solid var(--accent-primary, #5865f2);
	}

	.notification-item.pinned {
		border-left: 3px solid var(--accent-warning, #faa61a);
	}

	.notification-item.selected {
		background: var(--bg-selected, rgba(88, 101, 242, 0.2));
	}

	.notification-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
	}

	.notification-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		background: var(--bg-secondary, #2f3136);
	}

	.notification-content {
		flex: 1;
		min-width: 0;
	}

	.notification-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notification-body {
		font-size: 13px;
		color: var(--text-secondary, #b9bbbe);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.notification-time {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-top: 4px;
	}

	.notification-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.notification-item:hover .notification-actions {
		opacity: 1;
	}

	.pin-button,
	.remove-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		font-size: 12px;
		opacity: 0.6;
		transition: all 0.15s ease;
	}

	.pin-button:hover,
	.remove-button:hover {
		opacity: 1;
		background: var(--bg-hover, rgba(255, 255, 255, 0.1));
	}

	.pin-button.pinned {
		opacity: 1;
		color: var(--accent-warning, #faa61a);
	}

	.remove-button:hover {
		color: var(--accent-error, #ed4245);
	}

	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-top: 1px solid var(--border-color, #202225);
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	.dnd-status {
		color: var(--accent-warning, #faa61a);
	}

	/* Scrollbar styling */
	.notification-list::-webkit-scrollbar {
		width: 8px;
	}

	.notification-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.notification-list::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb, #202225);
		border-radius: 4px;
	}

	.notification-list::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover, #36393f);
	}
</style>
