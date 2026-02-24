// AI Provider and Routing Stores
import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api';

// Types
export type ProviderType = 
	| 'openai' 
	| 'anthropic' 
	| 'openrouter' 
	| 'bedrock' 
	| 'vertex_ai' 
	| 'ollama' 
	| 'llama_cpp' 
	| 'lm_studio' 
	| 'vllm' 
	| 'local_ai';

export type FeatureType = 
	| 'summary' 
	| 'search' 
	| 'chat' 
	| 'embed' 
	| 'moderate' 
	| 'translate';

export interface AIProvider {
	id: string;
	provider_type: ProviderType;
	name: string;
	display_name: string;
	base_url?: string;
	is_enabled: boolean;
	is_default: boolean;
	priority: number;
	created_at: string;
	updated_at: string;
}

export interface UserAICredential {
	id: string;
	provider_id: string;
	provider_type: ProviderType;
	is_enabled: boolean;
	has_credentials: boolean;
	last_used_at?: string;
	created_at: string;
}

export interface ModelRouting {
	id: string;
	server_id?: string;
	user_id?: string;
	feature: FeatureType;
	provider_id: string;
	model_id: string;
	priority: number;
	is_enabled: boolean;
	created_at: string;
	updated_at: string;
}

export interface ModelInfo {
	id: string;
	name: string;
	provider_type: ProviderType;
	provider_id: string;
	description?: string;
	context_window?: number;
	max_tokens?: number;
	input_cost?: number;
	output_cost?: number;
	capabilities?: string[];
}

export interface ProviderInfo {
	type: string;
	name: string;
	description: string;
	is_cloud: boolean;
	requires_api_key: boolean;
	default_base_url?: string;
	capabilities: {
		chat: boolean;
		streaming: boolean;
		embeddings: boolean;
		function_calling: boolean;
	};
}

export interface FeatureInfo {
	type: FeatureType;
	default_model: string;
}

export interface ProviderHealth {
	available: boolean;
	latency: number;
	error?: string;
	checked_at: string;
}

// Stores
export const aiProviders = writable<AIProvider[]>([]);
export const userCredentials = writable<UserAICredential[]>([]);
export const modelRoutings = writable<ModelRouting[]>([]);
export const availableModels = writable<ModelInfo[]>([]);
export const providerTypes = writable<ProviderInfo[]>([]);
export const featureTypes = writable<FeatureInfo[]>([]);
export const providerHealth = writable<Record<string, ProviderHealth>>({});
export const aiLoading = writable(false);
export const aiError = writable<string | null>(null);

// Derived stores
export const enabledProviders = derived(aiProviders, ($providers) =>
	$providers.filter((p) => p.is_enabled)
);

export const defaultProvider = derived(aiProviders, ($providers) =>
	$providers.find((p) => p.is_default && p.is_enabled)
);

export const providersByType = derived(aiProviders, ($providers) => {
	const cloudProviders: AIProvider[] = [];
	const localProviders: AIProvider[] = [];
	
	for (const provider of $providers) {
		if (['openai', 'anthropic', 'openrouter', 'bedrock', 'vertex_ai'].includes(provider.provider_type)) {
			cloudProviders.push(provider);
		} else {
			localProviders.push(provider);
		}
	}
	
	return { cloud: cloudProviders, local: localProviders };
});

export const modelsByProvider = derived(availableModels, ($models) => {
	const grouped: Record<string, ModelInfo[]> = {};
	for (const model of $models) {
		const providerId = model.provider_id;
		if (!grouped[providerId]) {
			grouped[providerId] = [];
		}
		grouped[providerId].push(model);
	}
	return grouped;
});

// Response types for API calls
interface ProvidersResponse {
	providers: AIProvider[];
}

interface ProviderTypesResponse {
	provider_types: ProviderInfo[];
}

interface FeatureTypesResponse {
	feature_types: FeatureInfo[];
}

interface CredentialsResponse {
	credentials: UserAICredential[];
}

interface RoutingResponse {
	routing: ModelRouting[];
}

interface ModelsResponse {
	models: ModelInfo[];
}

interface HealthResponse {
	providers: Record<string, ProviderHealth>;
}

// Actions
export async function fetchProviders(): Promise<void> {
	aiLoading.set(true);
	aiError.set(null);
	try {
		const response = await api.get<ProvidersResponse>('/ai/providers');
		aiProviders.set(response.providers || []);
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to fetch providers');
	} finally {
		aiLoading.set(false);
	}
}

export async function fetchProviderTypes(): Promise<void> {
	try {
		const response = await api.get<ProviderTypesResponse>('/ai/provider-types');
		providerTypes.set(response.provider_types || []);
	} catch (err) {
		console.error('Failed to fetch provider types:', err);
	}
}

export async function fetchFeatureTypes(): Promise<void> {
	try {
		const response = await api.get<FeatureTypesResponse>('/ai/feature-types');
		featureTypes.set(response.feature_types || []);
	} catch (err) {
		console.error('Failed to fetch feature types:', err);
	}
}

