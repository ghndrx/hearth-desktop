import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	messages,
	addMessage,
	updateMessage,
	removeMessage,
	handleMessageCreate,
	handleMessageUpdate,
	handleMessageDelete,
	type Message
} from '../stores/messages';

describe('Messages Store Handlers', () => {
	const mockMessage: Message = {
		id: 'msg-1',
		channel_id: 'ch-1',
		author_id: 'user-1',
		author: {
			id: 'user-1',
			username: 'testuser',
			display_name: 'Test User',
			avatar: 'avatar.png',
			role_color: '#FF0000'
		},
		content: 'Test message',
		encrypted: false,
		attachments: [],
		reactions: [],
		reply_to: null,
		pinned: false,
		created_at: '2024-01-01T00:00:00Z',
		edited_at: null
	};

	const mockMessage2: Message = {
		...mockMessage,
		id: 'msg-2',
		content: 'Another message'
	};

	const mockMessage3: Message = {
		...mockMessage,
		id: 'msg-3',
		channel_id: 'ch-2',
		content: 'Different channel'
	};

	beforeEach(() => {
		messages.set({});
	});

	describe('addMessage', () => {
		it('should add a message to empty store', () => {
			addMessage(mockMessage);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1']?.[0]).toEqual(mockMessage);
		});

		it('should add messages to the same channel', () => {
			addMessage(mockMessage);
			addMessage(mockMessage2);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(2);
		});

		it('should handle multiple channels', () => {
			addMessage(mockMessage);
			addMessage(mockMessage3);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-2']).toHaveLength(1);
		});

		it('should not add duplicate messages', () => {
			addMessage(mockMessage);
			addMessage(mockMessage);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});
	});

	describe('updateMessage', () => {
		it('should update an existing message', () => {
			addMessage(mockMessage);
			const updatedMessage = {
				...mockMessage,
				content: 'Updated content',
				edited_at: '2024-01-15T11:00:00Z'
			};
			updateMessage(updatedMessage);
			const state = get(messages);
			expect(state['ch-1']?.[0]?.content).toBe('Updated content');
			expect(state['ch-1']?.[0]?.edited_at).toBe('2024-01-15T11:00:00Z');
		});

		it('should preserve other messages when updating one', () => {
			addMessage(mockMessage);
			addMessage(mockMessage2);
			const updatedMessage = {
				...mockMessage,
				content: 'Updated'
			};
			updateMessage(updatedMessage);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(2);
			expect(state['ch-1']?.[0]?.content).toBe('Updated');
			expect(state['ch-1']?.[1]?.content).toBe('Another message');
		});

		it('should not affect non-existent messages', () => {
			addMessage(mockMessage);
			const nonExistent = {
				...mockMessage,
				id: 'msg-nonexistent',
				content: 'Should not add'
			};
			updateMessage(nonExistent);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});
	});

	describe('removeMessage', () => {
		it('should remove a message by id', () => {
			addMessage(mockMessage);
			addMessage(mockMessage2);
			removeMessage('ch-1', 'msg-1');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1']?.[0]?.id).toBe('msg-2');
		});

		it('should handle removing non-existent message', () => {
			addMessage(mockMessage);
			removeMessage('ch-1', 'msg-nonexistent');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});

		it('should not affect other channels', () => {
			addMessage(mockMessage);
			addMessage(mockMessage3);
			removeMessage('ch-1', 'msg-1');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(0);
			expect(state['ch-2']).toHaveLength(1);
		});
	});

	describe('Event Handlers', () => {
		it('handleMessageCreate should add message', () => {
			handleMessageCreate(mockMessage as unknown as Record<string, unknown>);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});

		it('handleMessageUpdate should update message', () => {
			addMessage(mockMessage);
			const updated = {
				...mockMessage,
				content: 'Edited via handler'
			};
			handleMessageUpdate(updated as unknown as Record<string, unknown>);
			const state = get(messages);
			expect(state['ch-1']?.[0]?.content).toBe('Edited via handler');
		});

		it('handleMessageDelete should remove message', () => {
			addMessage(mockMessage);
			handleMessageDelete({ id: 'msg-1', channel_id: 'ch-1' });
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(0);
		});

		it('should handle rapid create/update/delete sequence', () => {
			handleMessageCreate(mockMessage as unknown as Record<string, unknown>);
			handleMessageCreate(mockMessage2 as unknown as Record<string, unknown>);
			const updated = { ...mockMessage, content: 'Updated' };
			handleMessageUpdate(updated as unknown as Record<string, unknown>);
			handleMessageDelete({ id: 'msg-2', channel_id: 'ch-1' });
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1']?.[0]?.content).toBe('Updated');
		});
	});
});
