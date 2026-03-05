<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	interface DailyStats {
		date: string;
		messages_sent: number;
		messages_received: number;
		reactions_sent: number;
		voice_minutes: number;
		active_minutes: number;
		servers_visited: number;
		channels_visited: number;
	}

	interface UsageSummary {
		total_messages_sent: number;
		total_messages_received: number;
		total_reactions: number;
		total_voice_minutes: number;
		total_active_hours: number;
		member_since: string | null;
		current_streak_days: number;
		longest_streak_days: number;
		hourly_activity: { hour: number; count: number }[];
		favorite_time: string;
	}

	let today: DailyStats | null = null;
	let weekData: DailyStats[] = [];
	let summary: UsageSummary | null = null;
	let activeView: 'today' | 'week' | 'all-time' = 'today';

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			[today, weekData, summary] = await Promise.all([
				invoke<DailyStats>('analytics_get_today'),
				invoke<DailyStats[]>('analytics_get_range', { days: 7 }),
				invoke<UsageSummary>('analytics_get_summary')
			]);
		} catch (e) {
			console.error('Failed to load analytics:', e);
		}
	}

	function formatMinutes(mins: number): string {
		if (mins < 60) return `${Math.round(mins)}m`;
		const h = Math.floor(mins / 60);
		const m = Math.round(mins % 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	function getBarHeight(value: number, max: number): number {
		if (max === 0) return 0;
		return Math.max(4, (value / max) * 100);
	}

	function getDayLabel(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en', { weekday: 'short' });
	}

	$: weekMax = Math.max(1, ...weekData.map((d) => d.messages_sent + d.messages_received));
	$: hourlyMax = Math.max(1, ...(summary?.hourly_activity.map((h) => h.count) ?? [1]));
</script>

<div class="usage-analytics">
	<h3 class="text-lg font-semibold text-white mb-4">Usage Analytics</h3>
	<p class="text-xs text-gray-500 mb-4">All data stays on your device</p>

	<div class="tabs">
		<button class="tab" class:active={activeView === 'today'} on:click={() => (activeView = 'today')}>Today</button>
		<button class="tab" class:active={activeView === 'week'} on:click={() => (activeView = 'week')}>This Week</button>
		<button class="tab" class:active={activeView === 'all-time'} on:click={() => (activeView = 'all-time')}>All Time</button>
	</div>

	{#if activeView === 'today' && today}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-value">{today.messages_sent}</div>
				<div class="stat-label">Messages Sent</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{today.messages_received}</div>
				<div class="stat-label">Received</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{today.reactions_sent}</div>
				<div class="stat-label">Reactions</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatMinutes(today.voice_minutes)}</div>
				<div class="stat-label">Voice Time</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatMinutes(today.active_minutes)}</div>
				<div class="stat-label">Active Time</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{today.channels_visited}</div>
				<div class="stat-label">Channels</div>
			</div>
		</div>
	{/if}

	{#if activeView === 'week'}
		<div class="chart-container">
			<div class="bar-chart">
				{#each weekData as day}
					<div class="bar-group">
						<div class="bar-wrapper">
							<div
								class="bar sent"
								style="height: {getBarHeight(day.messages_sent, weekMax)}%"
								title="{day.messages_sent} sent"
							></div>
							<div
								class="bar received"
								style="height: {getBarHeight(day.messages_received, weekMax)}%"
								title="{day.messages_received} received"
							></div>
						</div>
						<div class="bar-label">{getDayLabel(day.date)}</div>
					</div>
				{/each}
			</div>
			<div class="chart-legend">
				<span class="legend-item"><span class="legend-dot sent"></span> Sent</span>
				<span class="legend-item"><span class="legend-dot received"></span> Received</span>
			</div>
		</div>
	{/if}

	{#if activeView === 'all-time' && summary}
		<div class="stats-grid">
			<div class="stat-card wide">
				<div class="stat-value">{summary.total_messages_sent.toLocaleString()}</div>
				<div class="stat-label">Total Messages Sent</div>
			</div>
			<div class="stat-card wide">
				<div class="stat-value">{summary.total_messages_received.toLocaleString()}</div>
				<div class="stat-label">Total Received</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.total_reactions.toLocaleString()}</div>
				<div class="stat-label">Reactions</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{formatMinutes(summary.total_voice_minutes)}</div>
				<div class="stat-label">Voice Time</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.total_active_hours.toFixed(1)}h</div>
				<div class="stat-label">Active Hours</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.favorite_time}</div>
				<div class="stat-label">Peak Activity</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.current_streak_days}</div>
				<div class="stat-label">Current Streak</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{summary.longest_streak_days}</div>
				<div class="stat-label">Best Streak</div>
			</div>
		</div>

		<h4 class="text-sm font-medium text-gray-400 mt-4 mb-2">Hourly Activity</h4>
		<div class="hourly-chart">
			{#each summary.hourly_activity as hour}
				<div class="hour-bar-group" title="{hour.hour}:00 - {hour.count} events">
					<div class="hour-bar" style="height: {getBarHeight(hour.count, hourlyMax)}%"></div>
					{#if hour.hour % 6 === 0}
						<div class="hour-label">{hour.hour}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.usage-analytics {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		padding: 0.25rem;
	}
	.tab {
		flex: 1;
		padding: 0.5rem;
		border: none;
		background: transparent;
		color: #b5bac1;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.tab.active {
		background: #5865f2;
		color: white;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	.stat-card {
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.stat-card.wide {
		grid-column: span 1;
	}
	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #dbdee1;
	}
	.stat-label {
		font-size: 0.7rem;
		color: #80848e;
		margin-top: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.chart-container {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.bar-chart {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		height: 140px;
		padding-bottom: 1.5rem;
	}
	.bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
	}
	.bar-wrapper {
		flex: 1;
		display: flex;
		gap: 2px;
		align-items: flex-end;
		width: 100%;
	}
	.bar {
		flex: 1;
		border-radius: 2px 2px 0 0;
		min-height: 4px;
		transition: height 0.3s ease;
	}
	.bar.sent {
		background: #5865f2;
	}
	.bar.received {
		background: #57f287;
	}
	.bar-label {
		font-size: 0.625rem;
		color: #80848e;
		margin-top: 0.375rem;
	}
	.chart-legend {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 0.5rem;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: #80848e;
	}
	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}
	.legend-dot.sent {
		background: #5865f2;
	}
	.legend-dot.received {
		background: #57f287;
	}
	.hourly-chart {
		display: flex;
		align-items: flex-end;
		gap: 1px;
		height: 60px;
		padding-bottom: 1rem;
	}
	.hour-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		position: relative;
	}
	.hour-bar {
		width: 100%;
		background: #5865f2;
		border-radius: 1px 1px 0 0;
		min-height: 2px;
		margin-top: auto;
	}
	.hour-label {
		font-size: 0.5rem;
		color: #80848e;
		position: absolute;
		bottom: -14px;
	}
</style>
