<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ProxyConfig {
		enabled: boolean;
		proxy_type: string;
		host: string;
		port: number;
		username: string | null;
		requires_auth: boolean;
		bypass_list: string[];
		auto_detect: boolean;
		pac_url: string | null;
	}

	interface ProxyTestResult {
		success: boolean;
		latency_ms: number | null;
		error: string | null;
		ip_address: string | null;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let config = $state<ProxyConfig>({
		enabled: false,
		proxy_type: 'system',
		host: '',
		port: 8080,
		username: null,
		requires_auth: false,
		bypass_list: ['localhost', '127.0.0.1', '::1'],
		auto_detect: true,
		pac_url: null
	});
	let testResult = $state<ProxyTestResult | null>(null);
	let testing = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let newBypass = $state('');
	let showAdvanced = $state(false);

	const proxyTypes = [
		{ value: 'system', label: 'System Default' },
		{ value: 'http', label: 'HTTP' },
		{ value: 'https', label: 'HTTPS' },
		{ value: 'socks4', label: 'SOCKS4' },
		{ value: 'socks5', label: 'SOCKS5' },
	];

	onMount(async () => {
		try {
			config = await invoke<ProxyConfig>('proxy_get_config');
		} catch (e) {
			error = String(e);
		}
	});

	async function saveConfig() {
		try {
			saving = true;
			error = null;
			await invoke('proxy_set_config', { config });
		} catch (e) {
			error = String(e);
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		try {
			testing = true;
			error = null;
			testResult = null;
			await saveConfig();
			testResult = await invoke<ProxyTestResult>('proxy_test_connection');
		} catch (e) {
			error = String(e);
		} finally {
			testing = false;
		}
	}

	async function toggleProxy() {
		try {
			const newState = await invoke<boolean>('proxy_toggle');
			config = { ...config, enabled: newState };
		} catch (e) {
			error = String(e);
		}
	}

	function addBypass() {
		if (!newBypass.trim() || config.bypass_list.includes(newBypass.trim())) return;
		config = { ...config, bypass_list: [...config.bypass_list, newBypass.trim()] };
		newBypass = '';
	}

	function removeBypass(host: string) {
		config = { ...config, bypass_list: config.bypass_list.filter(h => h !== host) };
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[520px] max-h-[80vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Proxy Settings</h2>
						<p class="text-gray-400 text-xs">Configure network proxy for connections</p>
					</div>
				</div>
				<button
					class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
					onclick={() => { open = false; onClose?.(); }}
					aria-label="Close proxy settings"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 space-y-4">
				<!-- Enable Toggle -->
				<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
					<label class="flex items-center justify-between cursor-pointer">
						<div>
							<span class="text-sm text-gray-300 block">Enable Proxy</span>
							<span class="text-xs text-gray-500">Route connections through a proxy server</span>
						</div>
						<button
							role="switch"
							aria-checked={config.enabled}
							class="w-10 h-5 rounded-full transition-colors {config.enabled ? 'bg-orange-500' : 'bg-gray-600'}"
							onclick={toggleProxy}
						>
							<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {config.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
						</button>
					</label>
				</div>

				{#if config.enabled}
					<!-- Proxy Type -->
					<div>
						<label class="text-xs text-gray-400 mb-1.5 block" for="proxy-type">Proxy Type</label>
						<select
							id="proxy-type"
							bind:value={config.proxy_type}
							class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
						>
							{#each proxyTypes as pt}
								<option value={pt.value}>{pt.label}</option>
							{/each}
						</select>
					</div>

					{#if config.proxy_type !== 'system'}
						<!-- Host & Port -->
						<div class="grid grid-cols-3 gap-3">
							<div class="col-span-2">
								<label class="text-xs text-gray-400 mb-1.5 block" for="proxy-host">Host</label>
								<input
									id="proxy-host"
									type="text"
									bind:value={config.host}
									class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-500 placeholder-gray-600"
									placeholder="proxy.example.com"
								/>
							</div>
							<div>
								<label class="text-xs text-gray-400 mb-1.5 block" for="proxy-port">Port</label>
								<input
									id="proxy-port"
									type="number"
									bind:value={config.port}
									class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
									min="1"
									max="65535"
								/>
							</div>
						</div>

						<!-- Authentication -->
						<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 space-y-3">
							<label class="flex items-center justify-between cursor-pointer">
								<span class="text-sm text-gray-300">Requires Authentication</span>
								<button
									role="switch"
									aria-checked={config.requires_auth}
									class="w-10 h-5 rounded-full transition-colors {config.requires_auth ? 'bg-orange-500' : 'bg-gray-600'}"
									onclick={() => config = { ...config, requires_auth: !config.requires_auth }}
								>
									<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {config.requires_auth ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
								</button>
							</label>
							{#if config.requires_auth}
								<input
									type="text"
									bind:value={config.username}
									class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 placeholder-gray-600"
									placeholder="Username"
								/>
							{/if}
						</div>
					{/if}

					<!-- Advanced -->
					<button
						class="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
						onclick={() => showAdvanced = !showAdvanced}
					>
						<svg class="w-3 h-3 transition-transform {showAdvanced ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M9 5l7 7-7 7" />
						</svg>
						Advanced Settings
					</button>

					{#if showAdvanced}
						<!-- Bypass List -->
						<div>
							<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Bypass List</h3>
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									bind:value={newBypass}
									class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500 placeholder-gray-600"
									placeholder="hostname to bypass..."
									onkeydown={(e) => e.key === 'Enter' && addBypass()}
								/>
								<button
									class="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition-colors"
									onclick={addBypass}
								>Add</button>
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each config.bypass_list as host}
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 text-xs text-gray-300 font-mono">
										{host}
										<button class="text-gray-500 hover:text-red-400" onclick={() => removeBypass(host)}>&times;</button>
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Test Connection -->
					<div class="flex gap-2">
						<button
							class="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
							onclick={testConnection}
							disabled={testing}
						>
							{testing ? 'Testing...' : 'Test Connection'}
						</button>
						<button
							class="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors border border-gray-700 disabled:opacity-50"
							onclick={saveConfig}
							disabled={saving}
						>
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>

					{#if testResult}
						<div class="rounded-xl border {testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} p-4">
							<div class="flex items-center gap-2 mb-2">
								<span class="w-3 h-3 rounded-full {testResult.success ? 'bg-green-500' : 'bg-red-500'}"></span>
								<span class="text-sm font-medium {testResult.success ? 'text-green-400' : 'text-red-400'}">
									{testResult.success ? 'Connection Successful' : 'Connection Failed'}
								</span>
							</div>
							{#if testResult.latency_ms}
								<p class="text-xs text-gray-400">Latency: {testResult.latency_ms}ms</p>
							{/if}
							{#if testResult.ip_address}
								<p class="text-xs text-gray-400">External IP: {testResult.ip_address}</p>
							{/if}
							{#if testResult.error}
								<p class="text-xs text-red-400 mt-1">{testResult.error}</p>
							{/if}
						</div>
					{/if}
				{/if}

				{#if error}
					<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
						<p class="text-sm text-red-400">{error}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
