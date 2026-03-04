<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { fade, slide } from 'svelte/transition';

	// Types matching Rust definitions
	type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'degraded' | 'reconnecting';
	type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

	interface ConnectionStats {
		state: ConnectionState;
		quality: ConnectionQuality;
		latency_ms: number;
		avg_latency_ms: number;
		last_ping_at: string | null;
		connected_since: string | null;
		reconnect_attempts: number;
		packets_sent: number;
		packets_received: number;
		packets_lost: number;
	}

	// Props
	interface Props {
		compact?: boolean;
		showDetails?: boolean;
		onStateChange?: (state: ConnectionState) => void;
	}

	let { compact = false, showDetails = false, onStateChange }: Props = $props();

	// State
	let stats = $state<ConnectionStats>({
		state: 'disconnected',
		quality: 'unknown',
		latency_ms: 0,
		avg_latency_ms: 0,
		last_ping_at: null,
		connected_since: null,
		reconnect_attempts: 0,
		packets_sent: 0,
		packets_received: 0,
		packets_lost: 0
	});
	let isMonitoring = $state(false);
	let autoReconnect = $state(true);
	let isReconnecting = $state(false);
	let expanded = $state(false);
	let unlistenStatus: UnlistenFn | null = null;
	let unlistenReconnecting: UnlistenFn | null = null;

	// Icons based on state
	const stateIcons: Record<ConnectionState, string> = {
		connected: '✓',
		connecting: '⟳',
		disconnected: '✕',
		degraded: '⚠',
		reconnecting: '↻'
	};

	const qualityIcons: Record<ConnectionQuality, string> = {
		excellent: '🟢',
		good: '🟢',
		fair: '🟡',
		poor: '🔴',
		unknown: '⚪'
	};

	// Colors based on state
	const stateColors: Record<ConnectionState, string> = {
		connected: 'var(--green-500, #51cf66)',
		connecting: 'var(--yellow-500, #fcc419)',
		disconnected: 'var(--red-500, #fa5252)',
		degraded: 'var(--orange-500, #ff922b)',
		reconnecting: 'var(--blue-500, #339af0)'
	};

	onMount(async () => {
		await loadStats();
		await setupEventListeners();
		// Auto-start monitoring if not already active
		if (!isMonitoring) {
			await startMonitoring();
		}
	});

	onDestroy(() => {
		unlistenStatus?.();
		unlistenReconnecting?.();
	});

	async function setupEventListeners() {
		unlistenStatus = await listen<ConnectionStats>('connection:status-update', (event) => {
			stats = event.payload;
			onStateChange?.(stats.state);
		});

		unlistenReconnecting = await listen<number>('connection:reconnecting', (event) => {
			isReconnecting = true;
			stats.reconnect_attempts = event.payload;
		});
	}

	async function loadStats() {
		try {
			stats = await invoke('connection_get_stats');
		} catch (e) {
			console.error('Failed to load connection stats:', e);
		}
	}

	async function startMonitoring() {
		try {
			await invoke('connection_start_monitoring');
			isMonitoring = true;
		} catch (e) {
			console.error('Failed to start monitoring:', e);
		}
	}

	async function stopMonitoring() {
		try {
			await invoke('connection_stop_monitoring');
			isMonitoring = false;
		} catch (e) {
			console.error('Failed to stop monitoring:', e);
		}
	}

	async function reconnect() {
		try {
			isReconnecting = true;
			await invoke('connection_reconnect');
		} catch (e) {
			console.error('Failed to reconnect:', e);
			isReconnecting = false;
		}
	}

	async function toggleAutoReconnect() {
		try {
			autoReconnect = !autoReconnect;
			await invoke('connection_set_auto_reconnect', { enabled: autoReconnect });
		} catch (e) {
			console.error('Failed to set auto-reconnect:', e);
			autoReconnect = !autoReconnect; // Revert on error
		}
	}

	async function resetStats() {
		try {
			await invoke('connection_reset');
			await loadStats();
		} catch (e) {
			console.error('Failed to reset stats:', e);
		}
	}

	function formatDuration(durationStr: string | null): string {
		if (!durationStr) return '—';
		// Parse duration like "123.456ms" or "2.345s"
		return durationStr.replace(' ', '');
	}

	function getStateLabel(state: ConnectionState): string {
		const labels: Record<ConnectionState, string> = {
			connected: 'Connected',
			connecting: 'Connecting...',
			disconnected: 'Disconnected',
			degraded: 'Degraded',
			reconnecting: 'Reconnecting...'
		};
		return labels[state];
	}

	function getQualityLabel(quality: ConnectionQuality): string {
		const labels: Record<ConnectionQuality, string> = {
			excellent: 'Excellent',
			good: 'Good',
			fair: 'Fair',
			poor: 'Poor',
			unknown: 'Unknown'
		};
		return labels[quality];
	}

	// Derived state
	let isHealthy = $derived(stats.state === 'connected');
	let isProblematic = $derived(stats.state === 'degraded' || stats.state === 'disconnected');
	let packetLoss = $derived(stats.packets_sent > 0 
		? ((stats.packets_lost / stats.packets_sent) * 100).toFixed(1)
		: '0.0');
