<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { systemResources, type SystemResources } from '$lib/stores/systemResources';

	let resources = $state<SystemResources>({
		cpuPercent: 0,
		memoryPercent: 0,
		memoryUsedGB: 0,
		memoryTotalGB: 0,
		diskPercent: 0,
		diskUsedGB: 0,
		diskTotalGB: 0,
		uptimeSeconds: 0
	});
	let refreshing = $state(false);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		systemResources.init();
		unsubs.push(systemResources.resources.subscribe((r) => (resources = r)));
	});

	onDestroy(() => {
		systemResources.cleanup();
		unsubs.forEach((u) => u());
	});

	async function handleRefresh() {
		refreshing = true;
		await systemResources.refresh();
		refreshing = false;
	}

	function getBarColor(percent: number): string {
		if (percent > 85) return 'var(--danger, #ed4245)';
		if (percent > 60) return 'var(--warning, #fee75c)';
		return 'var(--success, #57f287)';
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);

		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}
</script>

<div class="sysresource-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
				<path d="M8 21h8M12 17v4" />
			</svg>
			<h3>System Resources</h3>
		</div>
		<div class="header-actions">
			<button
				class="refresh-btn"
				onclick={handleRefresh}
				title="Refresh"
				disabled={refreshing}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					width="14"
					height="14"
					class:spinning={refreshing}
				>
					<path d="M23 4v6h-6" />
					<path d="M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
					<path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
				</svg>
			</button>
		</div>
	</div>

	<div class="resource-list">
		<div class="resource-item">
			<div class="resource-header">
				<span class="resource-label">CPU</span>
				<span class="resource-value">{resources.cpuPercent}%</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-bar"
					style="width: {Math.min(resources.cpuPercent, 100)}%; background: {getBarColor(resources.cpuPercent)}"
				></div>
			</div>
		</div>

		<div class="resource-item">
			<div class="resource-header">
				<span class="resource-label">RAM</span>
				<span class="resource-value">{resources.memoryPercent}%</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-bar"
					style="width: {Math.min(resources.memoryPercent, 100)}%; background: {getBarColor(resources.memoryPercent)}"
				></div>
			</div>
			<span class="resource-detail">{resources.memoryUsedGB} / {resources.memoryTotalGB} GB</span>
		</div>

		<div class="resource-item">
			<div class="resource-header">
				<span class="resource-label">Disk</span>
				<span class="resource-value">{resources.diskPercent}%</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-bar"
					style="width: {Math.min(resources.diskPercent, 100)}%; background: {getBarColor(resources.diskPercent)}"
				></div>
			</div>
			<span class="resource-detail">{resources.diskUsedGB} / {resources.diskTotalGB} GB</span>
		</div>
	</div>

	<div class="uptime-row">
		<svg class="uptime-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
		<span class="uptime-label">Uptime:</span>
		<span class="uptime-value">{formatUptime(resources.uptimeSeconds)}</span>
	</div>
</div>

<style>
	.sysresource-panel {
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

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.refresh-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.refresh-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}
	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinning {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.resource-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.resource-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.resource-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.resource-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #949ba4);
	}

	.resource-value {
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary, #dbdee1);
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease, background 0.3s ease;
	}

	.resource-detail {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	.uptime-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.uptime-icon {
		width: 14px;
		height: 14px;
		color: var(--text-secondary, #949ba4);
	}

	.uptime-label {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.uptime-value {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dbdee1);
	}
</style>
