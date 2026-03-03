import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the gateway module
const mockEventHandlers = new Map<string, (data: unknown) => void>();

vi.mock('./gateway', () => ({
	gateway: {
		on: vi.fn((event: string, handler: (data: unknown) => void) => {
			mockEventHandlers.set(event, handler);
			return () => {
				mockEventHandlers.delete(event);
			};
		}),
		subscribe: vi.fn(() => () => {}),
		connect: vi.fn(),
		disconnect: vi.fn(),
		send: vi.fn()
	}
}));

describe('typing store', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		mockEventHandlers.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function importTypingStore() {
		const mod = await import('./typing');
		return mod;
	}

	it('exports typingStore with subscribe', async () => {
		const { typingStore } = await importTypingStore();
		expect(typingStore.subscribe).toBeDefined();
	});

	it('starts with empty state', async () => {
		const { typingStore } = await importTypingStore();
		const state = get(typingStore);
		expect(state.size).toBe(0);
	});

	it('adds typing user when TYPING_START event is received', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		const handler = mockEventHandlers.get('TYPING_START');
		expect(handler).toBeDefined();

		handler!({
			channel_id: 'channel-1',
			user_id: 'user-2',
			member: {
				user: {
					username: 'TestUser',
					display_name: 'Test User'
				}
			}
		});

		const state = get(typingStore);
		const channelTyping = state.get('channel-1');
		expect(channelTyping).toBeDefined();
		expect(channelTyping!.has('user-2')).toBe(true);
		expect(channelTyping!.get('user-2')!.username).toBe('TestUser');
	});

	it('ignores own typing events', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		const handler = mockEventHandlers.get('TYPING_START');
		handler!({
			channel_id: 'channel-1',
			user_id: 'current-user',
			member: { user: { username: 'Me' } }
		});

		const state = get(typingStore);
		expect(state.size).toBe(0);
	});

	it('clears user typing on MESSAGE_CREATE', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		// Add typing user
		const typingHandler = mockEventHandlers.get('TYPING_START');
		typingHandler!({
			channel_id: 'channel-1',
			user_id: 'user-2',
			member: { user: { username: 'TestUser' } }
		});

		expect(get(typingStore).get('channel-1')?.has('user-2')).toBe(true);

		// Simulate message creation
		const messageHandler = mockEventHandlers.get('MESSAGE_CREATE');
		messageHandler!({
			channel_id: 'channel-1',
			author_id: 'user-2'
		});

		const state = get(typingStore);
		expect(state.get('channel-1')).toBeUndefined();
	});

	it('removes expired typing indicators', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		const handler = mockEventHandlers.get('TYPING_START');
		handler!({
			channel_id: 'channel-1',
			user_id: 'user-2',
			member: { user: { username: 'TestUser' } }
		});

		expect(get(typingStore).get('channel-1')?.has('user-2')).toBe(true);

		// Advance past the 10s timeout + cleanup interval
		vi.advanceTimersByTime(11000);

		const state = get(typingStore);
		expect(state.get('channel-1')).toBeUndefined();
	});

	it('getTypingUsers returns users for a channel', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		const handler = mockEventHandlers.get('TYPING_START');
		handler!({
			channel_id: 'channel-1',
			user_id: 'user-2',
			member: { user: { username: 'Alice' } }
		});
		handler!({
			channel_id: 'channel-1',
			user_id: 'user-3',
			member: { user: { username: 'Bob' } }
		});

		const users = typingStore.getTypingUsers('channel-1');
		expect(users).toHaveLength(2);
		expect(users.map((u) => u.username)).toContain('Alice');
		expect(users.map((u) => u.username)).toContain('Bob');
	});

	it('getTypingUsers returns empty array for channel with no typing', async () => {
		const { typingStore } = await importTypingStore();
		const users = typingStore.getTypingUsers('nonexistent-channel');
		expect(users).toEqual([]);
	});

	it('forChannel returns a derived store', async () => {
		const { typingStore, setCurrentUserId } = await importTypingStore();
		setCurrentUserId('current-user');

		const channelTyping = typingStore.forChannel('channel-1');
		expect(get(channelTyping)).toEqual([]);

		const handler = mockEventHandlers.get('TYPING_START');
		handler!({
			channel_id: 'channel-1',
			user_id: 'user-2',
			member: { user: { username: 'Alice' } }
		});

		expect(get(channelTyping)).toHaveLength(1);
		expect(get(channelTyping)[0].username).toBe('Alice');
	});

	describe('formatTypingText', () => {
		it('returns empty string for no users', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(formatTypingText([])).toBe('');
		});

		it('formats single user', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(
				formatTypingText([{ userId: '1', username: 'Alice', startedAt: Date.now() }])
			).toBe('Alice is typing...');
		});

		it('formats two users', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(
				formatTypingText([
					{ userId: '1', username: 'Alice', startedAt: Date.now() },
					{ userId: '2', username: 'Bob', startedAt: Date.now() }
				])
			).toBe('Alice and Bob are typing...');
		});

		it('formats three users', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(
				formatTypingText([
					{ userId: '1', username: 'Alice', startedAt: Date.now() },
					{ userId: '2', username: 'Bob', startedAt: Date.now() },
					{ userId: '3', username: 'Charlie', startedAt: Date.now() }
				])
			).toBe('Alice, Bob, and Charlie are typing...');
		});

		it('formats many users', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(
				formatTypingText([
					{ userId: '1', username: 'Alice', startedAt: Date.now() },
					{ userId: '2', username: 'Bob', startedAt: Date.now() },
					{ userId: '3', username: 'Charlie', startedAt: Date.now() },
					{ userId: '4', username: 'Diana', startedAt: Date.now() }
				])
			).toBe('Alice, Bob, and 2 others are typing...');
		});

		it('uses displayName when available', async () => {
			const { formatTypingText } = await importTypingStore();
			expect(
				formatTypingText([
					{ userId: '1', username: 'alice123', displayName: 'Alice', startedAt: Date.now() }
				])
			).toBe('Alice is typing...');
		});
	});
});
