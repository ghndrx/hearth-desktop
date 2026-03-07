<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface PortResult {
		port: number;
		open: boolean;
		service: string;
		latencyMs: number;
	}

	interface ScanResult {
		host: string;
		ports: PortResult[];
		openCount: number;
		scannedCount: number;
		durationMs: number;
	}

	let host = $state('127.0.0.1');
	let customPorts = $state('');
	let scanning = $state(false);
	let result: ScanResult | null = $state(null);
	let error: string | null = $state(null);
	let singlePort = $state('');
	let singleResult: PortResult | null = $state(null);

	async function runScan() {
		scanning = true;
		error = null;
		try {
			const ports = customPorts.trim()
				? customPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535)
				: undefined;

			result = await invoke<ScanResult>('portscan_scan', {
				host: host || undefined,
				ports,
				timeoutMs: 200
			});
		} catch (e) {
			error = String(e);
		} finally {
			scanning = false;
		}
	}

	async function checkSinglePort() {
		const port = parseInt(singlePort);
		if (isNaN(port) || port < 1 || port > 65535) return;
		error = null;
		try {
			singleResult = await invoke<PortResult>('portscan_check_port', {
				host: host || undefined,
				port,
				timeoutMs: 500
			});
		} catch (e) {
			error = String(e);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') checkSinglePort();
	}
</script>

<div class="scanner-panel">
	<div class="panel-header">
		<h3>Port Scanner</h3>
	</div>

	<div class="controls">
		<div class="input-group">
			<label for="host-input">Host</label>
			<input id="host-input" type="text" bind:value={host} placeholder="127.0.0.1" />
		</div>
		<div class="input-group">
			<label for="ports-input">Ports (comma-separated, or leave empty for common)</label>
			<input id="ports-input" type="text" bind:value={customPorts} placeholder="80, 443, 3000, 8080" />
		</div>
		<button class="scan-btn" onclick={runScan} disabled={scanning}>
			{scanning ? 'Scanning...' : 'Scan Ports'}
		</button>
	</div>

	<div class="quick-check">
		<span class="quick-label">Quick check:</span>
		<input
			type="text"
			bind:value={singlePort}
			placeholder="Port #"
			class="port-input"
			onkeydown={handleKeydown}
		/>
		<button class="check-btn" onclick={checkSinglePort}>Check</button>
		{#if singleResult}
			<span class="quick-result" class:open={singleResult.open} class:closed={!singleResult.open}>
				:{singleResult.port} {singleResult.open ? 'OPEN' : 'CLOSED'}
				{singleResult.service ? `(${singleResult.service})` : ''}
			</span>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if result}
		<div class="results-header">
			<span>{result.openCount} open / {result.scannedCount} scanned</span>
			<span class="scan-time">{result.durationMs}ms</span>
		</div>

		<div class="port-grid">
			{#each result.ports as port}
				<div class="port-card" class:open={port.open} class:closed={!port.open}>
					<span class="port-number">:{port.port}</span>
					<span class="port-status">{port.open ? 'OPEN' : 'CLOSED'}</span>
					{#if port.service}
						<span class="port-service">{port.service}</span>
					{/if}
					{#if port.open}
						<span class="port-latency">{port.latencyMs}ms</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.scanner-panel {
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

	.controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--bg-secondary, #2b2d31);
		padding: 12px;
		border-radius: 8px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.input-group label {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.input-group input {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 6px 10px;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		outline: none;
	}

	.input-group input:focus {
		border-color: #5865f2;
	}

	.scan-btn {
		padding: 8px 16px;
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		transition: background 0.15s;
	}

	.scan-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.scan-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.quick-check {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.quick-label {
		color: var(--text-muted, #949ba4);
	}

	.port-input {
		width: 70px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 4px 8px;
		color: var(--text-normal, #dbdee1);
		font-size: 12px;
		outline: none;
	}

	.check-btn {
		padding: 4px 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #dbdee1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.quick-result {
		font-weight: 600;
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
	}

	.quick-result.open {
		color: #43b581;
	}

	.quick-result.closed {
		color: #f04747;
	}

	.error-msg {
		padding: 8px 12px;
		background: rgba(240, 71, 71, 0.1);
		border: 1px solid rgba(240, 71, 71, 0.3);
		border-radius: 4px;
		color: #f04747;
		font-size: 12px;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.scan-time {
		font-variant-numeric: tabular-nums;
	}

	.port-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 6px;
	}

	.port-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.port-card.open {
		background: rgba(67, 181, 129, 0.08);
		border-color: rgba(67, 181, 129, 0.2);
	}

	.port-card.closed {
		background: var(--bg-secondary, #2b2d31);
		opacity: 0.5;
	}

	.port-number {
		font-family: 'JetBrains Mono', monospace;
		font-size: 14px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
	}

	.port-status {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.port-card.open .port-status {
		color: #43b581;
	}

	.port-card.closed .port-status {
		color: #f04747;
	}

	.port-service {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.port-latency {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		font-variant-numeric: tabular-nums;
	}
</style>