export async function fetchUserCredentials(): Promise<void> {
	try {
		const response = await api.get<CredentialsResponse>('/ai/credentials');
		userCredentials.set(response.credentials || []);
	} catch (err) {
		console.error('Failed to fetch user credentials:', err);
	}
}

export async function fetchModelRoutings(): Promise<void> {
	try {
		const response = await api.get<RoutingResponse>('/ai/routing');
		modelRoutings.set(response.routing || []);
	} catch (err) {
		console.error('Failed to fetch model routing:', err);
	}
}

export async function fetchAvailableModels(): Promise<void> {
	try {
		const response = await api.get<ModelsResponse>('/ai/models');
		availableModels.set(response.models || []);
	} catch (err) {
		console.error('Failed to fetch models:', err);
	}
}

export async function fetchProviderHealth(): Promise<void> {
	try {
		const response = await api.get<HealthResponse>('/ai/health');
		providerHealth.set(response.providers || {});
	} catch (err) {
		console.error('Failed to fetch provider health:', err);
	}
}

export async function createProvider(data: {
	provider_type: ProviderType;
	name: string;
	display_name: string;
	base_url?: string;
	is_enabled: boolean;
	is_default: boolean;
	priority: number;
	api_key?: string;
	secret_key?: string;
	region?: string;
	project_id?: string;
	service_account?: string;
}): Promise<AIProvider | null> {
	aiLoading.set(true);
	aiError.set(null);
	try {
		const response = await api.post('/ai/providers', data);
		await fetchProviders();
		return response as AIProvider;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to create provider');
		return null;
	} finally {
		aiLoading.set(false);
	}
}

export async function updateProvider(
	id: string,
	data: Partial<{
		name: string;
		display_name: string;
		base_url: string | null;
		is_enabled: boolean;
		is_default: boolean;
		priority: number;
		api_key?: string;
		secret_key?: string;
		region?: string;
		project_id?: string;
		service_account?: string;
	}>
): Promise<boolean> {
	aiLoading.set(true);
	aiError.set(null);
	try {
		await api.patch(`/ai/providers/${id}`, data);
		await fetchProviders();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to update provider');
		return false;
	} finally {
		aiLoading.set(false);
	}
}

export async function deleteProvider(id: string): Promise<boolean> {
	aiLoading.set(true);
	aiError.set(null);
	try {
		await api.delete(`/ai/providers/${id}`);
		await fetchProviders();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to delete provider');
		return false;
	} finally {
		aiLoading.set(false);
	}
}

export async function setUserCredentials(data: {
	provider_id: string;
	api_key?: string;
	secret_key?: string;
	region?: string;
	project_id?: string;
	service_account?: string;
}): Promise<boolean> {
	try {
		await api.post('/ai/credentials', data);
		await fetchUserCredentials();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to save credentials');
		return false;
	}
}

export async function deleteUserCredential(providerId: string): Promise<boolean> {
	try {
		await api.delete(`/ai/credentials/${providerId}`);
		await fetchUserCredentials();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to delete credential');
		return false;
	}
}

export async function setModelRouting(data: {
	server_id?: string;
	user_id?: string;
	feature: FeatureType;
	provider_id: string;
	model_id: string;
	priority: number;
	is_enabled: boolean;
}): Promise<boolean> {
	try {
		await api.post('/ai/routing', data);
		await fetchModelRoutings();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to set routing');
		return false;
	}
}

export async function deleteModelRouting(id: string): Promise<boolean> {
	try {
		await api.delete(`/ai/routing/${id}`);
		await fetchModelRoutings();
		return true;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Failed to delete routing');
		return false;
	}
}

// Chat API
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	name?: string;
	tool_call_id?: string;
}

export interface ChatResponse {
	id: string;
	model: string;
	choices: {
		index: number;
		message: ChatMessage;
		finish_reason?: string;
	}[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export async function chat(params: {
	messages: ChatMessage[];
	model?: string;
	feature?: FeatureType;
	max_tokens?: number;
	temperature?: number;
	server_id?: string;
}): Promise<ChatResponse | null> {
	try {
		const response = await api.post('/ai/chat', params);
		return response as ChatResponse;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Chat request failed');
		return null;
	}
}

export interface EmbeddingResponse {
	model: string;
	data: {
		index: number;
		embedding: number[];
	}[];
	usage?: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

export async function generateEmbeddings(params: {
	input: string[];
	model?: string;
	server_id?: string;
}): Promise<EmbeddingResponse | null> {
	try {
		const response = await api.post('/ai/embeddings', params);
		return response as EmbeddingResponse;
	} catch (err) {
		aiError.set(err instanceof Error ? err.message : 'Embedding request failed');
		return null;
	}
}

// Initialize all AI data
export async function initializeAI(): Promise<void> {
	await Promise.all([
		fetchProviderTypes(),
		fetchFeatureTypes(),
		fetchProviders(),
		fetchUserCredentials(),
		fetchModelRoutings(),
		fetchAvailableModels(),
	]);
}
