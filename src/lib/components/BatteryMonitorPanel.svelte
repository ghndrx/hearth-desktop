<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface BatteryInfo {
		percent: number;
		isCharging: boolean;
		powerSource: string;
		timeToEmptyMins: number | null;
		timeToFullMins: number | null;
		cycleCount: number | null;
		healthPercent: number | null;
		voltageV: number | null;
		energyWh: number | null;
		energyFullWh: number | null;
		energyRateW: number | null;
		technology: string | null;
		timestampMs: number;
	}

	let battery = $state<BatteryInfo | null>(null);
	let error = $state<string | null>(null);
	let interval: ReturnType<typeof setInterval> | null = null;
	let showDetails = $state(false);

	onMount(() => {
		poll();
		interval = setInterval(poll, 10000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	async function poll() {
		try {
			battery = await invoke<BatteryInfo>('battery_poll');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function levelColor(pct: number, charging: boolean): string {
		if (charging) return '#3ba55d';
		if (pct <= 10) return '#ed4245';
		if (pct <= 25) return '#faa61a';
		if (pct <= 50) return '#fee75c';
		return '#3ba55d';
	}

	function formatTime(mins: number): string {
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h === 0) return `${m}m`;
		return `${h}h ${m}m`;
	}

	let statusText = $derived(
		battery
			? battery.isCharging
				? battery.timeToFullMins
					? `Charging - ${formatTime(battery.timeToFullMins)} to full`
					: 'Charging'
				: battery.timeToEmptyMins
					? `${formatTime(battery.timeToEmptyMins)} remaining`
					: battery.powerSource === 'AC'
						? 'On AC power'
						: 'On battery'
			: ''
	);
</script>

<div class="battery-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				{#if battery?.isCharging}
					<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
						<path d="M7 2v11h3v9l7-12h-4l4-8z" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
						<rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
						<line x1="23" y1="13" x2="23" y2="11" />
					</svg>
				{/if}
			</span>
			<h3>Battery</h3>
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
	{:else if battery}
		<div class="level-card">
			<div class="level-row">
				<div class="battery-visual">
					<div class="battery-shell">
						<div
							class="battery-fill"
							style="width: {battery.percent}%; background: {levelColor(battery.percent, battery.isCharging)}"
						></div>
					</div>
					<div class="battery-tip"></div>
				</div>
				<span class="level-pct" style="color: {levelColor(battery.percent, battery.isCharging)}">
					{Math.round(battery.percent)}%
				</span>
			</div>
			<div class="status-text">{statusText}</div>
		</div>

		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Source</span>
				<span class="info-value">{battery.powerSource}</span>
			</div>
			{#if battery.energyRateW !== null}
				<div class="info-item">
					<span class="info-label">{battery.isCharging ? 'Input' : 'Drain'}</span>
					<span class="info-value">{battery.energyRateW} W</span>
				</div>
			{/if}
			{#if battery.healthPercent !== null}
				<div class="info-item">
					<span class="info-label">Health</span>
					<span class="info-value">{battery.healthPercent}%</span>
				</div>
			{/if}
			{#if battery.voltageV !== null}
				<div class="info-item">
					<span class="info-label">Voltage</span>
					<span class="info-value">{battery.voltageV} V</span>
				</div>
			{/if}
		</div>

		{#if battery.cycleCount !== null || battery.technology !== null || battery.energyWh !== null}
			<button class="details-toggle" onclick={() => { showDetails = !showDetails; }}>
				{showDetails ? 'Hide details' : 'Show details'}
			</button>

			{#if showDetails}
				<div class="details-grid">
					{#if battery.technology !== null}
						<div class="info-item">
							<span class="info-label">Technology</span>
							<span class="info-value">{battery.technology}</span>
						</div>
					{/if}
					{#if battery.cycleCount !== null}
						<div class="info-item">
							<span class="info-label">Cycles</span>
							<span class="info-value">{battery.cycleCount}</span>
						</div>
					{/if}
					{#if battery.energyWh !== null}
						<div class="info-item">
							<span class="info-label">Energy</span>
							<span class="info-value">{battery.energyWh} Wh</span>
						</div>
					{/if}
					{#if battery.energyFullWh !== null}
						<div class="info-item">
							<span class="info-label">Capacity</span>
							<span class="info-value">{battery.energyFullWh} Wh</span>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	{:else}
		<div class="loading">Checking battery...</div>
	{/if}
</div>

<style>
	.battery-panel {
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
	.header-icon { display: flex; color: var(--text-secondary, #949ba4); }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.refresh-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.refresh-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error, .loading { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
	.error { color: #ed4245; }

	.level-card {
		padding: 14px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.level-row { display: flex; align-items: center; gap: 12px; }

	.battery-visual { display: flex; align-items: center; flex: 1; }
	.battery-shell {
		flex: 1;
		height: 24px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.battery-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.8s ease, background 0.5s ease;
	}
	.battery-tip {
		width: 4px;
		height: 10px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 0 2px 2px 0;
		margin-left: 2px;
	}

	.level-pct { font-size: 22px; font-weight: 700; font-family: monospace; min-width: 52px; text-align: right; }

	.status-text { font-size: 12px; color: var(--text-secondary, #949ba4); }

	.info-grid, .details-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.info-label { font-size: 10px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.3px; }
	.info-value { font-size: 13px; font-weight: 600; font-family: monospace; }

	.details-toggle {
		background: none;
		border: 1px solid var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		text-align: center;
	}
	.details-toggle:hover { color: var(--text-primary, #dbdee1); border-color: var(--text-muted, #6d6f78); }
</style>
