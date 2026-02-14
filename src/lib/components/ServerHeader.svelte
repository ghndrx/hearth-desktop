<script lang="ts">
	import type { Server } from '$lib/stores/app';

	interface Props {
		server: Server;
		isOwner?: boolean;
		onOpenSettings?: () => void;
		onLeaveServer?: () => void;
		onInvitePeople?: () => void;
	}

	let { server, isOwner = false, onOpenSettings, onLeaveServer, onInvitePeople }: Props = $props();

	let showMenu = $state(false);

	function toggleMenu() {
		showMenu = !showMenu;
	}

	function closeMenu() {
		showMenu = false;
	}

	function handleOpenSettings() {
		closeMenu();
		onOpenSettings?.();
	}

	function handleLeaveServer() {
		closeMenu();
		onLeaveServer?.();
	}

	function handleInvitePeople() {
		closeMenu();
		onInvitePeople?.();
	}
</script>

<svelte:window onclick={closeMenu} />

<div class="server-header-wrapper">
	<button
		class="server-header"
		class:menu-open={showMenu}
		onclick={(e) => {
			e.stopPropagation();
			toggleMenu();
		}}
	>
		<h2 class="server-name">{server.name}</h2>
		<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="dropdown-icon">
			{#if showMenu}
				<path
					d="M18.4 4L12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6 18.4 20 20 18.4 13.6 12 20 5.6z"
				/>
			{:else}
				<path
					d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42z"
				/>
			{/if}
		</svg>
	</button>

	{#if showMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="server-dropdown" onclick={(e) => e.stopPropagation()}>
			<button class="dropdown-item highlight-purple" onclick={handleInvitePeople}>
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path
						d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
					/>
				</svg>
				<span>Invite People</span>
			</button>

			<div class="dropdown-divider"></div>

			<button class="dropdown-item" onclick={handleOpenSettings}>
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path
						d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
					/>
				</svg>
				<span>Server Settings</span>
			</button>

			{#if !isOwner}
				<div class="dropdown-divider"></div>

				<button class="dropdown-item danger" onclick={handleLeaveServer}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path
							d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
						/>
					</svg>
					<span>Leave Server</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.server-header-wrapper {
		position: relative;
	}

	.server-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.24);
		cursor: pointer;
		width: 100%;
		background: transparent;
		border-left: none;
		border-right: none;
		border-top: none;
		transition: background 0.15s ease;
		position: relative;
		z-index: 1;
		box-shadow:
			0 1px 0 rgba(0, 0, 0, 0.2),
			0 1.5px 0 rgba(0, 0, 0, 0.05),
			0 2px 0 rgba(0, 0, 0, 0.05);
	}

	.server-header:hover {
		background: rgba(79, 84, 92, 0.16);
	}

	.server-header.menu-open {
		background: rgba(79, 84, 92, 0.24);
	}

	.server-name {
		font-size: 15px;
		font-weight: 600;
		color: #f2f3f5;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-icon {
		color: #f2f3f5;
		flex-shrink: 0;
		transition: transform 0.2s ease;
	}

	.server-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		left: 8px;
		right: 8px;
		background: #111214;
		border-radius: 4px;
		padding: 6px 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		z-index: 100;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 6px 8px;
		background: none;
		border: none;
		border-radius: 2px;
		color: #b5bac1;
		font-size: 14px;
		cursor: pointer;
		text-align: left;
	}

	.dropdown-item:hover {
		background: var(--hearth-500, #e87620);
		color: white;
	}

	.dropdown-item:hover svg {
		fill: white;
	}

	.dropdown-item.highlight-purple {
		color: #949cf7;
	}

	.dropdown-item.highlight-purple svg {
		fill: #949cf7;
	}

	.dropdown-item.highlight-purple:hover {
		background: var(--hearth-500, #e87620);
		color: white;
	}

	.dropdown-item.danger {
		color: #f23f43;
	}

	.dropdown-item.danger svg {
		fill: #f23f43;
	}

	.dropdown-item.danger:hover {
		background: #f23f43;
		color: white;
	}

	.dropdown-divider {
		height: 1px;
		margin: 4px;
		background: rgba(79, 84, 92, 0.48);
	}
</style>
