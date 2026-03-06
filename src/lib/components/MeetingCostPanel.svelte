<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		meetingCost,
		meetingRunning,
		meetingPaused,
		formatCost,
		formatDuration,
		costPerSecond,
		type MeetingCostState,
		type MeetingCostConfig
	} from '$lib/stores/meetingCost';

	let currentState = $state<MeetingCostState>({
		running: false,
		paused: false,
		startedAt: 0,
		pausedAt: 0,
		totalPausedMs: 0,
		attendees: 2,
		hourlyRate: 75,
		elapsedMs: 0,
		totalCost: 0,
		meetingsToday: 0,
		totalCostToday: 0,
		totalTimeTodayMs: 0
	});

	let config = $state<MeetingCostConfig>({
		defaultHourlyRate: 75,
		currencySymbol: '$',
		currencyCode: 'USD'
	});

	let showSettings = $state(false);
	let attendeeInput = $state(2);
	let rateInput = $state(75);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		meetingCost.init();
		unsubs.push(meetingCost.subscribe((s) => {
			currentState = s;
			if (!s.running) {
				attendeeInput = s.attendees;
				rateInput = s.hourlyRate;
			}
		}));
		unsubs.push(meetingCost.config.subscribe((c) => {
			config = c;
			if (!currentState.running) {
				rateInput = c.defaultHourlyRate;
			}
		}));
	});

	onDestroy(() => {
		meetingCost.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleStart() {
		meetingCost.start(attendeeInput, rateInput);
	}

	function handleSaveSettings() {
		meetingCost.updateConfig({
			...config,
			defaultHourlyRate: rateInput
		});
		showSettings = false;
	}

	let burnRate = $derived(costPerSecond(currentState.attendees, currentState.hourlyRate));
</script>

<div class="meeting-cost-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<path d="M12 6v6l4 2" />
			</svg>
			<h3>Meeting Cost</h3>
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
			<label class="setting-row">
				<span>Default hourly rate</span>
				<div class="setting-input">
					<span class="unit">{config.currencySymbol}</span>
					<input type="number" bind:value={rateInput} min="1" max="10000" step="5" />
					<span class="unit">/hr</span>
				</div>
			</label>
			<button class="save-btn" onclick={handleSaveSettings}>Save Settings</button>
		</div>
	{:else if currentState.running}
		<div class="active-view">
			<div class="cost-display">
				<span class="cost-amount">{formatCost(currentState.totalCost, config.currencySymbol)}</span>
				<span class="cost-label">and counting</span>
			</div>

			<div class="timer-display">
				<span class="time">{formatDuration(currentState.elapsedMs)}</span>
			</div>

			<div class="burn-rate">
				{formatCost(burnRate, config.currencySymbol)}/sec
			</div>

			<div class="meeting-info">
				<div class="info-row">
					<span class="info-label">Attendees</span>
					<div class="attendee-controls">
						<button class="adj-btn" onclick={() => { if (currentState.attendees > 1) meetingCost.updateAttendees(currentState.attendees - 1); }}>-</button>
						<span class="info-value">{currentState.attendees}</span>
						<button class="adj-btn" onclick={() => meetingCost.updateAttendees(currentState.attendees + 1)}>+</button>
					</div>
				</div>
				<div class="info-row">
					<span class="info-label">Rate</span>
					<span class="info-value">{formatCost(currentState.hourlyRate, config.currencySymbol)}/hr each</span>
				</div>
			</div>

			<div class="action-buttons">
				{#if currentState.paused}
					<button class="btn resume-btn" onclick={() => meetingCost.resume()}>Resume</button>
				{:else}
					<button class="btn pause-btn" onclick={() => meetingCost.pause()}>Pause</button>
				{/if}
				<button class="btn stop-btn" onclick={() => meetingCost.stop()}>End Meeting</button>
			</div>
		</div>
	{:else}
		<div class="idle-view">
			<div class="setup-form">
				<label class="setting-row">
					<span>Attendees</span>
					<div class="setting-input">
						<input type="number" bind:value={attendeeInput} min="1" max="100" />
					</div>
				</label>
				<label class="setting-row">
					<span>Hourly rate</span>
					<div class="setting-input">
						<span class="unit">{config.currencySymbol}</span>
						<input type="number" bind:value={rateInput} min="1" max="10000" step="5" />
					</div>
				</label>
			</div>

			<div class="preview-cost">
				<span class="preview-label">Burn rate:</span>
				<span class="preview-value">{formatCost(costPerSecond(attendeeInput, rateInput) * 60, config.currencySymbol)}/min</span>
			</div>

			<button class="btn start-btn" onclick={handleStart}>Start Meeting</button>

			{#if currentState.meetingsToday > 0}
				<div class="daily-stats">
					<div class="stat">
						<span class="stat-value">{currentState.meetingsToday}</span>
						<span class="stat-label">meetings today</span>
					</div>
					<div class="stat">
						<span class="stat-value">{formatCost(currentState.totalCostToday, config.currencySymbol)}</span>
						<span class="stat-label">total cost</span>
					</div>
					<div class="stat">
						<span class="stat-value">{formatDuration(currentState.totalTimeTodayMs)}</span>
						<span class="stat-label">total time</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.meeting-cost-panel {
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
		width: 70px;
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

	/* Active view */
	.active-view {
		text-align: center;
	}

	.cost-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 4px;
	}

	.cost-amount {
		font-size: 32px;
		font-weight: 700;
		color: var(--warning, #fee75c);
		font-variant-numeric: tabular-nums;
	}

	.cost-label {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.timer-display {
		margin: 4px 0;
	}

	.time {
		font-size: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.burn-rate {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		margin-bottom: 8px;
		font-variant-numeric: tabular-nums;
	}

	.meeting-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		margin-bottom: 10px;
	}

	.info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
	}

	.info-label {
		color: var(--text-secondary, #949ba4);
	}

	.info-value {
		font-weight: 500;
	}

	.attendee-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.adj-btn {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}
	.adj-btn:hover {
		border-color: var(--accent, #5865f2);
	}

	.action-buttons {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	/* Idle view */
	.idle-view {
		text-align: center;
	}

	.setup-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 10px;
	}

	.preview-cost {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		margin-bottom: 10px;
	}

	.preview-value {
		font-weight: 600;
		color: var(--warning, #fee75c);
	}

	.daily-stats {
		display: flex;
		justify-content: center;
		gap: 16px;
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--border, #3f4147);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-secondary, #949ba4);
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
		background: var(--accent, #5865f2);
		color: white;
		width: 100%;
	}
	.start-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	.stop-btn {
		background: var(--danger, #ed4245);
		color: white;
		flex: 1;
	}
	.stop-btn:hover {
		opacity: 0.9;
	}

	.pause-btn {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		border: 1px solid var(--border, #3f4147);
		flex: 1;
	}
	.pause-btn:hover {
		background: var(--bg-secondary, #2b2d31);
	}

	.resume-btn {
		background: var(--success, #57f287);
		color: #1e1f22;
		flex: 1;
	}
	.resume-btn:hover {
		opacity: 0.9;
	}
</style>
