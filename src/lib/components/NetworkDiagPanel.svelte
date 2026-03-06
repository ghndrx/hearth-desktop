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

	type Tab = 'ping' | 'dns' | 'port';

	let activeTab = $state<Tab>('ping');

	// Ping state
	let pingHost = $state('8.8.8.8');
	let pingResults = $state<PingResult[]>([]);
	let pinging = $state(false);

	// DNS state
	let dnsHostname = $state('');
	let dnsResults = $state<DnsResult[]>([]);
	let resolving = $state(false);

	// Port state
	let portHost = $state('');
	let portNumber = $state(443);
	let portResults = $state<PortCheckResult[]>([]);
	let checking = $state(false);

	async function runPing() {
		if (!pingHost.trim() || pinging) return;
		pinging = true;
		try {
			const result = await invoke<PingResult>('netdiag_ping', { host: pingHost.trim() });
			pingResults = [result, ...pingResults].slice(0, 20);
		} catch (e) {
			pingResults = [
				{
					host: pingHost,
					ip: '',
					rttMs: 0,
					ttl: 0,
					success: false,
					error: String(e),
					timestamp: new Date().toISOString()
				},
				...pingResults
			].slice(0, 20);
		}
		pinging = false;
	}

	async function runDns() {
		if (!dnsHostname.trim() || resolving) return;
		resolving = true;
		try {
			const result = await invoke<DnsResult>('netdiag_dns_lookup', {
				hostname: dnsHostname.trim()
			});
			dnsResults = [result, ...dnsResults].slice(0, 20);
		} catch (e) {
			dnsResults = [
				{
					hostname: dnsHostname,
					addresses: [],
					resolveTimeMs: 0,
					success: false,
					error: String(e),
					timestamp: new Date().toISOString()
				},
				...dnsResults
			].slice(0, 20);
		}
		resolving = false;
	}

	async function runPortCheck() {
		if (!portHost.trim() || checking) return;
		checking = true;
		try {
			const result = await invoke<PortCheckResult>('netdiag_check_port', {
				host: portHost.trim(),
				port: portNumber
			});
			portResults = [result, ...portResults].slice(0, 20);
		} catch (e) {
			portResults = [
				{
					host: portHost,
					port: portNumber,
					open: false,
					responseTimeMs: 0,
					error: String(e)
				},
				...portResults
			].slice(0, 20);
		}
		checking = false;
	}

	function handleKeydown(e: KeyboardEvent, action: () => void) {
		if (e.key === 'Enter') action();
	}

	function formatTime(ts: string): string {
		try {
			return new Date(ts).toLocaleTimeString();
		} catch {
			return '';
		}
	}

	function clearHistory() {
		if (activeTab === 'ping') pingResults = [];
		else if (activeTab === 'dns') dnsResults = [];
		else portResults = [];
		invoke('netdiag_clear_history').catch(() => {});
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Network Diagnostics</h3>
		<button
			class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={clearHistory}
		>
			Clear
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 rounded-md bg-[var(--bg-tertiary)] p-0.5">
		{#each (['ping', 'dns', 'port'] as const) as tab}
			<button
				class="flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors {activeTab === tab
					? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
					: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
				onclick={() => (activeTab = tab)}
			>
				{tab === 'ping' ? 'Ping' : tab === 'dns' ? 'DNS Lookup' : 'Port Check'}
			</button>
		{/each}
	</div>

	<!-- Ping Tab -->
	{#if activeTab === 'ping'}
		<div class="flex gap-2">
			<input
				type="text"
				class="flex-1 rounded bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
				placeholder="Host or IP (e.g. 8.8.8.8)"
				bind:value={pingHost}
				onkeydown={(e) => handleKeydown(e, runPing)}
			/>
			<button
				class="rounded bg-[var(--brand-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
				onclick={runPing}
				disabled={pinging || !pingHost.trim()}
			>
				{pinging ? '...' : 'Ping'}
			</button>
		</div>

		{#if pingResults.length > 0}
			<div class="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
				{#each pingResults as result}
					<div
						class="flex items-center justify-between rounded bg-[var(--bg-tertiary)] px-3 py-2 text-xs"
					>
						<div class="flex items-center gap-2">
							<span
								class="h-2 w-2 rounded-full {result.success ? 'bg-green-400' : 'bg-red-400'}"
							></span>
							<span class="font-mono text-[var(--text-primary)]">{result.host}</span>
							{#if result.ip && result.ip !== result.host}
								<span class="text-[var(--text-muted)]">({result.ip})</span>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if result.success}
								<span class="font-mono text-green-400">{result.rttMs}ms</span>
								<span class="text-[var(--text-muted)]">TTL {result.ttl}</span>
							{:else}
								<span class="text-red-400">{result.error || 'Failed'}</span>
							{/if}
							<span class="text-[10px] text-[var(--text-muted)]"
								>{formatTime(result.timestamp)}</span
							>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-4 text-center text-xs text-[var(--text-muted)]">
				Enter a hostname or IP address and click Ping
			</div>
		{/if}
	{/if}

	<!-- DNS Tab -->
	{#if activeTab === 'dns'}
		<div class="flex gap-2">
			<input
				type="text"
				class="flex-1 rounded bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
				placeholder="Hostname (e.g. example.com)"
				bind:value={dnsHostname}
				onkeydown={(e) => handleKeydown(e, runDns)}
			/>
			<button
				class="rounded bg-[var(--brand-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
				onclick={runDns}
				disabled={resolving || !dnsHostname.trim()}
			>
				{resolving ? '...' : 'Resolve'}
			</button>
		</div>

		{#if dnsResults.length > 0}
			<div class="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
				{#each dnsResults as result}
					<div class="rounded bg-[var(--bg-tertiary)] px-3 py-2 text-xs">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="h-2 w-2 rounded-full {result.success
										? 'bg-green-400'
										: 'bg-red-400'}"
								></span>
								<span class="font-mono text-[var(--text-primary)]"
									>{result.hostname}</span
								>
							</div>
							<div class="flex items-center gap-3">
								<span class="font-mono text-[var(--text-muted)]"
									>{result.resolveTimeMs}ms</span
								>
								<span class="text-[10px] text-[var(--text-muted)]"
									>{formatTime(result.timestamp)}</span
								>
							</div>
						</div>
						{#if result.success && result.addresses.length > 0}
							<div class="mt-1 flex flex-wrap gap-1.5 pl-4">
								{#each result.addresses as addr}
									<span
										class="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
										>{addr}</span
									>
								{/each}
							</div>
						{:else if result.error}
							<div class="mt-1 pl-4 text-red-400">{result.error}</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-4 text-center text-xs text-[var(--text-muted)]">
				Enter a hostname to resolve its IP addresses
			</div>
		{/if}
	{/if}

	<!-- Port Check Tab -->
	{#if activeTab === 'port'}
		<div class="flex gap-2">
			<input
				type="text"
				class="flex-1 rounded bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
				placeholder="Host (e.g. example.com)"
				bind:value={portHost}
				onkeydown={(e) => handleKeydown(e, runPortCheck)}
			/>
			<input
				type="number"
				class="w-20 rounded bg-[var(--bg-tertiary)] px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
				placeholder="Port"
				bind:value={portNumber}
				min="1"
				max="65535"
				onkeydown={(e) => handleKeydown(e, runPortCheck)}
			/>
			<button
				class="rounded bg-[var(--brand-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
				onclick={runPortCheck}
				disabled={checking || !portHost.trim()}
			>
				{checking ? '...' : 'Check'}
			</button>
		</div>

		<!-- Common ports shortcuts -->
		<div class="flex flex-wrap gap-1">
			{#each [{ port: 80, label: 'HTTP' }, { port: 443, label: 'HTTPS' }, { port: 22, label: 'SSH' }, { port: 3306, label: 'MySQL' }, { port: 5432, label: 'Postgres' }, { port: 6379, label: 'Redis' }] as preset}
				<button
					class="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
					onclick={() => (portNumber = preset.port)}
				>
					{preset.label} ({preset.port})
				</button>
			{/each}
		</div>

		{#if portResults.length > 0}
			<div class="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
				{#each portResults as result}
					<div
						class="flex items-center justify-between rounded bg-[var(--bg-tertiary)] px-3 py-2 text-xs"
					>
						<div class="flex items-center gap-2">
							<span
								class="h-2 w-2 rounded-full {result.open ? 'bg-green-400' : 'bg-red-400'}"
							></span>
							<span class="font-mono text-[var(--text-primary)]"
								>{result.host}:{result.port}</span
							>
						</div>
						<div class="flex items-center gap-2">
							<span class={result.open ? 'text-green-400' : 'text-red-400'}>
								{result.open ? 'Open' : 'Closed'}
							</span>
							<span class="font-mono text-[var(--text-muted)]"
								>{result.responseTimeMs}ms</span
							>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-4 text-center text-xs text-[var(--text-muted)]">
				Enter a host and port to check connectivity
			</div>
		{/if}
	{/if}
</div>
