<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	const dispatch = createEventDispatcher<{
		'session-switch': { sessionId: string };
		'session-close': { sessionId: string };
		'session-new': void;
		close: void;
	}>();

	interface Session {
		id: string;
		name: string;
		type: 'chat' | 'dm' | 'group' | 'ai';
		lastMessage?: string;
		lastActivity: Date;
		unreadCount: number;
		isPinned: boolean;
		isActive: boolean;
		avatar?: string;
		participants?: string[];
	}

	// Props
	export let isOpen = false;
	export let sessions: Session[] = [];
	export let currentSessionId: string | null = null;

	// State
	let searchQuery = '';
	let filterType: 'all' | 'chat' | 'dm' | 'group' | 'ai' = 'all';
	let sortBy: 'recent' | 'unread' | 'name' = 'recent';
	let showPinnedOnly = false;
	let selectedIndex = 0;
	let searchInput: HTMLInputElement;
	let sessionListEl: HTMLElement;

	// Computed filtered and sorted sessions
	$: filteredSessions = sessions
		.filter((s) => {
			// Filter by type
			if (filterType !== 'all' && s.type !== filterType) return false;
			// Filter by pinned
			if (showPinnedOnly && !s.isPinned) return false;
			// Filter by search query
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					s.name.toLowerCase().includes(query) ||
					s.lastMessage?.toLowerCase().includes(query) ||
					s.participants?.some((p) => p.toLowerCase().includes(query))
				);
			}
			return true;
		})
		.sort((a, b) => {
			// Pinned sessions always first
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;

			// Then sort by selected criteria
			switch (sortBy) {
				case 'unread':
					return b.unreadCount - a.unreadCount;
				case 'name':
					return a.name.localeCompare(b.name);
				case 'recent':
				default:
					return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
			}
		});

	// Reset selection when filter changes
	$: if (filteredSessions) {
		selectedIndex = Math.min(selectedIndex, Math.max(0, filteredSessions.length - 1));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				close();
				break;
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredSessions.length - 1);
				scrollToSelected();
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				scrollToSelected();
				break;
			case 'Enter':
				event.preventDefault();
				if (filteredSessions[selectedIndex]) {
					selectSession(filteredSessions[selectedIndex]);
				}
				break;
			case 'Delete':
			case 'Backspace':
				if (event.metaKey || event.ctrlKey) {
					event.preventDefault();
					if (filteredSessions[selectedIndex]) {
						closeSession(filteredSessions[selectedIndex].id);
					}
				}
				break;
			case 'n':
				if (event.metaKey || event.ctrlKey) {
					event.preventDefault();
					dispatch('session-new');
				}
				break;
		}
	}

	function scrollToSelected() {
		const items = sessionListEl?.querySelectorAll('[data-session-item]');
		items?.[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	function selectSession(session: Session) {
		dispatch('session-switch', { sessionId: session.id });
		close();
	}

	function closeSession(sessionId: string) {
		dispatch('session-close', { sessionId });
	}

	function togglePin(session: Session, event: MouseEvent) {
		event.stopPropagation();
		session.isPinned = !session.isPinned;
		sessions = [...sessions]; // Trigger reactivity
	}

	function close() {
		isOpen = false;
		searchQuery = '';
		selectedIndex = 0;
		dispatch('close');
	}

	function formatLastActivity(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - new Date(date).getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(date).toLocaleDateString();
	}

	function getSessionIcon(type: Session['type']): string {
		switch (type) {
			case 'dm':
				return '💬';
			case 'group':
				return '👥';
			case 'ai':
				return '🤖';
			case 'chat':
			default:
				return '#';
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		if (isOpen && searchInput) {
			searchInput.focus();
		}
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});

	$: if (isOpen && searchInput) {
		setTimeout(() => searchInput?.focus(), 50);
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="session-manager-backdrop"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="session-manager"
			transition:fly={{ y: -20, duration: 200, easing: cubicOut }}
			role="dialog"
			aria-label="Session Manager"
			aria-modal="true"
		>
			<!-- Header -->
			<div class="session-manager-header">
				<h2>Sessions</h2>
				<div class="header-actions">
					<button
						class="new-session-btn"
						on:click={() => dispatch('session-new')}
						title="New Session (⌘N)"
					>
						<span class="icon">+</span>
						New
					</button>
					<button class="close-btn" on:click={close} title="Close (Esc)">
						<span class="icon">✕</span>
					</button>
				</div>
			</div>

			<!-- Search and Filters -->
			<div class="session-manager-controls">
				<div class="search-container">
					<span class="search-icon">🔍</span>
					<input
						bind:this={searchInput}
						bind:value={searchQuery}
						type="text"
						placeholder="Search sessions..."
						class="search-input"
						aria-label="Search sessions"
					/>
					{#if searchQuery}
						<button class="clear-search" on:click={() => (searchQuery = '')} title="Clear search">
							✕
						</button>
					{/if}
				</div>

				<div class="filter-row">
					<div class="filter-group">
						<label for="filter-type">Type:</label>
						<select id="filter-type" bind:value={filterType}>
							<option value="all">All</option>
							<option value="chat">Channels</option>
							<option value="dm">DMs</option>
							<option value="group">Groups</option>
							<option value="ai">AI</option>
						</select>
					</div>

					<div class="filter-group">
						<label for="sort-by">Sort:</label>
						<select id="sort-by" bind:value={sortBy}>
							<option value="recent">Recent</option>
							<option value="unread">Unread</option>
							<option value="name">Name</option>
						</select>
					</div>

					<label class="pinned-toggle">
						<input type="checkbox" bind:checked={showPinnedOnly} />
						<span>Pinned only</span>
					</label>
				</div>
			</div>

			<!-- Session List -->
			<div class="session-list" bind:this={sessionListEl} role="listbox">
				{#if filteredSessions.length === 0}
					<div class="empty-state">
						<span class="empty-icon">📭</span>
						<p>No sessions found</p>
						{#if searchQuery}
							<button class="clear-filters" on:click={() => (searchQuery = '')}>
								Clear search
							</button>
						{/if}
					</div>
				{:else}
					{#each filteredSessions as session, index (session.id)}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<div
							class="session-item"
							class:selected={index === selectedIndex}
							class:active={session.id === currentSessionId}
							class:pinned={session.isPinned}
							data-session-item
							role="option"
							aria-selected={index === selectedIndex}
							on:click={() => selectSession(session)}
							on:mouseenter={() => (selectedIndex = index)}
							transition:scale={{ duration: 150, start: 0.95 }}
						>
							<div class="session-icon" class:has-avatar={session.avatar}>
								{#if session.avatar}
									<img src={session.avatar} alt="" class="avatar" />
								{:else}
									<span>{getSessionIcon(session.type)}</span>
								{/if}
							</div>

							<div class="session-info">
								<div class="session-name-row">
									<span class="session-name">{session.name}</span>
									{#if session.isPinned}
										<span class="pin-badge" title="Pinned">📌</span>
									{/if}
									{#if session.unreadCount > 0}
										<span class="unread-badge">{session.unreadCount}</span>
									{/if}
								</div>
								{#if session.lastMessage}
									<p class="last-message">{session.lastMessage}</p>
								{/if}
								<span class="last-activity">{formatLastActivity(session.lastActivity)}</span>
							</div>

							<div class="session-actions">
								<button
									class="action-btn pin-btn"
									class:pinned={session.isPinned}
									on:click={(e) => togglePin(session, e)}
									title={session.isPinned ? 'Unpin' : 'Pin'}
								>
									📌
								</button>
								<button
									class="action-btn close-btn"
									on:click|stopPropagation={() => closeSession(session.id)}
									title="Close session (⌘⌫)"
								>
									✕
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer with keyboard hints -->
			<div class="session-manager-footer">
				<span class="hint"><kbd>↑↓</kbd> Navigate</span>
				<span class="hint"><kbd>Enter</kbd> Select</span>
				<span class="hint"><kbd>⌘⌫</kbd> Close</span>
				<span class="hint"><kbd>Esc</kbd> Dismiss</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.session-manager-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 10vh;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.session-manager {
		background: var(--bg-primary, #1e1e1e);
		border-radius: 12px;
		width: 90%;
		max-width: 600px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}

	.session-manager-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color, #333);
	}

	.session-manager-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.new-session-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: var(--accent-color, #5865f2);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.new-session-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	.close-btn {
		padding: 6px 10px;
		background: transparent;
		color: var(--text-secondary, #aaa);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: var(--bg-secondary, #2a2a2a);
		color: var(--text-primary, #fff);
	}

	.session-manager-controls {
		padding: 12px 20px;
		border-bottom: 1px solid var(--border-color, #333);
	}

	.search-container {
		position: relative;
		display: flex;
		align-items: center;
		margin-bottom: 12px;
	}

	.search-icon {
		position: absolute;
		left: 12px;
		font-size: 14px;
		opacity: 0.5;
	}

	.search-input {
		width: 100%;
		padding: 10px 36px;
		background: var(--bg-secondary, #2a2a2a);
		border: 1px solid var(--border-color, #333);
		border-radius: 8px;
		color: var(--text-primary, #fff);
		font-size: 14px;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		border-color: var(--accent-color, #5865f2);
	}

	.search-input::placeholder {
		color: var(--text-secondary, #888);
	}

	.clear-search {
		position: absolute;
		right: 8px;
		padding: 4px 8px;
		background: transparent;
		border: none;
		color: var(--text-secondary, #888);
		cursor: pointer;
		font-size: 12px;
	}

	.clear-search:hover {
		color: var(--text-primary, #fff);
	}

	.filter-row {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.filter-group label {
		font-size: 12px;
		color: var(--text-secondary, #888);
	}

	.filter-group select {
		padding: 4px 8px;
		background: var(--bg-secondary, #2a2a2a);
		border: 1px solid var(--border-color, #333);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-size: 12px;
		cursor: pointer;
	}

	.pinned-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-secondary, #888);
		cursor: pointer;
	}

	.pinned-toggle input {
		cursor: pointer;
	}

	.session-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-secondary, #888);
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.empty-state p {
		margin: 0 0 12px;
	}

	.clear-filters {
		padding: 8px 16px;
		background: var(--bg-secondary, #2a2a2a);
		border: 1px solid var(--border-color, #333);
		border-radius: 6px;
		color: var(--text-primary, #fff);
		cursor: pointer;
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.session-item:hover,
	.session-item.selected {
		background: var(--bg-secondary, #2a2a2a);
	}

	.session-item.active {
		background: var(--accent-color-subtle, rgba(88, 101, 242, 0.2));
		border-left: 3px solid var(--accent-color, #5865f2);
	}

	.session-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #333);
		border-radius: 50%;
		font-size: 18px;
		flex-shrink: 0;
	}

	.session-icon.has-avatar {
		background: transparent;
	}

	.session-icon .avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.session-name {
		font-weight: 500;
		color: var(--text-primary, #fff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pin-badge {
		font-size: 12px;
	}

	.unread-badge {
		background: var(--accent-color, #5865f2);
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
	}

	.last-message {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--text-secondary, #888);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.last-activity {
		font-size: 11px;
		color: var(--text-muted, #666);
	}

	.session-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.session-item:hover .session-actions,
	.session-item.selected .session-actions {
		opacity: 1;
	}

	.action-btn {
		padding: 6px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		opacity: 0.6;
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-tertiary, #333);
		opacity: 1;
	}

	.action-btn.pin-btn.pinned {
		opacity: 1;
	}

	.session-manager-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 10px 20px;
		border-top: 1px solid var(--border-color, #333);
		background: var(--bg-secondary, #2a2a2a);
	}

	.hint {
		font-size: 11px;
		color: var(--text-muted, #666);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	kbd {
		background: var(--bg-tertiary, #333);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 10px;
		font-family: inherit;
	}

	/* Scrollbar styling */
	.session-list::-webkit-scrollbar {
		width: 8px;
	}

	.session-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.session-list::-webkit-scrollbar-thumb {
		background: var(--border-color, #333);
		border-radius: 4px;
	}

	.session-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #555);
	}
</style>
