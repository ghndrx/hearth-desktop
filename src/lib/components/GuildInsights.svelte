<script lang="ts">
	import { onMount } from 'svelte';
	import { analyticsStore, isAnalyticsLoading, analyticsError } from '$lib/stores/analytics';
	import MemberGrowthChart from './analytics/MemberGrowthChart.svelte';
	import ActivityHeatmap from './analytics/ActivityHeatmap.svelte';
	import TopChannelsList from './analytics/TopChannelsList.svelte';
	import RetentionMetrics from './analytics/RetentionMetrics.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import type {
		ServerInsightsResponse,
		MemberGrowthResponse,
		ActivityHeatmapResponse,
		TopChannelsResponse,
		RetentionResponse
	} from '$lib/types';

	export let serverId: string;
	export let onChannelClick: ((channelId: string) => void) | undefined = undefined;

	let selectedPeriod: 7 | 14 | 30 | 90 = 7;
	let summary: ServerInsightsResponse | null = null;
	let growth: MemberGrowthResponse | null = null;
	let activity: ActivityHeatmapResponse | null = null;
	let channels: TopChannelsResponse | null = null;
	let retention: RetentionResponse | null = null;

	async function loadData() {
		analyticsStore.setServerId(serverId);
		
		// Load all data in parallel
		const [summaryData, growthData, activityData, channelsData, retentionData] = await Promise.all([
			analyticsStore.fetchSummary(serverId),
			analyticsStore.fetchGrowth(serverId, selectedPeriod),
			analyticsStore.fetchActivity(serverId, selectedPeriod),
			analyticsStore.fetchTopChannels(serverId, selectedPeriod, 10),
			analyticsStore.fetchRetention(serverId, 30)
		]);

		summary = summaryData;
		growth = growthData;
		activity = activityData;
		channels = channelsData;
		retention = retentionData;
	}

	async function handlePeriodChange(period: 7 | 14 | 30 | 90) {
		selectedPeriod = period;
		analyticsStore.invalidateCache();
		await loadData();
	}

	function handleRefresh() {
		analyticsStore.invalidateCache();
		loadData();
	}

	onMount(() => {
		loadData();
	});

	// Format percentage change with color class
	function formatChange(value: number): { text: string; class: string } {
		const formatted = value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
		return {
			text: formatted,
			class: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
		};
	}
</script>

