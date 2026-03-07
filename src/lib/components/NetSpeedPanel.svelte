<script lang="ts">
	import { netSpeed, formatSpeed, formatBytes } from '$lib/stores/netSpeed';
	import { onMount, onDestroy } from 'svelte';

	let open = $state(false);

	onMount(() => {
		netSpeed.start();
	});

	onDestroy(() => {
		netSpeed.cleanup();
	});

	function sparklinePath(
		values: number[],
		width: number,
		height: number
	): string {
		if (values.length < 2) return '';
		const max = Math.max(...values, 1);
		const step = width / (values.length - 1);
		return values
			.map((v, i) => {
				const x = i * step;
				const y = height - (v / max) * height;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}
</script>

<div class="netspeed-panel">
	<button
		class="netspeed-toggle"
		onclick={() => (open = !open)}
		title="Network speed monitor"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M2 12h4l3-9 4 18 3-9h6" />
		</svg>
		<span class="speed-quick">
			<span class="dl">{formatSpeed($netSpeed.current.downloadBytesPerSec)}</span>
		</span>
	</button>

	{#if open}
		<div class="netspeed-dropdown">
			<div class="dropdown-header">
				<h4>Network Speed</h4>
				<button class="close-btn" onclick={() => (open = false)}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="speed-cards">
				<div class="speed-card download">
					<div class="card-label">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M12 5v14M5 12l7 7 7-7" />
						</svg>
						Download
					</div>
					<div class="card-value">{formatSpeed($netSpeed.current.downloadBytesPerSec)}</div>
				</div>
				<div class="speed-card upload">
					<div class="card-label">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M12 19V5M5 12l7-7 7 7" />
						</svg>
						Upload
					</div>
					<div class="card-value">{formatSpeed($netSpeed.current.uploadBytesPerSec)}</div>
				</div>
			</div>

			{#if $netSpeed.history.length >= 2}
				<div class="sparkline-section">
					<span class="sparkline-label">Download history</span>
					<svg class="sparkline" viewBox="0 0 200 40" preserveAspectRatio="none">
						<path
							d={sparklinePath($netSpeed.history.map((s) => s.downloadBytesPerSec), 200, 40)}
							fill="none"
							stroke="var(--brand-experiment, #5865f2)"
							stroke-width="1.5"
						/>
					</svg>
					<span class="sparkline-label">Upload history</span>
					<svg class="sparkline" viewBox="0 0 200 40" preserveAspectRatio="none">
						<path
							d={sparklinePath($netSpeed.history.map((s) => s.uploadBytesPerSec), 200, 40)}
							fill="none"
							stroke="#43b581"
							stroke-width="1.5"
						/>
					</svg>
				</div>
			{/if}

			<div class="stats-grid">
				<div class="stat">
					<span class="label">Peak Down</span>
					<span class="value">{formatSpeed($netSpeed.peakDownload)}</span>
				</div>
				<div class="stat">
					<span class="label">Peak Up</span>
					<span class="value">{formatSpeed($netSpeed.peakUpload)}</span>
				</div>
				<div class="stat">
					<span class="label">Session Down</span>
					<span class="value">{formatBytes($netSpeed.sessionDownloaded)}</span>
				</div>
				<div class="stat">
					<span class="label">Session Up</span>
					<span class="value">{formatBytes($netSpeed.sessionUploaded)}</span>
				</div>
			</div>

			<button class="reset-btn" onclick={() => netSpeed.reset()}>Reset Stats</button>
		</div>
	{/if}
</div>

<style>
	.netspeed-panel {
		position: relative;
	}

	.netspeed-toggle {
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

	.netspeed-toggle:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-normal, #dcddde);
	}

	.speed-quick .dl {
		font-variant-numeric: tabular-nums;
	}

	.netspeed-dropdown {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 8px;
		width: 260px;
		padding: 12px;
		background: var(--bg-floating, #18191c);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		z-index: 1000;
	}

	.dropdown-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.dropdown-header h4 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted, #8e9297);
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
	}

	.close-btn:hover {
		color: var(--text-normal, #dcddde);
	}

	.speed-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 10px;
	}

	.speed-card {
		padding: 8px;
		border-radius: 6px;
		background: var(--bg-secondary, #2f3136);
	}

	.card-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		text-transform: uppercase;
		color: var(--text-muted, #8e9297);
		margin-bottom: 4px;
	}

	.speed-card.download .card-label {
		color: var(--brand-experiment, #5865f2);
	}

	.speed-card.upload .card-label {
		color: #43b581;
	}

	.card-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
		font-variant-numeric: tabular-nums;
	}

	.sparkline-section {
		margin-bottom: 10px;
	}

	.sparkline-label {
		display: block;
		font-size: 9px;
		text-transform: uppercase;
		color: var(--text-muted, #8e9297);
		margin-bottom: 2px;
		margin-top: 6px;
	}

	.sparkline-label:first-child {
		margin-top: 0;
	}

	.sparkline {
		width: 100%;
		height: 32px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 4px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding-top: 10px;
		border-top: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
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

	.reset-btn {
		width: 100%;
		margin-top: 10px;
		padding: 5px;
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
