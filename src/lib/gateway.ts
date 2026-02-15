import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { handleMessageCreate, handleMessageUpdate, handleMessageDelete } from './stores/messages';
import { playMessageNotification, playCallNotification } from './utils/sounds';

export type GatewayState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export const gatewayState = writable<GatewayState>('disconnected');

interface GatewayEvent {
	t: string;  // Event type
	d: any;     // Data
	s?: number; // Sequence
}

class Gateway {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private sequence = 0;
	
	connect(token: string) {
		if (!browser) return;
		
		gatewayState.set('connecting');
		
		const wsUrl = this.getWebSocketUrl();
		this.ws = new WebSocket(`${wsUrl}?token=${token}`);
		
		this.ws.onopen = () => {
			gatewayState.set('connected');
			this.reconnectAttempts = 0;
			this.startHeartbeat();
		};
		
		this.ws.onmessage = (event) => {
			try {
				const data: GatewayEvent = JSON.parse(event.data);
				this.handleEvent(data);
			} catch (error) {
				console.error('Failed to parse gateway message:', error);
			}
		};
		
		this.ws.onclose = (event) => {
			this.stopHeartbeat();
			
			if (event.code !== 1000) {
				this.attemptReconnect(token);
			} else {
				gatewayState.set('disconnected');
			}
		};
		
		this.ws.onerror = (error) => {
			console.error('Gateway error:', error);
		};
	}
	
	disconnect() {
		if (this.ws) {
			this.ws.close(1000);
			this.ws = null;
		}
		this.stopHeartbeat();
		gatewayState.set('disconnected');
	}
	
	send(event: GatewayEvent) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(event));
		}
	}
	
	private getWebSocketUrl(): string {
		const apiUrl = import.meta.env.VITE_API_URL || '';
		if (apiUrl.startsWith('http')) {
			return apiUrl.replace(/^http/, 'ws').replace('/api/v1', '/gateway');
		}
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${protocol}//${window.location.host}/gateway`;
	}
	
	private handleEvent(event: GatewayEvent) {
		if (event.s) {
			this.sequence = event.s;
		}
		
		switch (event.t) {
			case 'READY':
				console.log('Gateway ready');
				break;
				
			case 'MESSAGE_CREATE':
				handleMessageCreate(event.d);
				// Play notification sound for incoming messages
				if (event.d.author_id && event.d.content !== undefined) {
					playMessageNotification(event.d.author_id, event.d.content || '');
				}
				break;
				
			case 'MESSAGE_UPDATE':
				handleMessageUpdate(event.d);
				break;
				
			case 'MESSAGE_DELETE':
				handleMessageDelete(event.d);
				break;
				
			case 'TYPING_START':
				this.handleTyping(event.d);
				break;
				
			case 'PRESENCE_UPDATE':
				this.handlePresence(event.d);
				break;
			
			case 'VOICE_STATE_UPDATE':
			case 'CALL_CREATE':
			case 'CALL_RING':
				// Play call notification for incoming calls
				playCallNotification();
				break;
				
			case 'SERVER_CREATE':
			case 'SERVER_UPDATE':
			case 'SERVER_DELETE':
			case 'CHANNEL_CREATE':
			case 'CHANNEL_UPDATE':
			case 'CHANNEL_DELETE':
			case 'MEMBER_JOIN':
			case 'MEMBER_LEAVE':
			case 'MEMBER_UPDATE':
				// TODO: Handle these events
				break;
				
			default:
				console.log('Unknown gateway event:', event.t);
		}
	}
	
	private handleTyping(data: { channel_id: string; user_id: string }) {
		// TODO: Show typing indicator
		console.log(`User ${data.user_id} is typing in ${data.channel_id}`);
	}
	
	private handlePresence(data: { user_id: string; status: string }) {
		// TODO: Update presence store
		console.log(`User ${data.user_id} is now ${data.status}`);
	}
	
	private startHeartbeat() {
		this.heartbeatInterval = setInterval(() => {
			this.send({ t: 'HEARTBEAT', d: { sequence: this.sequence } });
		}, 30000);
	}
	
	private stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}
	
	private attemptReconnect(token: string) {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			gatewayState.set('disconnected');
			console.error('Max reconnection attempts reached');
			return;
		}
		
		gatewayState.set('reconnecting');
		this.reconnectAttempts++;
		
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
		console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
		
		setTimeout(() => {
			this.connect(token);
		}, delay);
	}
}

export const gateway = new Gateway();
