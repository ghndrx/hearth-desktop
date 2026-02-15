<script lang="ts">
	import type { Server } from '$lib/stores/servers';

	export let server: Server | null = null;
	export let isHome: boolean = false;
	export let isAdd: boolean = false;
	export let isSelected: boolean = false;
	export let hasUnread: boolean = false;
	export let mentionCount: number = 0;

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	$: showPill = isSelected || hasUnread;
	$: pillHeight = isSelected ? 40 : hasUnread ? 8 : 0;
</script>

<div class="server-icon-wrapper">
	<!-- Pill indicator -->
	<div
		class="pill-indicator"
		class:pill-visible={showPill}
		class:pill-selected={isSelected}
		class:pill-hover={!isSelected && !hasUnread}
		style="height: {pillHeight}px"
	></div>

	<!-- Server icon button -->
	<button
		class="server-icon"
		class:selected={isSelected}
		class:home={isHome}
		class:add={isAdd}
		on:click
	>
		{#if isHome}
			<!-- Discord logo for home -->
			<svg class="icon" viewBox="0 0 24 24" fill="currentColor">
				<path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
			</svg>
		{:else if isAdd}
			<!-- Plus icon for add server -->
			<svg class="icon add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		{:else if server}
			{#if server.icon}
				<img
					src={server.icon}
					alt={server.name}
					class="server-image"
				/>
			{:else}
				<span class="server-initials">
					{getInitials(server.name)}
				</span>
			{/if}
		{/if}

		<!-- Unread indicator (white dot) -->
		{#if hasUnread && !isSelected}
			<div class="unread-dot"></div>
		{/if}

		<!-- Mention badge -->
		{#if mentionCount > 0}
			<div class="mention-badge">
				{mentionCount > 99 ? '99+' : mentionCount}
			</div>
		{/if}
	</button>

	<!-- Tooltip -->
	{#if server || isHome || isAdd}
		<div class="tooltip">
			{#if isHome}
				Direct Messages
			{:else if isAdd}
				Add a Server
			{:else if server}
				{server.name}
			{/if}
		</div>
	{/if}
</div>

<style>
	.server-icon-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 72px;
		justify-content: center;
	}

	/* Pill indicator on the left */
	.pill-indicator {
		position: absolute;
		left: 0;
		width: 4px;
		border-radius: 0 4px 4px 0;
		background-color: white;
		transition: height 0.15s ease-out;
		height: 0;
	}

	.pill-visible {
		opacity: 1;
	}

	.pill-selected {
		height: 40px !important;
	}

	/* Show pill on hover if not selected and no unread */
	.server-icon-wrapper:hover .pill-indicator.pill-hover {
		height: 20px;
	}

	.server-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background-color: #313338;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #dcddde;
		transition: border-radius 0.15s ease-out, background-color 0.15s ease-out;
		overflow: hidden;
		position: relative;
	}

	/* Hover: becomes rounded-2xl (16px border radius) */
	.server-icon:hover {
		border-radius: 16px;
		background-color: #5865f2;
		color: white;
	}

	/* Selected state */
	.server-icon.selected {
		border-radius: 16px;
		background-color: #5865f2;
		color: white;
	}

	/* Home button specific styling */
	.server-icon.home {
		background-color: #313338;
	}

	.server-icon.home:hover,
	.server-icon.home.selected {
		background-color: #5865f2;
	}

	/* Add button specific styling */
	.server-icon.add {
		background-color: #313338;
		color: #23a559;
	}

	.server-icon.add:hover {
		background-color: #23a559;
		color: white;
	}

	.icon {
		width: 24px;
		height: 24px;
	}

	.add-icon {
		width: 20px;
		height: 20px;
	}

	.server-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}

	.server-initials {
		font-size: 18px;
		font-weight: 600;
		text-transform: uppercase;
		user-select: none;
	}

	/* Unread dot (white dot to the left) */
	.unread-dot {
		position: absolute;
		left: -14px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: white;
	}

	/* Mention badge (red circle with count) */
	.mention-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background-color: #ed4245;
		color: white;
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 3px solid #1e1f22;
		box-sizing: content-box;
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

	/* Tooltip arrow */
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
