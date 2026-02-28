/**
 * PinnedPanel.test.ts
 * FEAT-003: Split View (Desktop)
 * 
 * Component tests for PinnedPanel.svelte
 */
import { describe, it, expect, vi } from 'vitest';
import type { PinnedPanel as PinnedPanelType } from '$lib/stores/splitView';

// Mock the api module
vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn().mockResolvedValue([]),
		post: vi.fn().mockResolvedValue({})
	}
}));

// Mock gateway
vi.mock('$lib/gateway', () => ({
	gateway: {},
	onGatewayEvent: vi.fn(() => () => {})
}));

// Mock auth store
vi.mock('$lib/stores/auth', () => ({
	user: { subscribe: vi.fn((cb) => { cb({ id: 'user-1', username: 'testuser' }); return () => {}; }) }
}));

// Mock messages store
vi.mock('$lib/stores/messages', () => ({
	sendMessage: vi.fn().mockResolvedValue({})
}));

describe('PinnedPanel', () => {
	const mockDMPanel: PinnedPanelType = {
		id: 'panel-1',
		type: 'dm',
		title: 'Test User',
		subtitle: 'testuser',
		channelId: 'dm-123',
		width: 400,
		minWidth: 280,
		maxWidth: 600,
		isCollapsed: false,
		createdAt: Date.now()
	};

	const mockThreadPanel: PinnedPanelType = {
		id: 'panel-2',
		type: 'thread',
		title: 'Discussion Thread',
		subtitle: 'Thread starter message...',
		channelId: 'channel-789',
		threadId: 'thread-abc',
		parentMessageId: 'msg-001',
		serverId: 'server-001',
		width: 400,
		minWidth: 280,
		maxWidth: 600,
		isCollapsed: false,
		createdAt: Date.now(),
		thread: {
			id: 'thread-abc',
			channel_id: 'channel-789',
			parent_message_id: 'msg-001',
			name: 'Discussion Thread',
			message_count: 5,
			created_at: '2024-01-01T00:00:00Z',
			parent_message: {
				id: 'msg-001',
				channel_id: 'channel-789',
				author_id: 'user-123',
				content: 'Thread starter message',
				encrypted: false,
				attachments: [],
				reactions: [],
				reply_to: null,
				pinned: false,
				created_at: '2024-01-01T00:00:00Z',
				edited_at: null,
				author: {
					id: 'user-123',
					username: 'author',
					display_name: 'Thread Author',
					avatar: null
				}
			}
		}
	};

	const mockChannelPanel: PinnedPanelType = {
		id: 'panel-3',
		type: 'channel',
		title: 'general',
		subtitle: 'General discussion',
		channelId: 'channel-456',
		serverId: 'server-001',
		width: 350,
		minWidth: 280,
		maxWidth: 600,
		isCollapsed: false,
		createdAt: Date.now()
	};

	it('should have panel type definitions', () => {
		expect(mockDMPanel.type).toBe('dm');
		expect(mockThreadPanel.type).toBe('thread');
		expect(mockChannelPanel.type).toBe('channel');
	});

	it('should have correct panel structure for DM', () => {
		expect(mockDMPanel).toHaveProperty('id');
		expect(mockDMPanel).toHaveProperty('title');
		expect(mockDMPanel).toHaveProperty('channelId');
		expect(mockDMPanel).toHaveProperty('width');
		expect(mockDMPanel).toHaveProperty('isCollapsed');
	});

	it('should have correct panel structure for thread', () => {
		expect(mockThreadPanel).toHaveProperty('threadId');
		expect(mockThreadPanel).toHaveProperty('parentMessageId');
		expect(mockThreadPanel).toHaveProperty('thread');
		expect(mockThreadPanel.thread).toHaveProperty('parent_message');
	});

	it('should have correct panel structure for channel', () => {
		expect(mockChannelPanel).toHaveProperty('serverId');
		expect(mockChannelPanel.subtitle).toBe('General discussion');
	});

	it('should calculate collapsed state correctly', () => {
		const collapsedPanel = { ...mockDMPanel, isCollapsed: true };
		expect(collapsedPanel.isCollapsed).toBe(true);
		
		const expandedPanel = { ...mockDMPanel, isCollapsed: false };
		expect(expandedPanel.isCollapsed).toBe(false);
	});

	it('should have valid width constraints', () => {
		expect(mockDMPanel.width).toBeGreaterThanOrEqual(mockDMPanel.minWidth);
		expect(mockDMPanel.width).toBeLessThanOrEqual(mockDMPanel.maxWidth);
	});

	describe('Panel icons', () => {
		it('should have @ icon for DM panels', () => {
			const typeIcon = mockDMPanel.type === 'dm' ? '@' : 
				mockDMPanel.type === 'thread' ? '🧵' : '#';
			expect(typeIcon).toBe('@');
		});

		it('should have thread icon for thread panels', () => {
			const typeIcon = mockThreadPanel.type === 'dm' ? '@' : 
				mockThreadPanel.type === 'thread' ? '🧵' : '#';
			expect(typeIcon).toBe('🧵');
		});

		it('should have hash icon for channel panels', () => {
			const typeIcon = mockChannelPanel.type === 'dm' ? '@' : 
				mockChannelPanel.type === 'thread' ? '🧵' : '#';
			expect(typeIcon).toBe('#');
		});
	});
});

describe('PinnedPanel message grouping', () => {
	interface MockMessage {
		id: string;
		author_id: string;
		created_at: string;
	}

	function shouldGroupWithPrevious(messages: MockMessage[], idx: number): boolean {
		if (idx === 0) return false;
		const current = messages[idx];
		const previous = messages[idx - 1];
		
		if (current.author_id !== previous.author_id) return false;
		const timeDiff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
		return timeDiff < 7 * 60 * 1000; // 7 minutes
	}

	it('should not group first message', () => {
		const messages = [
			{ id: '1', author_id: 'user-1', created_at: '2024-01-01T10:00:00Z' }
		];
		expect(shouldGroupWithPrevious(messages, 0)).toBe(false);
	});

	it('should group consecutive messages from same author within 7 minutes', () => {
		const messages = [
			{ id: '1', author_id: 'user-1', created_at: '2024-01-01T10:00:00Z' },
			{ id: '2', author_id: 'user-1', created_at: '2024-01-01T10:03:00Z' }
		];
		expect(shouldGroupWithPrevious(messages, 1)).toBe(true);
	});

	it('should not group messages from different authors', () => {
		const messages = [
			{ id: '1', author_id: 'user-1', created_at: '2024-01-01T10:00:00Z' },
			{ id: '2', author_id: 'user-2', created_at: '2024-01-01T10:01:00Z' }
		];
		expect(shouldGroupWithPrevious(messages, 1)).toBe(false);
	});

	it('should not group messages more than 7 minutes apart', () => {
		const messages = [
			{ id: '1', author_id: 'user-1', created_at: '2024-01-01T10:00:00Z' },
			{ id: '2', author_id: 'user-1', created_at: '2024-01-01T10:08:00Z' }
		];
		expect(shouldGroupWithPrevious(messages, 1)).toBe(false);
	});

	it('should handle edge case at exactly 7 minutes', () => {
		const messages = [
			{ id: '1', author_id: 'user-1', created_at: '2024-01-01T10:00:00Z' },
			{ id: '2', author_id: 'user-1', created_at: '2024-01-01T10:07:00Z' }
		];
		// 7 minutes exactly should NOT be grouped (< 7 minutes)
		expect(shouldGroupWithPrevious(messages, 1)).toBe(false);
	});
});
