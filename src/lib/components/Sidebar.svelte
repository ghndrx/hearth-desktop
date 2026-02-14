<script lang="ts">
	import { currentServer, servers, type Server } from '$lib/stores/app';

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
	}
</script>

<aside class="w-[72px] bg-dark-950 flex flex-col items-center py-3 gap-2 shrink-0">
	<!-- Home/DM button -->
	<button
		class="w-12 h-12 rounded-[24px] bg-dark-700 hover:bg-hearth-500 hover:rounded-[16px]
		       flex items-center justify-center transition-all duration-200 group"
		onclick={() => currentServer.set(null)}
		class:bg-hearth-500={!$currentServer}
		class:rounded-[16px]={!$currentServer}
	>
		<svg
			class="w-7 h-7 text-gray-400 group-hover:text-white transition-colors"
			class:text-white={!$currentServer}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
			/>
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
			onclick={() => selectServer(server)}
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
