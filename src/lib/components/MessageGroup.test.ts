import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MessageGroup from './MessageGroup.svelte';
import type { Message } from '$lib/stores/messages';

function createMockMessage(
	overrides: Partial<Message> = {}
): Message {
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

describe('MessageGroup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('should render empty container when no messages', () => {
			const { container } = render(MessageGroup, {
				props: {
					messages: []
				}
			});

			const groupContainer = container.querySelector('.message-group-container');
			expect(groupContainer).toBeTruthy();
			expect(container.querySelectorAll('.message-group')).toHaveLength(0);
		});

		it('should render single message', () => {
			const message = createMockMessage();
			const { container } = render(MessageGroup, {
				props: {
					messages: [message]
				}
			});

			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(1);
		});

		it('should render multiple messages from different authors as separate groups', () => {
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: new Date('2026-02-24T10:00:00Z').toISOString()
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-2',
					created_at: new Date('2026-02-24T10:01:00Z').toISOString(),
					author: { id: 'user-2', username: 'otheruser', display_name: null, avatar: null }
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(2);
		});
	});

	describe('message grouping logic', () => {
		it('should group messages from same author within 7 minutes', () => {
			const baseTime = new Date('2026-02-24T10:00:00Z');
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: baseTime.toISOString()
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + 3 * 60 * 1000).toISOString() // +3 minutes
				}),
				createMockMessage({
					id: 'msg-3',
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + 6 * 60 * 1000).toISOString() // +6 minutes
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			// All messages should be in one group
			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(1);
		});

		it('should NOT group messages from same author after 7+ minutes', () => {
			const baseTime = new Date('2026-02-24T10:00:00Z');
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: baseTime.toISOString()
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + 8 * 60 * 1000).toISOString() // +8 minutes
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			// Should be two separate groups
			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(2);
		});

		it('should break group when author changes even within time window', () => {
			const baseTime = new Date('2026-02-24T10:00:00Z');
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: baseTime.toISOString()
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-2',
					created_at: new Date(baseTime.getTime() + 1 * 60 * 1000).toISOString(), // +1 minute
					author: { id: 'user-2', username: 'otheruser', display_name: null, avatar: null }
				}),
				createMockMessage({
					id: 'msg-3',
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + 2 * 60 * 1000).toISOString() // +2 minutes
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			// Should be three separate groups
			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(3);
		});

		it('should handle exact 7 minute boundary', () => {
			const baseTime = new Date('2026-02-24T10:00:00Z');
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: baseTime.toISOString()
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + 7 * 60 * 1000 - 1).toISOString() // 7 minutes minus 1ms (should group)
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(1);
		});
	});

	describe('props passing', () => {
		it('should pass currentUserId to determine own messages', () => {
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1'
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages,
					currentUserId: 'user-1'
				}
			});

			expect(container.querySelector('.message-group')).toBeTruthy();
		});

		it('should pass roleColors for author name coloring', () => {
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1'
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages,
					roleColors: {
						'user-1': '#ff0000'
					}
				}
			});

			expect(container.querySelector('.message-group')).toBeTruthy();
		});

	});

	describe('events', () => {
		it('should forward delete events from child Message components', async () => {
			vi.stubGlobal('confirm', vi.fn(() => true));

			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1'
				})
			];

			const handleDelete = vi.fn();
			const { container } = render(MessageGroup, {
				props: {
					messages,
					currentUserId: 'user-1'
				},
				events: { delete: handleDelete }
			} as any);

			// Hover over the message to show action buttons
			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeTruthy();
			await fireEvent.mouseEnter(messageDiv!);

			// Click the delete button (isOwn = true since currentUserId matches author_id)
			const deleteButton = container.querySelector('button[title="Delete"]');
			expect(deleteButton).toBeTruthy();
			await fireEvent.click(deleteButton!);

			expect(handleDelete).toHaveBeenCalledTimes(1);
			expect(handleDelete.mock.calls[0][0].detail).toEqual({ messageId: 'msg-1' });

			vi.unstubAllGlobals();
		});

		it('should forward reply events from child Message components', async () => {
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1'
				})
			];

			const handleReply = vi.fn();
			const { container } = render(MessageGroup, {
				props: {
					messages,
					currentUserId: 'user-1'
				},
				events: { reply: handleReply }
			} as any);

			// Hover over the message to show action buttons
			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeTruthy();
			await fireEvent.mouseEnter(messageDiv!);

			// Click the reply button (it has title="Reply")
			const replyButton = container.querySelector('button[title="Reply"]');
			expect(replyButton).toBeTruthy();
			await fireEvent.click(replyButton!);

			expect(handleReply).toHaveBeenCalledTimes(1);
		});
	});

	describe('edge cases', () => {
		it('should handle messages with missing author gracefully', () => {
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author: undefined
				})
			];

			expect(() =>
				render(MessageGroup, {
					props: {
						messages
					}
				})
			).not.toThrow();
		});

		it('should handle very long message chains', () => {
			const baseTime = new Date('2026-02-24T10:00:00Z');
			const messages = Array.from({ length: 100 }, (_, i) =>
				createMockMessage({
					id: `msg-${i}`,
					author_id: 'user-1',
					created_at: new Date(baseTime.getTime() + i * 5 * 60 * 1000).toISOString() // 5 minutes apart
				})
			);

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			// With 5 min gaps, all 100 messages should be in one group
			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(1);
		});

		it('should handle messages out of chronological order gracefully', () => {
			const messages = [
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-1',
					created_at: new Date('2026-02-24T10:05:00Z').toISOString()
				}),
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: new Date('2026-02-24T10:00:00Z').toISOString()
				})
			];

			expect(() =>
				render(MessageGroup, {
					props: {
						messages
					}
				})
			).not.toThrow();
		});

		it('should handle rapid messages (same second)', () => {
			const timestamp = new Date('2026-02-24T10:00:00Z').toISOString();
			const messages = [
				createMockMessage({
					id: 'msg-1',
					author_id: 'user-1',
					created_at: timestamp
				}),
				createMockMessage({
					id: 'msg-2',
					author_id: 'user-1',
					created_at: timestamp
				}),
				createMockMessage({
					id: 'msg-3',
					author_id: 'user-1',
					created_at: timestamp
				})
			];

			const { container } = render(MessageGroup, {
				props: {
					messages
				}
			});

			// All same-second messages from same author should be grouped
			const groups = container.querySelectorAll('.message-group');
			expect(groups).toHaveLength(1);
		});
	});
});
