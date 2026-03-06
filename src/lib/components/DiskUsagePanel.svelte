<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

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

	let summary = $state<DiskUsageSummary | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let selectedDisk = $state<DiskInfo | null>(null);

	onMount(() => {
		loadDiskUsage();
	});

	async function loadDiskUsage() {
		isLoading = true;
		error = null;
		try {
			summary = await invoke<DiskUsageSummary>('disk_get_usage');
		} catch (e) {
			error = String(e);
		} finally {
			isLoading = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
	}

	function getUsageColor(percent: number): string {
		if (percent >= 90) return '#ed4245';
		if (percent >= 75) return '#faa61a';
		return '#3ba55d';
	}
</script>

<div class="disk-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F4BE;</span>
			<h3>Disk Usage</h3>
		</div>
		<button class="icon-btn" onclick={loadDiskUsage} title="Refresh">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<polyline points="23 4 23 10 17 10" />
				<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
			</svg>
		</button>
	</div>

	{#if isLoading}
		<div class="loading">Loading disk info...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if summary}
		<div class="overall">
			<div class="overall-bar-bg">
				<div
					class="overall-bar-fill"
					style="width: {summary.overallPercent}%; background: {getUsageColor(summary.overallPercent)}"
				></div>
			</div>
			<div class="overall-stats">
				<span>{formatBytes(summary.totalUsed)} used</span>
				<span>{summary.overallPercent}%</span>
				<span>{formatBytes(summary.totalFree)} free</span>
			</div>
		</div>

		<div class="disk-list">
			{#each summary.disks as disk}
				<button
					class="disk-item"
					class:selected={selectedDisk?.mountPoint === disk.mountPoint}
					onclick={() => { selectedDisk = selectedDisk?.mountPoint === disk.mountPoint ? null : disk; }}
				>
					<div class="disk-header">
						<span class="disk-name">{disk.name || disk.mountPoint}</span>
						<span class="disk-percent" style="color: {getUsageColor(disk.usagePercent)}">{disk.usagePercent}%</span>
					</div>
					<div class="disk-bar-bg">
						<div
							class="disk-bar-fill"
							style="width: {disk.usagePercent}%; background: {getUsageColor(disk.usagePercent)}"
						></div>
					</div>
					{#if selectedDisk?.mountPoint === disk.mountPoint}
						<div class="disk-details">
							<div class="detail-row">
								<span class="detail-label">Mount</span>
								<span class="detail-value">{disk.mountPoint}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Filesystem</span>
								<span class="detail-value">{disk.fsType}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Total</span>
								<span class="detail-value">{formatBytes(disk.totalBytes)}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Used</span>
								<span class="detail-value">{formatBytes(disk.usedBytes)}</span>
							</div>
							<div class="detail-row">
								<span class="detail-label">Free</span>
								<span class="detail-value">{formatBytes(disk.freeBytes)}</span>
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.disk-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.icon-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.loading, .error {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted, #6d6f78);
		padding: 16px 0;
	}
	.error { color: #ed4245; }

	.overall { display: flex; flex-direction: column; gap: 6px; }

	.overall-bar-bg {
		height: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.overall-bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.overall-stats {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.disk-list { display: flex; flex-direction: column; gap: 6px; }

	.disk-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font-family: inherit;
		width: 100%;
	}
	.disk-item:hover { border-color: var(--border, #3f4147); }
	.disk-item.selected { border-color: #5865f2; }

	.disk-header { display: flex; justify-content: space-between; align-items: center; }
	.disk-name { font-size: 13px; font-weight: 500; }
	.disk-percent { font-size: 13px; font-weight: 600; }

	.disk-bar-bg {
		height: 4px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.disk-bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.disk-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--border, #3f4147);
	}

	.detail-row { display: flex; justify-content: space-between; font-size: 12px; }
	.detail-label { color: var(--text-secondary, #949ba4); }
	.detail-value { color: var(--text-primary, #dbdee1); font-family: monospace; font-size: 11px; }
</style>
