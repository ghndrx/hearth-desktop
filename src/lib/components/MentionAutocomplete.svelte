<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentServer } from '$lib/stores/servers';
	import { api } from '$lib/api';

	const dispatch = createEventDispatcher<{
		select: { type: 'user' | 'role' | 'everyone' | 'here'; id?: string; name: string; display: string };
		close: void;
	}>();

	export let query = '';
	export let channelId: string;
	export let position: { x: number; y: number } = { x: 0, y: 0 };
	export let show = false;

	interface MemberResult {
		id: string;
		username: string;
		display_name?: string;
		avatar?: string;
		nickname?: string;
	}

	interface RoleResult {
		id: string;
		name: string;
		color?: number;
		mentionable: boolean;
	}

	let members: MemberResult[] = [];
	let roles: RoleResult[] = [];
	let loading = false;
	let selectedIndex = 0;

	$: serverId = $currentServer?.id;

	// Special mentions
	$: specialMentions = [
		{ type: 'everyone' as const, name: 'everyone', display: '@everyone', description: 'Notify all members' },
		{ type: 'here' as const, name: 'here', display: '@here', description: 'Notify online members' }
	].filter(s => s.name.startsWith(query.toLowerCase()));

	// Combined results for keyboard navigation
	$: allResults = [
		...specialMentions.map(s => ({ ...s, kind: 'special' as const })),
		...members.map(m => ({ ...m, kind: 'member' as const, type: 'user' as const })),
		...roles.filter(r => r.mentionable).map(r => ({ ...r, kind: 'role' as const, type: 'role' as const }))
	];

	$: if (query && show) {
		search(query);
	}

	$: selectedIndex = Math.min(selectedIndex, Math.max(0, allResults.length - 1));

	async function search(q: string) {
		if (!serverId || q.length < 1) {
			members = [];
			roles = [];
			return;
		}

		loading = true;

		try {
			// Search members
			const memberResults = await api.get<{ members: MemberResult[] }>(
				`/servers/${serverId}/members/search?query=${encodeURIComponent(q)}&limit=10`
			);
			members = memberResults.members || [];

			// Search roles (filter locally)
			const roleResults = await api.get<{ roles: RoleResult[] }>(`/servers/${serverId}/roles`);
			roles = (roleResults.roles || []).filter(r => 
				r.name.toLowerCase().includes(q.toLowerCase())
			).slice(0, 5);
		} catch (err) {
			console.error('Mention search error:', err);
			members = [];
			roles = [];
		} finally {
			loading = false;
		}
	}

	export function handleKeyDown(e: KeyboardEvent): boolean {
		if (!show || allResults.length === 0) return false;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % allResults.length;
				return true;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = (selectedIndex - 1 + allResults.length) % allResults.length;
				return true;
			case 'Tab':
			case 'Enter':
				e.preventDefault();
				selectResult(allResults[selectedIndex]);
				return true;
			case 'Escape':
				e.preventDefault();
				dispatch('close');
				return true;
		}
		return false;
	}

	function selectResult(result: typeof allResults[0]) {
		if (result.kind === 'special') {
			dispatch('select', { type: result.type, name: result.name, display: result.display });
		} else if (result.kind === 'member') {
			const displayName = result.nickname || result.display_name || result.username;
			dispatch('select', { 
				type: 'user', 
				id: result.id, 
				name: result.username, 
				display: `<@${result.id}>` 
			});
		} else if (result.kind === 'role') {
			dispatch('select', { 
				type: 'role', 
				id: result.id, 
				name: result.name, 
				display: `<@&${result.id}>` 
			});
		}
	}

	function formatRoleColor(color?: number): string {
		if (!color) return 'var(--text-muted)';
		return `#${color.toString(16).padStart(6, '0')}`;
	}
</script>

{#if show}
	<div 
		class="mention-autocomplete"
		style="left: {position.x}px; bottom: {position.y}px;"
		role="listbox"
		aria-label="Mention suggestions"
	>
		{#if loading && allResults.length === 0}
			<div class="loading">Searching...</div>
		{:else if allResults.length === 0}
			<div class="empty">No results found</div>
		{:else}
			{#each allResults as result, i (result.kind + ('id' in result ? result.id : result.name))}
				<button
					class="result-item"
					class:selected={i === selectedIndex}
					on:click={() => selectResult(result)}
					on:mouseenter={() => selectedIndex = i}
					role="option"
					aria-selected={i === selectedIndex}
				>
					{#if result.kind === 'special'}
						<div class="result-icon special">@</div>
						<div class="result-info">
							<div class="result-name">{result.display}</div>
							<div class="result-description">{result.description}</div>
						</div>
					{:else if result.kind === 'member'}
						<div class="result-icon">
							{#if result.avatar}
								<img src={result.avatar} alt="" class="avatar" />
							{:else}
								<div class="avatar-placeholder">{result.username[0].toUpperCase()}</div>
							{/if}
						</div>
						<div class="result-info">
							<div class="result-name">
								{result.nickname || result.display_name || result.username}
							</div>
							{#if result.nickname || result.display_name}
								<div class="result-username">@{result.username}</div>
							{/if}
						</div>
					{:else if result.kind === 'role'}
						<div 
							class="result-icon role-icon"
							style="background-color: {formatRoleColor(result.color)}"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
							</svg>
						</div>
						<div class="result-info">
							<div class="result-name" style="color: {formatRoleColor(result.color)}">
								@{result.name}
							</div>
						</div>
					{/if}
				</button>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.mention-autocomplete {
		position: absolute;
		min-width: 250px;
		max-width: 400px;
		max-height: 300px;
		background: var(--bg-floating, #111214);
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		overflow-y: auto;
		z-index: 1000;
	}

	.loading, .empty {
		padding: 16px;
		text-align: center;
		color: var(--text-muted, #949ba4);
		font-size: 14px;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 8px 12px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.result-item:hover,
	.result-item.selected {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.result-item.selected {
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.24));
	}

	.result-icon {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.result-icon.special {
		background: var(--brand-primary, #5865f2);
		color: white;
		font-weight: 700;
		font-size: 16px;
	}

	.result-icon .avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--brand-primary, #5865f2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 14px;
	}

	.role-icon {
		color: white;
	}

	.result-info {
		flex: 1;
		min-width: 0;
	}

	.result-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-username {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.result-description {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}
</style>
