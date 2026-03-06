<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface PingResult {
		host: string;
		ip: string;
		rttMs: number;
		ttl: number;
		success: boolean;
		error: string | null;
		timestamp: string;
	}

	interface DnsResult {
		hostname: string;
		addresses: string[];
		resolveTimeMs: number;
		success: boolean;
		error: string | null;
		timestamp: string;
	}

	interface PortCheckResult {
		host: string;
		port: number;
		open: boolean;
		responseTimeMs: number;
		error: string | null;
	}

	type TabId = 'ping' | 'dns' | 'port';

	let activeTab = $state<TabId>('ping');
	let pingHost = $state('8.8.8.8');
	let dnsHost = $state('google.com');
	let portHost = $state('google.com');
	let portNumber = $state(443);
	let isRunning = $state(false);

	let pingResults = $state<PingResult[]>([]);
	let dnsResults = $state<DnsResult[]>([]);
	let portResults = $state<PortCheckResult[]>([]);

	async function runPing() {
		if (!pingHost.trim()) return;
		isRunning = true;
		try {
			const result = await invoke<PingResult>('netdiag_ping', { host: pingHost.trim() });
			pingResults = [result, ...pingResults.slice(0, 19)];
		} catch (e) {
			pingResults = [{
				host: pingHost, ip: '', rttMs: 0, ttl: 0, success: false,
				error: String(e), timestamp: new Date().toISOString()
			}, ...pingResults.slice(0, 19)];
		} finally {
			isRunning = false;
		}
	}

	async function runDns() {
		if (!dnsHost.trim()) return;
		isRunning = true;
		try {
			const result = await invoke<DnsResult>('netdiag_dns_lookup', { hostname: dnsHost.trim() });
			dnsResults = [result, ...dnsResults.slice(0, 19)];
		} catch (e) {
			dnsResults = [{
				hostname: dnsHost, addresses: [], resolveTimeMs: 0, success: false,
				error: String(e), timestamp: new Date().toISOString()
			}, ...dnsResults.slice(0, 19)];
		} finally {
			isRunning = false;
		}
	}

	async function runPortCheck() {
		if (!portHost.trim()) return;
		isRunning = true;
		try {
			const result = await invoke<PortCheckResult>('netdiag_check_port', { host: portHost.trim(), port: portNumber });
			portResults = [result, ...portResults.slice(0, 19)];
		} catch (e) {
			portResults = [{
				host: portHost, port: portNumber, open: false, responseTimeMs: 0, error: String(e)
			}, ...portResults.slice(0, 19)];
		} finally {
			isRunning = false;
		}
	}

	function formatTime(iso: string): string {
		try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
		catch { return ''; }
	}
</script>

