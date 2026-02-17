<script lang="ts">
	/**
	 * BanListSection Component
	 * 
	 * Inline ban list display for server settings with:
	 * - Search banned users
	 * - View ban reasons
	 * - Unban users (if authorized)
	 */
	
	import { createEventDispatcher, onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import Button from './Button.svelte';
	import { api, ApiError } from '$lib/api';

	export let serverId = '';
	export let canUnban = false;

	interface BannedUser {
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		reason: string | null;
		banned_at?: string;
	}

	const dispatch = createEventDispatcher<{
		unban: { userId: string };
	}>();

	let bans: BannedUser[] = [];
	let loading = false;
	let error: string | null = null;
	let unbanningUserId: string | null = null;
	let searchQuery = '';

	$: filteredBans = searchQuery.trim()
		? bans.filter(ban => {
				const query = searchQuery.toLowerCase();
				const displayName = ban.user.display_name?.toLowerCase() || '';
				const username = ban.user.username.toLowerCase();
				return displayName.includes(query) || username.includes(query);
			})
		: bans;

	onMount(async () => {
		await loadBans();
	});

	async function loadBans() {
		if (!serverId || loading) return;
		loading = true;
		error = null;
		
		try {
			bans = await api.get<BannedUser[]>(`/servers/${serverId}/bans`);
		} catch (err) {
			console.error('Failed to load bans:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to load banned users';
			}
		} finally {
			loading = false;
		}
	}

	async function handleUnban(userId: string) {
		if (unbanningUserId) return;
		unbanningUserId = userId;
		
		try {
			await api.delete(`/servers/${serverId}/bans/${userId}`);
			bans = bans.filter(ban => ban.user.id !== userId);
			dispatch('unban', { userId });
		} catch (err) {
			console.error('Failed to unban user:', err);
			if (err instanceof ApiError) {
				error = `Failed to unban: ${err.message}`;
			} else {
				error = 'Failed to unban user';
			}
		} finally {
			unbanningUserId = null;
		}
	}

	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="ban-list-section">
	<!-- Search -->
	<div class="search-section">
		<input
			type="text"
			class="search-input"
			placeholder="Search banned users..."
			bind:value={searchQuery}
			aria-label="Search banned users"
		/>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="error-message" role="alert">
			{error}
			<button class="dismiss-btn" on:click={() => error = null} aria-label="Dismiss error">
				✕
			</button>
		</div>
	{/if}

	<!-- Content -->
	<div class="ban-list-content">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<span>Loading banned users...</span>
			</div>
		{:else if bans.length === 0}
			<div class="empty-state">
				<span class="empty-icon">🚫</span>
				<p class="empty-title">No Banned Users</p>
				<p class="empty-description">There are no banned users in this server.</p>
			</div>
		{:else if filteredBans.length === 0}
			<div class="empty-state">
				<span class="empty-icon">🔍</span>
				<p class="empty-title">No Results</p>
				<p class="empty-description">No banned users match your search.</p>
			</div>
		{:else}
			<div class="ban-list" role="list">
				{#each filteredBans as ban (ban.user.id)}
					<div class="ban-item" role="listitem">
						<Avatar
							src={ban.user.avatar}
							username={ban.user.username}
							size="md"
							userId={ban.user.id}
						/>
						
						<div class="ban-info">
							<div class="user-names">
								<span class="display-name">
									{ban.user.display_name || ban.user.username}
								</span>
								{#if ban.user.display_name}
									<span class="username">@{ban.user.username}</span>
								{/if}
							</div>
							
							{#if ban.reason}
								<div class="ban-reason">
									<span class="reason-label">Reason:</span>
									<span class="reason-text">{ban.reason}</span>
								</div>
							{:else}
								<div class="ban-reason no-reason">
									<span class="reason-text">No reason provided</span>
								</div>
							{/if}

							{#if ban.banned_at}
								<div class="ban-date">
									Banned on {formatDate(ban.banned_at)}
								</div>
							{/if}
						</div>

						{#if canUnban}
							<div class="ban-actions">
								<Button
									variant="danger"
									size="sm"
									disabled={unbanningUserId === ban.user.id}
									on:click={() => handleUnban(ban.user.id)}
								>
									{#if unbanningUserId === ban.user.id}
										Unbanning...
									{:else}
										Unban
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Footer info -->
	{#if !loading && bans.length > 0}
		<div class="footer-info">
			{bans.length} banned user{bans.length === 1 ? '' : 's'}
			{#if searchQuery && filteredBans.length !== bans.length}
				· Showing {filteredBans.length}
			{/if}
		</div>
	{/if}
</div>

<style>
	.ban-list-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md, 16px);
	}

	/* Search */
	.search-section {
		padding: 0;
	}

	.search-input {
		width: 100%;
		padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-md, 4px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-sm, 14px);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.search-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	/* Error message */
	.error-message {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid var(--red, #ed4245);
		border-radius: var(--radius-md, 4px);
		color: var(--red, #ed4245);
		font-size: var(--font-size-sm, 14px);
	}

	.dismiss-btn {
		background: none;
		border: none;
		color: var(--red, #ed4245);
		cursor: pointer;
		padding: 4px;
		font-size: 12px;
		opacity: 0.8;
	}

	.dismiss-btn:hover {
		opacity: 1;
	}

	/* Content area */
	.ban-list-content {
		min-height: 200px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
		padding: var(--spacing-sm, 8px);
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-xl, 32px);
		color: var(--text-muted, #b5bac1);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--bg-modifier-accent, #4e505899);
		border-top-color: var(--blurple, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-xl, 32px);
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.5;
	}

	.empty-title {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.empty-description {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
		margin: 0;
	}

	/* Ban list */
	.ban-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 4px);
	}

	.ban-item {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px);
		background: var(--bg-tertiary, #1e1f22);
		border-radius: var(--radius-md, 4px);
		transition: background-color var(--transition-fast, 0.1s ease);
	}

	.ban-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	/* Ban info */
	.ban-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 4px);
	}

	.user-names {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-xs, 4px);
		flex-wrap: wrap;
	}

	.display-name {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.username {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
	}

	.ban-reason {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-xs, 4px);
		font-size: var(--font-size-sm, 14px);
	}

	.reason-label {
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	.reason-text {
		color: var(--text-normal, #f2f3f5);
		word-break: break-word;
	}

	.ban-reason.no-reason .reason-text {
		color: var(--text-muted, #b5bac1);
		font-style: italic;
	}

	.ban-date {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
	}

	/* Ban actions */
	.ban-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	/* Footer */
	.footer-info {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
		text-align: center;
		padding-top: var(--spacing-sm, 8px);
	}
</style>
