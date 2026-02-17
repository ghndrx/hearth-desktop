<script lang="ts">
	/**
	 * FullProfileModal Component
	 * 
	 * A comprehensive modal view of a user's profile with:
	 * - Full banner display
	 * - Avatar with status
	 * - Display name, username, pronouns
	 * - Bio and About Me sections
	 * - Connected accounts
	 * - Badges
	 * - Mutual servers/friends
	 * - Action buttons (message, add friend, etc.)
	 */
	
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import Modal from './Modal.svelte';
	import Avatar from './Avatar.svelte';
	import PresenceIndicator from './PresenceIndicator.svelte';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import { presenceStore, getStatusLabel, type Activity, type PresenceStatus } from '$lib/stores/presence';
	import { api } from '$lib/api';
	
	export let show = false;
	export let userId: string;
	export let initialData: UserProfile | null = null;
	
	interface Badge {
		id: string;
		badge_type: string;
		badge_name: string;
		badge_icon: string | null;
		description: string | null;
		earned_at: string;
	}
	
	interface ConnectedAccount {
		id: string;
		type: string;
		account_name: string | null;
		verified: boolean;
		visibility: number;
	}
	
	interface UserProfile {
		user: {
			id: string;
			username: string;
			display_name: string | null;
			discriminator: string;
			avatar_url: string | null;
			banner_url: string | null;
			bio: string | null;
			about_me: string | null;
			pronouns: string | null;
			accent_color: number | null;
			custom_status: string | null;
			flags: number;
			created_at: string;
		};
		badges?: Badge[];
		connected_accounts?: ConnectedAccount[];
		mutual_servers?: { id: string; name: string; icon_url: string | null }[];
		mutual_friends?: { id: string; username: string; avatar_url: string | null }[];
		total_mutual?: {
			servers: number;
			friends: number;
		};
	}
	
	const dispatch = createEventDispatcher<{
		close: void;
		message: { userId: string };
		addFriend: { userId: string };
		serverClick: { serverId: string };
	}>();
	
	let loading = true;
	let error: string | null = null;
	let profile: UserProfile | null = initialData;
	
	// Get presence
	$: presence = presenceStore.getPresence(userId);
	$: status = presence?.status ?? 'offline';
	$: activities = presence?.activities ?? [];
	$: customStatus = activities.find((a: Activity) => a.type === 4);
	$: gameActivity = activities.find((a: Activity) => a.type === 0 || a.type === 1 || a.type === 2 || a.type === 3);
	
	// Computed values
	$: user = profile?.user;
	$: displayName = user?.display_name || user?.username || '';
	$: discriminator = user?.discriminator || getDiscriminator(userId);
	$: accentColor = user?.accent_color ? `#${user.accent_color.toString(16).padStart(6, '0')}` : null;
	$: bannerStyle = user?.banner_url 
		? `background-image: url(${user.banner_url})` 
		: accentColor 
			? `background: linear-gradient(135deg, ${accentColor} 0%, ${shiftColor(accentColor, 30)} 100%)`
			: 'background: linear-gradient(135deg, var(--brand-primary, #5865f2) 0%, #8b5cf6 100%)';
	
	function getDiscriminator(id: string): string {
		if (!id) return '0000';
		const hash = id.split('').reduce((acc, char) => {
			return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
		}, 0);
		return Math.abs(hash % 10000).toString().padStart(4, '0');
	}
	
	function shiftColor(hex: string, percent: number): string {
		const num = parseInt(hex.replace('#', ''), 16);
		const amt = Math.round(2.55 * percent);
		const R = Math.min(255, Math.max(0, (num >> 16) + amt));
		const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
		const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
		return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
	}
	
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
	
	function getActivityLabel(type: number): string {
		switch (type) {
			case 0: return 'Playing';
			case 1: return 'Streaming';
			case 2: return 'Listening to';
			case 3: return 'Watching';
			case 5: return 'Competing in';
			default: return '';
		}
	}
	
	function getConnectedAccountIcon(type: string): string {
		const icons: Record<string, string> = {
			github: '🐙',
			twitter: '🐦',
			spotify: '🎵',
			steam: '🎮',
			twitch: '📺',
			youtube: '▶️',
			reddit: '🤖',
			playstation: '🎮',
			xbox: '🎮'
		};
		return icons[type] || '🔗';
	}
	
	function getConnectedAccountLabel(type: string): string {
		const labels: Record<string, string> = {
			github: 'GitHub',
			twitter: 'Twitter',
			spotify: 'Spotify',
			steam: 'Steam',
			twitch: 'Twitch',
			youtube: 'YouTube',
			reddit: 'Reddit',
			playstation: 'PlayStation',
			xbox: 'Xbox'
		};
		return labels[type] || type;
	}
	
	async function loadProfile() {
		if (initialData) {
			profile = initialData;
			loading = false;
			return;
		}
		
		try {
			loading = true;
			error = null;
			const data = await api.get<UserProfile>(`/users/${userId}/profile`);
			profile = data;
		} catch (e) {
			error = 'Failed to load profile';
			console.error('Failed to load profile:', e);
		} finally {
			loading = false;
		}
	}
	
	function handleClose() {
		dispatch('close');
	}
	
	function handleMessage() {
		dispatch('message', { userId });
		handleClose();
	}
	
	function handleAddFriend() {
		dispatch('addFriend', { userId });
	}
	
	function handleServerClick(serverId: string) {
		dispatch('serverClick', { serverId });
		handleClose();
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}
	
	onMount(() => {
		loadProfile();
		document.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if show}
	<Modal on:close={handleClose} maxWidth="600px">
		<div class="profile-modal">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading profile...</p>
				</div>
			{:else if error}
				<div class="error-state">
					<p>{error}</p>
					<button class="retry-btn" on:click={loadProfile}>Retry</button>
				</div>
			{:else if user}
				<!-- Banner -->
				<div class="banner" style={bannerStyle}>
					{#if user.banner_url}
						<div class="banner-overlay"></div>
					{/if}
				</div>
				
				<!-- Header Section -->
				<div class="header-section">
					<div class="avatar-container">
						<Avatar src={user.avatar_url} username={user.username} size="xl" />
						<div class="status-badge">
							<PresenceIndicator {status} size="lg" />
						</div>
					</div>
					
					<div class="header-actions">
						<button class="action-btn primary" on:click={handleMessage}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
							</svg>
							Message
						</button>
						<button class="action-btn secondary" on:click={handleAddFriend}>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
								<path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
							</svg>
							Add Friend
						</button>
					</div>
				</div>
				
				<!-- User Info -->
				<div class="user-info">
					<h2 class="display-name">{displayName}</h2>
					<div class="username-row">
						<span class="username">{user.username}</span>
						<span class="discriminator">#{discriminator}</span>
					</div>
					{#if user.pronouns}
						<span class="pronouns">{user.pronouns}</span>
					{/if}
				</div>
				
				<!-- Status -->
				{#if customStatus?.state || status !== 'offline'}
					<div class="status-section">
						<div class="status-indicator" data-status={status}></div>
						<span class="status-text">
							{#if customStatus?.state}
								{customStatus.emoji || ''} {customStatus.state}
							{:else}
								{getStatusLabel(status)}
							{/if}
						</span>
					</div>
				{/if}
				
				<!-- Activity -->
				{#if gameActivity}
					<div class="activity-section">
						<div class="activity-header">{getActivityLabel(gameActivity.type)}</div>
						<div class="activity-content">
							{#if gameActivity.assets?.large_image}
								<img src={gameActivity.assets.large_image} alt="" class="activity-image" />
							{/if}
							<div class="activity-details">
								<span class="activity-name">{gameActivity.name}</span>
								{#if gameActivity.details}
									<span class="activity-detail">{gameActivity.details}</span>
								{/if}
								{#if gameActivity.state}
									<span class="activity-state">{gameActivity.state}</span>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				
				<div class="divider"></div>
				
				<!-- Bio -->
				{#if user.bio}
					<div class="section">
						<h4 class="section-title">Bio</h4>
						<p class="bio-text">{user.bio}</p>
					</div>
				{/if}
				
				<!-- About Me -->
				{#if user.about_me}
					<div class="section">
						<h4 class="section-title">About Me</h4>
						<div class="about-me">
							<MarkdownRenderer content={user.about_me} />
						</div>
					</div>
				{/if}
				
				<!-- Badges -->
				{#if profile?.badges && profile.badges.length > 0}
					<div class="section">
						<h4 class="section-title">Badges</h4>
						<div class="badges-list">
							{#each profile.badges as badge}
								<div class="badge-item" title={badge.description || badge.badge_name}>
									{#if badge.badge_icon}
										<img src={badge.badge_icon} alt={badge.badge_name} class="badge-icon" />
									{:else}
										<span class="badge-emoji">🏆</span>
									{/if}
									<span class="badge-name">{badge.badge_name}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				
				<!-- Connected Accounts -->
				{#if profile?.connected_accounts && profile.connected_accounts.length > 0}
					<div class="section">
						<h4 class="section-title">Connections</h4>
						<div class="connections-list">
							{#each profile.connected_accounts as account}
								<div class="connection-item">
									<span class="connection-icon">{getConnectedAccountIcon(account.type)}</span>
									<div class="connection-info">
										<span class="connection-type">{getConnectedAccountLabel(account.type)}</span>
										{#if account.account_name}
											<span class="connection-name">{account.account_name}</span>
										{/if}
									</div>
									{#if account.verified}
										<svg class="verified-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
											<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
										</svg>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
				
				<!-- Mutual Servers -->
				{#if profile?.mutual_servers && profile.mutual_servers.length > 0}
					<div class="section">
						<h4 class="section-title">
							Mutual Servers — {profile.total_mutual?.servers || profile.mutual_servers.length}
						</h4>
						<div class="mutuals-list">
							{#each profile.mutual_servers.slice(0, 6) as server}
								<button class="mutual-item" on:click={() => handleServerClick(server.id)}>
									{#if server.icon_url}
										<img src={server.icon_url} alt="" class="mutual-icon" />
									{:else}
										<div class="mutual-icon-placeholder">
											{server.name.slice(0, 2).toUpperCase()}
										</div>
									{/if}
									<span class="mutual-name">{server.name}</span>
								</button>
							{/each}
							{#if (profile.total_mutual?.servers || 0) > 6}
								<span class="more-count">+{(profile.total_mutual?.servers || 0) - 6} more</span>
							{/if}
						</div>
					</div>
				{/if}
				
				<!-- Mutual Friends -->
				{#if profile?.mutual_friends && profile.mutual_friends.length > 0}
					<div class="section">
						<h4 class="section-title">
							Mutual Friends — {profile.total_mutual?.friends || profile.mutual_friends.length}
						</h4>
						<div class="mutuals-list friends">
							{#each profile.mutual_friends.slice(0, 6) as friend}
								<div class="friend-item">
									<Avatar src={friend.avatar_url} username={friend.username} size="sm" />
									<span class="friend-name">{friend.username}</span>
								</div>
							{/each}
							{#if (profile.total_mutual?.friends || 0) > 6}
								<span class="more-count">+{(profile.total_mutual?.friends || 0) - 6} more</span>
							{/if}
						</div>
					</div>
				{/if}
				
				<!-- Member Since -->
				<div class="section member-since">
					<div class="date-row">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="#ed4245">
							<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
						</svg>
						<span>Hearth member since {formatDate(user.created_at)}</span>
					</div>
				</div>
			{/if}
		</div>
	</Modal>
{/if}

<style>
	.profile-modal {
		display: flex;
		flex-direction: column;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		overflow: hidden;
		max-height: 80vh;
	}
	
	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		color: var(--text-muted, #949ba4);
	}
	
	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--bg-modifier-accent, #3f4147);
		border-top-color: var(--brand-primary, #5865f2);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 12px;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.retry-btn {
		margin-top: 12px;
		padding: 8px 16px;
		background: var(--brand-primary, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	
	.retry-btn:hover {
		background: var(--brand-hover, #4752c4);
	}
	
	/* Banner */
	.banner {
		height: 120px;
		background-size: cover;
		background-position: center;
		position: relative;
	}
	
	.banner-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.3));
	}
	
	/* Header */
	.header-section {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0 24px;
		margin-top: -50px;
		position: relative;
		z-index: 1;
	}
	
	.avatar-container {
		position: relative;
		padding: 6px;
		background: var(--bg-primary, #313338);
		border-radius: 50%;
	}
	
	.status-badge {
		position: absolute;
		bottom: 6px;
		right: 6px;
	}
	
	.header-actions {
		display: flex;
		gap: 8px;
		margin-top: 60px;
	}
	
	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.15s ease;
	}
	
	.action-btn.primary {
		background: var(--brand-primary, #5865f2);
		color: white;
	}
	
	.action-btn.primary:hover {
		background: var(--brand-hover, #4752c4);
	}
	
	.action-btn.secondary {
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-normal, #dbdee1);
	}
	
	.action-btn.secondary:hover {
		background: var(--bg-modifier-hover, #35373c);
	}
	
	/* User Info */
	.user-info {
		padding: 12px 24px 0;
	}
	
	.display-name {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary, #f2f3f5);
		margin: 0;
	}
	
	.username-row {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}
	
	.username {
		font-size: 16px;
		color: var(--text-secondary, #b5bac1);
	}
	
	.discriminator {
		font-size: 16px;
		color: var(--text-muted, #949ba4);
	}
	
	.pronouns {
		display: block;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
		margin-top: 4px;
	}
	
	/* Status */
	.status-section {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 24px;
		margin-top: 8px;
	}
	
	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	
	.status-indicator[data-status="online"] { background: #23a559; }
	.status-indicator[data-status="idle"] { background: #f0b232; }
	.status-indicator[data-status="dnd"] { background: #f23f43; }
	.status-indicator[data-status="invisible"],
	.status-indicator[data-status="offline"] { background: #80848e; }
	
	.status-text {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}
	
	/* Activity */
	.activity-section {
		margin: 12px 24px;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}
	
	.activity-header {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
		margin-bottom: 8px;
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
	
	.activity-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	
	.activity-name {
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}
	
	.activity-detail,
	.activity-state {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}
	
	/* Divider */
	.divider {
		height: 1px;
		background: var(--bg-modifier-accent, #3f4147);
		margin: 16px 24px;
	}
	
	/* Sections */
	.section {
		padding: 0 24px 16px;
	}
	
	.section-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin: 0 0 8px 0;
	}
	
	.bio-text {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.4;
		margin: 0;
		white-space: pre-wrap;
	}
	
	.about-me {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.5;
	}
	
	/* Badges */
	.badges-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	
	.badge-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 16px;
		cursor: default;
	}
	
	.badge-icon {
		width: 16px;
		height: 16px;
	}
	
	.badge-emoji {
		font-size: 14px;
	}
	
	.badge-name {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}
	
	/* Connections */
	.connections-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.connection-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}
	
	.connection-icon {
		font-size: 18px;
	}
	
	.connection-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	
	.connection-type {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
	}
	
	.connection-name {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}
	
	.verified-icon {
		color: var(--text-positive, #23a559);
	}
	
	/* Mutuals */
	.mutuals-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	
	.mutuals-list.friends {
		gap: 12px;
	}
	
	.mutual-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		transition: background 0.1s ease;
	}
	
	.mutual-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}
	
	.mutual-icon {
		width: 24px;
		height: 24px;
		border-radius: 8px;
		object-fit: cover;
	}
	
	.mutual-icon-placeholder {
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
	
	.mutual-name {
		font-size: 13px;
	}
	
	.friend-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	
	.friend-name {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}
	
	.more-count {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		padding: 6px 0;
	}
	
	/* Member Since */
	.member-since {
		padding-bottom: 24px;
	}
	
	.date-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}
</style>
