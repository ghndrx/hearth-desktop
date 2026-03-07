<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ComponentTemp {
		label: string;
		currentCelsius: number;
		maxCelsius: number;
		criticalCelsius: number | null;
	}

	interface TempSnapshot {
		components: ComponentTemp[];
		cpuAvgCelsius: number | null;
		hottestCelsius: number | null;
		hottestLabel: string | null;
		timestampMs: number;
	}

	let snapshot = $state<TempSnapshot | null>(null);
	let error = $state<string | null>(null);
	let interval: ReturnType<typeof setInterval> | null = null;
	let showAll = $state(false);

	onMount(() => {
		poll();
		interval = setInterval(poll, 3000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	async function poll() {
		try {
			snapshot = await invoke<TempSnapshot>('cputemp_poll');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function tempColor(celsius: number, critical: number | null): string {
		const max = critical ?? 100;
		const ratio = celsius / max;
		if (ratio >= 0.9) return '#ed4245';
		if (ratio >= 0.7) return '#faa61a';
		if (ratio >= 0.5) return '#fee75c';
		return '#3ba55d';
	}

	function tempPercent(celsius: number, critical: number | null): number {
		const max = critical ?? 105;
		return Math.min((celsius / max) * 100, 100);
	}

	let displayComponents = $derived(
		snapshot
			? showAll
				? snapshot.components
				: snapshot.components.slice(0, 6)
			: []
	);

	let hasMore = $derived(snapshot ? snapshot.components.length > 6 : false);
</script>

<div class="temp-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F321;</span>
			<h3>CPU Temperature</h3>
		</div>
		<button class="refresh-btn" onclick={poll} title="Refresh">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<polyline points="23 4 23 10 17 10" />
				<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
			</svg>
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{:else if snapshot}
		{#if snapshot.cpuAvgCelsius !== null}
			<div class="summary-card">
				<div class="summary-row">
					<span class="summary-label">CPU Average</span>
					<span class="summary-value" style="color: {tempColor(snapshot.cpuAvgCelsius, 100)}">{snapshot.cpuAvgCelsius}&deg;C</span>
				</div>
				<div class="progress-bg">
					<div class="progress-fill" style="width: {tempPercent(snapshot.cpuAvgCelsius, 100)}%; background: {tempColor(snapshot.cpuAvgCelsius, 100)}"></div>
				</div>
			</div>
		{/if}

		{#if snapshot.hottestLabel && snapshot.hottestCelsius !== null}
			<div class="hottest">
				<span class="hottest-label">Hottest: {snapshot.hottestLabel}</span>
				<span class="hottest-value" style="color: {tempColor(snapshot.hottestCelsius, 100)}">{snapshot.hottestCelsius}&deg;C</span>
			</div>
		{/if}

		{#if snapshot.components.length === 0}
			<div class="no-sensors">No temperature sensors detected</div>
		{:else}
			<div class="sensor-list">
				{#each displayComponents as comp}
					<div class="sensor-row">
						<div class="sensor-info">
							<span class="sensor-name" title={comp.label}>{comp.label}</span>
							<span class="sensor-temp" style="color: {tempColor(comp.currentCelsius, comp.criticalCelsius)}">{comp.currentCelsius}&deg;C</span>
						</div>
						<div class="progress-bg small">
							<div class="progress-fill" style="width: {tempPercent(comp.currentCelsius, comp.criticalCelsius)}%; background: {tempColor(comp.currentCelsius, comp.criticalCelsius)}"></div>
						</div>
						{#if comp.criticalCelsius !== null}
							<span class="sensor-crit">crit: {comp.criticalCelsius}&deg;</span>
						{/if}
					</div>
				{/each}
			</div>

			{#if hasMore}
				<button class="show-more-btn" onclick={() => { showAll = !showAll; }}>
					{showAll ? 'Show less' : `Show all ${snapshot.components.length} sensors`}
				</button>
			{/if}
		{/if}
	{:else}
		<div class="loading">Reading sensors...</div>
	{/if}
</div>

<style>
	.temp-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	.refresh-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.refresh-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error, .loading, .no-sensors { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
	.error { color: #ed4245; }

	.summary-card {
		padding: 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.summary-row { display: flex; justify-content: space-between; align-items: center; }
	.summary-label { font-size: 12px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.3px; }
	.summary-value { font-size: 20px; font-weight: 700; font-family: monospace; }

	.hottest {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 10px;
		background: rgba(237, 66, 69, 0.08);
		border-radius: 6px;
		font-size: 12px;
	}
	.hottest-label { color: var(--text-secondary, #949ba4); }
	.hottest-value { font-family: monospace; font-weight: 600; }

	.sensor-list { display: flex; flex-direction: column; gap: 6px; }

	.sensor-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.sensor-info { display: flex; justify-content: space-between; align-items: center; }
	.sensor-name {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 160px;
	}
	.sensor-temp { font-size: 13px; font-weight: 600; font-family: monospace; }
	.sensor-crit { font-size: 10px; color: var(--text-muted, #6d6f78); align-self: flex-end; }

	.progress-bg {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 2px;
		overflow: hidden;
	}
	.progress-bg.small { height: 3px; }
	.progress-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }

	.show-more-btn {
		background: none;
		border: 1px solid var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		text-align: center;
	}
	.show-more-btn:hover { color: var(--text-primary, #dbdee1); border-color: var(--text-muted, #6d6f78); }
</style>
