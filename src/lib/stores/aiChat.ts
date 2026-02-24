// AI Chat Conversations Store
import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api';

// Types
export interface AIConversation {
	id: string;
	user_id: string;
	title: string;
	model_id?: string;
	provider_id?: string;
	system_prompt?: string;
	temperature: number;
	max_tokens: number;
	is_archived: boolean;
	is_pinned: boolean;
	message_count: number;
	last_message_at?: string;
	created_at: string;
	updated_at: string;
}

export interface AIConversationWithMessages extends AIConversation {
	messages: AIChatMessage[];
}

export type AIChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIChatToolCall {
	id: string;
	type: string;
	function: {
		name: string;
		arguments: string;
	};
}

export interface AIChatMessage {
	id: string;
	conversation_id: string;
	role: AIChatRole;
	content: string;
	tool_calls?: AIChatToolCall[];
	tool_call_id?: string;
	name?: string;
	tokens_used?: number;
	model_used?: string;
	provider_used?: string;
	finish_reason?: string;
	is_edited: boolean;
	parent_message_id?: string;
	error_message?: string;
	created_at: string;
	updated_at: string;
}

export interface AIChatTemplate {
	id: string;
	user_id?: string;
	name: string;
	description?: string;
	system_prompt: string;
	initial_messages?: { role: string; content: string }[];
	suggested_prompts?: string[];
	icon?: string;
	category?: string;
	is_public: boolean;
	usage_count: number;
	created_at: string;
	updated_at: string;
}

export interface AIConversationShare {
	id: string;
	conversation_id: string;
	shared_by: string;
	share_code: string;
	is_public: boolean;
	can_continue: boolean;
	expires_at?: string;
	view_count: number;
	created_at: string;
}

export interface StreamChunk {
	id: string;
	object: string;
	created: number;
	model?: string;
	choices: {
		index: number;
		delta: {
			role?: string;
			content?: string;
		};
		finish_reason?: string;
	}[];
	finish_reason?: string;
}

// Stores
export const conversations = writable<AIConversation[]>([]);
export const currentConversation = writable<AIConversationWithMessages | null>(null);
export const templates = writable<AIChatTemplate[]>([]);
export const chatLoading = writable(false);
export const chatError = writable<string | null>(null);
export const streamingContent = writable<string>('');
export const isStreaming = writable(false);

// Derived stores
export const activeConversations = derived(conversations, ($conversations) =>
	$conversations.filter((c) => !c.is_archived)
);

export const pinnedConversations = derived(conversations, ($conversations) =>
	$conversations.filter((c) => c.is_pinned)
);

export const archivedConversations = derived(conversations, ($conversations) =>
	$conversations.filter((c) => c.is_archived)
);

export const currentMessages = derived(currentConversation, ($conv) =>
	$conv?.messages || []
);

// Response types
interface ConversationsResponse {
	conversations: AIConversation[];
}

interface TemplatesResponse {
	templates: AIChatTemplate[];
}

interface MessagesResponse {
	messages: AIChatMessage[];
}

// Actions

// Conversations
export async function fetchConversations(options?: {
	includeArchived?: boolean;
	pinnedOnly?: boolean;
	search?: string;
}): Promise<void> {
	chatLoading.set(true);
	chatError.set(null);
	try {
		const params = new URLSearchParams();
		if (options?.includeArchived) params.set('include_archived', 'true');
		if (options?.pinnedOnly) params.set('pinned_only', 'true');
		if (options?.search) params.set('search', options.search);
		
		const query = params.toString();
		const url = `/ai/conversations${query ? `?${query}` : ''}`;
		
		const response = await api.get<ConversationsResponse>(url);
		conversations.set(response.conversations || []);
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to fetch conversations');
	} finally {
		chatLoading.set(false);
	}
}

export async function createConversation(data: {
	title?: string;
	model_id?: string;
	provider_id?: string;
	system_prompt?: string;
	temperature?: number;
	max_tokens?: number;
	template_id?: string;
}): Promise<AIConversation | null> {
	chatLoading.set(true);
	chatError.set(null);
	try {
		const response = await api.post<AIConversation>('/ai/conversations', data);
		// Add to conversations list
		conversations.update((convs) => [response, ...convs]);
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to create conversation');
		return null;
	} finally {
		chatLoading.set(false);
	}
}

export async function getConversation(id: string, messageLimit?: number): Promise<AIConversationWithMessages | null> {
	chatLoading.set(true);
	chatError.set(null);
	try {
		const url = messageLimit 
			? `/ai/conversations/${id}?message_limit=${messageLimit}`
			: `/ai/conversations/${id}`;
		const response = await api.get<AIConversationWithMessages>(url);
		currentConversation.set(response);
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to get conversation');
		return null;
	} finally {
		chatLoading.set(false);
	}
}

