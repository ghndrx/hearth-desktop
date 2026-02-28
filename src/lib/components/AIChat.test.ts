/**
 * AIChat Component Tests
 * FEAT-005: AI Chat Interface
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

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

// Mock navigator.clipboard
Object.defineProperty(global, 'navigator', {
	value: {
		clipboard: {
			writeText: vi.fn().mockResolvedValue(undefined)
		}
	}
});

// Mock fetch
global.fetch = vi.fn();

// Mock api module - hoisted mock
vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn().mockResolvedValue({ conversations: [], templates: [], providers: [], models: [] }),
		post: vi.fn().mockResolvedValue({}),
		put: vi.fn().mockResolvedValue({}),
		patch: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue({})
	}
}));

// Get reference to mocked API for test assertions
import { api as mockApi } from '$lib/api';

// Import stores
import {
	conversations,
	currentConversation,
	templates,
	chatLoading,
	chatError,
	isStreaming,
	streamingContent
} from '$lib/stores/aiChat';

import {
	aiProviders,
	availableModels
} from '$lib/stores/ai';

// Import component
import AIChat from './AIChat.svelte';

describe('AIChat Component (FEAT-005)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		
		// Reset stores
		conversations.set([]);
		currentConversation.set(null);
		templates.set([]);
		chatLoading.set(false);
		chatError.set(null);
		isStreaming.set(false);
		streamingContent.set('');
		aiProviders.set([]);
		availableModels.set([]);
		
		// Default mock responses
		vi.mocked(mockApi.get).mockResolvedValue({ conversations: [], templates: [], providers: [], models: [] });
	});

	describe('Welcome Screen', () => {
		it('should render welcome screen when no conversation is selected', () => {
			render(AIChat);
			
			expect(screen.getByText('👋 Welcome to AI Chat')).toBeInTheDocument();
		});

		it('should display new chat button on welcome screen', () => {
			render(AIChat);
			
			// There are two "New Chat" buttons - one in sidebar and one in welcome area
			const newChatButtons = screen.getAllByText('New Chat');
			expect(newChatButtons.length).toBeGreaterThanOrEqual(1);
		});

		it('should display use template button on welcome screen', () => {
			render(AIChat);
			
			expect(screen.getByText('Use Template')).toBeInTheDocument();
		});

		it('should show template suggestions when templates exist', async () => {
			templates.set([
				{
					id: 'tmpl-1',
					name: 'Code Assistant',
					system_prompt: 'You are a coding assistant',
					is_public: true,
					usage_count: 100,
					icon: '💻',
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			]);
			
			render(AIChat);
			
			expect(screen.getByText('Quick Start Templates')).toBeInTheDocument();
			expect(screen.getByText('Code Assistant')).toBeInTheDocument();
		});
	});

	describe('Sidebar', () => {
		it('should render sidebar with title', () => {
			render(AIChat);
			
			expect(screen.getByText('AI Chat')).toBeInTheDocument();
		});

		it('should display new chat button in sidebar', () => {
			render(AIChat);
			
			// There are two "New Chat" buttons - one in sidebar and one in welcome
			const newChatButtons = screen.getAllByText('New Chat');
			expect(newChatButtons.length).toBeGreaterThan(0);
		});

		it('should show search box', () => {
			render(AIChat);
			
			expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
		});

		it('should display conversations in sidebar', async () => {
			conversations.set([
				{
					id: 'conv-1',
					user_id: 'user-1',
					title: 'Test Conversation',
					temperature: 0.7,
					max_tokens: 2000,
					is_archived: false,
					is_pinned: false,
					message_count: 5,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			]);
			
			render(AIChat);
			
			expect(screen.getByText('Test Conversation')).toBeInTheDocument();
		});

		it('should show pinned section when pinned conversations exist', async () => {
			conversations.set([
				{
					id: 'conv-1',
					user_id: 'user-1',
					title: 'Pinned Chat',
					temperature: 0.7,
					max_tokens: 2000,
					is_archived: false,
					is_pinned: true,
					message_count: 0,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			]);
			
			render(AIChat);
			
			expect(screen.getByText('📌 Pinned')).toBeInTheDocument();
		});

		it('should show empty state when no conversations', () => {
			render(AIChat);
			
			expect(screen.getByText('No conversations yet')).toBeInTheDocument();
			expect(screen.getByText('Start a new chat to get started')).toBeInTheDocument();
		});
	});

	describe('Chat Interface', () => {
		const mockConversation = {
			id: 'conv-1',
			user_id: 'user-1',
			title: 'Active Chat',
			temperature: 0.7,
			max_tokens: 2000,
			is_archived: false,
			is_pinned: false,
			message_count: 2,
			messages: [
				{
					id: 'msg-1',
					conversation_id: 'conv-1',
					role: 'user' as const,
					content: 'Hello, AI!',
					is_edited: false,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				},
				{
					id: 'msg-2',
					conversation_id: 'conv-1',
					role: 'assistant' as const,
					content: 'Hello! How can I help you today?',
					is_edited: false,
					created_at: '2024-01-01T00:00:01Z',
					updated_at: '2024-01-01T00:00:01Z'
				}
			],
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-01T00:00:00Z'
		};

		it('should display messages when conversation is selected', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
			expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
		});

		it('should show message input when conversation is active', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
		});

		it('should show send button hint', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument();
		});

		it('should display conversation title in header', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			expect(screen.getByText('Active Chat')).toBeInTheDocument();
		});

		it('should show user and assistant labels', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			expect(screen.getByText('You')).toBeInTheDocument();
			expect(screen.getByText('AI')).toBeInTheDocument();
		});
	});

	describe('Message Actions', () => {
		const mockConversation = {
			id: 'conv-1',
			user_id: 'user-1',
			title: 'Chat',
			temperature: 0.7,
			max_tokens: 2000,
			is_archived: false,
			is_pinned: false,
			message_count: 1,
			messages: [
				{
					id: 'msg-1',
					conversation_id: 'conv-1',
					role: 'assistant' as const,
					content: 'Test response',
					is_edited: false,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			],
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-01T00:00:00Z'
		};

		it('should have copy button for messages', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			// Copy buttons are represented by 📋 emoji
			expect(screen.getByText('📋')).toBeInTheDocument();
		});

		it('should have regenerate button for assistant messages', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			// Regenerate button is represented by 🔄 emoji
			expect(screen.getByText('🔄')).toBeInTheDocument();
		});

		it('should have delete button for messages', () => {
			currentConversation.set(mockConversation);
			
			render(AIChat);
			
			// Delete button is represented by 🗑️ emoji
			expect(screen.getByText('🗑️')).toBeInTheDocument();
		});
	});

	describe('Streaming', () => {
		it('should show streaming indicator when streaming', () => {
			currentConversation.set({
				id: 'conv-1',
				user_id: 'user-1',
				title: 'Chat',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: false,
				message_count: 0,
				messages: [],
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			});
			isStreaming.set(true);
			streamingContent.set('Partial response...');
			
			render(AIChat);
			
			expect(screen.getByText('Partial response...')).toBeInTheDocument();
		});

		it('should disable input when streaming', () => {
			currentConversation.set({
				id: 'conv-1',
				user_id: 'user-1',
				title: 'Chat',
				temperature: 0.7,
				max_tokens: 2000,
				is_archived: false,
				is_pinned: false,
				message_count: 0,
				messages: [],
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			});
			isStreaming.set(true);
			
			render(AIChat);
			
			const textarea = screen.getByPlaceholderText('Type your message...');
			expect(textarea).toBeDisabled();
		});
	});

	describe('Error Handling', () => {
		it('should display error toast when error occurs', async () => {
			const { container } = render(AIChat);
			
			// Set error after render
			chatError.set('Something went wrong');
			
			// Wait for reactivity
			await waitFor(() => {
				const errorToast = container.querySelector('.error-toast');
				expect(errorToast).not.toBeNull();
				expect(errorToast?.textContent).toContain('Something went wrong');
			});
		});
	});

	describe('Templates Modal', () => {
		it('should open templates modal when template button clicked', async () => {
			templates.set([
				{
					id: 'tmpl-1',
					name: 'Code Helper',
					description: 'Helps with coding',
					system_prompt: 'You are a coding assistant',
					is_public: true,
					usage_count: 50,
					created_at: '2024-01-01T00:00:00Z',
					updated_at: '2024-01-01T00:00:00Z'
				}
			]);
			
			render(AIChat);
			
			// Click the "Use Template" button
			const useTemplateBtn = screen.getByText('Use Template');
			await fireEvent.click(useTemplateBtn);
			
			// Modal should show
			expect(screen.getByText('Chat Templates')).toBeInTheDocument();
		});
	});

	describe('Visibility', () => {
		it('should not render when visible is false', () => {
			const { container } = render(AIChat, { props: { visible: false } });
			
			expect(container.querySelector('.ai-chat-container')).toBeNull();
		});

		it('should render when visible is true', () => {
			const { container } = render(AIChat, { props: { visible: true } });
			
			expect(container.querySelector('.ai-chat-container')).not.toBeNull();
		});
	});

	describe('Close Button', () => {
		it('should show close button when onClose is provided', () => {
			const onClose = vi.fn();
			render(AIChat, { props: { onClose } });
			
			// Close button has title="Close"
			expect(screen.getByTitle('Close')).toBeInTheDocument();
		});

		it('should call onClose when close button clicked', async () => {
			const onClose = vi.fn();
			render(AIChat, { props: { onClose } });
			
			const closeBtn = screen.getByTitle('Close');
			await fireEvent.click(closeBtn);
			
			expect(onClose).toHaveBeenCalled();
		});
	});
});
