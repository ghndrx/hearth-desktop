import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AutoLaunchSettings from './AutoLaunchSettings.svelte';

// Mock Tauri APIs
const mockIsEnabled = vi.fn();
const mockEnable = vi.fn();
const mockDisable = vi.fn();
const mockPlatform = vi.fn();
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn()
};
const mockEmit = vi.fn();

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: () => mockIsEnabled(),
  enable: () => mockEnable(),
  disable: () => mockDisable()
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => mockPlatform()
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: () => Promise.resolve(mockStore)
  }
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: (event: string, payload: any) => mockEmit(event, payload)
}));

describe('AutoLaunchSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEnabled.mockResolvedValue(false);
    mockPlatform.mockResolvedValue('darwin');
    mockStore.get.mockResolvedValue(null);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.save.mockResolvedValue(undefined);
    
    // Mock Tauri environment
    (window as any).__TAURI_INTERNALS__ = {};
  });
  
  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('renders the settings header', async () => {
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByText('Startup & System Tray')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    render(AutoLaunchSettings);
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('loads current autostart state on mount', async () => {
    mockIsEnabled.mockResolvedValue(true);
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      const checkbox = screen.getByLabelText('Launch on Login') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  it('enables autostart when toggle is clicked', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockResolvedValue(undefined);
    
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Launch on Login')).toBeInTheDocument();
    });
    
    const checkbox = screen.getByLabelText('Launch on Login');
    await fireEvent.click(checkbox);
    
    await waitFor(() => {
      expect(mockEnable).toHaveBeenCalled();
    });
  });

  it('disables autostart when toggle is clicked off', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockDisable.mockResolvedValue(undefined);
    
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Launch on Login')).toBeInTheDocument();
    });
    
    const checkbox = screen.getByLabelText('Launch on Login');
    await fireEvent.click(checkbox);
    
    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalled();
    });
  });

  it('shows error message when toggle fails', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockRejectedValue(new Error('Permission denied'));
    
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Launch on Login')).toBeInTheDocument();
    });
    
    const checkbox = screen.getByLabelText('Launch on Login');
    await fireEvent.click(checkbox);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to change startup setting. Please try again.')).toBeInTheDocument();
    });
  });

  it('saves start minimized setting', async () => {
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Launch on Login')).toBeInTheDocument();
    });
    
    // Enable autostart first to enable the minimized toggle
    mockEnable.mockResolvedValue(undefined);
    const autoLaunchCheckbox = screen.getByLabelText('Launch on Login');
    await fireEvent.click(autoLaunchCheckbox);
    
    await waitFor(() => {
      const minimizedCheckbox = screen.getByLabelText('Start Minimized');
      expect(minimizedCheckbox).not.toBeDisabled();
    });
    
    const minimizedCheckbox = screen.getByLabelText('Start Minimized');
    await fireEvent.click(minimizedCheckbox);
    
    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith('startMinimized', true);
      expect(mockStore.save).toHaveBeenCalled();
    });
  });

  it('emits tray preference event when minimize to tray is changed', async () => {
    mockStore.get.mockImplementation((key: string) => {
      if (key === 'minimizeToTray') return Promise.resolve(true);
      return Promise.resolve(null);
    });
    
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Minimize to Tray on Close')).toBeInTheDocument();
    });
    
    const trayCheckbox = screen.getByLabelText('Minimize to Tray on Close');
    await fireEvent.click(trayCheckbox);
    
    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('tray-preference-changed', { minimizeToTray: false });
    });
  });

  it('shows platform-specific info for macOS', async () => {
    mockPlatform.mockResolvedValue('darwin');
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByText(/System Settings.*Login Items/)).toBeInTheDocument();
    });
  });

  it('shows platform-specific info for Windows', async () => {
    mockPlatform.mockResolvedValue('windows');
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByText(/Settings.*Apps.*Startup/)).toBeInTheDocument();
    });
  });

  it('shows platform-specific info for Linux', async () => {
    mockPlatform.mockResolvedValue('linux');
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByText(/autostart/)).toBeInTheDocument();
    });
  });

  it('disables start minimized when autostart is off', async () => {
    mockIsEnabled.mockResolvedValue(false);
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      const minimizedCheckbox = screen.getByLabelText('Start Minimized') as HTMLInputElement;
      expect(minimizedCheckbox.disabled).toBe(true);
    });
  });

  it('shows not available message when not in Tauri', async () => {
    delete (window as any).__TAURI_INTERNALS__;
    
    render(AutoLaunchSettings);
    
    await waitFor(() => {
      expect(screen.getByText('Startup settings are only available in the desktop app.')).toBeInTheDocument();
    });
  });
});
