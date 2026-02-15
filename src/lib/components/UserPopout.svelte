<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Avatar from './Avatar.svelte';
	import PresenceIndicator from './PresenceIndicator.svelte';

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

	export let status: 'online' | 'idle' | 'dnd' | 'offline' = 'offline';
	export let position: 'left' | 'right' = 'right';

	const dispatch = createEventDispatcher();

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

	function handleMessageClick() {
		dispatch('message', { userId: user.id });
	}

	function handleServerClick(serverId: string) {
		dispatch('serverClick', { serverId });
	}

	function handleClose() {
		dispatch('close');
	}

	$: displayName = member?.nickname || user.display_name || user.username;
	$: discriminator = getDiscriminator(user.id);
	$: bannerUrl = user.banner;
	$: memberSince = member?.joined_at ? formatDate(member.joined_at) : null;
	$: accountCreated = formatDate(user.created_at);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="popout-overlay" on:click={handleClose}>
	<div class="user-popout {position}" on:click|stopPropagation>
		<!-- Banner -->
		<div class="banner">
			{#if bannerUrl}
				<img src={bannerUrl} alt="" class="banner-image" />
			{:else}
				<div class="banner-default"></div>
			{/if}
		</div>

		<!-- Avatar -->
		<div class="avatar-section">
			<div class="avatar-wrapper">
				<Avatar src={user.avatar} alt={user.username} size="lg" username={user.username} />
				<div class="status-ring">
					<PresenceIndicator {status} size="lg" />
				</div>
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

			<!-- Divider -->
			<div class="divider"></div>

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
						Server Member Since
					{:else}
						Member Since
					{/if}
				</h4>
				<p class="date">
					{#if memberSince}
						{memberSince}
					{:else}
						{accountCreated}
					{/if}
				</p>
			</div>

			<!-- Roles -->
			{#if member && member.roles.length > 0}
				<div class="section">
					<h4 class="section-title">Roles</h4>
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

			<!-- Mutual Servers -->
			{#if mutualServers.length > 0}
				<div class="section">
					<h4 class="section-title">Mutual Servers</h4>
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
						{#if mutualServers.length > 5}
							<span class="more-servers">+{mutualServers.length - 5} more</span>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Message Button -->
			<div class="actions">
				<button class="message-btn" on:click={handleMessageClick}>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path
							d="M4 4h16v12H5.17L4 17.17V4zm0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h12v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z"
						/>
					</svg>
					Message
				</button>
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
		background: var(--bg-primary);
		border-radius: 8px;
		box-shadow: var(--shadow-elevation-high);
		overflow: hidden;
		animation: popoutFade 0.15s ease-out;
	}

	.user-popout.right {
		margin-left: 8px;
	}

	.user-popout.left {
		margin-right: 8px;
		transform-origin: right center;
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
	}

	.banner-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.banner-default {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-hover) 100%);
	}

	/* Avatar Section */
	.avatar-section {
		position: relative;
		height: 40px;
		margin-bottom: 40px;
	}

	.avatar-wrapper {
		position: absolute;
		left: 16px;
		top: -40px;
		padding: 4px;
		background: var(--bg-primary);
		border-radius: 50%;
	}

	.status-ring {
		position: absolute;
		bottom: 4px;
		right: 4px;
	}

	/* Content */
	.content {
		padding: 0 16px 16px;
	}

	/* User Info */
	.user-info {
		margin-bottom: 12px;
	}

	.display-name {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 4px 0;
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
		font-weight: 600;
		color: var(--text-secondary);
	}

	.discriminator {
		font-size: 14px;
		color: var(--text-muted);
	}

	.bot-badge {
		background: var(--brand-primary);
		color: white;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.pronouns {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 4px 0 0 0;
	}

	/* Divider */
	.divider {
		height: 1px;
		background: var(--bg-modifier-accent);
		margin: 12px 0;
	}

	/* Sections */
	.section {
		margin-bottom: 16px;
	}

	.section:last-of-type {
		margin-bottom: 12px;
	}

	.section-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin: 0 0 8px 0;
	}

	.bio {
		font-size: 14px;
		color: var(--text-primary);
		line-height: 1.4;
		margin: 0;
		white-space: pre-wrap;
	}

	.date {
		font-size: 14px;
		color: var(--text-primary);
		margin: 0;
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
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-primary);
	}

	.role-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	/* Mutual Servers */
	.servers-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.server-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-primary);
		text-align: left;
		width: 100%;
	}

	.server-item:hover {
		background: var(--bg-modifier-hover);
	}

	.server-icon {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
	}

	.server-icon-placeholder {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--brand-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 8px;
		font-weight: 700;
		color: white;
	}

	.server-name {
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.more-servers {
		font-size: 12px;
		color: var(--text-muted);
		padding-left: 8px;
	}

	/* Actions */
	.actions {
		padding-top: 12px;
		border-top: 1px solid var(--bg-modifier-accent);
	}

	.message-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px 16px;
		background: var(--brand-primary);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.message-btn:hover {
		background: var(--brand-hover);
	}

	.message-btn:active {
		transform: translateY(1px);
	}
</style>
