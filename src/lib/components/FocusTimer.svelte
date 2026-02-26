<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale, fly } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	const dispatch = createEventDispatcher<{
		'session-start': { type: 'focus' | 'break'; duration: number };
		'session-end': { type: 'focus' | 'break'; completed: boolean };
		'stats-updated': { totalFocusTime: number; sessionsCompleted: number };
	}>();

	// Timer settings
	export let focusDuration = 25; // minutes
	export let shortBreakDuration = 5; // minutes
	export let longBreakDuration = 15; // minutes
	export let sessionsBeforeLongBreak = 4;
	export let autoStartBreaks = true;
	export let autoStartFocus = false;
	export let enableNotifications = true;
	export let enableDndDuringFocus = true;
	export let showInTray = true;
	export let compact = false;

	type TimerState = 'idle' | 'focus' | 'short-break' | 'long-break' | 'paused';

	let state: TimerState = 'idle';
	let previousState: TimerState = 'idle';
	let timeRemaining = focusDuration * 60; // seconds
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let sessionsCompleted = 0;
	let totalFocusTime = 0; // seconds
	let dailyStats = {
		date: new Date().toDateString(),
		focusSessions: 0,
		totalFocusMinutes: 0,
		totalBreakMinutes: 0
	};

	// UI state
	let showSettings = false;
	let showStats = false;
	let isMinimized = false;

	// Temp settings for editing
	let tempFocusDuration = focusDuration;
	let tempShortBreak = shortBreakDuration;
	let tempLongBreak = longBreakDuration;
	let tempSessionsBeforeLong = sessionsBeforeLongBreak;

	$: progress = getProgress();
	$: formattedTime = formatTime(timeRemaining);
	$: stateLabel = getStateLabel(state);
	$: stateColor = getStateColor(state);
	$: isRunning = state === 'focus' || state === 'short-break' || state === 'long-break';

	function getProgress(): number {
		let total: number;
		switch (state) {
			case 'focus':
				total = focusDuration * 60;
				break;
			case 'short-break':
				total = shortBreakDuration * 60;
				break;
			case 'long-break':
				total = longBreakDuration * 60;
				break;
			default:
				return 0;
		}
		return ((total - timeRemaining) / total) * 100;
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function getStateLabel(s: TimerState): string {
		switch (s) {
			case 'idle':
				return 'Ready to Focus';
			case 'focus':
				return 'Focus Time';
			case 'short-break':
				return 'Short Break';
			case 'long-break':
				return 'Long Break';
			case 'paused':
				return 'Paused';
			default:
				return '';
		}
	}

	function getStateColor(s: TimerState): string {
		switch (s) {
			case 'focus':
				return '#ef4444'; // red
			case 'short-break':
				return '#22c55e'; // green
			case 'long-break':
				return '#3b82f6'; // blue
			case 'paused':
				return '#f59e0b'; // amber
			default:
				return '#6b7280'; // gray
		}
	}

	async function startFocus() {
		state = 'focus';
		timeRemaining = focusDuration * 60;
		startTimer();
		
		if (enableDndDuringFocus) {
			await setDndMode(true);
		}
		
		if (showInTray) {
			await updateTrayTitle(`🎯 ${formattedTime}`);
		}

		dispatch('session-start', { type: 'focus', duration: focusDuration });
	}

	function startShortBreak() {
		state = 'short-break';
		timeRemaining = shortBreakDuration * 60;
		startTimer();
		dispatch('session-start', { type: 'break', duration: shortBreakDuration });
	}

	function startLongBreak() {
		state = 'long-break';
		timeRemaining = longBreakDuration * 60;
		startTimer();
		dispatch('session-start', { type: 'break', duration: longBreakDuration });
	}

	function startTimer() {
		if (intervalId) {
			clearInterval(intervalId);
		}

		intervalId = setInterval(async () => {
			if (timeRemaining > 0) {
				timeRemaining--;
				
				if (showInTray && timeRemaining % 10 === 0) {
					const emoji = state === 'focus' ? '🎯' : '☕';
					await updateTrayTitle(`${emoji} ${formattedTime}`);
				}
			} else {
				await handleTimerComplete();
			}
		}, 1000);
	}

	async function handleTimerComplete() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}

		const completedState = state;

		if (state === 'focus') {
			sessionsCompleted++;
			totalFocusTime += focusDuration * 60;
			dailyStats.focusSessions++;
			dailyStats.totalFocusMinutes += focusDuration;
			
			if (enableDndDuringFocus) {
				await setDndMode(false);
			}

			await sendNotification(
				'Focus session complete! 🎉',
				`You've completed ${sessionsCompleted} session${sessionsCompleted > 1 ? 's' : ''} today.`
			);

			dispatch('session-end', { type: 'focus', completed: true });
			dispatch('stats-updated', { totalFocusTime, sessionsCompleted });

			// Auto-start break
			if (autoStartBreaks) {
				if (sessionsCompleted % sessionsBeforeLongBreak === 0) {
					startLongBreak();
				} else {
					startShortBreak();
				}
			} else {
				state = 'idle';
				timeRemaining = focusDuration * 60;
			}
		} else if (state === 'short-break' || state === 'long-break') {
			dailyStats.totalBreakMinutes += state === 'short-break' ? shortBreakDuration : longBreakDuration;

			await sendNotification(
				'Break time is over! 💪',
				'Ready for another focus session?'
			);

			dispatch('session-end', { type: 'break', completed: true });

			if (autoStartFocus) {
				startFocus();
			} else {
				state = 'idle';
				timeRemaining = focusDuration * 60;
			}
		}

		if (showInTray) {
			await updateTrayTitle('Hearth');
		}

		await saveStats();
	}

	function pauseTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		previousState = state;
		state = 'paused';
	}

	function resumeTimer() {
		state = previousState;
		startTimer();
	}

	async function resetTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}

		if (state === 'focus' && enableDndDuringFocus) {
			await setDndMode(false);
		}

		const wasRunning = isRunning || state === 'paused';
		if (wasRunning) {
			dispatch('session-end', { 
				type: previousState === 'focus' || state === 'focus' ? 'focus' : 'break', 
				completed: false 
			});
		}

		state = 'idle';
		previousState = 'idle';
		timeRemaining = focusDuration * 60;

		if (showInTray) {
			await updateTrayTitle('Hearth');
		}
	}

	function skipToNext() {
		if (state === 'focus') {
			if (sessionsCompleted > 0 && sessionsCompleted % sessionsBeforeLongBreak === 0) {
				startLongBreak();
			} else {
				startShortBreak();
			}
		} else if (state === 'short-break' || state === 'long-break') {
			startFocus();
		}
	}

	async function sendNotification(title: string, body: string) {
		if (!enableNotifications) return;
		
		try {
			await invoke('show_notification', { title, body });
		} catch (e) {
			console.warn('Failed to send notification:', e);
		}
	}

	async function setDndMode(enabled: boolean) {
		try {
			await invoke('set_focus_mode', { enabled });
		} catch (e) {
			console.warn('Failed to set DND mode:', e);
		}
	}

	async function updateTrayTitle(title: string) {
		try {
			await invoke('set_tray_title', { title });
		} catch (e) {
			// Tray title might not be supported
		}
	}

	async function saveStats() {
		try {
			await invoke('store_set', { 
				key: 'focus_timer_stats', 
				value: JSON.stringify({
					sessionsCompleted,
					totalFocusTime,
					dailyStats
				})
			});
		} catch (e) {
			console.warn('Failed to save stats:', e);
		}
	}

	async function loadStats() {
		try {
			const data = await invoke<string | null>('store_get', { key: 'focus_timer_stats' });
			if (data) {
				const stats = JSON.parse(data);
				// Reset daily stats if it's a new day
				if (stats.dailyStats?.date !== new Date().toDateString()) {
					stats.dailyStats = {
						date: new Date().toDateString(),
						focusSessions: 0,
						totalFocusMinutes: 0,
						totalBreakMinutes: 0
					};
				}
				sessionsCompleted = stats.sessionsCompleted || 0;
				totalFocusTime = stats.totalFocusTime || 0;
				dailyStats = stats.dailyStats || dailyStats;
			}
		} catch (e) {
			console.warn('Failed to load stats:', e);
		}
	}

	function applySettings() {
		focusDuration = tempFocusDuration;
		shortBreakDuration = tempShortBreak;
		longBreakDuration = tempLongBreak;
		sessionsBeforeLongBreak = tempSessionsBeforeLong;
		
		if (state === 'idle') {
			timeRemaining = focusDuration * 60;
		}
		
		showSettings = false;
	}

	function formatMinutes(minutes: number): string {
		if (minutes < 60) {
			return `${minutes}m`;
		}
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	onMount(() => {
		loadStats();
		timeRemaining = focusDuration * 60;
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

<div 
	class="focus-timer"
	class:compact
	class:minimized={isMinimized}
	style="--state-color: {stateColor}"
	transition:fade={{ duration: 200 }}
>
	{#if !isMinimized}
		<div class="timer-header">
			<div class="header-left">
				<span class="timer-icon">⏱️</span>
				<h3>Focus Timer</h3>
			</div>
			<div class="header-actions">
				<button 
					class="icon-btn" 
					title="Statistics"
					on:click={() => showStats = !showStats}
				>
					📊
				</button>
				<button 
					class="icon-btn" 
					title="Settings"
					on:click={() => showSettings = !showSettings}
				>
					⚙️
				</button>
				<button 
					class="icon-btn" 
					title="Minimize"
					on:click={() => isMinimized = true}
				>
					➖
				</button>
			</div>
		</div>

		<div class="timer-display">
			<div class="progress-ring" style="--progress: {progress}">
				<svg viewBox="0 0 100 100">
					<circle class="bg" cx="50" cy="50" r="45" />
					<circle class="fg" cx="50" cy="50" r="45" />
				</svg>
				<div class="time-content">
					<span class="time">{formattedTime}</span>
					<span class="state-label">{stateLabel}</span>
				</div>
			</div>
		</div>

		<div class="session-indicators">
			{#each Array(sessionsBeforeLongBreak) as _, i}
				<div 
					class="session-dot"
					class:completed={i < (sessionsCompleted % sessionsBeforeLongBreak) || 
						(sessionsCompleted > 0 && sessionsCompleted % sessionsBeforeLongBreak === 0 && i < sessionsBeforeLongBreak)}
					class:current={i === (sessionsCompleted % sessionsBeforeLongBreak) && state === 'focus'}
				/>
			{/each}
		</div>

		<div class="timer-controls">
			{#if state === 'idle'}
				<button class="primary-btn" on:click={startFocus}>
					▶️ Start Focus
				</button>
			{:else if state === 'paused'}
				<button class="primary-btn" on:click={resumeTimer}>
					▶️ Resume
				</button>
				<button class="secondary-btn" on:click={resetTimer}>
					🔄 Reset
				</button>
			{:else}
				<button class="secondary-btn" on:click={pauseTimer}>
					⏸️ Pause
				</button>
				<button class="secondary-btn" on:click={skipToNext}>
					⏭️ Skip
				</button>
				<button class="secondary-btn danger" on:click={resetTimer}>
					⏹️ Stop
				</button>
			{/if}
		</div>

		{#if !compact}
			<div class="quick-stats">
				<div class="stat">
					<span class="stat-value">{sessionsCompleted}</span>
					<span class="stat-label">Sessions</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatMinutes(Math.floor(totalFocusTime / 60))}</span>
					<span class="stat-label">Total Focus</span>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Minimized view -->
		<button 
			class="minimized-timer" 
			on:click={() => isMinimized = false}
			style="background: {stateColor}"
		>
			<span class="mini-time">{formattedTime}</span>
			{#if isRunning}
				<span class="mini-state">{state === 'focus' ? '🎯' : '☕'}</span>
			{/if}
		</button>
	{/if}

	<!-- Settings Modal -->
	{#if showSettings}
		<div class="modal-overlay" on:click={() => showSettings = false} transition:fade={{ duration: 150 }}>
			<div class="modal" on:click|stopPropagation transition:scale={{ duration: 200 }}>
				<h4>Timer Settings</h4>
				
				<div class="setting-group">
					<label>
						<span>Focus Duration (minutes)</span>
						<input type="number" bind:value={tempFocusDuration} min="1" max="120" />
					</label>
					<label>
						<span>Short Break (minutes)</span>
						<input type="number" bind:value={tempShortBreak} min="1" max="30" />
					</label>
					<label>
						<span>Long Break (minutes)</span>
						<input type="number" bind:value={tempLongBreak} min="1" max="60" />
					</label>
					<label>
						<span>Sessions before long break</span>
						<input type="number" bind:value={tempSessionsBeforeLong} min="2" max="10" />
					</label>
				</div>

				<div class="setting-toggles">
					<label class="toggle-label">
						<input type="checkbox" bind:checked={autoStartBreaks} />
						<span>Auto-start breaks</span>
					</label>
					<label class="toggle-label">
						<input type="checkbox" bind:checked={autoStartFocus} />
						<span>Auto-start focus after break</span>
					</label>
					<label class="toggle-label">
						<input type="checkbox" bind:checked={enableNotifications} />
						<span>Enable notifications</span>
					</label>
					<label class="toggle-label">
						<input type="checkbox" bind:checked={enableDndDuringFocus} />
						<span>Enable DND during focus</span>
					</label>
					<label class="toggle-label">
						<input type="checkbox" bind:checked={showInTray} />
						<span>Show timer in tray</span>
					</label>
				</div>

				<div class="modal-actions">
					<button class="secondary-btn" on:click={() => showSettings = false}>Cancel</button>
					<button class="primary-btn" on:click={applySettings}>Save</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Stats Modal -->
	{#if showStats}
		<div class="modal-overlay" on:click={() => showStats = false} transition:fade={{ duration: 150 }}>
			<div class="modal" on:click|stopPropagation transition:scale={{ duration: 200 }}>
				<h4>Focus Statistics</h4>
				
				<div class="stats-grid">
					<div class="stat-card">
						<span class="stat-icon">🎯</span>
						<span class="stat-big">{dailyStats.focusSessions}</span>
						<span class="stat-desc">Sessions Today</span>
					</div>
					<div class="stat-card">
						<span class="stat-icon">⏱️</span>
						<span class="stat-big">{formatMinutes(dailyStats.totalFocusMinutes)}</span>
						<span class="stat-desc">Focus Time Today</span>
					</div>
					<div class="stat-card">
						<span class="stat-icon">☕</span>
						<span class="stat-big">{formatMinutes(dailyStats.totalBreakMinutes)}</span>
						<span class="stat-desc">Break Time Today</span>
					</div>
					<div class="stat-card">
						<span class="stat-icon">🏆</span>
						<span class="stat-big">{sessionsCompleted}</span>
						<span class="stat-desc">Total Sessions</span>
					</div>
				</div>

				<div class="modal-actions">
					<button class="primary-btn" on:click={() => showStats = false}>Close</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.focus-timer {
		--state-color: #6b7280;
		background: var(--bg-secondary, #1e1e1e);
		border-radius: 12px;
		padding: 16px;
		min-width: 280px;
		border: 1px solid var(--border-color, #333);
	}

	.focus-timer.compact {
		min-width: 200px;
		padding: 12px;
	}

	.focus-timer.minimized {
		min-width: auto;
		padding: 0;
		background: transparent;
		border: none;
	}

	.timer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.timer-icon {
		font-size: 1.2rem;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: transparent;
		border: none;
		padding: 6px;
		cursor: pointer;
		border-radius: 6px;
		font-size: 1rem;
		transition: background 0.2s;
	}

	.icon-btn:hover {
		background: var(--bg-tertiary, #2a2a2a);
	}

	.timer-display {
		display: flex;
		justify-content: center;
		margin-bottom: 16px;
	}

	.progress-ring {
		position: relative;
		width: 160px;
		height: 160px;
	}

	.compact .progress-ring {
		width: 120px;
		height: 120px;
	}

	.progress-ring svg {
		transform: rotate(-90deg);
		width: 100%;
		height: 100%;
	}

	.progress-ring circle {
		fill: none;
		stroke-width: 6;
		stroke-linecap: round;
	}

	.progress-ring .bg {
		stroke: var(--bg-tertiary, #2a2a2a);
	}

	.progress-ring .fg {
		stroke: var(--state-color);
		stroke-dasharray: 283;
		stroke-dashoffset: calc(283 - (283 * var(--progress)) / 100);
		transition: stroke-dashoffset 0.5s ease;
	}

	.time-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.time {
		font-size: 2.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary, #fff);
	}

	.compact .time {
		font-size: 1.8rem;
	}

	.state-label {
		font-size: 0.75rem;
		color: var(--state-color);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.session-indicators {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.session-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--bg-tertiary, #2a2a2a);
		transition: all 0.3s ease;
	}

	.session-dot.completed {
		background: #22c55e;
	}

	.session-dot.current {
		background: var(--state-color);
		box-shadow: 0 0 8px var(--state-color);
	}

	.timer-controls {
		display: flex;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.primary-btn,
	.secondary-btn {
		padding: 10px 20px;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.primary-btn {
		background: var(--state-color);
		color: white;
	}

	.primary-btn:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.secondary-btn {
		background: var(--bg-tertiary, #2a2a2a);
		color: var(--text-primary, #fff);
	}

	.secondary-btn:hover {
		background: var(--bg-hover, #333);
	}

	.secondary-btn.danger:hover {
		background: #ef4444;
	}

	.quick-stats {
		display: flex;
		justify-content: center;
		gap: 32px;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border-color, #333);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary, #fff);
	}

	.stat-label {
		font-size: 0.7rem;
		color: var(--text-secondary, #888);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.minimized-timer {
		padding: 8px 16px;
		border: none;
		border-radius: 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.minimized-timer:hover {
		transform: scale(1.05);
	}

	.mini-time {
		font-size: 0.9rem;
		font-weight: 600;
		color: white;
		font-variant-numeric: tabular-nums;
	}

	.mini-state {
		font-size: 0.9rem;
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--bg-secondary, #1e1e1e);
		border-radius: 12px;
		padding: 24px;
		min-width: 320px;
		max-width: 90vw;
		border: 1px solid var(--border-color, #333);
	}

	.modal h4 {
		margin: 0 0 20px;
		font-size: 1.1rem;
		color: var(--text-primary, #fff);
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 16px;
	}

	.setting-group label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--text-primary, #fff);
		font-size: 0.9rem;
	}

	.setting-group input[type="number"] {
		width: 70px;
		padding: 8px;
		border: 1px solid var(--border-color, #333);
		border-radius: 6px;
		background: var(--bg-tertiary, #2a2a2a);
		color: var(--text-primary, #fff);
		text-align: center;
	}

	.setting-toggles {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 20px;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		color: var(--text-primary, #fff);
		font-size: 0.9rem;
	}

	.toggle-label input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--state-color);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	/* Stats modal */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		margin-bottom: 20px;
	}

	.stat-card {
		background: var(--bg-tertiary, #2a2a2a);
		border-radius: 8px;
		padding: 16px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-icon {
		font-size: 1.5rem;
	}

	.stat-big {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary, #fff);
	}

	.stat-desc {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
	}

	/* Dark mode adjustments */
	@media (prefers-color-scheme: light) {
		.focus-timer {
			--bg-secondary: #f5f5f5;
			--bg-tertiary: #e5e5e5;
			--border-color: #d4d4d4;
			--text-primary: #171717;
			--text-secondary: #525252;
		}
	}
</style>
