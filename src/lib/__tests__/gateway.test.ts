import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gateway, gatewayState } from '../gateway';
import { handleMessageCreate, handleMessageUpdate, handleMessageDelete } from '../stores/messages';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

// Mock stores/messages dependency
vi.mock('../stores/messages', () => ({
	handleMessageCreate: vi.fn(),
	handleMessageUpdate: vi.fn(),
	handleMessageDelete: vi.fn()
}));

// Set VITE_API_URL so getWebSocketUrl() doesn't fall through to window.location
import.meta.env.VITE_API_URL = 'http://localhost:8080/api/v1';

describe('Gateway', () => {
	let mockWs: any;
	let originalWebSocket: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockWs = {
			send: vi.fn(),
			close: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			readyState: WebSocket.OPEN,
			onopen: null,
			onmessage: null,
			onclose: null,
			onerror: null
		};

		originalWebSocket = global.WebSocket;
		const MockWebSocket = vi.fn(() => mockWs) as any;
		MockWebSocket.CONNECTING = 0;
		MockWebSocket.OPEN = 1;
		MockWebSocket.CLOSING = 2;
		MockWebSocket.CLOSED = 3;
		global.WebSocket = MockWebSocket;
	});

	afterEach(() => {
		gateway.disconnect();
		global.WebSocket = originalWebSocket;
		vi.useRealTimers();
		vi.clearAllTimers();
	});

	describe('connect', () => {
		it('should create WebSocket connection with token', () => {
			gateway.connect('test-token');

			expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('token=test-token'));
		});

		it('should set connecting state', () => {
			const states: any[] = [];
			gatewayState.subscribe((state) => states.push(state));

			gateway.connect('test-token');

			expect(states).toContain('connecting');
		});

		it('should set connected state on open', () => {
			const states: any[] = [];
			gatewayState.subscribe((state) => states.push(state));

			gateway.connect('test-token');
			mockWs.onopen?.();

			expect(states[states.length - 1]).toBe('connected');
		});

		it('should start heartbeat on connection and send periodically', () => {
			vi.useFakeTimers();

			gateway.connect('test-token');
			mockWs.onopen?.();

			// Gateway needs HELLO message to start heartbeat
			mockWs.onmessage?.({
				data: JSON.stringify({
					op: 10, // HELLO
					d: { heartbeat_interval: 30000 }
				})
			});

			// Advance past the initial jitter (random 0-30000ms) and heartbeat interval
			vi.advanceTimersByTime(60000);

			// Verify heartbeat was sent by checking the send call
			expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"op":1'));
		});

		it('should handle message events', () => {
			gateway.connect('test-token');
			mockWs.onopen?.();

			const testMessage = {
				t: 'READY',
				d: { user_id: 'test-user' },
				s: 1
			};

			expect(() => {
				mockWs.onmessage?.({ data: JSON.stringify(testMessage) });
			}).not.toThrow();
		});

		it('should handle invalid JSON messages', () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});

			gateway.connect('test-token');
			mockWs.onopen?.();

			mockWs.onmessage?.({ data: 'invalid json' });

			expect(console.error).toHaveBeenCalledWith(
				'[Gateway] Failed to parse message:',
				expect.any(Error)
			);
		});
	});

	describe('disconnect', () => {
		it('should close WebSocket', () => {
			gateway.connect('test-token');
			gateway.disconnect();

			expect(mockWs.close).toHaveBeenCalledWith(1000, 'Client disconnect');
		});

		it('should set disconnected state', () => {
			const states: any[] = [];
			gatewayState.subscribe((state) => states.push(state));

			gateway.connect('test-token');
			mockWs.onopen?.();
			gateway.disconnect();

			expect(states[states.length - 1]).toBe('disconnected');
		});

		it('should stop heartbeat', () => {
			vi.useFakeTimers();

			gateway.connect('test-token');
			mockWs.onopen?.();
			gateway.disconnect();

			// After disconnect, advancing timers should not trigger more heartbeat sends
			const sendCountAfterDisconnect = mockWs.send.mock.calls.length;
			vi.advanceTimersByTime(60000);
			expect(mockWs.send.mock.calls.length).toBe(sendCountAfterDisconnect);

			vi.useRealTimers();
		});
	});

	describe('send', () => {
		it('should send message when WebSocket is open', () => {
			gateway.connect('test-token');
			mockWs.onopen?.();
			mockWs.readyState = WebSocket.OPEN;

			const message = { op: 0, t: 'TEST', d: {} };
			gateway.send(message);

			expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
		});

		it('should not send when WebSocket is not open', () => {
			gateway.connect('test-token');
			mockWs.readyState = WebSocket.CONNECTING;

			const message = { op: 0, t: 'TEST', d: {} };
			gateway.send(message);

			expect(mockWs.send).not.toHaveBeenCalled();
		});
	});

	describe('reconnection', () => {
		it('should attempt reconnection on close with non-1000 code', () => {
			vi.useFakeTimers();
			vi.spyOn(console, 'log').mockImplementation(() => {});

			gateway.connect('test-token');
			mockWs.onopen?.();

			// Clear the initial WebSocket constructor call count
			const initialCallCount = (global.WebSocket as any).mock.calls.length;

			// Simulate connection close with error code
			mockWs.onclose?.({ code: 1001 });

			// State should be disconnected initially
			const states: any[] = [];
			gatewayState.subscribe((state) => states.push(state));
			expect(states[states.length - 1]).toBe('disconnected');

			// Advance timer to trigger reconnection (exponential backoff starts at 1000ms)
			vi.advanceTimersByTime(1500);

			// Verify WebSocket was called again for reconnection
			expect((global.WebSocket as any).mock.calls.length).toBeGreaterThan(initialCallCount);

			vi.useRealTimers();
		});

		it('should not reconnect on normal close (1000)', () => {
			vi.useFakeTimers();
			gateway.connect('test-token');
			mockWs.onopen?.();

			const initialCallCount = (global.WebSocket as any).mock.calls.length;

			const states: any[] = [];
			gatewayState.subscribe((state) => states.push(state));

			mockWs.onclose?.({ code: 1000 });

			expect(states[states.length - 1]).toBe('disconnected');

			// Advance timer - no reconnection should happen
			vi.advanceTimersByTime(5000);
			expect((global.WebSocket as any).mock.calls.length).toBe(initialCallCount);

			vi.useRealTimers();
		});
	});

	describe('event handling', () => {
		it('should handle READY event', () => {
			vi.spyOn(console, 'log').mockImplementation(() => {});

			gateway.connect('test-token');
			mockWs.onopen?.();

			mockWs.onmessage?.({
				data: JSON.stringify({
					op: 0, // DISPATCH
					t: 'READY',
					d: { session_id: 'test-session' },
					s: 1
				})
			});

			expect(console.log).toHaveBeenCalledWith('[Gateway] Dispatch event:', 'READY');
		});

		it('should dispatch MESSAGE_CREATE events', () => {
			gateway.connect('test-token');
			mockWs.onopen?.();

			const messageData = { id: '123', content: 'Hello', channel_id: 'ch1' };
			mockWs.onmessage?.({
				data: JSON.stringify({ op: 0, t: 'MESSAGE_CREATE', d: messageData })
			});

			// Message gets normalized, so we check it was called with normalized data
			expect(handleMessageCreate).toHaveBeenCalledWith(expect.objectContaining({ id: '123' }));
		});

		it('should dispatch MESSAGE_UPDATE events', () => {
			gateway.connect('test-token');
			mockWs.onopen?.();

			const messageData = { id: '123', content: 'Updated', channel_id: 'ch1' };
			mockWs.onmessage?.({
				data: JSON.stringify({ op: 0, t: 'MESSAGE_UPDATE', d: messageData })
			});

			expect(handleMessageUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: '123' }));
		});

		it('should dispatch MESSAGE_DELETE events', () => {
			gateway.connect('test-token');
			mockWs.onopen?.();

			const deleteData = { id: '123', channel_id: 'ch1' };
			mockWs.onmessage?.({
				data: JSON.stringify({ op: 0, t: 'MESSAGE_DELETE', d: deleteData })
			});

			expect(handleMessageDelete).toHaveBeenCalledWith(deleteData);
		});

		it('should handle TYPING_START events', () => {
			vi.spyOn(console, 'log').mockImplementation(() => {});

			gateway.connect('test-token');

			const typingData = { channel_id: 'ch1', user_id: 'user1' };
			mockWs.onmessage?.({
				data: JSON.stringify({
					t: 'TYPING_START',
					d: typingData
				})
			});

			expect(console.log).toHaveBeenCalledWith('[Gateway] Typing start:', typingData);
		});

		it('should handle PRESENCE_UPDATE events', () => {
			vi.spyOn(console, 'log').mockImplementation(() => {});

			gateway.connect('test-token');

			const presenceData = { user_id: 'user1', status: 'idle' };
			mockWs.onmessage?.({
				data: JSON.stringify({
					t: 'PRESENCE_UPDATE',
					d: presenceData
				})
			});

			expect(console.log).toHaveBeenCalledWith('[Gateway] Presence update:', presenceData);
		});

		it('should handle unknown event types', () => {
			vi.spyOn(console, 'log').mockImplementation(() => {});

			gateway.connect('test-token');

			const eventData = {};
			mockWs.onmessage?.({
				data: JSON.stringify({
					t: 'UNKNOWN_EVENT',
					d: eventData
				})
			});

			expect(console.log).toHaveBeenCalledWith('[Gateway] Unknown event:', 'UNKNOWN_EVENT', eventData);
		});
	});

	describe('error handling', () => {
		it('should log WebSocket errors', () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});

			gateway.connect('test-token');
			const errorEvent = { type: 'error' };
			mockWs.onerror?.(errorEvent);

			expect(console.error).toHaveBeenCalledWith('[Gateway] Error:', errorEvent);
		});
	});

	describe('getWebSocketUrl', () => {
		it('should generate correct ws:// URL from http API URL', () => {
			import.meta.env.VITE_API_URL = 'http://localhost:8080/api/v1';

			gateway.connect('test-token');

			const wsUrl = (global.WebSocket as any).mock.calls[0][0];
			expect(wsUrl).toContain('ws://');
			expect(wsUrl).toContain('/gateway');
		});
	});
});
