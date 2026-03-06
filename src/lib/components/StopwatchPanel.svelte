<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface Lap {
		number: number;
		splitMs: number;
		totalMs: number;
	}

	interface StopwatchState {
		elapsedMs: number;
		isRunning: boolean;
		laps: Lap[];
	}

	let elapsedMs = $state(0);
	let isRunning = $state(false);
	let laps = $state<Lap[]>([]);
	let error = $state<string | null>(null);

	let unlistenTick: (() => void) | null = null;

	onMount(async () => {
		await loadState();

		unlistenTick = await listen<StopwatchState>('stopwatch:tick', (event) => {
			elapsedMs = event.payload.elapsedMs;
			isRunning = event.payload.isRunning;
			laps = event.payload.laps;
		});
	});

	onDestroy(() => {
		unlistenTick?.();
	});

	async function loadState() {
		try {
			const state = await invoke<StopwatchState>('stopwatch_get_state');
			elapsedMs = state.elapsedMs;
			isRunning = state.isRunning;
			laps = state.laps;
		} catch (e) {
			error = String(e);
		}
	}

	async function start() {
		error = null;
		try {
			const state = await invoke<StopwatchState>('stopwatch_start');
			applyState(state);
		} catch (e) {
			error = String(e);
		}
	}

	async function stop() {
		error = null;
		try {
			const state = await invoke<StopwatchState>('stopwatch_stop');
			applyState(state);
		} catch (e) {
			error = String(e);
		}
	}

	async function reset() {
		error = null;
		try {
			const state = await invoke<StopwatchState>('stopwatch_reset');
			applyState(state);
		} catch (e) {
			error = String(e);
		}
	}

	async function lap() {
		error = null;
		try {
			const state = await invoke<StopwatchState>('stopwatch_lap');
			applyState(state);
		} catch (e) {
			error = String(e);
		}
	}

	function applyState(state: StopwatchState) {
		elapsedMs = state.elapsedMs;
		isRunning = state.isRunning;
		laps = state.laps;
	}

	function formatTime(ms: number): string {
		const totalSecs = Math.floor(ms / 1000);
		const h = Math.floor(totalSecs / 3600);
		const m = Math.floor((totalSecs % 3600) / 60);
		const s = totalSecs % 60;
		const centis = Math.floor((ms % 1000) / 10);
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
	}

	function formatSplit(ms: number): string {
		return formatTime(ms);
	}

	let bestLapIdx = $derived(
		laps.length > 1
			? laps.reduce((best, l, i) => (l.splitMs < laps[best].splitMs ? i : best), 0)
			: -1
	);

	let worstLapIdx = $derived(
		laps.length > 1
			? laps.reduce((worst, l, i) => (l.splitMs > laps[worst].splitMs ? i : worst), 0)
			: -1
	);
</script>

<div class="stopwatch-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x23F1;</span>
			<h3>Stopwatch</h3>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="display">
		<span class="time" class:running={isRunning}>{formatTime(elapsedMs)}</span>
	</div>

	<div class="controls">
		{#if !isRunning && elapsedMs === 0}
			<button class="btn btn-start" onclick={start}>Start</button>
		{:else if isRunning}
			<button class="btn btn-lap" onclick={lap}>Lap</button>
			<button class="btn btn-stop" onclick={stop}>Stop</button>
		{:else}
			<button class="btn btn-start" onclick={start}>Resume</button>
			<button class="btn btn-reset" onclick={reset}>Reset</button>
		{/if}
	</div>

	{#if laps.length > 0}
		<div class="laps-section">
			<div class="laps-header">
				<span class="section-label">Laps</span>
				<span class="section-label">{laps.length} total</span>
			</div>
			<div class="laps-table">
				<div class="lap-row lap-header-row">
					<span class="lap-num">#</span>
					<span class="lap-split">Split</span>
					<span class="lap-total">Total</span>
				</div>
				{#each [...laps].reverse() as lapItem, i (lapItem.number)}
					{@const idx = laps.length - 1 - i}
					<div
						class="lap-row"
						class:best-lap={idx === bestLapIdx}
						class:worst-lap={idx === worstLapIdx}
					>
						<span class="lap-num">{lapItem.number}</span>
						<span class="lap-split">{formatSplit(lapItem.splitMs)}</span>
						<span class="lap-total">{formatTime(lapItem.totalMs)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.stopwatch-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.error { font-size: 12px; color: #ed4245; }

	.display {
		text-align: center;
		padding: 20px 0;
	}
	.time {
		font-size: 42px;
		font-weight: 700;
		font-family: monospace;
		color: var(--text-primary, #dbdee1);
		letter-spacing: 1px;
		transition: color 0.2s;
	}
	.time.running {
		color: #57f287;
	}

	.controls {
		display: flex;
		gap: 8px;
		justify-content: center;
	}
	.btn {
		flex: 1;
		max-width: 140px;
		padding: 10px 20px;
		border-radius: 6px;
		border: none;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.btn-start {
		background: #57f287;
		color: #1e1f22;
	}
	.btn-start:hover { background: #43d673; }
	.btn-stop {
		background: #ed4245;
		color: white;
	}
	.btn-stop:hover { background: #d63638; }
	.btn-lap {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		border: 1px solid var(--border, #3f4147);
	}
	.btn-lap:hover { border-color: #5865f2; color: #5865f2; }
	.btn-reset {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		border: 1px solid var(--border, #3f4147);
	}
	.btn-reset:hover { border-color: #ed4245; color: #ed4245; }

	.laps-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.laps-header {
		display: flex;
		justify-content: space-between;
	}
	.section-label {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.laps-table {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 200px;
		overflow-y: auto;
	}
	.lap-row {
		display: flex;
		align-items: center;
		padding: 6px 10px;
		border-radius: 4px;
		font-size: 12px;
		font-family: monospace;
	}
	.lap-header-row {
		font-family: inherit;
		font-weight: 600;
		color: var(--text-muted, #6d6f78);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.lap-row:not(.lap-header-row) {
		background: var(--bg-tertiary, #1e1f22);
	}
	.lap-num { flex: 0 0 36px; }
	.lap-split { flex: 1; }
	.lap-total { flex: 1; text-align: right; color: var(--text-secondary, #949ba4); }

	.best-lap { color: #57f287; }
	.worst-lap { color: #ed4245; }
</style>
