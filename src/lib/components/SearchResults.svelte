<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { 
		searchStore, 
		searchResults, 
		searchLoading, 
		searchError,
		searchTotalCount,
		searchHasMore,
		type SearchResult 
	} from '$lib/stores/search';
	import { channels as channelsStore } from '$lib/stores/channels';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher<{
		jumpToMessage: { channelId: string; messageId: string };
		close: void;
	}>();

	let searchInput = '';
	let searchInputEl: HTMLInputElement;
	let resultsContainer: HTMLDivElement;
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Debounced search
	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchStore.setFilters({ query: searchInput });
			if (searchInput.trim()) {
				searchStore.search();
			}
		}, 300);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
		}
		if (e.key === 'Enter') {
			clearTimeout(searchTimeout);
			searchStore.setFilters({ query: searchInput });
			if (searchInput.trim()) {
				searchStore.search();
			}
		}
	}

	function close() {
		searchStore.close();
		dispatch('close');
	}

	function jumpToMessage(result: SearchResult) {
		dispatch('jumpToMessage', {
			channelId: result.channel_id,
			messageId: result.id,
		});
	}

	function loadMore() {
		if ($searchHasMore && !$searchLoading) {
			searchStore.loadMore();
		}
	}

	function handleScroll() {
		if (!resultsContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = resultsContainer;
		// Load more when user is near bottom
		if (scrollHeight - scrollTop - clientHeight < 100) {
			loadMore();
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

		if (isToday) {
			return 'Today at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		}
		if (isYesterday) {
			return 'Yesterday at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		}
		return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
			' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	function truncateContent(content: string, maxLength = 150): string {
		if (!content) return '';
		if (content.length <= maxLength) return content;
		return content.slice(0, maxLength).trim() + '…';
	}

	function highlightMatches(content: string, query: string): string {
		if (!query.trim() || !content) return escapeHtml(content);
		
		const escaped = escapeHtml(content);
		const queryEscaped = escapeHtml(query);
		const regex = new RegExp(`(${escapeRegExp(queryEscaped)})`, 'gi');
		return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
	}

	function escapeHtml(str: string): string {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}

	function escapeRegExp(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function getChannelName(channelId: string): string {
		const channel = Object.values($channelsStore)
			.flat()
			.find(c => c.id === channelId);
		return channel?.name || 'Unknown Channel';
	}

	$: authorName = (result: SearchResult) => 
		result.author?.display_name || result.author?.username || 'Unknown User';

	onMount(() => {
		// Focus search input on mount
		searchInputEl?.focus();
	});
</script>

<aside class="search-panel" role="search" aria-label="Search messages">
	<!-- Header -->
	<header class="search-header">
		<div class="search-header-left">
			<svg class="search-icon-header" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
			</svg>
			<span class="search-title">Search</span>
		</div>
		<button class="close-btn" on:click={close} title="Close search" aria-label="Close search panel" type="button">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</header>

	<!-- Search Input -->
	<div class="search-input-container">
		<div class="search-input-wrapper">
			<svg class="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
			</svg>
			<input
				bind:this={searchInputEl}
				bind:value={searchInput}
				on:input={handleSearchInput}
				on:keydown={handleKeydown}
				type="text"
				class="search-input"
				placeholder="Search messages..."
				aria-label="Search messages"
				aria-describedby="search-results-count"
			/>
			{#if searchInput}
				<button 
					class="clear-btn" 
					on:click={() => { searchInput = ''; searchStore.reset(); }}
					title="Clear search"
					aria-label="Clear search"
					type="button"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Results Count -->
	{#if searchInput.trim() && !$searchLoading}
		<div class="results-count" id="search-results-count" role="status" aria-live="polite">
			{#if $searchTotalCount > 0}
				<span>{$searchTotalCount.toLocaleString()} result{$searchTotalCount !== 1 ? 's' : ''}</span>
			{:else if $searchResults.length === 0}
				<span>No results found</span>
			{/if}
		</div>
	{/if}

	<!-- Search Results -->
	<div 
		class="search-results" 
		bind:this={resultsContainer}
		on:scroll={handleScroll}
		role="list"
		aria-label="Search results"
	>
		{#if $searchLoading && $searchResults.length === 0}
			<div class="loading-container">
				<LoadingSpinner />
				<span>Searching...</span>
			</div>
		{:else if $searchError}
			<div class="error-container">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="error-icon">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
				</svg>
				<p class="error-title">Search failed</p>
				<p class="error-message">{$searchError}</p>
				<button class="retry-btn" on:click={() => searchStore.search()}>
					Try again
				</button>
			</div>
		{:else if $searchResults.length === 0 && searchInput.trim()}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
					<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
				</svg>
				<p class="empty-title">No results found</p>
				<p class="empty-message">Try a different search term or adjust your filters</p>
			</div>
		{:else if $searchResults.length === 0}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
					<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
				</svg>
				<p class="empty-title">Search messages</p>
				<p class="empty-message">Enter a search term to find messages</p>
			</div>
		{:else}
			{#each $searchResults as result (result.id)}
				<button 
					class="search-result-item"
					on:click={() => jumpToMessage(result)}
					aria-label="Message from {authorName(result)} in #{getChannelName(result.channel_id)}: {truncateContent(result.content, 50)}"
					type="button"
				>
					<div class="result-avatar">
						<Avatar
							src={result.author?.avatar || null}
							username={authorName(result)}
							size="sm"
						/>
					</div>
					<div class="result-content">
						<div class="result-header">
							<span class="result-author">{authorName(result)}</span>
							<span class="result-channel">#{getChannelName(result.channel_id)}</span>
							<span class="result-time">{formatTime(result.timestamp)}</span>
						</div>
						<p class="result-message">
							{@html highlightMatches(truncateContent(result.content), searchInput)}
						</p>
						{#if result.attachments && result.attachments.length > 0}
							<div class="result-attachments">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
									<path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
								</svg>
								<span>{result.attachments.length} attachment{result.attachments.length !== 1 ? 's' : ''}</span>
							</div>
						{/if}
					</div>
					<div class="result-jump-icon">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
						</svg>
					</div>
				</button>
			{/each}

			{#if $searchLoading}
				<div class="loading-more">
					<LoadingSpinner size="sm" />
					<span>Loading more...</span>
				</div>
			{:else if $searchHasMore}
				<button class="load-more-btn" on:click={loadMore}>
					Load more results
				</button>
			{/if}
		{/if}
	</div>
</aside>

<style>
	.search-panel {
		width: 420px;
		height: 100%;
		background-color: var(--bg-secondary, #2b2d31);
		border-left: 1px solid var(--border-subtle, #1e1f22);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	/* Header */
	.search-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		background-color: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
	}

	.search-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.search-icon-header {
		color: var(--text-muted, #949ba4);
	}

	.search-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s, color 0.15s;
	}

	.close-btn:hover {
		background-color: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}

	/* Search Input */
	.search-input-container {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	.search-input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		padding: 8px 12px;
	}

	.search-input-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 2px;
		border-radius: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s;
	}

	.clear-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	/* Results Count */
	.results-count {
		padding: 8px 16px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		flex-shrink: 0;
	}

	/* Search Results */
	.search-results {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.loading-container,
	.error-container,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
		color: var(--text-muted, #949ba4);
		gap: 12px;
	}

	.error-icon,
	.empty-icon {
		opacity: 0.5;
	}

	.error-title,
	.empty-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.error-message,
	.empty-message {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
	}

	.retry-btn {
		margin-top: 8px;
		padding: 8px 16px;
		background-color: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.retry-btn:hover {
		background-color: var(--brand-hover, #4752c4);
	}

	/* Search Result Item */
	.search-result-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
	}

	.search-result-item:hover {
		background-color: var(--bg-modifier-hover, #35373c);
	}

	.search-result-item:last-child {
		border-bottom: none;
	}

	.result-avatar {
		flex-shrink: 0;
	}

	.result-content {
		flex: 1;
		min-width: 0;
	}

	.result-header {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 4px;
		flex-wrap: wrap;
	}

	.result-author {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.result-channel {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.result-time {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-left: auto;
	}

	.result-message {
		margin: 0;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		line-height: 1.375;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	:global(.search-highlight) {
		background-color: rgba(250, 166, 26, 0.3);
		color: var(--text-normal, #f2f3f5);
		border-radius: 2px;
		padding: 0 2px;
	}

	.result-attachments {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.result-jump-icon {
		flex-shrink: 0;
		color: var(--text-muted, #949ba4);
		opacity: 0;
		transition: opacity 0.15s;
	}

	.search-result-item:hover .result-jump-icon {
		opacity: 1;
	}

	/* Loading More / Load More Button */
	.loading-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 16px;
		color: var(--text-muted, #949ba4);
		font-size: 14px;
	}

	.load-more-btn {
		display: block;
		width: calc(100% - 32px);
		margin: 8px 16px 16px;
		padding: 10px;
		background-color: var(--bg-tertiary, #383a40);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.load-more-btn:hover {
		background-color: var(--bg-modifier-hover, #404349);
	}
</style>
