import { writable, get } from 'svelte/store';
import type { WSEvent, WSEventType } from '$lib/types';
import { auth } from './auth';

type EventHandler = (event: WSEvent) => void;

function createWebSocketStore() {
	const { subscribe, set, update } = writable<{
		connected: boolean;
		reconnecting: boolean;
		error: string | null;
	}>({
		connected: false,
		reconnecting: false,
		error: null
	});

	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 5;
	const reconnectDelay = 1000;

	const handlers = new Map<WSEventType, Set<EventHandler>>();

	function getWSUrl(): string {
		const token = get(auth).token;
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = window.location.host;
		return `${protocol}//${host}/ws?token=${token}`;
	}

	function handleMessage(event: MessageEvent) {
		try {
			const wsEvent: WSEvent = JSON.parse(event.data);
			const eventHandlers = handlers.get(wsEvent.type);
			if (eventHandlers) {
				eventHandlers.forEach((handler) => handler(wsEvent));
			}
		} catch (e) {
			console.error('Failed to parse WebSocket message:', e);
		}
	}

	function handleOpen() {
		console.log('WebSocket connected');
		reconnectAttempts = 0;
		set({ connected: true, reconnecting: false, error: null });
	}

	function handleClose(event: CloseEvent) {
		console.log('WebSocket closed:', event.code, event.reason);
		set({ connected: false, reconnecting: false, error: null });
		
		// Don't reconnect if intentionally closed or not authenticated
		if (event.code === 1000 || !get(auth).token) {
			return;
		}

		attemptReconnect();
	}

	function handleError(event: Event) {
		console.error('WebSocket error:', event);
		update((s) => ({ ...s, error: 'Connection error' }));
	}

	function attemptReconnect() {
		if (reconnectAttempts >= maxReconnectAttempts) {
			update((s) => ({ ...s, error: 'Max reconnection attempts reached' }));
			return;
		}

		reconnectAttempts++;
		const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
		
		update((s) => ({ ...s, reconnecting: true }));
		console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

		reconnectTimer = setTimeout(() => {
			connect();
		}, delay);
	}

	function connect() {
		if (ws?.readyState === WebSocket.OPEN) {
			return;
		}

		if (!get(auth).token) {
			console.log('No auth token, skipping WebSocket connection');
			return;
		}

		try {
			ws = new WebSocket(getWSUrl());
			ws.onopen = handleOpen;
			ws.onclose = handleClose;
			ws.onerror = handleError;
			ws.onmessage = handleMessage;
		} catch (e) {
			console.error('Failed to create WebSocket:', e);
			attemptReconnect();
		}
	}

	function disconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		
		if (ws) {
			ws.close(1000, 'User disconnect');
			ws = null;
		}
		
		set({ connected: false, reconnecting: false, error: null });
	}

	function send(type: string, data: unknown) {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type, data }));
		} else {
			console.warn('WebSocket not connected, cannot send:', type);
		}
	}

	function on(type: WSEventType, handler: EventHandler): () => void {
		if (!handlers.has(type)) {
			handlers.set(type, new Set());
		}
		handlers.get(type)!.add(handler);

		// Return unsubscribe function
		return () => {
			handlers.get(type)?.delete(handler);
		};
	}

	return {
		subscribe,
		connect,
		disconnect,
		send,
		on
	};
}

export const websocket = createWebSocketStore();
