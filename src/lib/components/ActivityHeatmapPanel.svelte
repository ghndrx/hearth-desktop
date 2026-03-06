<script lang="ts">
	import { onMount } from 'svelte';
	import {
		heatmapData,
		todayActivity,
		loadHeatmapYear,
		getStreak,
		getToday,
		type HeatmapData,
		type StreakInfo,
		type DayCell
	} from '$lib/stores/activityHeatmap';

	let isOpen = false;
	let selectedYear = new Date().getFullYear();
	let streak: StreakInfo = { current_streak: 0, longest_streak: 0, last_active_date: null };
	let tooltipText = '';
	let tooltipX = 0;
	let tooltipY = 0;
	let showTooltip = false;

	const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const visibleDayLabels = [1, 3, 5]; // Mon, Wed, Fri

	onMount(async () => {
		await Promise.all([loadHeatmapYear(selectedYear), refreshStreak(), getToday()]);
	});

	async function refreshStreak() {
		streak = await getStreak();
	}

	async function changeYear(delta: number) {
		selectedYear += delta;
		await loadHeatmapYear(selectedYear);
	}

	function getCellColor(level: string): string {
		switch (level) {
			case 'low':
				return '#14532d';
			case 'medium':
				return '#166534';
			case 'high':
				return '#16a34a';
			case 'extreme':
				return '#4ade80';
			default:
				return '#1e293b';
		}
	}

	function handleCellHover(event: MouseEvent, cell: DayCell) {
		if (!cell.date) return;
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		tooltipX = rect.left + rect.width / 2;
		tooltipY = rect.top - 8;
		const countText = cell.count === 1 ? '1 activity' : `${cell.count} activities`;
		tooltipText = `${countText} on ${cell.date}`;
		showTooltip = true;
	}

	function handleCellLeave() {
		showTooltip = false;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	export function toggle() {
		isOpen = !isOpen;
	}

	export function open() {
		isOpen = true;
	}

	export function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={() => (isOpen = false)}></div>
	<aside class="panel">
		<header class="panel-header">
			<div class="header-left">
				<svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
				<h2>Activity Heatmap</h2>
			</div>
			<button class="close-btn" on:click={() => (isOpen = false)} title="Close">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<div class="content">
			<!-- Stats row -->
			<div class="stats-row">
				<div class="stat-card">
					<span class="stat-value">{$todayActivity?.count ?? 0}</span>
					<span class="stat-label">Today</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{streak.current_streak}</span>
					<span class="stat-label">Current streak</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{streak.longest_streak}</span>
					<span class="stat-label">Longest streak</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{$heatmapData?.total_count ?? 0}</span>
					<span class="stat-label">Total ({selectedYear})</span>
				</div>
			</div>

			<!-- Year selector -->
			<div class="year-selector">
				<button class="year-btn" on:click={() => changeYear(-1)} title="Previous year">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15,18 9,12 15,6" />
					</svg>
				</button>
				<span class="year-label">{selectedYear}</span>
				<button
					class="year-btn"
					on:click={() => changeYear(1)}
					disabled={selectedYear >= new Date().getFullYear()}
					title="Next year"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9,6 15,12 9,18" />
					</svg>
				</button>
			</div>

			<!-- Heatmap grid -->
			{#if $heatmapData}
				<div class="heatmap-container">
					<!-- Month labels -->
					<div class="month-labels">
						<div class="day-label-spacer"></div>
						{#each $heatmapData.months as month}
							<span
								class="month-label"
								style="grid-column: {month.week_index + 2}"
							>
								{month.name}
							</span>
						{/each}
					</div>

					<div class="heatmap-grid-wrapper">
						<!-- Day labels -->
						<div class="day-labels">
							{#each { length: 7 } as _, i}
								<span class="day-label">
									{#if visibleDayLabels.includes(i)}
										{dayLabels[i]}
									{/if}
								</span>
							{/each}
						</div>

						<!-- Grid -->
						<div
							class="heatmap-grid"
							style="grid-template-columns: repeat({$heatmapData.weeks.length}, 1fr);"
						>
							{#each $heatmapData.weeks as week, weekIdx}
								{#each week as cell, dayIdx}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div
										class="cell"
										class:empty={!cell.date}
										style="background-color: {cell.date
											? getCellColor(cell.level)
											: 'transparent'}; grid-column: {weekIdx + 1}; grid-row: {dayIdx +
											1};"
										on:mouseenter={(e) => handleCellHover(e, cell)}
										on:mouseleave={handleCellLeave}
									></div>
								{/each}
							{/each}
						</div>
					</div>
				</div>

				<!-- Legend -->
				<div class="legend">
					<span class="legend-label">Less</span>
					<div class="legend-cell" style="background-color: {getCellColor('none')}" title="No activity"></div>
					<div class="legend-cell" style="background-color: {getCellColor('low')}" title="1-5 activities"></div>
					<div
						class="legend-cell"
						style="background-color: {getCellColor('medium')}"
						title="6-15 activities"
					></div>
					<div
						class="legend-cell"
						style="background-color: {getCellColor('high')}"
						title="16-30 activities"
					></div>
					<div
						class="legend-cell"
						style="background-color: {getCellColor('extreme')}"
						title="31+ activities"
					></div>
					<span class="legend-label">More</span>
				</div>

				<!-- Summary -->
				<div class="summary">
					<p>
						{$heatmapData.active_days} active days in {selectedYear}
						{#if $heatmapData.max_daily > 0}
							&middot; Peak: {$heatmapData.max_daily} in a day
						{/if}
					</p>
					{#if streak.last_active_date}
						<p class="last-active">
							Last active: {formatDate(streak.last_active_date)}
						</p>
					{/if}
				</div>
			{:else}
				<div class="loading">Loading heatmap data...</div>
			{/if}
		</div>
	</aside>

	<!-- Tooltip -->
	{#if showTooltip}
		<div class="tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
			{tooltipText}
		</div>
	{/if}
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 999;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 520px;
		max-width: 100vw;
		height: 100vh;
		background: var(--bg-primary, #1e1e2e);
		border-left: 1px solid var(--border-color, #313244);
		display: flex;
		flex-direction: column;
		z-index: 1000;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		width: 22px;
		height: 22px;
		color: var(--accent-color, #a6e3a1);
	}

	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.close-btn {
		background: transparent;
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
	}

	.close-btn:hover {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.close-btn svg {
		width: 18px;
		height: 18px;
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 16px;
	}

	.stat-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-value {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-primary, #cdd6f4);
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		text-align: center;
	}

	.year-selector {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-bottom: 16px;
	}

	.year-btn {
		background: var(--bg-secondary, #313244);
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		display: flex;
		align-items: center;
		transition: all 0.15s;
	}

	.year-btn:hover:not(:disabled) {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.year-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.year-btn svg {
		width: 16px;
		height: 16px;
	}

	.year-label {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
		min-width: 50px;
		text-align: center;
	}

	.heatmap-container {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 16px;
		margin-bottom: 12px;
		overflow-x: auto;
	}

	.month-labels {
		display: grid;
		grid-template-columns: 32px repeat(53, 1fr);
		margin-bottom: 4px;
		font-size: 10px;
		color: var(--text-secondary, #a6adc8);
	}

	.day-label-spacer {
		grid-column: 1;
	}

	.month-label {
		white-space: nowrap;
	}

	.heatmap-grid-wrapper {
		display: flex;
		gap: 4px;
	}

	.day-labels {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 3px;
		width: 28px;
		flex-shrink: 0;
	}

	.day-label {
		font-size: 10px;
		color: var(--text-secondary, #a6adc8);
		display: flex;
		align-items: center;
		height: 13px;
	}

	.heatmap-grid {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		grid-auto-flow: column;
		gap: 3px;
		flex: 1;
	}

	.cell {
		width: 13px;
		height: 13px;
		border-radius: 2px;
		cursor: pointer;
		transition: outline 0.1s;
	}

	.cell:hover:not(.empty) {
		outline: 2px solid var(--text-secondary, #a6adc8);
		outline-offset: -1px;
	}

	.cell.empty {
		cursor: default;
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		margin-bottom: 16px;
	}

	.legend-label {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		margin: 0 2px;
	}

	.legend-cell {
		width: 13px;
		height: 13px;
		border-radius: 2px;
	}

	.summary {
		text-align: center;
	}

	.summary p {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--text-secondary, #a6adc8);
	}

	.summary .last-active {
		font-size: 12px;
		opacity: 0.7;
	}

	.loading {
		text-align: center;
		padding: 48px 16px;
		color: var(--text-secondary, #a6adc8);
		font-size: 14px;
	}

	.tooltip {
		position: fixed;
		transform: translate(-50%, -100%);
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 1100;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}
</style>
