/**
 * Online Status Store - Network connectivity detection
 * Provides reactive online/offline state for the application
 */

import { browser } from '$app/environment';
import { writable, derived, type Readable } from 'svelte/store';

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

// Initial state
const initialState: OnlineStatusState = {
  isOnline: browser ? navigator.onLine : true,
  wasOffline: false,
  lastOnlineAt: null,
  lastOfflineAt: null,
  connectionType: null,
  effectiveType: null,
  downlink: null,
  rtt: null
};

// Create the writable store
const store = writable<OnlineStatusState>(initialState);

// Track if we've initialized
let initialized = false;

// Event listeners
type StatusChangeHandler = (state: OnlineStatusState) => void;
const changeHandlers: Set<StatusChangeHandler> = new Set();

/**
 * Subscribe to status changes
 */
export function onStatusChange(handler: StatusChangeHandler): () => void {
  changeHandlers.add(handler);
  return () => changeHandlers.delete(handler);
}

/**
 * Emit status change to handlers
 */
function emitStatusChange(state: OnlineStatusState): void {
  changeHandlers.forEach(handler => {
    try {
      handler(state);
    } catch (e) {
      console.error('[OnlineStatus] Handler error:', e);
    }
  });
}

/**
 * Get connection info from Network Information API
 */
function getConnectionInfo(): Partial<OnlineStatusState> {
  if (!browser) return {};
  
  // Network Information API (not available in all browsers)
  const connection = (navigator as Navigator & {
    connection?: {
      type?: string;
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  }).connection;
  
  if (connection) {
    return {
      connectionType: connection.type || null,
      effectiveType: connection.effectiveType || null,
      downlink: connection.downlink || null,
      rtt: connection.rtt || null
    };
  }
  
  return {};
}

/**
 * Handle online event
 */
function handleOnline(): void {
  const connectionInfo = getConnectionInfo();
  
  store.update(state => {
    const newState = {
      ...state,
      ...connectionInfo,
      isOnline: true,
      lastOnlineAt: Date.now()
    };
    
    emitStatusChange(newState);
    return newState;
  });
  
  console.log('[OnlineStatus] Network online');
}

/**
 * Handle offline event
 */
function handleOffline(): void {
  store.update(state => {
    const newState = {
      ...state,
      isOnline: false,
      wasOffline: true,
      lastOfflineAt: Date.now()
    };
    
    emitStatusChange(newState);
    return newState;
  });
  
  console.log('[OnlineStatus] Network offline');
}

/**
 * Handle connection change
 */
function handleConnectionChange(): void {
  const connectionInfo = getConnectionInfo();
  
  store.update(state => ({
    ...state,
    ...connectionInfo
  }));
}

/**
 * Initialize online status monitoring
 */
export function initOnlineStatus(): void {
  if (!browser || initialized) return;
  
  initialized = true;
  
  // Set initial state
  store.update(state => ({
    ...state,
    ...getConnectionInfo(),
    isOnline: navigator.onLine,
    lastOnlineAt: navigator.onLine ? Date.now() : null
  }));
  
  // Add event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Listen for connection changes if supported
  const connection = (navigator as Navigator & {
    connection?: EventTarget;
  }).connection;
  
  if (connection) {
    connection.addEventListener('change', handleConnectionChange);
  }
  
  console.log('[OnlineStatus] Monitoring initialized');
}

/**
 * Cleanup event listeners
 */
export function destroyOnlineStatus(): void {
  if (!browser) return;
  
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  
  const connection = (navigator as Navigator & {
    connection?: EventTarget;
  }).connection;
  
  if (connection) {
    connection.removeEventListener('change', handleConnectionChange);
  }
  
  initialized = false;
}

/**
 * Check network connectivity with a fetch request
 * Useful when navigator.onLine is unreliable
 */
export async function checkConnectivity(url = '/api/v1/health'): Promise<boolean> {
  if (!browser) return true;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      // Update state if we thought we were offline
      store.update(state => {
        if (!state.isOnline) {
          const newState = {
            ...state,
            isOnline: true,
            lastOnlineAt: Date.now()
          };
          emitStatusChange(newState);
          return newState;
        }
        return state;
      });
      
      return true;
    }
    
    return false;
  } catch {
    // Network error - we're offline
    store.update(state => {
      if (state.isOnline) {
        const newState = {
          ...state,
          isOnline: false,
          wasOffline: true,
          lastOfflineAt: Date.now()
        };
        emitStatusChange(newState);
        return newState;
      }
      return state;
    });
    
    return false;
  }
}

/**
 * Reset the wasOffline flag
 * Call this after handling reconnection UI
 */
export function clearWasOffline(): void {
  store.update(state => ({
    ...state,
    wasOffline: false
  }));
}

/**
 * Get time since last state change
 */
export function getTimeSinceStateChange(): number | null {
  let result: number | null = null;
  
  store.subscribe(state => {
    if (state.isOnline && state.lastOnlineAt) {
      result = Date.now() - state.lastOnlineAt;
    } else if (!state.isOnline && state.lastOfflineAt) {
      result = Date.now() - state.lastOfflineAt;
    }
  })();
  
  return result;
}

// Derived stores for convenience
export const isOnline: Readable<boolean> = derived(store, $state => $state.isOnline);
export const wasOffline: Readable<boolean> = derived(store, $state => $state.wasOffline);
export const connectionQuality: Readable<string | null> = derived(store, $state => $state.effectiveType);

// Export the main store as read-only
export const onlineStatus: Readable<OnlineStatusState> = {
  subscribe: store.subscribe
};

// Auto-initialize in browser
if (browser) {
  // Initialize after a small delay to avoid blocking
  setTimeout(initOnlineStatus, 0);
}
