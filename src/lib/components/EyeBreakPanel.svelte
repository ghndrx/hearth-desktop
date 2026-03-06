<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		eyeBreak,
		eyeBreakActive,
		eyeBreakOnBreak,
		formatMs,
		type EyeBreakConfig,
		type EyeBreakState
	} from '$lib/stores/eyeBreak';

	let currentState = $state<EyeBreakState>({
		active: false,
		onBreak: false,
		startedAt: 0,
		nextBreakAt: 0,
		breakStartedAt: 0,
		breaksTaken: 0,
		breaksSkipped: 0,
		totalSessionMs: 0
	});

	let config = $state<EyeBreakConfig>({
		workIntervalMs: 20 * 60 * 1000,
		breakDurationMs: 20 * 1000,
		enabled: true,
		soundEnabled: true,
		notificationEnabled: true
	});

	let timeRemaining = $state(0);
	let breakTimeRemaining = $state(0);
	let showSettings = $state(false);
	let workMinutes = $state(20);
	let breakSeconds = $state(20);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		eyeBreak.init();
		unsubs.push(eyeBreak.subscribe((s) => (currentState = s)));
		unsubs.push(eyeBreak.config.subscribe((c) => {
			config = c;
			workMinutes = Math.round(c.workIntervalMs / 60000);
			breakSeconds = Math.round(c.breakDurationMs / 1000);
		}));
		unsubs.push(eyeBreak.timeRemaining.subscribe((t) => (timeRemaining = t)));
		unsubs.push(eyeBreak.breakTimeRemaining.subscribe((t) => (breakTimeRemaining = t)));
	});

	onDestroy(() => {
		eyeBreak.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleSaveSettings() {
		eyeBreak.updateConfig({
			...config,
			workIntervalMs: workMinutes * 60 * 1000,
			breakDurationMs: breakSeconds * 1000
		});
		showSettings = false;
	}

	const presets = [
		{ label: '20-20-20', work: 20, breakSec: 20 },
		{ label: '30-30', work: 30, breakSec: 30 },
		{ label: '45-60', work: 45, breakSec: 60 }
	];

	let progress = $derived(
		currentState.active && !currentState.onBreak && config.workIntervalMs > 0
			? Math.max(0, Math.min(1, 1 - timeRemaining / config.workIntervalMs))
			: 0
	);

	let breakProgress = $derived(
		currentState.onBreak && config.breakDurationMs > 0
			? Math.max(0, Math.min(1, 1 - breakTimeRemaining / config.breakDurationMs))
			: 0
	);
</script>

<div class="eye-break-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
			<h3>Eye Break Reminder</h3>
		</div>
		<button class="settings-btn" onclick={() => (showSettings = !showSettings)} title="Settings">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		</button>
	</div>

	{#if showSettings}
		<div class="settings-section">
			<div class="presets">
				{#each presets as preset}
					<button
						class="preset-btn"
						class:active={workMinutes === preset.work && breakSeconds === preset.breakSec}
						onclick={() => { workMinutes = preset.work; breakSeconds = preset.breakSec; }}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			<label class="setting-row">
				<span>Work interval</span>
				<div class="setting-input">
					<input type="number" bind:value={workMinutes} min="1" max="120" />
					<span class="unit">min</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Break duration</span>
				<div class="setting-input">
					<input type="number" bind:value={breakSeconds} min="5" max="300" />
					<span class="unit">sec</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Notifications</span>
				<input type="checkbox" bind:checked={config.notificationEnabled} />
			</label>
			<button class="save-btn" onclick={handleSaveSettings}>Save Settings</button>
		</div>
	{:else if currentState.onBreak}
		<div class="break-view">
			<div class="break-circle">
				<svg viewBox="0 0 120 120" class="progress-ring">
					<circle cx="60" cy="60" r="52" class="ring-bg" />
					<circle
						cx="60" cy="60" r="52"
						class="ring-fill break-ring"
						stroke-dasharray={2 * Math.PI * 52}
						stroke-dashoffset={2 * Math.PI * 52 * (1 - breakProgress)}
					/>
				</svg>
				<div class="break-timer">{formatMs(breakTimeRemaining)}</div>
			</div>
			<p class="break-message">Look at something 20ft away</p>
			<div class="break-actions">
				<button class="btn done-btn" onclick={() => eyeBreak.endBreak()}>Done</button>
				<button class="btn skip-btn" onclick={() => eyeBreak.skipBreak()}>Skip</button>
			</div>
		</div>
	{:else if currentState.active}
		<div class="active-view">
			<div class="progress-circle">
				<svg viewBox="0 0 120 120" class="progress-ring">
					<circle cx="60" cy="60" r="52" class="ring-bg" />
					<circle
						cx="60" cy="60" r="52"
						class="ring-fill"
						stroke-dasharray={2 * Math.PI * 52}
						stroke-dashoffset={2 * Math.PI * 52 * (1 - progress)}
					/>
				</svg>
				<div class="timer-display">
					<span class="time">{formatMs(timeRemaining)}</span>
					<span class="label">until break</span>
				</div>
			</div>
			<div class="session-stats">
				<div class="stat">
					<span class="stat-value">{currentState.breaksTaken}</span>
					<span class="stat-label">breaks taken</span>
				</div>
				<div class="stat">
					<span class="stat-value">{currentState.breaksSkipped}</span>
					<span class="stat-label">skipped</span>
				</div>
			</div>
			<button class="btn stop-btn" onclick={() => eyeBreak.stop()}>Stop</button>
		</div>
	{:else}
		<div class="idle-view">
			<div class="rule-info">
				<h4>20-20-20 Rule</h4>
				<p>Every <strong>{workMinutes} min</strong>, look at something 20ft away for <strong>{breakSeconds}s</strong>.</p>
			</div>
			{#if currentState.breaksTaken > 0 || currentState.breaksSkipped > 0}
				<div class="last-session">
					<span>Last session: {currentState.breaksTaken} breaks taken, {currentState.breaksSkipped} skipped</span>
				</div>
			{/if}
			<button class="btn start-btn" onclick={() => eyeBreak.start()}>Start Timer</button>
		</div>
	{/if}
</div>

<style>
	.eye-break-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.settings-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.settings-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	/* Settings */
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.presets {
		display: flex;
		gap: 6px;
	}

	.preset-btn {
		flex: 1;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.preset-btn.active {
		border-color: var(--accent, #5865f2);
		color: var(--accent, #5865f2);
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
	}

	.setting-input {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.setting-input input[type='number'] {
		width: 60px;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		text-align: right;
	}

	.setting-input input[type='number']:focus {
		outline: none;
		border-color: var(--accent, #5865f2);
	}

	.setting-row input[type='checkbox'] {
		accent-color: var(--accent, #5865f2);
	}

	.unit {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.save-btn {
		padding: 8px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.save-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	/* Progress circle */
	.progress-circle, .break-circle {
		position: relative;
		width: 120px;
		height: 120px;
		margin: 8px auto;
	}

	.progress-ring {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring-bg {
		fill: none;
		stroke: var(--bg-tertiary, #1e1f22);
		stroke-width: 6;
	}

	.ring-fill {
		fill: none;
		stroke: var(--accent, #5865f2);
		stroke-width: 6;
		stroke-linecap: round;
		transition: stroke-dashoffset 0.5s ease;
	}

	.break-ring {
		stroke: var(--success, #57f287);
	}

	.timer-display, .break-timer {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
	}

	.time {
		font-size: 22px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.label {
		display: block;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		margin-top: 2px;
	}

	.break-timer {
		font-size: 28px;
		font-weight: 700;
		color: var(--success, #57f287);
		font-variant-numeric: tabular-nums;
	}

	/* Break view */
	.break-view {
		text-align: center;
	}

	.break-message {
		margin: 8px 0 12px;
		font-size: 14px;
		color: var(--success, #57f287);
		font-weight: 500;
	}

	.break-actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	/* Active view */
	.active-view {
		text-align: center;
	}

	.session-stats {
		display: flex;
		justify-content: center;
		gap: 24px;
		margin: 8px 0;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 600;
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	/* Idle view */
	.idle-view {
		text-align: center;
	}

	.rule-info h4 {
		margin: 0 0 4px;
		font-size: 15px;
		font-weight: 600;
		color: var(--accent, #5865f2);
	}

	.rule-info p {
		margin: 0;
		font-size: 13px;
		color: var(--text-secondary, #949ba4);
		line-height: 1.4;
	}

	.last-session {
		margin-top: 8px;
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	/* Buttons */
	.btn {
		padding: 8px 20px;
		border-radius: 4px;
		border: none;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.start-btn {
		margin-top: 12px;
		background: var(--accent, #5865f2);
		color: white;
	}
	.start-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	.stop-btn {
		background: var(--danger, #ed4245);
		color: white;
	}
	.stop-btn:hover {
		opacity: 0.9;
	}

	.done-btn {
		background: var(--success, #57f287);
		color: #1e1f22;
	}
	.done-btn:hover {
		opacity: 0.9;
	}

	.skip-btn {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
	}
	.skip-btn:hover {
		color: var(--text-primary, #dbdee1);
	}
</style>
