import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import MultiMonitorManager from './MultiMonitorManager.svelte';

// Mock Tauri APIs
const mockMonitors = [
  {
    name: 'Display 1',
    size: { width: 1920, height: 1080 },
    position: { x: 0, y: 0 },
    scaleFactor: 1
  },
  {
    name: 'Display 2',
    size: { width: 2560, height: 1440 },
    position: { x: 1920, y: 0 },
    scaleFactor: 1.25
  }
];

const mockAppWindow = {
  outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
  outerSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
  setPosition: vi.fn().mockResolvedValue(undefined),
  setSize: vi.fn().mockResolvedValue(undefined),
  currentMonitor: vi.fn().mockResolvedValue({ name: 'Display 1' })
};

const mockTauriMonitor = {
  availableMonitors: vi.fn().mockResolvedValue(mockMonitors),
  primaryMonitor: vi.fn().mockResolvedValue(mockMonitors[0])
};

const mockTauriWindow = {
  getCurrentWindow: vi.fn().mockReturnValue(mockAppWindow),
  appWindow: mockAppWindow
};

describe('MultiMonitorManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Tauri mock
    (window as any).__TAURI__ = {
      window: mockTauriWindow,
      monitor: mockTauriMonitor
    };
  });

  afterEach(() => {
    cleanup();
    delete (window as any).__TAURI__;
  });

  describe('rendering', () => {
    it('should render the component', () => {
      const { container } = render(MultiMonitorManager);
      expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
    });

    it('should render monitors list container', () => {
      const { container } = render(MultiMonitorManager);
      expect(container.querySelector('.monitors-list')).toBeTruthy();
    });
  });

  describe('monitor detection', () => {
    it('should call availableMonitors when autoDetect is true', async () => {
      render(MultiMonitorManager, { props: { autoDetect: true } });
      
      await vi.waitFor(() => {
        expect(mockTauriMonitor.availableMonitors).toHaveBeenCalled();
      });
    });

    it('should not auto-detect when autoDetect is false', async () => {
      render(MultiMonitorManager, { props: { autoDetect: false } });
      
      // Wait a bit to ensure no call happens
      await new Promise(r => setTimeout(r, 50));
      expect(mockTauriMonitor.availableMonitors).not.toHaveBeenCalled();
    });

    it('should handle detection errors gracefully', async () => {
      mockTauriMonitor.availableMonitors.mockRejectedValue(new Error('Detection failed'));
      
      const { container } = render(MultiMonitorManager, { props: { autoDetect: true } });
      
      await vi.waitFor(() => {
        expect(container.querySelector('.error-message')).toBeTruthy();
      });
    });
  });

  describe('web fallback', () => {
    it('should use web APIs when Tauri is not available', async () => {
      delete (window as any).__TAURI__;
      
      // Mock window.screen
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1920,
          height: 1080,
          colorDepth: 24
        },
        configurable: true
      });
      
      const { container } = render(MultiMonitorManager, { props: { autoDetect: true } });
      
      await vi.waitFor(() => {
        // Should render successfully even without Tauri
        expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA list role', () => {
      const { container } = render(MultiMonitorManager);
      
      const list = container.querySelector('[role="list"]');
      expect(list).toBeTruthy();
      expect(list?.getAttribute('aria-label')).toBe('Connected monitors');
    });

    it('should announce errors with alert role', async () => {
      mockTauriMonitor.availableMonitors.mockRejectedValue(new Error('Test error'));
      
      const { container } = render(MultiMonitorManager, { props: { autoDetect: true } });
      
      await vi.waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert).toBeTruthy();
      });
    });
  });

  describe('props', () => {
    it('should accept autoDetect prop', () => {
      const { container } = render(MultiMonitorManager, { props: { autoDetect: false } });
      expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
    });

    it('should accept rememberWindowPosition prop', () => {
      const { container } = render(MultiMonitorManager, { props: { rememberWindowPosition: true } });
      expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
    });

    it('should accept moveWindowOnMonitorChange prop', () => {
      const { container } = render(MultiMonitorManager, { props: { moveWindowOnMonitorChange: false } });
      expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
    });

    it('should accept preferredMonitor prop', () => {
      const { container } = render(MultiMonitorManager, { props: { preferredMonitor: 'Display 1' } });
      expect(container.querySelector('[data-testid="multi-monitor-manager"]')).toBeTruthy();
    });
  });

  describe('API exposure', () => {
    it('should expose api object', () => {
      const { component } = render(MultiMonitorManager);
      
      expect((component as any).api).toBeDefined();
      expect(typeof (component as any).api.detectMonitors).toBe('function');
      expect(typeof (component as any).api.moveToMonitor).toBe('function');
      expect(typeof (component as any).api.moveToPrimary).toBe('function');
      expect(typeof (component as any).api.saveWindowPosition).toBe('function');
      expect(typeof (component as any).api.restoreWindowPosition).toBe('function');
      expect(typeof (component as any).api.startMonitoring).toBe('function');
      expect(typeof (component as any).api.stopMonitoring).toBe('function');
      expect(typeof (component as any).api.getMonitorAtPoint).toBe('function');
      expect(typeof (component as any).api.getDesktopBounds).toBe('function');
      expect(typeof (component as any).api.getWindowPosition).toBe('function');
    });
  });

  describe('styles', () => {
    it('should have proper container styling', () => {
      const { container } = render(MultiMonitorManager);
      const manager = container.querySelector('.multi-monitor-manager');
      expect(manager).toBeTruthy();
    });

    it('should have spinner class for loading indicator', async () => {
      mockTauriMonitor.availableMonitors.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockMonitors), 500))
      );
      
      const { container } = render(MultiMonitorManager, { props: { autoDetect: true } });
      
      // Detecting indicator should show initially
      expect(container.querySelector('.detecting-indicator')).toBeTruthy();
      expect(container.querySelector('.spinner')).toBeTruthy();
    });
  });

  describe('cleanup', () => {
    it('should stop monitoring on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(MultiMonitorManager, { props: { autoDetect: true } });
      
      await vi.waitFor(() => {
        expect(mockTauriMonitor.availableMonitors).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
