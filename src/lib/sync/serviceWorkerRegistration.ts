/**
 * Service Worker Registration and Update Handling
 * Manages SW lifecycle, updates, and communication
 */

import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';

// Service worker state
export type ServiceWorkerState = 
  | 'unsupported'
  | 'registering'
  | 'registered'
  | 'installing'
  | 'installed'
  | 'activating'
  | 'activated'
  | 'error';

export interface ServiceWorkerStatus {
  state: ServiceWorkerState;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  error: string | null;
}

const initialStatus: ServiceWorkerStatus = {
  state: 'unsupported',
  registration: null,
  updateAvailable: false,
  error: null
};

// Stores
const statusStore = writable<ServiceWorkerStatus>(initialStatus);
const messagesStore = writable<MessageEvent[]>([]);

// Export readable stores
export const serviceWorkerStatus: Readable<ServiceWorkerStatus> = statusStore;
export const serviceWorkerMessages: Readable<MessageEvent[]> = messagesStore;

// Message listeners
type MessageHandler = (data: unknown) => void;
const messageHandlers = new Map<string, Set<MessageHandler>>();

/**
 * Register a handler for specific message types from the service worker
 */
export function onServiceWorkerMessage(type: string, handler: MessageHandler): () => void {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }
  messageHandlers.get(type)!.add(handler);
  
  return () => {
    messageHandlers.get(type)?.delete(handler);
  };
}

/**
 * Send a message to the active service worker
 */
export function sendToServiceWorker(message: { type: string; data?: unknown }): void {
  if (!browser) return;
  
  statusStore.subscribe(status => {
    if (status.registration?.active) {
      status.registration.active.postMessage(message);
    }
  })();
}

/**
 * Handle messages from the service worker
 */
function handleServiceWorkerMessage(event: MessageEvent): void {
  const { type, ...rest } = event.data || {};
  
  // Store message for debugging
  messagesStore.update(messages => [...messages.slice(-99), event]);
  
  // Dispatch to registered handlers
  if (type && messageHandlers.has(type)) {
    messageHandlers.get(type)!.forEach(handler => {
      try {
        handler(rest);
      } catch (error) {
        console.error(`[SW] Message handler error for ${type}:`, error);
      }
    });
  }
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!browser) return false;
  
  let hasUpdate = false;
  
  statusStore.subscribe(async status => {
    if (status.registration) {
      try {
        await status.registration.update();
        hasUpdate = !!status.registration.waiting;
      } catch (error) {
        console.warn('[SW] Update check failed:', error);
      }
    }
  })();
  
  return hasUpdate;
}

/**
 * Skip waiting and activate the new service worker
 */
export function skipWaitingAndReload(): void {
  statusStore.subscribe(status => {
    if (status.registration?.waiting) {
      status.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  })();
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!browser) return false;
  
  let success = false;
  
  statusStore.subscribe(async status => {
    if (status.registration) {
      try {
        success = await status.registration.unregister();
        statusStore.set({
          ...initialStatus,
          state: 'unsupported'
        });
      } catch (error) {
        console.error('[SW] Unregister failed:', error);
      }
    }
  })();
  
  return success;
}

/**
 * Request sync queue processing
 */
export function requestSyncProcess(tag?: string): void {
  sendToServiceWorker({ type: 'PROCESS_SYNC', data: { tag } });
}

/**
 * Get current sync queue
 */
export function requestSyncQueue(tag?: string): void {
  sendToServiceWorker({ type: 'GET_SYNC_QUEUE', data: { tag } });
}

/**
 * Clear all caches
 */
export function clearServiceWorkerCache(): void {
  sendToServiceWorker({ type: 'CLEAR_CACHE' });
}

/**
 * Pre-cache specific URLs
 */
export function preCacheUrls(urls: string[]): void {
  sendToServiceWorker({ type: 'CACHE_URLS', data: { urls } });
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!browser) {
    return null;
  }
  
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers not supported');
    statusStore.set({
      ...initialStatus,
      state: 'unsupported',
      error: 'Service workers not supported'
    });
    return null;
  }
  
  statusStore.update(s => ({ ...s, state: 'registering' }));
  
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    
    console.log('[SW] Service worker registered:', registration.scope);
    
    statusStore.update(s => ({
      ...s,
      state: 'registered',
      registration
    }));
    
    // Set up message listener
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    
    // Handle state changes
    const handleStateChange = () => {
      const sw = registration.installing || registration.waiting || registration.active;
      
      if (sw) {
        const stateMap: Record<string, ServiceWorkerState> = {
          'installing': 'installing',
          'installed': 'installed',
          'activating': 'activating',
          'activated': 'activated'
        };
        
        statusStore.update(s => ({
          ...s,
          state: stateMap[sw.state] || 'registered',
          updateAvailable: !!registration.waiting
        }));
      }
    };
    
    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        console.log('[SW] New service worker installing');
        
        newWorker.addEventListener('statechange', () => {
          handleStateChange();
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available');
            statusStore.update(s => ({ ...s, updateAvailable: true }));
          }
        });
      }
    });
    
    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed, reloading...');
      window.location.reload();
    });
    
    // Initial state check
    handleStateChange();
    
    // Check for update on registration
    if (registration.waiting) {
      statusStore.update(s => ({ ...s, updateAvailable: true }));
    }
    
    return registration;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SW] Registration failed:', error);
    
    statusStore.set({
      ...initialStatus,
      state: 'error',
      error: message
    });
    
    return null;
  }
}

/**
 * Initialize service worker on app start
 */
export function initServiceWorker(): void {
  if (!browser) return;
  
  // Register on load to avoid blocking initial render
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', () => {
      registerServiceWorker();
    });
  }
  
  // Check for updates periodically (every 30 minutes)
  setInterval(() => {
    checkForUpdates();
  }, 30 * 60 * 1000);
}
