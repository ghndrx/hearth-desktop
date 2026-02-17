<script lang="ts">
	import { servers, currentServer, loadServerChannels } from '$stores';
	import type { Server } from '$lib/stores/servers';

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function selectServer(server: Server) {
		currentServer.set(server);
		loadServerChannels(server.id);
	}
</script>

<aside class="w-[72px] bg-dark-950 flex flex-col items-center py-3 gap-2 shrink-0" role="navigation" aria-label="Server navigation">
	<!-- Home/DM button -->
	<button
		class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
		       flex items-center justify-center transition-all duration-200 group"
		on:click={() => currentServer.set(null)}
		class:bg-hearth-500={!$currentServer}
		class:rounded-[16px]={!$currentServer}
		aria-label="Direct Messages"
		aria-current={!$currentServer ? 'page' : undefined}
		title="Direct Messages"
		type="button"
	>
		<svg
			class="w-7 h-7 text-gray-400 group-hover:text-white transition-colors"
			class:text-white={!$currentServer}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
		</svg>
	</button>

	<div class="w-8 h-0.5 bg-dark-700 rounded-full my-1"></div>

	<!-- Server list -->
	{#each $servers as server (server.id)}
		<button
			class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
			       flex items-center justify-center transition-all duration-200 relative group"
			class:bg-hearth-500={$currentServer?.id === server.id}
			class:rounded-[16px]={$currentServer?.id === server.id}
			on:click={() => selectServer(server)}
			aria-label={server.name}
			aria-current={$currentServer?.id === server.id ? 'page' : undefined}
			type="button"
		>
			{#if server.icon}
				<img
					src={server.icon}
					alt={server.name}
					class="w-full h-full rounded-inherit object-cover"
				/>
			{:else}
				<span class="text-sm font-medium text-gray-300 group-hover:text-white">
					{getInitials(server.name)}
				</span>
			{/if}

			<!-- Active indicator -->
			{#if $currentServer?.id === server.id}
				<div class="absolute left-0 w-1 h-10 bg-white rounded-r-full -translate-x-3"></div>
			{/if}

			<!-- Tooltip -->
			<div
				class="absolute left-full ml-4 px-3 py-2 bg-dark-900 text-white text-sm rounded-md
				       opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
				       transition-opacity duration-150 shadow-lg"
			>
				{server.name}
			</div>
		</button>
	{/each}

	<!-- Add server button -->
	<button
		class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-green-600 hover:rounded-[16px]
		       flex items-center justify-center transition-all duration-200 group"
		aria-label="Add a Server"
		title="Add a Server"
		type="button"
	>
		<svg
			class="w-6 h-6 text-green-500 group-hover:text-white transition-colors"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
	</button>
</aside>
