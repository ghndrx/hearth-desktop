<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface DailyUsage {
		date: string;
		total_minutes: number;
		active_minutes: number;
		idle_minutes: number;
		hourly_minutes: number[];
		peak_hour: number;
	}

	interface WeeklyStats {
		average_daily: number;
		total_week: number;
		trend: string;
		most_active_day: string;
		most_active_hour: number;
		days: DailyUsage[];
	}

	let today = $state<DailyUsage | null>(null);
	let weekly = $state<WeeklyStats | null>(null);
	let tracking = $state(false);
	let error = $state<string | null>(null);
	let view = $state<'today' | 'weekly'>('today');

	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await checkState();
		await loadData();
		heartbeatInterval = setInterval(async () => {
			if (tracking) {
				try { await invoke('screentime_heartbeat'); } catch {}
				await loadToday();
			}
		}, 60000);
	});

	onDestroy(() => {
		if (heartbeatInterval) clearInterval(heartbeatInterval);
	});

	async function checkState() {
		try {
			const state = await invoke<{ tracking: boolean }>('screentime_get_state');
			tracking = state.tracking;
		} catch {}
	}

	async function loadData() {
		await loadToday();
		await loadWeekly();
	}

	async function loadToday() {
		try { today = await invoke<DailyUsage>('screentime_get_today'); } catch (e) { error = String(e); }
	}

	async function loadWeekly() {
		try { weekly = await invoke<WeeklyStats>('screentime_get_weekly'); } catch {}
	}

	async function toggleTracking() {
		try {
			if (tracking) {
				await invoke('screentime_stop');
				tracking = false;
			} else {
				await invoke('screentime_start');
				tracking = true;
			}
		} catch (e) {
			error = String(e);
		}
	}

	async function resetToday() {
		try {
			await invoke('screentime_reset');
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	function formatMinutes(m: number): string {
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		const mins = m % 60;
		return mins > 0 ? `${h}h ${mins}m` : `${h}h`;
	}

	function formatHour(h: number): string {
		if (h === 0) return '12a';
		if (h < 12) return `${h}a`;
		if (h === 12) return '12p';
		return `${h - 12}p`;
	}

	function trendIcon(trend: string): string {
		if (trend === 'up') return '\u2191';
		if (trend === 'down') return '\u2193';
		return '\u2192';
	}

	function trendColor(trend: string): string {
		if (trend === 'up') return 'text-red-400';
		if (trend === 'down') return 'text-green-400';
		return 'text-gray-400';
	}
</script>

<div class="flex flex-col gap-4 p-4 h-full overflow-y-auto bg-dark-800 text-gray-200">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-white">Screen Time</h2>
		<div class="flex items-center gap-2">
			{#if tracking}
				<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
			{/if}
			<button
				onclick={toggleTracking}
				class="px-2 py-1 text-xs rounded {tracking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors"
			>
				{tracking ? 'Stop' : 'Start'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">{error}</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 bg-dark-700 rounded-lg p-1">
		<button onclick={() => view = 'today'} class="flex-1 px-2 py-1 text-xs rounded-md transition-colors {view === 'today' ? 'bg-hearth-600 text-white' : 'text-gray-400 hover:text-white'}">Today</button>
		<button onclick={() => { view = 'weekly'; loadWeekly(); }} class="flex-1 px-2 py-1 text-xs rounded-md transition-colors {view === 'weekly' ? 'bg-hearth-600 text-white' : 'text-gray-400 hover:text-white'}">Weekly</button>
	</div>

	{#if view === 'today' && today}
		<!-- Today Stats -->
		<div class="grid grid-cols-3 gap-2">
			<div class="bg-dark-700 rounded-lg p-3 text-center">
				<div class="text-xl font-bold text-white">{formatMinutes(today.total_minutes)}</div>
				<div class="text-xs text-gray-400">Total</div>
			</div>
			<div class="bg-dark-700 rounded-lg p-3 text-center">
				<div class="text-xl font-bold text-green-400">{formatMinutes(today.active_minutes)}</div>
				<div class="text-xs text-gray-400">Active</div>
			</div>
			<div class="bg-dark-700 rounded-lg p-3 text-center">
				<div class="text-xl font-bold text-yellow-400">{formatMinutes(today.idle_minutes)}</div>
				<div class="text-xs text-gray-400">Idle</div>
			</div>
		</div>

		<!-- Hourly Breakdown -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="flex justify-between items-center mb-2">
				<span class="text-sm font-medium">Hourly Activity</span>
				<span class="text-xs text-gray-400">Peak: {formatHour(today.peak_hour)}</span>
			</div>
			<div class="flex items-end gap-px h-20">
				{#each today.hourly_minutes as mins, hour}
					{@const maxMins = Math.max(...today.hourly_minutes, 1)}
					<div
						class="flex-1 rounded-t transition-all {hour === today.peak_hour ? 'bg-hearth-500' : 'bg-blue-500/60'}"
						style="height: {(mins / maxMins) * 100}%"
						title="{formatHour(hour)}: {mins}m"
					></div>
				{/each}
			</div>
			<div class="flex justify-between mt-1 text-[9px] text-gray-500">
				<span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
			</div>
		</div>

		<!-- Activity Ratio -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="text-sm font-medium mb-2">Activity Ratio</div>
			{@const activeRatio = today.total_minutes > 0 ? (today.active_minutes / today.total_minutes) * 100 : 0}
			<div class="w-full bg-dark-600 rounded-full h-3 overflow-hidden flex">
				<div class="bg-green-500 h-full transition-all" style="width: {activeRatio}%"></div>
				<div class="bg-yellow-500/60 h-full transition-all" style="width: {100 - activeRatio}%"></div>
			</div>
			<div class="flex justify-between text-xs text-gray-400 mt-1">
				<span>Active {activeRatio.toFixed(0)}%</span>
				<span>Idle {(100 - activeRatio).toFixed(0)}%</span>
			</div>
		</div>

		<button
			onclick={resetToday}
			class="w-full py-1.5 text-xs bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded text-gray-400 transition-colors"
		>
			Reset Today
		</button>

	{:else if view === 'weekly' && weekly}
		<!-- Weekly Summary -->
		<div class="grid grid-cols-2 gap-2">
			<div class="bg-dark-700 rounded-lg p-3 text-center">
				<div class="text-xl font-bold text-white">{formatMinutes(weekly.total_week)}</div>
				<div class="text-xs text-gray-400">This Week</div>
			</div>
			<div class="bg-dark-700 rounded-lg p-3 text-center">
				<div class="text-xl font-bold text-blue-400">{formatMinutes(weekly.average_daily)}</div>
				<div class="text-xs text-gray-400">Daily Avg</div>
			</div>
		</div>

		<div class="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
			<span class="text-sm">Trend</span>
			<span class="text-sm font-mono {trendColor(weekly.trend)}">
				{trendIcon(weekly.trend)} {weekly.trend}
			</span>
		</div>

		<!-- Daily bars -->
		<div class="bg-dark-700 rounded-lg p-3">
			<div class="text-sm font-medium mb-2">Daily Breakdown</div>
			<div class="flex items-end gap-2 h-24">
				{#each weekly.days as day}
					{@const maxDay = Math.max(...weekly.days.map(d => d.total_minutes), 1)}
					<div class="flex-1 flex flex-col items-center gap-1">
						<div class="w-full bg-dark-600 rounded-t relative overflow-hidden" style="height: {(day.total_minutes / maxDay) * 100}%">
							<div class="bg-blue-500 w-full absolute bottom-0" style="height: {day.total_minutes > 0 ? (day.active_minutes / day.total_minutes) * 100 : 0}%"></div>
						</div>
						<span class="text-[9px] text-gray-500">{day.date.slice(-2)}</span>
					</div>
				{/each}
			</div>
		</div>

	{:else}
		<div class="flex items-center justify-center h-32 text-gray-400 text-sm">
			{tracking ? 'Loading...' : 'Start tracking to see data'}
		</div>
	{/if}
</div>
