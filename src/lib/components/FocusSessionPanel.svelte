<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen } from '@tauri-apps/api/event';
	import {
		focusSessionState,
		focusSessionSettings,
		focusSessionStats,
		focusTimeDisplay,
		focusProgress,
		dailyGoalProgress,
		startFocusSession,
		pauseFocusSession,
		stopFocusSession,
		skipFocusPhase,
		loadFocusState,
		loadFocusSettings,
		loadFocusStats,
		updateFocusSettings,
		type FocusSessionSettings
	} from '$lib/stores/focusSessions';

	let showSettings = false;
	let sessionLabel = '';
	let editSettings: FocusSessionSettings | null = null;
	let unlisten: (() => void) | null = null;

	const phaseLabels: Record<string, string> = {
		work: 'Focus Time',
		shortBreak: 'Short Break',
		longBreak: 'Long Break',
		idle: 'Ready'
	};

	const phaseColors: Record<string, string> = {
		work: 'text-red-400',
		shortBreak: 'text-green-400',
		longBreak: 'text-blue-400',
		idle: 'text-gray-400'
	};

	onMount(async () => {
		await Promise.all([loadFocusState(), loadFocusSettings(), loadFocusStats()]);
		unlisten = (await listen('focus-session-phase-complete', () => {
			loadFocusStats();
		})) as unknown as () => void;
	});

	onDestroy(() => {
		unlisten?.();
	});

	async function handleStart() {
		await startFocusSession(sessionLabel || undefined);
		sessionLabel = '';
	}

	async function handleSaveSettings() {
		if (editSettings) {
			await updateFocusSettings(editSettings);
			showSettings = false;
			editSettings = null;
		}
	}

	function openSettings() {
		editSettings = { ...$focusSessionSettings };
		showSettings = true;
	}
</script>

<div class="flex flex-col gap-4 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Focus Sessions</h3>
		<button
			class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={openSettings}
		>
			Settings
		</button>
	</div>

	<!-- Timer Display -->
	<div class="flex flex-col items-center gap-2">
		<div class="relative flex h-32 w-32 items-center justify-center">
			<!-- Progress ring -->
			<svg class="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
				<circle
					cx="64"
					cy="64"
					r="56"
					fill="none"
					stroke="var(--bg-tertiary)"
					stroke-width="6"
				/>
				<circle
					cx="64"
					cy="64"
					r="56"
					fill="none"
					stroke={$focusSessionState.phase === 'work'
						? '#ef4444'
						: $focusSessionState.phase === 'idle'
							? '#6b7280'
							: '#22c55e'}
					stroke-width="6"
					stroke-linecap="round"
					stroke-dasharray={`${($focusProgress / 100) * 351.86} 351.86`}
				/>
			</svg>
			<div class="text-center">
				<div class="text-2xl font-bold text-[var(--text-primary)]">
					{$focusTimeDisplay}
				</div>
				<div class="text-xs {phaseColors[$focusSessionState.phase]}">
					{phaseLabels[$focusSessionState.phase]}
				</div>
			</div>
		</div>

		{#if $focusSessionState.isRunning}
			<div class="text-xs text-[var(--text-muted)]">
				Session #{$focusSessionState.currentSessionNumber}
				{#if $focusSessionState.currentLabel}
					&middot; {$focusSessionState.currentLabel}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="flex items-center justify-center gap-2">
		{#if !$focusSessionState.isRunning}
			<input
				type="text"
				class="w-32 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]"
				placeholder="Session label..."
				bind:value={sessionLabel}
				onkeydown={(e) => e.key === 'Enter' && handleStart()}
			/>
			<button
				class="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
				onclick={handleStart}
			>
				Start
			</button>
		{:else}
			<button
				class="rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
				onclick={pauseFocusSession}
			>
				{$focusSessionState.isPaused ? 'Resume' : 'Pause'}
			</button>
			<button
				class="rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
				onclick={skipFocusPhase}
			>
				Skip
			</button>
			<button
				class="rounded bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
				onclick={stopFocusSession}
			>
				Stop
			</button>
		{/if}
	</div>

	<!-- Daily Goal -->
	{#if $focusSessionStats}
		<div class="space-y-1">
			<div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
				<span>Daily Goal</span>
				<span>{$focusSessionState.totalFocusMinutesToday}m / {$focusSessionSettings.dailyGoalMinutes}m</span>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
				<div
					class="h-full rounded-full bg-green-500 transition-all"
					style="width: {$dailyGoalProgress}%"
				></div>
			</div>
		</div>

		<!-- Stats row -->
		<div class="grid grid-cols-3 gap-2 text-center">
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{$focusSessionStats.todaySessions}
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Sessions</div>
			</div>
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{Math.round($focusSessionStats.completionRate * 100)}%
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Completed</div>
			</div>
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{$focusSessionState.streakDays}
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Streak</div>
			</div>
		</div>
	{/if}

	<!-- Settings Panel -->
	{#if showSettings && editSettings}
		<div class="space-y-3 border-t border-[var(--bg-tertiary)] pt-3">
			<div class="grid grid-cols-2 gap-2">
				<label class="text-xs text-[var(--text-muted)]">
					Work (min)
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.workDuration}
						min="1"
						max="120"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Short Break
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.shortBreakDuration}
						min="1"
						max="30"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Long Break
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.longBreakDuration}
						min="1"
						max="60"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Daily Goal
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.dailyGoalMinutes}
						min="0"
						max="480"
					/>
				</label>
			</div>
			<div class="space-y-2">
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.autoDnd} />
					Auto-enable DND during focus
				</label>
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.breakNotifications} />
					Break reminders
				</label>
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.soundEnabled} />
					Sound on phase change
				</label>
			</div>
			<div class="flex gap-2">
				<button
					class="rounded bg-[var(--brand-500)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-560)]"
					onclick={handleSaveSettings}
				>
					Save
				</button>
				<button
					class="rounded bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-muted)]"
					onclick={() => {
						showSettings = false;
						editSettings = null;
					}}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
