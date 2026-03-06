<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		hydration,
		formatMl,
		type HydrationState,
		type HydrationConfig
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

	let showSettings = $state(false);
	let intervalMinutes = $state(30);
	let goalInput = $state(8);
	let glassSizeInput = $state(250);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		hydration.init();
		unsubs.push(hydration.subscribe((s) => {
			currentState = s;
		}));
		unsubs.push(hydration.config.subscribe((c) => {
			config = c;
			intervalMinutes = Math.round(c.reminderIntervalMs / 60000);
			goalInput = c.dailyGoalGlasses;
			glassSizeInput = c.glassSizeMl;
		}));
	});

	onDestroy(() => {
		hydration.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleSaveSettings() {
		hydration.updateConfig({
			...config,
			reminderIntervalMs: intervalMinutes * 60000,
			dailyGoalGlasses: goalInput,
			glassSizeMl: glassSizeInput
		});
		showSettings = false;
	}

	let progress = $derived(config.dailyGoalGlasses > 0 ? Math.min(100, Math.round((currentState.glassesToday / config.dailyGoalGlasses) * 100)) : 0);
	let goalReached = $derived(currentState.glassesToday >= config.dailyGoalGlasses);
</script>

<div class="hydration-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
			</svg>
			<h3>Hydration</h3>
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
				<span>Reminder interval</span>
				<div class="setting-input">
					<input type="number" bind:value={intervalMinutes} min="5" max="120" step="5" />
					<span class="unit">min</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Daily goal</span>
				<div class="setting-input">
					<input type="number" bind:value={goalInput} min="1" max="20" />
					<span class="unit">glasses</span>
				</div>
			</label>
			<label class="setting-row">
				<span>Glass size</span>
				<div class="setting-input">
					<input type="number" bind:value={glassSizeInput} min="100" max="1000" step="50" />
					<span class="unit">ml</span>
				</div>
			</label>
			<button class="save-btn" onclick={handleSaveSettings}>Save Settings</button>
		</div>
	{:else}
		<div class="progress-section">
			<div class="progress-bar-bg">
				<div class="progress-bar-fill" style="width: {progress}%"></div>
			</div>
			<div class="progress-text">
				<span class="glass-count" class:goal-reached={goalReached}>
					{currentState.glassesToday} / {config.dailyGoalGlasses}
				</span>
				<span class="ml-count">{currentState.totalMlToday} ml</span>
			</div>
		</div>

		<button class="btn drink-btn" onclick={() => hydration.logDrink()}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
			</svg>
			Log Water ({config.glassSizeMl} ml)
		</button>

		<div class="action-row">
			{#if currentState.active}
				<button class="btn secondary-btn" onclick={() => hydration.stop()}>Stop Reminders</button>
			{:else}
				<button class="btn secondary-btn" onclick={() => hydration.start()}>Start Reminders</button>
			{/if}
			<button class="btn secondary-btn" onclick={() => hydration.resetToday()}>Reset Today</button>
		</div>

		{#if goalReached}
			<div class="goal-banner">Goal reached! Great hydration today.</div>
		{/if}
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
		color: #3ba5f7;
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
		width: 60px;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		text-align: right;
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

	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.progress-bar-bg {
		height: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-bar-fill {
		height: 100%;
		background: #3ba5f7;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-text {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
	}

	.glass-count {
		font-weight: 600;
	}

	.glass-count.goal-reached {
		color: var(--success, #57f287);
	}

	.ml-count {
		color: var(--text-secondary, #949ba4);
	}

	.btn {
		padding: 8px 16px;
		border-radius: 4px;
		border: none;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.drink-btn {
		background: #3ba5f7;
		color: white;
		width: 100%;
	}
	.drink-btn:hover {
		background: #2b8fd9;
	}

	.action-row {
		display: flex;
		gap: 8px;
	}

	.secondary-btn {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		border: 1px solid var(--border, #3f4147);
	}
	.secondary-btn:hover {
		background: var(--bg-secondary, #2b2d31);
	}

	.goal-banner {
		text-align: center;
		padding: 8px;
		background: rgba(87, 242, 135, 0.1);
		border-radius: 6px;
		font-size: 12px;
		color: var(--success, #57f287);
		font-weight: 500;
	}
</style>
