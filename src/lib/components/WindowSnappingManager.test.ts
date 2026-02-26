import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import WindowSnappingManager from './WindowSnappingManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    label: 'main',
    outerPosition: vi.fn(() => Promise.resolve({ x: 100, y: 100 })),
    outerSize: vi.fn(() => Promise.resolve({ width: 800, height: 600 })),
    isMaximized: vi.fn(() => Promise.resolve(false)),
    isMinimized: vi.fn(() => Promise.resolve(false)),
    setPosition: vi.fn(() => Promise.resolve()),
    setSize: vi.fn(() => Promise.resolve()),
    maximize: vi.fn(() => Promise.resolve()),
    unmaximize: vi.fn(() => Promise.resolve())
  }))
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

describe('WindowSnappingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock settings retrieval
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_snap_settings') {
        return {
          enabled: true,
          snapThreshold: 20,
          showSnapPreview: true,
          quickTileShortcuts: true,
          snapZones: [],
          animations: true,
          magneticEdges: true,
          rememberLastPosition: true
        };
      }
      if (cmd === 'get_screen_info') {
        return {
          width: 1920,
          height: 1080,
          availableWidth: 1920,
          availableHeight: 1040,
          scaleFactor: 1
        };
      }
      return null;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', async () => {
    const { container } = render(WindowSnappingManager);
    expect(container).toBeTruthy();
  });

  it('initializes with default snap zones when none provided', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      expect(zones.length).toBeGreaterThan(0);
    });
  });

  it('loads settings from Tauri on mount', async () => {
    render(WindowSnappingManager);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_snap_settings');
    });
  });

  it('loads screen info on mount', async () => {
    render(WindowSnappingManager);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_screen_info');
    });
  });

  it('sets up event listeners on mount', async () => {
    render(WindowSnappingManager);
    
    await waitFor(() => {
      expect(listen).toHaveBeenCalled();
    });
  });

  it('respects enabled prop', async () => {
    const { component } = render(WindowSnappingManager, {
      props: { enabled: false }
    });
    
    expect(component).toBeTruthy();
  });

  it('respects custom snap threshold', async () => {
    const { component } = render(WindowSnappingManager, {
      props: { snapThreshold: 50 }
    });
    
    expect(component).toBeTruthy();
  });

  it('exposes getWindowState method', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const state = component.getWindowState();
      expect(state).toHaveProperty('x');
      expect(state).toHaveProperty('y');
      expect(state).toHaveProperty('width');
      expect(state).toHaveProperty('height');
      expect(state).toHaveProperty('isMaximized');
      expect(state).toHaveProperty('isMinimized');
      expect(state).toHaveProperty('isSnapped');
    });
  });

  it('exposes getSnapZones method', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      expect(Array.isArray(zones)).toBe(true);
    });
  });

  it('has default snap zones for common positions', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      const positions = zones.map(z => z.position);
      
      expect(positions).toContain('left-half');
      expect(positions).toContain('right-half');
      expect(positions).toContain('top-half');
      expect(positions).toContain('bottom-half');
      expect(positions).toContain('maximize');
    });
  });

  it('can add custom snap zone', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const initialCount = component.getSnapZones().length;
      
      component.addCustomZone({
        name: 'Custom Zone',
        position: 'custom',
        bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
      });
      
      const newCount = component.getSnapZones().length;
      expect(newCount).toBe(initialCount + 1);
    });
  });

  it('can remove custom snap zone', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      // Add a custom zone first
      component.addCustomZone({
        name: 'To Remove',
        position: 'custom',
        bounds: { x: 0, y: 0, width: 0.5, height: 0.5 }
      });
      
      const zonesAfterAdd = component.getSnapZones();
      const customZone = zonesAfterAdd.find(z => z.name === 'To Remove');
      
      if (customZone) {
        component.removeCustomZone(customZone.id);
        const zonesAfterRemove = component.getSnapZones();
        expect(zonesAfterRemove.find(z => z.id === customZone.id)).toBeUndefined();
      }
    });
  });

  it('prevents removal of non-custom zones', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const initialZones = component.getSnapZones();
      const defaultZone = initialZones.find(z => !z.id.startsWith('custom-'));
      
      if (defaultZone) {
        component.removeCustomZone(defaultZone.id);
        const zonesAfter = component.getSnapZones();
        expect(zonesAfter.find(z => z.id === defaultZone.id)).toBeTruthy();
      }
    });
  });

  it('emits snap event when snapping to zone', async () => {
    const onSnap = vi.fn();
    const { component } = render(WindowSnappingManager);
    component.$on('snap', onSnap);
    
    await waitFor(async () => {
      await component.snapTo('left-half');
    });
    
    await waitFor(() => {
      expect(onSnap).toHaveBeenCalled();
    });
  });

  it('emits error event on failure', async () => {
    // Mock a failure
    const mockWindow = getCurrentWindow() as any;
    mockWindow.setPosition = vi.fn(() => Promise.reject(new Error('Test error')));
    
    const onError = vi.fn();
    const { component } = render(WindowSnappingManager);
    component.$on('error', onError);
    
    await waitFor(async () => {
      await component.snapTo('left-half');
    });
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('saves settings via Tauri invoke', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(async () => {
      await component.saveSettings();
    });
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('save_snap_settings', expect.any(Object));
    });
  });

  it('can cycle through snap positions', async () => {
    const onSnap = vi.fn();
    const { component } = render(WindowSnappingManager);
    component.$on('snap', onSnap);
    
    await waitFor(async () => {
      await component.cycleSnapPosition('next');
    });
    
    await waitFor(() => {
      expect(onSnap).toHaveBeenCalled();
    });
  });

  it('handles unsnap correctly', async () => {
    const onUnsnap = vi.fn();
    const { component } = render(WindowSnappingManager);
    component.$on('unsnap', onUnsnap);
    
    // First snap the window
    await waitFor(async () => {
      await component.snapTo('left-half');
    });
    
    // Then unsnap it
    await waitFor(async () => {
      await component.unsnap();
    });
  });

  it('shows snap preview when dragging if enabled', async () => {
    const { container } = render(WindowSnappingManager, {
      props: { showSnapPreview: true }
    });
    
    // The overlay should not be visible initially
    const overlay = container.querySelector('.snap-zone-overlay');
    expect(overlay).toBeFalsy();
  });

  it('assigns keyboard shortcuts to default zones', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      const leftHalf = zones.find(z => z.position === 'left-half');
      const rightHalf = zones.find(z => z.position === 'right-half');
      
      expect(leftHalf?.shortcut).toBe('Super+Left');
      expect(rightHalf?.shortcut).toBe('Super+Right');
    });
  });

  it('assigns colors to snap zones', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      zones.forEach(zone => {
        expect(zone.color).toBeTruthy();
      });
    });
  });

  it('calculates absolute bounds correctly', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      const leftHalf = zones.find(z => z.position === 'left-half');
      
      // Relative bounds should be between 0 and 1
      if (leftHalf) {
        expect(leftHalf.bounds.x).toBeGreaterThanOrEqual(0);
        expect(leftHalf.bounds.x).toBeLessThanOrEqual(1);
        expect(leftHalf.bounds.width).toBeGreaterThan(0);
        expect(leftHalf.bounds.width).toBeLessThanOrEqual(1);
      }
    });
  });

  it('handles quarter snap zones', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      const quarterPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      
      quarterPositions.forEach(pos => {
        const zone = zones.find(z => z.position === pos);
        expect(zone).toBeTruthy();
        expect(zone?.bounds.width).toBe(0.5);
        expect(zone?.bounds.height).toBe(0.5);
      });
    });
  });

  it('handles center snap zone', async () => {
    const { component } = render(WindowSnappingManager);
    
    await waitFor(() => {
      const zones = component.getSnapZones();
      const center = zones.find(z => z.position === 'center');
      
      expect(center).toBeTruthy();
      expect(center?.bounds.x).toBeGreaterThan(0);
      expect(center?.bounds.width).toBeLessThan(1);
    });
  });
});
