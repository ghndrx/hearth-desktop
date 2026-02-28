import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	conversations,
	currentConversation,
	currentMessages,
	templates,
	chatLoading,
	chatError,
	streamingContent,
	isStreaming,
	activeConversations,
	pinnedConversations,
	archivedConversations,
	clearCurrentConversation,
	setCurrentConversation,
	type AIConversation,
	type AIConversationWithMessages,
	type AIChatMessage
} from './aiChat';

// Mock the API module
vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn()
	}
}));

describe('aiChat store', () => {
	const mockConversation: AIConversation = {
		id: 'conv-1',
		user_id: 'user-1',
		title: 'Test Conversation',
		temperature: 0.7,
		max_tokens: 2048,
		is_archived: false,
		is_pinned: false,
		message_count: 0,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	const mockMessage: AIChatMessage = {
		id: 'msg-1',
		conversation_id: 'conv-1',
		role: 'user',
		content: 'Hello AI',
		is_edited: false,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	const mockConversationWithMessages: AIConversationWithMessages = {
		...mockConversation,
		messages: [mockMessage]
	};

	beforeEach(() => {
		// Reset all stores to initial state
		conversations.set([]);
		currentConversation.set(null);
		templates.set([]);
		chatLoading.set(false);
		chatError.set(null);
		streamingContent.set('');
		isStreaming.set(false);
		vi.clearAllMocks();
	});

	describe('conversations store', () => {
		it('should start empty', () => {
			expect(get(conversations)).toEqual([]);
		});

		it('should update when set', () => {
			conversations.set([mockConversation]);
			expect(get(conversations)).toEqual([mockConversation]);
		});
	});

	describe('currentConversation store', () => {
		it('should start null', () => {
			expect(get(currentConversation)).toBeNull();
		});

		it('should update when set', () => {
			currentConversation.set(mockConversationWithMessages);
			expect(get(currentConversation)).toEqual(mockConversationWithMessages);
		});
	});

	describe('currentMessages derived store', () => {
		it('should return empty array when no current conversation', () => {
			expect(get(currentMessages)).toEqual([]);
		});

		it('should return messages from current conversation', () => {
			currentConversation.set(mockConversationWithMessages);
			expect(get(currentMessages)).toEqual([mockMessage]);
		});
	});

	describe('derived stores for filtering', () => {
		const pinnedConv: AIConversation = {
			...mockConversation,
			id: 'conv-pinned',
			is_pinned: true
		};
		const archivedConv: AIConversation = {
			...mockConversation,
			id: 'conv-archived',
			is_archived: true
		};

		beforeEach(() => {
			conversations.set([mockConversation, pinnedConv, archivedConv]);
		});

		it('activeConversations should filter out archived', () => {
			const active = get(activeConversations);
			expect(active).toHaveLength(2);
			expect(active.find(c => c.id === 'conv-archived')).toBeUndefined();
		});

		it('pinnedConversations should return only pinned', () => {
			const pinned = get(pinnedConversations);
			expect(pinned).toHaveLength(1);
			expect(pinned[0].id).toBe('conv-pinned');
		});

		it('archivedConversations should return only archived', () => {
			const archived = get(archivedConversations);
			expect(archived).toHaveLength(1);
			expect(archived[0].id).toBe('conv-archived');
		});
	});

	describe('clearCurrentConversation', () => {
		it('should clear the current conversation', () => {
			currentConversation.set(mockConversationWithMessages);
			expect(get(currentConversation)).not.toBeNull();
			clearCurrentConversation();
			expect(get(currentConversation)).toBeNull();
		});
	});

	describe('setCurrentConversation', () => {
		it('should set the current conversation', () => {
			expect(get(currentConversation)).toBeNull();
			setCurrentConversation(mockConversationWithMessages);
			expect(get(currentConversation)).toEqual(mockConversationWithMessages);
		});
	});

	describe('streaming state', () => {
		it('should track streaming state', () => {
			expect(get(isStreaming)).toBe(false);
			isStreaming.set(true);
			expect(get(isStreaming)).toBe(true);
		});

		it('should track streaming content', () => {
			expect(get(streamingContent)).toBe('');
			streamingContent.set('Generating response...');
			expect(get(streamingContent)).toBe('Generating response...');
		});
	});

	describe('loading and error states', () => {
		it('should track loading state', () => {
			expect(get(chatLoading)).toBe(false);
			chatLoading.set(true);
			expect(get(chatLoading)).toBe(true);
		});

		it('should track error state', () => {
			expect(get(chatError)).toBeNull();
			chatError.set('Something went wrong');
			expect(get(chatError)).toBe('Something went wrong');
		});
	});
});
