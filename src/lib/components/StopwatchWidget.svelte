<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	// Stopwatch state
	let elapsed = $state(0); // milliseconds
	let isRunning = $state(false);
	let laps = $state<number[]>([]);
	let startTime = $state(0);
	let pausedAt = $state(0);

	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		loadState();
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	function loadState() {
		try {
			const stored = localStorage.getItem('hearth-stopwatch');
			if (stored) {
				const data = JSON.parse(stored);
				elapsed = data.elapsed || 0;
				laps = data.laps || [];
				isRunning = data.isRunning || false;
				
				if (isRunning && data.startTime) {
					// Resume running timer
					startTime = data.startTime;
					const now = Date.now();
					elapsed = data.elapsed + (now - data.lastUpdate);
					startTimer();
				}
			}
		} catch {
			// Ignore load errors
		}
	}

	function saveState() {
		localStorage.setItem('hearth-stopwatch', JSON.stringify({
			elapsed,
			laps,
			isRunning,
			startTime,
			lastUpdate: Date.now()
		}));
	}

	function startTimer() {
		if (interval) clearInterval(interval);
		startTime = Date.now() - elapsed;
		interval = setInterval(() => {
			elapsed = Date.now() - startTime;
		}, 10);
	}

	function start() {
		if (!isRunning) {
			isRunning = true;
			startTimer();
			saveState();
		}
	}

	function pause() {
		if (isRunning) {
			isRunning = false;
			if (interval) {
				clearInterval(interval);
				interval = null;
			}
			pausedAt = elapsed;
			saveState();
		}
	}

	function reset() {
		pause();
		elapsed = 0;
		laps = [];
		startTime = 0;
		pausedAt = 0;
		saveState();
	}

	function lap() {
		if (isRunning) {
			laps = [...laps, elapsed];
			saveState();
		}
	}

	function clearLaps() {
		laps = [];
		saveState();
	}

	function formatTime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		const centiseconds = Math.floor((ms % 1000) / 10);

		if (hours > 0) {
			return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		}
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
	}

	function formatLapTime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const centiseconds = Math.floor((ms % 1000) / 10);
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
	}

	function getLapDelta(index: number): number {
		if (index === 0) return laps[0];
		return laps[index] - laps[index - 1];
	}

	function getFastestLap(): number {
		if (laps.length < 2) return -1;
		let fastest = 0;
		let fastestTime = getLapDelta(0);
		for (let i = 1; i < laps.length; i++) {
			const delta = getLapDelta(i);
			if (delta < fastestTime) {
				fastestTime = delta;
				fastest = i;
			}
		}
		return fastest;
	}

	function getSlowestLap(): number {
		if (laps.length < 2) return -1;
		let slowest = 0;
		let slowestTime = getLapDelta(0);
		for (let i = 1; i < laps.length; i++) {
			const delta = getLapDelta(i);
			if (delta > slowestTime) {
				slowestTime = delta;
				slowest = i;
			}
		}
		return slowest;
	}
</script>

<div class="stopwatch-widget" class:compact>
	<div class="header">
		<span class="icon">⏱️</span>
		{#if !compact}
			<span class="title">Stopwatch</span>
		{/if}
	</div>

	<div class="display" class:running={isRunning}>
		<span class="time">{formatTime(elapsed)}</span>
	</div>

	<div class="controls">
		{#if !isRunning}
			<button class="btn start" onclick={start} title="Start">
				▶
			</button>
		{:else}
			<button class="btn pause" onclick={pause} title="Pause">
				⏸
			</button>
		{/if}

		{#if isRunning}
			<button class="btn lap" onclick={lap} title="Lap">
				🏁
			</button>
		{:else if elapsed > 0}
			<button class="btn reset" onclick={reset} title="Reset">
				↻
			</button>
		{/if}
	</div>

	{#if laps.length > 0 && !compact}
		<div class="laps">
			<div class="laps-header">
				<span>Laps ({laps.length})</span>
				<button class="clear-btn" onclick={clearLaps} title="Clear laps">×</button>
			</div>
			<div class="laps-list">
				{#each laps.toReversed() as lapTime, i}
					{@const actualIndex = laps.length - 1 - i}
					{@const fastestIdx = getFastestLap()}
					{@const slowestIdx = getSlowestLap()}
					<div 
						class="lap-item"
						class:fastest={actualIndex === fastestIdx && laps.length > 1}
						class:slowest={actualIndex === slowestIdx && laps.length > 1}
					>
						<span class="lap-number">#{actualIndex + 1}</span>
						<span class="lap-delta">
							{#if actualIndex === 0}
								{formatLapTime(lapTime)}
							{:else}
								+{formatLapTime(getLapDelta(actualIndex))}
							{/if}
						</span>
						<span class="lap-total">{formatLapTime(lapTime)}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else if laps.length > 0 && compact}
		<div class="lap-count">
			{laps.length} lap{laps.length !== 1 ? 's' : ''}
		</div>
	{/if}
</div>

<style>
	.stopwatch-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.stopwatch-widget.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.icon {
		font-size: 14px;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.display {
		text-align: center;
		padding: 8px 0;
		border-radius: 6px;
		background: var(--bg-primary, #36393f);
		transition: background 0.2s ease;
	}

	.display.running {
		background: rgba(87, 242, 135, 0.1);
	}

	.compact .display {
		padding: 4px 0;
	}

	.time {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 28px;
		font-weight: 600;
		color: var(--text-primary, #fff);
		letter-spacing: 1px;
	}

	.compact .time {
		font-size: 20px;
	}

	.controls {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s ease, background 0.2s ease;
	}

	.compact .btn {
		width: 30px;
		height: 30px;
		font-size: 12px;
	}

	.btn:hover {
		transform: scale(1.1);
	}

	.btn:active {
		transform: scale(0.95);
	}

	.btn.start {
		background: var(--success, #3ba55c);
		color: white;
	}

	.btn.start:hover {
		background: #2d8049;
	}

	.btn.pause {
		background: var(--warning, #faa61a);
		color: white;
	}

	.btn.pause:hover {
		background: #d68f14;
	}

	.btn.lap {
		background: var(--accent, #5865f2);
		color: white;
	}

	.btn.lap:hover {
		background: #4752c4;
	}

	.btn.reset {
		background: var(--bg-modifier-hover, #4f545c);
		color: var(--text-primary, #dcddde);
	}

	.btn.reset:hover {
		background: var(--error, #ed4245);
		color: white;
	}

	.laps {
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		padding-top: 8px;
	}

	.laps-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-bottom: 6px;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
	}

	.clear-btn:hover {
		color: var(--error, #ed4245);
	}

	.laps-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 120px;
		overflow-y: auto;
	}

	.lap-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 4px;
		font-size: 11px;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.lap-item.fastest {
		background: rgba(87, 242, 135, 0.15);
		border-left: 2px solid var(--success, #3ba55c);
	}

	.lap-item.slowest {
		background: rgba(237, 66, 69, 0.15);
		border-left: 2px solid var(--error, #ed4245);
	}

	.lap-number {
		color: var(--text-muted, #72767d);
		min-width: 24px;
	}

	.lap-delta {
		flex: 1;
		color: var(--text-secondary, #b9bbbe);
	}

	.lap-total {
		color: var(--text-primary, #dcddde);
		font-weight: 500;
	}

	.lap-count {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		text-align: center;
	}
</style>
