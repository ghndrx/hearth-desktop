<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { fade, slide } from 'svelte/transition';

	interface DetectedGame {
		app_id: string;
		name: string;
		process_name: string;
		is_running: boolean;
		last_detected: number;
		total_playtime_seconds: number;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let games = $state<DetectedGame[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let launchingId = $state<string | null>(null);
	let searchQuery = $state('');
	let activeTab = $state<'all' | 'running' | 'recent'>('all');
	let unlisten: (() => void) | null = null;

	const RECENT_THRESHOLD_SECS = 7 * 24 * 60 * 60; // 7 days

	let filteredGames = $derived.by(() => {
		let list = games;

		if (activeTab === 'running') {
			list = list.filter((g) => g.is_running);
		} else if (activeTab === 'recent') {
			const now = Date.now() / 1000;
			list = list.filter((g) => g.last_detected > 0 && now - g.last_detected < RECENT_THRESHOLD_SECS);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((g) => g.name.toLowerCase().includes(q));
		}

		return list;
	});

	let stats = $derived.by(() => {
		const totalPlaytime = games.reduce((sum, g) => sum + g.total_playtime_seconds, 0);
		const runningCount = games.filter((g) => g.is_running).length;
		return { total: games.length, running: runningCount, totalPlaytime };
	});

	onMount(async () => {
		await loadLibrary();

		unlisten = await listen<DetectedGame[]>('games-detected', (event) => {
			const detected = event.payload;
			for (const game of detected) {
				const idx = games.findIndex((g) => g.app_id === game.app_id);
				if (idx >= 0) {
					games[idx] = game;
				} else {
					games.push(game);
				}
			}
			games = games.sort((a, b) => b.last_detected - a.last_detected);
		});
	});

	onDestroy(() => {
		unlisten?.();
	});

	async function loadLibrary() {
		loading = true;
		error = null;
		try {
			games = await invoke<DetectedGame[]>('get_game_library');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function launchGame(appId: string) {
		launchingId = appId;
		try {
			await invoke('launch_game', { appId });
		} catch (e) {
			error = `Failed to launch: ${e}`;
			setTimeout(() => (error = null), 3000);
		} finally {
			launchingId = null;
		}
	}

	function formatPlaytime(seconds: number): string {
		if (seconds === 0) return 'No playtime';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	function formatTotalPlaytime(seconds: number): string {
		if (seconds === 0) return '0h';
		const h = Math.floor(seconds / 3600);
		if (h === 0) return `${Math.floor(seconds / 60)}m`;
		return `${h}h`;
	}

	function formatLastPlayed(timestamp: number): string {
		if (timestamp === 0) return 'Never';
		const now = Date.now() / 1000;
		const diff = now - timestamp;
		if (diff < 60) return 'Just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
		return new Date(timestamp * 1000).toLocaleDateString();
	}

	function getSteamHeaderUrl(appId: string): string {
		return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			onClose();
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open}
	<div class="panel-backdrop" transition:fade={{ duration: 100 }} onclick={handleClose} onkeydown={handleKeydown} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
		<div class="panel" transition:slide={{ duration: 200, axis: 'x' }} onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Game Library" tabindex="-1">
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-700">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h2 class="text-lg font-semibold text-white">Game Library</h2>
					{#if stats.running > 0}
						<span class="px-2 py-0.5 text-xs rounded-full bg-green-600 text-white">{stats.running} running</span>
					{/if}
				</div>
				<button onclick={handleClose} class="text-gray-400 hover:text-white transition-colors" aria-label="Close">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Stats Bar -->
			<div class="flex items-center gap-4 px-4 py-2 bg-gray-800/50 text-xs text-gray-400">
				<span>{stats.total} games</span>
				<span>{formatTotalPlaytime(stats.totalPlaytime)} total playtime</span>
				{#if stats.running > 0}
					<span class="text-green-400">{stats.running} playing now</span>
				{/if}
			</div>

			<!-- Tabs + Search -->
			<div class="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
				<div class="flex gap-1">
					{#each [['all', 'All'], ['running', 'Playing'], ['recent', 'Recent']] as [tab, label]}
						<button
							onclick={() => activeTab = tab as 'all' | 'running' | 'recent'}
							class="px-3 py-1 text-xs rounded-md transition-colors {activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
						>{label}</button>
					{/each}
				</div>
				<input
					type="text"
					placeholder="Search games..."
					bind:value={searchQuery}
					class="flex-1 ml-2 px-2 py-1 text-xs bg-gray-700 rounded border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
				/>
			</div>

			<!-- Error -->
			{#if error}
				<div class="mx-4 mt-2 px-3 py-2 text-sm text-red-400 bg-red-900/30 rounded">{error}</div>
			{/if}

			<!-- Game List -->
			<div class="flex-1 overflow-y-auto p-4 space-y-2">
				{#if loading}
					<div class="flex items-center justify-center py-12 text-gray-400">
						<svg class="w-5 h-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Loading games...
					</div>
				{:else if filteredGames.length === 0}
					<div class="text-center py-12 text-gray-500">
						{#if searchQuery}
							No games match "{searchQuery}"
						{:else if activeTab === 'running'}
							No games currently running
						{:else if activeTab === 'recent'}
							No recently played games
						{:else}
							No games detected yet. Launch a game to get started!
						{/if}
					</div>
				{:else}
					{#each filteredGames as game (game.app_id)}
						<div class="game-card group rounded-lg overflow-hidden bg-gray-800 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600">
							<!-- Game artwork banner -->
							<div class="relative h-24 bg-gray-900 overflow-hidden">
								<img
									src={getSteamHeaderUrl(game.app_id)}
									alt={game.name}
									class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
									onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
								/>
								{#if game.is_running}
									<div class="absolute top-2 right-2 px-2 py-0.5 text-xs bg-green-600 text-white rounded-full flex items-center gap-1">
										<span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
										Running
									</div>
								{/if}
							</div>

							<!-- Game info -->
							<div class="p-3">
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<h3 class="text-sm font-medium text-white truncate">{game.name}</h3>
										<div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
											<span title="Total playtime">{formatPlaytime(game.total_playtime_seconds)}</span>
											<span title="Last played">{formatLastPlayed(game.last_detected)}</span>
										</div>
									</div>
									<button
										onclick={() => launchGame(game.app_id)}
										disabled={launchingId === game.app_id}
										class="ml-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors {game.is_running ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} disabled:opacity-50"
										title={game.is_running ? 'Focus game' : 'Launch via Steam'}
									>
										{#if launchingId === game.app_id}
											Launching...
										{:else if game.is_running}
											Focus
										{:else}
											Play
										{/if}
									</button>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
				<span>Games detected via process scanning</span>
				<button onclick={loadLibrary} class="text-indigo-400 hover:text-indigo-300 transition-colors">
					Refresh
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
		display: flex;
		justify-content: flex-end;
	}

	.panel {
		width: 420px;
		max-width: 90vw;
		height: 100%;
		background: #1e1f22;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
	}

	.game-card img {
		image-rendering: auto;
	}
</style>
