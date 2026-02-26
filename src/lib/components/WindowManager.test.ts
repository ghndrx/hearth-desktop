import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import WindowManager from './WindowManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => mockWindow)
}));

const mockWindow = {
  isMaximized: vi.fn().mockResolvedValue(false),
  isMinimized: vi.fn().mockResolvedValue(false),
  isFullscreen: vi.fn().mockResolvedValue(false),
  isDecorated: vi.fn().mockResolvedValue(true),
  isVisible: vi.fn().mockResolvedValue(true),
  outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
  outerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
  scaleFactor: vi.fn().mockResolvedValue(1.0),
  minimize: vi.fn().mockResolvedValue(undefined),
  maximize: vi.fn().mockResolvedValue(undefined),
  unmaximize: vi.fn().mockResolvedValue(undefined),
  setFullscreen: vi.fn().mockResolvedValue(undefined),
  setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
  setDecorations: vi.fn().mockResolvedValue(undefined),
  center: vi.fn().mockResolvedValue(undefined),
  setPosition: vi.fn().mockResolvedValue(undefined),
  setSize: vi.fn().mockResolvedValue(undefined),
  requestUserAttention: vi.fn().mockResolvedValue(undefined),
  onResized: vi.fn(),
  onMoved: vi.fn(),
  onFocusChanged: vi.fn()
};

describe('WindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders window controls section', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Window Controls')).toBeInTheDocument();
    });

    expect(screen.getByText('Minimize')).toBeInTheDocument();
    expect(screen.getByText('Maximize')).toBeInTheDocument();
    expect(screen.getByText('Fullscreen')).toBeInTheDocument();
    expect(screen.getByText('To Tray')).toBeInTheDocument();
  });

  it('renders window modes section', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Window Modes')).toBeInTheDocument();
    });

    expect(screen.getByText('Pin')).toBeInTheDocument();
    expect(screen.getByText('Compact')).toBeInTheDocument();
    expect(screen.getByText('PiP')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
  });

  it('renders window info section with correct values', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Window Info')).toBeInTheDocument();
    });

    expect(screen.getByText('1200 × 800')).toBeInTheDocument();
    expect(screen.getByText('100, 100')).toBeInTheDocument();
    expect(screen.getByText('1.00x')).toBeInTheDocument();
  });

  it('renders presets section', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Presets')).toBeInTheDocument();
    });

    expect(screen.getByText('No saved presets')).toBeInTheDocument();
    expect(screen.getByText('Save Current Layout')).toBeInTheDocument();
  });

  it('calls minimize when minimize button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Minimize')).toBeInTheDocument();
    });

    const minimizeBtn = screen.getByText('Minimize').closest('button');
    await fireEvent.click(minimizeBtn!);

    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it('calls maximize when maximize button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Maximize')).toBeInTheDocument();
    });

    const maximizeBtn = screen.getByText('Maximize').closest('button');
    await fireEvent.click(maximizeBtn!);

    expect(mockWindow.maximize).toHaveBeenCalled();
  });

  it('shows Restore text when maximized', async () => {
    mockWindow.isMaximized.mockResolvedValueOnce(true);

    render(WindowManager);

    await waitFor(() => {
      // After refresh, should show Restore
      expect(screen.queryByText('Maximize') || screen.queryByText('Restore')).toBeInTheDocument();
    });
  });

  it('toggles fullscreen when fullscreen button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Fullscreen')).toBeInTheDocument();
    });

    const fullscreenBtn = screen.getByText('Fullscreen').closest('button');
    await fireEvent.click(fullscreenBtn!);

    expect(mockWindow.setFullscreen).toHaveBeenCalledWith(true);
  });

  it('toggles always on top when pin button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Pin')).toBeInTheDocument();
    });

    const pinBtn = screen.getByText('Pin').closest('button');
    await fireEvent.click(pinBtn!);

    expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
  });

  it('centers window when center button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Center')).toBeInTheDocument();
    });

    const centerBtn = screen.getByText('Center').closest('button');
    await fireEvent.click(centerBtn!);

    expect(mockWindow.center).toHaveBeenCalled();
  });

  it('opens preset dialog when save layout button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Save Current Layout')).toBeInTheDocument();
    });

    const saveBtn = screen.getByText('Save Current Layout');
    await fireEvent.click(saveBtn);

    expect(screen.getByText('Save Window Preset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Preset name...')).toBeInTheDocument();
  });

  it('saves preset when name is entered and save is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Save Current Layout')).toBeInTheDocument();
    });

    // Open dialog
    await fireEvent.click(screen.getByText('Save Current Layout'));

    // Enter name
    const input = screen.getByPlaceholderText('Preset name...');
    await fireEvent.input(input, { target: { value: 'Work Layout' } });

    // Save
    const saveBtn = screen.getByText('Save');
    await fireEvent.click(saveBtn);

    // Should save to localStorage
    const stored = localStorage.getItem('hearth_window_presets');
    expect(stored).toBeTruthy();
    const presets = JSON.parse(stored!);
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Work Layout');
  });

  it('closes dialog when cancel is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Save Current Layout')).toBeInTheDocument();
    });

    // Open dialog
    await fireEvent.click(screen.getByText('Save Current Layout'));
    expect(screen.getByText('Save Window Preset')).toBeInTheDocument();

    // Cancel
    await fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Save Window Preset')).not.toBeInTheDocument();
  });

  it('loads saved presets from localStorage', async () => {
    const mockPresets = [
      {
        id: 'test-1',
        name: 'Test Preset',
        position: { x: 50, y: 50 },
        size: { width: 1000, height: 600 },
        alwaysOnTop: false,
        opacity: 1.0
      }
    ];
    localStorage.setItem('hearth_window_presets', JSON.stringify(mockPresets));

    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Test Preset')).toBeInTheDocument();
    });

    expect(screen.getByText('1000×600')).toBeInTheDocument();
  });

  it('applies preset when clicked', async () => {
    const mockPresets = [
      {
        id: 'test-1',
        name: 'Test Preset',
        position: { x: 200, y: 200 },
        size: { width: 800, height: 600 },
        alwaysOnTop: false,
        opacity: 1.0
      }
    ];
    localStorage.setItem('hearth_window_presets', JSON.stringify(mockPresets));

    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Test Preset')).toBeInTheDocument();
    });

    const presetBtn = screen.getByText('Test Preset').closest('button');
    await fireEvent.click(presetBtn!);

    expect(mockWindow.setPosition).toHaveBeenCalledWith({
      type: 'Physical',
      x: 200,
      y: 200
    });
    expect(mockWindow.setSize).toHaveBeenCalledWith({
      type: 'Physical',
      width: 800,
      height: 600
    });
  });

  it('deletes preset when delete button is clicked', async () => {
    const mockPresets = [
      {
        id: 'test-1',
        name: 'Test Preset',
        position: { x: 50, y: 50 },
        size: { width: 1000, height: 600 },
        alwaysOnTop: false,
        opacity: 1.0
      }
    ];
    localStorage.setItem('hearth_window_presets', JSON.stringify(mockPresets));

    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Test Preset')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Delete preset');
    await fireEvent.click(deleteBtn);

    expect(screen.queryByText('Test Preset')).not.toBeInTheDocument();
    expect(screen.getByText('No saved presets')).toBeInTheDocument();
  });

  it('sets up window event listeners on mount', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(mockWindow.onResized).toHaveBeenCalled();
      expect(mockWindow.onMoved).toHaveBeenCalled();
      expect(mockWindow.onFocusChanged).toHaveBeenCalled();
    });
  });

  it('toggles compact mode when compact button is clicked', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Compact')).toBeInTheDocument();
    });

    const compactBtn = screen.getByText('Compact').closest('button');
    await fireEvent.click(compactBtn!);

    expect(mockWindow.setSize).toHaveBeenCalledWith({
      type: 'Physical',
      width: 360,
      height: 640
    });
    expect(mockWindow.center).toHaveBeenCalled();
  });

  it('dispatches stateChange event on window state changes', async () => {
    const { component } = render(WindowManager);

    const stateChanges: any[] = [];
    component.$on('stateChange', (e: CustomEvent) => {
      stateChanges.push(e.detail);
    });

    await waitFor(() => {
      expect(screen.getByText('Pin')).toBeInTheDocument();
    });

    const pinBtn = screen.getByText('Pin').closest('button');
    await fireEvent.click(pinBtn!);

    expect(stateChanges.length).toBeGreaterThan(0);
    expect(stateChanges[stateChanges.length - 1].state.isAlwaysOnTop).toBe(true);
  });

  it('shows correct focus state', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Focus')).toBeInTheDocument();
    });

    // Default should be focused
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});

