<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface QuickTimer {
		id: string;
		label: string;
		durationSecs: number;
		remainingSecs: number;
		isRunning: boolean;
		createdAt: number;
	}

	let timers = $state<QuickTimer[]>([]);
	let customLabel = $state('');
	let customMinutes = $state(10);
	let error = $state<string | null>(null);

	const presets = [
		{ label: '5 min', secs: 300 },
		{ label: '10 min', secs: 600 },
		{ label: '15 min', secs: 900 },
		{ label: '30 min', secs: 1800 },
		{ label: '1 hour', secs: 3600 },
	];

	let unlistenTick: (() => void) | null = null;
	let unlistenComplete: (() => void) | null = null;

	onMount(async () => {
		await loadTimers();

		unlistenTick = await listen<QuickTimer[]>('quicktimer:tick', (event) => {
			timers = event.payload;
		});

		unlistenComplete = await listen('quicktimer:completed', (event) => {
			loadTimers();
		});
	});

	onDestroy(() => {
		unlistenTick?.();
		unlistenComplete?.();
	});

	async function loadTimers() {
		try {
			timers = await invoke<QuickTimer[]>('quicktimer_get_all');
		} catch (e) {
			error = String(e);
		}
	}

	async function startPreset(label: string, secs: number) {
		error = null;
		try {
			await invoke('quicktimer_start', { label, durationSecs: secs });
			await loadTimers();
		} catch (e) {
			error = String(e);
		}
	}

	async function startCustom() {
		if (customMinutes <= 0) return;
		const label = customLabel.trim() || `${customMinutes}m timer`;
		const secs = customMinutes * 60;
		error = null;
		try {
			await invoke('quicktimer_start', { label, durationSecs: secs });
			customLabel = '';
			await loadTimers();
		} catch (e) {
			error = String(e);
		}
	}

	async function cancelTimer(id: string) {
		try {
			await invoke('quicktimer_cancel', { id });
			await loadTimers();
		} catch (e) {
			error = String(e);
		}
	}

	async function cancelAll() {
		try {
			await invoke('quicktimer_cancel_all');
			timers = [];
		} catch (e) {
			error = String(e);
		}
	}

	function formatTime(secs: number): string {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function progressPercent(timer: QuickTimer): number {
		if (timer.durationSecs === 0) return 0;
		return ((timer.durationSecs - timer.remainingSecs) / timer.durationSecs) * 100;
	}
</script>

<div class="quicktimer-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x23F1;</span>
			<h3>Quick Timer</h3>
		</div>
		{#if timers.length > 1}
			<button class="cancel-all-btn" onclick={cancelAll}>Cancel All</button>
		{/if}
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="presets-row">
		{#each presets as preset}
			<button class="preset-btn" onclick={() => startPreset(preset.label + ' timer', preset.secs)}>
				{preset.label}
			</button>
		{/each}
	</div>

	<div class="custom-row">
		<input
			type="text"
			class="custom-label"
			placeholder="Label (optional)"
			bind:value={customLabel}
			onkeydown={(e) => { if (e.key === 'Enter') startCustom(); }}
		/>
		<div class="custom-duration">
			<input
				type="number"
				class="custom-minutes"
				min="1"
				max="1440"
				bind:value={customMinutes}
				onkeydown={(e) => { if (e.key === 'Enter') startCustom(); }}
			/>
			<span class="unit">min</span>
		</div>
		<button class="start-btn" onclick={startCustom}>Start</button>
	</div>

	{#if timers.length > 0}
		<div class="timers-list">
			<span class="section-label">Active Timers</span>
			{#each timers as timer (timer.id)}
				<div class="timer-card">
					<div class="timer-info">
						<span class="timer-label">{timer.label}</span>
						<span class="timer-time">{formatTime(timer.remainingSecs)}</span>
					</div>
					<div class="timer-bar-bg">
						<div
							class="timer-bar-fill"
							style="width: {progressPercent(timer)}%;"
						></div>
					</div>
					<button class="timer-cancel" onclick={() => cancelTimer(timer.id)} title="Cancel">
						&#x2715;
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			No active timers. Start one above or from the system tray.
		</div>
	{/if}
</div>

<style>
	.quicktimer-panel {
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

	.cancel-all-btn {
		padding: 4px 10px; border-radius: 4px; border: none;
		background: transparent; color: #ed4245;
		font-size: 11px; cursor: pointer;
	}
	.cancel-all-btn:hover { background: rgba(237, 66, 69, 0.1); }

	.error { font-size: 12px; color: #ed4245; }

	.presets-row {
		display: flex; gap: 6px; flex-wrap: wrap;
	}
	.preset-btn {
		flex: 1; min-width: 60px; padding: 8px 6px;
		border: 1px solid var(--border, #3f4147); border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px; font-weight: 500; cursor: pointer;
		transition: all 0.15s ease;
	}
	.preset-btn:hover {
		border-color: #5865f2; color: #5865f2;
	}

	.custom-row {
		display: flex; gap: 6px; align-items: center;
	}
	.custom-label {
		flex: 1; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
	}
	.custom-label:focus { outline: none; border-color: #5865f2; }
	.custom-duration {
		display: flex; align-items: center; gap: 4px;
	}
	.custom-minutes {
		width: 56px; padding: 8px 6px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
		text-align: center;
	}
	.custom-minutes:focus { outline: none; border-color: #5865f2; }
	.unit { font-size: 11px; color: var(--text-muted, #6d6f78); }

	.start-btn {
		padding: 8px 16px; border-radius: 6px; border: none;
		background: #5865f2; color: white;
		font-size: 12px; font-weight: 500; cursor: pointer;
		white-space: nowrap;
	}
	.start-btn:hover { background: #4752c4; }

	.timers-list { display: flex; flex-direction: column; gap: 8px; }
	.section-label {
		font-size: 10px; color: var(--text-muted, #6d6f78);
		text-transform: uppercase; letter-spacing: 0.5px;
	}

	.timer-card {
		display: flex; flex-direction: column; gap: 6px;
		padding: 10px 12px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border, #3f4147);
		position: relative;
	}
	.timer-info {
		display: flex; justify-content: space-between; align-items: center;
	}
	.timer-label {
		font-size: 12px; color: var(--text-primary, #dbdee1); font-weight: 500;
	}
	.timer-time {
		font-size: 18px; font-weight: 700; font-family: monospace;
		color: #5865f2;
	}
	.timer-bar-bg {
		height: 3px; border-radius: 2px;
		background: var(--bg-secondary, #2b2d31);
		overflow: hidden;
	}
	.timer-bar-fill {
		height: 100%; border-radius: 2px;
		background: #5865f2;
		transition: width 1s linear;
	}
	.timer-cancel {
		position: absolute; top: 8px; right: 8px;
		background: none; border: none;
		color: var(--text-muted, #6d6f78);
		font-size: 12px; cursor: pointer;
		opacity: 0; transition: opacity 0.15s;
	}
	.timer-card:hover .timer-cancel { opacity: 1; }
	.timer-cancel:hover { color: #ed4245; }

	.empty-state {
		text-align: center; padding: 24px 16px;
		font-size: 12px; color: var(--text-muted, #6d6f78);
	}
</style>
