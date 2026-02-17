<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Modal from './Modal.svelte';
	import Avatar from './Avatar.svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
		select: { channelId: string };
	}>();

	let searchQuery = '';
	let loading = false;
	let searchResults: User[] = [];
	let recentDMs: User[] = [];
	let searchInput: HTMLInputElement;

	interface User {
		id: string;
		username: string;
		display_name?: string;
		avatar?: string;
		status?: 'online' | 'idle' | 'dnd' | 'offline';
	}

	// Load recent DMs when modal opens
	$: if (open) {
		loadRecentDMs();
		// Focus search input after modal animation
		setTimeout(() => searchInput?.focus(), 100);
	}

	async function loadRecentDMs() {
		try {
			const token = localStorage.getItem('hearth_token');
			const response = await fetch('/api/v1/users/@me/channels', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (response.ok) {
				const channels = await response.json();
				// Extract recipients from DM channels
				recentDMs = channels
					.filter((c: any) => c.type === 1 && c.recipients?.length > 0)
					.slice(0, 10)
					.map((c: any) => c.recipients[0]);
			}
		} catch (e) {
			console.error('Failed to load recent DMs:', e);
		}
	}

	async function searchUsers() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		loading = true;
		try {
			const token = localStorage.getItem('hearth_token');
			const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (response.ok) {
				searchResults = await response.json();
			}
		} catch (e) {
			console.error('Failed to search users:', e);
		} finally {
			loading = false;
		}
	}

	async function startDM(user: User) {
		loading = true;
		try {
			const token = localStorage.getItem('hearth_token');
			const response = await fetch('/api/v1/users/@me/channels', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ recipient_id: user.id })
			});

			if (response.ok) {
				const channel = await response.json();
				dispatch('select', { channelId: channel.id });
				goto(`/channels/@me/${channel.id}`);
				close();
			}
		} catch (e) {
			console.error('Failed to create DM:', e);
		} finally {
			loading = false;
		}
	}

	function close() {
		open = false;
		searchQuery = '';
		searchResults = [];
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && searchResults.length > 0) {
			startDM(searchResults[0]);
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(searchUsers, 300);
	}

	function getStatusColor(status?: string): string {
		switch (status) {
			case 'online': return '#23a559';
			case 'idle': return '#f0b232';
			case 'dnd': return '#f23f43';
			default: return '#80848e';
		}
	}
</script>

<Modal {open} title="Select Friends" size="small" on:close={close}>
	<div class="dm-modal">
		<div class="search-container">
			<input
				bind:this={searchInput}
				type="text"
				bind:value={searchQuery}
				on:input={handleSearch}
				on:keydown={handleKeydown}
				placeholder="Type the username of a friend"
				class="search-input"
				disabled={loading}
			/>
		</div>

		{#if searchQuery.trim()}
			<div class="results-section">
				{#if loading}
					<div class="loading">Searching...</div>
				{:else if searchResults.length > 0}
					<div class="user-list" role="listbox" aria-label="Search results">
						{#each searchResults as user (user.id)}
							<button
								class="user-item"
								on:click={() => startDM(user)}
								role="option"
								type="button"
							>
								<div class="user-avatar">
									<Avatar src={user.avatar} alt={user.username} size="sm" />
									<div class="status-dot" style="background: {getStatusColor(user.status)}"></div>
								</div>
								<div class="user-info">
									<span class="user-name">{user.display_name || user.username}</span>
									{#if user.display_name && user.display_name !== user.username}
										<span class="user-username">@{user.username}</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{:else}
					<div class="no-results">
						<p>No users found matching "{searchQuery}"</p>
					</div>
				{/if}
			</div>
		{:else if recentDMs.length > 0}
			<div class="results-section">
				<h3 class="section-title">RECENT DMS</h3>
				<div class="user-list" role="listbox" aria-label="Recent conversations">
					{#each recentDMs as user (user.id)}
						<button
							class="user-item"
							on:click={() => startDM(user)}
							role="option"
							type="button"
						>
							<div class="user-avatar">
								<Avatar src={user.avatar} alt={user.username} size="sm" />
								<div class="status-dot" style="background: {getStatusColor(user.status)}"></div>
							</div>
							<div class="user-info">
								<span class="user-name">{user.display_name || user.username}</span>
								{#if user.display_name && user.display_name !== user.username}
									<span class="user-username">@{user.username}</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p>Search for friends to start a conversation</p>
			</div>
		{/if}
	</div>

	<svelte:fragment slot="footer">
		<div class="footer-hint">
			<span class="protip">PROTIP:</span>
			<span>Start a group DM by selecting multiple friends</span>
		</div>
	</svelte:fragment>
</Modal>

<style>
	.dm-modal {
		min-height: 300px;
	}

	.search-container {
		margin-bottom: 16px;
	}

	.search-input {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		box-sizing: border-box;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.search-input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.search-input:disabled {
		opacity: 0.5;
	}

	.results-section {
		flex: 1;
	}

	.section-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin: 0 0 8px 0;
		padding: 0 4px;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.user-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s ease;
	}

	.user-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.user-item:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: -2px;
	}

	.user-avatar {
		position: relative;
		flex-shrink: 0;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid var(--bg-primary, #313338);
		box-sizing: content-box;
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.user-name {
		display: block;
		font-size: 16px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-username {
		display: block;
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.loading,
	.no-results,
	.empty-state {
		padding: 32px 16px;
		text-align: center;
		color: var(--text-muted, #b5bac1);
	}

	.loading {
		color: var(--text-secondary, #949ba4);
	}

	.footer-hint {
		width: 100%;
		text-align: left;
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.protip {
		font-weight: 700;
		color: var(--blurple, #5865f2);
		margin-right: 4px;
	}
</style>