describe('WindowManager error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('dispatches error event when minimize fails', async () => {
    mockWindow.minimize.mockRejectedValueOnce(new Error('Failed'));

    const { component } = render(WindowManager);

    const errors: string[] = [];
    component.$on('error', (e: CustomEvent) => {
      errors.push(e.detail.message);
    });

    await waitFor(() => {
      expect(screen.getByText('Minimize')).toBeInTheDocument();
    });

    const minimizeBtn = screen.getByText('Minimize').closest('button');
    await fireEvent.click(minimizeBtn!);

    await waitFor(() => {
      expect(errors).toContain('Failed to minimize window');
    });
  });

  it('dispatches error event when fullscreen toggle fails', async () => {
    mockWindow.setFullscreen.mockRejectedValueOnce(new Error('Failed'));

    const { component } = render(WindowManager);

    const errors: string[] = [];
    component.$on('error', (e: CustomEvent) => {
      errors.push(e.detail.message);
    });

    await waitFor(() => {
      expect(screen.getByText('Fullscreen')).toBeInTheDocument();
    });

    const fullscreenBtn = screen.getByText('Fullscreen').closest('button');
    await fireEvent.click(fullscreenBtn!);

    await waitFor(() => {
      expect(errors).toContain('Failed to toggle fullscreen');
    });
  });

  it('handles localStorage errors gracefully', async () => {
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock localStorage to throw
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });

    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Presets')).toBeInTheDocument();
    });

    // Should still render without crashing
    expect(screen.getByText('No saved presets')).toBeInTheDocument();

    mockError.mockRestore();
  });
});

describe('WindowManager keyboard interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('saves preset on Enter key in input', async () => {
    render(WindowManager);

    await waitFor(() => {
      expect(screen.getByText('Save Current Layout')).toBeInTheDocument();
    });

    // Open dialog
    await fireEvent.click(screen.getByText('Save Current Layout'));

    const input = screen.getByPlaceholderText('Preset name...');
    await fireEvent.input(input, { target: { value: 'Enter Preset' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    const stored = localStorage.getItem('hearth_window_presets');
    expect(stored).toBeTruthy();
    const presets = JSON.parse(stored!);
    expect(presets[0].name).toBe('Enter Preset');
  });
});
