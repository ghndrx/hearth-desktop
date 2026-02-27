<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';

	// Connection states
	type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'offline';

	// Props
	export let compact = false;
	export let showDetails = false;
	export let pingInterval = 5000; // ms between pings

	// State
	let state: ConnectionState = 'connecting';
	let latency = 0;
	let latencyHistory: number[] = [];
	let lastConnected: Date | null = null;
	let reconnectAttempts = 0;
	let maxReconnectAttempts = 5;
	let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
	let activeConnections = 0;
	let detailsExpanded = false;
	let pingIntervalId: ReturnType<typeof setInterval> | null = null;
	let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Derived
	$: averageLatency = latencyHistory.length > 0
		? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
		: 0;
	$: latencyQuality = getLatencyQuality(latency);
	$: statusColor = getStatusColor(state);
	$: statusLabel = getStatusLabel(state);
	$: connectionUptime = lastConnected ? formatUptime(Date.now() - lastConnected.getTime()) : null;

	function getLatencyQuality(ms: number): 'excellent' | 'good' | 'fair' | 'poor' {
		if (ms <= 50) return 'excellent';
		if (ms <= 100) return 'good';
		if (ms <= 200) return 'fair';
		return 'poor';
	}

	function getStatusColor(s: ConnectionState): string {
		switch (s) {
			case 'connected': return '#3ba55c';
			case 'connecting': return '#faa61a';
			case 'reconnecting': return '#faa61a';
			case 'disconnected': return '#ed4245';
			case 'offline': return '#747f8d';
			default: return '#747f8d';
		}
	}

	function getStatusLabel(s: ConnectionState): string {
		switch (s) {
			case 'connected': return 'Connected';
			case 'connecting': return 'Connecting...';
			case 'reconnecting': return `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})`;
			case 'disconnected': return 'Disconnected';
			case 'offline': return 'Offline';
			default: return 'Unknown';
		}
	}

	function getLatencyColor(quality: string): string {
		switch (quality) {
			case 'excellent': return '#3ba55c';
			case 'good': return '#3ba55c';
			case 'fair': return '#faa61a';
			case 'poor': return '#ed4245';
			default: return '#747f8d';
		}
	}

	function formatUptime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	async function measureLatency(): Promise<number> {
		const start = performance.now();
		try {
			// Use Tauri command for accurate backend latency measurement
			await invoke('ping_server');
			return Math.round(performance.now() - start);
		} catch {
			// Fallback: measure round-trip to a simple endpoint
			try {
				const response = await fetch('/api/ping', { 
					method: 'HEAD',
					cache: 'no-store' 
				});
				if (response.ok) {
					return Math.round(performance.now() - start);
				}
			} catch {
				// Unable to measure
			}
			return -1;
		}
	}

	async function checkConnection() {
		if (!isOnline) {
			state = 'offline';
			return;
		}

		const measuredLatency = await measureLatency();

		if (measuredLatency >= 0) {
			latency = measuredLatency;
			latencyHistory = [...latencyHistory.slice(-19), measuredLatency];
			
			if (state !== 'connected') {
				state = 'connected';
				lastConnected = new Date();
				reconnectAttempts = 0;
			}
		} else {
			// Connection failed
			if (state === 'connected') {
				state = 'reconnecting';
				reconnectAttempts = 1;
				scheduleReconnect();
			} else if (state === 'reconnecting') {
				reconnectAttempts++;
				if (reconnectAttempts >= maxReconnectAttempts) {
					state = 'disconnected';
				} else {
					scheduleReconnect();
				}
			}
		}
	}

	function scheduleReconnect() {
		if (reconnectTimeoutId) {
			clearTimeout(reconnectTimeoutId);
		}
		// Exponential backoff: 1s, 2s, 4s, 8s, etc.
		const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
		reconnectTimeoutId = setTimeout(checkConnection, delay);
	}

	function handleOnline() {
		isOnline = true;
		state = 'reconnecting';
		reconnectAttempts = 0;
		checkConnection();
	}

	function handleOffline() {
		isOnline = false;
		state = 'offline';
	}

	function toggleDetails() {
		detailsExpanded = !detailsExpanded;
	}

	function reconnectNow() {
		state = 'reconnecting';
		reconnectAttempts = 0;
		checkConnection();
	}

	onMount(() => {
		// Initial connection check
		checkConnection();

		// Regular ping interval
		pingIntervalId = setInterval(checkConnection, pingInterval);

		// Network status listeners
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		// Listen for custom connection events from the app
		window.addEventListener('hearth:ws-connected', () => {
			activeConnections++;
		});
		window.addEventListener('hearth:ws-disconnected', () => {
			activeConnections = Math.max(0, activeConnections - 1);
		});
	});

	onDestroy(() => {
		if (pingIntervalId) {
			clearInterval(pingIntervalId);
		}
		if (reconnectTimeoutId) {
			clearTimeout(reconnectTimeoutId);
		}
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	});
</script>

