<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface WhoisResult {
		domain: string;
		registrar: string | null;
		creationDate: string | null;
		expiryDate: string | null;
		updatedDate: string | null;
		nameServers: string[];
		status: string[];
		registrantCountry: string | null;
		dnssec: string | null;
		rawText: string;
		queryTimeMs: number;
	}

	let domain = $state('');
	let loading = $state(false);
	let result: WhoisResult | null = $state(null);
	let error: string | null = $state(null);
	let showRaw = $state(false);
	let history: WhoisResult[] = $state([]);

	async function lookup() {
		if (!domain.trim()) return;
		loading = true;
		error = null;
		try {
			result = await invoke<WhoisResult>('whois_lookup', { domain: domain.trim() });
			// Add to history if not duplicate
			if (!history.find((h) => h.domain === result!.domain)) {
				history = [result, ...history].slice(0, 10);
			}
		} catch (e) {
			error = String(e);
			result = null;
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') lookup();
	}

	function selectHistory(item: WhoisResult) {
		result = item;
		domain = item.domain;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function getDaysUntilExpiry(dateStr: string | null): number | null {
		if (!dateStr) return null;
		try {
			const expiry = new Date(dateStr);
			if (isNaN(expiry.getTime())) return null;
			const diff = expiry.getTime() - Date.now();
			return Math.ceil(diff / 86400000);
		} catch {
			return null;
		}
	}

	function getExpiryColor(days: number | null): string {
		if (days === null) return '#949ba4';
		if (days < 0) return '#f04747';
		if (days < 30) return '#f04747';
		if (days < 90) return '#faa61a';
		return '#43b581';
	}
</script>

<div class="whois-panel">
	<div class="panel-header">
		<h3>WHOIS Lookup</h3>
	</div>

	<div class="search-row">
		<input
			type="text"
			bind:value={domain}
			placeholder="example.com"
			class="domain-input"
			onkeydown={handleKeydown}
			disabled={loading}
		/>
		<button class="lookup-btn" onclick={lookup} disabled={loading}>
			{loading ? 'Looking up...' : 'Lookup'}
		</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if result}
		<div class="result-card">
			<div class="domain-header">
				<span class="domain-name">{result.domain}</span>
				<span class="query-time">{result.queryTimeMs}ms</span>
			</div>

			<div class="info-grid">
				{#if result.registrar}
					<div class="info-row">
						<span class="info-key">Registrar</span>
						<span class="info-val">{result.registrar}</span>
					</div>
				{/if}

				<div class="info-row">
					<span class="info-key">Created</span>
					<span class="info-val">{formatDate(result.creationDate)}</span>
				</div>

				<div class="info-row">
					<span class="info-key">Expires</span>
					<span class="info-val">
						{formatDate(result.expiryDate)}
						{#if getDaysUntilExpiry(result.expiryDate) !== null}
							{@const days = getDaysUntilExpiry(result.expiryDate)}
							<span class="expiry-badge" style="color: {getExpiryColor(days)}">
								{#if days !== null}
									{days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}
								{/if}
							</span>
						{/if}
					</span>
				</div>

				<div class="info-row">
					<span class="info-key">Updated</span>
					<span class="info-val">{formatDate(result.updatedDate)}</span>
				</div>

				{#if result.registrantCountry}
					<div class="info-row">
						<span class="info-key">Country</span>
						<span class="info-val">{result.registrantCountry}</span>
					</div>
				{/if}

				{#if result.dnssec}
					<div class="info-row">
						<span class="info-key">DNSSEC</span>
						<span class="info-val">{result.dnssec}</span>
					</div>
				{/if}
			</div>

			{#if result.nameServers.length > 0}
				<div class="ns-section">
					<span class="ns-title">Name Servers</span>
					<div class="ns-list">
						{#each result.nameServers as ns}
							<span class="ns-item">{ns}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if result.status.length > 0}
				<div class="status-section">
					<span class="ns-title">Status</span>
					<div class="status-list">
						{#each result.status as s}
							<span class="status-tag">{s.split(' ')[0]}</span>
						{/each}
					</div>
				</div>
			{/if}

			<button class="raw-toggle" onclick={() => (showRaw = !showRaw)}>
				{showRaw ? 'Hide' : 'Show'} Raw WHOIS
			</button>

			{#if showRaw}
				<pre class="raw-output">{result.rawText}</pre>
			{/if}
		</div>
	{/if}

	{#if history.length > 1}
		<div class="history-section">
			<span class="history-title">Recent Lookups</span>
			<div class="history-list">
				{#each history as item}
					<button
						class="history-item"
						class:active={item.domain === result?.domain}
						onclick={() => selectHistory(item)}
					>
						{item.domain}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.whois-panel {
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

	.search-row {
		display: flex;
		gap: 6px;
	}

	.domain-input {
		flex: 1;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 8px 12px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		outline: none;
	}

	.domain-input:focus {
		border-color: #5865f2;
	}

	.lookup-btn {
		padding: 8px 16px;
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}

	.lookup-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-msg {
		padding: 8px 12px;
		background: rgba(240, 71, 71, 0.1);
		border: 1px solid rgba(240, 71, 71, 0.3);
		border-radius: 4px;
		color: #f04747;
		font-size: 12px;
	}

	.result-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.domain-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.domain-name {
		font-size: 18px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
	}

	.query-time {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		font-variant-numeric: tabular-nums;
	}

	.info-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}

	.info-key {
		color: var(--text-muted, #949ba4);
		min-width: 80px;
	}

	.info-val {
		color: var(--text-normal, #dbdee1);
		text-align: right;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.expiry-badge {
		font-size: 11px;
		font-weight: 600;
	}

	.ns-section,
	.status-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ns-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.ns-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ns-item {
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		color: var(--text-normal, #dbdee1);
		padding: 2px 0;
	}

	.status-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.status-tag {
		font-size: 10px;
		padding: 2px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 10px;
		color: var(--text-muted, #949ba4);
	}

	.raw-toggle {
		align-self: flex-start;
		padding: 4px 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
	}

	.raw-output {
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		padding: 8px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 300px;
		overflow-y: auto;
		margin: 0;
	}

	.history-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.history-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.history-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.history-item {
		padding: 4px 10px;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		cursor: pointer;
		font-size: 12px;
	}

	.history-item.active {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.1);
	}

	.history-item:hover {
		border-color: rgba(255, 255, 255, 0.15);
	}
</style>