export async function updateConversation(
	id: string,
	data: {
		title?: string;
		model_id?: string;
		provider_id?: string;
		system_prompt?: string;
		temperature?: number;
		max_tokens?: number;
		is_archived?: boolean;
		is_pinned?: boolean;
	}
): Promise<AIConversation | null> {
	chatError.set(null);
	try {
		const response = await api.patch<AIConversation>(`/ai/conversations/${id}`, data);
		
		// Update in conversations list
		conversations.update((convs) =>
			convs.map((c) => (c.id === id ? response : c))
		);
		
		// Update current conversation if it's the one being edited
		currentConversation.update((current) => {
			if (current?.id === id) {
				return { ...current, ...response };
			}
			return current;
		});
		
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to update conversation');
		return null;
	}
}

export async function deleteConversation(id: string): Promise<boolean> {
	chatError.set(null);
	try {
		await api.delete(`/ai/conversations/${id}`);
		
		// Remove from conversations list
		conversations.update((convs) => convs.filter((c) => c.id !== id));
		
		// Clear current conversation if it's the one being deleted
		currentConversation.update((current) => {
			if (current?.id === id) {
				return null;
			}
			return current;
		});
		
		return true;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to delete conversation');
		return false;
	}
}

// Messages
export async function sendMessage(
	conversationId: string,
	content: string,
	options?: {
		stream?: boolean;
		model_id?: string;
		temperature?: number;
		max_tokens?: number;
	}
): Promise<AIChatMessage | null> {
	chatError.set(null);
	
	const useStream = options?.stream ?? true;
	
	if (useStream) {
		return sendMessageStream(conversationId, content, options);
	}
	
	chatLoading.set(true);
	try {
		const response = await api.post<AIChatMessage>(`/ai/conversations/${conversationId}/messages`, {
			content,
			stream: false,
			model_id: options?.model_id,
			temperature: options?.temperature,
			max_tokens: options?.max_tokens,
		});
		
		// Add both user message and response to current conversation
		currentConversation.update((conv) => {
			if (!conv || conv.id !== conversationId) return conv;
			const userMessage: AIChatMessage = {
				id: crypto.randomUUID(),
				conversation_id: conversationId,
				role: 'user',
				content,
				is_edited: false,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			return {
				...conv,
				messages: [...conv.messages, userMessage, response],
				message_count: conv.message_count + 2,
				last_message_at: response.created_at,
			};
		});
		
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to send message');
		return null;
	} finally {
		chatLoading.set(false);
	}
}

async function sendMessageStream(
	conversationId: string,
	content: string,
	options?: {
		model_id?: string;
		temperature?: number;
		max_tokens?: number;
	}
): Promise<AIChatMessage | null> {
	isStreaming.set(true);
	streamingContent.set('');
	
	// Add user message immediately
	const userMessage: AIChatMessage = {
		id: crypto.randomUUID(),
		conversation_id: conversationId,
		role: 'user',
		content,
		is_edited: false,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
	
	currentConversation.update((conv) => {
		if (!conv || conv.id !== conversationId) return conv;
		return {
			...conv,
			messages: [...conv.messages, userMessage],
			message_count: conv.message_count + 1,
		};
	});
	
	try {
		const response = await fetch(`/api/v1/ai/conversations/${conversationId}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${localStorage.getItem('token')}`,
			},
			body: JSON.stringify({
				content,
				stream: true,
				model_id: options?.model_id,
				temperature: options?.temperature,
				max_tokens: options?.max_tokens,
			}),
		});
		
		if (!response.ok) {
			throw new Error('Stream request failed');
		}
		
		const reader = response.body?.getReader();
		if (!reader) throw new Error('No reader available');
		
		const decoder = new TextDecoder();
		let accumulatedContent = '';
		let finalMessage: AIChatMessage | null = null;
		
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			
			const chunk = decoder.decode(value);
			const lines = chunk.split('\n');
			
			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6);
					try {
						const parsed = JSON.parse(data);
						
						// Check if this is a stream chunk with delta content
						if (parsed.choices?.[0]?.delta?.content) {
							accumulatedContent += parsed.choices[0].delta.content;
							streamingContent.set(accumulatedContent);
						}
						
						// Check for final message
						if (parsed.message && parsed.done) {
							finalMessage = parsed.message;
						}
					} catch {
						// Ignore parse errors for partial JSON
					}
				} else if (line.startsWith('event: done')) {
					// Stream complete
				} else if (line.startsWith('event: error')) {
					const errorLine = lines[lines.indexOf(line) + 1];
					if (errorLine?.startsWith('data: ')) {
						const errorData = JSON.parse(errorLine.slice(6));
						throw new Error(errorData.message || 'Stream error');
					}
				}
			}
		}
		
		// Add assistant message to conversation
		if (finalMessage) {
			currentConversation.update((conv) => {
				if (!conv || conv.id !== conversationId) return conv;
				return {
					...conv,
					messages: [...conv.messages, finalMessage!],
					message_count: conv.message_count + 1,
					last_message_at: finalMessage!.created_at,
				};
			});
		}
		
		return finalMessage;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Stream failed');
		return null;
	} finally {
		isStreaming.set(false);
		streamingContent.set('');
	}
}

