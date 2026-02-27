import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DockBadgeManager from './DockBadgeManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

describe('DockBadgeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (invoke as any).mockResolvedValue('macos');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders without visible UI', () => {
      const { container } = render(DockBadgeManager);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('renders slot content when provided', () => {
      const { getByTestId } = render(DockBadgeManager, {
        props: { unreadCount: 5 },
        // @ts-ignore - slot testing
        $$slots: { default: [] },
      });
      // Slot content would be rendered here
    });
  });

  describe('platform detection', () => {
    it('detects macOS platform', async () => {
      (invoke as any).mockResolvedValueOnce('macos');
      render(DockBadgeManager);
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('get_platform');
    });

    it('detects Windows platform', async () => {
      (invoke as any).mockResolvedValueOnce('windows');
      render(DockBadgeManager);
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('get_platform');
    });

    it('handles platform detection failure gracefully', async () => {
      (invoke as any).mockRejectedValueOnce(new Error('Not available'));
      render(DockBadgeManager);
      await vi.runAllTimersAsync();
      // Should not throw
    });
  });

  describe('badge display logic', () => {
    it('displays count when unreadCount > 0', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { props: { unreadCount: 5 } });
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 5, label: '5' });
    });

    it('does not display badge when unreadCount is 0 and showZero is false', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { props: { unreadCount: 0, showZero: false } });
      await vi.runAllTimersAsync();
      expect(invoke).not.toHaveBeenCalledWith('set_badge_count', expect.anything());
    });

    it('displays badge when unreadCount is 0 and showZero is true', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { props: { unreadCount: 0, showZero: true } });
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 0, label: '0' });
    });

    it('caps display at maxDisplayCount', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { props: { unreadCount: 150, maxDisplayCount: 99 } });
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 99, label: '99+' });
    });

    it('prioritizes mention count when prioritizeMentions is true', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { 
        props: { 
          unreadCount: 50, 
          mentionCount: 3, 
          prioritizeMentions: true 
        } 
      });
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 3, label: '3' });
    });

    it('uses unreadCount when mentionCount is 0', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { 
        props: { 
          unreadCount: 50, 
          mentionCount: 0, 
          prioritizeMentions: true 
        } 
      });
      await vi.runAllTimersAsync();
      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 50, label: '50' });
    });
  });

  describe('enabled state', () => {
    it('does not update badge when disabled', async () => {
      (invoke as any).mockResolvedValue('macos');
      render(DockBadgeManager, { props: { unreadCount: 5, enabled: false } });
      await vi.runAllTimersAsync();
      expect(invoke).not.toHaveBeenCalledWith('set_badge_count', expect.anything());
    });

    it('clears badge when enabled is toggled to false', async () => {
      (invoke as any).mockResolvedValue('macos');
      const { component } = render(DockBadgeManager, { 
        props: { unreadCount: 5, enabled: true } 
      });
      await vi.runAllTimersAsync();
      
      // @ts-ignore
      component.$set({ enabled: false });
      await vi.runAllTimersAsync();
      
      expect(invoke).toHaveBeenCalledWith('clear_badge');
    });
  });

  describe('event listening', () => {
    it('sets up event listener on mount', async () => {
      render(DockBadgeManager);
      await vi.runAllTimersAsync();
      expect(listen).toHaveBeenCalledWith('unread-count-changed', expect.any(Function));
    });

    it('updates counts when event is received', async () => {
      let eventCallback: ((event: any) => void) | null = null;
      (listen as any).mockImplementation((event: string, callback: (event: any) => void) => {
        eventCallback = callback;
        return Promise.resolve(() => {});
      });
      (invoke as any).mockResolvedValue('macos');

      render(DockBadgeManager);
      await vi.runAllTimersAsync();

      // Simulate event
      eventCallback?.({ payload: { unread: 10, mentions: 2 } });
      await vi.runAllTimersAsync();

      expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 2, label: '2' });
    });

    it('cleans up event listener on destroy', async () => {
      const unlistenFn = vi.fn();
      (listen as any).mockResolvedValue(unlistenFn);

      const { unmount } = render(DockBadgeManager);
      await vi.runAllTimersAsync();
      
      unmount();
      
      expect(unlistenFn).toHaveBeenCalled();
    });
  });

  describe('debouncing', () => {
    it('debounces rapid badge updates', async () => {
      (invoke as any).mockResolvedValue('macos');
      const { component } = render(DockBadgeManager, { props: { unreadCount: 1 } });
      await vi.runAllTimersAsync();
      vi.clearAllMocks();

      // Rapid updates
      // @ts-ignore
      component.$set({ unreadCount: 2 });
      // @ts-ignore
      component.$set({ unreadCount: 3 });
      // @ts-ignore
      component.$set({ unreadCount: 4 });
      // @ts-ignore
      component.$set({ unreadCount: 5 });

      await vi.runAllTimersAsync();

      // Should only call once with final value due to debouncing
      const setBadgeCalls = (invoke as any).mock.calls.filter(
        (call: any[]) => call[0] === 'set_badge_count'
      );
      expect(setBadgeCalls.length).toBe(1);
      expect(setBadgeCalls[0]).toEqual(['set_badge_count', { count: 5, label: '5' }]);
    });
  });

  describe('fallback behavior', () => {
    it('falls back to platform-specific method on error', async () => {
      (invoke as any)
        .mockResolvedValueOnce('macos')
        .mockRejectedValueOnce(new Error('Not available'))
        .mockResolvedValueOnce(undefined);

      render(DockBadgeManager, { props: { unreadCount: 5 } });
      await vi.runAllTimersAsync();

      expect(invoke).toHaveBeenCalledWith('set_macos_dock_badge', { badge: '5' });
    });

    it('falls back to window title on complete failure', async () => {
      (invoke as any)
        .mockResolvedValueOnce('macos')
        .mockRejectedValueOnce(new Error('Not available'))
        .mockRejectedValueOnce(new Error('Still not available'));

      render(DockBadgeManager, { props: { unreadCount: 5 } });
      await vi.runAllTimersAsync();

      expect(document.title).toContain('(5)');
    });
  });

  describe('cleanup', () => {
    it('clears badge on component destroy', async () => {
      (invoke as any).mockResolvedValue('macos');
      const { unmount } = render(DockBadgeManager, { props: { unreadCount: 5 } });
      await vi.runAllTimersAsync();
      vi.clearAllMocks();

      unmount();
      await vi.runAllTimersAsync();

      expect(invoke).toHaveBeenCalledWith('clear_badge');
    });

    it('clears debounce timer on destroy', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { component, unmount } = render(DockBadgeManager, { props: { unreadCount: 1 } });
      
      // Trigger a debounced update
      // @ts-ignore
      component.$set({ unreadCount: 2 });
      
      unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('public API', () => {
    it('exposes setBadgeCount method', async () => {
      const { component } = render(DockBadgeManager);
      expect(typeof (component as any).setBadgeCount).toBe('function');
    });

    it('exposes setMentionCount method', async () => {
      const { component } = render(DockBadgeManager);
      expect(typeof (component as any).setMentionCount).toBe('function');
    });

    it('exposes clearAllBadges method', async () => {
      const { component } = render(DockBadgeManager);
      expect(typeof (component as any).clearAllBadges).toBe('function');
    });

    it('exposes forceRefresh method', async () => {
      const { component } = render(DockBadgeManager);
      expect(typeof (component as any).forceRefresh).toBe('function');
    });
  });
});
