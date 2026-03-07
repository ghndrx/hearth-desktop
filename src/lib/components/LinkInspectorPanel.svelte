<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface QueryParam {
		key: string;
		value: string;
		suspicious: boolean;
	}

	interface LinkInspection {
		url: string;
		domain: string;
		scheme: string;
		path: string;
		query_params: QueryParam[];
		is_https: boolean;
		is_ip_address: boolean;
		has_suspicious_chars: boolean;
		homoglyph_warning: boolean;
		domain_age_warning: boolean;
		risk_level: string;
		risk_reasons: string[];
		shortened_url: boolean;
		inspected_at: number;
	}

	interface HistoryEntry {
		id: string;
		url: string;
		domain: string;
		risk_level: string;
		inspected_at: number;
	}

	let { open = $bindable(false), onClose, initialUrl = '' }: { open?: boolean; onClose?: () => void; initialUrl?: string } = $props();

	let urlInput = $state('');
	let result = $state<LinkInspection | null>(null);
	let history = $state<HistoryEntry[]>([]);
	let error = $state<string | null>(null);
	let showHistory = $state(false);
	let loading = $state(false);

	onMount(() => {
		if (initialUrl) {
			urlInput = initialUrl;
			inspectLink();
		}
	});

	async function inspectLink() {
		if (!urlInput.trim()) return;
		try {
			loading = true;
			error = null;
			result = await invoke<LinkInspection>('link_inspect', { url: urlInput.trim() });
		} catch (e) {
			error = String(e);
			result = null;
		} finally {
			loading = false;
		}
	}

	async function cleanUrl() {
		if (!urlInput.trim()) return;
		try {
			const cleaned = await invoke<string>('link_clean_url', { url: urlInput.trim() });
			urlInput = cleaned;
			await inspectLink();
		} catch (e) {
			error = String(e);
		}
	}

	async function loadHistory() {
		try {
			history = await invoke<HistoryEntry[]>('link_get_history');
		} catch (e) {
			error = String(e);
		}
	}

	async function clearHistory() {
		try {
			await invoke('link_clear_history');
			history = [];
		} catch (e) {
			error = String(e);
		}
	}

	function applyHistoryEntry(entry: HistoryEntry) {
		urlInput = entry.url;
		showHistory = false;
		inspectLink();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			inspectLink();
		}
	}

	function riskColor(level: string): string {
		switch (level) {
			case 'Low': return 'text-green-400';
			case 'Medium': return 'text-yellow-400';
			case 'High': return 'text-orange-400';
			case 'Critical': return 'text-red-400';
			default: return 'text-gray-400';
		}
	}

	function riskBg(level: string): string {
		switch (level) {
			case 'Low': return 'bg-green-500/20 border-green-500/40';
			case 'Medium': return 'bg-yellow-500/20 border-yellow-500/40';
			case 'High': return 'bg-orange-500/20 border-orange-500/40';
			case 'Critical': return 'bg-red-500/20 border-red-500/40';
			default: return 'bg-gray-500/20 border-gray-500/40';
		}
	}

	function riskIcon(level: string): string {
		switch (level) {
			case 'Low': return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'Medium': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z';
			case 'High': return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z';
			case 'Critical': return 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636';
			default: return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}

	function formatTime(ms: number): string {
		return new Date(ms).toLocaleString();
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[600px] max-h-[85vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Link Inspector</h2>
						<p class="text-gray-400 text-xs">Analyze URLs for safety before clicking</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
						onclick={() => { showHistory = !showHistory; if (showHistory) loadHistory(); }}
					>
						{showHistory ? 'Inspector' : 'History'}
					</button>
					<button
						class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
						onclick={() => { open = false; onClose?.(); }}
						aria-label="Close link inspector"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5">
				{#if showHistory}
					<!-- History View -->
					<div class="space-y-2">
						{#if history.length === 0}
							<p class="text-gray-500 text-sm text-center py-8">No inspected links yet</p>
						{:else}
							<div class="flex justify-end mb-2">
								<button class="text-xs text-red-400 hover:text-red-300" onclick={clearHistory}>Clear All</button>
							</div>
							{#each history as entry}
								<button
									class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
									onclick={() => applyHistoryEntry(entry)}
								>
									<svg class="w-4 h-4 flex-shrink-0 {riskColor(entry.risk_level)}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path d={riskIcon(entry.risk_level)} />
									</svg>
									<div class="flex-1 min-w-0">
										<span class="text-gray-300 text-xs font-mono truncate block">{entry.domain}</span>
										<span class="text-gray-500 text-[10px]">{formatTime(entry.inspected_at)}</span>
									</div>
									<span class="text-xs font-medium {riskColor(entry.risk_level)}">{entry.risk_level}</span>
								</button>
							{/each}
						{/if}
					</div>
				{:else}
					<!-- Inspector View -->
					<div class="space-y-4">
						<!-- URL Input -->
						<div>
							<label class="text-xs text-gray-400 mb-1.5 block" for="link-inspector-url">URL to Inspect</label>
							<div class="flex gap-2">
								<input
									id="link-inspector-url"
									type="text"
									bind:value={urlInput}
									onkeydown={handleKeydown}
									class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 placeholder-gray-600"
									placeholder="https://example.com/path?param=value"
								/>
								<button
									class="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
									onclick={inspectLink}
									disabled={loading || !urlInput.trim()}
								>
									{loading ? '...' : 'Inspect'}
								</button>
							</div>
						</div>

						{#if result}
							<!-- Risk Level Badge -->
							<div class="rounded-xl border {riskBg(result.risk_level)} p-4">
								<div class="flex items-center gap-3">
									<svg class="w-8 h-8 {riskColor(result.risk_level)}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path d={riskIcon(result.risk_level)} />
									</svg>
									<div>
										<div class="flex items-center gap-2">
											<span class="text-xl font-bold {riskColor(result.risk_level)}">{result.risk_level} Risk</span>
											{#if result.is_https}
												<span class="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">HTTPS</span>
											{:else}
												<span class="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">HTTP</span>
											{/if}
											{#if result.shortened_url}
												<span class="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">SHORTENED</span>
											{/if}
										</div>
										<span class="text-gray-400 text-sm">{result.domain}</span>
									</div>
								</div>
							</div>

							<!-- Risk Reasons -->
							{#if result.risk_reasons.length > 0}
								<div>
									<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Warnings</h3>
									<div class="space-y-1.5">
										{#each result.risk_reasons as reason}
											<div class="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
												<svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
												</svg>
												<span class="text-sm text-red-300">{reason}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- URL Breakdown -->
							<div>
								<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">URL Breakdown</h3>
								<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/50">
									<div class="flex items-center px-3 py-2">
										<span class="text-xs text-gray-500 w-20">Scheme</span>
										<span class="text-sm text-gray-300 font-mono">{result.scheme}://</span>
									</div>
									<div class="flex items-center px-3 py-2">
										<span class="text-xs text-gray-500 w-20">Domain</span>
										<span class="text-sm text-white font-mono font-medium">{result.domain}</span>
										{#if result.is_ip_address}
											<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">IP</span>
										{/if}
										{#if result.homoglyph_warning}
											<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">HOMOGLYPH</span>
										{/if}
									</div>
									<div class="flex items-center px-3 py-2">
										<span class="text-xs text-gray-500 w-20">Path</span>
										<span class="text-sm text-gray-300 font-mono truncate">{result.path}</span>
									</div>
								</div>
							</div>

							<!-- Query Parameters -->
							{#if result.query_params.length > 0}
								<div>
									<div class="flex items-center justify-between mb-2">
										<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide">
											Query Parameters ({result.query_params.length})
										</h3>
										{#if result.query_params.some(p => p.suspicious)}
											<button
												class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
												onclick={cleanUrl}
											>
												Remove Trackers
											</button>
										{/if}
									</div>
									<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/50">
										{#each result.query_params as param}
											<div class="flex items-center px-3 py-2 gap-2">
												<span class="text-xs font-mono {param.suspicious ? 'text-yellow-400' : 'text-gray-400'} w-28 truncate flex-shrink-0">
													{param.key}
												</span>
												<span class="text-xs text-gray-500">=</span>
												<span class="text-xs font-mono text-gray-300 truncate flex-1">{param.value}</span>
												{#if param.suspicious}
													<span class="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0">TRACKER</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Safety Checklist -->
							<div>
								<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Safety Checks</h3>
								<div class="grid grid-cols-2 gap-2">
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {result.is_https ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">HTTPS Encryption</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {!result.is_ip_address ? 'bg-green-500' : 'bg-orange-500'}"></span>
										<span class="text-sm text-gray-300">Domain Name</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {!result.homoglyph_warning ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">No Homoglyphs</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {!result.shortened_url ? 'bg-green-500' : 'bg-yellow-500'}"></span>
										<span class="text-sm text-gray-300">Direct Link</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {!result.has_suspicious_chars ? 'bg-green-500' : 'bg-orange-500'}"></span>
										<span class="text-sm text-gray-300">Clean URL</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30">
										<span class="w-4 h-4 rounded-full {result.query_params.every(p => !p.suspicious) ? 'bg-green-500' : 'bg-yellow-500'}"></span>
										<span class="text-sm text-gray-300">No Trackers</span>
									</div>
								</div>
							</div>
						{/if}

						{#if error}
							<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
								<p class="text-sm text-red-400">{error}</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
