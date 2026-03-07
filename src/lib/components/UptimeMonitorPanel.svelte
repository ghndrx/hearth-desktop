<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface UptimeInfo {
		uptime_seconds: number;
		boot_timestamp: number;
		load_avg_1: number;
		load_avg_5: number;
		load_avg_15: number;
		total_memory_mb: number;
		used_memory_mb: number;
		memory_percent: number;
		cpu_count: number;
		hostname: string;
		os_name: string;
	}

	let info: UptimeInfo | null = $state(null);
	let error: string | null = $state(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let memoryHistory: number[] = $state([]);
	const MAX_HISTORY = 30;

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		const parts: string[] = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);
		parts.push(`${secs}s`);
		return parts.join(' ');
	}

	function formatBootTime(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleString();
	}

	function getLoadColor(load: number, cpuCount: number): string {
		const ratio = load / cpuCount;
		if (ratio < 0.5) return '#43b581';
		if (ratio < 0.8) return '#faa81a';
		if (ratio < 1.0) return '#f27f3f';
		return '#f23f43';
	}

	function getMemoryColor(percent: number): string {
		if (percent < 50) return '#43b581';
		if (percent < 75) return '#faa81a';
		if (percent < 90) return '#f27f3f';
		return '#f23f43';
	}

	async function fetchInfo() {
		try {
			info = await invoke<UptimeInfo>('uptime_get_info');
			error = null;
			if (info) {
				memoryHistory = [...memoryHistory, info.memory_percent].slice(-MAX_HISTORY);
			}
		} catch (e) {
			error = String(e);
		}
	}

	onMount(() => {
		fetchInfo();
		pollInterval = setInterval(fetchInfo, 3000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="uptime-panel">
	<div class="panel-header">
		<div class="header-icon">&#x23F1;</div>
		<h2>System Uptime</h2>
	</div>

	{#if error}
		<div class="error-message">{error}</div>
	{:else if info}
		<div class="host-info">
			<span class="hostname">{info.hostname}</span>
			<span class="os-name">{info.os_name}</span>
		</div>

		<div class="uptime-display">
			<div class="uptime-value">{formatUptime(info.uptime_seconds)}</div>
			<div class="uptime-label">Booted {formatBootTime(info.boot_timestamp)}</div>
		</div>

		<div class="section">
			<h3>Load Average</h3>
			<div class="load-bars">
				{#each [
					{ label: '1m', value: info.load_avg_1 },
					{ label: '5m', value: info.load_avg_5 },
					{ label: '15m', value: info.load_avg_15 }
				] as item}
					<div class="load-row">
						<span class="load-label">{item.label}</span>
						<div class="bar-track">
							<div
								class="bar-fill"
								style="width: {Math.min((item.value / info.cpu_count) * 100, 100)}%; background: {getLoadColor(item.value, info.cpu_count)};"
							></div>
						</div>
						<span class="load-value" style="color: {getLoadColor(item.value, info.cpu_count)};">
							{item.value.toFixed(2)}
						</span>
					</div>
				{/each}
			</div>
			<div class="cpu-note">{info.cpu_count} CPU{info.cpu_count !== 1 ? 's' : ''}</div>
		</div>

		<div class="section">
			<h3>Memory</h3>
			<div class="memory-bar-container">
				<div class="bar-track large">
					<div
						class="bar-fill"
						style="width: {info.memory_percent}%; background: {getMemoryColor(info.memory_percent)};"
					></div>
				</div>
				<div class="memory-stats">
					<span>{info.used_memory_mb.toLocaleString()} MB</span>
					<span class="memory-percent" style="color: {getMemoryColor(info.memory_percent)};">
						{info.memory_percent}%
					</span>
					<span>{info.total_memory_mb.toLocaleString()} MB</span>
				</div>
			</div>
		</div>

		{#if memoryHistory.length > 1}
			<div class="section">
				<h3>Memory Trend</h3>
				<div class="sparkline">
					<svg viewBox="0 0 {MAX_HISTORY} 100" preserveAspectRatio="none">
						<polyline
							fill="none"
							stroke="#5865f2"
							stroke-width="1.5"
							points={memoryHistory.map((v, i) => `${i},${100 - v}`).join(' ')}
						/>
						<polyline
							fill="url(#sparkGrad)"
							stroke="none"
							points={`0,100 ${memoryHistory.map((v, i) => `${i},${100 - v}`).join(' ')} ${memoryHistory.length - 1},100`}
						/>
						<defs>
							<linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#5865f2" stop-opacity="0.3" />
								<stop offset="100%" stop-color="#5865f2" stop-opacity="0.02" />
							</linearGradient>
						</defs>
					</svg>
				</div>
			</div>
		{/if}
	{:else}
		<div class="loading">Loading system info...</div>
	{/if}
</div>

<style>
	.uptime-panel {
		background: #1e1f22;
		border-radius: 12px;
		padding: 20px;
		color: #dcddde;
		font-family: 'gg sans', 'Noto Sans', Helvetica, Arial, sans-serif;
		width: 100%;
		max-width: 400px;
	}
	.panel-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.header-icon {
		font-size: 22px;
	}
	.panel-header h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #ffffff;
	}
	.host-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		font-size: 12px;
		color: #b5bac1;
	}
	.hostname {
		font-weight: 600;
		color: #5865f2;
	}
	.uptime-display {
		background: #2b2d31;
		border-radius: 8px;
		padding: 16px;
		text-align: center;
		margin-bottom: 16px;
	}
	.uptime-value {
		font-size: 28px;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 1px;
		font-variant-numeric: tabular-nums;
	}
	.uptime-label {
		font-size: 11px;
		color: #949ba4;
		margin-top: 6px;
	}
	.section {
		margin-bottom: 14px;
	}
	.section h3 {
		margin: 0 0 8px 0;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: #949ba4;
		letter-spacing: 0.5px;
	}
	.load-bars {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.load-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.load-label {
		font-size: 12px;
		color: #b5bac1;
		width: 28px;
		text-align: right;
		font-weight: 500;
	}
	.bar-track {
		flex: 1;
		height: 8px;
		background: #313338;
		border-radius: 4px;
		overflow: hidden;
	}
	.bar-track.large {
		height: 12px;
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease, background 0.5s ease;
	}
	.load-value {
		font-size: 12px;
		font-weight: 600;
		width: 40px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.cpu-note {
		font-size: 11px;
		color: #72767d;
		text-align: right;
		margin-top: 4px;
	}
	.memory-bar-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.memory-stats {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #b5bac1;
	}
	.memory-percent {
		font-weight: 700;
	}
	.sparkline {
		height: 48px;
		background: #2b2d31;
		border-radius: 6px;
		padding: 4px;
		overflow: hidden;
	}
	.sparkline svg {
		width: 100%;
		height: 100%;
	}
	.error-message {
		color: #f23f43;
		font-size: 13px;
		padding: 12px;
		background: rgba(242, 63, 67, 0.1);
		border-radius: 6px;
	}
	.loading {
		color: #949ba4;
		font-size: 13px;
		text-align: center;
		padding: 24px;
	}
</style>
