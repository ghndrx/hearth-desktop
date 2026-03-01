<!--
  SystemResourcesChart - Real-time line charts for CPU and memory usage.

  Displays rolling sparkline graphs that update live as system resources change.
  Uses canvas for efficient rendering and stores history for trend visualization.
-->
<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { systemHealth } from '$lib/stores/systemHealth';

	export let height = 120;
	export let maxDataPoints = 60;
	export let refreshInterval = 1;
	export let showCpu = true;
	export let showMemory = true;
	export let showLegend = true;
	export let cpuColor = '#5865f2';
	export let memoryColor = '#57f287';
	export let gridColor = 'rgba(255, 255, 255, 0.1)';
	export let fillOpacity = 0.15;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let unlisten: UnlistenFn | null = null;
	let animationFrame: number | null = null;

	interface DataPoint {
		cpu: number;
		memory: number;
		timestamp: number;
	}

	let history: DataPoint[] = [];
	let currentCpu = 0;
	let currentMemory = 0;
	let peakCpu = 0;
	let peakMemory = 0;

	function addDataPoint(cpu: number, memory: number) {
		const now = Date.now();
		history = [...history, { cpu, memory, timestamp: now }].slice(-maxDataPoints);
		currentCpu = cpu;
		currentMemory = memory;
		peakCpu = Math.max(peakCpu, cpu);
		peakMemory = Math.max(peakMemory, memory);
		requestDraw();
	}

	function requestDraw() {
		if (animationFrame) cancelAnimationFrame(animationFrame);
		animationFrame = requestAnimationFrame(draw);
	}

	function draw() {
		if (!ctx || !canvas) return;

		const dpr = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const canvasHeight = canvas.clientHeight;

		// Set canvas resolution for sharp rendering
		canvas.width = width * dpr;
		canvas.height = canvasHeight * dpr;
		ctx.scale(dpr, dpr);

		// Clear canvas
		ctx.clearRect(0, 0, width, canvasHeight);

		// Draw background grid
		drawGrid(width, canvasHeight);

		if (history.length < 2) return;

		// Draw lines
		if (showMemory) {
			drawLine(history.map(p => p.memory), memoryColor, width, canvasHeight);
		}
		if (showCpu) {
			drawLine(history.map(p => p.cpu), cpuColor, width, canvasHeight);
		}
	}

	function drawGrid(width: number, canvasHeight: number) {
		if (!ctx) return;

		ctx.strokeStyle = gridColor;
		ctx.lineWidth = 1;

		// Horizontal lines at 25%, 50%, 75%
		for (const percent of [0.25, 0.5, 0.75]) {
			const y = canvasHeight * (1 - percent);
			ctx.beginPath();
			ctx.setLineDash([4, 4]);
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}

		ctx.setLineDash([]);
	}

	function drawLine(data: number[], color: string, width: number, canvasHeight: number) {
		if (!ctx || data.length < 2) return;
		const context = ctx; // TypeScript narrowing helper

		const padding = 2;
		const graphHeight = canvasHeight - padding * 2;
		const stepX = width / (maxDataPoints - 1);

		// Calculate starting offset for current data
		const offset = (maxDataPoints - data.length) * stepX;

		// Draw filled area
		context.beginPath();
		context.moveTo(offset, canvasHeight - padding);

		data.forEach((value, i) => {
			const x = offset + i * stepX;
			const y = canvasHeight - padding - (value / 100) * graphHeight;
			context.lineTo(x, y);
		});

		context.lineTo(offset + (data.length - 1) * stepX, canvasHeight - padding);
		context.closePath();

		context.fillStyle = color.replace(')', `, ${fillOpacity})`).replace('rgb', 'rgba');
		context.fill();

		// Draw line on top
		context.beginPath();
		data.forEach((value, i) => {
			const x = offset + i * stepX;
			const y = canvasHeight - padding - (value / 100) * graphHeight;
			if (i === 0) {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		});

		context.strokeStyle = color;
		context.lineWidth = 2;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.stroke();

		// Draw current value dot
		const lastX = offset + (data.length - 1) * stepX;
		const lastY = canvasHeight - padding - (data[data.length - 1] / 100) * graphHeight;
		context.beginPath();
		context.arc(lastX, lastY, 4, 0, Math.PI * 2);
		context.fillStyle = color;
		context.fill();
		context.strokeStyle = '#ffffff';
		context.lineWidth = 2;
		context.stroke();
	}

	async function init() {
		await tick();
		ctx = canvas?.getContext('2d');

		// Get initial data
		try {
			const snap = await invoke<{
				cpu_usage: number;
				memory_percent: number;
			}>('get_system_health');
			addDataPoint(snap.cpu_usage, snap.memory_percent);
		} catch {
			// Fallback to store values
			addDataPoint($systemHealth.cpuUsage, $systemHealth.memoryPercent);
		}

		// Listen for updates
		unlisten = await listen<{
			cpu_usage: number;
			memory_percent: number;
		}>('system:health', (e) => {
			addDataPoint(e.payload.cpu_usage, e.payload.memory_percent);
		});

		// Start monitor if not already running
		try {
			await invoke('start_system_monitor', { intervalSecs: refreshInterval });
		} catch {
			// Monitor might already be running
		}
	}

	function handleResize() {
		requestDraw();
	}

	onMount(() => {
		init();
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		unlisten?.();
		if (animationFrame) cancelAnimationFrame(animationFrame);
		window.removeEventListener('resize', handleResize);
	});
</script>

<div class="system-resources-chart">
	{#if showLegend}
		<div class="legend">
			{#if showCpu}
				<div class="legend-item">
					<span class="legend-color" style="background: {cpuColor}"></span>
					<span class="legend-label">CPU</span>
					<span class="legend-value">{currentCpu.toFixed(1)}%</span>
					<span class="legend-peak">(peak: {peakCpu.toFixed(1)}%)</span>
				</div>
			{/if}
			{#if showMemory}
				<div class="legend-item">
					<span class="legend-color" style="background: {memoryColor}"></span>
					<span class="legend-label">Memory</span>
					<span class="legend-value">{currentMemory.toFixed(1)}%</span>
					<span class="legend-peak">(peak: {peakMemory.toFixed(1)}%)</span>
				</div>
			{/if}
		</div>
	{/if}

	<div class="chart-container" style="height: {height}px">
		<canvas bind:this={canvas}></canvas>
		<div class="y-axis">
			<span>100%</span>
			<span>75%</span>
			<span>50%</span>
			<span>25%</span>
			<span>0%</span>
		</div>
	</div>

	<div class="time-axis">
		<span>-{maxDataPoints}s</span>
		<span>now</span>
	</div>
</div>

<style>
	.system-resources-chart {
		font-family: var(--font-family, system-ui, sans-serif);
		padding: 12px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		color: var(--text-primary, #dcddde);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 12px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.legend-color {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.legend-label {
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #72767d);
	}

	.legend-value {
		font-weight: 600;
		font-family: var(--font-mono, monospace);
	}

	.legend-peak {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.chart-container {
		position: relative;
		background: var(--bg-tertiary, #202225);
		border-radius: 6px;
		overflow: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.y-axis {
		position: absolute;
		right: 4px;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 2px 0;
		font-size: 9px;
		color: var(--text-muted, #72767d);
		pointer-events: none;
	}

	.time-axis {
		display: flex;
		justify-content: space-between;
		margin-top: 4px;
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}
</style>
