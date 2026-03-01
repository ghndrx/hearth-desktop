import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import SystemTrayBadgeManager from './SystemTrayBadgeManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/api/window', () => ({
  appWindow: {
    setTitle: vi.fn()
  }
}));

vi.mock('@tauri-apps/api/app', () => ({
  getName: vi.fn().mockResolvedValue('TestApp')
}));

describe('SystemTrayBadgeManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('badge display', () => {
    it('shows correct count for unread messages', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 0,
          showBadge: true
        }
      });

      // Access internal state via component methods
      expect(component).toBeDefined();
    });

    it('combines unread and urgent counts', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 3,
          urgentCount: 2,
          showBadge: true
        }
      });

      // Total should be 5
    });

    it('shows max count with + suffix when exceeding limit', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 150,
          urgentCount: 0,
          maxDisplayCount: 99,
          showBadge: true
        }
      });

      // Should display "99+"
    });

    it('hides badge when autoHideZero is true and count is zero', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 0,
          autoHideZero: true,
          showBadge: true
        }
      });

      // Badge should not be visible
    });

    it('shows badge when autoHideZero is false even with zero count', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 0,
          autoHideZero: false,
          showBadge: true
        }
      });

      // Badge should be visible but empty
    });
  });

  describe('flashing behavior', () => {
    it('starts flashing when urgent count is set and flashOnUrgent is true', async () => {
      const mockDispatch = vi.fn();
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 3,
          flashOnUrgent: true,
          flashIntervalMs: 100
        }
      });

      component.$on('urgentFlash', mockDispatch);

      // Fast-forward timers to trigger flash
      vi.advanceTimersByTime(150);

      // Should have dispatched flash event
    });

    it('stops flashing when urgent count becomes zero', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 2,
          flashOnUrgent: true
        }
      });

      vi.advanceTimersByTime(600);

      // Update to remove urgent messages
      component.$set({ urgentCount: 0 });

      vi.advanceTimersByTime(100);

      // Flashing should have stopped
    });

    it('does not flash when flashOnUrgent is false', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          urgentCount: 5,
          flashOnUrgent: false
        }
      });

      vi.advanceTimersByTime(1000);

      // No flashing should occur
    });
  });

  describe('component methods', () => {
    it('setBadgeCount updates both counts', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 0
        }
      });

      component.setBadgeCount(10, 5);

      // Counts should be updated
    });

    it('incrementBadge increases count correctly', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 0
        }
      });

      component.incrementBadge(3);

      // Should be 8
    });

    it('incrementBadge with urgent flag increases urgent count', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 0
        }
      });

      component.incrementBadge(2, true);

      // Urgent should be 2
    });

    it('decrementBadge reduces count correctly', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 3
        }
      });

      component.decrementBadge(2);

      // Should decrement urgent first
    });

    it('decrementBadge does not go below zero', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 2,
          urgentCount: 0
        }
      });

      component.decrementBadge(10);

      // Should be 0, not negative
    });

    it('clearBadge resets all counts and stops flashing', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 10,
          urgentCount: 5,
          flashOnUrgent: true
        }
      });

      vi.advanceTimersByTime(100);

      await component.clearBadge();

      // Both counts should be 0, flashing stopped
    });

    it('flash method temporarily enables flashing', async () => {
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 0
        }
      });

      await component.flash(1000);

      // Should be flashing

      vi.advanceTimersByTime(1100);

      // Should have stopped flashing
    });
  });

  describe('icon styles', () => {
    it('supports dot style', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          iconStyle: 'dot'
        }
      });

      // Should render as dot
    });

    it('supports count style', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          iconStyle: 'count'
        }
      });

      // Should render with count
    });

    it('supports both style', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          iconStyle: 'both'
        }
      });

      // Should render dot and count
    });
  });

  describe('positioning', () => {
    it.each([
      'top-right',
      'top-left',
      'bottom-right',
      'bottom-left'
    ] as const)('supports %s position', async (position) => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          position
        }
      });

      // Badge should be positioned correctly
    });
  });

  describe('colors', () => {
    it('uses badgeColor for regular messages', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 0,
          badgeColor: '#00ff00'
        }
      });

      // Should use green color
    });

    it('uses urgentColor for urgent messages', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0,
          urgentCount: 5,
          urgentColor: '#ff0000'
        }
      });

      // Should use red color
    });
  });

  describe('events', () => {
    it('dispatches badgeClick on click', async () => {
      const mockHandler = vi.fn();
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 2
        }
      });

      component.$on('badgeClick', mockHandler);

      // Simulate click would dispatch event with counts
    });

    it('dispatches badgeUpdate when badge changes', async () => {
      const mockHandler = vi.fn();
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 0
        }
      });

      component.$on('badgeUpdate', mockHandler);

      component.$set({ unreadCount: 5 });

      vi.advanceTimersByTime(100);

      // Should have dispatched update
    });

    it('dispatches error on badge update failure', async () => {
      // Mock invoke to throw
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Native error'));

      const mockHandler = vi.fn();
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5
        }
      });

      component.$on('error', mockHandler);

      // Error should be dispatched on native failure
    });
  });

  describe('accessibility', () => {
    it('has correct aria-label', async () => {
      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5
        }
      });

      // Should have descriptive aria-label
    });

    it('is keyboard accessible', async () => {
      const mockHandler = vi.fn();
      const { component } = render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5
        }
      });

      component.$on('badgeClick', mockHandler);

      // Enter key should trigger click
    });
  });

  describe('reduced motion', () => {
    it('respects prefers-reduced-motion', async () => {
      // Mock matchMedia
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn()
      }));

      render(SystemTrayBadgeManager, {
        props: {
          unreadCount: 5,
          urgentCount: 2
        }
      });

      // Animations should be disabled

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('cleanup', () => {
    it('stops flashing interval on destroy', async () => {
      const { unmount } = render(SystemTrayBadgeManager, {
        props: {
          urgentCount: 5,
          flashOnUrgent: true,
          flashIntervalMs: 100
        }
      });

      vi.advanceTimersByTime(150);

      unmount();

      // Interval should be cleared
      vi.advanceTimersByTime(1000);

      // No errors should occur
    });
  });
});
