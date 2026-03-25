import type {
	SignalingMessage,
	SignalingServiceEvents,
	SignalingConnectionState,
} from './types';

type EventCallback<T extends keyof SignalingServiceEvents> = SignalingServiceEvents[T];

/**
 * WebSocket-based signaling service for exchanging SDP offers/answers
 * and ICE candidates between peers. Supports automatic reconnection
 * with exponential backoff.
 */
export class SignalingService {
	private ws: WebSocket | null = null;
	private state: SignalingConnectionState = 'disconnected';
	private url = '';
	private token = '';
	private channelId = '';
	private reconnectAttempts = 0;
	private maxReconnectAttempts: number;
	private reconnectDelayMs: number;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private pendingMessages: string[] = [];
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private readonly HEARTBEAT_INTERVAL_MS = 30000;

	constructor(options?: { maxReconnectAttempts?: number; reconnectDelayMs?: number }) {
		this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5;
		this.reconnectDelayMs = options?.reconnectDelayMs ?? 2000;
	}

	getState(): SignalingConnectionState {
		return this.state;
	}

	/**
	 * Connect to the signaling server for a specific channel.
	 */
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
			console.log('[SignalingService] Connected');
			this.state = 'connected';
			this.reconnectAttempts = 0;
			this.emit('connected');
			this.flushPendingMessages();
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as SignalingMessage;
				this.emit('message', message);
			} catch (err) {
				console.error('[SignalingService] Failed to parse message:', err);
			}
		};

		this.ws.onclose = (event) => {
			console.log(`[SignalingService] Disconnected: code=${event.code} reason=${event.reason}`);
			this.ws = null;
			this.stopHeartbeat();

			if (this.state !== 'disconnected') {
				this.emit('disconnected', event.reason || undefined);
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			this.emit('error', new Error('WebSocket connection error'));
		};
	}

	private scheduleReconnect(): void {
		if (this.state === 'disconnected') return;
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error(`[SignalingService] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
			this.state = 'disconnected';
			this.emit('error', new Error('Max reconnection attempts reached'));
			return;
		}

		this.state = 'reconnecting';
		this.reconnectAttempts++;
		const delay = this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1);

		console.log(`[SignalingService] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
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

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: 'ping' }));
			}
		}, this.HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/**
	 * Send a signaling message. Queues if not yet connected.
	 */
	send(message: SignalingMessage): void {
		const data = JSON.stringify(message);

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(data);
		} else if (this.state === 'connecting' || this.state === 'reconnecting') {
			this.pendingMessages.push(data);
		} else {
			console.warn('[SignalingService] Cannot send message: not connected');
		}
	}

	/**
	 * Disconnect from the signaling server.
	 */
	disconnect(): void {
		this.state = 'disconnected';
		this.pendingMessages = [];
		this.stopHeartbeat();

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

	on<T extends keyof SignalingServiceEvents>(event: T, callback: EventCallback<T>): () => void {
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

	destroy(): void {
		this.disconnect();
		this.listeners.clear();
	}
}
