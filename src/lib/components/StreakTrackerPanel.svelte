<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade } from 'svelte/transition';

	interface StreakDay {
		date: string;
		active_minutes: number;
		messages_sent: number;
	}

	interface StreakStats {
		current_streak: number;
		longest_streak: number;
		total_active_days: number;
		today_active_minutes: number;
		today_messages: number;
		is_active_today: boolean;
		history: StreakDay[];
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let stats = $state<StreakStats | null>(null);
	let error = $state<string | null>(null);
	let checkedIn = $state(false);

	onMount(() => {
		loadStats();
	});

	async function loadStats() {
		try {
			stats = await invoke<StreakStats>('streak_get_stats');
			checkedIn = stats.is_active_today;
		} catch (e) {
			error = `Failed to load streak data: ${e}`;
		}
	}

	async function checkIn() {
		try {
			stats = await invoke<StreakStats>('streak_check_in');
			checkedIn = true;
		} catch (e) {
			error = `Check-in failed: ${e}`;
		}
	}

	async function recordActivity() {
		try {
			stats = await invoke<StreakStats>('streak_record_activity', {
				minutes: 5,
				messages: 1,
			});
		} catch {}
	}

	async function resetStreak() {
		try {
			await invoke('streak_reset');
			await loadStats();
		} catch {}
	}

	function handleClose() {
		open = false;
		onClose?.();
	}

	function getWeekGrid(): { date: string; active: boolean; intensity: number }[][] {
		if (!stats) return [];
		const today = new Date();
		const weeks: { date: string; active: boolean; intensity: number }[][] = [];
		const dayMap = new Map(stats.history.map((d) => [d.date, d]));

		// Build 12 weeks of data
		for (let w = 11; w >= 0; w--) {
			const week: { date: string; active: boolean; intensity: number }[] = [];
			for (let d = 6; d >= 0; d--) {
				const date = new Date(today);
				date.setDate(today.getDate() - (w * 7 + d));
				const dateStr = date.toISOString().split('T')[0];
				const entry = dayMap.get(dateStr);
				const minutes = entry?.active_minutes ?? 0;
				const intensity = minutes === 0 ? 0 : minutes < 15 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4;
				week.push({ date: dateStr, active: !!entry, intensity });
			}
			weeks.push(week);
		}
		return weeks;
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

{#if open}
	<div class="streak-overlay" transition:fade={{ duration: 150 }}>
		<div class="streak-panel">
			<div class="panel-header">
				<h2>Activity Streak</h2>
				<button class="close-btn" onclick={handleClose}>x</button>
			</div>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			{#if stats}
				<div class="streak-hero">
					<div class="streak-number">{stats.current_streak}</div>
					<div class="streak-label">day streak</div>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<span class="stat-val">{stats.longest_streak}</span>
						<span class="stat-lbl">Best Streak</span>
					</div>
					<div class="stat-card">
						<span class="stat-val">{stats.total_active_days}</span>
						<span class="stat-lbl">Active Days</span>
					</div>
					<div class="stat-card">
						<span class="stat-val">{stats.today_active_minutes}m</span>
						<span class="stat-lbl">Today</span>
					</div>
					<div class="stat-card">
						<span class="stat-val">{stats.today_messages}</span>
						<span class="stat-lbl">Messages</span>
					</div>
				</div>

				<div class="check-in-section">
					{#if checkedIn}
						<div class="checked-in">Checked in today!</div>
					{:else}
						<button class="check-in-btn" onclick={checkIn}>Check In Today</button>
					{/if}
				</div>

				<div class="heatmap-section">
					<h3>Activity (Last 12 Weeks)</h3>
					<div class="heatmap">
						{#each getWeekGrid() as week}
							<div class="heatmap-col">
								{#each week as day}
									<div
										class="heatmap-cell level-{day.intensity}"
										title="{formatDate(day.date)}: {day.active ? 'Active' : 'Inactive'}"
									></div>
								{/each}
							</div>
						{/each}
					</div>
					<div class="heatmap-legend">
						<span class="legend-label">Less</span>
						<div class="heatmap-cell level-0"></div>
						<div class="heatmap-cell level-1"></div>
						<div class="heatmap-cell level-2"></div>
						<div class="heatmap-cell level-3"></div>
						<div class="heatmap-cell level-4"></div>
						<span class="legend-label">More</span>
					</div>
				</div>

				<div class="actions">
					<button class="action-btn secondary" onclick={recordActivity}>+ Log Activity</button>
					<button class="action-btn danger" onclick={resetStreak}>Reset</button>
				</div>
			{:else if !error}
				<div class="loading">Loading streak data...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.streak-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.streak-panel {
		background: var(--bg-primary, #1e1e2e);
		border: 1px solid var(--border-color, #313244);
		border-radius: 12px;
		width: 520px;
		max-height: 85vh;
		overflow-y: auto;
		padding: 24px;
		color: var(--text-primary, #cdd6f4);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.panel-header h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary, #a6adc8);
		font-size: 18px;
		cursor: pointer;
		padding: 2px 8px;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: var(--bg-tertiary, #45475a);
	}

	.error {
		background: rgba(243, 139, 168, 0.15);
		color: var(--red, #f38ba8);
		padding: 10px 14px;
		border-radius: 8px;
		margin-bottom: 16px;
		font-size: 13px;
	}

	.streak-hero {
		text-align: center;
		padding: 24px 0;
	}

	.streak-number {
		font-size: 64px;
		font-weight: 800;
		color: var(--accent, #89b4fa);
		line-height: 1;
	}

	.streak-label {
		font-size: 16px;
		color: var(--text-secondary, #a6adc8);
		margin-top: 4px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 20px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 8px;
		background: var(--bg-secondary, #181825);
		border-radius: 8px;
	}

	.stat-val {
		font-size: 20px;
		font-weight: 700;
		color: var(--accent, #89b4fa);
	}

	.stat-lbl {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-top: 2px;
	}

	.check-in-section {
		text-align: center;
		margin-bottom: 20px;
	}

	.check-in-btn {
		background: var(--green, #a6e3a1);
		color: var(--bg-primary, #1e1e2e);
		border: none;
		padding: 10px 28px;
		border-radius: 8px;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
	}

	.check-in-btn:hover {
		opacity: 0.9;
	}

	.checked-in {
		color: var(--green, #a6e3a1);
		font-weight: 600;
		font-size: 14px;
	}

	.heatmap-section {
		margin-bottom: 20px;
	}

	.heatmap-section h3 {
		font-size: 13px;
		font-weight: 600;
		margin: 0 0 10px;
		color: var(--text-secondary, #a6adc8);
	}

	.heatmap {
		display: flex;
		gap: 3px;
		justify-content: center;
	}

	.heatmap-col {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.heatmap-cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		transition: opacity 0.15s;
	}

	.heatmap-cell.level-0 {
		background: var(--bg-tertiary, #313244);
	}

	.heatmap-cell.level-1 {
		background: rgba(166, 227, 161, 0.3);
	}

	.heatmap-cell.level-2 {
		background: rgba(166, 227, 161, 0.5);
	}

	.heatmap-cell.level-3 {
		background: rgba(166, 227, 161, 0.7);
	}

	.heatmap-cell.level-4 {
		background: var(--green, #a6e3a1);
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		gap: 3px;
		justify-content: flex-end;
		margin-top: 6px;
	}

	.heatmap-legend .heatmap-cell {
		width: 10px;
		height: 10px;
	}

	.legend-label {
		font-size: 10px;
		color: var(--text-secondary, #a6adc8);
		padding: 0 4px;
	}

	.actions {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.action-btn {
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		font-size: 13px;
	}

	.action-btn.secondary {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.action-btn.danger {
		background: rgba(243, 139, 168, 0.15);
		color: var(--red, #f38ba8);
	}

	.action-btn:hover {
		opacity: 0.85;
	}

	.loading {
		text-align: center;
		color: var(--text-secondary, #a6adc8);
		padding: 40px 0;
	}
</style>
