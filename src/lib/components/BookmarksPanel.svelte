<script lang="ts">
	import { onMount } from 'svelte';
	import {
		bookmarkItems,
		bookmarkCount,
		loadBookmarks,
		removeBookmark,
		searchBookmarks,
		updateBookmarkNote,
		updateBookmarkTags,
		clearAllBookmarks,
		type Bookmark
	} from '$lib/stores/bookmarks';

	let isOpen = false;
	let searchQuery = '';
	let searchResults: Bookmark[] | null = null;
	let editingId: string | null = null;
	let editNote = '';
	let editTagsInput = '';
	let confirmClear = false;

	onMount(async () => {
		await loadBookmarks();
	});

	$: displayedItems = searchResults ?? $bookmarkItems;

	async function handleSearch() {
		if (searchQuery.trim()) {
			searchResults = await searchBookmarks(searchQuery);
		} else {
			searchResults = null;
		}
	}

	async function handleRemove(id: string) {
		await removeBookmark(id);
		if (searchResults) {
			searchResults = searchResults.filter((b) => b.id !== id);
		}
	}

	function startEdit(bookmark: Bookmark) {
		editingId = bookmark.id;
		editNote = bookmark.note ?? '';
		editTagsInput = bookmark.tags.join(', ');
	}

	async function saveEdit() {
		if (!editingId) return;
		const tags = editTagsInput
			.split(',')
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean);
		await Promise.all([
			updateBookmarkNote(editingId, editNote || null),
			updateBookmarkTags(editingId, tags)
		]);
		editingId = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleClearAll() {
		if (!confirmClear) {
			confirmClear = true;
			return;
		}
		await clearAllBookmarks();
		searchResults = null;
		confirmClear = false;
	}

	function formatTime(ms: number): string {
		const date = new Date(ms);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	function truncate(text: string, max: number): string {
		return text.length <= max ? text : text.slice(0, max) + '...';
	}

	export function toggle() {
		isOpen = !isOpen;
	}

	export function open() {
		isOpen = true;
	}

	export function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={() => (isOpen = false)}></div>
	<aside class="panel">
		<header class="panel-header">
			<div class="header-left">
				<svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
				</svg>
				<h2>Bookmarks</h2>
				{#if $bookmarkCount > 0}
					<span class="badge">{$bookmarkCount}</span>
				{/if}
			</div>
			<div class="header-right">
				{#if $bookmarkCount > 0}
					<button
						class="clear-btn"
						class:confirm={confirmClear}
						on:click={handleClearAll}
						on:blur={() => (confirmClear = false)}
					>
						{confirmClear ? 'Confirm?' : 'Clear all'}
					</button>
				{/if}
				<button class="close-btn" on:click={() => (isOpen = false)} title="Close bookmarks">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</header>

		<div class="search-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="text"
				placeholder="Search bookmarks..."
				bind:value={searchQuery}
				on:input={handleSearch}
			/>
		</div>

		<div class="list">
			{#if displayedItems.length === 0}
				<div class="empty">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
					</svg>
					<p>{searchQuery ? 'No matching bookmarks' : 'No bookmarks yet'}</p>
					<span>Right-click a message and bookmark it to save it here.</span>
				</div>
			{:else}
				{#each displayedItems as bookmark (bookmark.id)}
					<div class="bookmark-card">
						{#if editingId === bookmark.id}
							<div class="edit-form">
								<label>
									Note
									<textarea bind:value={editNote} rows="2" placeholder="Add a note..."></textarea>
								</label>
								<label>
									Tags <span class="hint">(comma-separated)</span>
									<input type="text" bind:value={editTagsInput} placeholder="work, important..." />
								</label>
								<div class="edit-actions">
									<button class="btn-cancel" on:click={cancelEdit}>Cancel</button>
									<button class="btn-save" on:click={saveEdit}>Save</button>
								</div>
							</div>
						{:else}
							<div class="card-header">
								<div class="author">
									{#if bookmark.author_avatar}
										<img src={bookmark.author_avatar} alt="" class="avatar" />
									{:else}
										<div class="avatar-fallback">
											{bookmark.author_name.charAt(0).toUpperCase()}
										</div>
									{/if}
									<span class="author-name">{bookmark.author_name}</span>
								</div>
								<span class="time">{formatTime(bookmark.created_at)}</span>
							</div>

							<p class="content">{truncate(bookmark.content, 200)}</p>

							{#if bookmark.note}
								<div class="note">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14,2 14,8 20,8" />
									</svg>
									<span>{bookmark.note}</span>
								</div>
							{/if}

							{#if bookmark.tags.length > 0}
								<div class="tags">
									{#each bookmark.tags as tag}
										<span class="tag">#{tag}</span>
									{/each}
								</div>
							{/if}

							<div class="card-actions">
								<button class="action-btn" on:click={() => startEdit(bookmark)} title="Edit">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
								<button
									class="action-btn delete"
									on:click={() => handleRemove(bookmark.id)}
									title="Remove"
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3,6 5,6 21,6" />
										<path
											d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										/>
									</svg>
								</button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</aside>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 999;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 400px;
		max-width: 100vw;
		height: 100vh;
		background: var(--bg-primary, #1e1e2e);
		border-left: 1px solid var(--border-color, #313244);
		display: flex;
		flex-direction: column;
		z-index: 1000;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		width: 22px;
		height: 22px;
		color: var(--accent-color, #cba6f7);
	}

	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.badge {
		background: var(--bg-secondary, #313244);
		color: var(--text-secondary, #a6adc8);
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 12px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.clear-btn {
		background: transparent;
		border: 1px solid var(--border-color, #313244);
		padding: 4px 10px;
		border-radius: 6px;
		color: var(--text-secondary, #a6adc8);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.clear-btn:hover {
		border-color: #f38ba8;
		color: #f38ba8;
	}

	.clear-btn.confirm {
		background: #f38ba8;
		border-color: #f38ba8;
		color: #1e1e2e;
	}

	.close-btn {
		background: transparent;
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
	}

	.close-btn:hover {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.close-btn svg {
		width: 18px;
		height: 18px;
	}

	.search-wrap {
		position: relative;
		padding: 12px 16px;
	}

	.search-icon {
		position: absolute;
		left: 28px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: var(--text-secondary, #a6adc8);
		pointer-events: none;
	}

	.search-wrap input {
		width: 100%;
		padding: 9px 12px 9px 34px;
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
	}

	.search-wrap input:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.search-wrap input::placeholder {
		color: var(--text-secondary, #a6adc8);
	}

	.list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 16px 16px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 16px;
		text-align: center;
		color: var(--text-secondary, #a6adc8);
	}

	.empty svg {
		width: 48px;
		height: 48px;
		opacity: 0.25;
		margin-bottom: 12px;
	}

	.empty p {
		margin: 0 0 4px;
		font-size: 15px;
		color: var(--text-primary, #cdd6f4);
	}

	.empty span {
		font-size: 13px;
	}

	.bookmark-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 12px 14px;
		margin-bottom: 10px;
		border: 1px solid transparent;
		transition: border-color 0.15s;
	}

	.bookmark-card:hover {
		border-color: var(--border-color, #45475a);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.author {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
	}

	.author-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary, #cdd6f4);
	}

	.time {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
	}

	.content {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-primary, #cdd6f4);
	}

	.note {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin-top: 8px;
		padding: 6px 8px;
		background: var(--bg-tertiary, #45475a);
		border-radius: 6px;
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
	}

	.note svg {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}

	.tag {
		background: var(--bg-tertiary, #45475a);
		padding: 2px 7px;
		border-radius: 10px;
		font-size: 11px;
		color: var(--accent-color, #cba6f7);
	}

	.card-actions {
		display: flex;
		gap: 4px;
		margin-top: 8px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.bookmark-card:hover .card-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: none;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.action-btn.delete:hover {
		color: #f38ba8;
	}

	.action-btn svg {
		width: 14px;
		height: 14px;
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.edit-form label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
	}

	.hint {
		font-weight: 400;
		opacity: 0.7;
	}

	.edit-form textarea,
	.edit-form input {
		padding: 8px 10px;
		background: var(--bg-tertiary, #45475a);
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
		resize: vertical;
	}

	.edit-form textarea:focus,
	.edit-form input:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-cancel,
	.btn-save {
		padding: 6px 14px;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		transition: filter 0.15s;
	}

	.btn-cancel {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.btn-save {
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		font-weight: 500;
	}

	.btn-save:hover {
		filter: brightness(1.1);
	}
</style>
