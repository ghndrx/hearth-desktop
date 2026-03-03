import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock ApiError class
class MockApiError extends Error {
	status: number;
	data: unknown;
	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
	}
}

// Mock $lib/api
vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn()
	},
	ApiError: MockApiError
}));

// Mock ./gateway
vi.mock('./gateway', () => ({
	gateway: {
		send: vi.fn(),
		subscribe: vi.fn(() => () => {}),
		connect: vi.fn(),
		disconnect: vi.fn(),
		on: vi.fn()
	},
	Op: {
		DISPATCH: 0,
		HEARTBEAT: 1,
		IDENTIFY: 2,
		PRESENCE_UPDATE: 3,
		VOICE_STATE_UPDATE: 4,
		RESUME: 6,
		RECONNECT: 7,
		REQUEST_GUILD_MEMBERS: 8,
		INVALID_SESSION: 9,
		HELLO: 10,
		HEARTBEAT_ACK: 11
	}
}));

import { api } from '$lib/api';
import { gateway, Op } from './gateway';
import {
	messages,
	loadingMessages,
	loadMessages,
	sendMessage,
	editMessage,
	deleteMessage,
	addReaction,
	removeReaction,
	sendTypingIndicator,
	addMessage,
	updateMessage,
	removeMessage,
	handleMessageCreate,
	handleMessageUpdate,
	handleMessageDelete,
	type Message
} from './messages';

function createMockMessage(overrides: Partial<Message> = {}): Message {
	return {
		id: 'msg-1',
		channel_id: 'ch-1',
		author_id: 'user-1',
		author: {
			id: 'user-1',
			username: 'testuser',
			display_name: 'Test User',
			avatar: null
		},
		content: 'Hello world',
		encrypted: false,
		attachments: [],
		reactions: [],
		reply_to: null,
		pinned: false,
		created_at: '2024-01-15T10:00:00Z',
		edited_at: null,
		...overrides
	};
}