<div class="netdiag-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F310;</span>
			<h3>Network Diagnostics</h3>
		</div>
	</div>

	<div class="tabs">
		{#each [['ping', 'Ping'], ['dns', 'DNS'], ['port', 'Port']] as [id, label]}
			<button class="tab" class:active={activeTab === id} onclick={() => { activeTab = id as TabId; }}>
				{label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'ping'}
		<div class="input-row">
			<input type="text" class="input" placeholder="Host or IP..." bind:value={pingHost}
				onkeydown={(e) => { if (e.key === 'Enter') runPing(); }} />
			<button class="run-btn" onclick={runPing} disabled={isRunning}>
				{isRunning ? '...' : 'Ping'}
			</button>
		</div>
		<div class="results">
			{#each pingResults as r}
				<div class="result-item" class:success={r.success} class:fail={!r.success}>
					<div class="result-main">
						<span class="result-indicator">{r.success ? 'OK' : 'FAIL'}</span>
						<span class="result-host">{r.host}</span>
						{#if r.success}
							<span class="result-rtt">{r.rttMs}ms</span>
							<span class="result-meta">TTL={r.ttl}</span>
						{:else}
							<span class="result-error">{r.error}</span>
						{/if}
					</div>
					<span class="result-time">{formatTime(r.timestamp)}</span>
				</div>
			{/each}
			{#if pingResults.length === 0}
				<p class="empty">Enter a host and click Ping</p>
			{/if}
		</div>
	{:else if activeTab === 'dns'}
		<div class="input-row">
			<input type="text" class="input" placeholder="Hostname..." bind:value={dnsHost}
				onkeydown={(e) => { if (e.key === 'Enter') runDns(); }} />
			<button class="run-btn" onclick={runDns} disabled={isRunning}>
				{isRunning ? '...' : 'Lookup'}
			</button>
		</div>
		<div class="results">
			{#each dnsResults as r}
				<div class="result-item" class:success={r.success} class:fail={!r.success}>
					<div class="result-main">
						<span class="result-indicator">{r.success ? 'OK' : 'FAIL'}</span>
						<span class="result-host">{r.hostname}</span>
						<span class="result-rtt">{r.resolveTimeMs}ms</span>
					</div>
					{#if r.success && r.addresses.length > 0}
						<div class="dns-addresses">
							{#each r.addresses as addr}
								<span class="dns-addr">{addr}</span>
							{/each}
						</div>
					{:else if r.error}
						<span class="result-error">{r.error}</span>
					{/if}
				</div>
			{/each}
			{#if dnsResults.length === 0}
				<p class="empty">Enter a hostname and click Lookup</p>
			{/if}
		</div>
	{:else}
		<div class="input-row">
			<input type="text" class="input host-input" placeholder="Host..." bind:value={portHost} />
			<input type="number" class="input port-input" placeholder="Port" bind:value={portNumber} min="1" max="65535" />
			<button class="run-btn" onclick={runPortCheck} disabled={isRunning}>
				{isRunning ? '...' : 'Check'}
			</button>
		</div>
		<div class="results">
			{#each portResults as r}
				<div class="result-item" class:success={r.open} class:fail={!r.open}>
					<div class="result-main">
						<span class="result-indicator">{r.open ? 'OPEN' : 'CLOSED'}</span>
						<span class="result-host">{r.host}:{r.port}</span>
						<span class="result-rtt">{r.responseTimeMs}ms</span>
					</div>
					{#if r.error}
						<span class="result-error">{r.error}</span>
					{/if}
				</div>
			{/each}
			{#if portResults.length === 0}
				<p class="empty">Enter host and port, then click Check</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.netdiag-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.tabs { display: flex; gap: 4px; }
	.tab {
		flex: 1;
		padding: 6px;
		border: none;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.tab.active { background: #5865f2; color: white; }
	.tab:hover:not(.active) { color: var(--text-primary, #dbdee1); }

	.input-row { display: flex; gap: 6px; }
	.input {
		flex: 1;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: inherit;
	}
	.input:focus { outline: none; border-color: #5865f2; }
	.input::placeholder { color: var(--text-muted, #6d6f78); }
	.port-input { max-width: 80px; flex: 0 0 80px; }

	.run-btn {
		padding: 8px 14px;
		border-radius: 6px;
		border: none;
		background: #5865f2;
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}
	.run-btn:hover:not(:disabled) { background: #4752c4; }
	.run-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.results { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }

	.result-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-left: 3px solid transparent;
	}
	.result-item.success { border-left-color: #3ba55d; }
	.result-item.fail { border-left-color: #ed4245; }

	.result-main { display: flex; align-items: center; gap: 8px; font-size: 13px; }
	.result-indicator {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
	}
	.success .result-indicator { color: #3ba55d; }
	.fail .result-indicator { color: #ed4245; }

	.result-host { font-weight: 500; }
	.result-rtt { color: #5865f2; font-weight: 600; margin-left: auto; }
	.result-meta { font-size: 11px; color: var(--text-secondary, #949ba4); }
	.result-error { font-size: 11px; color: #ed4245; }
	.result-time { font-size: 10px; color: var(--text-muted, #6d6f78); }

	.dns-addresses { display: flex; flex-wrap: wrap; gap: 4px; }
	.dns-addr {
		font-size: 11px;
		font-family: monospace;
		padding: 2px 6px;
		background: rgba(88, 101, 242, 0.1);
		border-radius: 3px;
		color: var(--text-primary, #dbdee1);
	}

	.empty { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
</style>