<div 
	class="connection-indicator" 
	class:compact 
	class:showDetails
	role="status"
	aria-label="Connection status: {statusLabel}"
>
	<button
		class="indicator-button"
		on:click={toggleDetails}
		aria-expanded={detailsExpanded}
		aria-controls="connection-details"
		type="button"
	>
		<!-- Status dot with pulse animation when connecting -->
		<div class="status-dot" style="background-color: {statusColor}">
			{#if state === 'connecting' || state === 'reconnecting'}
				<div class="pulse-ring" style="border-color: {statusColor}"></div>
			{/if}
		</div>

		{#if !compact}
			<span class="status-text">
				{#if state === 'connected'}
					<span class="latency" style="color: {getLatencyColor(latencyQuality)}">
						{latency}ms
					</span>
				{:else}
					<span class="state-label" style="color: {statusColor}">
						{statusLabel}
					</span>
				{/if}
			</span>
		{/if}

		<!-- Connection quality bars -->
		{#if state === 'connected' && !compact}
			<div class="quality-bars" title="Connection quality: {latencyQuality}">
				<div class="bar" class:active={latency <= 200}></div>
				<div class="bar" class:active={latency <= 100}></div>
				<div class="bar" class:active={latency <= 50}></div>
			</div>
		{/if}
	</button>

	{#if detailsExpanded}
		<div 
			id="connection-details"
			class="details-panel"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="panel-header">
				<h3>Connection Status</h3>
				<div 
					class="status-badge"
					style="background-color: {statusColor}20; color: {statusColor}"
				>
					{statusLabel}
				</div>
			</div>

			<div class="details-content">
				{#if state === 'connected'}
					<!-- Latency section -->
					<div class="detail-row">
						<span class="detail-label">Latency</span>
						<span class="detail-value" style="color: {getLatencyColor(latencyQuality)}">
							{latency}ms
							<span class="quality-tag">{latencyQuality}</span>
						</span>
					</div>

					<div class="detail-row">
						<span class="detail-label">Avg Latency</span>
						<span class="detail-value">{averageLatency}ms</span>
					</div>

					<!-- Latency graph -->
					{#if latencyHistory.length > 1}
						<div class="latency-graph">
							<div class="graph-label">Latency History</div>
							<div class="graph-container">
								{#each latencyHistory as ping, i}
									<div 
										class="graph-bar"
										style="height: {Math.min((ping / 300) * 100, 100)}%; 
											   background-color: {getLatencyColor(getLatencyQuality(ping))}"
										title="{ping}ms"
									></div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="detail-row">
						<span class="detail-label">Uptime</span>
						<span class="detail-value">
							{connectionUptime ?? '—'}
						</span>
					</div>

					<div class="detail-row">
						<span class="detail-label">Active Sockets</span>
						<span class="detail-value">{activeConnections}</span>
					</div>

				{:else if state === 'reconnecting'}
					<div class="reconnect-info">
						<div class="spinner"></div>
						<p>Attempting to reconnect...</p>
						<p class="attempt-count">
							Attempt {reconnectAttempts} of {maxReconnectAttempts}
						</p>
					</div>

				{:else if state === 'disconnected'}
					<div class="disconnected-info">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
						</svg>
						<p>Connection lost</p>
						<button class="reconnect-btn" on:click={reconnectNow} type="button">
							<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
								<path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
							</svg>
							Reconnect
						</button>
					</div>

				{:else if state === 'offline'}
					<div class="offline-info">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 1l22 22M9 9v3a3 3 0 002.12.88M9 9H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-1M9 9L3 3"/>
						</svg>
						<p>You're offline</p>
						<p class="offline-hint">
							Check your network connection
						</p>
					</div>
				{/if}
			</div>

			<!-- Last connected timestamp -->
			{#if lastConnected && state !== 'connected'}
				<div class="last-connected">
					Last connected: {lastConnected.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.connection-indicator {
		position: relative;
		display: inline-flex;
	}

	.indicator-button {
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

	.indicator-button:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.compact .indicator-button {
		padding: 4px 6px;
	}

	/* Status dot */
	.status-dot {
		position: relative;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.pulse-ring {
		position: absolute;
		top: -3px;
		left: -3px;
		width: 16px;
		height: 16px;
		border: 2px solid;
		border-radius: 50%;
		opacity: 0;
		animation: pulse-out 1.5s ease-out infinite;
	}

	@keyframes pulse-out {
		0% {
			opacity: 0.6;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.8);
		}
	}

	/* Status text */
	.status-text {
		font-size: 12px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.latency {
		font-weight: 600;
	}

	.state-label {
		font-weight: 500;
	}

	/* Quality bars */
	.quality-bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 12px;
	}

	.bar {
		width: 3px;
		background: var(--bg-modifier-accent, #3f4147);
		border-radius: 1px;
		transition: background-color 0.2s ease;
	}

	.bar:nth-child(1) { height: 4px; }
	.bar:nth-child(2) { height: 8px; }
	.bar:nth-child(3) { height: 12px; }

	.bar.active {
		background: #3ba55c;
	}

	/* Details panel */
	.details-panel {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		width: 280px;
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

	.status-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 4px;
	}

	.details-content {
		padding: 12px 16px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.detail-value {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		font-variant-numeric: tabular-nums;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.quality-tag {
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
		padding: 2px 5px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	/* Latency graph */
	.latency-graph {
		padding: 12px 0;
	}

	.graph-label {
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		margin-bottom: 8px;
	}

	.graph-container {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 32px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		padding: 4px;
	}

	.graph-bar {
		flex: 1;
		min-height: 2px;
		border-radius: 1px;
		transition: height 0.2s ease;
	}

	/* Reconnecting state */
	.reconnect-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		text-align: center;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--bg-modifier-accent, #3f4147);
		border-top-color: #faa61a;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 12px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.reconnect-info p {
		margin: 0;
		font-size: 13px;
		color: var(--text-normal, #f2f3f5);
	}

	.attempt-count {
		margin-top: 4px !important;
		font-size: 12px !important;
		color: var(--text-muted, #b5bac1) !important;
	}

	/* Disconnected state */
	.disconnected-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		text-align: center;
		color: #ed4245;
	}

	.disconnected-info svg {
		width: 32px;
		height: 32px;
		margin-bottom: 12px;
	}

	.disconnected-info p {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
	}

	.reconnect-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
		padding: 8px 16px;
		background: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 6px;
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.reconnect-btn:hover {
		background: var(--brand-primary-hover, #4752c4);
	}

	/* Offline state */
	.offline-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		text-align: center;
		color: #747f8d;
	}

	.offline-info svg {
		width: 32px;
		height: 32px;
		margin-bottom: 12px;
	}

	.offline-info p {
		margin: 0;
		font-size: 14px;
	}

	.offline-hint {
		margin-top: 4px !important;
		font-size: 12px !important;
		opacity: 0.7;
	}

	/* Last connected footer */
	.last-connected {
		padding: 10px 16px;
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		background: var(--bg-secondary, #2b2d31);
		text-align: center;
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.pulse-ring,
		.spinner {
			animation: none;
		}
		
		.pulse-ring {
			opacity: 0.3;
		}
	}

	/* Light theme */
	:global(.theme-light) .details-panel {
		background: var(--bg-floating, #fff);
	}

	:global(.theme-light) .graph-container {
		background: var(--bg-secondary, #f2f3f5);
	}
</style>
</script>
