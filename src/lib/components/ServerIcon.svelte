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
		aria-label={isHome ? 'Direct Messages' : isAdd ? 'Add a Server' : server?.name || 'Server'}
		aria-current={isSelected ? 'page' : undefined}
		type="button"
	>
		{#if isHome}
			<!-- Hearth flame icon for home -->
			<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M12 2C8.5 6 4 9.5 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-4.5-4.5-8-8-12zm0 18c-3.31 0-6-2.69-6-6 0-2.97 2.16-5.77 4-7.82V8c1.5 1.5 4 4.5 4 6 0 1.66-1.34 3-3 3s-3-1.34-3-3h2c0 .55.45 1 1 1s1-.45 1-1c0-.73-1.12-2.39-2-3.39V14c0 2.21 1.79 4 4 4s4-1.79 4-4c0-1.87-1.35-4.17-3-6.04C16.36 10.17 18 12.77 18 14c0 3.31-2.69 6-6 6z"/>
			</svg>
		{:else if isAdd}
			<!-- Plus icon for add server -->
			<svg class="icon add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
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

	/* Focus visible state for keyboard navigation */
	.server-icon:focus-visible {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: 2px;
		border-radius: 16px;
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
