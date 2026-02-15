<script lang="ts">
	import type { Server } from '$lib/stores/servers';
	import ServerIcon from './ServerIcon.svelte';

	export let name: string;
	export let servers: Server[] = [];
	export let selectedServerId: string | null = null;
	export let expanded: boolean = false;
	export let color: string = '#5865f2';

	// Calculate folder state
	$: hasUnread = servers.some((s) => (s as any).hasUnread);
	$: totalMentions = servers.reduce((sum, s) => sum + ((s as any).mentionCount || 0), 0);
	$: hasSelectedServer = servers.some((s) => s.id === selectedServerId);

	function toggleExpanded() {
		expanded = !expanded;
	}

	function getPreviewIcons(servers: Server[]): Server[] {
		return servers.slice(0, 4);
	}
</script>

<div class="server-folder-wrapper">
	{#if expanded}
		<!-- Expanded folder: show all servers -->
		<div class="folder-expanded">
			<div class="folder-header" on:click={toggleExpanded} on:keydown={(e) => e.key === 'Enter' && toggleExpanded()} role="button" tabindex="0">
				<span class="folder-name">{name}</span>
				<svg class="collapse-icon" viewBox="0 0 24 24" fill="currentColor">
					<path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
				</svg>
			</div>
			<div class="folder-servers">
				{#each servers as server (server.id)}
					<ServerIcon
						{server}
						isSelected={selectedServerId === server.id}
						hasUnread={(server as any).hasUnread || false}
						mentionCount={(server as any).mentionCount || 0}
						on:click
					/>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Collapsed folder: show preview grid -->
		<div class="server-icon-wrapper">
			<!-- Pill indicator -->
			{#if hasSelectedServer}
				<div class="pill-indicator pill-selected"></div>
			{:else if hasUnread}
				<div class="pill-indicator pill-unread"></div>
			{/if}

			<button
				class="folder-icon"
				class:selected={hasSelectedServer}
				on:click={toggleExpanded}
				style="--folder-color: {color}"
			>
				<div class="folder-preview">
					{#each getPreviewIcons(servers) as server, i (server.id)}
						<div class="preview-icon" style="--index: {i}">
							{#if server.icon}
								<img src={server.icon} alt={server.name} />
							{:else}
								<span class="preview-initial">{server.name[0]}</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Mention badge for folder -->
				{#if totalMentions > 0}
					<div class="mention-badge">
						{totalMentions > 99 ? '99+' : totalMentions}
					</div>
				{/if}
			</button>

			<!-- Tooltip -->
			<div class="tooltip">
				{name}
			</div>
		</div>
	{/if}
</div>

<style>
	.server-folder-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.server-icon-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 72px;
		justify-content: center;
	}

	/* Pill indicators */
	.pill-indicator {
		position: absolute;
		left: 0;
		width: 4px;
		border-radius: 0 4px 4px 0;
		background-color: white;
		transition: height 0.15s ease-out;
	}

	.pill-selected {
		height: 40px;
	}

	.pill-unread {
		height: 8px;
	}

	.server-icon-wrapper:hover .pill-indicator:not(.pill-selected):not(.pill-unread) {
		height: 20px;
	}

	.folder-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background-color: #313338;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-radius 0.15s ease-out, background-color 0.15s ease-out;
		position: relative;
		padding: 4px;
	}

	.folder-icon:hover {
		border-radius: 16px;
		background-color: var(--folder-color, #5865f2);
	}

	.folder-icon.selected {
		border-radius: 16px;
		background-color: var(--folder-color, #5865f2);
	}

	.folder-preview {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		gap: 2px;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		overflow: hidden;
	}

	.preview-icon {
		width: 100%;
		height: 100%;
		background-color: #2b2d31;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.preview-icon img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.preview-initial {
		font-size: 9px;
		font-weight: 600;
		color: #dcddde;
		text-transform: uppercase;
	}

	/* Expanded folder styles */
	.folder-expanded {
		background-color: #1e1f22;
		border-radius: 16px;
		padding: 8px;
		margin: 4px 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.folder-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s ease-out;
	}

	.folder-header:hover {
		background-color: rgba(79, 84, 92, 0.16);
	}

	.folder-name {
		font-size: 12px;
		font-weight: 700;
		color: #b5bac1;
		text-transform: uppercase;
	}

	.collapse-icon {
		width: 16px;
		height: 16px;
		color: #b5bac1;
	}

	.folder-servers {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Mention badge */
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
