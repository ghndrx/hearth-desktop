<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		pomodoro,
		pomodoroFormattedTime,
		pomodoroProgress,
		pomodoroSessionLabel,
		pomodoroSessionColor,
		type PomodoroSessionType,
		type PomodoroSettings
	} from '$lib/stores/pomodoro';

	let showSettings = false;
	let editSettings: PomodoroSettings | null = null;

	const sessionTypes: { value: PomodoroSessionType; label: string }[] = [
		{ value: 'work', label: 'Focus' },
		{ value: 'short-break', label: 'Short Break' },
		{ value: 'long-break', label: 'Long Break' }
	];

	onMount(() => {
		pomodoro.init();
	});

	onDestroy(() => {
		pomodoro.cleanup();
	});

	function toggleTimer() {
		if ($pomodoro.is_running) {
			pomodoro.pause();
		} else {
			pomodoro.start();
		}
	}

	function openSettings() {
		let s: PomodoroSettings | null = null;
		pomodoro.settings.subscribe((v) => (s = { ...v }))();
		editSettings = s;
		showSettings = true;
	}

	async function handleSaveSettings() {
		if (editSettings) {
			await pomodoro.updateSettings(editSettings);
			showSettings = false;
			editSettings = null;
		}
	}

	function getPomodoroIndicators(completed: number, total: number): boolean[] {
		return Array.from({ length: total }, (_, i) => i < completed);
	}
</script>

<div class="flex flex-col gap-4 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Pomodoro Timer</h3>
		<button
			class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={openSettings}
		>
			Settings
		</button>
	</div>

	<!-- Session Type Tabs -->
	<div class="flex gap-1 rounded-md bg-[var(--bg-tertiary)] p-0.5">
		{#each sessionTypes as st}
			<button
				class="flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors {$pomodoro.session_type === st.value
					? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
					: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
				onclick={() => pomodoro.setSessionType(st.value)}
			>
				{st.label}
			</button>
		{/each}
	</div>

	<!-- Timer Display -->
	<div class="flex flex-col items-center gap-2">
		<div class="relative flex h-36 w-36 items-center justify-center">
			<!-- Progress ring -->
			<svg class="absolute inset-0 -rotate-90" viewBox="0 0 144 144">
				<circle
					cx="72"
					cy="72"
					r="62"
					fill="none"
					stroke="var(--bg-tertiary)"
					stroke-width="6"
				/>
				<circle
					cx="72"
					cy="72"
					r="62"
					fill="none"
					stroke={$pomodoroSessionColor}
					stroke-width="6"
					stroke-linecap="round"
					stroke-dasharray="{($pomodoroProgress / 100) * 389.56} 389.56"
					class="transition-all duration-1000"
				/>
			</svg>
			<div class="text-center">
				<div class="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
					{$pomodoroFormattedTime}
				</div>
				<div class="text-xs font-medium" style="color: {$pomodoroSessionColor}">
					{$pomodoroSessionLabel}
				</div>
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="flex items-center justify-center gap-2">
		<button
			class="rounded px-4 py-1.5 text-xs font-medium transition-colors {$pomodoro.is_running
				? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]'
				: 'text-white'}"
			style={!$pomodoro.is_running ? `background-color: ${$pomodoroSessionColor}` : ''}
			onclick={toggleTimer}
		>
			{$pomodoro.is_running ? 'Pause' : 'Start'}
		</button>
		<button
			class="rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
			onclick={() => pomodoro.reset()}
		>
			Reset
		</button>
		<button
			class="rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
			onclick={() => pomodoro.skip()}
		>
			Skip
		</button>
	</div>

	<!-- Pomodoro Indicators -->
	{#if $pomodoro.session_type === 'work' || $pomodoro.completed_pomodoros > 0}
		{@const indicators = getPomodoroIndicators($pomodoro.completed_pomodoros, 4)}
		<div class="flex items-center justify-center gap-1.5">
			{#each indicators as filled}
				<div
					class="h-2.5 w-2.5 rounded-full transition-colors {filled
						? 'bg-red-400'
						: 'bg-[var(--bg-tertiary)]'}"
				></div>
			{/each}
			<span class="ml-2 text-[10px] text-[var(--text-muted)]">
				{$pomodoro.completed_pomodoros}/4 until long break
			</span>
		</div>
	{/if}

	<!-- Stats row -->
	<div class="grid grid-cols-3 gap-2 text-center">
		<div>
			<div class="text-sm font-semibold text-[var(--text-primary)]">
				{$pomodoro.total_completed_today}
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Today</div>
		</div>
		<div>
			<div class="text-sm font-semibold text-[var(--text-primary)]">
				{$pomodoro.total_completed_today * 25}m
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Focus Time</div>
		</div>
		<div>
			<div class="text-sm font-semibold text-[var(--text-primary)]">
				{$pomodoro.streak}
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Streak</div>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings && editSettings}
		<div class="space-y-3 border-t border-[var(--bg-tertiary)] pt-3">
			<div class="grid grid-cols-2 gap-2">
				<label class="text-xs text-[var(--text-muted)]">
					Work (min)
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.work_duration}
						min="1"
						max="120"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Short Break
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.short_break_duration}
						min="1"
						max="30"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Long Break
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.long_break_duration}
						min="1"
						max="60"
					/>
				</label>
				<label class="text-xs text-[var(--text-muted)]">
					Long Break After
					<input
						type="number"
						class="mt-1 w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)]"
						bind:value={editSettings.pomodoros_before_long_break}
						min="2"
						max="8"
					/>
				</label>
			</div>
			<div class="space-y-2">
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.auto_start_breaks} />
					Auto-start breaks
				</label>
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.auto_start_work} />
					Auto-start work sessions
				</label>
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.sound_enabled} />
					Sound notifications
				</label>
				<label class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<input type="checkbox" bind:checked={editSettings.notifications_enabled} />
					Desktop notifications
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
