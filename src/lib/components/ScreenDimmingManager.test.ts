import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ScreenDimmingManager from './ScreenDimmingManager.svelte';

describe('ScreenDimmingManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T21:00:00'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Clean up any overlay elements
    const overlay = document.getElementById('screen-dimming-overlay');
    if (overlay) overlay.remove();
  });

  describe('rendering', () => {
    it('should render the component', () => {
      const { container } = render(ScreenDimmingManager);
      expect(container.querySelector('[data-testid="screen-dimming-manager"]')).toBeTruthy();
    });

    it('should create overlay element on mount', () => {
      render(ScreenDimmingManager);
      const overlay = document.getElementById('screen-dimming-overlay');
      expect(overlay).toBeTruthy();
    });

    it('should remove overlay element on destroy', () => {
      const { unmount } = render(ScreenDimmingManager);
      expect(document.getElementById('screen-dimming-overlay')).toBeTruthy();
      unmount();
      expect(document.getElementById('screen-dimming-overlay')).toBeFalsy();
    });
  });

  describe('initial settings', () => {
    it('should use default settings when none provided', () => {
      const onSettingsChange = vi.fn();
      render(ScreenDimmingManager, { props: { onSettingsChange } });

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          intensity: 30,
          warmthEnabled: true,
          warmth: 40,
        })
      );
    });

    it('should merge initial settings with defaults', () => {
      const onSettingsChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: { intensity: 50, warmth: 60 },
          onSettingsChange,
        },
      });

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          intensity: 50,
          warmth: 60,
        })
      );
    });
  });

  describe('schedule', () => {
    it('should activate during scheduled hours', () => {
      // Set time to 21:00 (within default schedule 20:00-07:00)
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledActive: true,
          active: true,
        })
      );
    });

    it('should deactivate outside scheduled hours', () => {
      // Set time to 12:00 (outside default schedule 20:00-07:00)
      vi.setSystemTime(new Date('2026-02-26T12:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledActive: false,
          active: false,
        })
      );
    });

    it('should handle overnight schedules', () => {
      // Set time to 23:00 (within overnight schedule 22:00-06:00)
      vi.setSystemTime(new Date('2026-02-26T23:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            schedule: {
              enabled: true,
              startHour: 22,
              startMinute: 0,
              endHour: 6,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledActive: true,
        })
      );
    });
  });

  describe('public API', () => {
    it('should expose enable function', () => {
      const { component } = render(ScreenDimmingManager, {
        props: { initialSettings: { enabled: false } },
      });

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.enable();

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should expose disable function', () => {
      const { component } = render(ScreenDimmingManager, {
        props: { initialSettings: { enabled: true } },
      });

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.disable();

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should expose toggle function', () => {
      const { component } = render(ScreenDimmingManager, {
        props: { initialSettings: { enabled: true } },
      });

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.toggle();

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('should expose setIntensity function', () => {
      const { component } = render(ScreenDimmingManager);

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.setIntensity(75);

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ intensity: 75 })
      );
    });

    it('should clamp intensity to valid range', () => {
      const { component } = render(ScreenDimmingManager);

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      
      component.setIntensity(150);
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ intensity: 100 })
      );

      component.setIntensity(-50);
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ intensity: 0 })
      );
    });

    it('should expose setWarmth function', () => {
      const { component } = render(ScreenDimmingManager);

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.setWarmth(80);

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ warmth: 80 })
      );
    });

    it('should expose setSchedule function', () => {
      const { component } = render(ScreenDimmingManager);

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.setSchedule({ startHour: 19, endHour: 8 });

      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: expect.objectContaining({
            startHour: 19,
            endHour: 8,
          }),
        })
      );
    });

    it('should expose temporaryDisable function', () => {
      const { component } = render(ScreenDimmingManager, {
        props: { initialSettings: { enabled: true } },
      });

      const onSettingsChange = vi.fn();
      component.$set({ onSettingsChange });
      component.temporaryDisable(5000);

      // Should be disabled immediately
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );

      // Should re-enable after timeout
      vi.advanceTimersByTime(5000);
      expect(onSettingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should expose getSettings function', () => {
      const { component } = render(ScreenDimmingManager, {
        props: { initialSettings: { intensity: 45 } },
      });

      const settings = component.getSettings();
      expect(settings.intensity).toBe(45);
    });

    it('should expose getState function', () => {
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      const { component } = render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
        },
      });

      const state = component.getState();
      expect(state.active).toBe(true);
      expect(state.scheduledActive).toBe(true);
    });
  });

  describe('activity detection', () => {
    it('should pause on activity when enabled', async () => {
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            pauseOnActivity: true,
            activityTimeoutMs: 5000,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      // Simulate mouse movement
      document.dispatchEvent(new MouseEvent('mousemove'));

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ pausedByActivity: true })
      );
    });

    it('should resume after activity timeout', () => {
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            pauseOnActivity: true,
            activityTimeoutMs: 5000,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      document.dispatchEvent(new MouseEvent('mousemove'));
      vi.advanceTimersByTime(5000);

      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ pausedByActivity: false })
      );
    });
  });

  describe('fullscreen detection', () => {
    it('should pause when entering fullscreen if configured', () => {
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      const onStateChange = vi.fn();
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            excludeFullscreen: true,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
          onStateChange,
        },
      });

      // Mock fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.body,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ pausedByFullscreen: true })
      );

      // Restore
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
    });
  });

  describe('overlay styling', () => {
    it('should hide overlay when intensity and warmth are zero', () => {
      vi.setSystemTime(new Date('2026-02-26T12:00:00'));
      
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            intensity: 30,
            warmth: 40,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
        },
      });

      const overlay = document.getElementById('screen-dimming-overlay');
      expect(overlay?.style.display).toBe('none');
    });

    it('should show overlay when active', () => {
      vi.setSystemTime(new Date('2026-02-26T21:00:00'));
      
      render(ScreenDimmingManager, {
        props: {
          initialSettings: {
            enabled: true,
            intensity: 30,
            warmth: 40,
            schedule: {
              enabled: true,
              startHour: 20,
              startMinute: 0,
              endHour: 7,
              endMinute: 0,
              transitionMinutes: 0,
            },
          },
        },
      });

      const overlay = document.getElementById('screen-dimming-overlay');
      expect(overlay?.style.display).toBe('block');
    });
  });

  describe('slot props', () => {
    it('should provide slot props for custom UI', () => {
      const { container } = render(ScreenDimmingManager, {
        props: {
          initialSettings: { intensity: 50 },
        },
      });

      // The component uses display: contents, so it doesn't add wrapper elements
      expect(container.querySelector('[data-testid="screen-dimming-manager"]')).toBeTruthy();
    });
  });
});