</script>

{#if compact}
	<!-- Compact Mode - Just the status indicator -->
	<button 
		class="connection-indicator compact"
		class:healthy={isHealthy}
		class:problematic={isProblematic}
		class:reconnecting={stats.state === 'reconnecting'}
		on:click={() => expanded = !expanded}
		title="Connection: {getStateLabel(stats.state)}"
	>
		<span class="status-dot" style="background-color: {stateColors[stats.state]}"></span>
		{#if stats.latency_ms > 0 && isHealthy}
			<span class="latency">{stats.latency_ms}ms</span>
		{/if}
	</button>
{:else}
	<!-- Full Mode -->
	<div class="connection-status-panel" class:expanded>
		<!-- Header -->
		<button class="header" on:click={() => expanded = !expanded}>
			<div class="header-main">
				<span 
					class="status-icon"
					style="color: {stateColors[stats.state]}"
				>
					{stateIcons[stats.state]}
				</span>
				<div class="header-info">
					<span class="state-label">{getStateLabel(stats.state)}</span>
					{#if isHealthy && stats.latency_ms > 0}
						<span class="latency-badge">
							{qualityIcons[stats.quality]} {stats.latency_ms}ms
						</span>
					{/if}
				</div>
			</div>
			<svg 
				class="expand-icon"
				class:expanded
				viewBox="0 0 24 24" 
				fill="none" 
				stroke="currentColor" 
				stroke-width="2"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</button>

		{#if expanded}
			<div class="details" transition:slide={{ duration: 200 }}>
				<!-- Quality Indicator -->
				<div class="quality-bar">
					<div class="quality-label">Connection Quality</div>
					<div class="quality-value">
						<span>{qualityIcons[stats.quality]}</span>
						<span>{getQualityLabel(stats.quality)}</span>
					</div>
				</div>

				<!-- Stats Grid -->
				<div class="stats-grid">
					<div class="stat">
						<span class="stat-label">Avg Latency</span>
						<span class="stat-value">{stats.avg_latency_ms}ms</span>
					</div>
					<div class="stat">
						<span class="stat-label">Packet Loss</span>
						<span class="stat-value" class:bad={parseFloat(packetLoss) > 5}>
							{packetLoss}%
						</span>
					</div>
					<div class="stat">
						<span class="stat-label">Packets</span>
						<span class="stat-value">{stats.packets_received}/{stats.packets_sent}</span>
					</div>
					{#if stats.reconnect_attempts > 0}
						<div class="stat">
							<span class="stat-label">Reconnects</span>
							<span class="stat-value" class:warning={stats.reconnect_attempts > 3}>
								{stats.reconnect_attempts}
							</span>
						</div>
					{/if}
				</div>

				<!-- Connected Duration -->
				{#if stats.connected_since}
					<div class="duration-info">
						<span class="duration-label">Connected for</span>
						<span class="duration-value">{formatDuration(stats.connected_since)}</span>
					</div>
				{/if}

				<!-- Actions -->
				<div class="actions">
					{#if isProblematic}
						<button 
							class="action-btn primary"
							on:click={reconnect}
							disabled={isReconnecting}
						>
							{#if isReconnecting}
								<span class="spinner"></span>
								Reconnecting...
							{:else}
								↻ Reconnect Now
							{/if}
						</button>
					{/if}

					<label class="toggle-label">
						<input 
							type="checkbox" 
							checked={autoReconnect}
							on:change={toggleAutoReconnect}
						/>
						<span>Auto-reconnect</span>
					</label>

					<button class="action-btn secondary" on:click={resetStats}>
						Reset Stats
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.connection-indicator.compact {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--bg-secondary, #25262b);
		border: 1px solid var(--border-color, #2c2e33);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 12px;
		color: var(--text-secondary, #a6a7ab);
	}

	.connection-indicator.compact:hover {
		background: var(--bg-hover, #2c2e33);
	}

	.connection-indicator.compact.healthy {
		border-color: var(--green-500, #51cf66);
	}

	.connection-indicator.compact.problematic {
		border-color: var(--red-500, #fa5252);
	}

	.connection-indicator.compact.reconnecting {
		animation: pulse 1.5s ease-in-out infinite;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transition: background-color 0.3s ease;
	}

	.latency {
		font-weight: 500;
	}

	/* Full Panel Styles */
	.connection-status-panel {
		background: var(--bg-secondary, #25262b);
		border: 1px solid var(--border-color, #2c2e33);
		border-radius: 12px;
		overflow: hidden;
		min-width: 280px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 12px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: inherit;
		font: inherit;
		text-align: left;
	}

	.header:hover {
		background: var(--bg-hover, #2c2e33);
	}

	.header-main {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.status-icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: bold;
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.state-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #ffffff);
	}

	.latency-badge {
		font-size: 12px;
		color: var(--text-muted, #909296);
	}

	.expand-icon {
		width: 16px;
		height: 16px;
		transition: transform 0.2s ease;
		color: var(--text-muted, #909296);
	}

	.expand-icon.expanded {
		transform: rotate(180deg);
	}

	.details {
		padding: 0 16px 16px;
		border-top: 1px solid var(--border-color, #2c2e33);
	}

	.quality-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
	}

	.quality-label {
		font-size: 13px;
		color: var(--text-muted, #909296);
	}

	.quality-value {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary, #ffffff);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		padding: 12px 0;
		border-top: 1px solid var(--border-color, #2c2e33);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		background: var(--bg-tertiary, #2c2e33);
		border-radius: 8px;
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-muted, #909296);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-value {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #ffffff);
	}

	.stat-value.bad {
		color: var(--red-500, #fa5252);
	}

	.stat-value.warning {
		color: var(--yellow-500, #fcc419);
	}

	.duration-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-top: 1px solid var(--border-color, #2c2e33);
		font-size: 13px;
	}

	.duration-label {
		color: var(--text-muted, #909296);
	}

	.duration-value {
		color: var(--text-primary, #ffffff);
		font-weight: 500;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color, #2c2e33);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.action-btn.primary {
		background: var(--accent-primary, #5865f2);
		color: white;
	}

	.action-btn.primary:hover:not(:disabled) {
		background: var(--accent-hover, #4752c4);
	}

	.action-btn.secondary {
		background: var(--bg-tertiary, #2c2e33);
		color: var(--text-primary, #ffffff);
	}

	.action-btn.secondary:hover {
		background: var(--bg-hover, #373a40);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		font-size: 13px;
		color: var(--text-secondary, #a6a7ab);
		cursor: pointer;
	}

	.toggle-label input {
		cursor: pointer;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}
</style>
