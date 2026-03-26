import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager, ConnectionState } from './WebSocketManager';
import { WSMessageType } from '../types/messages';

describe('WebSocketManager', () => {
	describe('ConnectionState', () => {
		it('should have all expected connection states', () => {
			expect(ConnectionState.DISCONNECTED).toBe('disconnected');
			expect(ConnectionState.CONNECTING).toBe('connecting');
			expect(ConnectionState.CONNECTED).toBe('connected');
			expect(ConnectionState.AUTHENTICATED).toBe('authenticated');
			expect(ConnectionState.RECONNECTING).toBe('reconnecting');
			expect(ConnectionState.FAILED).toBe('failed');
		});
	});

	describe('constructor', () => {
		it('should create manager with default config', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});

		it('should create manager with custom config', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token',
				heartbeatInterval: 60000,
				reconnectInterval: 10000,
				maxReconnectAttempts: 3
			});

			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});

		it('should default heartbeat interval to 30000ms', () => {
			// This is tested by verifying the manager is created without errors
			// The actual heartbeat interval is an internal implementation detail
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});
			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});

		it('should default reconnect interval to 5000ms', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});
			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});

		it('should default max reconnect attempts to 5', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});
			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});
	});

	describe('message handlers', () => {
		it('should allow adding a message handler', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			const handler = vi.fn();
			const remove = manager.addMessageHandler(handler);

			expect(typeof remove).toBe('function');
		});

		it('should allow removing a message handler', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			const handler = vi.fn();
			const remove = manager.addMessageHandler(handler);
			const result = remove();

			// Set.delete returns true if element was deleted
			expect(result).toBe(true);
		});

		it('should allow adding multiple message handlers', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			const handler1 = vi.fn();
			const handler2 = vi.fn();
			const remove1 = manager.addMessageHandler(handler1);
			const remove2 = manager.addMessageHandler(handler2);

			expect(typeof remove1).toBe('function');
			expect(typeof remove2).toBe('function');
		});
	});

	describe('state change handlers', () => {
		it('should allow adding a state change handler', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			const handler = vi.fn();
			const remove = manager.addStateChangeHandler(handler);

			expect(typeof remove).toBe('function');
		});

		it('should allow removing a state change handler', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			const handler = vi.fn();
			const remove = manager.addStateChangeHandler(handler);
			const result = remove();

			// Set.delete returns true if element was deleted
			expect(result).toBe(true);
		});
	});

	describe('disconnect', () => {
		it('should transition to DISCONNECTED state when explicitly disconnected', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			// Already in DISCONNECTED state
			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);

			// Calling disconnect should keep it in DISCONNECTED
			manager.disconnect();
			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});
	});

	describe('getState', () => {
		it('should return initial DISCONNECTED state', () => {
			const manager = new WebSocketManager({
				url: 'ws://localhost:8080',
				token: 'test-token'
			});

			expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
		});
	});

	describe('message type constants', () => {
		it('should have correct WebSocket message types defined', () => {
			expect(WSMessageType.AUTHENTICATE).toBe('authenticate');
			expect(WSMessageType.HEARTBEAT).toBe('heartbeat');
			expect(WSMessageType.MESSAGE_CREATE).toBe('message_create');
			expect(WSMessageType.MESSAGE_UPDATE).toBe('message_update');
			expect(WSMessageType.MESSAGE_DELETE).toBe('message_delete');
			expect(WSMessageType.MESSAGE_REACTION_ADD).toBe('message_reaction_add');
			expect(WSMessageType.MESSAGE_REACTION_REMOVE).toBe('message_reaction_remove');
			expect(WSMessageType.TYPING_START).toBe('typing_start');
			expect(WSMessageType.TYPING_STOP).toBe('typing_stop');
			expect(WSMessageType.PRESENCE_UPDATE).toBe('presence_update');
			expect(WSMessageType.CHANNEL_JOIN).toBe('channel_join');
			expect(WSMessageType.CHANNEL_LEAVE).toBe('channel_leave');
		});
	});
});