export async function regenerateMessage(
	conversationId: string,
	messageId: string,
	stream = true
): Promise<AIChatMessage | null> {
	chatError.set(null);
	
	if (stream) {
		isStreaming.set(true);
		streamingContent.set('');
	} else {
		chatLoading.set(true);
	}
	
	try {
		if (stream) {
			const response = await fetch(
				`/api/v1/ai/conversations/${conversationId}/messages/${messageId}/regenerate?stream=true`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${localStorage.getItem('token')}`,
					},
				}
			);
			
			if (!response.ok) throw new Error('Regeneration failed');
			
			const reader = response.body?.getReader();
			if (!reader) throw new Error('No reader');
			
			const decoder = new TextDecoder();
			let accumulatedContent = '';
			let finalMessage: AIChatMessage | null = null;
			
			// Remove the old assistant message
			currentConversation.update((conv) => {
				if (!conv) return conv;
				return {
					...conv,
					messages: conv.messages.filter((m) => m.id !== messageId),
				};
			});
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value);
				for (const line of chunk.split('\n')) {
					if (line.startsWith('data: ')) {
						try {
							const parsed = JSON.parse(line.slice(6));
							if (parsed.choices?.[0]?.delta?.content) {
								accumulatedContent += parsed.choices[0].delta.content;
								streamingContent.set(accumulatedContent);
							}
							if (parsed.message && parsed.done) {
								finalMessage = parsed.message;
							}
						} catch {
							// Ignore JSON parsing errors for incomplete chunks
						}
					}
				}
			}
			
			if (finalMessage) {
				currentConversation.update((conv) => {
					if (!conv) return conv;
					return {
						...conv,
						messages: [...conv.messages, finalMessage!],
					};
				});
			}
			
			return finalMessage;
		} else {
			const response = await api.post<AIChatMessage>(
				`/ai/conversations/${conversationId}/messages/${messageId}/regenerate`
			);
			
			// Update conversation messages
			currentConversation.update((conv) => {
				if (!conv) return conv;
				const messages = conv.messages.filter((m) => m.id !== messageId);
				return {
					...conv,
					messages: [...messages, response],
				};
			});
			
			return response;
		}
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Regeneration failed');
		return null;
	} finally {
		isStreaming.set(false);
		streamingContent.set('');
		chatLoading.set(false);
	}
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
	chatError.set(null);
	try {
		await api.delete(`/ai/conversations/${conversationId}/messages/${messageId}`);
		
		currentConversation.update((conv) => {
			if (!conv || conv.id !== conversationId) return conv;
			return {
				...conv,
				messages: conv.messages.filter((m) => m.id !== messageId),
				message_count: Math.max(0, conv.message_count - 1),
			};
		});
		
		return true;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to delete message');
		return false;
	}
}

// Templates
export async function fetchTemplates(category?: string): Promise<void> {
	chatError.set(null);
	try {
		const url = category ? `/ai/templates?category=${category}` : '/ai/templates';
		const response = await api.get<TemplatesResponse>(url);
		templates.set(response.templates || []);
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to fetch templates');
	}
}

export async function createTemplate(data: {
	name: string;
	description?: string;
	system_prompt: string;
	icon?: string;
	category?: string;
	is_public?: boolean;
}): Promise<AIChatTemplate | null> {
	chatError.set(null);
	try {
		const response = await api.post<AIChatTemplate>('/ai/templates', data);
		templates.update((tmpls) => [...tmpls, response]);
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to create template');
		return null;
	}
}

export async function deleteTemplate(id: string): Promise<boolean> {
	chatError.set(null);
	try {
		await api.delete(`/ai/templates/${id}`);
		templates.update((tmpls) => tmpls.filter((t) => t.id !== id));
		return true;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to delete template');
		return false;
	}
}

// Sharing
export async function shareConversation(
	conversationId: string,
	options?: {
		is_public?: boolean;
		can_continue?: boolean;
		expires_in?: string;
	}
): Promise<AIConversationShare | null> {
	chatError.set(null);
	try {
		const response = await api.post<AIConversationShare>(
			`/ai/conversations/${conversationId}/share`,
			options || {}
		);
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to share conversation');
		return null;
	}
}

export async function getSharedConversation(shareCode: string): Promise<AIConversationWithMessages | null> {
	chatError.set(null);
	try {
		const response = await api.get<AIConversationWithMessages>(`/ai/shared/${shareCode}`);
		return response;
	} catch (err) {
		chatError.set(err instanceof Error ? err.message : 'Failed to get shared conversation');
		return null;
	}
}

// Helpers
export function clearCurrentConversation(): void {
	currentConversation.set(null);
}

export function setCurrentConversation(conv: AIConversationWithMessages): void {
	currentConversation.set(conv);
}
