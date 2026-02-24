<script lang="ts">
	import { onMount } from 'svelte';
	import {
		aiProviders,
		userCredentials,
		modelRoutings,
		availableModels,
		providerTypes,
		featureTypes,
		providerHealth,
		aiLoading,
		aiError,
		enabledProviders,
		providersByType,
		fetchProviders,
		fetchUserCredentials,
		fetchProviderTypes,
		fetchFeatureTypes,
		fetchAvailableModels,
		fetchProviderHealth,
		fetchModelRoutings,
		setUserCredentials,
		deleteUserCredential,
		setModelRouting,
		deleteModelRouting,
		createProvider,
		updateProvider,
		deleteProvider,
		type AIProvider,
		type ProviderType,
		type FeatureType,
		type ProviderInfo,
		type ModelInfo
	} from '$lib/stores/ai';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	// State
	let activeTab: 'credentials' | 'routing' | 'admin' = 'credentials';
	let showAddCredentialModal = false;
	let showAddProviderModal = false;
	let showAddRoutingModal = false;
	let selectedProvider: AIProvider | null = null;
	let editingCredential: string | null = null;

	// Form states
	let credentialForm = {
		provider_id: '',
		api_key: '',
		secret_key: '',
		region: '',
		project_id: '',
		service_account: ''
	};

	let providerForm = {
		provider_type: 'openai' as ProviderType,
		name: '',
		display_name: '',
		base_url: '',
		is_enabled: true,
		is_default: false,
		priority: 100,
		api_key: '',
		secret_key: '',
		region: '',
		project_id: '',
		service_account: ''
	};

	let routingForm = {
		feature: 'chat' as FeatureType,
		provider_id: '',
		model_id: '',
		priority: 100,
		is_enabled: true
	};

	// Computed
	$: providerLookup = Object.fromEntries($aiProviders.map((p) => [p.id, p]));
	$: credentialLookup = Object.fromEntries($userCredentials.map((c) => [c.provider_id, c]));
	$: selectedProviderInfo = $providerTypes.find((p) => p.type === providerForm.provider_type);
	$: selectedProviderModels = routingForm.provider_id
		? $availableModels.filter((m) => m.provider_id === routingForm.provider_id)
		: [];

	onMount(async () => {
		await Promise.all([
			fetchProviderTypes(),
			fetchFeatureTypes(),
			fetchProviders(),
			fetchUserCredentials(),
			fetchModelRoutings(),
			fetchAvailableModels(),
			fetchProviderHealth()
		]);
	});

	// Handlers
	async function handleSaveCredential() {
		const success = await setUserCredentials(credentialForm);
		if (success) {
			showAddCredentialModal = false;
			editingCredential = null;
			resetCredentialForm();
		}
	}

	async function handleDeleteCredential(providerId: string) {
		if (confirm('Are you sure you want to delete this credential?')) {
			await deleteUserCredential(providerId);
		}
	}

	async function handleCreateProvider() {
		const success = await createProvider(providerForm);
		if (success) {
			showAddProviderModal = false;
			resetProviderForm();
		}
	}

	async function handleUpdateProvider() {
		if (!selectedProvider) return;
		const success = await updateProvider(selectedProvider.id, providerForm);
		if (success) {
			selectedProvider = null;
			resetProviderForm();
		}
	}

	async function handleDeleteProvider(id: string) {
		if (confirm('Are you sure you want to delete this provider? This will also delete associated credentials and routing.')) {
			await deleteProvider(id);
		}
	}

	async function handleSaveRouting() {
		const success = await setModelRouting(routingForm);
		if (success) {
			showAddRoutingModal = false;
			resetRoutingForm();
		}
	}

	async function handleDeleteRouting(id: string) {
		if (confirm('Are you sure you want to delete this routing rule?')) {
			await deleteModelRouting(id);
		}
	}

	function openEditCredential(providerId: string) {
		editingCredential = providerId;
		const cred = $userCredentials.find((c) => c.provider_id === providerId);
		if (cred) {
			credentialForm = {
				provider_id: providerId,
				api_key: '',
				secret_key: '',
				region: '',
				project_id: '',
				service_account: ''
			};
		}
		showAddCredentialModal = true;
	}

	function openEditProvider(provider: AIProvider) {
		selectedProvider = provider;
		providerForm = {
			provider_type: provider.provider_type,
			name: provider.name,
			display_name: provider.display_name,
			base_url: provider.base_url || '',
			is_enabled: provider.is_enabled,
			is_default: provider.is_default,
			priority: provider.priority,
			api_key: '',
			secret_key: '',
			region: '',
			project_id: '',
			service_account: ''
		};
	}

	function resetCredentialForm() {
		credentialForm = {
			provider_id: '',
			api_key: '',
			secret_key: '',
			region: '',
			project_id: '',
			service_account: ''
		};
	}

	function resetProviderForm() {
		providerForm = {
			provider_type: 'openai',
			name: '',
			display_name: '',
			base_url: '',
			is_enabled: true,
			is_default: false,
			priority: 100,
			api_key: '',
			secret_key: '',
			region: '',
			project_id: '',
			service_account: ''
		};
	}

	function resetRoutingForm() {
		routingForm = {
			feature: 'chat',
			provider_id: '',
			model_id: '',
			priority: 100,
			is_enabled: true
		};
	}

	function getHealthStatus(providerName: string): 'healthy' | 'unhealthy' | 'unknown' {
		const health = $providerHealth[providerName];
		if (!health) return 'unknown';
		return health.available ? 'healthy' : 'unhealthy';
	}

	function getHealthColor(status: 'healthy' | 'unhealthy' | 'unknown'): string {
		switch (status) {
			case 'healthy':
				return 'text-green-400';
			case 'unhealthy':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}

	function formatLatency(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="ai-settings p-4">
	<h2 class="text-xl font-semibold mb-4">AI Settings</h2>

	{#if $aiError}
		<div class="bg-red-500/20 text-red-300 p-3 rounded mb-4">
			{$aiError}
		</div>
	{/if}

	<!-- Tab Navigation -->
	<div class="flex gap-2 mb-4 border-b border-gray-700">
		<button
			class="px-4 py-2 -mb-px transition-colors"
			class:border-b-2={activeTab === 'credentials'}
			class:border-blue-500={activeTab === 'credentials'}
			class:text-blue-400={activeTab === 'credentials'}
			on:click={() => (activeTab = 'credentials')}
		>
			My API Keys
		</button>
		<button
			class="px-4 py-2 -mb-px transition-colors"
			class:border-b-2={activeTab === 'routing'}
			class:border-blue-500={activeTab === 'routing'}
			class:text-blue-400={activeTab === 'routing'}
			on:click={() => (activeTab = 'routing')}
		>
			Model Routing
		</button>
		<button
			class="px-4 py-2 -mb-px transition-colors"
			class:border-b-2={activeTab === 'admin'}
			class:border-blue-500={activeTab === 'admin'}
			class:text-blue-400={activeTab === 'admin'}
			on:click={() => (activeTab = 'admin')}
		>
			Admin
		</button>
	</div>

	<!-- Credentials Tab -->
	{#if activeTab === 'credentials'}
		<div class="credentials-section">
			<div class="flex justify-between items-center mb-4">
				<p class="text-gray-400 text-sm">
					Add your own API keys to use AI features with your personal accounts.
				</p>
				<Button size="sm" on:click={() => (showAddCredentialModal = true)}>
					Add API Key
				</Button>
			</div>

			{#if $aiLoading}
				<div class="flex justify-center py-8">
					<LoadingSpinner />
				</div>
			{:else if $enabledProviders.length === 0}
				<div class="text-gray-500 text-center py-8">
					No AI providers are configured by the server admin yet.
				</div>
			{:else}
				<div class="space-y-3">
					{#each $enabledProviders as provider}
						{@const credential = credentialLookup[provider.id]}
						{@const health = getHealthStatus(provider.name)}
						<div
							class="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-2 h-2 rounded-full {getHealthColor(health)}"
									title={health}
								/>
								<div>
									<div class="font-medium">{provider.display_name}</div>
									<div class="text-sm text-gray-400">
										{provider.provider_type}
										{#if provider.base_url}
											· {provider.base_url}
										{/if}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if credential?.has_credentials}
									<span class="text-green-400 text-sm">✓ Configured</span>
									<Button
										size="sm"
										variant="secondary"
										on:click={() => openEditCredential(provider.id)}
									>
										Update
									</Button>
									<Button
										size="sm"
										variant="danger"
										on:click={() => handleDeleteCredential(provider.id)}
									>
										Remove
									</Button>
								{:else}
									<Button
										size="sm"
										on:click={() => {
											credentialForm.provider_id = provider.id;
											showAddCredentialModal = true;
										}}
									>
										Add Key
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Routing Tab -->
	{#if activeTab === 'routing'}
		<div class="routing-section">
			<div class="flex justify-between items-center mb-4">
				<p class="text-gray-400 text-sm">
					Configure which models to use for different AI features.
				</p>
				<Button size="sm" on:click={() => (showAddRoutingModal = true)}>
					Add Routing Rule
				</Button>
			</div>

			{#if $modelRoutings.length === 0}
				<div class="text-gray-500 text-center py-8">
					No custom routing rules configured. Default models will be used.
				</div>
			{:else}
				<div class="space-y-3">
					{#each $modelRoutings as routing}
						{@const provider = providerLookup[routing.provider_id]}
						<div
							class="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
						>
							<div>
								<div class="font-medium capitalize">
									{routing.feature}
									{#if !routing.is_enabled}
										<span class="text-gray-500 text-sm">(disabled)</span>
									{/if}
								</div>
								<div class="text-sm text-gray-400">
									{provider?.display_name || 'Unknown'} → {routing.model_id}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-sm text-gray-500">
									Priority: {routing.priority}
								</span>
								<Button
									size="sm"
									variant="danger"
									on:click={() => handleDeleteRouting(routing.id)}
								>
									Remove
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Default Models Reference -->
			<div class="mt-6">
				<h3 class="text-lg font-medium mb-3">Default Models by Feature</h3>
				<div class="bg-gray-800 rounded-lg p-4">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left text-gray-400">
								<th class="pb-2">Feature</th>
								<th class="pb-2">Default Model</th>
							</tr>
						</thead>
						<tbody>
							{#each $featureTypes as feature}
								<tr class="border-t border-gray-700">
									<td class="py-2 capitalize">{feature.type}</td>
									<td class="py-2 text-gray-400">{feature.default_model}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}

	<!-- Admin Tab -->
	{#if activeTab === 'admin'}
		<div class="admin-section">
			<div class="flex justify-between items-center mb-4">
				<p class="text-gray-400 text-sm">
					Configure server-level AI providers and defaults. (Admin only)
				</p>
				<div class="flex gap-2">
					<Button size="sm" variant="secondary" on:click={fetchProviderHealth}>
						Refresh Health
					</Button>
					<Button size="sm" on:click={() => (showAddProviderModal = true)}>
						Add Provider
					</Button>
				</div>
			</div>

			<!-- Provider Types Info -->
			<div class="mb-6">
				<h3 class="text-lg font-medium mb-3">Supported Providers</h3>
				<div class="grid grid-cols-2 gap-3">
					{#each $providerTypes as providerType}
						<div class="p-3 bg-gray-800 rounded-lg text-sm">
							<div class="font-medium">{providerType.name}</div>
							<div class="text-gray-400 text-xs mb-2">{providerType.description}</div>
							<div class="flex gap-2 flex-wrap">
								{#if providerType.is_cloud}
									<span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
										Cloud
									</span>
								{:else}
									<span class="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
										Local
									</span>
								{/if}
								{#if providerType.capabilities.streaming}
									<span class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
										Streaming
									</span>
								{/if}
								{#if providerType.capabilities.function_calling}
									<span class="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
										Tools
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Configured Providers -->
			<div class="mb-6">
				<h3 class="text-lg font-medium mb-3">Configured Providers</h3>
				{#if $aiProviders.length === 0}
					<div class="text-gray-500 text-center py-8 bg-gray-800 rounded-lg">
						No providers configured yet. Add a provider to enable AI features.
					</div>
				{:else}
					<div class="space-y-3">
						{#each $aiProviders as provider}
							{@const health = getHealthStatus(provider.name)}
							{@const healthData = $providerHealth[provider.name]}
							<div
								class="p-4 bg-gray-800 rounded-lg"
								class:opacity-50={!provider.is_enabled}
							>
								<div class="flex items-center justify-between mb-2">
									<div class="flex items-center gap-3">
										<div
											class="w-3 h-3 rounded-full {getHealthColor(health)}"
											title={healthData?.error || health}
										/>
										<div class="font-medium">{provider.display_name}</div>
										{#if provider.is_default}
											<span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
												Default
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if healthData?.latency}
											<span class="text-gray-500 text-xs">
												{formatLatency(healthData.latency)}
											</span>
										{/if}
										<Button
											size="sm"
											variant="secondary"
											on:click={() => openEditProvider(provider)}
										>
											Edit
										</Button>
										<Button
											size="sm"
											variant="danger"
											on:click={() => handleDeleteProvider(provider.id)}
										>
											Delete
										</Button>
									</div>
								</div>
								<div class="text-sm text-gray-400">
									{provider.provider_type} · Priority: {provider.priority}
									{#if provider.base_url}
										· {provider.base_url}
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Add/Edit Credential Modal -->
{#if showAddCredentialModal}
	<Modal
		title={editingCredential ? 'Update API Key' : 'Add API Key'}
		on:close={() => {
			showAddCredentialModal = false;
			editingCredential = null;
			resetCredentialForm();
		}}
	>
		<form on:submit|preventDefault={handleSaveCredential} class="space-y-4">
			{#if !editingCredential}
				<div>
					<label class="block text-sm font-medium mb-1">Provider</label>
					<select
						bind:value={credentialForm.provider_id}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						required
					>
						<option value="">Select a provider...</option>
						{#each $enabledProviders as provider}
							<option value={provider.id}>{provider.display_name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div>
				<label class="block text-sm font-medium mb-1">API Key</label>
				<input
					type="password"
					bind:value={credentialForm.api_key}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					placeholder="sk-..."
				/>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Secret Key (optional)</label>
				<input
					type="password"
					bind:value={credentialForm.secret_key}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					placeholder="For AWS Bedrock"
				/>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Region (optional)</label>
				<input
					type="text"
					bind:value={credentialForm.region}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					placeholder="us-east-1"
				/>
			</div>

			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="secondary"
					on:click={() => {
						showAddCredentialModal = false;
						editingCredential = null;
						resetCredentialForm();
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={$aiLoading}>
					{editingCredential ? 'Update' : 'Save'}
				</Button>
			</div>
		</form>
	</Modal>
{/if}

<!-- Add Provider Modal -->
{#if showAddProviderModal || selectedProvider}
	<Modal
		title={selectedProvider ? 'Edit Provider' : 'Add AI Provider'}
		on:close={() => {
			showAddProviderModal = false;
			selectedProvider = null;
			resetProviderForm();
		}}
	>
		<form
			on:submit|preventDefault={selectedProvider ? handleUpdateProvider : handleCreateProvider}
			class="space-y-4"
		>
			<div>
				<label class="block text-sm font-medium mb-1">Provider Type</label>
				<select
					bind:value={providerForm.provider_type}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					disabled={!!selectedProvider}
				>
					{#each $providerTypes as pt}
						<option value={pt.type}>{pt.name}</option>
					{/each}
				</select>
				{#if selectedProviderInfo}
					<p class="text-xs text-gray-400 mt-1">{selectedProviderInfo.description}</p>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-1">Name (unique)</label>
					<input
						type="text"
						bind:value={providerForm.name}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						placeholder="my-openai"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Display Name</label>
					<input
						type="text"
						bind:value={providerForm.display_name}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						placeholder="OpenAI Production"
						required
					/>
				</div>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">
					Base URL
					{#if selectedProviderInfo?.default_base_url}
						<span class="text-gray-400 font-normal">
							(default: {selectedProviderInfo.default_base_url})
						</span>
					{/if}
				</label>
				<input
					type="url"
					bind:value={providerForm.base_url}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					placeholder="Leave empty for default"
				/>
			</div>

			{#if selectedProviderInfo?.requires_api_key}
				<div>
					<label class="block text-sm font-medium mb-1">API Key</label>
					<input
						type="password"
						bind:value={providerForm.api_key}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						placeholder={selectedProvider ? 'Leave empty to keep existing' : 'sk-...'}
					/>
				</div>
			{/if}

			<div class="grid grid-cols-3 gap-4">
				<div>
					<label class="block text-sm font-medium mb-1">Priority</label>
					<input
						type="number"
						bind:value={providerForm.priority}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						min="1"
						max="1000"
					/>
					<p class="text-xs text-gray-400 mt-1">Lower = higher priority</p>
				</div>
				<div class="flex items-center gap-2 pt-6">
					<input
						type="checkbox"
						id="is_enabled"
						bind:checked={providerForm.is_enabled}
						class="w-4 h-4"
					/>
					<label for="is_enabled" class="text-sm">Enabled</label>
				</div>
				<div class="flex items-center gap-2 pt-6">
					<input
						type="checkbox"
						id="is_default"
						bind:checked={providerForm.is_default}
						class="w-4 h-4"
					/>
					<label for="is_default" class="text-sm">Default</label>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="secondary"
					on:click={() => {
						showAddProviderModal = false;
						selectedProvider = null;
						resetProviderForm();
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={$aiLoading}>
					{selectedProvider ? 'Update' : 'Create'}
				</Button>
			</div>
		</form>
	</Modal>
{/if}

<!-- Add Routing Modal -->
{#if showAddRoutingModal}
	<Modal
		title="Add Model Routing Rule"
		on:close={() => {
			showAddRoutingModal = false;
			resetRoutingForm();
		}}
	>
		<form on:submit|preventDefault={handleSaveRouting} class="space-y-4">
			<div>
				<label class="block text-sm font-medium mb-1">Feature</label>
				<select
					bind:value={routingForm.feature}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					required
				>
					{#each $featureTypes as feature}
						<option value={feature.type}>{feature.type}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Provider</label>
				<select
					bind:value={routingForm.provider_id}
					class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
					required
				>
					<option value="">Select a provider...</option>
					{#each $enabledProviders as provider}
						<option value={provider.id}>{provider.display_name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium mb-1">Model</label>
				{#if selectedProviderModels.length > 0}
					<select
						bind:value={routingForm.model_id}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						required
					>
						<option value="">Select a model...</option>
						{#each selectedProviderModels as model}
							<option value={model.id}>{model.name}</option>
						{/each}
					</select>
				{:else}
					<input
						type="text"
						bind:value={routingForm.model_id}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						placeholder="gpt-4-turbo"
						required
					/>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-1">Priority</label>
					<input
						type="number"
						bind:value={routingForm.priority}
						class="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
						min="1"
						max="1000"
					/>
				</div>
				<div class="flex items-center gap-2 pt-6">
					<input
						type="checkbox"
						id="routing_enabled"
						bind:checked={routingForm.is_enabled}
						class="w-4 h-4"
					/>
					<label for="routing_enabled" class="text-sm">Enabled</label>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="secondary"
					on:click={() => {
						showAddRoutingModal = false;
						resetRoutingForm();
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={$aiLoading}>Create</Button>
			</div>
		</form>
	</Modal>
{/if}

<style>
	.ai-settings {
		max-width: 800px;
	}
</style>
