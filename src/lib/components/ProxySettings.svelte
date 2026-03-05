<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

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

	let config: ProxyConfig = {
		enabled: false,
		proxy_type: 'system',
		host: '',
		port: 8080,
		username: null,
		requires_auth: false,
		bypass_list: ['localhost', '127.0.0.1', '::1'],
		auto_detect: true,
		pac_url: null
	};

	let testing = false;
	let testResult: ProxyTestResult | null = null;
	let newBypassHost = '';
	let saving = false;

	onMount(async () => {
		try {
			config = await invoke('proxy_get_config');
		} catch (e) {
			console.error('Failed to load proxy config:', e);
		}
	});

	async function saveConfig() {
		saving = true;
		try {
			await invoke('proxy_set_config', { config });
		} catch (e) {
			console.error('Failed to save proxy config:', e);
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			testResult = await invoke('proxy_test_connection');
		} catch (e) {
			testResult = { success: false, latency_ms: null, error: String(e), ip_address: null };
		} finally {
			testing = false;
		}
	}

	async function addBypass() {
		if (!newBypassHost.trim()) return;
		try {
			config.bypass_list = await invoke('proxy_add_bypass', { host: newBypassHost.trim() });
			newBypassHost = '';
		} catch (e) {
			console.error('Failed to add bypass:', e);
		}
	}

	async function removeBypass(host: string) {
		try {
			config.bypass_list = await invoke('proxy_remove_bypass', { host });
		} catch (e) {
			console.error('Failed to remove bypass:', e);
		}
	}
</script>

<div class="proxy-settings">
	<h3 class="text-lg font-semibold text-white mb-4">Proxy Settings</h3>

	<div class="setting-row">
		<label class="flex items-center gap-3">
			<input type="checkbox" bind:checked={config.enabled} on:change={saveConfig} class="toggle" />
			<span class="text-gray-200">Enable Proxy</span>
		</label>
	</div>

	{#if config.enabled}
		<div class="mt-4 space-y-4">
			<div class="setting-row">
				<label class="block text-sm text-gray-400 mb-1">Proxy Type</label>
				<select bind:value={config.proxy_type} on:change={saveConfig} class="input-field">
					<option value="system">System</option>
					<option value="http">HTTP</option>
					<option value="https">HTTPS</option>
					<option value="socks4">SOCKS4</option>
					<option value="socks5">SOCKS5</option>
				</select>
			</div>

			{#if config.proxy_type !== 'system'}
				<div class="grid grid-cols-3 gap-3">
					<div class="col-span-2">
						<label class="block text-sm text-gray-400 mb-1">Host</label>
						<input
							type="text"
							bind:value={config.host}
							on:blur={saveConfig}
							placeholder="proxy.example.com"
							class="input-field"
						/>
					</div>
					<div>
						<label class="block text-sm text-gray-400 mb-1">Port</label>
						<input
							type="number"
							bind:value={config.port}
							on:blur={saveConfig}
							min="1"
							max="65535"
							class="input-field"
						/>
					</div>
				</div>

				<div class="setting-row">
					<label class="flex items-center gap-3">
						<input
							type="checkbox"
							bind:checked={config.requires_auth}
							on:change={saveConfig}
							class="toggle"
						/>
						<span class="text-gray-200">Requires Authentication</span>
					</label>
				</div>

				{#if config.requires_auth}
					<div>
						<label class="block text-sm text-gray-400 mb-1">Username</label>
						<input
							type="text"
							bind:value={config.username}
							on:blur={saveConfig}
							class="input-field"
						/>
					</div>
				{/if}

				<div>
					<label class="block text-sm text-gray-400 mb-2">Bypass List</label>
					<div class="flex gap-2 mb-2">
						<input
							type="text"
							bind:value={newBypassHost}
							placeholder="hostname to bypass"
							class="input-field flex-1"
							on:keydown={(e) => e.key === 'Enter' && addBypass()}
						/>
						<button on:click={addBypass} class="btn-primary text-sm px-3">Add</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each config.bypass_list as host}
							<span class="bypass-tag">
								{host}
								<button on:click={() => removeBypass(host)} class="ml-1 hover:text-red-400">&times;</button>
							</span>
						{/each}
					</div>
				</div>

				<div class="flex gap-3">
					<button
						on:click={testConnection}
						disabled={testing || !config.host}
						class="btn-secondary"
					>
						{testing ? 'Testing...' : 'Test Connection'}
					</button>
				</div>

				{#if testResult}
					<div class="test-result" class:success={testResult.success} class:error={!testResult.success}>
						{#if testResult.success}
							<span class="text-green-400">Connected</span>
							{#if testResult.latency_ms}
								<span class="text-gray-400 ml-2">({testResult.latency_ms}ms)</span>
							{/if}
							{#if testResult.ip_address}
								<span class="text-gray-400 ml-2">IP: {testResult.ip_address}</span>
							{/if}
						{:else}
							<span class="text-red-400">{testResult.error || 'Connection failed'}</span>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.proxy-settings {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}
	.setting-row {
		padding: 0.5rem 0;
	}
	.input-field {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: white;
		font-size: 0.875rem;
	}
	.input-field:focus {
		outline: none;
		border-color: rgba(88, 101, 242, 0.6);
	}
	select.input-field {
		appearance: auto;
	}
	.toggle {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: #5865f2;
	}
	.btn-primary {
		padding: 0.5rem 1rem;
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}
	.btn-primary:hover {
		background: #4752c4;
	}
	.btn-secondary {
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		cursor: pointer;
	}
	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.15);
	}
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.bypass-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		font-size: 0.75rem;
		color: #b5bac1;
	}
	.test-result {
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}
	.test-result.success {
		background: rgba(87, 242, 135, 0.1);
		border: 1px solid rgba(87, 242, 135, 0.3);
	}
	.test-result.error {
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid rgba(237, 66, 69, 0.3);
	}
</style>
