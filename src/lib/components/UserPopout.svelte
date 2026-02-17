<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import PresenceIndicator from './PresenceIndicator.svelte';
	import { presenceStore, getStatusLabel, getActivityLabel, type Activity } from '$lib/stores/presence';

	export let user: {
		id: string;
		username: string;
		display_name: string | null;
		avatar: string | null;
		banner: string | null;
		bio: string | null;
		pronouns: string | null;
		bot: boolean;
		created_at: string;
	};

	export let member: {
		nickname: string | null;
		joined_at: string;
		roles: {
			id: string;
			name: string;
			color: string;
		}[];
	} | null = null;

	export let mutualServers: {
		id: string;
		name: string;
		icon: string | null;
	}[] = [];

	export let mutualFriends: {
		id: string;
		username: string;
		avatar: string | null;
	}[] = [];

	export let sharedChannels: {
		id: string;
		name: string;
		server_id: string;
		server_name: string;
		server_icon: string | null;
	}[] = [];

	export let recentActivity: {
		last_message_at: string | null;
		server_name: string | null;
		channel_name: string | null;
		message_count_24h: number;
	} | null = null;

	export let totalMutual: {
		servers: number;
		channels: number;
		friends: number;
	} = { servers: 0, channels: 0, friends: 0 };

	export let loading: boolean = false;

	export let position: { x: number; y: number } | null = null;
	export let anchor: 'left' | 'right' | 'bottom' = 'right';

	function formatRelativeTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return formatDate(dateString);
	}

	function handleChannelClick(channelId: string, serverId: string) {
		// Navigate to the channel
		window.location.href = `/channels/${serverId}/${channelId}`;
		dispatch('close');
	}

	const dispatch = createEventDispatcher<{
		close: void;
		message: { userId: string };
		call: { userId: string; type: 'voice' | 'video' };
		serverClick: { serverId: string };
		addFriend: { userId: string };
		block: { userId: string };
		viewFullProfile: { userId: string };
	}>();

	let popoutEl: HTMLDivElement;
	let computedStyle: { top: string; left: string; transformOrigin: string } = {
		top: '0px',
		left: '0px',
		transformOrigin: 'top left'
	};

	// Get presence info
	$: presence = presenceStore.getPresence(user.id);
	$: status = presence?.status ?? 'offline';
	$: activities = presence?.activities ?? [];
	$: customStatus = activities.find((a: Activity) => a.type === 4);
	$: gameActivity = activities.find((a: Activity) => a.type === 0 || a.type === 1);

	function getDiscriminator(userId: string): string {
		if (!userId) return '0000';
		const hash = userId.split('').reduce((acc, char) => {
			return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
		}, 0);
		return Math.abs(hash % 10000)
			.toString()
			.padStart(4, '0');
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatActivityText(activity: Activity): string {
		const prefix = getActivityLabel(activity.type);
		if (activity.type === 4 && activity.state) {
			return activity.state;
		}
		return prefix ? `${prefix} ${activity.name}` : activity.name;
	}

	function handleMessageClick() {
		dispatch('message', { userId: user.id });
	}

	function handleVoiceCall() {
		dispatch('call', { userId: user.id, type: 'voice' });
	}

	function handleVideoCall() {
		dispatch('call', { userId: user.id, type: 'video' });
	}

	function handleAddFriend() {
		dispatch('addFriend', { userId: user.id });
	}

	function handleBlock() {
		dispatch('block', { userId: user.id });
	}

	function handleServerClick(serverId: string) {
		dispatch('serverClick', { serverId });
	}

	function handleClose() {
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	onMount(() => {
		if (position && popoutEl) {
			const rect = popoutEl.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			
			let x = position.x;
			let y = position.y;
			let origin = 'top left';

			// Horizontal positioning
			if (anchor === 'right') {
				x = position.x + 8;
				if (x + rect.width > viewportWidth - 16) {
					x = position.x - rect.width - 8;
					origin = 'top right';
				}
			} else {
				x = position.x - rect.width - 8;
				if (x < 16) {
					x = position.x + 8;
					origin = 'top left';
				}
			}

			// Vertical positioning
			if (y + rect.height > viewportHeight - 16) {
				y = viewportHeight - rect.height - 16;
				origin = origin.replace('top', 'bottom');
			}
			if (y < 16) {
				y = 16;
			}

			computedStyle = {
				top: `${y}px`,
				left: `${x}px`,
				transformOrigin: origin
			};
		}

		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	$: displayName = member?.nickname || user.display_name || user.username;
	$: discriminator = getDiscriminator(user.id);
	$: bannerUrl = user.banner;
	$: memberSince = member?.joined_at ? formatDate(member.joined_at) : null;
	$: accountCreated = formatDate(user.created_at);
	$: statusLabel = getStatusLabel(status);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="popout-overlay" on:click={handleClose}>
	<div
		bind:this={popoutEl}
		class="user-popout"
		class:positioned={position !== null}
		style={position ? `top: ${computedStyle.top}; left: ${computedStyle.left}; transform-origin: ${computedStyle.transformOrigin};` : ''}
		on:click|stopPropagation
		role="dialog"
		aria-label="User popout for {displayName}"
	>
		<!-- Banner -->
		<div class="banner">
			{#if bannerUrl}
				<img src={bannerUrl} alt="" class="banner-image" />
			{:else}
				<div class="banner-default"></div>
			{/if}
		</div>

		<!-- Avatar Section -->
		<div class="avatar-section">
			<div class="avatar-wrapper">
				<Avatar src={user.avatar} alt={user.username} size="lg" username={user.username} />
				<div class="status-ring">
					<PresenceIndicator {status} size="lg" />
				</div>
			</div>

			<!-- Quick Actions (top right) -->
			<div class="quick-actions">
				{#if !user.bot}
					<button
						class="action-btn"
						on:click={handleVoiceCall}
						title="Start Voice Call"
						aria-label="Start voice call"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
						</svg>
					</button>
					<button
						class="action-btn"
						on:click={handleVideoCall}
						title="Start Video Call"
						aria-label="Start video call"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<!-- Content -->
		<div class="content">
			<!-- User Info -->
			<div class="user-info">
				<h3 class="display-name">{displayName}</h3>
				<div class="username-row">
					<span class="username">{user.username}</span>
					<span class="discriminator">#{discriminator}</span>
					{#if user.bot}
						<span class="bot-badge">BOT</span>
					{/if}
				</div>
				{#if user.pronouns}
					<p class="pronouns">{user.pronouns}</p>
				{/if}
			</div>

			<!-- Custom Status -->
			{#if customStatus}
				<div class="custom-status">
					{#if customStatus.state}
						<span class="status-emoji">{customStatus.emoji || ''}</span>
						<span class="status-text">{customStatus.state}</span>
					{/if}
				</div>
			{/if}

			<!-- Divider -->
			<div class="divider"></div>

			<!-- Activity (Playing/Streaming) -->
			{#if gameActivity}
				<div class="section activity-section">
					<h4 class="section-title">{getActivityLabel(gameActivity.type)}</h4>
					<div class="activity-content">
						{#if gameActivity.assets?.large_image}
							<img
								src={gameActivity.assets.large_image}
								alt=""
								class="activity-image"
							/>
						{/if}
						<div class="activity-info">
							<span class="activity-name">{gameActivity.name}</span>
							{#if gameActivity.details}
								<span class="activity-details">{gameActivity.details}</span>
							{/if}
							{#if gameActivity.state}
								<span class="activity-state">{gameActivity.state}</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- About Me -->
			{#if user.bio}
				<div class="section">
					<h4 class="section-title">About Me</h4>
					<p class="bio">{user.bio}</p>
				</div>
			{/if}

			<!-- Member Since -->
			<div class="section">
				<h4 class="section-title">
					{#if memberSince}
						Member Since
					{:else}
						Hearth Member Since
					{/if}
				</h4>
				<div class="dates-row">
					<div class="date-item">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="date-icon hearth">
							<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
						</svg>
						<span>{accountCreated}</span>
					</div>
					{#if memberSince}
						<span class="date-separator">•</span>
						<div class="date-item">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="date-icon server">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
							</svg>
							<span>{memberSince}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Roles -->
			{#if member && member.roles.length > 0}
				<div class="section">
					<h4 class="section-title">Roles — {member.roles.length}</h4>
					<div class="roles-list">
						{#each member.roles as role}
							<div class="role-badge" style="border-color: {role.color || '#4f545c'}">
								<span class="role-dot" style="background-color: {role.color || '#4f545c'}"></span>
								<span class="role-name">{role.name}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Recent Activity -->
			{#if recentActivity && (recentActivity.last_message_at || recentActivity.message_count_24h > 0)}
				<div class="section">
					<h4 class="section-title">Recent Activity</h4>
					<div class="activity-summary">
						{#if recentActivity.last_message_at}
							<div class="activity-item">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="activity-icon">
									<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
								</svg>
								<span class="activity-text">
									Last active {formatRelativeTime(recentActivity.last_message_at)}
									{#if recentActivity.server_name && recentActivity.channel_name}
										in #{recentActivity.channel_name}
									{/if}
								</span>
							</div>
						{/if}
						{#if recentActivity.message_count_24h > 0}
							<div class="activity-item">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="activity-icon">
									<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
								</svg>
								<span class="activity-text">{recentActivity.message_count_24h} messages in the last 24h</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Mutual Servers -->
			{#if mutualServers.length > 0 || loading}
				<div class="section">
					<h4 class="section-title">
						Mutual Servers — {totalMutual.servers > 0 ? totalMutual.servers : mutualServers.length}
						{#if loading}
							<span class="loading-indicator"></span>
						{/if}
					</h4>
					{#if loading && mutualServers.length === 0}
						<div class="skeleton-list">
							<div class="skeleton-item"></div>
							<div class="skeleton-item"></div>
						</div>
					{:else}
						<div class="servers-list">
							{#each mutualServers.slice(0, 5) as server}
								<button class="server-item" on:click={() => handleServerClick(server.id)}>
									{#if server.icon}
										<img src={server.icon} alt="" class="server-icon" />
									{:else}
										<div class="server-icon-placeholder">
											{server.name.slice(0, 2).toUpperCase()}
										</div>
									{/if}
									<span class="server-name">{server.name}</span>
								</button>
							{/each}
							{#if totalMutual.servers > 5}
								<span class="more-items">+{totalMutual.servers - 5} more</span>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Shared Channels -->
			{#if sharedChannels.length > 0}
				<div class="section">
					<h4 class="section-title">Shared Channels — {totalMutual.channels > 0 ? totalMutual.channels : sharedChannels.length}</h4>
					<div class="channels-list">
						{#each sharedChannels.slice(0, 5) as channel}
							<button class="channel-item" on:click={() => handleChannelClick(channel.id, channel.server_id)}>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="channel-icon">
									<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
								</svg>
								<div class="channel-info">
									<span class="channel-name">{channel.name}</span>
									<span class="channel-server">{channel.server_name}</span>
								</div>
							</button>
						{/each}
						{#if totalMutual.channels > 5}
							<span class="more-items">+{totalMutual.channels - 5} more</span>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Mutual Friends -->
			{#if mutualFriends.length > 0}
				<div class="section">
					<h4 class="section-title">Mutual Friends — {totalMutual.friends > 0 ? totalMutual.friends : mutualFriends.length}</h4>
					<div class="friends-list">
						{#each mutualFriends.slice(0, 5) as friend}
							<div class="friend-item">
								<Avatar src={friend.avatar} username={friend.username} size="xs" />
								<span class="friend-name">{friend.username}</span>
							</div>
						{/each}
						{#if totalMutual.friends > 5}
							<span class="more-items">+{totalMutual.friends - 5} more</span>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Note -->
			<div class="section note-section">
				<h4 class="section-title">Note</h4>
				<textarea
					class="note-input"
					placeholder="Click to add a note"
					rows="1"
				></textarea>
			</div>

			<!-- View Full Profile Link -->
			<button class="view-profile-btn" on:click={() => dispatch('viewFullProfile', { userId: user.id })}>
				View Full Profile
			</button>

			<!-- Actions -->
			<div class="actions">
				<button class="action-btn-primary" on:click={handleMessageClick}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path d="M4 4h16v12H5.17L4 17.17V4zm0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4z"/>
					</svg>
					<span>Message</span>
				</button>

				{#if !user.bot}
					<div class="action-row">
						<button class="action-btn-secondary" on:click={handleVoiceCall}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
							</svg>
							<span>Voice</span>
						</button>
						<button class="action-btn-secondary" on:click={handleVideoCall}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
							</svg>
							<span>Video</span>
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.popout-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	.user-popout {
		position: absolute;
		width: 340px;
		max-height: calc(100vh - 32px);
		background: var(--bg-floating, #232428);
		border-radius: 8px;
		box-shadow: var(--shadow-elevation-high, 0 8px 16px rgba(0, 0, 0, 0.24));
		overflow: hidden;
		animation: popoutFade 0.15s ease-out;
		display: flex;
		flex-direction: column;
	}

	.user-popout:not(.positioned) {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	@keyframes popoutFade {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Banner */
	.banner {
		width: 100%;
		height: 60px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.banner-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.banner-default {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--brand-primary, #5865f2) 0%, #8b5cf6 100%);
	}

	/* Avatar Section */
	.avatar-section {
		position: relative;
		height: 40px;
		margin-bottom: 44px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0 16px;
	}

	.avatar-wrapper {
		position: absolute;
		left: 16px;
		top: -40px;
		padding: 6px;
		background: var(--bg-floating, #232428);
		border-radius: 50%;
	}

	.status-ring {
		position: absolute;
		bottom: 6px;
		right: 6px;
	}

	.quick-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
		margin-top: 8px;
	}

	.quick-actions .action-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-normal, #dbdee1);
		transition: all 0.15s ease;
	}

	.quick-actions .action-btn:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-primary, #f2f3f5);
	}

	/* Content */
	.content {
		padding: 0 16px 16px;
		overflow-y: auto;
		flex: 1;
	}

	/* User Info */
	.user-info {
		margin-bottom: 8px;
	}

	.display-name {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary, #f2f3f5);
		margin: 0 0 2px 0;
		line-height: 1.2;
	}

	.username-row {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	.username {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary, #b5bac1);
	}

	.discriminator {
		font-size: 14px;
		color: var(--text-muted, #949ba4);
	}

	.bot-badge {
		background: var(--brand-primary, #5865f2);
		color: white;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.pronouns {
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
		margin: 4px 0 0 0;
	}

	/* Custom Status */
	.custom-status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 0;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}

	.status-emoji {
		font-size: 16px;
	}

	.status-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Divider */
	.divider {
		height: 1px;
		background: var(--bg-modifier-accent, #3f4147);
		margin: 8px 0 12px;
	}

	/* Sections */
	.section {
		margin-bottom: 12px;
	}

	.section:last-of-type {
		margin-bottom: 12px;
	}

	.section-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin: 0 0 8px 0;
		display: flex;
		align-items: center;
	}

	.bio {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.4;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Activity */
	.activity-section {
		background: var(--bg-secondary, #2b2d31);
		margin: 0 -16px 12px;
		padding: 12px 16px;
	}

	.activity-content {
		display: flex;
		gap: 12px;
	}

	.activity-image {
		width: 60px;
		height: 60px;
		border-radius: 8px;
		object-fit: cover;
	}

	.activity-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		min-width: 0;
	}

	.activity-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.activity-details,
	.activity-state {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Dates */
	.dates-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.date-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}

	.date-icon {
		opacity: 0.8;
	}

	.date-icon.hearth {
		color: #ed4245;
	}

	.date-icon.server {
		color: var(--text-muted, #949ba4);
	}

	.date-separator {
		color: var(--text-muted, #949ba4);
	}

	/* Roles */
	.roles-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.role-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-normal, #dbdee1);
	}

	.role-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 120px;
	}

	/* Mutual Servers / Friends */
	.servers-list,
	.friends-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.server-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		margin: 0 -8px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		text-align: left;
		width: calc(100% + 16px);
		transition: background 0.1s ease;
	}

	.server-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.server-icon {
		width: 24px;
		height: 24px;
		border-radius: 8px;
		object-fit: cover;
	}

	.server-icon-placeholder {
		width: 24px;
		height: 24px;
		border-radius: 8px;
		background: var(--brand-primary, #5865f2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 700;
		color: white;
	}

	.server-name,
	.friend-name {
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friend-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}

	.more-items {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		padding: 4px 0;
	}

	/* Note */
	.note-section {
		margin-bottom: 8px;
	}

	.note-input {
		width: 100%;
		min-height: 36px;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		font-family: inherit;
		resize: none;
		outline: none;
	}

	.note-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.note-input:focus {
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}

	/* View Full Profile */
	.view-profile-btn {
		width: 100%;
		padding: 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-link, #00a8fc);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		text-align: center;
		transition: all 0.1s ease;
	}

	.view-profile-btn:hover {
		text-decoration: underline;
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	/* Actions */
	.actions {
		padding-top: 12px;
		border-top: 1px solid var(--bg-modifier-accent, #3f4147);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-btn-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px 16px;
		background: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.action-btn-primary:hover {
		background: var(--brand-hover, #4752c4);
	}

	.action-btn-primary:active {
		transform: translateY(1px);
	}

	.action-row {
		display: flex;
		gap: 8px;
	}

	.action-btn-secondary {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn-secondary:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-primary, #f2f3f5);
	}

	.action-btn-secondary:active {
		transform: translateY(1px);
	}

	/* Recent Activity Summary */
	.activity-summary {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}

	.activity-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.activity-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Shared Channels */
	.channels-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		margin: 0 -8px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		text-align: left;
		width: calc(100% + 16px);
		transition: background 0.1s ease;
	}

	.channel-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.channel-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.channel-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.channel-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal, #dbdee1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.channel-server {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Loading States */
	.loading-indicator {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-left: 6px;
		border: 2px solid var(--text-muted, #949ba4);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.skeleton-item {
		height: 32px;
		background: linear-gradient(90deg, var(--bg-secondary, #2b2d31) 25%, var(--bg-modifier-hover, #35373c) 50%, var(--bg-secondary, #2b2d31) 75%);
		background-size: 200% 100%;
		border-radius: 4px;
		animation: shimmer 1.5s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
