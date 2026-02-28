<!--
  SystemUsageMonitor - Displays live system resource usage.

  Uses the Rust systemmonitor backend to receive periodic snapshots
  of CPU, memory, and disk usage via Tauri events. Falls back to
  one-shot polling if the background monitor isn't running.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { systemHealth, memoryWarning, diskWarning } from '$lib/stores/systemHealth';

	export let refreshInterval = 10;
	export let showCpu = true;
	export let showMemory = true;
	export let showDisk = false;
	export let showUptime = false;
	export let compact = false;
	export let warningThreshold = 80;
	export let criticalThreshold = 95;

	let unlisten: UnlistenFn | null = null;
	let loading = true;
	let error: string | null = null;

	interface HealthPayload {
		cpu_usage: number;
		cpu_per_core: number[];
		cpu_cores: number;
		memory_total: number;
		memory_used: number;
		memory_percent: number;
		disk_available: number;
		disk_total: number;
		disk_percent: number;
		load_average: [number, number, number];
		system_uptime: number;
		timestamp: number;
	}

	function formatBytes(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let unitIndex = 0;
		let value = bytes;

		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex++;
		}

		return `${value.toFixed(1)} ${units[unitIndex]}`;
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		if (days > 0) return `${days}d ${hours}h ${minutes}m`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	function getStatusClass(percent: number): string {
		if (percent >= criticalThreshold) return 'critical';
		if (percent >= warningThreshold) return 'warning';
		return 'normal';
	}

	async function init() {
		try {
			// Get initial snapshot
			const snap = await invoke<HealthPayload>('get_system_health');
			systemHealth.updateHealth(snap);
			loading = false;

			// Listen for periodic updates from the background monitor
			unlisten = await listen<HealthPayload>('system:health', (e) => {
				systemHealth.updateHealth(e.payload);
			});

			// Start the background monitor
			await invoke('start_system_monitor', { intervalSecs: refreshInterval });
			systemHealth.setMonitorActive(true);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load system stats';
			loading = false;
		}
	}

	onMount(() => {
		init();
	});

	onDestroy(() => {
		unlisten?.();
	});
</script>

<div class="system-usage-monitor" class:compact>
	{#if loading}
		<div class="loading">
			<span class="spinner"></span>
			<span>Loading system info...</span>
		</div>
	{:else if error}
		<div class="error">
			<span>{error}</span>
		</div>
	{:else}
		<div class="stats-grid">
			{#if showCpu}
				<div class="stat-item {getStatusClass($systemHealth.cpuUsage)}">
					<div class="stat-header">
						<span class="stat-label">CPU</span>
					</div>
					<div class="stat-value">
						{$systemHealth.cpuUsage.toFixed(1)}%
						{#if !compact}
							<span class="stat-detail">({$systemHealth.cpuCores} cores)</span>
						{/if}
					</div>
					<div class="stat-bar">
						<div
							class="stat-bar-fill"
							style="width: {Math.min($systemHealth.cpuUsage, 100)}%"
						></div>
					</div>
				</div>
			{/if}

			{#if showMemory}
				<div class="stat-item {getStatusClass($systemHealth.memoryPercent)}">
					<div class="stat-header">
						<span class="stat-label">
							Memory
							{#if $memoryWarning}
								<span class="badge-warn">High</span>
							{/if}
						</span>
					</div>
					<div class="stat-value">
						{#if compact}
							{$systemHealth.memoryPercent.toFixed(1)}%
						{:else}
							{formatBytes($systemHealth.memoryUsed)} / {formatBytes($systemHealth.memoryTotal)}
						{/if}
					</div>
					<div class="stat-bar">
						<div
							class="stat-bar-fill"
							style="width: {Math.min($systemHealth.memoryPercent, 100)}%"
						></div>
					</div>
				</div>
			{/if}

			{#if showDisk && $systemHealth.diskTotal > 0}
				<div class="stat-item {getStatusClass($systemHealth.diskPercent)}">
					<div class="stat-header">
						<span class="stat-label">
							Disk
							{#if $diskWarning}
								<span class="badge-crit">Low</span>
							{/if}
						</span>
					</div>
					<div class="stat-value">
						{#if compact}
							{$systemHealth.diskPercent.toFixed(1)}%
						{:else}
							{formatBytes($systemHealth.diskAvailable)} free
						{/if}
					</div>
					<div class="stat-bar">
						<div
							class="stat-bar-fill"
							style="width: {Math.min($systemHealth.diskPercent, 100)}%"
						></div>
					</div>
				</div>
			{/if}

			{#if showUptime}
				<div class="stat-item normal">
					<div class="stat-header">
						<span class="stat-label">Uptime</span>
					</div>
					<div class="stat-value uptime">{formatUptime($systemHealth.systemUptime)}</div>
				</div>
			{/if}
		</div>

		{#if !compact && $systemHealth.loadAverage[0] > 0}
			<div class="load-avg">
				Load: {$systemHealth.loadAverage[0].toFixed(2)} /
				{$systemHealth.loadAverage[1].toFixed(2)} /
				{$systemHealth.loadAverage[2].toFixed(2)}
			</div>
		{/if}
	{/if}
</div>

<style>
	.system-usage-monitor {
		font-family: var(--font-family, system-ui, sans-serif);
		padding: 12px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		color: var(--text-primary, #dcddde);
	}

	.system-usage-monitor.compact {
		padding: 8px;
	}

	.loading,
	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-muted, #72767d);
	}

	.error {
		color: var(--error, #ed4245);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--text-muted, #72767d);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.stats-grid {
		display: grid;
		gap: 12px;
	}

	.compact .stats-grid {
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 8px;
	}

	.stat-item {
		padding: 10px;
		background: var(--bg-tertiary, #202225);
		border-radius: 6px;
		transition: background 0.2s;
	}

	.compact .stat-item {
		padding: 6px 8px;
	}

	.stat-item.warning {
		border-left: 3px solid var(--warning, #fee75c);
	}

	.stat-item.critical {
		border-left: 3px solid var(--error, #ed4245);
		background: rgba(237, 66, 69, 0.1);
	}

	.stat-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.stat-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #72767d);
	}

	.stat-detail {
		font-size: 12px;
		font-weight: 400;
		color: var(--text-muted, #72767d);
	}

	.stat-value {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.compact .stat-value {
		font-size: 14px;
		margin-bottom: 4px;
	}

	.stat-value.uptime {
		font-family: var(--font-mono, monospace);
	}

	.badge-warn {
		font-size: 10px;
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(254, 231, 92, 0.2);
		color: var(--warning, #fee75c);
		text-transform: uppercase;
	}

	.badge-crit {
		font-size: 10px;
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(237, 66, 69, 0.2);
		color: var(--error, #ed4245);
		text-transform: uppercase;
	}

	.stat-bar {
		height: 4px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 2px;
		overflow: hidden;
	}

	.stat-bar-fill {
		height: 100%;
		background: var(--brand, #5865f2);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.stat-item.warning .stat-bar-fill {
		background: var(--warning, #fee75c);
	}

	.stat-item.critical .stat-bar-fill {
		background: var(--error, #ed4245);
	}

	.load-avg {
		margin-top: 8px;
		font-size: 11px;
		color: var(--text-muted, #72767d);
		font-family: var(--font-mono, monospace);
	}
</style>
