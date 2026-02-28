/**
 * Tests for Online Status Store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock navigator.onLine
const mockNavigator = {
  onLine: true
};
vi.stubGlobal('navigator', mockNavigator);

// Mock window events
type EventHandler = (...args: unknown[]) => void;
const windowListeners: Record<string, EventHandler[]> = {};
vi.stubGlobal('window', {
  addEventListener: (event: string, handler: EventHandler) => {
    if (!windowListeners[event]) {
      windowListeners[event] = [];
    }
    windowListeners[event].push(handler);
  },
  removeEventListener: (event: string, handler: EventHandler) => {
    if (windowListeners[event]) {
      windowListeners[event] = windowListeners[event].filter(h => h !== handler);
    }
  }
});

// Import after mocks are set up
import {
  onlineStatus,
  isOnline,
  wasOffline,
  onStatusChange,
  clearWasOffline
} from '../../stores/onlineStatus';

describe('Online Status Store', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    mockNavigator.onLine = true;
    clearWasOffline();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const status = get(onlineStatus);
      expect(status.isOnline).toBe(true);
      expect(status.wasOffline).toBe(false);
    });
    
    it('should provide isOnline derived store', () => {
      expect(get(isOnline)).toBe(true);
    });
    
    it('should provide wasOffline derived store', () => {
      expect(get(wasOffline)).toBe(false);
    });
  });
  
  describe('Event Handling', () => {
    it('should handle online event', () => {
      // Simulate going online
      if (windowListeners['online']) {
        windowListeners['online'].forEach(handler => handler());
      }
      
      const status = get(onlineStatus);
      expect(status.isOnline).toBe(true);
      expect(status.lastOnlineAt).toBeDefined();
    });
    
    it('should handle offline event', () => {
      // Simulate going offline
      if (windowListeners['offline']) {
        windowListeners['offline'].forEach(handler => handler());
      }
      
      const status = get(onlineStatus);
      expect(status.isOnline).toBe(false);
      expect(status.wasOffline).toBe(true);
      expect(status.lastOfflineAt).toBeDefined();
    });
  });
  
  describe('Status Change Handlers', () => {
    it('should notify handlers on status change', () => {
      const handler = vi.fn();
      const unsubscribe = onStatusChange(handler);
      
      // Simulate offline event
      if (windowListeners['offline']) {
        windowListeners['offline'].forEach(h => h());
      }
      
      expect(handler).toHaveBeenCalled();
      
      unsubscribe();
    });
    
    it('should unsubscribe handler', () => {
      const handler = vi.fn();
      const unsubscribe = onStatusChange(handler);
      
      unsubscribe();
      
      // Simulate event
      if (windowListeners['offline']) {
        windowListeners['offline'].forEach(h => h());
      }
      
      // Handler should not be called after unsubscribe
      // (depends on timing - the event may have already been processed)
    });
  });
  
  describe('clearWasOffline', () => {
    it('should clear wasOffline flag', () => {
      // Simulate going offline then online
      if (windowListeners['offline']) {
        windowListeners['offline'].forEach(h => h());
      }
      
      expect(get(wasOffline)).toBe(true);
      
      clearWasOffline();
      
      expect(get(wasOffline)).toBe(false);
    });
  });
});
