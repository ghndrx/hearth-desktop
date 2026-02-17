import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { handleMessageCreate, handleMessageUpdate, handleMessageDelete } from './messages';

// Opcodes
export const Op = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  VOICE_STATE_UPDATE: 4,
  RESUME: 6,
  RECONNECT: 7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

interface GatewayMessage {
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
}

export interface GatewayState {
  connected: boolean;
  connecting: boolean;
  sessionId: string | null;
  resumeUrl: string | null;
  sequence: number;
  latency: number;
  lastHeartbeat: number;
}

// Event emitter for components to subscribe to raw gateway events
type GatewayEventHandler = (data: unknown) => void;
const globalEventHandlers = new Map<string, Set<GatewayEventHandler>>();

export function onGatewayEvent(eventType: string, handler: GatewayEventHandler): () => void {
  if (!globalEventHandlers.has(eventType)) {
    globalEventHandlers.set(eventType, new Set());
  }
  globalEventHandlers.get(eventType)!.add(handler);
  return () => {
    globalEventHandlers.get(eventType)?.delete(handler);
  };
}

function emitGatewayEvent(eventType: string, data: unknown) {
  const handlers = globalEventHandlers.get(eventType);
  if (handlers) {
    handlers.forEach(handler => handler(data));
  }
  // Also emit to wildcard listeners
  const wildcardHandlers = globalEventHandlers.get('*');
  if (wildcardHandlers) {
    wildcardHandlers.forEach(handler => handler({ type: eventType, data }));
  }
}

