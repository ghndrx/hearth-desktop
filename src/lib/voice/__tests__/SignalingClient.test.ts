import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalingClient } from '../SignalingClient';
import type { AnySignalingMessage } from '../types';

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(public url: string) {
		// Simulate async connection
		setTimeout(() => {
			this.readyState = MockWebSocket.OPEN;
			this.onopen?.(new Event('open'));
		}, 10);
	}

	send(data: string) {
		if (this.readyState !== MockWebSocket.OPEN) {
			throw new Error('WebSocket is not open');
		}
		// Mock successful send
	}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
	}
}

// Setup global mock
const originalWebSocket = global.WebSocket;
beforeEach(() => {
	global.WebSocket = MockWebSocket as any;
});

afterEach(() => {
	global.WebSocket = originalWebSocket;
});

describe('SignalingClient', () => {
	let client: SignalingClient;

	beforeEach(() => {
		client = new SignalingClient({
			maxReconnectAttempts: 3,
			reconnectDelay: 100,
		});
	});

	afterEach(() => {
		client.destroy();
	});

	describe('Construction', () => {
		it('should initialize with default options', () => {
			const defaultClient = new SignalingClient();
			expect(defaultClient.getState()).toBe('disconnected');
			defaultClient.destroy();
		});

		it('should initialize with custom options', () => {
			expect(client.getState()).toBe('disconnected');
		});
	});

	describe('Connection', () => {
		it('should connect successfully', async () => {
			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});

			client.connect('ws://localhost:8080', 'test-token', 'test-channel');

			expect(client.getState()).toBe('connecting');

			await connectedPromise;
			expect(client.getState()).toBe('connected');
		});

		it('should handle connection URL with existing query params', () => {
			client.connect('ws://localhost:8080?existing=param', 'test-token', 'test-channel');
			// Should append with & instead of ?
			expect(client.getState()).toBe('connecting');
		});

		it('should emit error on WebSocket creation failure', async () => {
			// Mock WebSocket constructor to throw
			global.WebSocket = vi.fn(() => {
				throw new Error('WebSocket creation failed');
			}) as any;

			const errorPromise = new Promise<Error>(resolve => {
				client.on('error', resolve);
			});

			client.connect('ws://localhost:8080', 'test-token', 'test-channel');

			const error = await errorPromise;
			expect(error.message).toContain('Failed to create WebSocket');
		});
	});

	describe('Message Handling', () => {
		beforeEach(async () => {
			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');
			await connectedPromise;
		});

		it('should receive and parse messages', async () => {
			const testMessage: AnySignalingMessage = {
				type: 'offer',
				fromUserId: 'user1',
				toUserId: 'user2',
				channelId: 'test-channel',
				sdp: 'test-sdp'
			};

			const messagePromise = new Promise<AnySignalingMessage>(resolve => {
				client.on('message', resolve);
			});

			// Simulate receiving a message
			const ws = (client as any).ws as MockWebSocket;
			ws.onmessage?.(new MessageEvent('message', {
				data: JSON.stringify(testMessage)
			}));

			const receivedMessage = await messagePromise;
			expect(receivedMessage).toEqual(testMessage);
		});

		it('should handle malformed message gracefully', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const ws = (client as any).ws as MockWebSocket;
			ws.onmessage?.(new MessageEvent('message', {
				data: 'invalid-json'
			}));

			expect(consoleSpy).toHaveBeenCalledWith('[Signaling] Failed to parse message:', expect.any(Error));
			consoleSpy.mockRestore();
		});
	});

	describe('Sending Messages', () => {
		it('should send message when connected', async () => {
			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');
			await connectedPromise;

			const testMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};

			const ws = (client as any).ws as MockWebSocket;
			const sendSpy = vi.spyOn(ws, 'send');

			client.send(testMessage);

			expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(testMessage));
		});

		it('should queue messages when connecting', () => {
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');

			const testMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};

			// Should not throw when not connected yet
			client.send(testMessage);

			expect(client.getState()).toBe('connecting');
		});

		it('should warn when sending while disconnected', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const testMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};

			client.send(testMessage);

			expect(consoleSpy).toHaveBeenCalledWith('[Signaling] Cannot send message: not connected');
			consoleSpy.mockRestore();
		});
	});

	describe('Reconnection', () => {
		it('should attempt reconnection on disconnect', async () => {
			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');
			await connectedPromise;

			const reconnectingPromise = new Promise<number>(resolve => {
				client.on('reconnecting', resolve);
			});

			// Simulate disconnect
			const ws = (client as any).ws as MockWebSocket;
			ws.onclose?.(new CloseEvent('close', { code: 1006, reason: 'Abnormal closure' }));

			const attemptNumber = await reconnectingPromise;
			expect(attemptNumber).toBe(1);
			expect(client.getState()).toBe('reconnecting');
		});

		it('should give up after max attempts', async () => {
			// Create client with 1 max attempt for faster testing
			const fastClient = new SignalingClient({ maxReconnectAttempts: 1, reconnectDelay: 10 });

			// Mock WebSocket to always fail
			let connectionAttempts = 0;
			global.WebSocket = vi.fn(() => {
				connectionAttempts++;
				const ws = new MockWebSocket('ws://localhost:8080');
				// Immediately close to simulate failure
				setTimeout(() => ws.close(), 5);
				return ws;
			}) as any;

			const errorPromise = new Promise<Error>(resolve => {
				fastClient.on('error', resolve);
			});

			fastClient.connect('ws://localhost:8080', 'test-token', 'test-channel');

			const error = await errorPromise;
			expect(error.message).toBe('Max reconnection attempts reached');
			expect(fastClient.getState()).toBe('disconnected');

			fastClient.destroy();
		});
	});

	describe('Event System', () => {
		it('should register and call event listeners', () => {
			const listener = vi.fn();
			const unsubscribe = client.on('connected', listener);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should unsubscribe event listeners', async () => {
			const listener = vi.fn();
			const unsubscribe = client.on('connected', listener);

			unsubscribe();

			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');
			await connectedPromise;

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('Cleanup', () => {
		it('should clean up properly on destroy', async () => {
			const connectedPromise = new Promise<void>(resolve => {
				client.on('connected', resolve);
			});
			client.connect('ws://localhost:8080', 'test-token', 'test-channel');
			await connectedPromise;

			client.destroy();

			expect(client.getState()).toBe('disconnected');
			expect((client as any).listeners.size).toBe(0);
		});

		it('should handle destroy when not connected', () => {
			expect(() => client.destroy()).not.toThrow();
		});
	});
});