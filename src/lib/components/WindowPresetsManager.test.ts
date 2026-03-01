import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import WindowPresetsManager from './WindowPresetsManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
    isMaximized: vi.fn().mockResolvedValue(false),
    isFullscreen: vi.fn().mockResolvedValue(false),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    setFullscreen: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
  })),
  LogicalPosition: vi.fn((x, y) => ({ x, y })),
  LogicalSize: vi.fn((w, h) => ({ width: w, height: h })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock crypto.randomUUID
const mockUUID = '12345678-1234-1234-1234-123456789012';
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUID,
});

describe('WindowPresetsManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    const { container } = render(WindowPresetsManager);
    await waitFor(() => {
      expect(container.querySelector('.window-presets-manager')).toBeTruthy();
    });
  });

  it('displays empty state when no presets exist', async () => {
    render(WindowPresetsManager);
    await waitFor(() => {
      expect(screen.getByText('No presets saved yet')).toBeTruthy();
    });
  });

  it('displays the header correctly', async () => {
    render(WindowPresetsManager);
    await waitFor(() => {
      expect(screen.getByText('Window Presets')).toBeTruthy();
      expect(screen.getByText('Save and restore custom window layouts')).toBeTruthy();
    });
  });

  it('shows save dialog when clicking add button', async () => {
    render(WindowPresetsManager);
    await waitFor(() => {
      expect(screen.getByText(/Save Current Position/)).toBeTruthy();
    });

    const addButton = screen.getByText(/Save Current Position/);
    await fireEvent.click(addButton);

    expect(screen.getByText('Save Window Preset')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Preset name/)).toBeTruthy();
  });

  it('saves a new preset', async () => {
    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText(/Save Current Position/)).toBeTruthy();
    });

    // Open save dialog
    await fireEvent.click(screen.getByText(/Save Current Position/));

    // Enter preset name
    const input = screen.getByPlaceholderText(/Preset name/);
    await fireEvent.input(input, { target: { value: 'Test Preset' } });

    // Save preset
    const saveButton = screen.getByText('Save Preset');
    await fireEvent.click(saveButton);

    // Wait for preset to appear
    await waitFor(() => {
      expect(screen.getByText('Test Preset')).toBeTruthy();
    });

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem('hearth-window-presets') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Test Preset');
  });

  it('loads presets from localStorage', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Coding Layout',
        position: { x: 0, y: 0, width: 1920, height: 1080, isMaximized: false, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '💻',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText('Coding Layout')).toBeTruthy();
    });
  });

  it('deletes a preset', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'To Delete',
        position: { x: 0, y: 0, width: 800, height: 600, isMaximized: false, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '🪟',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText('To Delete')).toBeTruthy();
    });

    // Find and click delete button
    const deleteButton = screen.getByTitle('Delete');
    await fireEvent.click(deleteButton);

    // Verify preset is removed
    await waitFor(() => {
      expect(screen.queryByText('To Delete')).toBeNull();
      expect(screen.getByText('No presets saved yet')).toBeTruthy();
    });
  });

  it('respects maxPresets limit', async () => {
    const maxPresets = 3;
    const existingPresets = Array.from({ length: maxPresets }, (_, i) => ({
      id: `preset-${i}`,
      name: `Preset ${i + 1}`,
      position: { x: i * 100, y: 0, width: 800, height: 600, isMaximized: false, isFullscreen: false },
      createdAt: Date.now(),
      lastUsed: Date.now(),
      icon: '🪟',
    }));
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager, { props: { maxPresets } });

    await waitFor(() => {
      expect(screen.getByText(`Maximum of ${maxPresets} presets reached`)).toBeTruthy();
      expect(screen.queryByText(/Save Current Position/)).toBeNull();
    });
  });

  it('shows icon picker in save dialog', async () => {
    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText(/Save Current Position/)).toBeTruthy();
    });

    await fireEvent.click(screen.getByText(/Save Current Position/));

    // Check for icon options
    const iconButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('icon-option')
    );
    expect(iconButtons.length).toBeGreaterThan(0);
  });

  it('displays preset details correctly', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Test Layout',
        position: { x: 100, y: 200, width: 1024, height: 768, isMaximized: false, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '📊',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText('Test Layout')).toBeTruthy();
      expect(screen.getByText(/100, 200/)).toBeTruthy();
      expect(screen.getByText(/1024×768/)).toBeTruthy();
    });
  });

  it('shows Maximized for maximized presets', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Maximized Layout',
        position: { x: 0, y: 0, width: 1920, height: 1080, isMaximized: true, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '⬜',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText(/Maximized/)).toBeTruthy();
    });
  });

  it('shows Fullscreen for fullscreen presets', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Fullscreen Layout',
        position: { x: 0, y: 0, width: 1920, height: 1080, isMaximized: false, isFullscreen: true },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '🖥️',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText(/Fullscreen/)).toBeTruthy();
    });
  });

  it('allows editing preset name', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Original Name',
        position: { x: 0, y: 0, width: 800, height: 600, isMaximized: false, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '🪟',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText('Original Name')).toBeTruthy();
    });

    // Click rename button
    const renameButton = screen.getByTitle('Rename');
    await fireEvent.click(renameButton);

    // Edit input should appear
    const editInput = screen.getByDisplayValue('Original Name');
    expect(editInput).toBeTruthy();

    // Change the name
    await fireEvent.input(editInput, { target: { value: 'New Name' } });

    // Save edit
    const saveButton = screen.getByTitle('Save');
    await fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeTruthy();
      expect(screen.queryByText('Original Name')).toBeNull();
    });
  });

  it('can cancel editing', async () => {
    const existingPresets = [
      {
        id: 'preset-1',
        name: 'Keep This Name',
        position: { x: 0, y: 0, width: 800, height: 600, isMaximized: false, isFullscreen: false },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        icon: '🪟',
      },
    ];
    localStorage.setItem('hearth-window-presets', JSON.stringify(existingPresets));

    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText('Keep This Name')).toBeTruthy();
    });

    // Start editing
    await fireEvent.click(screen.getByTitle('Rename'));

    // Cancel
    await fireEvent.click(screen.getByTitle('Cancel'));

    // Name should be unchanged
    await waitFor(() => {
      expect(screen.getByText('Keep This Name')).toBeTruthy();
    });
  });

  it('closes save dialog on cancel', async () => {
    render(WindowPresetsManager);

    await waitFor(() => {
      expect(screen.getByText(/Save Current Position/)).toBeTruthy();
    });

    // Open dialog
    await fireEvent.click(screen.getByText(/Save Current Position/));
    expect(screen.getByText('Save Window Preset')).toBeTruthy();

    // Cancel
    await fireEvent.click(screen.getByText('Cancel'));

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText('Save Window Preset')).toBeNull();
    });
  });

  it('dispatches events correctly', async () => {
    const { component } = render(WindowPresetsManager);

    const presetSaved = vi.fn();
    const presetDeleted = vi.fn();

    component.$on('presetSaved', presetSaved);
    component.$on('presetDeleted', presetDeleted);

    await waitFor(() => {
      expect(screen.getByText(/Save Current Position/)).toBeTruthy();
    });

    // Save a preset
    await fireEvent.click(screen.getByText(/Save Current Position/));
    await fireEvent.input(screen.getByPlaceholderText(/Preset name/), {
      target: { value: 'Event Test' },
    });
    await fireEvent.click(screen.getByText('Save Preset'));

    await waitFor(() => {
      expect(presetSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { name: 'Event Test' },
        })
      );
    });

    // Delete the preset
    await fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(presetDeleted).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { name: 'Event Test' },
        })
      );
    });
  });
});
