<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getVoiceConnectionManager } from '$lib/voice';
	import { P2PConnectionDiagnostics } from '$lib/voice/P2PConnectionDiagnostics';
	import type { NetworkQuality, ConnectionStats } from '$lib/voice/P2PConnectionDiagnostics';

	export let userId: string = '';
	export let showDetails: boolean = false;
	export let compact: boolean = false;

	let diagnostics: P2PConnectionDiagnostics | null = null;
	let connectionStats: ConnectionStats | null = null;
	let networkQuality: NetworkQuality | null = null;
	let isConnected = false;
	let lastUpdate = 0;

	// Cleanup functions
	let cleanupFunctions: Array<() => void> = [];

	onMount(() => {
		const voiceManager = getVoiceConnectionManager();
		const webrtcManager = voiceManager.getWebRTCManager();

		diagnostics = new P2PConnectionDiagnostics(webrtcManager);
		diagnostics.startMonitoring();

		// Listen for stats updates
		cleanupFunctions.push(
			diagnostics.on('stats-update', (statsUserId: string, stats: ConnectionStats) => {
				if (userId && statsUserId === userId) {
					connectionStats = stats;
					lastUpdate = Date.now();
				}
			})
		);

		// Listen for quality updates
		cleanupFunctions.push(
			diagnostics.on('connection-quality', (qualityUserId: string, quality: NetworkQuality) => {
				if (userId && qualityUserId === userId) {
					networkQuality = quality;
				}
			})
		);

		// Listen for connection state changes
		cleanupFunctions.push(
			webrtcManager.on('connection-state-changed', (state: RTCPeerConnectionState, connectedUserId: string) => {
				if (userId && connectedUserId === userId) {
					isConnected = state === 'connected';
				}
			})
		);

		// Initial data fetch
		if (userId) {
			connectionStats = diagnostics.getConnectionStats(userId);
			networkQuality = diagnostics.getNetworkQuality(userId);
			const peer = webrtcManager.getPeer(userId);
			isConnected = peer?.connectionState === 'connected';
		}
	});

	onDestroy(() => {
		cleanupFunctions.forEach(fn => fn());
		cleanupFunctions = [];

		if (diagnostics) {
			diagnostics.destroy();
			diagnostics = null;
		}
	});

	function getConnectionStateColor(state: RTCPeerConnectionState): string {
		switch (state) {
			case 'connected':
				return '#00d26a';
			case 'connecting':
				return '#faa61a';
			case 'disconnected':
				return '#f04747';
			case 'failed':
				return '#ed4245';
			default:
				return '#747f8d';
		}
	}

	function getQualityColor(quality: NetworkQuality['rating']): string {
		switch (quality) {
			case 'excellent':
				return '#00d26a';
			case 'good':
				return '#43b581';
			case 'poor':
				return '#faa61a';
			case 'very-poor':
				return '#f04747';
			default:
				return '#747f8d';
		}
	}

	function getQualityIcon(quality: NetworkQuality['rating']): string {
		switch (quality) {
			case 'excellent':
				return '🟢';
			case 'good':
				return '🟡';
			case 'poor':
				return '🟠';
			case 'very-poor':
				return '🔴';
			default:
				return '⚪';
		}
	}

	function formatLatency(ms: number): string {
		return `${Math.round(ms)}ms`;
	}

	function formatBandwidth(kbps: number): string {
		if (kbps >= 1000) {
			return `${(kbps / 1000).toFixed(1)} Mbps`;
		}
		return `${Math.round(kbps)} kbps`;
	}

	function formatPacketLoss(percentage: number): string {
		return `${percentage.toFixed(1)}%`;
	}

	async function runDiagnostics() {
		if (!diagnostics || !userId) return;

		try {
			const results = await diagnostics.runDiagnostics(userId);
			console.log('[P2P Connection] Diagnostic results:', results);

			// Show results in a modal or notification
			// This would typically trigger a custom event or update a store
		} catch (error) {
			console.error('[P2P Connection] Failed to run diagnostics:', error);
		}
	}

	$: timeSinceUpdate = lastUpdate > 0 ? Date.now() - lastUpdate : 0;
	$: isStale = timeSinceUpdate > 5000; // Data is stale after 5 seconds
