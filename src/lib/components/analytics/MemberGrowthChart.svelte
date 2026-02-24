<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { MemberGrowthPoint } from '$lib/types';

	export let data: MemberGrowthPoint[] = [];
	export let height = 200;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;

	// Format date for display
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Calculate chart dimensions and draw
	function drawChart() {
		if (!canvas || !ctx || data.length === 0) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);

		const width = rect.width;
		const chartHeight = rect.height;
		const padding = { top: 20, right: 20, bottom: 30, left: 50 };
		const chartWidth = width - padding.left - padding.right;
		const plotHeight = chartHeight - padding.top - padding.bottom;

		// Clear canvas
		ctx.clearRect(0, 0, width, chartHeight);

		// Find min/max values
		const counts = data.map(d => d.count);
		const maxCount = Math.max(...counts);
		const minCount = Math.min(...counts);
		const range = maxCount - minCount || 1;

		// Add 10% padding to range
		const yMin = Math.max(0, minCount - range * 0.1);
		const yMax = maxCount + range * 0.1;
		const yRange = yMax - yMin;

		// Draw grid lines
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		for (let i = 0; i <= 4; i++) {
			const y = padding.top + (plotHeight * i) / 4;
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(width - padding.right, y);
			ctx.stroke();

			// Y-axis labels
			const value = yMax - (yRange * i) / 4;
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
			ctx.font = '11px system-ui';
			ctx.textAlign = 'right';
			ctx.fillText(Math.round(value).toLocaleString(), padding.left - 8, y + 4);
		}

		// Draw line chart
		const xStep = chartWidth / (data.length - 1 || 1);
		
		// Draw area fill
		ctx.beginPath();
		ctx.moveTo(padding.left, padding.top + plotHeight);
		data.forEach((point, i) => {
			const x = padding.left + i * xStep;
			const y = padding.top + ((yMax - point.count) / yRange) * plotHeight;
			if (i === 0) {
				ctx!.lineTo(x, y);
			} else {
				ctx!.lineTo(x, y);
			}
		});
		ctx.lineTo(padding.left + (data.length - 1) * xStep, padding.top + plotHeight);
		ctx.closePath();
		
		const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
		gradient.addColorStop(0, 'rgba(88, 101, 242, 0.3)');
		gradient.addColorStop(1, 'rgba(88, 101, 242, 0)');
		ctx.fillStyle = gradient;
		ctx.fill();

		// Draw line
		ctx.beginPath();
		ctx.strokeStyle = '#5865f2';
		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		data.forEach((point, i) => {
			const x = padding.left + i * xStep;
			const y = padding.top + ((yMax - point.count) / yRange) * plotHeight;
			if (i === 0) {
				ctx!.moveTo(x, y);
			} else {
				ctx!.lineTo(x, y);
			}
		});
		ctx.stroke();

		// Draw data points
		ctx.fillStyle = '#5865f2';
		data.forEach((point, i) => {
			const x = padding.left + i * xStep;
			const y = padding.top + ((yMax - point.count) / yRange) * plotHeight;
			ctx!.beginPath();
			ctx!.arc(x, y, 4, 0, Math.PI * 2);
			ctx!.fill();
		});

		// Draw X-axis labels (every few points)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.font = '11px system-ui';
		ctx.textAlign = 'center';
		const labelStep = Math.max(1, Math.floor(data.length / 7));
		data.forEach((point, i) => {
			if (i % labelStep === 0 || i === data.length - 1) {
				const x = padding.left + i * xStep;
				ctx!.fillText(formatDate(point.date), x, chartHeight - 8);
			}
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

	// Calculate summary stats
	$: totalChange = data.length > 0 ? data[data.length - 1].count - data[0].count : 0;
	$: percentChange = data.length > 0 && data[0].count > 0 
		? ((totalChange / data[0].count) * 100).toFixed(1)
		: '0';
	$: currentCount = data.length > 0 ? data[data.length - 1].count : 0;
</script>

<div class="chart-container">
	<div class="chart-header">
		<h3>Member Growth</h3>
		<div class="stats">
			<span class="current">{currentCount.toLocaleString()} members</span>
			<span class="change" class:positive={totalChange > 0} class:negative={totalChange < 0}>
				{totalChange >= 0 ? '+' : ''}{totalChange.toLocaleString()} ({percentChange}%)
			</span>
		</div>
	</div>
	<canvas bind:this={canvas} style="height: {height}px; width: 100%"></canvas>
</div>

<style>
	.chart-container {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.stats {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.current {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.change {
		font-size: 12px;
		font-weight: 500;
		padding: 2px 8px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.05);
	}

	.change.positive {
		color: #3ba55c;
		background: rgba(59, 165, 92, 0.1);
	}

	.change.negative {
		color: #ed4245;
		background: rgba(237, 66, 69, 0.1);
	}

	canvas {
		display: block;
	}
</style>