function createGatewayStore() {
  const state = writable<GatewayState>({
    connected: false,
    connecting: false,
    sessionId: null,
    resumeUrl: null,
    sequence: 0,
    latency: 0,
    lastHeartbeat: 0,
  });

  let ws: WebSocket | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  let currentToken: string | null = null;
  let heartbeatAcked = true;

  const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  function emit(event: string, data: unknown) {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
    // Also emit to global handlers
    emitGatewayEvent(event, data);
  }

  function on(event: string, handler: (data: unknown) => void) {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
    
    return () => {
      eventHandlers.get(event)?.delete(handler);
    };
  }

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/gateway`;
  }

  function connect(token: string) {
    if (!browser) return;
    if (ws?.readyState === WebSocket.OPEN) return;

    currentToken = token;
    state.update(s => ({ ...s, connecting: true }));

    const url = `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[Gateway] Connected');
      reconnectAttempts = 0;
      state.update(s => ({ ...s, connected: true, connecting: false }));
    };

    ws.onclose = (event) => {
      console.log('[Gateway] Disconnected:', event.code, event.reason);
      cleanup();
      state.update(s => ({ ...s, connected: false, connecting: false }));

      // Attempt reconnect if not closed cleanly and we have a token
      if (event.code !== 1000 && currentToken && reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          console.log(`[Gateway] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          connect(currentToken!);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Gateway] Error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const msg: GatewayMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[Gateway] Failed to parse message:', e);
      }
    };
  }

  function handleMessage(msg: GatewayMessage) {
    // Update sequence
    if (msg.s) {
      state.update(s => ({ ...s, sequence: msg.s! }));
    }

    switch (msg.op) {
      case Op.HELLO:
        handleHello(msg.d as { heartbeat_interval: number });
        break;

      case Op.DISPATCH:
        handleDispatch(msg.t!, msg.d, msg.s);
        break;

      case Op.HEARTBEAT:
        sendHeartbeat();
        break;

      case Op.HEARTBEAT_ACK:
        handleHeartbeatAck();
        break;

      case Op.RECONNECT:
        reconnect();
        break;

      case Op.INVALID_SESSION:
        handleInvalidSession(msg.d as boolean);
        break;
    }
  }

  function handleHello(data: { heartbeat_interval: number }) {
    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (!heartbeatAcked) {
        console.warn('[Gateway] Heartbeat not acknowledged, reconnecting...');
        ws?.close();
        return;
      }
      heartbeatAcked = false;
      sendHeartbeat();
    }, data.heartbeat_interval);

    // Send initial heartbeat with jitter
    const jitter = Math.random() * data.heartbeat_interval;
    setTimeout(() => {
      heartbeatAcked = false;
      sendHeartbeat();
    }, jitter);

    // Identify or resume
    const currentState = get(state);
    if (currentState.sessionId && currentState.resumeUrl) {
      resume();
    } else {
      identify();
    }
  }

  function identify() {
    if (!currentToken) return;
    send({
      op: Op.IDENTIFY,
      d: {
        token: currentToken,
        properties: {
          $os: navigator.platform,
          $browser: 'Hearth Web',
          $device: 'web',
        },
        compress: false,
        presence: {
          status: 'online',
          afk: false,
        },
      },
    });
  }

  function resume() {
    if (!currentToken) return;
    const currentState = get(state);
    send({
      op: Op.RESUME,
      d: {
        token: currentToken,
        session_id: currentState.sessionId,
        seq: currentState.sequence,
      },
    });
  }

  function handleDispatch(type: string, data: unknown, _sequence?: number) {
    console.log('[Gateway] Dispatch event:', type);

    switch (type) {
      case 'READY': {
        const ready = data as { session_id: string; resume_gateway_url?: string };
        state.update(s => ({
          ...s,
          sessionId: ready.session_id,
          resumeUrl: ready.resume_gateway_url || null,
        }));
        break;
      }

      case 'RESUMED':
        console.log('[Gateway] Session resumed');
        break;

      case 'MESSAGE_CREATE': {
        const normalized = normalizeMessage(data as Record<string, unknown>);
        handleMessageCreate(normalized);
        break;
      }

      case 'MESSAGE_UPDATE': {
        const normalized = normalizeMessage(data as Record<string, unknown>);
        handleMessageUpdate(normalized);
        break;
      }

      case 'MESSAGE_DELETE': {
        const msgData = data as { id: string; channel_id: string };
        handleMessageDelete(msgData);
        break;
      }

      case 'TYPING_START':
        console.log('[Gateway] Typing start:', data);
        break;

      case 'PRESENCE_UPDATE':
        console.log('[Gateway] Presence update:', data);
        break;

      case 'GUILD_CREATE':
      case 'GUILD_UPDATE':
      case 'GUILD_DELETE':
      case 'CHANNEL_CREATE':
      case 'CHANNEL_UPDATE':
      case 'CHANNEL_DELETE':
      case 'GUILD_MEMBER_ADD':
      case 'GUILD_MEMBER_REMOVE':
      case 'GUILD_MEMBER_UPDATE':
        console.log('[Gateway] Guild/Channel event:', type, data);
        break;

      default:
        console.log('[Gateway] Unknown event:', type, data);
    }

    // Emit to subscribers
    emit(type, data);
    emit('*', { type, data });
  }

  // Normalize backend message format to frontend format
  function normalizeMessage(data: Record<string, unknown>): Record<string, unknown> {
    const msg = data;
    return {
      ...msg,
      // Map backend field names to frontend expectations
      created_at: msg.timestamp || msg.created_at,
      edited_at: msg.edited_timestamp || msg.edited_at,
      server_id: msg.guild_id || msg.server_id,
      author_id: (msg.author as Record<string, unknown>)?.id || msg.author_id,
      author: msg.author,
      reply_to: msg.referenced_message_id || msg.reply_to,
    };
  }

  function sendHeartbeat() {
    const currentState = get(state);
    state.update(s => ({ ...s, lastHeartbeat: Date.now() }));
    send({
      op: Op.HEARTBEAT,
      d: currentState.sequence || null,
    });

    // Set timeout for ACK
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      console.warn('[Gateway] Heartbeat timeout, reconnecting...');
      ws?.close();
    }, 10000);
  }

  function handleHeartbeatAck() {
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatAcked = true;
    const currentState = get(state);
    const latency = Date.now() - currentState.lastHeartbeat;
    state.update(s => ({ ...s, latency }));
  }

  function handleInvalidSession(resumable: boolean) {
    if (resumable) {
      setTimeout(() => resume(), 1000 + Math.random() * 4000);
    } else {
      state.update(s => ({ ...s, sessionId: null, resumeUrl: null, sequence: 0 }));
      setTimeout(() => identify(), 1000 + Math.random() * 4000);
    }
  }

  function reconnect() {
    ws?.close();
    setTimeout(() => {
      if (currentToken) {
        connect(currentToken);
      }
    }, 1000);
  }

  function send(data: GatewayMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function cleanup() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    heartbeatInterval = null;
    heartbeatTimeout = null;
    reconnectTimeout = null;
    heartbeatAcked = true;
  }

  function disconnect() {
    currentToken = null;
    cleanup();
    ws?.close(1000, 'Client disconnect');
    ws = null;
    state.set({
      connected: false,
      connecting: false,
      sessionId: null,
      resumeUrl: null,
      sequence: 0,
      latency: 0,
      lastHeartbeat: 0,
    });
  }

  function updatePresence(status: string, afk = false) {
    send({
      op: Op.PRESENCE_UPDATE,
      d: { status, afk },
    });
  }

  function requestGuildMembers(guildId: string, query = '', limit = 100) {
    send({
      op: Op.REQUEST_GUILD_MEMBERS,
      d: {
        guild_id: guildId,
        query,
        limit,
        presences: true,
      },
    });
  }

  // Subscribe to a channel for real-time events
  function subscribeChannel(channelId: string) {
    console.log('[Gateway] Subscribing to channel:', channelId);
    send({
      op: Op.DISPATCH,
      d: {
        t: 'SUBSCRIBE',
        d: { channel_id: channelId },
      },
    });
  }

  // Unsubscribe from a channel
  function unsubscribeChannel(channelId: string) {
    console.log('[Gateway] Unsubscribing from channel:', channelId);
    send({
      op: Op.DISPATCH,
      d: {
        t: 'UNSUBSCRIBE',
        d: { channel_id: channelId },
      },
    });
  }

  // Subscribe to a server for real-time events
  function subscribeServer(serverId: string) {
    console.log('[Gateway] Subscribing to server:', serverId);
    send({
      op: Op.DISPATCH,
      d: {
        t: 'SUBSCRIBE',
        d: { server_id: serverId },
      },
    });
  }

  return {
    subscribe: state.subscribe,
    connect,
    disconnect,
    on,
    send,
    updatePresence,
    requestGuildMembers,
    subscribeChannel,
    unsubscribeChannel,
    subscribeServer,
  };
}

export const gateway = createGatewayStore();

// Derived stores for common checks
export const isConnected = derived(gateway, $g => $g.connected);
export const isConnecting = derived(gateway, $g => $g.connecting);
export const gatewayLatency = derived(gateway, $g => $g.latency);

// Export gateway state as a readable store for backward compatibility
export const gatewayState = derived(
  gateway,
  $g => {
    if ($g.connecting) return 'connecting' as const;
    if ($g.connected) return 'connected' as const;
    return 'disconnected' as const;
  }
);
