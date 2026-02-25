<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';

	export let refreshInterval = 2000; // 2 seconds
	export let compact = false;

	interface PerformanceMetrics {
		memory_bytes: number;
		memory_formatted: string;
		rss_bytes: number;
		rss_formatted: string;
		virtual_bytes: number;
		virtual_formatted: string;
		uptime_seconds: number;
		uptime_formatted: string;
		cpu_percent: number;
		thread_count: number;
		timestamp: number;
	}

	let metrics: PerformanceMetrics | null = null;
	let error: string | null = null;
	let showDetails = false;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let memoryHistory: number[] = [];
	let cpuHistory: number[] = [];
	let fps = 0;
	let frameCount = 0;
	let lastFpsTime = performance.now();
	let rafId: number | null = null;

	$: memoryPercent = metrics ? getMemoryHealthPercent(metrics.rss_bytes) : 0;
	$: cpuColor = getCpuColor(metrics?.cpu_percent ?? 0);
	$: memoryColor = getMemoryColor(memoryPercent);

	function getMemoryHealthPercent(bytes: number): number {
		// Consider 512MB as "full" for visualization purposes
		const maxExpected = 512 * 1024 * 1024;
		return Math.min((bytes / maxExpected) * 100, 100);
	}

	function getCpuColor(percent: number): string {
		if (percent < 10) return '#3ba55c'; // Green
		if (percent < 30) return '#faa61a'; // Yellow
		return '#ed4245'; // Red
	}

	function getMemoryColor(percent: number): string {
		if (percent < 50) return '#3ba55c'; // Green
		if (percent < 75) return '#faa61a'; // Yellow
		return '#ed4245'; // Red
	}

	async function fetchMetrics() {
		try {
			metrics = await invoke<PerformanceMetrics>('get_performance_metrics');
			error = null;

			// Keep last 20 data points for graphs
			if (metrics) {
				memoryHistory = [...memoryHistory.slice(-19), metrics.rss_bytes / (1024 * 1024)];
				cpuHistory = [...cpuHistory.slice(-19), metrics.cpu_percent];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch metrics';
		}
	}

	function measureFps() {
		frameCount++;
		const now = performance.now();
		
		if (now - lastFpsTime >= 1000) {
			fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
			frameCount = 0;
			lastFpsTime = now;
		}

		rafId = requestAnimationFrame(measureFps);
	}

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showDetails) {
			showDetails = false;
		}
	}

	onMount(() => {
		fetchMetrics();
		intervalId = setInterval(fetchMetrics, refreshInterval);
		measureFps();
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
		if (rafId) cancelAnimationFrame(rafId);
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="performance-monitor" class:compact>
	<button
		class="monitor-trigger"
		onclick={toggleDetails}
		aria-label="Performance monitor"
		aria-expanded={showDetails}
		type="button"
	>
		<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
		</svg>
		{#if !compact && metrics}
			<span class="quick-stats">
				<span class="stat" title="Memory">
					{metrics.rss_formatted}
				</span>
				<span class="separator">•</span>
				<span class="stat" style="color: {cpuColor}" title="CPU">
					{metrics.cpu_percent.toFixed(1)}%
				</span>
			</span>
		{/if}
	</button>

	{#if showDetails}
		<div
			class="details-panel"
			role="dialog"
			aria-label="Performance details"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="panel-header">
				<h3>Performance</h3>
				<span class="uptime" title="App uptime">
					⏱️ {metrics?.uptime_formatted ?? '—'}
				</span>
			</div>

			{#if error}
				<div class="error-message">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
					</svg>
					{error}
				</div>
			{:else if metrics}
				<div class="metrics-grid">
					<!-- Memory Section -->
					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">Memory (RSS)</span>
							<span class="metric-value" style="color: {memoryColor}">
								{metrics.rss_formatted}
							</span>
						</div>
						<div class="progress-bar">
							<div
								class="progress-fill"
								style="width: {memoryPercent}%; background-color: {memoryColor}"
							></div>
						</div>
						{#if memoryHistory.length > 1}
							<div class="mini-graph">
								{#each memoryHistory as val, i}
									<div
										class="graph-bar"
										style="height: {Math.min((val / 512) * 100, 100)}%; background-color: {memoryColor}"
										title="{val.toFixed(1)} MB"
									></div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- CPU Section -->
					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">CPU Usage</span>
							<span class="metric-value" style="color: {cpuColor}">
								{metrics.cpu_percent.toFixed(1)}%
							</span>
						</div>
						<div class="progress-bar">
							<div
								class="progress-fill"
								style="width: {Math.min(metrics.cpu_percent, 100)}%; background-color: {cpuColor}"
							></div>
						</div>
						{#if cpuHistory.length > 1}
							<div class="mini-graph">
								{#each cpuHistory as val, i}
									<div
										class="graph-bar"
										style="height: {Math.min(val, 100)}%; background-color: {getCpuColor(val)}"
										title="{val.toFixed(1)}%"
									></div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- FPS -->
					<div class="metric-row">
						<span class="metric-label">Frame Rate</span>
						<span class="metric-value" class:good={fps >= 55} class:warn={fps < 55 && fps >= 30} class:bad={fps < 30}>
							{fps} FPS
						</span>
					</div>

					<!-- Threads -->
					<div class="metric-row">
						<span class="metric-label">Threads</span>
						<span class="metric-value">{metrics.thread_count}</span>
					</div>

					<!-- Virtual Memory -->
					<div class="metric-row">
						<span class="metric-label">Virtual Memory</span>
						<span class="metric-value">{metrics.virtual_formatted}</span>
					</div>

					<!-- Heap -->
					<div class="metric-row">
						<span class="metric-label">Heap</span>
						<span class="metric-value">{metrics.memory_formatted}</span>
					</div>
				</div>
			{:else}
				<div class="loading">
					<div class="spinner"></div>
					Loading metrics...
				</div>
			{/if}

			<button class="refresh-btn" onclick={fetchMetrics} type="button">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
				</svg>
				Refresh
			</button>
		</div>
	{/if}
</div>

<style>
	.performance-monitor {
		position: relative;
		display: inline-flex;
	}

	.monitor-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: transparent;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-muted, #b5bac1);
		transition: all 0.15s ease;
	}

	.monitor-trigger:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-normal, #f2f3f5);
	}

	.icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.quick-stats {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.separator {
		opacity: 0.4;
	}

	.compact .quick-stats {
		display: none;
	}

	.details-panel {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		width: 300px;
		background: var(--bg-floating, #111214);
		border-radius: 12px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 24px rgba(0, 0, 0, 0.35);
		overflow: hidden;
		z-index: 1000;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.uptime {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px;
		color: #ed4245;
		font-size: 13px;
	}

	.metrics-grid {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.metric-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 12px;
	}

	.metric-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.metric-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
	}

	.metric-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.metric-value.good {
		color: #3ba55c;
	}

	.metric-value.warn {
		color: #faa61a;
	}

	.metric-value.bad {
		color: #ed4245;
	}

	.progress-bar {
		height: 4px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease, background-color 0.3s ease;
	}

	.mini-graph {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 24px;
		margin-top: 8px;
	}

	.graph-bar {
		flex: 1;
		min-height: 2px;
		border-radius: 1px;
		transition: height 0.2s ease;
	}

	.metric-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.metric-row:last-child {
		border-bottom: none;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 32px 16px;
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--bg-modifier-accent, #3f4147);
		border-top-color: var(--text-normal, #f2f3f5);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-top: 1px solid var(--bg-modifier-accent, #3f4147);
		color: var(--text-muted, #b5bac1);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		color: var(--text-normal, #f2f3f5);
	}
</style>
