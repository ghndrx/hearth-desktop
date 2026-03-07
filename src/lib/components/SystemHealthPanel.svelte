<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface CpuInfo {
		name: string;
		physicalCores: number;
		logicalCores: number;
		frequencyMhz: number;
		usagePercent: number;
	}

	interface MemoryInfo {
		totalBytes: number;
		usedBytes: number;
		availableBytes: number;
		usagePercent: number;
		swapTotalBytes: number;
		swapUsedBytes: number;
	}

	interface OsInfo {
		name: string;
		version: string;
		kernelVersion: string;
		hostname: string;
		arch: string;
		uptimeSeconds: number;
	}

	interface DiskInfo {
		name: string;
		mountPoint: string;
		fsType: string;
		totalBytes: number;
		usedBytes: number;
		freeBytes: number;
		usagePercent: number;
	}

	interface DiskUsageSummary {
		disks: DiskInfo[];
		totalSpace: number;
		totalUsed: number;
		totalFree: number;
		overallPercent: number;
	}

	let cpu = $state<CpuInfo | null>(null);
	let memory = $state<MemoryInfo | null>(null);
	let os = $state<OsInfo | null>(null);
	let disks = $state<DiskUsageSummary | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let uptimeInterval: ReturnType<typeof setInterval> | null = null;
	let liveUptime = $state(0);

	onMount(async () => {
		await refresh();
		refreshInterval = setInterval(refresh, 5000);
		uptimeInterval = setInterval(() => { liveUptime++; }, 1000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
		if (uptimeInterval) clearInterval(uptimeInterval);
	});

	async function refresh() {
		try {
			const [cpuData, memData, osData, diskData] = await Promise.all([
				invoke<CpuInfo>('get_cpu_info'),
				invoke<MemoryInfo>('get_memory_info'),
				invoke<OsInfo>('get_os_info'),
				invoke<DiskUsageSummary>('disk_get_usage'),
			]);
			cpu = cpuData;
			memory = memData;
			os = osData;
			disks = diskData;
			liveUptime = osData.uptimeSeconds;
			loading = false;
			error = null;
		} catch (e) {
			error = String(e);
			loading = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + ' TB';
		if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
		if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
		if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return bytes + ' B';
	}

	function formatUptime(secs: number): string {
		const d = Math.floor(secs / 86400);
		const h = Math.floor((secs % 86400) / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		if (d > 0) return `${d}d ${h}h ${m}m`;
		if (h > 0) return `${h}h ${m}m ${s}s`;
		return `${m}m ${s}s`;
	}

	function gaugeColor(percent: number): string {
		if (percent < 60) return '#3ba55d';
		if (percent < 85) return '#faa61a';
		return '#ed4245';
	}

	function gaugeOffset(percent: number): number {
		const circumference = 2 * Math.PI * 36;
		return circumference - (percent / 100) * circumference;
	}
</script>

<div class="health-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F4CA;</span>
			<h3>System Health</h3>
		</div>
		<button class="refresh-btn" onclick={refresh} title="Refresh now">&#x21BB;</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading system information...</div>
	{:else}
		{#if os}
			<div class="os-bar">
				<span class="os-name">{os.hostname}</span>
				<span class="os-detail">{os.name} {os.version} ({os.arch})</span>
				<span class="uptime">Up {formatUptime(liveUptime)}</span>
			</div>
		{/if}

		<div class="gauges-row">
			{#if cpu}
				<div class="gauge-card">
					<svg class="gauge-svg" viewBox="0 0 80 80">
						<circle class="gauge-bg" cx="40" cy="40" r="36" />
						<circle
							class="gauge-fill"
							cx="40" cy="40" r="36"
							style="stroke-dashoffset: {gaugeOffset(cpu.usagePercent)}; stroke: {gaugeColor(cpu.usagePercent)};"
						/>
					</svg>
					<div class="gauge-label">
						<span class="gauge-value">{Math.round(cpu.usagePercent)}%</span>
						<span class="gauge-title">CPU</span>
					</div>
					<div class="gauge-detail">{cpu.logicalCores} cores @ {cpu.frequencyMhz} MHz</div>
				</div>
			{/if}

			{#if memory}
				<div class="gauge-card">
					<svg class="gauge-svg" viewBox="0 0 80 80">
						<circle class="gauge-bg" cx="40" cy="40" r="36" />
						<circle
							class="gauge-fill"
							cx="40" cy="40" r="36"
							style="stroke-dashoffset: {gaugeOffset(memory.usagePercent)}; stroke: {gaugeColor(memory.usagePercent)};"
						/>
					</svg>
					<div class="gauge-label">
						<span class="gauge-value">{Math.round(memory.usagePercent)}%</span>
						<span class="gauge-title">Memory</span>
					</div>
					<div class="gauge-detail">{formatBytes(memory.usedBytes)} / {formatBytes(memory.totalBytes)}</div>
				</div>
			{/if}

			{#if disks}
				<div class="gauge-card">
					<svg class="gauge-svg" viewBox="0 0 80 80">
						<circle class="gauge-bg" cx="40" cy="40" r="36" />
						<circle
							class="gauge-fill"
							cx="40" cy="40" r="36"
							style="stroke-dashoffset: {gaugeOffset(disks.overallPercent)}; stroke: {gaugeColor(disks.overallPercent)};"
						/>
					</svg>
					<div class="gauge-label">
						<span class="gauge-value">{Math.round(disks.overallPercent)}%</span>
						<span class="gauge-title">Disk</span>
					</div>
					<div class="gauge-detail">{formatBytes(disks.totalUsed)} / {formatBytes(disks.totalSpace)}</div>
				</div>
			{/if}
		</div>

		{#if memory && memory.swapTotalBytes > 0}
			<div class="swap-row">
				<span class="swap-label">Swap</span>
				<div class="bar-bg">
					<div
						class="bar-fill"
						style="width: {memory.swapTotalBytes > 0 ? (memory.swapUsedBytes / memory.swapTotalBytes * 100) : 0}%; background: {gaugeColor(memory.swapTotalBytes > 0 ? (memory.swapUsedBytes / memory.swapTotalBytes * 100) : 0)};"
					></div>
				</div>
				<span class="swap-detail">{formatBytes(memory.swapUsedBytes)} / {formatBytes(memory.swapTotalBytes)}</span>
			</div>
		{/if}

		{#if disks && disks.disks.length > 0}
			<div class="disks-section">
				<span class="section-label">Volumes</span>
				{#each disks.disks as disk}
					<div class="disk-row">
						<div class="disk-info">
							<span class="disk-mount">{disk.mountPoint}</span>
							<span class="disk-fs">{disk.fsType}</span>
						</div>
						<div class="bar-bg">
							<div
								class="bar-fill"
								style="width: {disk.usagePercent}%; background: {gaugeColor(disk.usagePercent)};"
							></div>
						</div>
						<span class="disk-usage">{disk.usagePercent}% ({formatBytes(disk.freeBytes)} free)</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if cpu}
			<div class="cpu-detail">
				<span class="section-label">Processor</span>
				<span class="cpu-name">{cpu.name}</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	.health-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.refresh-btn {
		padding: 4px 8px; border-radius: 4px; border: none;
		background: transparent; color: var(--text-muted, #6d6f78);
		font-size: 16px; cursor: pointer; transition: color 0.15s;
	}
	.refresh-btn:hover { color: var(--text-primary, #dbdee1); }

	.error { font-size: 12px; color: #ed4245; }
	.loading { font-size: 12px; color: var(--text-muted, #6d6f78); text-align: center; padding: 24px; }

	.os-bar {
		display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
		padding: 8px 10px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		font-size: 11px;
	}
	.os-name { font-weight: 600; color: var(--text-primary, #dbdee1); }
	.os-detail { color: var(--text-muted, #6d6f78); }
	.uptime { margin-left: auto; color: #3ba55d; font-weight: 500; }

	.gauges-row {
		display: flex; gap: 12px; justify-content: center;
	}

	.gauge-card {
		display: flex; flex-direction: column; align-items: center; gap: 4px;
		flex: 1; min-width: 90px; padding: 12px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px; border: 1px solid var(--border, #3f4147);
		position: relative;
	}

	.gauge-svg { width: 72px; height: 72px; }

	.gauge-bg {
		fill: none; stroke: var(--bg-secondary, #2b2d31); stroke-width: 6;
	}
	.gauge-fill {
		fill: none; stroke-width: 6; stroke-linecap: round;
		stroke-dasharray: 226.19; /* 2 * PI * 36 */
		transform: rotate(-90deg); transform-origin: center;
		transition: stroke-dashoffset 0.8s ease, stroke 0.3s ease;
	}

	.gauge-label {
		position: absolute; top: 12px; left: 0; right: 0;
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 72px; pointer-events: none;
	}
	.gauge-value { font-size: 18px; font-weight: 700; font-family: monospace; }
	.gauge-title {
		font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
		color: var(--text-muted, #6d6f78);
	}
	.gauge-detail {
		font-size: 10px; color: var(--text-muted, #6d6f78); text-align: center;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
	}

	.swap-row {
		display: flex; align-items: center; gap: 8px;
		padding: 6px 10px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		font-size: 11px;
	}
	.swap-label { font-weight: 500; min-width: 36px; }
	.swap-detail { color: var(--text-muted, #6d6f78); white-space: nowrap; }

	.bar-bg {
		flex: 1; height: 6px; border-radius: 3px;
		background: var(--bg-secondary, #2b2d31); overflow: hidden;
	}
	.bar-fill {
		height: 100%; border-radius: 3px;
		transition: width 0.8s ease;
	}

	.disks-section { display: flex; flex-direction: column; gap: 6px; }
	.section-label {
		font-size: 10px; color: var(--text-muted, #6d6f78);
		text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
	}

	.disk-row {
		display: flex; flex-direction: column; gap: 4px;
		padding: 8px 10px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.disk-info { display: flex; align-items: center; gap: 8px; }
	.disk-mount { font-size: 12px; font-weight: 500; }
	.disk-fs { font-size: 10px; color: var(--text-muted, #6d6f78); }
	.disk-usage { font-size: 10px; color: var(--text-muted, #6d6f78); }

	.cpu-detail {
		display: flex; flex-direction: column; gap: 4px;
	}
	.cpu-name {
		font-size: 11px; color: var(--text-muted, #6d6f78);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
</style>
