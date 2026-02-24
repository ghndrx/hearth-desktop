<script lang="ts">
	import { onMount } from 'svelte';
	import type { RetentionMetrics, DailyActiveUserPoint } from '$lib/types';

	export let data: RetentionMetrics | null = null;
	export let height = 150;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;

	// Format percentage
	function formatPercent(value: number): string {
		return `${(value * 100).toFixed(1)}%`;
	}

	// Draw DAU chart
	function drawChart() {
		if (!canvas || !ctx || !data || data.daily_active_users.length === 0) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const width = rect.width;
		const chartHeight = rect.height;
		const padding = { top: 16, right: 16, bottom: 24, left: 40 };
		const chartWidth = width - padding.left - padding.right;
		const plotHeight = chartHeight - padding.top - padding.bottom;

		// Clear canvas
		ctx.clearRect(0, 0, width, chartHeight);

		const points = data.daily_active_users;
		const counts = points.map(d => d.count);
		const maxCount = Math.max(...counts, 1);
		const minCount = 0;
		const yRange = maxCount - minCount || 1;

		// Draw grid
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		for (let i = 0; i <= 3; i++) {
			const y = padding.top + (plotHeight * i) / 3;
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(width - padding.right, y);
			ctx.stroke();

			const value = maxCount - (yRange * i) / 3;
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
			ctx.font = '10px system-ui';
			ctx.textAlign = 'right';
			ctx.fillText(Math.round(value).toString(), padding.left - 6, y + 3);
		}

		// Draw bars
		const barWidth = Math.min(20, (chartWidth / points.length) * 0.7);
		const gap = (chartWidth - barWidth * points.length) / (points.length + 1);

		points.forEach((point, i) => {
			const x = padding.left + gap + i * (barWidth + gap);
			const barHeight = (point.count / maxCount) * plotHeight;
			const y = padding.top + plotHeight - barHeight;

			// Bar
			ctx!.fillStyle = '#5865f2';
			ctx!.beginPath();
			ctx!.roundRect(x, y, barWidth, barHeight, 2);
			ctx!.fill();
		});
	}

	onMount(() => {
		ctx = canvas.getContext('2d');
		drawChart();

		const resizeObserver = new ResizeObserver(() => {
			drawChart();
		});
		resizeObserver.observe(canvas);

		return () => {
			resizeObserver.disconnect();
		};
	});

	$: if (ctx && data) {
		drawChart();
	}
</script>

<div class="retention-container">
	<div class="retention-header">
		<h3>Engagement & Retention</h3>
	</div>

	{#if data}
		<div class="metrics-grid">
			<div class="metric-card">
				<div class="metric-value">{Math.round(data.average_dau).toLocaleString()}</div>
				<div class="metric-label">Avg Daily Active</div>
			</div>
			<div class="metric-card">
				<div class="metric-value">{data.mau.toLocaleString()}</div>
				<div class="metric-label">Monthly Active</div>
			</div>
			<div class="metric-card highlight">
				<div class="metric-value">{formatPercent(data.stickiness)}</div>
				<div class="metric-label">Stickiness (DAU/MAU)</div>
			</div>
			<div class="metric-card">
				<div class="metric-value">{data.total_members.toLocaleString()}</div>
				<div class="metric-label">Total Members</div>
			</div>
		</div>

		<div class="chart-section">
			<div class="chart-title">Daily Active Users</div>
			<canvas bind:this={canvas} style="height: {height}px; width: 100%"></canvas>
		</div>

		{#if data.total_members > 0}
			<div class="engagement-bar">
				<div class="engagement-label">Member Engagement</div>
				<div class="engagement-track">
					<div 
						class="engagement-fill"
						style="width: {Math.min(100, (data.mau / data.total_members) * 100)}%"
					></div>
				</div>
				<div class="engagement-value">
					{((data.mau / data.total_members) * 100).toFixed(1)}% active
				</div>
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<p>No retention data available</p>
		</div>
	{/if}
</div>

<style>
	.retention-container {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.retention-header {
		margin-bottom: 16px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.metric-card {
		background: var(--bg-tertiary, #232428);
		border-radius: 8px;
		padding: 12px;
		text-align: center;
	}

	.metric-card.highlight {
		background: linear-gradient(135deg, rgba(88, 101, 242, 0.2), rgba(88, 101, 242, 0.1));
		border: 1px solid rgba(88, 101, 242, 0.3);
	}

	.metric-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
		margin-bottom: 4px;
	}

	.metric-label {
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.chart-section {
		margin-bottom: 16px;
	}

	.chart-title {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
		margin-bottom: 8px;
	}

	canvas {
		display: block;
	}

	.engagement-bar {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.engagement-label {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.engagement-track {
		flex: 1;
		height: 8px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
	}

	.engagement-fill {
		height: 100%;
		background: linear-gradient(90deg, #5865f2, #7289da);
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	.engagement-value {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.empty-state {
		text-align: center;
		padding: 32px 16px;
		color: var(--text-muted, #b5bac1);
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}
</style>
