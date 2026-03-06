<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface SystemHealth {
		cpu_usage: number;
		cpu_per_core: number[];
		cpu_cores: number;
		memory_total: number;
		memory_used: number;
		memory_percent: number;
		swap_total: number;
		swap_used: number;
		disk_available: number;
		disk_total: number;
		disk_percent: number;
		load_average: [number, number, number];
		system_uptime: number;
		timestamp: number;
	}

	let snapshot = $state<SystemHealth | null>(null);
	let cpuHistory = $state<number[]>([]);
	let memHistory = $state<number[]>([]);
	let monitoring = $state(false);
	let error = $state<string | null>(null);
	let intervalSecs = $state(5);

	const MAX_HISTORY = 30;

	let unlistenHealth: (() => void) | null = null;

	onMount(async () => {
		await fetchSnapshot();
		await startMonitor();

		unlistenHealth = await listen<SystemHealth>('system:health', (event) => {
			snapshot = event.payload;
			cpuHistory = [...cpuHistory.slice(-(MAX_HISTORY - 1)), event.payload.cpu_usage];
			memHistory = [...memHistory.slice(-(MAX_HISTORY - 1)), event.payload.memory_percent];
		});
	});

	onDestroy(async () => {
		unlistenHealth?.();
		if (monitoring) {
			try { await invoke('stop_system_monitor'); } catch {}
		}
	});

	async function fetchSnapshot() {
		try {
			snapshot = await invoke<SystemHealth>('get_system_health');
			if (snapshot) {
				cpuHistory = [snapshot.cpu_usage];
				memHistory = [snapshot.memory_percent];
			}
		} catch (e) {
			error = String(e);
		}
	}

	async function startMonitor() {
		try {
			await invoke('start_system_monitor', { intervalSecs });
			monitoring = true;
		} catch (e) {
			error = String(e);
		}
	}

	async function stopMonitor() {
		try {
			await invoke('stop_system_monitor');
			monitoring = false;
		} catch (e) {
			error = String(e);
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
	}

	function formatUptime(secs: number): string {
		const d = Math.floor(secs / 86400);
		const h = Math.floor((secs % 86400) / 3600);
		const m = Math.floor((secs % 3600) / 60);
		if (d > 0) return `${d}d ${h}h ${m}m`;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	function usageColor(pct: number): string {
		if (pct < 50) return 'text-green-400';
		if (pct < 80) return 'text-yellow-400';
		return 'text-red-400';
	}

	function barColor(pct: number): string {
		if (pct < 50) return 'bg-green-500';
		if (pct < 80) return 'bg-yellow-500';
		return 'bg-red-500';
	}
</script>

<div class="flex flex-col gap-4 p-4 h-full overflow-y-auto bg-dark-800 text-gray-200">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-white">System Monitor</h2>
		<div class="flex items-center gap-2">
			{#if monitoring}
				<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
				<span class="text-xs text-green-400">Live</span>
			{/if}
			<button
				onclick={() => monitoring ? stopMonitor() : startMonitor()}
				class="px-2 py-1 text-xs rounded {monitoring ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors"
			>
				{monitoring ? 'Stop' : 'Start'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">{error}</div>
	{/if}

	{#if snapshot}
		<!-- CPU -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="flex justify-between items-center mb-2">
				<span class="text-sm font-medium">CPU</span>
				<span class="text-sm font-mono {usageColor(snapshot.cpu_usage)}">{snapshot.cpu_usage.toFixed(1)}%</span>
			</div>
			<div class="w-full bg-dark-600 rounded-full h-2 mb-2">
				<div class="{barColor(snapshot.cpu_usage)} h-2 rounded-full transition-all duration-500" style="width: {snapshot.cpu_usage}%"></div>
			</div>
			<div class="grid grid-cols-8 gap-1">
				{#each snapshot.cpu_per_core as core, i}
					<div class="text-center" title="Core {i}: {core.toFixed(0)}%">
						<div class="w-full bg-dark-600 rounded h-8 relative overflow-hidden">
							<div class="{barColor(core)} absolute bottom-0 w-full transition-all duration-500" style="height: {core}%"></div>
						</div>
						<span class="text-[10px] text-gray-500">{i}</span>
					</div>
				{/each}
			</div>
			{#if cpuHistory.length > 1}
				<div class="mt-2 flex items-end gap-px h-12">
					{#each cpuHistory as val}
						<div class="{barColor(val)} opacity-60 flex-1 rounded-t transition-all" style="height: {val}%"></div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Memory -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="flex justify-between items-center mb-2">
				<span class="text-sm font-medium">Memory</span>
				<span class="text-sm font-mono {usageColor(snapshot.memory_percent)}">
					{formatBytes(snapshot.memory_used)} / {formatBytes(snapshot.memory_total)}
				</span>
			</div>
			<div class="w-full bg-dark-600 rounded-full h-2 mb-2">
				<div class="{barColor(snapshot.memory_percent)} h-2 rounded-full transition-all duration-500" style="width: {snapshot.memory_percent}%"></div>
			</div>
			{#if snapshot.swap_total > 0}
				<div class="flex justify-between text-xs text-gray-400 mt-1">
					<span>Swap</span>
					<span>{formatBytes(snapshot.swap_used)} / {formatBytes(snapshot.swap_total)}</span>
				</div>
			{/if}
			{#if memHistory.length > 1}
				<div class="mt-2 flex items-end gap-px h-10">
					{#each memHistory as val}
						<div class="bg-blue-500 opacity-60 flex-1 rounded-t transition-all" style="height: {val}%"></div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Disk -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="flex justify-between items-center mb-2">
				<span class="text-sm font-medium">Disk</span>
				<span class="text-sm font-mono {usageColor(snapshot.disk_percent)}">
					{formatBytes(snapshot.disk_total - snapshot.disk_available)} / {formatBytes(snapshot.disk_total)}
				</span>
			</div>
			<div class="w-full bg-dark-600 rounded-full h-2">
				<div class="{barColor(snapshot.disk_percent)} h-2 rounded-full transition-all duration-500" style="width: {snapshot.disk_percent}%"></div>
			</div>
			<div class="text-xs text-gray-400 mt-1">{formatBytes(snapshot.disk_available)} free</div>
		</div>

		<!-- System Info -->
		<div class="bg-dark-700 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
			<div>
				<span class="text-gray-400">Cores</span>
				<span class="ml-2 text-white font-mono">{snapshot.cpu_cores}</span>
			</div>
			<div>
				<span class="text-gray-400">Uptime</span>
				<span class="ml-2 text-white font-mono">{formatUptime(snapshot.system_uptime)}</span>
			</div>
			<div class="col-span-2">
				<span class="text-gray-400">Load</span>
				<span class="ml-2 text-white font-mono">
					{snapshot.load_average[0].toFixed(2)} / {snapshot.load_average[1].toFixed(2)} / {snapshot.load_average[2].toFixed(2)}
				</span>
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-center h-32 text-gray-400">Loading system info...</div>
	{/if}
</div>
