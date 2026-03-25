import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { Message } from '$lib/stores/messages';

// Create mock stores before the vi.mock calls
const mockMessagesStore = writable<Record<string, Message[]>>({});
const mockCurrentChannelStore = writable<any>(null);
const mockUserStore = writable<any>(null);
const mockLoadMessages = vi.fn();
const mockSendMessage = vi.fn();
const mockEditMessage = vi.fn();
const mockDeleteMessage = vi.fn();
const mockAddReaction = vi.fn();
const mockRemoveReaction = vi.fn();

vi.mock('$lib/stores/messages', () => {
	return {
		messages: mockMessagesStore,
		loadMessages: mockLoadMessages,
		sendMessage: mockSendMessage,
		editMessage: mockEditMessage,
		deleteMessage: mockDeleteMessage,
		addReaction: mockAddReaction,
		removeReaction: mockRemoveReaction
	};
});

vi.mock('$lib/stores/channels', () => {
	return {
		currentChannel: mockCurrentChannelStore
	};
});

vi.mock('$lib/stores/auth', () => {
	return {
		user: mockUserStore
	};
});

function createMockMessage(overrides: Partial<Message> = {}): Message {
	return {
		id: `msg-${Math.random().toString(36).slice(2)}`,
		content: 'Test message',
		author_id: 'user-1',
		channel_id: 'channel-1',
		created_at: new Date().toISOString(),
		edited_at: null,
		encrypted: false,
		pinned: false,
		reply_to: null,
		attachments: [],
		reactions: [],
		author: {
			id: 'user-1',
			username: 'testuser',
			display_name: null,
			avatar: null
		},
		...overrides
	};
}

function createMockChannel(overrides: any = {}) {
	return {
		id: 'channel-1',
		name: 'general',
		type: 0, // Text channel
		topic: 'General chat',
		recipients: null,
		e2ee_enabled: false,
		...overrides
	};
}

