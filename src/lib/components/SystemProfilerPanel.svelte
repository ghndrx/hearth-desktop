<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface CpuInfo {
		name: string;
		vendor: string;
		brand: string;
		frequencyMhz: number;
		coreCount: number;
		usagePercent: number;
		perCoreUsage: number[];
	}

	interface MemoryInfo {
		totalBytes: number;
		usedBytes: number;
		availableBytes: number;
		swapTotalBytes: number;
		swapUsedBytes: number;
		usagePercent: number;
	}

	interface OsInfo {
		name: string;
		kernelVersion: string;
		osVersion: string;
		hostname: string;
		uptimeSecs: number;
	}

	interface SystemProfile {
		cpu: CpuInfo;
		memory: MemoryInfo;
		os: OsInfo;
		timestamp: number;
	}

	let profile: SystemProfile | null = $state(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let cpuHistory: number[] = $state([]);
	const MAX_HISTORY = 60;

	function formatBytes(bytes: number): string {
		if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
		if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
		if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return bytes + ' B';
	}

	function formatUptime(secs: number): string {
		const days = Math.floor(secs / 86400);
		const hours = Math.floor((secs % 86400) / 3600);
		const mins = Math.floor((secs % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	async function poll() {
		try {
			profile = await invoke<SystemProfile>('systemprofiler_poll');
			if (profile) {
				cpuHistory = [...cpuHistory.slice(-(MAX_HISTORY - 1)), profile.cpu.usagePercent];
			}
		} catch {
			// silently fail
		}
	}

	function getBarColor(pct: number): string {
		if (pct < 50) return '#43b581';
		if (pct < 80) return '#faa61a';
		return '#f04747';
	}

	onMount(() => {
		poll();
		pollInterval = setInterval(poll, 1500);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="profiler-panel">
	<div class="panel-header">
		<h3>System Profiler</h3>
	</div>

	{#if profile}
		<div class="section">
			<div class="section-title">CPU</div>
			<div class="info-row">
				<span class="label">{profile.cpu.brand || profile.cpu.name}</span>
			</div>
			<div class="info-row">
				<span class="label">{profile.cpu.coreCount} cores @ {profile.cpu.frequencyMhz} MHz</span>
			</div>
			<div class="usage-bar-container">
				<div class="usage-label">
					<span>Usage</span>
					<span class="usage-value">{profile.cpu.usagePercent.toFixed(1)}%</span>
				</div>
				<div class="usage-bar-bg">
					<div
						class="usage-bar"
						style="width: {profile.cpu.usagePercent}%; background: {getBarColor(profile.cpu.usagePercent)}"
					></div>
				</div>
			</div>

			<div class="sparkline-container">
				<svg viewBox="0 0 {MAX_HISTORY} 100" class="sparkline" preserveAspectRatio="none">
					{#if cpuHistory.length > 1}
						<polyline
							fill="none"
							stroke="#5865f2"
							stroke-width="1.5"
							points={cpuHistory.map((v, i) => `${i},${100 - v}`).join(' ')}
						/>
						<polyline
							fill="url(#cpuGrad)"
							stroke="none"
							points={`0,100 ${cpuHistory.map((v, i) => `${i},${100 - v}`).join(' ')} ${cpuHistory.length - 1},100`}
						/>
						<defs>
							<linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#5865f2" stop-opacity="0.3" />
								<stop offset="100%" stop-color="#5865f2" stop-opacity="0.02" />
							</linearGradient>
						</defs>
					{/if}
				</svg>
			</div>

			{#if profile.cpu.perCoreUsage.length > 0}
				<div class="core-grid">
					{#each profile.cpu.perCoreUsage as usage, i}
						<div class="core-item" title="Core {i}: {usage.toFixed(1)}%">
							<div class="core-bar-bg">
								<div
									class="core-bar"
									style="height: {usage}%; background: {getBarColor(usage)}"
								></div>
							</div>
							<span class="core-label">{i}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="section">
			<div class="section-title">Memory</div>
			<div class="usage-bar-container">
				<div class="usage-label">
					<span>RAM: {formatBytes(profile.memory.usedBytes)} / {formatBytes(profile.memory.totalBytes)}</span>
					<span class="usage-value">{profile.memory.usagePercent.toFixed(1)}%</span>
				</div>
				<div class="usage-bar-bg">
					<div
						class="usage-bar"
						style="width: {profile.memory.usagePercent}%; background: {getBarColor(profile.memory.usagePercent)}"
					></div>
				</div>
			</div>
			{#if profile.memory.swapTotalBytes > 0}
				{@const swapPct = (profile.memory.swapUsedBytes / profile.memory.swapTotalBytes) * 100}
				<div class="usage-bar-container">
					<div class="usage-label">
						<span>Swap: {formatBytes(profile.memory.swapUsedBytes)} / {formatBytes(profile.memory.swapTotalBytes)}</span>
						<span class="usage-value">{swapPct.toFixed(1)}%</span>
					</div>
					<div class="usage-bar-bg">
						<div class="usage-bar" style="width: {swapPct}%; background: {getBarColor(swapPct)}"></div>
					</div>
				</div>
			{/if}
		</div>

		<div class="section">
			<div class="section-title">System</div>
			<div class="info-grid">
				<div class="info-item">
					<span class="info-key">OS</span>
					<span class="info-val">{profile.os.name} {profile.os.osVersion}</span>
				</div>
				<div class="info-item">
					<span class="info-key">Kernel</span>
					<span class="info-val">{profile.os.kernelVersion}</span>
				</div>
				<div class="info-item">
					<span class="info-key">Hostname</span>
					<span class="info-val">{profile.os.hostname}</span>
				</div>
				<div class="info-item">
					<span class="info-key">Uptime</span>
					<span class="info-val">{formatUptime(profile.os.uptimeSecs)}</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="loading">Loading system info...</div>
	{/if}
</div>

<style>
	.profiler-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.section {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.info-row {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
	}

	.usage-bar-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.usage-label {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.usage-value {
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
		font-variant-numeric: tabular-nums;
	}

	.usage-bar-bg {
		height: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		overflow: hidden;
	}

	.usage-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.sparkline-container {
		height: 48px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.sparkline {
		width: 100%;
		height: 100%;
	}

	.core-grid {
		display: flex;
		gap: 3px;
		align-items: flex-end;
		height: 40px;
	}

	.core-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		gap: 2px;
	}

	.core-bar-bg {
		flex: 1;
		width: 100%;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 2px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.core-bar {
		width: 100%;
		border-radius: 2px;
		transition: height 0.5s ease;
	}

	.core-label {
		font-size: 8px;
		color: var(--text-muted, #949ba4);
	}

	.info-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
	}

	.info-key {
		color: var(--text-muted, #949ba4);
	}

	.info-val {
		color: var(--text-normal, #dbdee1);
		font-weight: 500;
	}

	.loading {
		text-align: center;
		color: var(--text-muted, #949ba4);
		padding: 32px;
	}
</style>
