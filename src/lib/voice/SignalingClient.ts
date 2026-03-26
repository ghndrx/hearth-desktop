import { browser } from '$app/environment';
// TODO: Implement gateway store for WebSocket communication
import type {
	SignalingMessage,
	SignalingOffer,
	SignalingAnswer,
	SignalingIceCandidate,
	SignalingEvents,
} from './types';

type EventCallback<T> = (data: T) => void;

/**
 * WebSocket-based signaling client for WebRTC negotiation.
 * Uses the existing gateway connection for signaling transport,
 * with message queuing during reconnects and exponential backoff.
 */
export class SignalingClient {
	private listeners = new Map<string, Set<EventCallback<unknown>>>();
	private messageQueue: SignalingMessage[] = [];
	private cleanupFunctions: Array<() => void> = [];
	private connected = false;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private maxReconnectAttempts = 10;
	private baseReconnectDelay = 1000;
	private maxReconnectDelay = 30000;

	constructor() {
		if (!browser) return;
		this.setupGatewayListeners();
	}

	private setupGatewayListeners() {
		// TODO: Implement gateway event listeners when gateway store is available
		console.log('[SignalingClient] Gateway listeners not implemented yet');

		// Mock connection for now
		this.connected = true;
		setTimeout(() => {
			this.emit('connected', undefined as unknown as SignalingEvents['connected']);
		}, 100);
	}

	private onGatewayConnected() {
		this.connected = true;
		this.reconnectAttempts = 0;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.emit('connected', undefined as unknown as SignalingEvents['connected']);
		this.flushMessageQueue();
	}

	private flushMessageQueue() {
		while (this.messageQueue.length > 0) {
			const msg = this.messageQueue.shift()!;
			this.doSend(msg);
		}
	}

	/**
	 * Send a signaling message through the gateway.
	 * Messages are queued if the gateway is not connected.
	 */
	send(message: SignalingMessage) {
		if (!this.connected) {
			this.messageQueue.push(message);
			return;
		}
		this.doSend(message);
	}

	private doSend(message: SignalingMessage) {
		// TODO: Send signaling message through gateway when implemented
		console.log('[SignalingClient] Would send message:', message.type);
	}

	/**
	 * Send an offer to a specific peer.
	 */
	sendOffer(toUserId: string, sdp: string) {
		this.send({
			type: 'offer',
			from_user_id: '', // server fills this in
			to_user_id: toUserId,
			sdp,
		});
	}

	/**
	 * Send an answer to a specific peer.
	 */
	sendAnswer(toUserId: string, sdp: string) {
		this.send({
			type: 'answer',
			from_user_id: '',
			to_user_id: toUserId,
			sdp,
		});
	}

	/**
	 * Send an ICE candidate to a specific peer.
	 */
	sendIceCandidate(
		toUserId: string,
		candidate: string,
		sdpMid: string | null,
		sdpMLineIndex: number | null
	) {
		this.send({
			type: 'ice-candidate',
			from_user_id: '',
			to_user_id: toUserId,
			candidate,
			sdpMid,
			sdpMLineIndex,
		});
	}

	/**
	 * Schedule a reconnection attempt with exponential backoff.
	 */
	scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.emit('error', new Error('Max reconnection attempts reached'));
			return;
		}

		this.connected = false;
		this.reconnectAttempts++;

		const delay = Math.min(
			this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
			this.maxReconnectDelay
		);

		// Add jitter (0-25% of delay)
		const jitter = delay * Math.random() * 0.25;

		this.emit('reconnecting', { attempt: this.reconnectAttempts });

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			// The gateway handles its own reconnection; we just re-emit connected
			// when it comes back. If it's already connected, flush immediately.
			if (this.connected) {
				this.flushMessageQueue();
			}
		}, delay + jitter);
	}

	/**
	 * Subscribe to a signaling event.
	 */
	on<K extends keyof SignalingEvents>(event: K, callback: EventCallback<SignalingEvents[K]>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const typedCb = callback as EventCallback<unknown>;
		this.listeners.get(event)!.add(typedCb);
		return () => {
			this.listeners.get(event)?.delete(typedCb);
		};
	}

	private emit<K extends keyof SignalingEvents>(event: K, data: SignalingEvents[K]) {
		const handlers = this.listeners.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(data);
				} catch (err) {
					console.error(`[SignalingClient] Error in ${event} handler:`, err);
				}
			}
		}
	}

	/**
	 * Clean up all listeners and timers.
	 */
	destroy() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.cleanupFunctions.forEach((fn) => fn());
		this.cleanupFunctions = [];
		this.listeners.clear();
		this.messageQueue = [];
		this.connected = false;
	}
}
