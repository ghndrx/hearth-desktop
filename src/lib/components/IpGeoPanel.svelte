<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface IpGeoResult {
		query: string;
		status: string;
		country: string;
		countryCode: string;
		region: string;
		regionName: string;
		city: string;
		zip: string;
		lat: number;
		lon: number;
		timezone: string;
		isp: string;
		org: string;
		asName: string;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let ipInput = $state('');
	let result: IpGeoResult | null = $state(null);
	let loading = $state(false);
	let error: string | null = $state(null);
	let history: IpGeoResult[] = $state([]);

	async function lookup() {
		loading = true;
		error = null;
		try {
			result = await invoke<IpGeoResult>('ipgeo_lookup', { ip: ipInput.trim() });
			if (result && !history.find((h) => h.query === result!.query)) {
				history = [result, ...history].slice(0, 10);
			}
		} catch (e) {
			error = String(e);
			result = null;
		} finally {
			loading = false;
		}
	}

	function lookupFromHistory(ip: string) {
		ipInput = ip;
		lookup();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			lookup();
		}
	}

	onMount(() => {
		// Auto-lookup own IP on first open
		lookup();
	});
</script>

{#if open}
	<div class="ipgeo-overlay" role="dialog" aria-label="IP Geolocation Lookup">
		<div class="ipgeo-panel">
			<div class="panel-header">
				<h3>IP Geolocation</h3>
				<button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
			</div>

			<div class="search-row">
				<input
					type="text"
					class="ip-input"
					placeholder="Enter IP address (blank = your IP)"
					bind:value={ipInput}
					onkeydown={handleKeydown}
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
					<div class="result-header">
						<span class="ip-display">{result.query}</span>
						<span class="country-badge">{result.countryCode}</span>
					</div>

					<div class="info-grid">
						<div class="info-item">
							<span class="info-key">Location</span>
							<span class="info-val"
								>{result.city}{result.city && result.regionName
									? ', '
									: ''}{result.regionName}</span
							>
						</div>
						<div class="info-item">
							<span class="info-key">Country</span>
							<span class="info-val">{result.country}</span>
						</div>
						<div class="info-item">
							<span class="info-key">ZIP</span>
							<span class="info-val">{result.zip || 'N/A'}</span>
						</div>
						<div class="info-item">
							<span class="info-key">Coordinates</span>
							<span class="info-val">{result.lat.toFixed(4)}, {result.lon.toFixed(4)}</span>
						</div>
						<div class="info-item">
							<span class="info-key">Timezone</span>
							<span class="info-val">{result.timezone}</span>
						</div>
						<div class="info-item">
							<span class="info-key">ISP</span>
							<span class="info-val">{result.isp}</span>
						</div>
						<div class="info-item">
							<span class="info-key">Organization</span>
							<span class="info-val">{result.org}</span>
						</div>
						<div class="info-item">
							<span class="info-key">AS</span>
							<span class="info-val">{result.asName}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if history.length > 0}
				<div class="history-section">
					<div class="section-title">Recent Lookups</div>
					<div class="history-list">
						{#each history as item}
							<button class="history-item" onclick={() => lookupFromHistory(item.query)}>
								<span class="history-ip">{item.query}</span>
								<span class="history-loc"
									>{item.city}{item.city ? ', ' : ''}{item.countryCode}</span
								>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.ipgeo-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9000;
	}

	.ipgeo-panel {
		width: 480px;
		max-height: 80vh;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 24px;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--text-normal, #dbdee1);
	}

	.search-row {
		display: flex;
		gap: 8px;
	}

	.ip-input {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 6px;
		padding: 8px 12px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		outline: none;
	}

	.ip-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.ip-input:focus {
		box-shadow: 0 0 0 2px #5865f2;
	}

	.lookup-btn {
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.lookup-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.lookup-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-msg {
		background: rgba(240, 71, 71, 0.1);
		color: #f04747;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.result-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ip-display {
		font-size: 18px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.country-badge {
		background: #5865f2;
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.info-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		padding: 2px 0;
	}

	.info-key {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.info-val {
		color: var(--text-normal, #dbdee1);
		font-weight: 500;
		text-align: right;
		word-break: break-word;
	}

	.history-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.history-item {
		display: flex;
		justify-content: space-between;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		font-size: 12px;
	}

	.history-item:hover {
		background: var(--bg-tertiary, #1e1f22);
	}

	.history-ip {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.history-loc {
		color: var(--text-muted, #949ba4);
	}
</style>
