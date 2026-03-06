<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		hydration,
		formatMs,
		formatMl,
		type HydrationConfig,
		type HydrationState
	} from '$lib/stores/hydration';

	let currentState = $state<HydrationState>({
		active: false,
		startedAt: 0,
		nextReminderAt: 0,
		glassesToday: 0,
		totalMlToday: 0,
		lastDrinkAt: 0,
		remindersSent: 0,
		dayStartedAt: 0
	});

	let config = $state<HydrationConfig>({
		reminderIntervalMs: 30 * 60 * 1000,
		dailyGoalGlasses: 8,
		glassSizeMl: 250,
		enabled: true,
		notificationEnabled: true
	});

	let timeUntilReminder = $state(0);
	let isReminderDue = $state(false);
	let showSettings = $state(false);
	let intervalMinutes = $state(30);
	let goalGlasses = $state(8);
	let glassSizeMl = $state(250);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		hydration.init();
		unsubs.push(hydration.subscribe((s) => (currentState = s)));
		unsubs.push(hydration.config.subscribe((c) => {
			config = c;
			intervalMinutes = Math.round(c.reminderIntervalMs / 60000);
			goalGlasses = c.dailyGoalGlasses;
			glassSizeMl = c.glassSizeMl;
		}));
		unsubs.push(hydration.timeUntilReminder.subscribe((t) => (timeUntilReminder = t)));
		unsubs.push(hydration.reminderDue.subscribe((d) => (isReminderDue = d)));
	});

	onDestroy(() => {
		hydration.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleSaveSettings() {
		hydration.updateConfig({
			...config,
			reminderIntervalMs: intervalMinutes * 60 * 1000,
			dailyGoalGlasses: goalGlasses,
			glassSizeMl: glassSizeMl
		});
		showSettings = false;
	}

	let progress = $derived(
		config.dailyGoalGlasses > 0
			? Math.min(1, currentState.glassesToday / config.dailyGoalGlasses)
			: 0
	);

	let goalReached = $derived(currentState.glassesToday >= config.dailyGoalGlasses);

	const presets = [
		{ label: '15 min', interval: 15 },
		{ label: '30 min', interval: 30 },
		{ label: '60 min', interval: 60 }
	];

	// Generate water drop fill indicators
	let filledDrops = $derived(Math.min(currentState.glassesToday, config.dailyGoalGlasses));
	let emptyDrops = $derived(Math.max(0, config.dailyGoalGlasses - currentState.glassesToday));
</script>

<div class="hydration-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
			</svg>
			<h3>Hydration Tracker</h3>
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
						class:active={intervalMinutes === preset.interval}
						onclick={() => { intervalMinutes = preset.interval; }}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			<label class="setting-row">
				<span>Reminder interval</span>
				<div class="setting-input">
					<input type="number" bind:value={intervalMinutes} min="5" max="120" />
					<span class="unit">min</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Daily goal</span>
				<div class="setting-input">
					<input type="number" bind:value={goalGlasses} min="1" max="20" />
					<span class="unit">glasses</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Glass size</span>
				<div class="setting-input">
					<input type="number" bind:value={glassSizeMl} min="100" max="500" step="50" />
					<span class="unit">ml</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Notifications</span>
				<input type="checkbox" bind:checked={config.notificationEnabled} />
			</label>
			<button class="save-btn" onclick={handleSaveSettings}>Save Settings</button>
		</div>
	{:else if isReminderDue && currentState.active}
		<div class="reminder-view">
			<div class="reminder-icon">
				<svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
					<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
				</svg>
			</div>
			<p class="reminder-message">Time to drink water!</p>
			<p class="reminder-sub">{currentState.glassesToday} of {config.dailyGoalGlasses} glasses today</p>
			<div class="reminder-actions">
				<button class="btn drink-btn" onclick={() => hydration.logDrink()}>
					I drank water
				</button>
				<button class="btn snooze-btn" onclick={() => hydration.dismissReminder()}>
					Snooze
				</button>
			</div>
		</div>
	{:else}
		<div class="main-view">
			<!-- Progress bar -->
			<div class="progress-section">
				<div class="progress-header">
					<span class="progress-label">
						{currentState.glassesToday} / {config.dailyGoalGlasses} glasses
					</span>
					<span class="progress-ml">{formatMl(currentState.totalMlToday)}</span>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill"
						class:goal-reached={goalReached}
						style="width: {progress * 100}%"
					></div>
				</div>
				<!-- Water drop indicators -->
				<div class="drops-row">
					{#each Array(filledDrops) as _}
						<svg class="drop filled" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
							<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
						</svg>
					{/each}
					{#each Array(emptyDrops) as _}
						<svg class="drop empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
							<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
						</svg>
					{/each}
				</div>
			</div>

			{#if goalReached}
				<div class="goal-message">
					Goal reached! Great job staying hydrated.
				</div>
			{/if}

			<!-- Quick log drink button -->
			<button class="btn log-drink-btn" onclick={() => hydration.logDrink()}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Log {formatMl(config.glassSizeMl)} Water
			</button>

			<!-- Timer section -->
			{#if currentState.active}
				<div class="timer-section">
					<span class="timer-label">Next reminder in</span>
					<span class="timer-value">{formatMs(timeUntilReminder)}</span>
				</div>
				<button class="btn stop-btn" onclick={() => hydration.stop()}>Stop Reminders</button>
			{:else}
				<button class="btn start-btn" onclick={() => hydration.start()}>
					Start Reminders (every {intervalMinutes}m)
				</button>
			{/if}

			{#if currentState.glassesToday > 0}
				<button class="btn reset-btn" onclick={() => hydration.resetToday()}>Reset Today</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hydration-panel {
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
		color: #3ba0ff;
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
		border-color: #3ba0ff;
		color: #3ba0ff;
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
		border-color: #3ba0ff;
	}

	.setting-row input[type='checkbox'] {
		accent-color: #3ba0ff;
	}

	.unit {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.save-btn {
		padding: 8px;
		border-radius: 4px;
		border: none;
		background: #3ba0ff;
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.save-btn:hover {
		background: #2d8ce0;
	}

	/* Progress section */
	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}

	.progress-label {
		font-weight: 500;
	}

	.progress-ml {
		color: var(--text-secondary, #949ba4);
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #3ba0ff;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-fill.goal-reached {
		background: var(--success, #57f287);
	}

	.drops-row {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
		margin-top: 2px;
	}

	.drop.filled {
		color: #3ba0ff;
	}

	.drop.empty {
		color: var(--text-muted, #6d6f78);
	}

	.goal-message {
		text-align: center;
		font-size: 13px;
		color: var(--success, #57f287);
		font-weight: 500;
		padding: 4px 0;
	}

	/* Timer */
	.timer-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 13px;
	}

	.timer-label {
		color: var(--text-secondary, #949ba4);
	}

	.timer-value {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #3ba0ff;
	}

	/* Reminder view */
	.reminder-view {
		text-align: center;
		padding: 8px 0;
	}

	.reminder-icon {
		color: #3ba0ff;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.7; transform: scale(1.1); }
	}

	.reminder-message {
		margin: 8px 0 4px;
		font-size: 16px;
		font-weight: 600;
		color: #3ba0ff;
	}

	.reminder-sub {
		margin: 0 0 12px;
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.reminder-actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	/* Buttons */
	.btn {
		padding: 8px 16px;
		border-radius: 4px;
		border: none;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.log-drink-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		background: #3ba0ff;
		color: white;
	}
	.log-drink-btn:hover {
		background: #2d8ce0;
	}

	.start-btn {
		width: 100%;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		border: 1px solid var(--border, #3f4147);
	}
	.start-btn:hover {
		border-color: #3ba0ff;
		color: #3ba0ff;
	}

	.stop-btn {
		width: 100%;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--danger, #ed4245);
		border: 1px solid var(--border, #3f4147);
	}
	.stop-btn:hover {
		border-color: var(--danger, #ed4245);
	}

	.drink-btn {
		background: #3ba0ff;
		color: white;
	}
	.drink-btn:hover {
		background: #2d8ce0;
	}

	.snooze-btn {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
	}
	.snooze-btn:hover {
		color: var(--text-primary, #dbdee1);
	}

	.reset-btn {
		width: 100%;
		background: none;
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
		padding: 4px;
	}
	.reset-btn:hover {
		color: var(--text-secondary, #949ba4);
	}
</style>
