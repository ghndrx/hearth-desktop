<script lang="ts">
	import { servers, currentServer } from '$lib/stores/servers';
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import CreateServerModal from './CreateServerModal.svelte';
	import ServerIcon from './ServerIcon.svelte';
	import ServerFolder from './ServerFolder.svelte';
	import { handleListKeyboard } from '$lib/utils/keyboard';
	import type { Server } from '$lib/stores/servers';

	const dispatch = createEventDispatcher();

	let showCreateModal = false;
	let serverListElement: HTMLElement;

	// Server folders - can be populated from a store in production
	interface ServerFolderData {
		id: string;
		name: string;
		serverIds: string[];
		color: string;
		expanded: boolean;
	}

	// Example folders - in production this would come from a store
	let folders: ServerFolderData[] = [];

	// Mock unread data - in real app would come from store
	const unreadServers: Record<string, boolean> = {};
	const mentionCounts: Record<string, number> = {};

	// Get servers in a folder
	function getFolderServers(folder: ServerFolderData): Server[] {
		return folder.serverIds
			.map((id) => $servers.find((s) => s.id === id))
			.filter((s): s is Server => s !== undefined);
	}

	// Get servers not in any folder
	$: standaloneServers = $servers.filter(
		(server) => !folders.some((folder) => folder.serverIds.includes(server.id))
	);

	function selectServer(server: Server | null) {
		currentServer.set(server);
		if (server) {
			goto(`/channels/${server.id}/general`);
		} else {
			goto('/channels/@me');
		}
		dispatch('select', server);
	}

	function goToDMs() {
		currentServer.set(null);
		goto('/channels/@me');
	}

	function openCreateServer() {
		showCreateModal = true;
	}

	function closeCreateServer() {
		showCreateModal = false;
	}

	function handleServerCreated(event: CustomEvent<Server>) {
		const server = event.detail;
		showCreateModal = false;
		currentServer.set(server);
		// Navigate to the new server - use 'general' as default channel
		goto(`/channels/${server.id}/general`);
	}

	function toggleFolder(folderId: string) {
		folders = folders.map((f) =>
			f.id === folderId ? { ...f, expanded: !f.expanded } : f
		);
	}

	function getServerButtons(): HTMLElement[] {
		if (!serverListElement) return [];
		return Array.from(serverListElement.querySelectorAll<HTMLElement>('button.server-icon, button.explore-icon'));
	}

	function handleKeydown(event: KeyboardEvent) {
		const buttons = getServerButtons();
		if (buttons.length === 0) return;

		const currentButton = document.activeElement as HTMLElement;
		const currentIndex = buttons.indexOf(currentButton);
		if (currentIndex === -1) return;

		const { handled, newIndex } = handleListKeyboard(event, currentIndex, buttons.length, {
			wrap: true
		});

		if (handled && newIndex !== currentIndex) {
			buttons[newIndex]?.focus();
		}
	}
</script>

<nav 
	bind:this={serverListElement}
	class="server-list" 
	aria-label="Servers"
	on:keydown={handleKeydown}
>
	<!-- Home/DM button -->
	<ServerIcon
		isHome={true}
		isSelected={$currentServer === null}
		on:click={goToDMs}
	/>

	<!-- Separator -->
	<div class="separator" role="separator"></div>

	<!-- Server folders -->
	{#each folders as folder (folder.id)}
		{@const folderServers = getFolderServers(folder)}
		<ServerFolder
			name={folder.name}
			servers={folderServers.map((s) => ({
				...s,
				hasUnread: unreadServers[s.id] || false,
				mentionCount: mentionCounts[s.id] || 0
			}))}
			selectedServerId={$currentServer?.id || null}
			expanded={folder.expanded}
			color={folder.color}
			on:click={(e) => {
				const detail = (e as unknown as CustomEvent<{server: any}>).detail;
				if (detail?.server) {
					selectServer(detail.server);
				}
			}}
		/>
	{/each}

	<!-- Standalone servers (not in folders) -->
	{#each standaloneServers as server (server.id)}
		<ServerIcon
			{server}
			isSelected={$currentServer?.id === server.id}
			hasUnread={unreadServers[server.id] || false}
			mentionCount={mentionCounts[server.id] || 0}
			on:click={() => selectServer(server)}
		/>
	{/each}

	<!-- Add server button -->
	<ServerIcon
		isAdd={true}
		on:click={openCreateServer}
	/>

	<!-- Explore servers button -->
	<div class="server-icon-wrapper">
		<button
			class="explore-icon"
			on:click={() => goto('/guild-discovery')}
			aria-label="Explore public servers"
			type="button"
		>
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</button>
		<div class="tooltip" role="tooltip">
			Explore Public Servers
		</div>
	</div>
</nav>

<CreateServerModal open={showCreateModal} on:close={closeCreateServer} on:created={handleServerCreated} />

<style>
	.server-list {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 0;
		width: 72px;
		height: 100%;
		background-color: #1e1f22;
		overflow-y: auto;
		overflow-x: hidden;
		flex-shrink: 0;
	}

	/* Hide scrollbar but keep functionality */
	.server-list::-webkit-scrollbar {
		width: 0;
		height: 0;
	}

	.server-list {
		scrollbar-width: none;
	}

	.separator {
		width: 32px;
		height: 2px;
		background-color: #35363c;
		border-radius: 1px;
		flex-shrink: 0;
		margin: 4px 0;
	}

	/* Explore button styles */
	.server-icon-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 72px;
		justify-content: center;
	}

	.explore-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background-color: #313338;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #23a559;
		transition: border-radius 0.15s ease-out, background-color 0.15s ease-out;
	}

	.explore-icon:hover {
		border-radius: 16px;
		background-color: #23a559;
		color: white;
	}

	.explore-icon:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
		border-radius: 16px;
	}

	.explore-icon .icon {
		width: 20px;
		height: 20px;
	}

	/* Tooltip */
	.tooltip {
		position: absolute;
		left: calc(100% - 4px);
		margin-left: 12px;
		padding: 8px 12px;
		background-color: #111214;
		color: #dbdee1;
		font-size: 14px;
		font-weight: 500;
		border-radius: 4px;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transform: scale(0.95);
		transition: opacity 0.1s ease-out, transform 0.1s ease-out;
		z-index: 1000;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
	}

	.tooltip::before {
		content: '';
		position: absolute;
		left: -6px;
		top: 50%;
		transform: translateY(-50%);
		border: 6px solid transparent;
		border-right-color: #111214;
		border-left: none;
	}

	.server-icon-wrapper:hover .tooltip {
		opacity: 1;
		transform: scale(1);
	}
</style>
