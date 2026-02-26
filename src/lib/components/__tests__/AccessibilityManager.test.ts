import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import AccessibilityManager from '../AccessibilityManager.svelte';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: object) => mockInvoke(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (e: unknown) => void) => mockListen(event, handler),
}));

describe('AccessibilityManager', () => {
  const mockSettings = {
    reducedMotion: false,
    highContrast: false,
    fontScale: 1.0,
    screenReaderEnabled: false,
    keyboardNavigation: true,
    focusIndicators: true,
    colorBlindMode: 'none',
    captionsEnabled: false,
    autoPlayMedia: true,
    animationSpeed: 1.0,
  };

  const mockSystemState = {
    reducedMotion: false,
    highContrast: false,
    screenReaderActive: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_accessibility_settings':
          return Promise.resolve(mockSettings);
        case 'get_system_accessibility_state':
          return Promise.resolve(mockSystemState);
        case 'save_accessibility_settings':
          return Promise.resolve();
        default:
          return Promise.resolve();
      }
    });

    mockListen.mockImplementation(() => Promise.resolve(() => {}));
    
    // Mock localStorage
    const storage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      storage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete storage[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', async () => {
    // Delay the invoke response
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    
    render(AccessibilityManager);
    
    expect(screen.getByText(/loading accessibility settings/i)).toBeInTheDocument();
  });

  it('should display settings after loading', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Accessibility Settings')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Visual')).toBeInTheDocument();
    expect(screen.getByText('Motion & Animation')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
  });

  it('should display system status indicators', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText(/Reduced Motion: Off/)).toBeInTheDocument();
      expect(screen.getByText(/High Contrast: Off/)).toBeInTheDocument();
      expect(screen.getByText(/Screen Reader: Inactive/)).toBeInTheDocument();
    });
  });

  it('should show error state when loading fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to load'));
    
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });

  it('should have font scale select with options', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      const select = screen.getByLabelText(/Font Size/i);
      expect(select).toBeInTheDocument();
    });
    
    const select = screen.getByLabelText(/Font Size/i);
    expect(select).toHaveValue('1');
    
    // Check some options exist
    expect(screen.getByText('Default (100%)')).toBeInTheDocument();
    expect(screen.getByText('Large (125%)')).toBeInTheDocument();
  });

  it('should have toggle switches for boolean settings', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /High Contrast Mode/i })).toBeInTheDocument();
    });
    
    expect(screen.getByRole('switch', { name: /Reduce Motion/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Enhanced Focus Indicators/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Enhanced Keyboard Navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Show Captions/i })).toBeInTheDocument();
  });

  it('should save settings when Save button is clicked', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    await fireEvent.click(saveButton);
    
    expect(mockInvoke).toHaveBeenCalledWith('save_accessibility_settings', expect.any(Object));
  });

  it('should show saved indicator after saving', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    await fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('✓ Settings saved')).toBeInTheDocument();
    });
  });

  it('should have reset to defaults button', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
    });
  });

  it('should toggle reduced motion setting', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Reduce Motion/i })).toBeInTheDocument();
    });
    
    const toggle = screen.getByRole('switch', { name: /Reduce Motion/i });
    expect(toggle).not.toBeChecked();
    
    await fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('should toggle high contrast setting', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /High Contrast Mode/i })).toBeInTheDocument();
    });
    
    const toggle = screen.getByRole('switch', { name: /High Contrast Mode/i });
    expect(toggle).not.toBeChecked();
    
    await fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('should have color blind mode selector', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Color Blind Mode/i)).toBeInTheDocument();
    });
    
    const select = screen.getByLabelText(/Color Blind Mode/i);
    expect(select).toHaveValue('none');
  });

  it('should hide animation speed when reduced motion is on', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_accessibility_settings':
          return Promise.resolve({ ...mockSettings, reducedMotion: true });
        case 'get_system_accessibility_state':
          return Promise.resolve(mockSystemState);
        default:
          return Promise.resolve();
      }
    });

    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Motion & Animation')).toBeInTheDocument();
    });
    
    // Animation speed should not be visible when reduced motion is on
    expect(screen.queryByLabelText(/Animation Speed/i)).not.toBeInTheDocument();
  });

  it('should show animation speed when reduced motion is off', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Animation Speed/i)).toBeInTheDocument();
    });
  });

  it('should have proper ARIA labels', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      const region = screen.getByRole('region', { name: /Accessibility Settings/i });
      expect(region).toBeInTheDocument();
    });
  });

  it('should display keyboard shortcut hint', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText(/Alt/)).toBeInTheDocument();
      expect(screen.getByText(/Shift/)).toBeInTheDocument();
    });
  });

  it('should listen for system accessibility changes', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith(
        'system-accessibility-changed',
        expect.any(Function)
      );
    });
  });

  it('should show active system state indicators', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_accessibility_settings':
          return Promise.resolve(mockSettings);
        case 'get_system_accessibility_state':
          return Promise.resolve({
            reducedMotion: true,
            highContrast: true,
            screenReaderActive: true,
          });
        default:
          return Promise.resolve();
      }
    });

    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText(/Reduced Motion: On/)).toBeInTheDocument();
      expect(screen.getByText(/High Contrast: On/)).toBeInTheDocument();
      expect(screen.getByText(/Screen Reader: Active/)).toBeInTheDocument();
    });
  });

  it('should apply settings to document root', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
    
    // Check that CSS custom property is set
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--a11y-font-scale')).toBe('1');
  });

  it('should handle auto-play media toggle', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Auto-play Media/i })).toBeInTheDocument();
    });
    
    const toggle = screen.getByRole('switch', { name: /Auto-play Media/i });
    expect(toggle).toBeChecked(); // Default is true
    
    await fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it('should handle captions toggle', async () => {
    render(AccessibilityManager);
    
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /Show Captions/i })).toBeInTheDocument();
    });
    
    const toggle = screen.getByRole('switch', { name: /Show Captions/i });
    expect(toggle).not.toBeChecked();
    
    await fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });
});
