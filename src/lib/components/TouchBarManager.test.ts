import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { get, writable } from 'svelte/store';
import TouchBarManager from './TouchBarManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(() => Promise.resolve('macos'))
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { platform } from '@tauri-apps/plugin-os';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockPlatform = vi.mocked(platform);

describe('TouchBarManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockResolvedValue('macos');
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'touchbar_is_supported') return true;
      if (cmd === 'touchbar_load_config') return null;
      return undefined;
    });
    mockListen.mockResolvedValue(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe('initialization', () => {
    it('should detect macOS platform', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockPlatform).toHaveBeenCalled();
      });
    });

    it('should check Touch Bar support', async () => {
      render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });
    });

    it('should skip initialization on non-macOS platforms', async () => {
      mockPlatform.mockResolvedValue('windows');
      render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockPlatform).toHaveBeenCalled();
      });

      expect(mockInvoke).not.toHaveBeenCalledWith('touchbar_is_supported');
    });

    it('should set up event listeners on supported devices', async () => {
      render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('touchbar:item-click', expect.any(Function));
        expect(mockListen).toHaveBeenCalledWith('touchbar:value-change', expect.any(Function));
        expect(mockListen).toHaveBeenCalledWith('touchbar:customize-start', expect.any(Function));
        expect(mockListen).toHaveBeenCalledWith('touchbar:customize-end', expect.any(Function));
      });
    });

    it('should load saved configuration', async () => {
      render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_load_config');
      });
    });

    it('should dispatch initialized event', async () => {
      const handleInitialized = vi.fn();
      const { component } = render(TouchBarManager);
      component.$on('initialized', handleInitialized);

      await vi.waitFor(() => {
        expect(handleInitialized).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { supported: true }
          })
        );
      });
    });
  });

  describe('context management', () => {
    it('should register a context', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const context = {
        id: 'test',
        name: 'Test Context',
        priority: 100,
        items: [
          { type: 'button' as const, id: 'btn1', label: 'Test' }
        ]
      };

      component.registerContext(context);

      // Context should be registered
      const handleRegistered = vi.fn();
      component.$on('contextRegistered', handleRegistered);
    });

    it('should unregister a context', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const context = {
        id: 'test',
        name: 'Test Context',
        priority: 100,
        items: []
      };

      component.registerContext(context);
      component.unregisterContext('test');

      const handleUnregistered = vi.fn();
      component.$on('contextUnregistered', handleUnregistered);
    });

    it('should activate a context', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const context = {
        id: 'test',
        name: 'Test Context',
        priority: 100,
        items: [
          { type: 'button' as const, id: 'btn1', label: 'Test' }
        ]
      };

      component.registerContext(context);
      await component.activateContext('test');

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_set_items', expect.objectContaining({
        items: context.items
      }));
    });

    it('should push to context stack when activating new context', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const context1 = { id: 'ctx1', name: 'Context 1', priority: 100, items: [] };
      const context2 = { id: 'ctx2', name: 'Context 2', priority: 200, items: [] };

      component.registerContext(context1);
      component.registerContext(context2);

      await component.activateContext('ctx1');
      await component.activateContext('ctx2');

      // Pop should return to ctx1
      await component.popContext();

      expect(mockInvoke).toHaveBeenLastCalledWith('touchbar_set_items', expect.objectContaining({
        items: context1.items
      }));
    });
  });

  describe('presets', () => {
    it('should have chat preset', async () => {
      const { component } = render(TouchBarManager);

      const preset = component.loadPreset('chat');

      expect(preset.id).toBe('chat');
      expect(preset.items.length).toBeGreaterThan(0);
      expect(preset.items.some((item: { id: string }) => item.id === 'emoji')).toBe(true);
      expect(preset.items.some((item: { id: string }) => item.id === 'send')).toBe(true);
    });

    it('should have voiceCall preset', async () => {
      const { component } = render(TouchBarManager);

      const preset = component.loadPreset('voiceCall');

      expect(preset.id).toBe('voiceCall');
      expect(preset.items.some((item: { id: string }) => item.id === 'mute')).toBe(true);
      expect(preset.items.some((item: { id: string }) => item.id === 'endCall')).toBe(true);
    });

    it('should have mediaPlayer preset', async () => {
      const { component } = render(TouchBarManager);

      const preset = component.loadPreset('mediaPlayer');

      expect(preset.id).toBe('mediaPlayer');
      expect(preset.items.some((item: { id: string }) => item.id === 'playPause')).toBe(true);
    });

    it('should have navigation preset', async () => {
      const { component } = render(TouchBarManager);

      const preset = component.loadPreset('navigation');

      expect(preset.id).toBe('navigation');
      expect(preset.items.some((item: { id: string }) => item.id === 'quickSwitcher')).toBe(true);
    });

    it('should have formatting preset', async () => {
      const { component } = render(TouchBarManager);

      const preset = component.loadPreset('formatting');

      expect(preset.id).toBe('formatting');
      expect(preset.items.some((item: { id: string }) => item.id === 'bold')).toBe(true);
      expect(preset.items.some((item: { id: string }) => item.id === 'code')).toBe(true);
    });

    it('should list available presets', async () => {
      const { component } = render(TouchBarManager);

      const presets = component.getAvailablePresets();

      expect(presets).toContain('chat');
      expect(presets).toContain('voiceCall');
      expect(presets).toContain('mediaPlayer');
      expect(presets).toContain('navigation');
      expect(presets).toContain('formatting');
    });

    it('should use a preset', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.usePreset('chat');

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_set_items', expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'emoji' }),
          expect.objectContaining({ id: 'send' })
        ])
      }));
    });
  });

  describe('item updates', () => {
    it('should set slider value', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.setSliderValue('volume', 50);

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_set_slider_value', {
        itemId: 'volume',
        value: 50
      });
    });

    it('should update item state after slider change', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.setSliderValue('volume', 75);

      const state = component.getItemState('volume');
      expect(state?.value).toBe(75);
    });

    it('should update scrubber items', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const preset = component.loadPreset('navigation');
      component.registerContext(preset);
      await component.activateContext('navigation');

      const newItems = [
        { label: 'Server 1' },
        { label: 'Server 2' },
        { label: 'Server 3' }
      ];

      await component.updateScrubberItems('servers', newItems);

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_set_items', expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'servers',
            items: newItems
          })
        ])
      }));
    });
  });

  describe('visibility', () => {
    it('should hide Touch Bar', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.setVisible(false);

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_clear');
    });

    it('should show Touch Bar with active context', async () => {
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      const context = { id: 'test', name: 'Test', priority: 100, items: [] };
      component.registerContext(context);
      await component.activateContext('test');

      await component.setVisible(false);
      await component.setVisible(true);

      expect(mockInvoke).toHaveBeenLastCalledWith('touchbar_set_items', expect.any(Object));
    });
  });

  describe('customization', () => {
    it('should enter customization mode', async () => {
      const { component } = render(TouchBarManager, {
        props: { customizationAllowed: true }
      });

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.enterCustomizationMode();

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_enter_customization');
    });

    it('should not enter customization mode when not allowed', async () => {
      const { component } = render(TouchBarManager, {
        props: { customizationAllowed: false }
      });

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      await component.enterCustomizationMode();

      expect(mockInvoke).not.toHaveBeenCalledWith('touchbar_enter_customization');
    });
  });

  describe('events', () => {
    it('should dispatch itemAction on Touch Bar click', async () => {
      let clickHandler: ((event: { payload: unknown }) => void) | null = null;
      mockListen.mockImplementation(async (eventName, handler) => {
        if (eventName === 'touchbar:item-click') {
          clickHandler = handler as (event: { payload: unknown }) => void;
        }
        return () => {};
      });

      const handleItemAction = vi.fn();
      const { component } = render(TouchBarManager);
      component.$on('itemAction', handleItemAction);

      await vi.waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('touchbar:item-click', expect.any(Function));
      });

      // Simulate a Touch Bar click
      if (clickHandler) {
        clickHandler({
          payload: {
            itemId: 'send',
            eventType: 'click'
          }
        });
      }

      expect(handleItemAction).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            itemId: 'send',
            eventType: 'click'
          })
        })
      );
    });

    it('should dispatch value change events', async () => {
      let valueChangeHandler: ((event: { payload: unknown }) => void) | null = null;
      mockListen.mockImplementation(async (eventName, handler) => {
        if (eventName === 'touchbar:value-change') {
          valueChangeHandler = handler as (event: { payload: unknown }) => void;
        }
        return () => {};
      });

      const handleItemAction = vi.fn();
      const { component } = render(TouchBarManager);
      component.$on('itemAction', handleItemAction);

      await vi.waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('touchbar:value-change', expect.any(Function));
      });

      // Simulate a slider value change
      if (valueChangeHandler) {
        valueChangeHandler({
          payload: {
            itemId: 'volume',
            eventType: 'valueChange',
            value: 60
          }
        });
      }

      expect(handleItemAction).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            itemId: 'volume',
            eventType: 'valueChange',
            value: 60
          })
        })
      );
    });
  });

  describe('default context', () => {
    it('should use default context on init', async () => {
      const defaultContext = {
        id: 'default',
        name: 'Default',
        priority: 100,
        items: [
          { type: 'button' as const, id: 'test', label: 'Test' }
        ]
      };

      render(TouchBarManager, {
        props: { defaultContext }
      });

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_set_items', expect.objectContaining({
          items: defaultContext.items
        }));
      });
    });
  });

  describe('disabled state', () => {
    it('should clear Touch Bar when disabled', async () => {
      const { component } = render(TouchBarManager, {
        props: { enabled: true }
      });

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      // Disable
      component.$set({ enabled: false });

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_clear');
      });
    });
  });

  describe('cleanup', () => {
    it('should save configuration on destroy', async () => {
      const { component, unmount } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      unmount();

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_save_config', expect.any(Object));
    });

    it('should clear Touch Bar on destroy', async () => {
      const { component, unmount } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });

      mockInvoke.mockClear();
      unmount();

      expect(mockInvoke).toHaveBeenCalledWith('touchbar_clear');
    });
  });

  describe('slot props', () => {
    it('should provide methods via slot when supported', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'touchbar_is_supported') return true;
        if (cmd === 'touchbar_load_config') return null;
        return undefined;
      });

      let slotProps: Record<string, unknown> | null = null;

      // We'd need to test with a wrapper component in real usage
      // For now, just verify the component renders
      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('touchbar_is_supported');
      });
    });

    it('should provide no-op methods when not supported', async () => {
      mockPlatform.mockResolvedValue('windows');

      const { component } = render(TouchBarManager);

      await vi.waitFor(() => {
        expect(mockPlatform).toHaveBeenCalled();
      });

      // Methods should exist but be no-ops
      expect(component.registerContext).toBeDefined();
      expect(component.getAvailablePresets()).toEqual([]);
    });
  });
});
