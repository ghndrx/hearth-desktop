import { writable, derived, get } from 'svelte/store';

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

interface GatewayState {
  connected: boolean;
  connecting: boolean;
  sessionId: string | null;
  resumeUrl: string | null;
  sequence: number;
  latency: number;
  lastHeartbeat: number;
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

  const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  function emit(event: string, data: unknown) {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
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

  function connect(token: string) {
    if (ws?.readyState === WebSocket.OPEN) return;

    state.update(s => ({ ...s, connecting: true }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/gateway`;

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

      // Attempt reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connect(token);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Gateway] Error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const msg: GatewayMessage = JSON.parse(event.data);
        handleMessage(msg, token);
      } catch (e) {
        console.error('[Gateway] Failed to parse message:', e);
      }
    };
  }

  function handleMessage(msg: GatewayMessage, token: string) {
    // Update sequence
    if (msg.s) {
      state.update(s => ({ ...s, sequence: msg.s! }));
    }

    switch (msg.op) {
      case Op.HELLO:
        handleHello(msg.d as { heartbeat_interval: number }, token);
        break;

      case Op.DISPATCH:
        handleDispatch(msg.t!, msg.d);
        break;

      case Op.HEARTBEAT:
        sendHeartbeat();
        break;

      case Op.HEARTBEAT_ACK:
        handleHeartbeatAck();
        break;

      case Op.RECONNECT:
        reconnect(token);
        break;

      case Op.INVALID_SESSION:
        handleInvalidSession(msg.d as boolean, token);
        break;
    }
  }

  function handleHello(data: { heartbeat_interval: number }, token: string) {
    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(sendHeartbeat, data.heartbeat_interval);

    // Send initial heartbeat
    sendHeartbeat();

    // Identify or resume
    const currentState = get(state);
    if (currentState.sessionId && currentState.resumeUrl) {
      resume(token);
    } else {
      identify(token);
    }
  }

  function identify(token: string) {
    send({
      op: Op.IDENTIFY,
      d: {
        token,
        properties: {
          os: navigator.platform,
          browser: 'Hearth Web',
          device: 'web',
        },
        compress: false,
        presence: {
          status: 'online',
          afk: false,
        },
      },
    });
  }

  function resume(token: string) {
    const currentState = get(state);
    send({
      op: Op.RESUME,
      d: {
        token,
        session_id: currentState.sessionId,
        seq: currentState.sequence,
      },
    });
  }

  function handleDispatch(type: string, data: unknown) {
    switch (type) {
      case 'READY':
        const ready = data as { session_id: string; resume_gateway_url?: string };
        state.update(s => ({
          ...s,
          sessionId: ready.session_id,
          resumeUrl: ready.resume_gateway_url || null,
        }));
        break;

      case 'RESUMED':
        console.log('[Gateway] Session resumed');
        break;
    }

    // Emit to subscribers
    emit(type, data);
    emit('*', { type, data });
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
    const currentState = get(state);
    const latency = Date.now() - currentState.lastHeartbeat;
    state.update(s => ({ ...s, latency }));
  }

  function handleInvalidSession(resumable: boolean, token: string) {
    if (resumable) {
      setTimeout(() => resume(token), 1000 + Math.random() * 4000);
    } else {
      state.update(s => ({ ...s, sessionId: null, sequence: 0 }));
      setTimeout(() => identify(token), 1000 + Math.random() * 4000);
    }
  }

  function reconnect(token: string) {
    ws?.close();
    setTimeout(() => connect(token), 1000);
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
  }

  function disconnect() {
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

  return {
    subscribe: state.subscribe,
    connect,
    disconnect,
    on,
    send,
    updatePresence,
    requestGuildMembers,
  };
}

export const gateway = createGatewayStore();

// Derived stores for common checks
export const isConnected = derived(gateway, $g => $g.connected);
export const isConnecting = derived(gateway, $g => $g.connecting);
export const gatewayLatency = derived(gateway, $g => $g.latency);
