<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { mentions, unreadMentionCount, type MentionContext } from '$lib/stores/mentions';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import EmptyState from './EmptyState.svelte';

	export let show = false;

	let filter: 'all' | 'unread' = 'unread';
	let searchQuery = '';
	let searchResults: MentionContext[] = [];
	let searching = false;

	$: visibleMentions = filter === 'unread' 
		? $mentions.mentions.filter(m => !m.read_at)
		: $mentions.mentions;

	$: displayMentions = searchQuery ? searchResults : visibleMentions;

	onMount(async () => {
		mentions.subscribeToEvents();
		await mentions.load({ unread: filter === 'unread' });
		await mentions.loadStats();
	});

	onDestroy(() => {
		mentions.unsubscribeFromEvents();
	});

	async function handleFilterChange(newFilter: 'all' | 'unread') {
		filter = newFilter;
		searchQuery = '';
		searchResults = [];
		await mentions.load({ unread: newFilter === 'unread' });
	}

	async function handleSearch() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		searching = true;
		try {
			searchResults = await mentions.search(searchQuery.trim());
		} finally {
			searching = false;
		}
	}

	async function handleMarkAsRead(mention: MentionContext) {
		if (!mention.read_at) {
			await mentions.markAsRead(mention.id);
		}
	}

	async function handleMarkAllAsRead() {
		await mentions.markAllAsRead();
	}

	function navigateToMention(mention: MentionContext) {
		handleMarkAsRead(mention);
		// Navigate to the channel/message
		if (mention.guild_id) {
			goto(`/servers/${mention.guild_id}/channels/${mention.channel_id}?message=${mention.message_id}`);
		} else {
			goto(`/channels/@me/${mention.channel_id}?message=${mention.message_id}`);
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	function getMentionTypeLabel(type: string): string {
		switch (type) {
			case 'user': return 'mentioned you';
			case 'role': return 'mentioned a role you have';
			case 'everyone': return 'mentioned @everyone';
			case 'here': return 'mentioned @here';
			default: return 'mentioned you';
		}
	}

	function getMentionTypeIcon(type: string): string {
		switch (type) {
			case 'user': return '@';
			case 'role': return '👥';
			case 'everyone': return '📢';
			case 'here': return '📍';
			default: return '@';
		}
	}
</script>

{#if show}
	<div class="mentions-panel" role="dialog" aria-label="Mentions">
		<!-- Header -->
		<div class="panel-header">
			<h2>Mentions</h2>
			{#if $unreadMentionCount > 0}
				<button 
					class="mark-all-read"
					on:click={handleMarkAllAsRead}
					aria-label="Mark all as read"
				>
					Mark all as read
				</button>
			{/if}
		</div>

		<!-- Filter tabs -->
		<div class="filter-tabs" role="tablist">
			<button
				class="filter-tab"
				class:active={filter === 'unread'}
				on:click={() => handleFilterChange('unread')}
				role="tab"
				aria-selected={filter === 'unread'}
			>
				Unread
				{#if $unreadMentionCount > 0}
					<span class="badge">{$unreadMentionCount}</span>
				{/if}
			</button>
			<button
				class="filter-tab"
				class:active={filter === 'all'}
				on:click={() => handleFilterChange('all')}
				role="tab"
				aria-selected={filter === 'all'}
			>
				All
			</button>
		</div>

		<!-- Search -->
		<div class="search-container">
			<input
				type="search"
				placeholder="Search mentions..."
				bind:value={searchQuery}
				on:input={handleSearch}
				aria-label="Search mentions"
			/>
			{#if searching}
				<LoadingSpinner size="sm" />
			{/if}
		</div>

		<!-- Mentions list -->
		<div class="mentions-list" role="list">
			{#if $mentions.loading && displayMentions.length === 0}
				<div class="loading-state">
					<LoadingSpinner />
					<p>Loading mentions...</p>
				</div>
			{:else if displayMentions.length === 0}
				<EmptyState
					icon="📬"
					title={filter === 'unread' ? 'No unread mentions' : 'No mentions yet'}
					description={filter === 'unread' 
						? 'You\'re all caught up!' 
						: 'When someone mentions you, it will appear here.'}
				/>
			{:else}
				{#each displayMentions as mention (mention.id)}
					<button
						class="mention-item"
						class:unread={!mention.read_at}
						on:click={() => navigateToMention(mention)}
						role="listitem"
					>
						<div class="mention-avatar">
							<Avatar
								src={mention.author_avatar}
								alt={mention.author_name}
								size="md"
							/>
							<span class="mention-type-icon" aria-hidden="true">
								{getMentionTypeIcon(mention.mention_type)}
							</span>
						</div>
						
						<div class="mention-content">
							<div class="mention-header">
								<span class="author-name">{mention.author_name}</span>
								<span class="mention-action">{getMentionTypeLabel(mention.mention_type)}</span>
								<time class="mention-time" datetime={mention.created_at}>
									{formatTime(mention.created_at)}
								</time>
							</div>
							
							<div class="mention-location">
								{#if mention.server_name}
									<span class="server-name">{mention.server_name}</span>
									<span class="separator">›</span>
								{/if}
								<span class="channel-name">#{mention.channel_name || 'channel'}</span>
							</div>
							
							<p class="mention-preview">{mention.preview || '(No preview available)'}</p>
						</div>

						{#if !mention.read_at}
							<div class="unread-indicator" aria-label="Unread"></div>
						{/if}
					</button>
				{/each}

				{#if $mentions.hasMore}
					<button
						class="load-more"
						on:click={() => mentions.loadMore()}
						disabled={$mentions.loading}
					>
						{$mentions.loading ? 'Loading...' : 'Load more'}
					</button>
				{/if}
			{/if}
		</div>

		<!-- Stats footer -->
		{#if $mentions.stats}
			<div class="panel-footer">
				<span>{$mentions.stats.total_count} total mentions</span>
				{#if $mentions.stats.today_count > 0}
					<span class="today-count">{$mentions.stats.today_count} today</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.mentions-panel {
		display: flex;
		flex-direction: column;
		width: 420px;
		max-height: 600px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.panel-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	.mark-all-read {
		background: none;
		border: none;
		color: var(--brand-primary, #5865f2);
		font-size: 13px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.mark-all-read:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.filter-tabs {
		display: flex;
		padding: 8px 16px;
		gap: 8px;
		border-bottom: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.filter-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.filter-tab:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.filter-tab.active {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.24));
	}

	.badge {
		background: var(--status-danger, #f23f43);
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 8px;
		min-width: 18px;
		text-align: center;
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.search-container input {
		flex: 1;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.search-container input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.search-container input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}

	.mentions-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-muted, #949ba4);
	}

	.mention-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: 100%;
		padding: 12px;
		background: none;
		border: none;
		border-radius: 4px;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.mention-item:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.mention-item.unread {
		background: var(--bg-modifier-active, rgba(79, 84, 92, 0.08));
	}

	.mention-item.unread:hover {
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.24));
	}

	.mention-avatar {
		position: relative;
		flex-shrink: 0;
	}

	.mention-type-icon {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 18px;
		height: 18px;
		background: var(--brand-primary, #5865f2);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
	}

	.mention-content {
		flex: 1;
		min-width: 0;
	}

	.mention-header {
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}

	.author-name {
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.mention-action {
		color: var(--text-muted, #949ba4);
		font-size: 13px;
	}

	.mention-time {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		margin-left: auto;
	}

	.mention-location {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.separator {
		opacity: 0.5;
	}

	.channel-name {
		color: var(--brand-primary, #5865f2);
	}

	.mention-preview {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread-indicator {
		width: 8px;
		height: 8px;
		background: var(--brand-primary, #5865f2);
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 4px;
	}

	.load-more {
		width: 100%;
		padding: 12px;
		margin-top: 8px;
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.load-more:hover:not(:disabled) {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.64));
	}

	.load-more:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-top: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.today-count {
		color: var(--brand-primary, #5865f2);
	}
</style>
