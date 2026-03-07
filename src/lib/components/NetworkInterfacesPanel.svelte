<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	interface NetworkInterface {
		name: string;
		ipAddress: string | null;
		macAddress: string | null;
		isUp: boolean;
		interfaceType: string;
		rxBytes: number;
		txBytes: number;
		mtu: number | null;
	}

	interface NetworkInterfacesInfo {
		interfaces: NetworkInterface[];
		timestamp: string;
		hostname: string;
		defaultGateway: string | null;
	}

	let info = $state<NetworkInterfacesInfo | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let autoRefresh = $state(false);
	let intervalId = $state<ReturnType<typeof setInterval> | null>(null);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const val = bytes / Math.pow(1024, i);
		return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
	}

	function typeColor(t: string): string {
		switch (t) {
			case 'ethernet': return '#43b581';
			case 'wifi': return '#5b9bd5';
			case 'loopback': return '#8a8a8a';
			case 'virtual': return '#e8a838';
			default: return '#b0b0b0';
		}
	}

	function typeLabel(t: string): string {
		switch (t) {
			case 'ethernet': return 'ETH';
			case 'wifi': return 'WiFi';
			case 'loopback': return 'LO';
			case 'virtual': return 'VIRT';
			default: return t.toUpperCase();
		}
	}

	async function scan() {
		loading = true;
		error = null;
		try {
			info = await invoke<NetworkInterfacesInfo>('netinterfaces_scan');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			intervalId = setInterval(scan, 5000);
		} else if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	scan();
</script>

<div class="net-panel" class:compact>
	<div class="header">
		<h3>Network Interfaces</h3>
		<div class="controls">
			<button class="btn" onclick={scan} disabled={loading}>
				{loading ? 'Scanning...' : 'Refresh'}
			</button>
			<button class="btn" class:active={autoRefresh} onclick={toggleAutoRefresh}>
				{autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if info}
		<div class="meta">
			<span class="meta-item"><strong>Host:</strong> {info.hostname}</span>
			{#if info.defaultGateway}
				<span class="meta-item"><strong>Gateway:</strong> {info.defaultGateway}</span>
			{/if}
		</div>

		<div class="iface-list">
			{#each info.interfaces as iface}
				<div class="iface-card" class:down={!iface.isUp}>
					<div class="iface-header">
						<span class="iface-name">{iface.name}</span>
						<span class="type-badge" style="background: {typeColor(iface.interfaceType)}">
							{typeLabel(iface.interfaceType)}
						</span>
						<span class="status-dot" class:up={iface.isUp}></span>
						<span class="status-label">{iface.isUp ? 'UP' : 'DOWN'}</span>
					</div>

					<div class="iface-details">
						{#if iface.ipAddress}
							<div class="detail-row">
								<span class="label">IP</span>
								<span class="value">{iface.ipAddress}</span>
							</div>
						{/if}
						{#if iface.macAddress}
							<div class="detail-row">
								<span class="label">MAC</span>
								<span class="value mac">{iface.macAddress}</span>
							</div>
						{/if}
						{#if iface.mtu != null}
							<div class="detail-row">
								<span class="label">MTU</span>
								<span class="value">{iface.mtu}</span>
							</div>
						{/if}
						<div class="traffic">
							<div class="traffic-item rx">
								<span class="arrow">&#x2193;</span> RX {formatBytes(iface.rxBytes)}
							</div>
							<div class="traffic-item tx">
								<span class="arrow">&#x2191;</span> TX {formatBytes(iface.txBytes)}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.net-panel {
		padding: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}

	.header h3 {
		margin: 0;
		font-size: 1.1rem;
	}

	.controls {
		display: flex;
		gap: 6px;
	}

	.btn {
		padding: 4px 10px;
		border: 1px solid var(--text-muted);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.8rem;
	}

	.btn:hover {
		background: var(--bg-tertiary);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.active {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}

	.error {
		padding: 8px 10px;
		background: rgba(220, 60, 60, 0.15);
		border: 1px solid rgba(220, 60, 60, 0.4);
		border-radius: 4px;
		color: #e06060;
		font-size: 0.85rem;
	}

	.meta {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		font-size: 0.85rem;
		color: var(--text-muted);
		padding: 8px 10px;
		background: var(--bg-secondary);
		border-radius: 6px;
	}

	.meta-item strong {
		color: var(--text-primary);
	}

	.iface-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.iface-card {
		background: var(--bg-secondary);
		border: 1px solid var(--bg-tertiary);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.iface-card.down {
		opacity: 0.6;
	}

	.iface-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.iface-name {
		font-weight: 600;
		font-size: 0.95rem;
		font-family: monospace;
	}

	.type-badge {
		padding: 1px 7px;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 700;
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #e06060;
		margin-left: auto;
	}

	.status-dot.up {
		background: var(--success, #43b581);
	}

	.status-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.iface-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.detail-row {
		display: flex;
		gap: 8px;
		font-size: 0.82rem;
	}

	.detail-row .label {
		color: var(--text-muted);
		min-width: 36px;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.detail-row .value {
		font-family: monospace;
		color: var(--text-primary);
	}

	.detail-row .value.mac {
		font-size: 0.78rem;
	}

	.traffic {
		display: flex;
		gap: 16px;
		margin-top: 4px;
		font-size: 0.8rem;
	}

	.traffic-item {
		font-family: monospace;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.traffic-item.rx .arrow {
		color: var(--success, #43b581);
	}

	.traffic-item.tx .arrow {
		color: var(--accent);
	}

	.compact .iface-card {
		padding: 6px 8px;
	}

	.compact .iface-header {
		margin-bottom: 4px;
	}

	.compact .traffic {
		gap: 10px;
	}
</style>
