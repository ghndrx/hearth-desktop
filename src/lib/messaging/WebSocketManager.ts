import { v4 as uuid } from 'uuid';
import type {
	WSMessage,
	WSOutgoingMessage,
	WSIncomingMessage,
	WSAuthenticate,
	WSHeartbeat
} from '../types/messages';
import { WSMessageType } from '../types/messages';

export enum ConnectionState {
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	AUTHENTICATED = 'authenticated',
	RECONNECTING = 'reconnecting',
	FAILED = 'failed'
}

export interface WebSocketConfig {
	url: string;
	token: string;
	heartbeatInterval?: number;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
}

export type MessageHandler = (message: WSIncomingMessage) => void;

export class WebSocketManager {
	private ws: WebSocket | null = null;
	private config: WebSocketConfig;
	private state: ConnectionState = ConnectionState.DISCONNECTED;
	private heartbeatTimer: number | null = null;
	private reconnectTimer: number | null = null;
	private reconnectAttempts = 0;
	private messageQueue: WSOutgoingMessage[] = [];
	private messageHandlers = new Set<MessageHandler>();
	private stateChangeHandlers = new Set<(state: ConnectionState) => void>();

	constructor(config: WebSocketConfig) {
		this.config = {
			heartbeatInterval: 30000, // 30 seconds
			reconnectInterval: 5000, // 5 seconds
			maxReconnectAttempts: 5,
			...config
		};
	}

	/**
	 * Connect to the WebSocket server
	 */
	connect(): Promise<void> {
		if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			try {
				this.setState(ConnectionState.CONNECTING);
				this.ws = new WebSocket(this.config.url);

				this.ws.onopen = () => {
					this.setState(ConnectionState.CONNECTED);
					this.reconnectAttempts = 0;
					this.authenticate();
					this.startHeartbeat();
					resolve();
				};

				this.ws.onmessage = (event) => {
					this.handleMessage(event.data);
				};

				this.ws.onclose = (event) => {
					this.handleDisconnect(event);
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.setState(ConnectionState.FAILED);
					if (this.state === ConnectionState.CONNECTING) {
						reject(new Error('Failed to connect to WebSocket'));
					}
				};
			} catch (error) {
				this.setState(ConnectionState.FAILED);
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	disconnect(): void {
		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
		}
		this.cleanup();
		this.setState(ConnectionState.DISCONNECTED);
	}

	/**
	 * Send a message through the WebSocket
	 */
	send(message: WSOutgoingMessage): void {
		if (this.state === ConnectionState.AUTHENTICATED && this.ws) {
			try {
				this.ws.send(JSON.stringify(message));
			} catch (error) {
				console.error('Failed to send message:', error);
				// Queue message for retry
				this.messageQueue.push(message);
			}
		} else {
			// Queue message until connected and authenticated
			this.messageQueue.push(message);
		}
	}

	/**
	 * Add a message handler
	 */
	addMessageHandler(handler: MessageHandler): () => void {
		this.messageHandlers.add(handler);
		return () => this.messageHandlers.delete(handler);
	}

	/**
	 * Add a state change handler
	 */
	addStateChangeHandler(handler: (state: ConnectionState) => void): () => void {
		this.stateChangeHandlers.add(handler);
		return () => this.stateChangeHandlers.delete(handler);
	}

	/**
	 * Get current connection state
	 */
	getState(): ConnectionState {
		return this.state;
	}

	/**
	 * Update the authentication token
	 */
	updateToken(token: string): void {
		this.config.token = token;
		if (this.state === ConnectionState.CONNECTED) {
			this.authenticate();
		}
	}

	private setState(newState: ConnectionState): void {
		if (this.state !== newState) {
			this.state = newState;
			this.stateChangeHandlers.forEach((handler) => handler(newState));
		}
	}

	private authenticate(): void {
		if (!this.config.token) {
			console.error('No authentication token available');
			return;
		}

		const authMessage: WSAuthenticate = {
			type: WSMessageType.AUTHENTICATE,
			data: {
				token: this.config.token
			}
		};

		if (this.ws) {
			this.ws.send(JSON.stringify(authMessage));
		}
	}

	private handleMessage(data: string): void {
		try {
			const message: WSIncomingMessage = JSON.parse(data);

			// Handle authentication success
			if (message.type === WSMessageType.HEARTBEAT) {
				// Authentication successful when we receive heartbeat response
				if (this.state === ConnectionState.CONNECTED) {
					this.setState(ConnectionState.AUTHENTICATED);
					this.flushMessageQueue();
				}
				return;
			}

			// Forward message to handlers
			this.messageHandlers.forEach((handler) => {
				try {
					handler(message);
				} catch (error) {
					console.error('Message handler error:', error);
				}
			});
		} catch (error) {
			console.error('Failed to parse WebSocket message:', error);
		}
	}

	private handleDisconnect(event: CloseEvent): void {
		this.cleanup();

		// Don't reconnect if this was an intentional disconnect
		if (event.code === 1000) {
			this.setState(ConnectionState.DISCONNECTED);
			return;
		}

		// Attempt reconnection
		if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
			this.setState(ConnectionState.RECONNECTING);
			this.scheduleReconnect();
		} else {
			this.setState(ConnectionState.FAILED);
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectAttempts++;
			this.connect().catch((error) => {
				console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
				if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
					this.scheduleReconnect();
				} else {
					this.setState(ConnectionState.FAILED);
				}
			});
		}, this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1)); // Exponential backoff
	}

	private startHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
		}

		this.heartbeatTimer = window.setInterval(() => {
			if (this.state === ConnectionState.AUTHENTICATED) {
				const heartbeat: WSHeartbeat = {
					type: WSMessageType.HEARTBEAT,
					data: null
				};
				this.send(heartbeat);
			}
		}, this.config.heartbeatInterval!);
	}

	private flushMessageQueue(): void {
		while (this.messageQueue.length > 0) {
			const message = this.messageQueue.shift();
			if (message) {
				this.send(message);
			}
		}
	}

	private cleanup(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.ws = null;
	}
}