<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { api } from '$lib/api';
	import { channels } from '$lib/stores/channels';
	import { servers } from '$lib/stores/servers';
	import { user } from '$lib/stores/auth';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
		select: { type: string; id: string };
	}>();

	interface QuickResult {
		id: string;
		type: 'channel' | 'dm' | 'server' | 'user';
		name: string;
		description?: string | null;
		icon?: string | null;
		serverId?: string | null;
		serverName?: string | null;
	}

	let query = '';
	let inputEl: HTMLInputElement;
	let results: QuickResult[] = [];
	let loading = false;
	let selectedIndex = 0;
	let searchTimeout: ReturnType<typeof setTimeout>;

	// Build local results from stores
	function getLocalResults(q: string): QuickResult[] {
		const lowerQ = q.toLowerCase();
		const items: QuickResult[] = [];

		// Search servers
		for (const server of $servers) {
			if (server.name.toLowerCase().includes(lowerQ)) {
				items.push({
					id: server.id,
					type: 'server',
					name: server.name,
					icon: server.icon,
					description: `${server.member_count || 0} members`,
				});
			}
		}

		// Search channels
		for (const channel of $channels) {
			const channelName = channel.name || '';
			if (channelName.toLowerCase().includes(lowerQ)) {
				const server = $servers.find(s => s.id === channel.server_id);
				if (channel.type === 0 || channel.type === 2) {
					// Server text/voice channel
					items.push({
						id: channel.id,
						type: 'channel',
						name: `#${channelName}`,
						serverId: channel.server_id,
						serverName: server?.name,
						description: channel.topic || server?.name,
					});
				}
			}
		}

		// Search DMs
		for (const dm of $channels.filter(c => c.type === 1 || c.type === 3)) {
			const dmName = dm.name || dm.recipients?.map(r => r.display_name || r.username).join(', ') || '';
			if (dmName.toLowerCase().includes(lowerQ)) {
				items.push({
					id: dm.id,
					type: 'dm',
					name: dmName,
					icon: dm.recipients?.[0]?.avatar,
					description: dm.type === 3 ? 'Group DM' : 'Direct Message',
				});
			}
		}

		return items.slice(0, 10);
	}

	// Fetch remote results for user search
	async function searchRemote(q: string) {
		if (q.length < 2) return;
		
		loading = true;
		try {
			const response = await api.get<{ users: Array<{ id: string; username: string; display_name?: string; avatar?: string }> }>(
				`/search/users?q=${encodeURIComponent(q)}&limit=5`
			);
			
			if (response.users) {
				const userResults: QuickResult[] = response.users
					.filter(u => u.id !== $user?.id) // Exclude self
					.map(u => ({
						id: u.id,
						type: 'user' as const,
						name: u.display_name || u.username,
						icon: u.avatar,
						description: `@${u.username}`,
					}));
				
				// Merge with local results, avoiding duplicates
				const localIds = new Set(results.map(r => r.id));
				results = [...results, ...userResults.filter(u => !localIds.has(u.id))].slice(0, 15);
			}
		} catch (err) {
			console.error('Failed to search users:', err);
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		clearTimeout(searchTimeout);
		selectedIndex = 0;
		
		if (!query.trim()) {
			results = getRecentItems();
			return;
		}

		// Get local results immediately
		results = getLocalResults(query);

		// Debounce remote search
		searchTimeout = setTimeout(() => {
			searchRemote(query);
		}, 200);
	}

	function getRecentItems(): QuickResult[] {
		// Show recent DMs and favorite servers when no query
		const items: QuickResult[] = [];
		
		// Add recent DMs (first 5)
		for (const dm of $channels.filter(c => c.type === 1 || c.type === 3).slice(0, 5)) {
			const dmName = dm.name || dm.recipients?.map(r => r.display_name || r.username).join(', ') || 'Unknown';
			items.push({
				id: dm.id,
				type: 'dm',
				name: dmName,
				icon: dm.recipients?.[0]?.avatar,
				description: dm.type === 3 ? 'Group DM' : 'Direct Message',
			});
		}

		// Add servers
		for (const server of $servers.slice(0, 5)) {
			items.push({
				id: server.id,
				type: 'server',
				name: server.name,
				icon: server.icon,
			});
		}

		return items;
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (results[selectedIndex]) {
					selectResult(results[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
		}
	}

	async function selectResult(result: QuickResult) {
		switch (result.type) {
			case 'channel':
				if (result.serverId) {
					goto(`/channels/${result.serverId}/${result.id}`);
				}
				break;
			case 'dm':
				goto(`/channels/@me/${result.id}`);
				break;
			case 'server':
				goto(`/channels/${result.id}`);
				break;
			case 'user':
				// Create or get DM with user
				try {
					const dm = await api.post<{ id: string }>('/users/@me/channels', {
						recipient_id: result.id,
					});
					goto(`/channels/@me/${dm.id}`);
				} catch (err) {
					console.error('Failed to create DM:', err);
				}
				break;
		}
		dispatch('select', { type: result.type, id: result.id });
		close();
	}

	function close() {
		query = '';
		results = [];
		selectedIndex = 0;
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'channel': return '#';
			case 'dm': return '@';
			case 'server': return '🏠';
			case 'user': return '👤';
			default: return '';
		}
	}

	$: if (open) {
		results = getRecentItems();
		// Focus input after mount
		setTimeout(() => inputEl?.focus(), 50);
	}

	onDestroy(() => {
		clearTimeout(searchTimeout);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="quick-switcher-backdrop" 
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
	>
		<div 
			class="quick-switcher" 
			role="dialog" 
			aria-modal="true" 
			aria-label="Quick Switcher"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="search-container">
				<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					on:input={handleInput}
					on:keydown={handleKeydown}
					type="text"
					class="search-input"
					placeholder="Where would you like to go?"
					aria-label="Search for channels, servers, or users"
				/>
				{#if loading}
					<div class="loading-indicator">
						<LoadingSpinner size="sm" />
					</div>
				{/if}
			</div>

			<div class="results-container" role="listbox" aria-label="Search results">
				{#if results.length === 0}
					<div class="no-results">
						{#if query.trim()}
							<p>No results found for "{query}"</p>
							<p class="hint">Try searching for a channel, server, or user</p>
						{:else}
							<p>Start typing to search</p>
						{/if}
					</div>
				{:else}
					{#if !query.trim()}
						<div class="section-header">Recent</div>
					{/if}
					{#each results as result, i (result.id)}
						<button
							class="result-item"
							class:selected={i === selectedIndex}
							on:click={() => selectResult(result)}
							on:mouseenter={() => selectedIndex = i}
							role="option"
							aria-selected={i === selectedIndex}
							type="button"
						>
							<div class="result-icon">
								{#if result.type === 'user' || result.type === 'dm'}
									<Avatar 
										src={result.icon} 
										username={result.name} 
										size="sm" 
									/>
								{:else if result.type === 'server' && result.icon}
									<img src={result.icon} alt="" class="server-icon" />
								{:else}
									<span class="type-icon">{getTypeIcon(result.type)}</span>
								{/if}
							</div>
							<div class="result-content">
								<span class="result-name">{result.name}</span>
								{#if result.description}
									<span class="result-description">{result.description}</span>
								{/if}
							</div>
							<span class="result-type">{result.type}</span>
						</button>
					{/each}
				{/if}
			</div>

			<div class="footer">
				<div class="hint-group">
					<span class="key">↑↓</span>
					<span>Navigate</span>
				</div>
				<div class="hint-group">
					<span class="key">Enter</span>
					<span>Select</span>
				</div>
				<div class="hint-group">
					<span class="key">Esc</span>
					<span>Close</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.quick-switcher-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 100px;
		z-index: 10000;
	}

	.quick-switcher {
		width: 100%;
		max-width: 540px;
		background: var(--bg-floating, #313338);
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
	}

	.search-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.loading-indicator {
		flex-shrink: 0;
	}

	.results-container {
		max-height: 400px;
		overflow-y: auto;
		padding: 8px;
	}

	.section-header {
		padding: 8px 12px 4px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.no-results {
		padding: 24px;
		text-align: center;
		color: var(--text-muted, #949ba4);
	}

	.no-results p {
		margin: 0;
	}

	.no-results .hint {
		font-size: 13px;
		margin-top: 4px;
		opacity: 0.7;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s;
	}

	.result-item:hover,
	.result-item.selected {
		background: var(--bg-modifier-hover, #35373c);
	}

	.result-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg-tertiary, #1e1f22);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.type-icon {
		font-size: 16px;
		color: var(--text-muted, #949ba4);
	}

	.server-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.result-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.result-name {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-description {
		font-size: 13px;
		color: var(--text-muted, #949ba4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-type {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
		padding: 2px 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		flex-shrink: 0;
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid var(--border-subtle, #1e1f22);
	}

	.hint-group {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.key {
		padding: 2px 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		font-weight: 600;
		font-family: monospace;
	}
</style>
