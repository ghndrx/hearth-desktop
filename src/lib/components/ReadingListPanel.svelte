<script lang="ts">
	import { onMount } from 'svelte';
	import {
		readingListItems,
		readingListStats,
		unreadCount,
		loadReadingList,
		loadReadingListStats,
		removeFromReadingList,
		markAsRead,
		markAsUnread,
		archiveItem,
		updateItemPriority,
		searchReadingList,
		clearReadItems,
		type ReadingItem,
		type ReadingPriority
	} from '$lib/stores/readingList';

	let isOpen = false;
	let searchQuery = '';
	let searchResults: ReadingItem[] | null = null;
	let activeFilter: 'all' | 'unread' | 'high' | 'archived' = 'unread';
	let showArchived = false;

	onMount(async () => {
		await Promise.all([loadReadingList(), loadReadingListStats()]);
	});

	$: filteredItems = (() => {
		const items = searchResults ?? $readingListItems;
		switch (activeFilter) {
			case 'unread':
				return items.filter((i) => !i.isRead && !i.isArchived);
			case 'high':
				return items.filter((i) => i.priority === 'high' && !i.isArchived);
			case 'archived':
				return items.filter((i) => i.isArchived);
			default:
				return items.filter((i) => !i.isArchived);
		}
	})();

	async function handleSearch() {
		if (searchQuery.trim()) {
			searchResults = await searchReadingList(searchQuery);
		} else {
			searchResults = null;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	function typeIcon(type: string): string {
		switch (type) {
			case 'message':
				return 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z';
			case 'link':
				return 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1';
			case 'thread':
				return 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z';
			default:
				return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
		}
	}

	const priorityColors: Record<ReadingPriority, string> = {
		high: 'text-red-400',
		normal: 'text-[var(--text-muted)]',
		low: 'text-gray-500'
	};
</script>

<!-- Toggle Button -->
<button
	class="relative rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
	title="Reading List"
	onclick={() => (isOpen = !isOpen)}
>
	<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
		/>
	</svg>
	{#if $unreadCount > 0}
		<span
			class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
		>
			{$unreadCount > 9 ? '9+' : $unreadCount}
		</span>
	{/if}
</button>

<!-- Panel -->
{#if isOpen}
	<div
		class="absolute right-0 top-full z-50 mt-2 flex w-96 flex-col overflow-hidden rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] shadow-xl"
		style="max-height: 560px;"
	>
		<!-- Header -->
		<div class="border-b border-[var(--bg-tertiary)] px-4 py-3">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold text-[var(--text-primary)]">Reading List</h3>
				{#if $readingListStats}
					<span class="text-xs text-[var(--text-muted)]">
						{$readingListStats.unreadItems} unread
					</span>
				{/if}
			</div>

			<!-- Search -->
			<input
				type="text"
				class="mt-2 w-full rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
				placeholder="Search saved items..."
				bind:value={searchQuery}
				oninput={handleSearch}
			/>

			<!-- Filters -->
			<div class="mt-2 flex gap-1">
				{#each [
					{ key: 'unread', label: 'Unread' },
					{ key: 'all', label: 'All' },
					{ key: 'high', label: 'Priority' },
					{ key: 'archived', label: 'Archived' }
				] as filter}
					<button
						class="rounded px-2 py-0.5 text-xs {activeFilter === filter.key
							? 'bg-[var(--brand-500)] text-white'
							: 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'}"
						onclick={() => (activeFilter = filter.key as typeof activeFilter)}
					>
						{filter.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Items -->
		<div class="flex-1 overflow-y-auto">
			{#if filteredItems.length === 0}
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg class="mb-2 h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
					</svg>
					<p class="text-xs text-[var(--text-muted)]">
						{activeFilter === 'unread' ? 'All caught up!' : 'No items'}
					</p>
				</div>
			{:else}
				{#each filteredItems as item}
					<div
						class="group flex gap-3 border-b border-[var(--bg-tertiary)] px-4 py-3 hover:bg-[var(--bg-modifier-hover)] {item.isRead ? 'opacity-60' : ''}"
					>
						<!-- Type icon -->
						<div class="mt-0.5 flex-shrink-0">
							<svg class="h-4 w-4 {priorityColors[item.priority]}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeIcon(item.itemType)} />
							</svg>
						</div>

						<!-- Content -->
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-2">
								<h4 class="truncate text-xs font-medium text-[var(--text-primary)]">
									{item.title}
								</h4>
								<span class="flex-shrink-0 text-[10px] text-[var(--text-muted)]">
									{formatDate(item.addedAt)}
								</span>
							</div>

							{#if item.content}
								<p class="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
									{item.content}
								</p>
							{/if}

							{#if item.authorName}
								<span class="mt-1 inline-block text-[10px] text-[var(--text-muted)]">
									from {item.authorName}
								</span>
							{/if}

							{#if item.tags.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each item.tags as tag}
										<span class="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
											{tag}
										</span>
									{/each}
								</div>
							{/if}

							{#if item.estimatedReadTime}
								<span class="mt-1 inline-block text-[10px] text-[var(--text-muted)]">
									~{item.estimatedReadTime} min read
								</span>
							{/if}
						</div>

						<!-- Actions (visible on hover) -->
						<div class="flex flex-shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							<button
								class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
								title={item.isRead ? 'Mark unread' : 'Mark read'}
								onclick={() => (item.isRead ? markAsUnread(item.id) : markAsRead(item.id))}
							>
								<svg class="h-3.5 w-3.5" fill={item.isRead ? 'none' : 'currentColor'} viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							</button>
							<button
								class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
								title="Archive"
								onclick={() => archiveItem(item.id)}
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
								</svg>
							</button>
							<button
								class="rounded p-1 text-[var(--text-muted)] hover:text-red-400"
								title="Remove"
								onclick={() => removeFromReadingList(item.id)}
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Footer -->
		{#if $readingListStats && $readingListStats.readItems > 0}
			<div class="border-t border-[var(--bg-tertiary)] px-4 py-2">
				<button
					class="text-xs text-[var(--text-muted)] hover:text-red-400"
					onclick={async () => {
						await clearReadItems();
						await loadReadingListStats();
					}}
				>
					Clear {$readingListStats.readItems} read items
				</button>
			</div>
		{/if}
	</div>
{/if}
