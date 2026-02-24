<script lang="ts">
	import type { ActivityHourStat, PeakHour } from '$lib/types';

	export let data: ActivityHourStat[] = [];
	export let peakHours: PeakHour[] = [];

	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hours = Array.from({ length: 24 }, (_, i) => i);

	// Build a lookup map for quick access
	$: activityMap = new Map(
		data.map(d => [`${d.day_of_week}-${d.hour}`, d])
	);

	// Find max value for color scaling
	$: maxMessages = Math.max(...data.map(d => d.message_count), 1);

	// Get activity level for a cell (0-4)
	function getActivityLevel(dayOfWeek: number, hour: number): number {
		const key = `${dayOfWeek}-${hour}`;
		const stat = activityMap.get(key);
		if (!stat || stat.message_count === 0) return 0;
		
		const ratio = stat.message_count / maxMessages;
		if (ratio > 0.75) return 4;
		if (ratio > 0.5) return 3;
		if (ratio > 0.25) return 2;
		return 1;
	}

	// Get tooltip text for a cell
	function getTooltip(dayOfWeek: number, hour: number): string {
		const key = `${dayOfWeek}-${hour}`;
		const stat = activityMap.get(key);
		if (!stat || stat.message_count === 0) {
			return `${days[dayOfWeek]} ${formatHour(hour)}: No activity`;
		}
		return `${days[dayOfWeek]} ${formatHour(hour)}: ${stat.message_count} messages, ${stat.unique_users} users`;
	}

	// Format hour for display (12h format)
	function formatHour(hour: number): string {
		if (hour === 0) return '12am';
		if (hour === 12) return '12pm';
		if (hour < 12) return `${hour}am`;
		return `${hour - 12}pm`;
	}

	// Get formatted peak hours
	$: formattedPeakHours = peakHours.slice(0, 3).map(p => ({
		time: formatHour(p.hour),
		count: p.message_count
	}));

	// Calculate total messages
	$: totalMessages = data.reduce((sum, d) => sum + d.message_count, 0);
</script>

<div class="heatmap-container">
	<div class="heatmap-header">
		<h3>Activity Heatmap</h3>
		<div class="stats">
			<span class="total">{totalMessages.toLocaleString()} messages</span>
		</div>
	</div>

	<div class="heatmap">
		<!-- Time labels row -->
		<div class="time-labels">
			<div class="day-label"></div>
			{#each hours as hour}
				{#if hour % 3 === 0}
					<div class="time-label">{formatHour(hour)}</div>
				{:else}
					<div class="time-label"></div>
				{/if}
			{/each}
		</div>

		<!-- Heatmap rows -->
		{#each days as day, dayIndex}
			<div class="heatmap-row">
				<div class="day-label">{day}</div>
				{#each hours as hour}
					<div 
						class="heatmap-cell level-{getActivityLevel(dayIndex, hour)}"
						title={getTooltip(dayIndex, hour)}
					></div>
				{/each}
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="legend">
		<span class="legend-label">Less</span>
		<div class="legend-cells">
			<div class="legend-cell level-0"></div>
			<div class="legend-cell level-1"></div>
			<div class="legend-cell level-2"></div>
			<div class="legend-cell level-3"></div>
			<div class="legend-cell level-4"></div>
		</div>
		<span class="legend-label">More</span>
	</div>

	<!-- Peak hours -->
	{#if formattedPeakHours.length > 0}
		<div class="peak-hours">
			<span class="peak-label">Peak hours:</span>
			{#each formattedPeakHours as peak, i}
				<span class="peak-time">
					{peak.time}
					<span class="peak-count">({peak.count})</span>
					{#if i < formattedPeakHours.length - 1}, {/if}
				</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.heatmap-container {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.heatmap-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.total {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.heatmap {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-x: auto;
	}

	.time-labels {
		display: flex;
		gap: 2px;
	}

	.time-label {
		width: 14px;
		font-size: 9px;
		color: var(--text-muted, #b5bac1);
		text-align: center;
	}

	.heatmap-row {
		display: flex;
		gap: 2px;
		align-items: center;
	}

	.day-label {
		width: 32px;
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	.heatmap-cell {
		width: 14px;
		height: 14px;
		border-radius: 2px;
		cursor: pointer;
		transition: transform 0.1s ease;
	}

	.heatmap-cell:hover {
		transform: scale(1.2);
	}

	.level-0 { background: rgba(255, 255, 255, 0.05); }
	.level-1 { background: rgba(88, 101, 242, 0.25); }
	.level-2 { background: rgba(88, 101, 242, 0.5); }
	.level-3 { background: rgba(88, 101, 242, 0.75); }
	.level-4 { background: rgba(88, 101, 242, 1); }

	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
		justify-content: flex-end;
	}

	.legend-label {
		font-size: 10px;
		color: var(--text-muted, #b5bac1);
	}

	.legend-cells {
		display: flex;
		gap: 2px;
	}

	.legend-cell {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.peak-hours {
		margin-top: 12px;
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.peak-label {
		margin-right: 6px;
	}

	.peak-time {
		color: var(--text-normal, #f2f3f5);
	}

	.peak-count {
		color: var(--text-muted, #b5bac1);
		font-size: 11px;
	}

	@media (max-width: 600px) {
		.heatmap-cell {
			width: 10px;
			height: 10px;
		}

		.time-label {
			width: 10px;
			font-size: 8px;
		}
	}
</style>
