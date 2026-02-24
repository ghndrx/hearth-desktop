/**
 * AI Chat Store Tests
 * FEAT-005: AI Chat Conversations
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
	}
});

// Mock fetch for streaming
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock api module
const mockApi = {
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	patch: vi.fn(),
	delete: vi.fn()
};

vi.mock('$lib/api', () => ({
	api: mockApi
}));

// Dynamic imports for store - after mocks
let conversations: typeof import('./aiChat').conversations;
let currentConversation: typeof import('./aiChat').currentConversation;
let currentMessages: typeof import('./aiChat').currentMessages;
let templates: typeof import('./aiChat').templates;
let chatLoading: typeof import('./aiChat').chatLoading;
let chatError: typeof import('./aiChat').chatError;
let streamingContent: typeof import('./aiChat').streamingContent;
let isStreaming: typeof import('./aiChat').isStreaming;
let activeConversations: typeof import('./aiChat').activeConversations;
let pinnedConversations: typeof import('./aiChat').pinnedConversations;
let archivedConversations: typeof import('./aiChat').archivedConversations;
let fetchConversations: typeof import('./aiChat').fetchConversations;
let createConversation: typeof import('./aiChat').createConversation;
let getConversation: typeof import('./aiChat').getConversation;
let updateConversation: typeof import('./aiChat').updateConversation;
let deleteConversation: typeof import('./aiChat').deleteConversation;
let sendMessage: typeof import('./aiChat').sendMessage;
let deleteMessage: typeof import('./aiChat').deleteMessage;
let fetchTemplates: typeof import('./aiChat').fetchTemplates;
let createTemplate: typeof import('./aiChat').createTemplate;
let deleteTemplate: typeof import('./aiChat').deleteTemplate;
let clearCurrentConversation: typeof import('./aiChat').clearCurrentConversation;
let setCurrentConversation: typeof import('./aiChat').setCurrentConversation;

describe('AI Chat Store (FEAT-005)', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		localStorageMock.clear();
		mockApi.get.mockReset();
		mockApi.post.mockReset();
		mockApi.patch.mockReset();
		mockApi.delete.mockReset();
		mockFetch.mockReset();
		
		// Reset modules to get fresh store state
		vi.resetModules();
		const module = await import('./aiChat');
		conversations = module.conversations;
		currentConversation = module.currentConversation;
		currentMessages = module.currentMessages;
		templates = module.templates;
		chatLoading = module.chatLoading;
		chatError = module.chatError;
		streamingContent = module.streamingContent;
		isStreaming = module.isStreaming;
		activeConversations = module.activeConversations;
		pinnedConversations = module.pinnedConversations;
		archivedConversations = module.archivedConversations;
		fetchConversations = module.fetchConversations;
		createConversation = module.createConversation;
		getConversation = module.getConversation;
		updateConversation = module.updateConversation;
		deleteConversation = module.deleteConversation;
		sendMessage = module.sendMessage;
		deleteMessage = module.deleteMessage;
		fetchTemplates = module.fetchTemplates;
		createTemplate = module.createTemplate;
		deleteTemplate = module.deleteTemplate;
		clearCurrentConversation = module.clearCurrentConversation;
		setCurrentConversation = module.setCurrentConversation;
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe('Conversations', () => {
		const mockConversation = {
			id: 'conv-1',
			user_id: 'user-1',
			title: 'Test Conversation',
			temperature: 0.7,
			max_tokens: 2000,
			is_archived: false,
			is_pinned: false,
			message_count: 0,
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-01T00:00:00Z'
		};

		it('should fetch conversations', async () => {
			mockApi.get.mockResolvedValue({ conversations: [mockConversation] });
			
			await fetchConversations();
			
			expect(mockApi.get).toHaveBeenCalledWith('/ai/conversations');
			expect(get(conversations)).toHaveLength(1);
			expect(get(conversations)[0].title).toBe('Test Conversation');
		});

		it('should create a conversation', async () => {
			mockApi.post.mockResolvedValue(mockConversation);
			
			const result = await createConversation({ title: 'New Chat' });
			
			expect(mockApi.post).toHaveBeenCalledWith('/ai/conversations', { title: 'New Chat' });
			expect(result).toEqual(mockConversation);
			expect(get(conversations)).toHaveLength(1);
		});

		it('should get a conversation with messages', async () => {
			const conversationWithMessages = {
				...mockConversation,
				messages: [
					{
						id: 'msg-1',
						conversation_id: 'conv-1',
						role: 'user',
						content: 'Hello',
						is_edited: false,
						created_at: '2024-01-01T00:00:00Z',
						updated_at: '2024-01-01T00:00:00Z'
					}
				]
			};
			
			mockApi.get.mockResolvedValue(conversationWithMessages);
			
			await getConversation('conv-1');
			
			expect(mockApi.get).toHaveBeenCalledWith('/ai/conversations/conv-1');
			expect(get(currentConversation)).toEqual(conversationWithMessages);
			expect(get(currentMessages)).toHaveLength(1);
		});

		it('should update a conversation', async () => {
			const updatedConv = { ...mockConversation, title: 'Updated Title' };
			mockApi.patch.mockResolvedValue(updatedConv);
			
			// Set initial conversation
			conversations.set([mockConversation]);
			
			const result = await updateConversation('conv-1', { title: 'Updated Title' });
			
			expect(mockApi.patch).toHaveBeenCalledWith('/ai/conversations/conv-1', { title: 'Updated Title' });
			expect(result?.title).toBe('Updated Title');
			expect(get(conversations)[0].title).toBe('Updated Title');
		});

		it('should delete a conversation', async () => {
			mockApi.delete.mockResolvedValue(undefined);
			conversations.set([mockConversation]);
			
			const result = await deleteConversation('conv-1');
			
			expect(mockApi.delete).toHaveBeenCalledWith('/ai/conversations/conv-1');
			expect(result).toBe(true);
			expect(get(conversations)).toHaveLength(0);
		});

		it('should clear current conversation when deleted', async () => {
			mockApi.delete.mockResolvedValue(undefined);
			conversations.set([mockConversation]);
			currentConversation.set({ ...mockConversation, messages: [] });
			
			await deleteConversation('conv-1');
			
			expect(get(currentConversation)).toBeNull();
		});
	});

	describe('Derived Stores', () => {
		const mockConversations = [
			{
				id: 'conv-1',
				user_id: 'user-1',
				title: 'Active',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: false,
				message_count: 0,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			},
			{
				id: 'conv-2',
				user_id: 'user-1',
				title: 'Pinned',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: true,
				message_count: 0,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			},
			{
				id: 'conv-3',
				user_id: 'user-1',
				title: 'Archived',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: true,
				is_pinned: false,
				message_count: 0,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			}
		];

		it('should filter active conversations', () => {
			conversations.set(mockConversations);
			
			expect(get(activeConversations)).toHaveLength(2);
			expect(get(activeConversations).every(c => !c.is_archived)).toBe(true);
		});

		it('should filter pinned conversations', () => {
			conversations.set(mockConversations);
			
			expect(get(pinnedConversations)).toHaveLength(1);
			expect(get(pinnedConversations)[0].title).toBe('Pinned');
		});

		it('should filter archived conversations', () => {
			conversations.set(mockConversations);
			
			expect(get(archivedConversations)).toHaveLength(1);
			expect(get(archivedConversations)[0].title).toBe('Archived');
		});
	});

	describe('Messages', () => {
		const mockConversationWithMessages = {
			id: 'conv-1',
			user_id: 'user-1',
			title: 'Test',
			temperature: 0.7,
			max_tokens: 2000,
			is_archived: false,
			is_pinned: false,
			message_count: 1,
			messages: [] as Array<{
				id: string;
				conversation_id: string;
				role: 'user' | 'assistant' | 'system' | 'tool';
				content: string;
				is_edited: boolean;
				created_at: string;
				updated_at: string;
			}>,
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-01T00:00:00Z'
		};

		it('should send a message (non-streaming)', async () => {
			const assistantResponse = {
				id: 'msg-2',
				conversation_id: 'conv-1',
				role: 'assistant' as const,
				content: 'Hello! How can I help?',
				is_edited: false,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			
			mockApi.post.mockResolvedValue(assistantResponse);
			currentConversation.set(mockConversationWithMessages);
			
			const result = await sendMessage('conv-1', 'Hello', { stream: false });
			
			expect(mockApi.post).toHaveBeenCalledWith('/ai/conversations/conv-1/messages', expect.objectContaining({
				content: 'Hello',
				stream: false
			}));
			expect(result).toEqual(assistantResponse);
		});

		it('should delete a message', async () => {
			mockApi.delete.mockResolvedValue(undefined);
			
			const convWithMessage = {
				...mockConversationWithMessages,
				messages: [{
					id: 'msg-1',
					conversation_id: 'conv-1',
					role: 'user' as const,
					content: 'Test',
					is_edited: false,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}]
			};
			currentConversation.set(convWithMessage);
			
			const result = await deleteMessage('conv-1', 'msg-1');
			
			expect(mockApi.delete).toHaveBeenCalledWith('/ai/conversations/conv-1/messages/msg-1');
			expect(result).toBe(true);
			expect(get(currentMessages)).toHaveLength(0);
		});
	});

	describe('Templates', () => {
		const mockTemplate = {
			id: 'tmpl-1',
			name: 'Code Assistant',
			description: 'Help with coding',
			system_prompt: 'You are a helpful coding assistant.',
			icon: '💻',
			category: 'Development',
			is_public: true,
			usage_count: 100,
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-01T00:00:00Z'
		};

		it('should fetch templates', async () => {
			mockApi.get.mockResolvedValue({ templates: [mockTemplate] });
			
			await fetchTemplates();
			
			expect(mockApi.get).toHaveBeenCalledWith('/ai/templates');
			expect(get(templates)).toHaveLength(1);
			expect(get(templates)[0].name).toBe('Code Assistant');
		});

		it('should fetch templates by category', async () => {
			mockApi.get.mockResolvedValue({ templates: [mockTemplate] });
			
			await fetchTemplates('Development');
			
			expect(mockApi.get).toHaveBeenCalledWith('/ai/templates?category=Development');
		});

		it('should create a template', async () => {
			mockApi.post.mockResolvedValue(mockTemplate);
			
			const result = await createTemplate({
				name: 'Code Assistant',
				system_prompt: 'You are a helpful coding assistant.'
			});
			
			expect(mockApi.post).toHaveBeenCalledWith('/ai/templates', expect.objectContaining({
				name: 'Code Assistant'
			}));
			expect(result).toEqual(mockTemplate);
			expect(get(templates)).toHaveLength(1);
		});

		it('should delete a template', async () => {
			mockApi.delete.mockResolvedValue(undefined);
			templates.set([mockTemplate]);
			
			const result = await deleteTemplate('tmpl-1');
			
			expect(mockApi.delete).toHaveBeenCalledWith('/ai/templates/tmpl-1');
			expect(result).toBe(true);
			expect(get(templates)).toHaveLength(0);
		});
	});

	describe('Helper Functions', () => {
		it('should clear current conversation', () => {
			currentConversation.set({
				id: 'conv-1',
				user_id: 'user-1',
				title: 'Test',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: false,
				message_count: 0,
				messages: [],
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			});
			
			clearCurrentConversation();
			
			expect(get(currentConversation)).toBeNull();
		});

		it('should set current conversation', () => {
			const conv = {
				id: 'conv-1',
				user_id: 'user-1',
				title: 'Test',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: false,
				message_count: 0,
				messages: [],
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};
			
			setCurrentConversation(conv);
			
			expect(get(currentConversation)).toEqual(conv);
		});
	});

	describe('Error Handling', () => {
		it('should set error when fetch fails', async () => {
			mockApi.get.mockRejectedValue(new Error('Network error'));
			
			await fetchConversations();
			
			expect(get(chatError)).toBe('Network error');
		});

		it('should set error when create fails', async () => {
			mockApi.post.mockRejectedValue(new Error('Creation failed'));
			
			const result = await createConversation({ title: 'Test' });
			
			expect(result).toBeNull();
			expect(get(chatError)).toBe('Creation failed');
		});

		it('should set error when delete fails', async () => {
			mockApi.delete.mockRejectedValue(new Error('Delete failed'));
			
			const result = await deleteConversation('conv-1');
			
			expect(result).toBe(false);
			expect(get(chatError)).toBe('Delete failed');
		});

		it('should clear error on successful operations', async () => {
			// Set an error first
			chatError.set('Previous error');
			
			mockApi.get.mockResolvedValue({ conversations: [] });
			
			await fetchConversations();
			
			expect(get(chatError)).toBeNull();
		});
	});

	describe('Loading States', () => {
		it('should set loading when fetching conversations', async () => {
			let loadingDuringFetch = false;
			
			mockApi.get.mockImplementation(async () => {
				loadingDuringFetch = get(chatLoading);
				return { conversations: [] };
			});
			
			await fetchConversations();
			
			expect(loadingDuringFetch).toBe(true);
			expect(get(chatLoading)).toBe(false);
		});

		it('should have initial streaming state', () => {
			expect(get(isStreaming)).toBe(false);
			expect(get(streamingContent)).toBe('');
		});
	});
});
