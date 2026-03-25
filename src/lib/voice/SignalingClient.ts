import type {
	AnySignalingMessage,
	SignalingEvents,
	SignalingState,
} from './types';

type EventCallback<T extends keyof SignalingEvents> = SignalingEvents[T];

/**
 * WebSocket-based signaling client for WebRTC peer connection negotiation.
 * Handles connect/disconnect, send/receive of offers, answers, and ICE candidates,
 * with automatic reconnection logic.
 */
export class SignalingClient {
	private ws: WebSocket | null = null;
	private state: SignalingState = 'disconnected';
	private url: string = '';
	private token: string = '';
	private channelId: string = '';
	private reconnectAttempts = 0;
	private maxReconnectAttempts: number;
	private reconnectDelay: number;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private pendingMessages: string[] = [];

	constructor(options?: { maxReconnectAttempts?: number; reconnectDelay?: number }) {
		this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5;
		this.reconnectDelay = options?.reconnectDelay ?? 2000;
	}

	/** Current connection state */
	getState(): SignalingState {
		return this.state;
	}

	/** Connect to the signaling server */
	connect(url: string, token: string, channelId: string): void {
		if (this.ws) {
			this.disconnect();
		}

		this.url = url;
		this.token = token;
		this.channelId = channelId;
		this.state = 'connecting';
		this.reconnectAttempts = 0;

		this.createWebSocket();
	}

	private createWebSocket(): void {
		const separator = this.url.includes('?') ? '&' : '?';
		const wsUrl = `${this.url}${separator}token=${encodeURIComponent(this.token)}&channel_id=${encodeURIComponent(this.channelId)}`;

		try {
			this.ws = new WebSocket(wsUrl);
		} catch (err) {
			this.emit('error', new Error(`Failed to create WebSocket: ${err}`));
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			console.log('[Signaling] Connected');
			this.state = 'connected';
			this.reconnectAttempts = 0;
			this.emit('connected');
			this.flushPendingMessages();
		};

		this.ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as AnySignalingMessage;
				this.emit('message', message);
			} catch (err) {
				console.error('[Signaling] Failed to parse message:', err);
			}
		};

		this.ws.onclose = (event) => {
			console.log(`[Signaling] Disconnected: code=${event.code} reason=${event.reason}`);
			this.ws = null;

			if (this.state !== 'disconnected') {
				this.emit('disconnected', event.reason || undefined);
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			// The close event will fire after this, which handles reconnection
			this.emit('error', new Error('WebSocket connection error'));
		};
	}

	private scheduleReconnect(): void {
		if (this.state === 'disconnected') return;
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error(`[Signaling] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
			this.state = 'disconnected';
			this.emit('error', new Error('Max reconnection attempts reached'));
			return;
		}

		this.state = 'reconnecting';
		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

		console.log(`[Signaling] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
		this.emit('reconnecting', this.reconnectAttempts);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.createWebSocket();
		}, delay);
	}

	private flushPendingMessages(): void {
		const messages = this.pendingMessages.splice(0);
		for (const msg of messages) {
			this.ws?.send(msg);
		}
	}

	/** Send a signaling message. Queues if not yet connected. */
	send(message: AnySignalingMessage): void {
		const data = JSON.stringify(message);

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(data);
		} else if (this.state === 'connecting' || this.state === 'reconnecting') {
			this.pendingMessages.push(data);
		} else {
			console.warn('[Signaling] Cannot send message: not connected');
		}
	}

	/** Disconnect from the signaling server */
	disconnect(): void {
		this.state = 'disconnected';
		this.pendingMessages = [];

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.ws) {
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.onopen = null;
			this.ws.close();
			this.ws = null;
		}
	}

	/** Register an event listener */
	on<T extends keyof SignalingEvents>(event: T, callback: EventCallback<T>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const cb = callback as (...args: unknown[]) => void;
		this.listeners.get(event)!.add(cb);
		return () => {
			this.listeners.get(event)?.delete(cb);
		};
	}

	private emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach(cb => cb(...args));
	}

	/** Clean up all resources */
	destroy(): void {
		this.disconnect();
		this.listeners.clear();
	}
}
