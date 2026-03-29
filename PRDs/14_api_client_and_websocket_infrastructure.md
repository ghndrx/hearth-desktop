# PRD: API Client & WebSocket Infrastructure

## Overview

**Priority**: P0 (Critical)
**Timeline**: 4-6 weeks
**Owner**: Desktop Team

Build the foundational API client layer and WebSocket infrastructure to connect Hearth Desktop's Svelte frontend to the Hearth backend — enabling all downstream features (text messaging, server management, notifications, voice signaling).

## Problem Statement

The frontend currently has `src/lib/stores/voice.ts` and `src/lib/stores/app.ts` but **zero API client**. No HTTP client, no WebSocket connection to the Hearth server, no authentication flow. Every feature PRD (text messaging, threads, screen share) assumes an API layer that does not exist. Without this, Hearth Desktop is a UI shell with no backend connectivity.

**Current Gap**: Discord's desktop client maintains persistent WebSocket connections for real-time events (messages, typing, presence, voice state). Hearth Desktop has no connection infrastructure at all.

## Goals

### Primary Goals
- **HTTP API Client** (`src/lib/api/client.ts`) — typed fetch wrapper for all Hearth REST endpoints (auth, servers, channels, messages, voice)
- **WebSocket Client** (`src/lib/api/websocket.ts`) — persistent WS connection with auto-reconnect, heartbeat, and event dispatch
- **Authentication Store** — JWT/session management, token refresh, logout
- **Server/Channel State** — Svelte stores mirroring backend state (servers, channels, members, roles)
- **Reconnection Logic** — exponential backoff, offline queue for pending messages

### Secondary Goals
- **Connection Status UI** — indicator in sidebar showing connected/disconnected/reconnecting state
- **Multi-server support** — switch between servers, maintain separate WS connections per server context
- **Channel unread state** — tracking read/unread based on last-seen timestamps

## Technical Approach

### API Client Architecture

```typescript
// src/lib/api/client.ts
class HearthClient {
  private baseUrl: string;
  private token: string | null;
  
  async get<T>(path: string): Promise<T>;
  async post<T>(path: string, data: unknown): Promise<T>;
  async put<T>(path: string, data: unknown): Promise<T>;
  async delete(path: string): Promise<void>;
}

// Event types for WebSocket
type WSEvent = 
  | { type: 'message'; data: Message }
  | { type: 'typing'; data: { channelId: string; userId: string } }
  | { type: 'voice_state'; data: VoiceState }
  | { type: 'presence'; data: { userId: string; status: string } };
```

### WebSocket Flow
1. On app start → authenticate → obtain JWT
2. Open WebSocket to `wss://[server]/ws`
3. Subscribe to relevant channels/servers
4. Receive events → dispatch to appropriate Svelte stores
5. On disconnect → exponential backoff reconnect (max 30s)
6. Queue outbound events while disconnected, flush on reconnect

### Key Tauri Commands Needed
- `getStoredToken()` — retrieve auth token from `tauri-plugin-store`
- `clearStoredToken()` — logout
- (Future: `getWebSocketUrl()` — resolve WSS URL with auth ticket)