</script>

{#if compact}
	<!-- Compact view for sidebar or small spaces -->
	<div class="p2p-status-compact" class:connected={isConnected}>
		<div class="status-indicator">
			<div
				class="status-dot"
				style="background-color: {connectionStats ? getConnectionStateColor(connectionStats.connectionState) : '#747f8d'}"
			></div>
		</div>

		{#if networkQuality}
			<span class="quality-indicator" title="Connection Quality: {networkQuality.rating}">
				{getQualityIcon(networkQuality.rating)}
			</span>
		{/if}

		{#if showDetails && networkQuality}
			<div class="compact-details">
				<span class="latency">{formatLatency(networkQuality.latency)}</span>
			</div>
		{/if}
	</div>
{:else}
	<!-- Full view for detailed connection information -->
	<div class="p2p-status-full">
		<div class="status-header">
			<h3>P2P Connection Status</h3>
			{#if userId}
				<span class="user-id">User: {userId}</span>
			{/if}
			<button class="diagnostics-btn" on:click={runDiagnostics} title="Run Connection Diagnostics">
				🔍
			</button>
		</div>

		<div class="status-grid">
			<!-- Connection State -->
			<div class="status-item">
				<div class="status-label">Connection</div>
				<div class="status-value" class:stale={isStale}>
					{#if connectionStats}
						<span
							class="connection-state"
							style="color: {getConnectionStateColor(connectionStats.connectionState)}"
						>
							{connectionStats.connectionState}
						</span>
					{:else}
						<span class="no-data">No data</span>
					{/if}
				</div>
			</div>

			<!-- ICE Connection State -->
			{#if connectionStats}
				<div class="status-item">
					<div class="status-label">ICE State</div>
					<div class="status-value" class:stale={isStale}>
						<span class="ice-state">
							{connectionStats.iceConnectionState}
						</span>
					</div>
				</div>
			{/if}

			<!-- Network Quality -->
			{#if networkQuality}
				<div class="status-item">
					<div class="status-label">Quality</div>
					<div class="status-value">
						<span
							class="quality-rating"
							style="color: {getQualityColor(networkQuality.rating)}"
						>
							{getQualityIcon(networkQuality.rating)} {networkQuality.rating}
						</span>
						<span class="quality-score">({networkQuality.score}/100)</span>
					</div>
				</div>

				<!-- Network Metrics -->
				<div class="status-item">
					<div class="status-label">Latency</div>
					<div class="status-value">
						<span class="metric-value" class:warning={networkQuality.latency > 150}>
							{formatLatency(networkQuality.latency)}
						</span>
					</div>
				</div>

				<div class="status-item">
					<div class="status-label">Packet Loss</div>
					<div class="status-value">
						<span class="metric-value" class:warning={networkQuality.packetLoss > 2}>
							{formatPacketLoss(networkQuality.packetLoss)}
						</span>
					</div>
				</div>

				<div class="status-item">
					<div class="status-label">Jitter</div>
					<div class="status-value">
						<span class="metric-value" class:warning={networkQuality.jitter > 30}>
							{formatLatency(networkQuality.jitter)}
						</span>
					</div>
				</div>

				<div class="status-item">
					<div class="status-label">Bandwidth</div>
					<div class="status-value">
						<span class="metric-value">
							{formatBandwidth(networkQuality.bandwidth)}
						</span>
					</div>
				</div>
			{/if}

			<!-- Data Transfer Stats -->
			{#if connectionStats}
				<div class="status-item">
					<div class="status-label">Sent</div>
					<div class="status-value">
						<span class="transfer-stat">
							{connectionStats.packetsSent} packets
						</span>
					</div>
				</div>

				<div class="status-item">
					<div class="status-label">Received</div>
					<div class="status-value">
						<span class="transfer-stat">
							{connectionStats.packetsReceived} packets
						</span>
					</div>
				</div>

				{#if connectionStats.packetsLost > 0}
					<div class="status-item">
						<div class="status-label">Lost</div>
						<div class="status-value">
							<span class="transfer-stat warning">
								{connectionStats.packetsLost} packets
							</span>
						</div>
					</div>
				{/if}

				<!-- Audio Level -->
				{#if connectionStats.audioLevel > 0}
					<div class="status-item">
						<div class="status-label">Audio Level</div>
						<div class="status-value">
							<div class="audio-level-bar">
								<div
									class="audio-level-fill"
									style="width: {Math.min(connectionStats.audioLevel * 100, 100)}%"
								></div>
							</div>
							<span class="audio-level-text">
								{Math.round(connectionStats.audioLevel * 100)}%
							</span>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		{#if isStale}
			<div class="stale-warning">
				⚠️ Connection data is stale. Last update: {Math.round(timeSinceUpdate / 1000)}s ago
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Compact View Styles */
	.p2p-status-compact {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: 4px;
		font-size: 12px;
	}

	.status-indicator {
		display: flex;
		align-items: center;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: #747f8d;
		transition: background-color 0.2s;
	}

	.quality-indicator {
		font-size: 14px;
	}

	.compact-details {
		display: flex;
		gap: 6px;
		color: #b9bbbe;
		font-size: 11px;
	}

	.latency {
		color: #b9bbbe;
	}

	/* Full View Styles */
	.p2p-status-full {
		background: #2f3136;
		border-radius: 8px;
		padding: 16px;
		border: 1px solid #40444b;
		color: #dcddde;
	}

	.status-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		border-bottom: 1px solid #40444b;
		padding-bottom: 8px;
	}

	.status-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #ffffff;
	}

	.user-id {
		font-size: 12px;
		color: #72767d;
		font-family: 'Roboto Mono', monospace;
	}

	.diagnostics-btn {
		background: #5865f2;
		border: none;
		border-radius: 4px;
		padding: 6px 10px;
		color: #ffffff;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.2s;
	}

	.diagnostics-btn:hover {
		background: #4752c4;
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.status-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.status-label {
		font-size: 12px;
		font-weight: 500;
		color: #b9bbbe;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-value {
		font-size: 14px;
		color: #dcddde;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-value.stale {
		opacity: 0.6;
	}

	.connection-state {
		font-weight: 600;
		text-transform: capitalize;
	}

	.ice-state {
		color: #b9bbbe;
		text-transform: capitalize;
	}

	.quality-rating {
		font-weight: 600;
		text-transform: capitalize;
	}

	.quality-score {
		color: #72767d;
		font-size: 12px;
	}

	.metric-value {
		font-family: 'Roboto Mono', monospace;
		font-weight: 500;
	}

	.metric-value.warning {
		color: #faa61a;
	}

	.transfer-stat {
		font-family: 'Roboto Mono', monospace;
		font-size: 13px;
	}

	.transfer-stat.warning {
		color: #f04747;
	}

	.no-data {
		color: #72767d;
		font-style: italic;
	}

	/* Audio Level Bar */
	.audio-level-bar {
		width: 60px;
		height: 4px;
		background: #40444b;
		border-radius: 2px;
		overflow: hidden;
	}

	.audio-level-fill {
		height: 100%;
		background: linear-gradient(90deg, #43b581 0%, #faa61a 70%, #f04747 100%);
		transition: width 0.1s;
	}

	.audio-level-text {
		font-size: 11px;
		color: #b9bbbe;
		font-family: 'Roboto Mono', monospace;
	}

	/* Stale Warning */
	.stale-warning {
		margin-top: 12px;
		padding: 8px 12px;
		background: rgba(250, 166, 26, 0.1);
		border: 1px solid rgba(250, 166, 26, 0.3);
		border-radius: 4px;
		color: #faa61a;
		font-size: 12px;
		text-align: center;
	}

	/* Connected state indicator */
	.p2p-status-compact.connected {
		background: rgba(0, 210, 106, 0.1);
		border: 1px solid rgba(0, 210, 106, 0.3);
	}
</style>