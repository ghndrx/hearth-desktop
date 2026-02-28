<script lang="ts">
	import {
		bandwidthStats,
		bandwidthMonitorActive,
		startBandwidthMonitor,
		stopBandwidthMonitor,
		resetBandwidth,
		formatBytes,
		formatRate,
		totalTransferred
	} from '$lib/stores/bandwidth';
	import { onMount, onDestroy } from 'svelte';

	let expanded = $state(false);

	onMount(() => {
		startBandwidthMonitor();
	});

	onDestroy(() => {
		stopBandwidthMonitor();
	});

	function getSessionDuration(): string {
		if (!$bandwidthStats.session_start) return '0m';
		const secs = Math.floor(Date.now() / 1000) - $bandwidthStats.session_start;
		const mins = Math.floor(secs / 60);
		const hours = Math.floor(mins / 60);
		if (hours > 0) return `${hours}h ${mins % 60}m`;
		return `${mins}m`;
	}
</script>

<div class="bandwidth-monitor" class:expanded>
	<button
		class="bandwidth-toggle"
		onclick={() => (expanded = !expanded)}
		title="Network bandwidth"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 20V10M6 20V4M18 20v-6" />
		</svg>
		<span class="bandwidth-summary">
			{formatRate($bandwidthStats.current_download_rate)}
		</span>
	</button>

	{#if expanded}
		<div class="bandwidth-panel">
			<div class="bandwidth-header">
				<h4>Network Usage</h4>
				<span class="session-duration">{getSessionDuration()}</span>
			</div>

			<div class="bandwidth-grid">
				<div class="stat">
					<span class="label">Download</span>
					<span class="value">{formatRate($bandwidthStats.current_download_rate)}</span>
				</div>
				<div class="stat">
					<span class="label">Upload</span>
					<span class="value">{formatRate($bandwidthStats.current_upload_rate)}</span>
				</div>
				<div class="stat">
					<span class="label">Total Received</span>
					<span class="value">{formatBytes($bandwidthStats.bytes_received)}</span>
				</div>
				<div class="stat">
					<span class="label">Total Sent</span>
					<span class="value">{formatBytes($bandwidthStats.bytes_sent)}</span>
				</div>
				<div class="stat">
					<span class="label">Peak Down</span>
					<span class="value">{formatRate($bandwidthStats.peak_download_rate)}</span>
				</div>
				<div class="stat">
					<span class="label">Peak Up</span>
					<span class="value">{formatRate($bandwidthStats.peak_upload_rate)}</span>
				</div>
			</div>

			<div class="bandwidth-total">
				Total: {formatBytes($totalTransferred)}
			</div>

			<button class="reset-btn" onclick={resetBandwidth}>Reset Counters</button>
		</div>
	{/if}
</div>

<style>
	.bandwidth-monitor {
		position: relative;
	}

	.bandwidth-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: transparent;
		border: none;
		color: var(--text-muted, #8e9297);
		cursor: pointer;
		border-radius: 4px;
		font-size: 11px;
		transition: background 0.15s;
	}

	.bandwidth-toggle:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-normal, #dcddde);
	}

	.bandwidth-panel {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 8px;
		width: 240px;
		padding: 12px;
		background: var(--bg-floating, #18191c);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		z-index: 1000;
	}

	.bandwidth-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.bandwidth-header h4 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
	}

	.session-duration {
		font-size: 11px;
		color: var(--text-muted, #8e9297);
	}

	.bandwidth-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat .label {
		font-size: 10px;
		color: var(--text-muted, #8e9297);
		text-transform: uppercase;
	}

	.stat .value {
		font-size: 12px;
		color: var(--text-normal, #dcddde);
		font-variant-numeric: tabular-nums;
	}

	.bandwidth-total {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		font-size: 11px;
		color: var(--text-muted, #8e9297);
		text-align: center;
	}

	.reset-btn {
		width: 100%;
		margin-top: 8px;
		padding: 4px;
		background: transparent;
		border: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-muted, #8e9297);
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.reset-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-normal, #dcddde);
	}
</style>
