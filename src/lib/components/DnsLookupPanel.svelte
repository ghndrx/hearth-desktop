<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface DnsResult {
		hostname: string;
		addresses: string[];
		recordCount: number;
		elapsedMs: number;
		timestamp: string;
	}

	let hostname = $state('');
	let result = $state<DnsResult | null>(null);
	let reverseInput = $state('');
	let reverseResults = $state<string[]>([]);
	let history = $state<DnsResult[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let activeTab = $state<'lookup' | 'reverse' | 'history'>('lookup');

	onMount(async () => {
		try {
			history = await invoke<DnsResult[]>('dns_get_history');
		} catch {}
	});

	async function performLookup() {
		if (!hostname.trim()) return;
		loading = true;
		error = null;
		result = null;

		try {
			result = await invoke<DnsResult>('dns_lookup', { hostname: hostname.trim() });
			history = await invoke<DnsResult[]>('dns_get_history');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function performReverseLookup() {
		if (!reverseInput.trim()) return;
		loading = true;
		error = null;
		reverseResults = [];

		try {
			reverseResults = await invoke<string[]>('dns_reverse_lookup', { hostname: reverseInput.trim() });
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function clearHistory() {
		try {
			await invoke('dns_clear_history');
			history = [];
		} catch {}
	}

	function lookupFromHistory(h: DnsResult) {
		hostname = h.hostname;
		activeTab = 'lookup';
		performLookup();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (activeTab === 'lookup') performLookup();
			else if (activeTab === 'reverse') performReverseLookup();
		}
	}
</script>

<div class="dns-panel">
	<div class="panel-header">
		<h3>DNS Lookup</h3>
	</div>

	<div class="tabs">
		<button class="tab" class:active={activeTab === 'lookup'} onclick={() => activeTab = 'lookup'}>Lookup</button>
		<button class="tab" class:active={activeTab === 'reverse'} onclick={() => activeTab = 'reverse'}>Reverse</button>
		<button class="tab" class:active={activeTab === 'history'} onclick={() => activeTab = 'history'}>History</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if activeTab === 'lookup'}
		<div class="input-row">
			<input
				type="text"
				bind:value={hostname}
				placeholder="Enter hostname (e.g., example.com)"
				onkeydown={handleKeydown}
			/>
			<button class="btn-primary" onclick={performLookup} disabled={loading || !hostname.trim()}>
				{loading ? 'Resolving...' : 'Lookup'}
			</button>
		</div>

		{#if result}
			<div class="result-card">
				<div class="result-header">
					<span class="hostname">{result.hostname}</span>
					<span class="timing">{result.elapsedMs}ms</span>
				</div>
				<div class="result-meta">{result.recordCount} record{result.recordCount !== 1 ? 's' : ''} found</div>
				<div class="addresses">
					{#each result.addresses as addr}
						<div class="address-row">
							<code>{addr}</code>
							<button class="btn-copy" onclick={() => navigator.clipboard.writeText(addr)} title="Copy">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

	{:else if activeTab === 'reverse'}
		<div class="input-row">
			<input
				type="text"
				bind:value={reverseInput}
				placeholder="Enter IP address (e.g., 8.8.8.8)"
				onkeydown={handleKeydown}
			/>
			<button class="btn-primary" onclick={performReverseLookup} disabled={loading || !reverseInput.trim()}>
				{loading ? 'Resolving...' : 'Reverse'}
			</button>
		</div>

		{#if reverseResults.length > 0}
			<div class="result-card">
				<div class="result-header">Reverse DNS Results</div>
				<div class="addresses">
					{#each reverseResults as r}
						<div class="address-row">
							<code>{r}</code>
							<button class="btn-copy" onclick={() => navigator.clipboard.writeText(r)} title="Copy">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

	{:else if activeTab === 'history'}
		{#if history.length === 0}
			<div class="empty-state">No lookup history yet</div>
		{:else}
			<div class="history-header">
				<span>{history.length} entries</span>
				<button class="btn-text" onclick={clearHistory}>Clear</button>
			</div>
			<div class="history-list">
				{#each history as entry}
					<button class="history-item" onclick={() => lookupFromHistory(entry)}>
						<div class="history-hostname">{entry.hostname}</div>
						<div class="history-meta">
							{entry.addresses[0]}{entry.recordCount > 1 ? ` +${entry.recordCount - 1}` : ''}
							<span class="history-time">{entry.elapsedMs}ms</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.dns-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}
	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.tabs {
		display: flex;
		gap: 4px;
		background: var(--bg-secondary, #181825);
		border-radius: 8px;
		padding: 4px;
	}
	.tab {
		flex: 1;
		padding: 8px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.15s;
	}
	.tab.active {
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		font-weight: 500;
	}
	.input-row {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		background: var(--bg-secondary, #181825);
		color: var(--text-primary, #cdd6f4);
		font-size: 14px;
		outline: none;
	}
	input:focus {
		border-color: var(--brand-primary, #8b94f7);
	}
	.btn-primary {
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		background: var(--brand-primary, #8b94f7);
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		padding: 10px;
		border-radius: 8px;
		background: rgba(243, 139, 168, 0.15);
		color: #f38ba8;
		font-size: 13px;
	}
	.result-card {
		background: var(--bg-secondary, #181825);
		border-radius: 10px;
		padding: 14px;
		border: 1px solid var(--border-color, #313244);
	}
	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-weight: 500;
	}
	.hostname {
		font-weight: 600;
		font-size: 15px;
	}
	.timing {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
		background: var(--bg-primary, #1e1e2e);
		padding: 2px 8px;
		border-radius: 4px;
	}
	.result-meta {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
		margin-bottom: 10px;
	}
	.addresses {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.address-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		background: var(--bg-primary, #1e1e2e);
		border-radius: 6px;
	}
	.address-row code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 13px;
	}
	.btn-copy {
		background: none;
		border: none;
		color: var(--text-muted, #6c7086);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.btn-copy:hover {
		color: var(--text-primary, #cdd6f4);
		background: var(--bg-secondary, #181825);
	}
	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: var(--text-muted, #6c7086);
		font-size: 14px;
	}
	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}
	.btn-text {
		background: none;
		border: none;
		color: var(--brand-primary, #8b94f7);
		cursor: pointer;
		font-size: 12px;
	}
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.history-item {
		display: flex;
		flex-direction: column;
		padding: 10px 12px;
		background: var(--bg-secondary, #181825);
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: border-color 0.15s;
		width: 100%;
	}
	.history-item:hover {
		border-color: var(--brand-primary, #8b94f7);
	}
	.history-hostname {
		font-weight: 500;
		font-size: 14px;
	}
	.history-meta {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
		margin-top: 2px;
	}
	.history-time {
		margin-left: 8px;
		opacity: 0.7;
	}
</style>
