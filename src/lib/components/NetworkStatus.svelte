<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export let pingEndpoint = '/api/ping';
	export let pingInterval = 30000; // 30 seconds

	type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'poor';

	let state: ConnectionState = 'connecting';
	let latency: number | null = null;
	let lastChecked: Date | null = null;
	let showDetails = false;
	let consecutiveFailures = 0;
	let pingHistory: number[] = [];
	let intervalId: ReturnType<typeof setInterval> | null = null;

	$: avgLatency = pingHistory.length > 0 
		? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length)
		: null;

	$: connectionQuality = getConnectionQuality(latency);
	$: statusColor = getStatusColor(state, latency);
	$: statusText = getStatusText(state, latency);

	function getConnectionQuality(ms: number | null): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
		if (ms === null) return 'unknown';
		if (ms < 50) return 'excellent';
		if (ms < 150) return 'good';
		if (ms < 300) return 'fair';
		return 'poor';
	}

	function getStatusColor(s: ConnectionState, ms: number | null): string {
		if (s === 'disconnected') return '#ed4245';
		if (s === 'connecting') return '#faa61a';
		if (s === 'poor' || (ms !== null && ms > 300)) return '#faa61a';
		return '#3ba55c';
	}

	function getStatusText(s: ConnectionState, ms: number | null): string {
		if (s === 'disconnected') return 'Disconnected';
		if (s === 'connecting') return 'Connecting...';
		if (s === 'poor') return 'Poor Connection';
		if (ms !== null && ms > 300) return 'High Latency';
		return 'Connected';
	}

	async function measureLatency(): Promise<number | null> {
		const start = performance.now();
		try {
			// Use a simple fetch with cache busting
			const response = await fetch(`${pingEndpoint}?_=${Date.now()}`, {
				method: 'HEAD',
				cache: 'no-store',
			});
			
			if (!response.ok) {
				throw new Error('Ping failed');
			}
			
			const end = performance.now();
			return Math.round(end - start);
		} catch {
			return null;
		}
	}

	async function checkConnection() {
		const ping = await measureLatency();
		lastChecked = new Date();

		if (ping === null) {
			consecutiveFailures++;
			if (consecutiveFailures >= 3) {
				state = 'disconnected';
				latency = null;
			} else {
				state = 'connecting';
			}
		} else {
			consecutiveFailures = 0;
			latency = ping;
			
			// Keep last 10 pings for average
			pingHistory = [...pingHistory.slice(-9), ping];
			
			if (ping > 300) {
				state = 'poor';
			} else {
				state = 'connected';
			}
		}
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
		// Initial check
		checkConnection();
		
		// Set up interval
		intervalId = setInterval(checkConnection, pingInterval);
		
		// Also check on online/offline events
		window.addEventListener('online', checkConnection);
		window.addEventListener('offline', () => {
			state = 'disconnected';
			latency = null;
		});
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		window.removeEventListener('online', checkConnection);
		window.removeEventListener('offline', () => {});
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="network-status">
	<button
		class="status-indicator"
		onclick={toggleDetails}
		aria-label="Network status: {statusText}"
		aria-expanded={showDetails}
		type="button"
	>
		<span class="status-dot" style="background-color: {statusColor}">
			{#if state === 'connecting'}
				<span class="pulse" style="background-color: {statusColor}"></span>
			{/if}
		</span>
		{#if latency !== null}
			<span class="latency" class:high={latency > 300} class:medium={latency > 150 && latency <= 300}>
				{latency}ms
			</span>
		{/if}
	</button>

	{#if showDetails}
		<div
			class="details-popup"
			role="dialog"
			aria-label="Network details"
			transition:scale={{ duration: 100, start: 0.95 }}
		>
			<div class="details-header">
				<span class="status-badge" style="background-color: {statusColor}">
					{statusText}
				</span>
			</div>

			<div class="details-content">
				<div class="detail-row">
					<span class="detail-label">Current Latency</span>
					<span class="detail-value">
						{#if latency !== null}
							{latency}ms
						{:else}
							—
						{/if}
					</span>
				</div>

				<div class="detail-row">
					<span class="detail-label">Average Latency</span>
					<span class="detail-value">
						{#if avgLatency !== null}
							{avgLatency}ms
						{:else}
							—
						{/if}
					</span>
				</div>

				<div class="detail-row">
					<span class="detail-label">Connection Quality</span>
					<span class="detail-value quality-{connectionQuality}">
						{connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
					</span>
				</div>

				{#if lastChecked}
					<div class="detail-row">
						<span class="detail-label">Last Checked</span>
						<span class="detail-value">
							{lastChecked.toLocaleTimeString()}
						</span>
					</div>
				{/if}

				{#if pingHistory.length > 1}
					<div class="latency-graph">
						<span class="graph-label">Recent Latency</span>
						<div class="graph-bars">
							{#each pingHistory as ping, i}
								<div
									class="graph-bar"
									style="height: {Math.min((ping / 500) * 100, 100)}%"
									class:high={ping > 300}
									class:medium={ping > 150 && ping <= 300}
									title="{ping}ms"
								></div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<button class="refresh-btn" onclick={checkConnection} type="button">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
				</svg>
				Check Now
			</button>
		</div>
	{/if}
</div>

<style>
	.network-status {
		position: relative;
		display: inline-flex;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.status-indicator:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.status-dot {
		position: relative;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.pulse {
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		opacity: 0.4;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
			opacity: 0.4;
		}
		50% {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	.latency {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
		font-variant-numeric: tabular-nums;
	}

	.latency.medium {
		color: #faa61a;
	}

	.latency.high {
		color: #ed4245;
	}

	.details-popup {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		width: 260px;
		background: var(--bg-floating, #111214);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 16px rgba(0, 0, 0, 0.24);
		overflow: hidden;
		z-index: 1000;
	}

	.details-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.status-badge {
		display: inline-block;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		color: white;
	}

	.details-content {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.detail-label {
		font-size: 13px;
		color: var(--text-muted, #b5bac1);
	}

	.detail-value {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.detail-value.quality-excellent {
		color: #3ba55c;
	}

	.detail-value.quality-good {
		color: #3ba55c;
	}

	.detail-value.quality-fair {
		color: #faa61a;
	}

	.detail-value.quality-poor {
		color: #ed4245;
	}

	.latency-graph {
		margin-top: 8px;
	}

	.graph-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
		margin-bottom: 8px;
	}

	.graph-bars {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 40px;
		padding: 4px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}

	.graph-bar {
		flex: 1;
		min-height: 4px;
		background: #3ba55c;
		border-radius: 2px;
		transition: height 0.2s ease;
	}

	.graph-bar.medium {
		background: #faa61a;
	}

	.graph-bar.high {
		background: #ed4245;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-top: 1px solid var(--bg-modifier-accent, #3f4147);
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.refresh-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		color: var(--text-normal, #f2f3f5);
	}
</style>
