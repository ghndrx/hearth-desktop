import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import PictureInPictureManager from './PictureInPictureManager.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('PictureInPictureManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
      switch (cmd) {
        case 'get_screen_dimensions':
          return { width: 1920, height: 1080 };
        case 'create_pip_window':
          return null;
        case 'close_pip_window':
          return null;
        case 'move_pip_window':
          return null;
        case 'resize_pip_window':
          return null;
        case 'set_pip_visibility':
          return null;
        case 'set_pip_opacity':
          return null;
        case 'set_pip_always_on_top':
          return null;
        case 'get_pip_saved_position':
          return null;
        case 'save_pip_position':
          return null;
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the PiP manager container', () => {
      const { container } = render(PictureInPictureManager);
      expect(container.querySelector('.pip-manager')).toBeTruthy();
    });

    it('should have enabled class when enabled prop is true', () => {
      const { container } = render(PictureInPictureManager, { props: { enabled: true } });
      expect(container.querySelector('.pip-manager.enabled')).toBeTruthy();
    });

    it('should not have enabled class when disabled', () => {
      const { container } = render(PictureInPictureManager, { props: { enabled: false } });
      expect(container.querySelector('.pip-manager.enabled')).toBeFalsy();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(PictureInPictureManager);
      const manager = container.querySelector('.pip-manager');
      expect(manager?.getAttribute('role')).toBe('region');
      expect(manager?.getAttribute('aria-label')).toBe('Picture in Picture Manager');
    });
  });

  describe('Window Creation', () => {
    it('should create a new PiP window via component method', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test Video');
      await tick();

      expect(window).toBeTruthy();
      expect(window?.title).toBe('Test Video');
      expect(window?.contentType).toBe('video');
      expect(mockInvoke).toHaveBeenCalledWith('create_pip_window', expect.any(Object));
    });

    it('should create window with custom dimensions', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('call', 'Video Call', undefined, {
        width: 400,
        height: 225,
      });

      expect(window?.width).toBe(400);
      expect(window?.height).toBe(225);
    });

    it('should create window with custom position', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('media', 'Media Player', undefined, {
        x: 100,
        y: 100,
      });

      expect(window?.x).toBe(100);
      expect(window?.y).toBe(100);
    });

    it('should not create window when disabled', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: false } });

      const window = await component.createWindow('video', 'Test');

      expect(window).toBeNull();
    });

    it('should dispatch windowCreated event', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('windowCreated', handler);

      await component.createWindow('video', 'Test Video');
      await tick();

      expect(handler).toHaveBeenCalled();
    });

    it('should set new window as active', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await tick();

      let activeId: string | null = null;
      component.activeWindowId.subscribe((id) => (activeId = id));

      expect(activeId).toBe(window?.id);
    });
  });

  describe('Window Closing', () => {
    it('should close a window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      expect(window).toBeTruthy();

      await component.closeWindow(window!.id);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('close_pip_window', { windowId: window!.id });
    });

    it('should dispatch windowClosed event', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('windowClosed', handler);

      const window = await component.createWindow('video', 'Test');
      await component.closeWindow(window!.id);
      await tick();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { windowId: window!.id },
      }));
    });

    it('should close all windows', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      await component.createWindow('video', 'Test 1');
      await component.createWindow('call', 'Test 2');
      await tick();

      await component.closeAllWindows();
      await tick();

      let count = 0;
      component.windowCount.subscribe((c) => (count = c));

      expect(count).toBe(0);
    });
  });

  describe('Window Movement', () => {
    it('should move a window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await component.moveWindow(window!.id, 200, 300);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('move_pip_window', {
        windowId: window!.id,
        x: 200,
        y: 300,
      });
    });

    it('should dispatch windowMoved event', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('windowMoved', handler);

      const window = await component.createWindow('video', 'Test');
      await component.moveWindow(window!.id, 200, 300);
      await tick();

      expect(handler).toHaveBeenCalled();
    });

    it('should snap to corners when enabled', async () => {
      const { component } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: { snapToCorners: true, snapDistance: 20 },
        },
      });

      const window = await component.createWindow('video', 'Test');
      // Move close to top-left corner (20, 20 is within snap distance of padding 20)
      await component.moveWindow(window!.id, 25, 25);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('move_pip_window', expect.objectContaining({
        windowId: window!.id,
      }));
    });
  });

  describe('Window Resizing', () => {
    it('should resize a window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await component.resizeWindow(window!.id, 400, 225);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('resize_pip_window', expect.objectContaining({
        windowId: window!.id,
      }));
    });

    it('should respect minimum dimensions', async () => {
      const { component } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: { minWidth: 200, minHeight: 112 },
        },
      });

      const window = await component.createWindow('video', 'Test');
      await component.resizeWindow(window!.id, 100, 50);
      await tick();

      // Should be clamped to minimum
      expect(mockInvoke).toHaveBeenCalledWith('resize_pip_window', expect.objectContaining({
        windowId: window!.id,
        width: 200,
      }));
    });

    it('should respect maximum dimensions', async () => {
      const { component } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: { maxWidth: 800, maxHeight: 450 },
        },
      });

      const window = await component.createWindow('video', 'Test');
      await component.resizeWindow(window!.id, 1000, 600);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('resize_pip_window', expect.objectContaining({
        windowId: window!.id,
        width: 800,
      }));
    });

    it('should dispatch windowResized event', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('windowResized', handler);

      const window = await component.createWindow('video', 'Test');
      await component.resizeWindow(window!.id, 400, 225);
      await tick();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Visibility', () => {
    it('should toggle window visibility', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      expect(window?.isVisible).toBe(true);

      await component.toggleVisibility(window!.id);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('set_pip_visibility', {
        windowId: window!.id,
        visible: false,
      });
    });

    it('should dispatch visibilityChanged event', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('visibilityChanged', handler);

      const window = await component.createWindow('video', 'Test');
      await component.toggleVisibility(window!.id);
      await tick();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Opacity', () => {
    it('should set window opacity', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await component.setOpacity(window!.id, 0.7);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('set_pip_opacity', {
        windowId: window!.id,
        opacity: 0.7,
      });
    });

    it('should clamp opacity to valid range', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await component.setOpacity(window!.id, 1.5);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('set_pip_opacity', {
        windowId: window!.id,
        opacity: 1.0,
      });
    });

    it('should not allow opacity below minimum', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      await component.setOpacity(window!.id, 0);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('set_pip_opacity', {
        windowId: window!.id,
        opacity: 0.1,
      });
    });
  });

  describe('Always on Top', () => {
    it('should toggle always on top', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test');
      expect(window?.alwaysOnTop).toBe(true);

      await component.toggleAlwaysOnTop(window!.id);
      await tick();

      expect(mockInvoke).toHaveBeenCalledWith('set_pip_always_on_top', {
        windowId: window!.id,
        alwaysOnTop: false,
      });
    });
  });

  describe('Configuration', () => {
    it('should apply custom configuration', () => {
      const { container } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: {
            defaultWidth: 400,
            defaultHeight: 225,
            borderRadius: 12,
          },
        },
      });

      expect(container.querySelector('.pip-manager')).toBeTruthy();
    });

    it('should merge config with defaults', async () => {
      const { component } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: {
            defaultWidth: 400,
          },
        },
      });

      const window = await component.createWindow('video', 'Test');

      expect(window?.width).toBe(400);
      // Height should use default
    });
  });

  describe('Window Count', () => {
    it('should track window count correctly', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      let count = 0;
      component.windowCount.subscribe((c) => (count = c));

      expect(count).toBe(0);

      const window1 = await component.createWindow('video', 'Test 1');
      await tick();
      expect(count).toBe(1);

      const window2 = await component.createWindow('call', 'Test 2');
      await tick();
      expect(count).toBe(2);

      await component.closeWindow(window1!.id);
      await tick();
      expect(count).toBe(1);
    });

    it('should render window count indicator', async () => {
      const { component, container } = render(PictureInPictureManager, { props: { enabled: true } });

      await component.createWindow('video', 'Test');
      await tick();

      const indicator = container.querySelector('.pip-count');
      expect(indicator).toBeTruthy();
      expect(indicator?.textContent).toContain('1 PiP window');
    });

    it('should pluralize window count correctly', async () => {
      const { component, container } = render(PictureInPictureManager, { props: { enabled: true } });

      await component.createWindow('video', 'Test 1');
      await component.createWindow('call', 'Test 2');
      await tick();

      const indicator = container.querySelector('.pip-count');
      expect(indicator?.textContent).toContain('2 PiP windows');
    });
  });

  describe('Error Handling', () => {
    it('should dispatch error event on creation failure', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'create_pip_window') {
          throw new Error('Creation failed');
        }
        return null;
      });

      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const handler = vi.fn();
      component.$on('error', handler);

      await component.createWindow('video', 'Test');
      await tick();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({
          message: 'Creation failed',
          code: 'CREATE_FAILED',
        }),
      }));
    });

    it('should dispatch error when disabled', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: false } });

      const handler = vi.fn();
      component.$on('error', handler);

      await component.createWindow('video', 'Test');
      await tick();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({
          code: 'DISABLED',
        }),
      }));
    });
  });

  describe('Content Types', () => {
    it('should create video PiP window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Video');
      expect(window?.contentType).toBe('video');
    });

    it('should create call PiP window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('call', 'Video Call');
      expect(window?.contentType).toBe('call');
    });

    it('should create media PiP window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('media', 'Music');
      expect(window?.contentType).toBe('media');
    });

    it('should create custom PiP window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('custom', 'Custom Content');
      expect(window?.contentType).toBe('custom');
    });
  });

  describe('Aspect Ratio', () => {
    it('should maintain aspect ratio when configured', async () => {
      const { component } = render(PictureInPictureManager, {
        props: {
          enabled: true,
          config: { maintainAspectRatio: true },
        },
      });

      const window = await component.createWindow('video', 'Test', undefined, {
        aspectRatio: 16 / 9,
      });

      expect(window?.aspectRatio).toBe(16 / 9);
    });
  });

  describe('Source ID', () => {
    it('should store source ID for window', async () => {
      const { component } = render(PictureInPictureManager, { props: { enabled: true } });

      const window = await component.createWindow('video', 'Test', 'video-source-123');

      expect(window?.sourceId).toBe('video-source-123');
    });
  });
});