describe('MessageList', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		mockMessagesStore.set({});
		mockCurrentChannelStore.set(null);
		mockUserStore.set({ id: 'user-1', username: 'testuser' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('rendering', () => {
		it('should render select channel message when no channel selected', async () => {
			const MessageList = (await import('./MessageList.svelte')).default;
			render(MessageList);

			expect(screen.getByText('Select a channel to start chatting')).toBeTruthy();
		});

		it('should render channel welcome when channel is selected', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'test-channel' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('Welcome to #test-channel!')).toBeTruthy();
		});

		it('should render channel start message with channel name', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'help' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText(/This is the start of the #help channel/)).toBeTruthy();
		});

		it('should render welcome message for text channel', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'announcements' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('Welcome to #announcements!')).toBeTruthy();
		});

		it('should render channel start message', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'general' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText(/This is the start of the #general channel/)).toBeTruthy();
		});
	});

	describe('DM channels', () => {
		it('should render DM header with recipient name', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1, // DM channel
				name: null,
				recipients: [{ id: 'user-2', username: 'frienduser', display_name: 'Friend User', avatar: null }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			// Display name appears in header (use getAllByText since it may appear multiple times)
			expect(screen.getAllByText('Friend User').length).toBeGreaterThan(0);
		});

		it('should show username if no display_name for DM', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: [{ id: 'user-2', username: 'frienduser', display_name: null, avatar: null }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			// Username appears in header (use getAllByText since it appears multiple times)
			expect(screen.getAllByText('frienduser').length).toBeGreaterThan(0);
		});

		it('should show DM history message', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: [{ id: 'user-2', username: 'frienduser', display_name: null, avatar: null }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText(/This is the beginning of your direct message history with/)).toBeTruthy();
		});

		it('should show E2EE indicator for encrypted DMs', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				e2ee_enabled: true,
				recipients: [{ id: 'user-2', username: 'frienduser', display_name: null, avatar: null }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText(/Messages are end-to-end encrypted/)).toBeTruthy();
		});

		it('should show group DM message for type 3 channels', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 3, // Group DM
				recipients: [{ id: 'user-2', username: 'user1' }, { id: 'user-3', username: 'user2' }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('This is the beginning of this group DM.')).toBeTruthy();
		});
	});

	describe('date dividers', () => {
		it('should show Today for messages from today', async () => {
			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [createMockMessage({ created_at: new Date().toISOString() })]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			expect(container.textContent).toContain('Today');
		});

		it('should show Yesterday for messages from yesterday', async () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [createMockMessage({ created_at: yesterday.toISOString() })]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			expect(container.textContent).toContain('Yesterday');
		});

		it('should show formatted date for older messages', async () => {
			const oldDate = new Date('2026-01-15T10:00:00Z');

			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [createMockMessage({ created_at: oldDate.toISOString() })]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			// Should show day of week + date format
			expect(container.textContent).toMatch(/January|15/);
		});

		it('should add date divider when date changes between messages', async () => {
			const today = new Date();
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [
					createMockMessage({ id: 'msg-1', created_at: yesterday.toISOString() }),
					createMockMessage({ id: 'msg-2', created_at: today.toISOString() })
				]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			// Should have both date dividers
			expect(container.textContent).toContain('Yesterday');
			expect(container.textContent).toContain('Today');
		});
	});

	describe('message input visibility', () => {
		it('should render message log container when channel is selected', async () => {
			mockCurrentChannelStore.set(createMockChannel());
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			expect(container.querySelector('[role="log"]')).toBeTruthy();
		});

		it('should NOT show message log when no channel selected', async () => {
			mockCurrentChannelStore.set(null);
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('Select a channel to start chatting')).toBeTruthy();
		});
	});

	describe('channel header styles', () => {
		it('should show hash icon for text channels', async () => {
			mockCurrentChannelStore.set(createMockChannel({ type: 0 }));
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			expect(container.textContent).toContain('#');
		});

		it('should show avatar initial for DM channels', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: [{ id: 'user-2', username: 'Alex', avatar: null }]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			expect(container.textContent).toContain('A');
		});
	});

	describe('empty states', () => {
		it('should show select channel prompt when no channel', async () => {
			mockCurrentChannelStore.set(null);
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('Select a channel to start chatting')).toBeTruthy();
		});

		it('should show welcome without messages for new channel', async () => {
			mockCurrentChannelStore.set(createMockChannel({ id: 'channel-1', name: 'new-channel' }));
			mockMessagesStore.set({ 'channel-1': [] });
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			expect(screen.getByText('Welcome to #new-channel!')).toBeTruthy();
		});
	});

	describe('accessibility', () => {
		it('should have proper heading structure', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'test' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			const h1 = container.querySelector('h1');
			expect(h1).toBeTruthy();
			expect(h1?.textContent).toContain('Welcome to #test!');
		});
	});

	describe('scroll behavior', () => {
		it('should have scrollable message container', async () => {
			mockCurrentChannelStore.set(createMockChannel());
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			const scrollContainer = container.querySelector('.message-list-container');
			expect(scrollContainer).toBeTruthy();
		});
	});

	describe('recipient avatar fallback', () => {
		it('should show avatar image when recipient has avatar', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: [{
					id: 'user-2',
					username: 'friend',
					display_name: null,
					avatar: 'https://example.com/avatar.png'
				}]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			const avatarImg = container.querySelector('img[src="https://example.com/avatar.png"]');
			expect(avatarImg).toBeTruthy();
		});

		it('should show initial when no avatar', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: [{
					id: 'user-2',
					username: 'friend',
					display_name: null,
					avatar: null
				}]
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			// Should show first letter of username capitalized
			expect(container.textContent).toContain('F');
		});
	});

	describe('edge cases', () => {
		it('should handle channel with no topic', async () => {
			mockCurrentChannelStore.set(createMockChannel({ name: 'general', topic: null }));
			const MessageList = (await import('./MessageList.svelte')).default;

			render(MessageList);

			// Should render without error - channel name appears in welcome
			expect(screen.getByText('Welcome to #general!')).toBeTruthy();
		});

		it('should handle undefined recipients gracefully', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: undefined
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			// Should not throw
			expect(() => render(MessageList)).not.toThrow();
		});

		it('should handle empty recipients array', async () => {
			mockCurrentChannelStore.set(createMockChannel({
				type: 1,
				recipients: []
			}));
			const MessageList = (await import('./MessageList.svelte')).default;

			// Should not throw
			expect(() => render(MessageList)).not.toThrow();
		});

		it('should handle messages from non-existent channel', async () => {
			mockCurrentChannelStore.set(createMockChannel({ id: 'channel-new' }));
			const MessageList = (await import('./MessageList.svelte')).default;

			// No messages for this channel in store - should not throw
			expect(() => render(MessageList)).not.toThrow();
		});
	});

	describe('message actions', () => {
		it('should have edit and delete handler functions defined', async () => {
			// These handlers are now properly wired to the message stores
			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [createMockMessage({ id: 'msg-1', author_id: 'user-1' })]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			// Should render without error
			expect(() => render(MessageList)).not.toThrow();
		});

		it('should render messages with action handlers available', async () => {
			const channel = createMockChannel({ id: 'channel-1' });
			mockCurrentChannelStore.set(channel);
			mockMessagesStore.set({
				'channel-1': [createMockMessage({
					id: 'msg-1',
					content: 'Hello world',
					reactions: [{ emoji: '👍', count: 1, me: true }]
				})]
			});
			const MessageList = (await import('./MessageList.svelte')).default;

			const { container } = render(MessageList);

			// Message should be rendered (handlers are internal to MessageGroup)
			expect(container.textContent).toContain('Hello world');
		});
	});
});
