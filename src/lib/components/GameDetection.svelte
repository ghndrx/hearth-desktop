<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface DetectedGame {
		name: string;
		process_name: string;
		pid: number;
		category: 'FPS' | 'MOBA' | 'MMO' | 'Strategy' | 'Racing' | 'Sports' | 'Indie' | 'AAA' | 'Unknown';
	}

	interface GameDetectionResult {
		detected_games: DetectedGame[];
		is_gaming: boolean;
		total_games_running: number;
	}

	let gameResult: GameDetectionResult | null = null;
	let error: string | null = null;
	let isLoading = false;
	let interval: NodeJS.Timeout | null = null;

	async function initGameDetection() {
		try {
			await invoke('init_game_detection');
		} catch (err) {
			error = `Failed to initialize game detection: ${err}`;
		}
	}

	async function scanForGames() {
		if (isLoading) return;

		isLoading = true;
		error = null;

		try {
			const result = await invoke<GameDetectionResult>('scan_for_games');
			gameResult = result;
		} catch (err) {
			error = `Failed to scan for games: ${err}`;
		} finally {
			isLoading = false;
		}
	}

	function startAutoScan() {
		interval = setInterval(scanForGames, 5000); // Scan every 5 seconds
	}

	function stopAutoScan() {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	function getCategoryColor(category: string): string {
		const colors = {
			FPS: 'text-red-500',
			MOBA: 'text-purple-500',
			MMO: 'text-blue-500',
			Strategy: 'text-green-500',
			Racing: 'text-yellow-500',
			Sports: 'text-orange-500',
			Indie: 'text-pink-500',
			AAA: 'text-indigo-500',
			Unknown: 'text-gray-500'
		};
		return colors[category as keyof typeof colors] || 'text-gray-500';
	}

	onMount(async () => {
		await initGameDetection();
		await scanForGames();
		startAutoScan();
	});

	onDestroy(() => {
		stopAutoScan();
	});
</script>

<div class="bg-dark-700 rounded-lg p-4 max-w-md">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-lg font-semibold text-gray-100 flex items-center gap-2">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
				<path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
			</svg>
			Game Detection
		</h3>
		<button
			class="text-sm px-2 py-1 bg-hearth-600 hover:bg-hearth-500 rounded text-white transition-colors"
			onclick={scanForGames}
			disabled={isLoading}
		>
			{isLoading ? 'Scanning...' : 'Scan Now'}
		</button>
	</div>

	{#if error}
		<div class="text-red-400 text-sm mb-3 p-2 bg-red-900/20 rounded border border-red-800">
			{error}
		</div>
	{/if}

	{#if gameResult}
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<div
					class="w-3 h-3 rounded-full {gameResult.is_gaming ? 'bg-green-500' : 'bg-gray-500'}"
				></div>
				<span class="text-sm text-gray-300">
					Gaming Status: {gameResult.is_gaming ? 'Active' : 'Inactive'}
				</span>
			</div>

			{#if gameResult.total_games_running > 0}
				<div class="text-xs text-gray-400 mb-2">
					{gameResult.total_games_running} game(s) detected
				</div>

				<div class="space-y-2 max-h-48 overflow-y-auto">
					{#each gameResult.detected_games as game}
						<div class="bg-dark-800 rounded p-2 border border-dark-600">
							<div class="flex items-center justify-between">
								<div>
									<div class="font-medium text-gray-200 text-sm">{game.name}</div>
									<div class="text-xs text-gray-400">{game.process_name} (PID: {game.pid})</div>
								</div>
								<span class="text-xs px-2 py-1 rounded-full bg-dark-600 {getCategoryColor(game.category)}">
									{game.category}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-sm text-gray-400 text-center py-4">
					No games detected
				</div>
			{/if}
		</div>
	{:else if !isLoading}
		<div class="text-sm text-gray-400 text-center py-4">
			Click "Scan Now" to detect games
		</div>
	{/if}

	{#if isLoading}
		<div class="flex items-center justify-center py-4">
			<div class="w-5 h-5 border-2 border-hearth-500 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{/if}
</div>