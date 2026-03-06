<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, derived, get } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';

	interface DailyUsage {
		date: string;
		total_minutes: number;
		active_minutes: number;
		idle_minutes: number;
		sessions: { start: number; end: number | null; active_minutes: number; idle_minutes: number }[];
		hourly_minutes: number[];
		peak_hour: number;
	}

	interface ScreenTimeState {
		is_tracking: boolean;
		is_idle: boolean;
		current_session_start: number | null;
		today: DailyUsage;
		session_count_today: number;
	}

	interface WeeklyStats {
		average_daily: number;
		total_week: number;
		trend: 'up' | 'down' | 'stable';
		most_active_day: string;
		most_active_hour: number;
		days: DailyUsage[];
	}

	// Props
	export let showWeeklyGoal: boolean = true;
	export let weeklyGoalMinutes: number = 1200; // 20 hours default
	export let onGoalReached: ((minutes: number) => void) | null = null;
	export let compact: boolean = false;

	// Stores
	const trackingState = writable<ScreenTimeState | null>(null);
	const weeklyData = writable<WeeklyStats | null>(null);

	// Derived
	const todayUsage = derived(trackingState, ($s) => $s?.today ?? {
		date: '', total_minutes: 0, active_minutes: 0, idle_minutes: 0,
		sessions: [], hourly_minutes: new Array(24).fill(0), peak_hour: 0
	});

	const isTracking = derived(trackingState, ($s) => $s?.is_tracking ?? false);
	const isIdle = derived(trackingState, ($s) => $s?.is_idle ?? false);
	const sessionCount = derived(trackingState, ($s) => $s?.session_count_today ?? 0);

	const goalProgress = derived([weeklyData, todayUsage], ([$weekly, $today]) => {
		const weekTotal = ($weekly?.total_week ?? 0);
		const percentage = Math.min(100, Math.round((weekTotal / weeklyGoalMinutes) * 100));
		return { weekTotal, percentage, remaining: Math.max(0, weeklyGoalMinutes - weekTotal) };
	});

	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let saveInterval: ReturnType<typeof setInterval> | null = null;
	let activityThrottle = 0;

	function formatDuration(minutes: number): string {
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	function formatHour(hour: number): string {
		const period = hour >= 12 ? 'PM' : 'AM';
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour}${period}`;
	}

	async function refreshState() {
		try {
			const state = await invoke<ScreenTimeState>('screentime_get_state');
			trackingState.set(state);
		} catch (err) {
			console.warn('Screen time state unavailable:', err);
		}
	}

	async function refreshWeekly() {
		try {
			const weekly = await invoke<WeeklyStats>('screentime_get_weekly');
			weeklyData.set(weekly);
		} catch (err) {
			console.warn('Screen time weekly unavailable:', err);
		}
	}

	async function sendHeartbeat() {
		try {
			const state = await invoke<ScreenTimeState>('screentime_heartbeat');
			trackingState.set(state);

			// Check goal
			const progress = get(goalProgress);
			if (progress.percentage >= 100 && onGoalReached) {
				onGoalReached(progress.weekTotal);
			}
		} catch {
			// ignore
		}
	}

	function recordActivity() {
		const now = Date.now();
		if (now - activityThrottle < 10000) return; // throttle to every 10s
		activityThrottle = now;
		invoke('screentime_activity').catch(() => {});
	}

	async function resetData() {
		await invoke('screentime_reset').catch(() => {});
		await refreshState();
		await refreshWeekly();
	}

	// Activity listeners
	function setupActivityListeners() {
		const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
		events.forEach((event) => {
			document.addEventListener(event, recordActivity, { passive: true });
		});
		return () => {
			events.forEach((event) => {
				document.removeEventListener(event, recordActivity);
			});
		};
	}

	let cleanupListeners: (() => void) | null = null;
	let handleVisibility: (() => void) | null = null;

	onMount(async () => {
		// Start native tracking
		try {
			const state = await invoke<ScreenTimeState>('screentime_start');
			trackingState.set(state);
		} catch (err) {
			console.warn('Could not start screen time tracking:', err);
		}

		await refreshWeekly();

		// Heartbeat every 60 seconds
		heartbeatInterval = setInterval(sendHeartbeat, 60000);

		// Save + refresh weekly every 5 minutes
		saveInterval = setInterval(async () => {
			await invoke('screentime_save').catch(() => {});
			await refreshWeekly();
		}, 5 * 60 * 1000);

		cleanupListeners = setupActivityListeners();

		// Handle visibility changes
		handleVisibility = async () => {
			if (document.hidden) {
				await invoke('screentime_stop').catch(() => {});
			} else {
				const state = await invoke<ScreenTimeState>('screentime_start').catch(() => null);
				if (state) trackingState.set(state);
			}
		};
		document.addEventListener('visibilitychange', handleVisibility);
	});

	onDestroy(() => {
		if (heartbeatInterval) clearInterval(heartbeatInterval);
		if (saveInterval) clearInterval(saveInterval);
		if (cleanupListeners) cleanupListeners();
		if (handleVisibility) document.removeEventListener('visibilitychange', handleVisibility);
		invoke('screentime_stop').catch(() => {});
		invoke('screentime_save').catch(() => {});
	});
</script>

<div class="screen-time-tracker" class:compact>
	{#if compact}
		<div class="compact-display">
			<span class="time-icon">&#x23F1;&#xFE0F;</span>
			<span class="today-time">{formatDuration($todayUsage.active_minutes)}</span>
			{#if $isIdle}
				<span class="idle-badge">idle</span>
			{/if}
		</div>
	{:else}
		<div class="tracker-header">
			<h3>Screen Time</h3>
			<div class="tracking-status" class:active={$isTracking && !$isIdle}>
				{#if !$isTracking}
					&#x25CB; Paused
				{:else if $isIdle}
					&#x25CB; Idle
				{:else}
					&#x25CF; Recording
				{/if}
			</div>
		</div>

		<div class="today-summary">
			<div class="big-number">
				<span class="value">{formatDuration($todayUsage.active_minutes)}</span>
				<span class="label">Active Today</span>
			</div>

			<div class="session-info">
				<div class="stat">
					<span class="stat-value">{$sessionCount}</span>
					<span class="stat-label">Sessions</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatHour($todayUsage.peak_hour)}</span>
					<span class="stat-label">Peak Hour</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatDuration($todayUsage.idle_minutes)}</span>
					<span class="stat-label">Idle</span>
				</div>
			</div>
		</div>

		<!-- Hourly heatmap -->
		{#if $todayUsage.hourly_minutes.some((m) => m > 0)}
			<div class="hourly-heatmap">
				<h4>Today's Activity</h4>
				<div class="heatmap-grid">
					{#each $todayUsage.hourly_minutes as mins, hour}
						{@const maxHourly = Math.max(...$todayUsage.hourly_minutes, 1)}
						{@const intensity = mins / maxHourly}
						<div
							class="heatmap-cell"
							class:active={mins > 0}
							style="opacity: {0.15 + intensity * 0.85}"
							title="{formatHour(hour)}: {mins}m"
						>
							{#if hour % 6 === 0}
								<span class="hour-label">{formatHour(hour)}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if showWeeklyGoal}
			<div class="weekly-goal">
				<div class="goal-header">
					<span>Weekly Goal</span>
					<span class="goal-text"
						>{formatDuration($goalProgress.weekTotal)} / {formatDuration(weeklyGoalMinutes)}</span
					>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill"
						class:complete={$goalProgress.percentage >= 100}
						style="width: {$goalProgress.percentage}%"
					></div>
				</div>
				<div class="goal-remaining">
					{#if $goalProgress.remaining > 0}
						{formatDuration($goalProgress.remaining)} remaining
					{:else}
						Goal reached!
					{/if}
				</div>
			</div>
		{/if}

		{#if $weeklyData && $weeklyData.days.length > 0}
			<div class="weekly-stats">
				<h4>This Week</h4>
				<div class="stats-grid">
					<div class="stat-card">
						<span class="card-value">{formatDuration($weeklyData.average_daily)}</span>
						<span class="card-label">Daily Avg</span>
					</div>
					<div class="stat-card">
						<span class="card-value">{formatDuration($weeklyData.total_week)}</span>
						<span class="card-label">Total</span>
					</div>
					<div class="stat-card">
						<span class="card-value trend-{$weeklyData.trend}">
							{$weeklyData.trend === 'up' ? '↑' : $weeklyData.trend === 'down' ? '↓' : '→'}
						</span>
						<span class="card-label">Trend</span>
					</div>
					<div class="stat-card">
						<span class="card-value">{formatHour($weeklyData.most_active_hour)}</span>
						<span class="card-label">Peak Hour</span>
					</div>
				</div>
			</div>

			<div class="daily-chart">
				<h4>Daily Usage</h4>
				<div class="chart-bars">
					{#each $weeklyData.days as day}
						{@const maxMinutes = Math.max(...$weeklyData.days.map((d) => d.active_minutes), 1)}
						{@const height = Math.max(4, (day.active_minutes / maxMinutes) * 100)}
						{@const isToday = day.date === $todayUsage.date}
						<div class="bar-container" class:today={isToday}>
							<div
								class="bar"
								style="height: {height}%"
								title="{day.date}: {formatDuration(day.active_minutes)}"
							></div>
							<span class="bar-label">
								{isToday
									? 'T'
									: new Date(day.date + 'T00:00:00')
											.toLocaleDateString('en', { weekday: 'short' })
											.charAt(0)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="tracker-actions">
			<button class="reset-btn" on:click={resetData}> Reset Data </button>
		</div>
	{/if}
</div>

<style>
	.screen-time-tracker {
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		padding: 16px;
		color: var(--text-primary, #dcddde);
	}

	.screen-time-tracker.compact {
		padding: 4px 8px;
		background: transparent;
		border-radius: 4px;
	}

	.compact-display {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}

	.time-icon {
		font-size: 14px;
	}

	.today-time {
		font-weight: 500;
	}

	.idle-badge {
		background: var(--bg-tertiary, #202225);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.tracker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.tracker-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.tracking-status {
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	.tracking-status.active {
		color: var(--status-green, #3ba55c);
	}

	.today-summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		padding: 16px;
		background: var(--bg-tertiary, #202225);
		border-radius: 8px;
	}

	.big-number {
		display: flex;
		flex-direction: column;
	}

	.big-number .value {
		font-size: 32px;
		font-weight: 700;
		color: var(--text-normal, #fff);
	}

	.big-number .label {
		font-size: 12px;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.session-info {
		display: flex;
		gap: 20px;
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
		color: var(--text-muted, #72767d);
	}

	/* Hourly heatmap */
	.hourly-heatmap {
		margin-bottom: 20px;
	}

	.hourly-heatmap h4,
	.weekly-stats h4,
	.daily-chart h4 {
		margin: 0 0 10px 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.heatmap-grid {
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		gap: 2px;
		height: 28px;
	}

	.heatmap-cell {
		background: var(--brand-primary, #5865f2);
		border-radius: 2px;
		position: relative;
		opacity: 0.15;
	}

	.heatmap-cell.active {
		background: var(--brand-primary, #5865f2);
	}

	.hour-label {
		position: absolute;
		bottom: -16px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 9px;
		color: var(--text-muted, #72767d);
		white-space: nowrap;
	}

	.weekly-goal {
		margin-bottom: 20px;
	}

	.goal-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
		font-size: 13px;
	}

	.goal-text {
		color: var(--text-muted, #72767d);
	}

	.progress-bar {
		height: 8px;
		background: var(--bg-tertiary, #202225);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--brand-primary, #5865f2);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-fill.complete {
		background: var(--status-green, #3ba55c);
	}

	.goal-remaining {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-muted, #72767d);
		text-align: right;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-bottom: 20px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 8px;
		background: var(--bg-tertiary, #202225);
		border-radius: 6px;
	}

	.card-value {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.card-label {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		text-align: center;
	}

	.trend-up {
		color: var(--status-red, #ed4245);
	}

	.trend-down {
		color: var(--status-green, #3ba55c);
	}

	.trend-stable {
		color: var(--text-muted, #72767d);
	}

	.daily-chart {
		margin-bottom: 16px;
	}

	.chart-bars {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		height: 80px;
		padding: 8px 0;
		gap: 4px;
	}

	.bar-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}

	.bar {
		width: 100%;
		max-width: 24px;
		background: var(--brand-primary, #5865f2);
		border-radius: 3px 3px 0 0;
		transition: height 0.3s ease;
		margin-top: auto;
	}

	.bar-container.today .bar {
		background: var(--status-green, #3ba55c);
	}

	.bar-label {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		margin-top: 4px;
	}

	.tracker-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 12px;
		border-top: 1px solid var(--bg-tertiary, #202225);
	}

	.reset-btn {
		background: transparent;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		color: var(--text-muted, #72767d);
		padding: 6px 12px;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.reset-btn:hover {
		background: var(--bg-modifier-hover, #32353b);
		color: var(--text-normal, #dcddde);
	}
</style>