describe('Messages Store', () => {
	beforeEach(() => {
		messages.set({});
		loadingMessages.set({});
		vi.clearAllMocks();
	});

	// ─── Store manipulation functions ───────────────────────────────────

	describe('addMessage', () => {
		it('adds a message to an empty channel', () => {
			const msg = createMockMessage();
			addMessage(msg);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0]).toEqual(msg);
		});

		it('appends to existing messages in a channel', () => {
			const msg1 = createMockMessage({ id: 'msg-1' });
			const msg2 = createMockMessage({ id: 'msg-2', content: 'Second' });
			addMessage(msg1);
			addMessage(msg2);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(2);
			expect(state['ch-1'][0].id).toBe('msg-1');
			expect(state['ch-1'][1].id).toBe('msg-2');
		});

		it('does not add duplicate messages (deduplication)', () => {
			const msg = createMockMessage();
			addMessage(msg);
			addMessage(msg);
			addMessage(msg);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});

		it('handles messages across multiple channels', () => {
			const msg1 = createMockMessage({ id: 'msg-1', channel_id: 'ch-1' });
			const msg2 = createMockMessage({ id: 'msg-2', channel_id: 'ch-2' });
			addMessage(msg1);
			addMessage(msg2);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-2']).toHaveLength(1);
		});
	});

	describe('updateMessage', () => {
		it('updates the content of an existing message', () => {
			const msg = createMockMessage();
			addMessage(msg);
			const updated = createMockMessage({ content: 'Edited content', edited_at: '2024-01-15T11:00:00Z' });
			updateMessage(updated);
			const state = get(messages);
			expect(state['ch-1'][0].content).toBe('Edited content');
			expect(state['ch-1'][0].edited_at).toBe('2024-01-15T11:00:00Z');
		});

		it('preserves other messages in the channel when updating', () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			addMessage(createMockMessage({ id: 'msg-2', content: 'Keep me' }));
			updateMessage(createMockMessage({ id: 'msg-1', content: 'Changed' }));
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(2);
			expect(state['ch-1'][0].content).toBe('Changed');
			expect(state['ch-1'][1].content).toBe('Keep me');
		});

		it('does not add the message if it does not exist', () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			updateMessage(createMockMessage({ id: 'msg-nonexistent', content: 'Ghost' }));
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('msg-1');
		});
	});

	describe('removeMessage', () => {
		it('removes a message by id from the correct channel', () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			addMessage(createMockMessage({ id: 'msg-2' }));
			removeMessage('ch-1', 'msg-1');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('msg-2');
		});

		it('does nothing when removing a non-existent message', () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			removeMessage('ch-1', 'msg-nonexistent');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
		});

		it('does not affect other channels', () => {
			addMessage(createMockMessage({ id: 'msg-1', channel_id: 'ch-1' }));
			addMessage(createMockMessage({ id: 'msg-2', channel_id: 'ch-2' }));
			removeMessage('ch-1', 'msg-1');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(0);
			expect(state['ch-2']).toHaveLength(1);
		});

		it('handles removing from a channel with no messages', () => {
			removeMessage('ch-nonexistent', 'msg-1');
			const state = get(messages);
			expect(state['ch-nonexistent']).toHaveLength(0);
		});
	});

	// ─── Event handler wrappers ─────────────────────────────────────────

	describe('handleMessageCreate', () => {
		it('delegates to addMessage', () => {
			const msg = createMockMessage();
			handleMessageCreate(msg as unknown as Record<string, unknown>);
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0]).toEqual(msg);
		});
	});

	describe('handleMessageUpdate', () => {
		it('delegates to updateMessage', () => {
			addMessage(createMockMessage());
			handleMessageUpdate(createMockMessage({ content: 'Updated via handler' }) as unknown as Record<string, unknown>);
			const state = get(messages);
			expect(state['ch-1'][0].content).toBe('Updated via handler');
		});
	});

	describe('handleMessageDelete', () => {
		it('delegates to removeMessage', () => {
			addMessage(createMockMessage());
			handleMessageDelete({ id: 'msg-1', channel_id: 'ch-1' });
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(0);
		});
	});

	// ─── loadMessages ───────────────────────────────────────────────────

	describe('loadMessages', () => {
		it('sets loadingMessages to true while loading', async () => {
			let resolveGet!: (value: Message[]) => void;
			vi.mocked(api.get).mockReturnValue(new Promise(r => { resolveGet = r; }));

			const promise = loadMessages('ch-1');
			expect(get(loadingMessages)['ch-1']).toBe(true);

			resolveGet([]);
			await promise;
			expect(get(loadingMessages)['ch-1']).toBe(false);
		});

		it('fetches messages and stores them in reversed order', async () => {
			const apiMessages = [
				createMockMessage({ id: 'msg-3' }),
				createMockMessage({ id: 'msg-2' }),
				createMockMessage({ id: 'msg-1' })
			];
			vi.mocked(api.get).mockResolvedValue(apiMessages);

			await loadMessages('ch-1');

			expect(api.get).toHaveBeenCalledWith('/channels/ch-1/messages?limit=50');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(3);
			// reversed order
			expect(state['ch-1'][0].id).toBe('msg-1');
			expect(state['ch-1'][1].id).toBe('msg-2');
			expect(state['ch-1'][2].id).toBe('msg-3');
		});

		it('replaces existing messages when loading without before', async () => {
			addMessage(createMockMessage({ id: 'old-msg' }));
			const apiMessages = [createMockMessage({ id: 'new-msg' })];
			vi.mocked(api.get).mockResolvedValue(apiMessages);

			await loadMessages('ch-1');

			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('new-msg');
		});

		it('passes before parameter and prepends older messages', async () => {
			addMessage(createMockMessage({ id: 'existing-msg' }));
			const olderMessages = [
				createMockMessage({ id: 'older-2' }),
				createMockMessage({ id: 'older-1' })
			];
			vi.mocked(api.get).mockResolvedValue(olderMessages);

			await loadMessages('ch-1', 'existing-msg');

			expect(api.get).toHaveBeenCalledWith('/channels/ch-1/messages?limit=50&before=existing-msg');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(3);
			// Older messages (reversed) come first, then existing
			expect(state['ch-1'][0].id).toBe('older-1');
			expect(state['ch-1'][1].id).toBe('older-2');
			expect(state['ch-1'][2].id).toBe('existing-msg');
		});

		it('sets loadingMessages to false on API error', async () => {
			vi.mocked(api.get).mockRejectedValue(new Error('Network error'));
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await loadMessages('ch-1');

			expect(get(loadingMessages)['ch-1']).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith('Failed to load messages:', expect.any(Error));
			consoleSpy.mockRestore();
		});

		it('does not modify existing messages on API error', async () => {
			addMessage(createMockMessage({ id: 'existing' }));
			vi.mocked(api.get).mockRejectedValue(new Error('Fail'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await loadMessages('ch-1');

			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('existing');
			vi.restoreAllMocks();
		});
	});

	// ─── sendMessage ────────────────────────────────────────────────────

	describe('sendMessage', () => {
		it('sends a JSON body for text-only messages', async () => {
			const returnedMsg = createMockMessage({ id: 'sent-1' });
			vi.mocked(api.post).mockResolvedValue(returnedMsg);

			const result = await sendMessage('ch-1', 'Hello!');

			expect(api.post).toHaveBeenCalledWith('/channels/ch-1/messages', { content: 'Hello!' });
			expect(result).toEqual(returnedMsg);
			// Message is added to the store
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('sent-1');
		});

		it('sends a JSON body with reply_to when replying', async () => {
			const returnedMsg = createMockMessage({ id: 'reply-1', reply_to: 'msg-original' });
			vi.mocked(api.post).mockResolvedValue(returnedMsg);

			await sendMessage('ch-1', 'Reply text', [], 'msg-original');

			expect(api.post).toHaveBeenCalledWith('/channels/ch-1/messages', {
				content: 'Reply text',
				reply_to: 'msg-original'
			});
		});

		it('sends a FormData body when attachments are present', async () => {
			const returnedMsg = createMockMessage({ id: 'attach-1' });
			vi.mocked(api.post).mockResolvedValue(returnedMsg);

			const file1 = new File(['data1'], 'file1.txt', { type: 'text/plain' });
			const file2 = new File(['data2'], 'file2.png', { type: 'image/png' });

			await sendMessage('ch-1', 'With files', [file1, file2]);

			expect(api.post).toHaveBeenCalledTimes(1);
			const [url, body] = vi.mocked(api.post).mock.calls[0];
			expect(url).toBe('/channels/ch-1/messages');
			expect(body).toBeInstanceOf(FormData);

			const formData = body as FormData;
			expect(formData.get('content')).toBe('With files');
			expect(formData.get('files[0]')).toBeInstanceOf(File);
			expect(formData.get('files[1]')).toBeInstanceOf(File);
		});

		it('includes reply_to in FormData when replying with attachments', async () => {
			const returnedMsg = createMockMessage({ id: 'attach-reply' });
			vi.mocked(api.post).mockResolvedValue(returnedMsg);

			const file = new File(['data'], 'image.png', { type: 'image/png' });
			await sendMessage('ch-1', 'Reply with file', [file], 'msg-parent');

			const formData = vi.mocked(api.post).mock.calls[0][1] as FormData;
			expect(formData.get('reply_to')).toBe('msg-parent');
		});

		it('throws on API failure and does not add message to store', async () => {
			vi.mocked(api.post).mockRejectedValue(new Error('Server error'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(sendMessage('ch-1', 'Fail')).rejects.toThrow('Server error');

			const state = get(messages);
			expect(state['ch-1']).toBeUndefined();
			vi.restoreAllMocks();
		});
	});

	// ─── editMessage ────────────────────────────────────────────────────

	describe('editMessage', () => {
		it('patches the message and updates the store', async () => {
			const original = createMockMessage({ id: 'msg-1', content: 'Original' });
			addMessage(original);
			const edited = createMockMessage({ id: 'msg-1', content: 'Edited', edited_at: '2024-01-15T12:00:00Z' });
			vi.mocked(api.patch).mockResolvedValue(edited);

			const result = await editMessage('msg-1', 'ch-1', 'Edited');

			expect(api.patch).toHaveBeenCalledWith('/channels/ch-1/messages/msg-1', { content: 'Edited' });
			expect(result).toEqual(edited);
			const state = get(messages);
			expect(state['ch-1'][0].content).toBe('Edited');
		});

		it('throws on API failure', async () => {
			vi.mocked(api.patch).mockRejectedValue(new Error('Forbidden'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(editMessage('msg-1', 'ch-1', 'Nope')).rejects.toThrow('Forbidden');
			vi.restoreAllMocks();
		});
	});

	// ─── deleteMessage ──────────────────────────────────────────────────

	describe('deleteMessage', () => {
		it('deletes via API and removes from store', async () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			addMessage(createMockMessage({ id: 'msg-2' }));
			vi.mocked(api.delete).mockResolvedValue(undefined);

			await deleteMessage('msg-1', 'ch-1');

			expect(api.delete).toHaveBeenCalledWith('/channels/ch-1/messages/msg-1');
			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			expect(state['ch-1'][0].id).toBe('msg-2');
		});

		it('throws on API failure and does not remove from store', async () => {
			addMessage(createMockMessage({ id: 'msg-1' }));
			vi.mocked(api.delete).mockRejectedValue(new Error('Not found'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(deleteMessage('msg-1', 'ch-1')).rejects.toThrow('Not found');

			const state = get(messages);
			expect(state['ch-1']).toHaveLength(1);
			vi.restoreAllMocks();
		});
	});

	// ─── addReaction ────────────────────────────────────────────────────

	describe('addReaction', () => {
		it('calls the correct API endpoint', async () => {
			vi.mocked(api.put).mockResolvedValue(undefined);

			await addReaction('msg-1', 'ch-1', '👍');

			expect(api.put).toHaveBeenCalledWith(
				'/channels/ch-1/messages/msg-1/reactions/%F0%9F%91%8D/@me'
			);
		});

		it('encodes special emoji characters in the URL', async () => {
			vi.mocked(api.put).mockResolvedValue(undefined);

			await addReaction('msg-1', 'ch-1', '❤️');

			const calledUrl = vi.mocked(api.put).mock.calls[0][0];
			expect(calledUrl).toContain('/reactions/');
			expect(calledUrl).toContain('/@me');
			// Should be URI-encoded
			expect(calledUrl).not.toContain('❤️');
		});

		it('throws on API failure', async () => {
			vi.mocked(api.put).mockRejectedValue(new Error('Rate limited'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(addReaction('msg-1', 'ch-1', '👍')).rejects.toThrow('Rate limited');
			vi.restoreAllMocks();
		});
	});

	// ─── removeReaction ─────────────────────────────────────────────────

	describe('removeReaction', () => {
		it('calls the correct API endpoint', async () => {
			vi.mocked(api.delete).mockResolvedValue(undefined);

			await removeReaction('msg-1', 'ch-1', '👍');

			expect(api.delete).toHaveBeenCalledWith(
				'/channels/ch-1/messages/msg-1/reactions/%F0%9F%91%8D/@me'
			);
		});

		it('throws on API failure', async () => {
			vi.mocked(api.delete).mockRejectedValue(new Error('Not found'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(removeReaction('msg-1', 'ch-1', '😂')).rejects.toThrow('Not found');
			vi.restoreAllMocks();
		});
	});

	// ─── sendTypingIndicator ────────────────────────────────────────────

	describe('sendTypingIndicator', () => {
		// Note: sendTypingIndicator has a module-level throttle that persists across tests.
		// We test the behavior in a single comprehensive test to handle throttle state properly.
		
		it('sends typing indicator via REST API with throttling', async () => {
			vi.useFakeTimers();
			vi.mocked(api.post).mockClear();
			vi.mocked(api.post).mockResolvedValue({});
			
			// Clear any existing throttle
			vi.advanceTimersByTime(10000);

			// First call should go through
			await sendTypingIndicator('ch-1');
			expect(api.post).toHaveBeenCalledWith('/channels/ch-1/typing');
			expect(api.post).toHaveBeenCalledTimes(1);

			// Subsequent calls should be throttled
			await sendTypingIndicator('ch-1');
			await sendTypingIndicator('ch-1');
			expect(api.post).toHaveBeenCalledTimes(1);

			// After throttle clears (8 seconds), can send again
			vi.advanceTimersByTime(8000);
			await sendTypingIndicator('ch-42');
			expect(api.post).toHaveBeenCalledWith('/channels/ch-42/typing');
			expect(api.post).toHaveBeenCalledTimes(2);
			
			vi.useRealTimers();
		});
	});

	// ─── loadingMessages store ──────────────────────────────────────────

	describe('loadingMessages store', () => {
		it('starts as an empty object', () => {
			expect(get(loadingMessages)).toEqual({});
		});

		it('tracks loading state per channel independently', async () => {
			let resolveFirst!: (value: Message[]) => void;
			let resolveSecond!: (value: Message[]) => void;
			vi.mocked(api.get)
				.mockReturnValueOnce(new Promise(r => { resolveFirst = r; }))
				.mockReturnValueOnce(new Promise(r => { resolveSecond = r; }));

			const p1 = loadMessages('ch-1');
			const p2 = loadMessages('ch-2');

			expect(get(loadingMessages)['ch-1']).toBe(true);
			expect(get(loadingMessages)['ch-2']).toBe(true);

			resolveFirst([]);
			await p1;
			expect(get(loadingMessages)['ch-1']).toBe(false);
			expect(get(loadingMessages)['ch-2']).toBe(true);

			resolveSecond([]);
			await p2;
			expect(get(loadingMessages)['ch-2']).toBe(false);
		});
	});
});