<div class="insights-container">
	<div class="insights-header">
		<div class="header-left">
			<h2>Server Insights</h2>
			<p class="subtitle">Analytics and engagement metrics</p>
		</div>
		<div class="header-right">
			<div class="period-selector">
				<button 
					class="period-btn" 
					class:active={selectedPeriod === 7}
					on:click={() => handlePeriodChange(7)}
				>7 days</button>
				<button 
					class="period-btn" 
					class:active={selectedPeriod === 14}
					on:click={() => handlePeriodChange(14)}
				>14 days</button>
				<button 
					class="period-btn" 
					class:active={selectedPeriod === 30}
					on:click={() => handlePeriodChange(30)}
				>30 days</button>
				<button 
					class="period-btn" 
					class:active={selectedPeriod === 90}
					on:click={() => handlePeriodChange(90)}
				>90 days</button>
			</div>
			<button class="refresh-btn" on:click={handleRefresh} disabled={$isAnalyticsLoading}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M23 4v6h-6M1 20v-6h6"/>
					<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
				</svg>
				Refresh
			</button>
		</div>
	</div>

	{#if $analyticsError}
		<div class="error-banner">
			<span class="error-icon">⚠️</span>
			<span>{$analyticsError}</span>
			<button class="retry-btn" on:click={handleRefresh}>Retry</button>
		</div>
	{/if}

	{#if $isAnalyticsLoading && !summary}
		<div class="loading-state">
			<LoadingSpinner />
			<p>Loading analytics...</p>
		</div>
	{:else}
		<!-- Summary Cards -->
		{#if summary?.summary}
			<div class="summary-grid">
				<div class="summary-card">
					<div class="card-icon">📊</div>
					<div class="card-content">
						<div class="card-value">{summary.summary.messages_week.toLocaleString()}</div>
						<div class="card-label">Messages this week</div>
						{#if summary.summary.message_change_percent !== 0}
							{@const change = formatChange(summary.summary.message_change_percent)}
							<div class="card-change {change.class}">{change.text} vs last week</div>
						{/if}
					</div>
				</div>

				<div class="summary-card">
					<div class="card-icon">👥</div>
					<div class="card-content">
						<div class="card-value">{summary.summary.active_users_week.toLocaleString()}</div>
						<div class="card-label">Active users this week</div>
					</div>
				</div>

				<div class="summary-card">
					<div class="card-icon">📈</div>
					<div class="card-content">
						<div class="card-value">{summary.summary.total_members.toLocaleString()}</div>
						<div class="card-label">Total members</div>
						{#if summary.summary.new_members_week > 0}
							<div class="card-change positive">+{summary.summary.new_members_week} new this week</div>
						{/if}
					</div>
				</div>

				<div class="summary-card">
					<div class="card-icon">⚡</div>
					<div class="card-content">
						<div class="card-value">{summary.summary.messages_today.toLocaleString()}</div>
						<div class="card-label">Messages today</div>
						<div class="card-subtext">{summary.summary.active_users_today} active</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Charts Grid -->
		<div class="charts-grid">
			<div class="chart-full">
				{#if growth?.data}
					<MemberGrowthChart data={growth.data} height={220} />
				{:else}
					<div class="chart-placeholder">
						<LoadingSpinner size="small" />
					</div>
				{/if}
			</div>

			<div class="chart-half">
				{#if activity?.data}
					<ActivityHeatmap 
						data={activity.data} 
						peakHours={activity.peak_hours || []} 
					/>
				{:else}
					<div class="chart-placeholder">
						<LoadingSpinner size="small" />
					</div>
				{/if}
			</div>

			<div class="chart-half">
				{#if channels?.data}
					<TopChannelsList 
						data={channels.data} 
						{onChannelClick}
					/>
				{:else}
					<div class="chart-placeholder">
						<LoadingSpinner size="small" />
					</div>
				{/if}
			</div>

			<div class="chart-full">
				{#if retention?.data}
					<RetentionMetrics data={retention.data} />
				{:else}
					<div class="chart-placeholder">
						<LoadingSpinner size="small" />
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.insights-container {
		padding: 24px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.insights-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
		flex-wrap: wrap;
		gap: 16px;
	}

	.header-left h2 {
		margin: 0 0 4px 0;
		font-size: 24px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
	}

	.subtitle {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
	}

	.header-right {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.period-selector {
		display: flex;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 6px;
		padding: 2px;
	}

	.period-btn {
		padding: 6px 12px;
		border: none;
		background: transparent;
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.period-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.period-btn.active {
		background: var(--bg-accent, #5865f2);
		color: white;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: none;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-normal, #f2f3f5);
		font-size: 13px;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--bg-modifier-hover, #35373c);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid rgba(237, 66, 69, 0.3);
		border-radius: 8px;
		margin-bottom: 24px;
		color: #ed4245;
	}

	.retry-btn {
		margin-left: auto;
		padding: 4px 12px;
		border: none;
		background: rgba(237, 66, 69, 0.2);
		color: #ed4245;
		font-size: 12px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 0;
		color: var(--text-muted, #b5bac1);
	}

	.loading-state p {
		margin-top: 12px;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 24px;
	}

	.summary-card {
		display: flex;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.card-icon {
		font-size: 24px;
		flex-shrink: 0;
	}

	.card-content {
		flex: 1;
	}

	.card-value {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
		line-height: 1.2;
	}

	.card-label {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		margin-top: 4px;
	}

	.card-change {
		font-size: 11px;
		font-weight: 500;
		margin-top: 6px;
	}

	.card-change.positive { color: #3ba55c; }
	.card-change.negative { color: #ed4245; }
	.card-change.neutral { color: var(--text-muted, #b5bac1); }

	.card-subtext {
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		margin-top: 4px;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.chart-full {
		grid-column: 1 / -1;
	}

	.chart-half {
		min-height: 280px;
	}

	.chart-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 200px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	@media (max-width: 768px) {
		.insights-container {
			padding: 16px;
		}

		.insights-header {
			flex-direction: column;
		}

		.header-right {
			width: 100%;
			flex-direction: column;
			align-items: stretch;
		}

		.period-selector {
			justify-content: center;
		}

		.charts-grid {
			grid-template-columns: 1fr;
		}

		.chart-half {
			grid-column: 1 / -1;
		}
	}
</style>
