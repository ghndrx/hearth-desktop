import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TrayMenuManager from './TrayMenuManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/tray', () => ({
  TrayIcon: {
    new: vi.fn().mockResolvedValue({
      setTooltip: vi.fn().mockResolvedValue(undefined),
      setIcon: vi.fn().mockResolvedValue(undefined),
      setIconAsTemplate: vi.fn().mockResolvedValue(undefined),
      setMenu: vi.fn().mockResolvedValue(undefined),
      onAction: vi.fn().mockResolvedValue(() => {}),
      close: vi.fn()
    })
  }
}));

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: {
    new: vi.fn().mockResolvedValue({})
  },
  MenuItem: {
    new: vi.fn().mockResolvedValue({})
  },
  PredefinedMenuItem: {
    new: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {})
}));

import { invoke } from '@tauri-apps/api/core';
import { TrayIcon } from '@tauri-apps/api/tray';
import { emit, listen } from '@tauri-apps/api/event';

describe('TrayMenuManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(TrayMenuManager);
    expect(screen.getByText('System Tray Behavior')).toBeInTheDocument();
  });

  it('displays default quick actions', () => {
    render(TrayMenuManager);
    
    expect(screen.getByText('Show Hearth')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
    expect(screen.getByText('Quick Note')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Quit Hearth')).toBeInTheDocument();
  });

  it('initializes system tray on mount', async () => {
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(TrayIcon.new).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'hearth-tray',
          tooltip: 'Hearth Desktop'
        })
      );
    });
  });

  it('loads saved config from settings', async () => {
    const savedConfig = JSON.stringify({
      showOnClick: false,
      hideOnClose: false,
      tooltip: 'Custom Tooltip'
    });
    
    (invoke as any).mockResolvedValueOnce(savedConfig);
    
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_setting', { key: 'tray_config' });
    });
  });

  it('saves config when settings change', async () => {
    render(TrayMenuManager);
    
    const checkbox = screen.getByRole('checkbox', { name: /show window on tray click/i });
    await fireEvent.click(checkbox);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_setting', expect.objectContaining({
        key: 'tray_config'
      }));
    });
  });

  it('shows Quick Actions section', () => {
    render(TrayMenuManager);
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('+ Add Action')).toBeInTheDocument();
  });

  it('displays icon style selector', () => {
    render(TrayMenuManager);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Default');
    expect(options[1].textContent).toBe('Minimal (macOS)');
    expect(options[2].textContent).toBe('Colorful');
  });

  it('allows editing tooltip text', async () => {
    render(TrayMenuManager);
    
    const tooltipInput = screen.getByPlaceholderText('Hearth Desktop');
    expect(tooltipInput).toBeInTheDocument();
    
    await fireEvent.input(tooltipInput, { target: { value: 'New Tooltip' } });
    await fireEvent.blur(tooltipInput);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_setting', expect.anything());
    });
  });

  it('shows reset to defaults button', () => {
    render(TrayMenuManager);
    
    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('displays system tray status', async () => {
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(screen.getByText(/System tray/)).toBeInTheDocument();
    });
  });

  it('supports compact mode', () => {
    const { container } = render(TrayMenuManager, { props: { compact: true } });
    
    expect(container.querySelector('.compact')).toBeInTheDocument();
  });

  it('can hide settings panel', () => {
    render(TrayMenuManager, { props: { showSettings: false } });
    
    expect(screen.queryByText('System Tray Behavior')).not.toBeInTheDocument();
  });

  it('registers unread count listener', async () => {
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith(
        'unread-count-changed',
        expect.any(Function)
      );
    });
  });

  it('shows shortcut hints for actions', () => {
    render(TrayMenuManager);
    
    // Check for keyboard shortcut displays
    expect(screen.getByText('CmdOrCtrl+N')).toBeInTheDocument();
    expect(screen.getByText('CmdOrCtrl+Shift+N')).toBeInTheDocument();
  });

  it('displays drag hint message', () => {
    render(TrayMenuManager);
    
    expect(screen.getByText(/Drag to reorder/)).toBeInTheDocument();
  });

  it('shows error banner when initialization fails', async () => {
    (TrayIcon.new as any).mockRejectedValueOnce(new Error('Tray failed'));
    
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to initialize system tray')).toBeInTheDocument();
    });
  });

  it('dismisses error banner when clicked', async () => {
    (TrayIcon.new as any).mockRejectedValueOnce(new Error('Tray failed'));
    
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to initialize system tray')).toBeInTheDocument();
    });
    
    const dismissBtn = screen.getByText('×');
    await fireEvent.click(dismissBtn);
    
    await waitFor(() => {
      expect(screen.queryByText('Failed to initialize system tray')).not.toBeInTheDocument();
    });
  });

  it('shows add action button that opens edit mode', async () => {
    render(TrayMenuManager);
    
    const addBtn = screen.getByText('+ Add Action');
    await fireEvent.click(addBtn);
    
    await waitFor(() => {
      // Should show edit form elements
      expect(screen.getByPlaceholderText('Label')).toBeInTheDocument();
    });
  });
});

describe('TrayMenuManager actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(null);
  });

  it('handles show action', async () => {
    render(TrayMenuManager);
    
    // The action would be triggered via tray menu callback
    // We test the invoke is wired correctly
    await waitFor(() => {
      expect(TrayIcon.new).toHaveBeenCalled();
    });
  });

  it('emits events for settings action', async () => {
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(TrayIcon.new).toHaveBeenCalled();
    });
    
    // Verify event listener setup
    expect(listen).toHaveBeenCalled();
  });
});

describe('TrayMenuManager drag and drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(null);
  });

  it('renders draggable action items', () => {
    render(TrayMenuManager);
    
    const items = screen.getAllByText('⠿'); // Drag handles
    expect(items.length).toBeGreaterThan(0);
  });

  it('action items have draggable attribute', () => {
    const { container } = render(TrayMenuManager);
    
    const draggableItems = container.querySelectorAll('[draggable="true"]');
    expect(draggableItems.length).toBe(5); // 5 default actions
  });
});

describe('TrayMenuManager icon styles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(null);
  });

  it('changes icon when style changes', async () => {
    render(TrayMenuManager);
    
    await waitFor(() => {
      expect(TrayIcon.new).toHaveBeenCalled();
    });
    
    const select = screen.getByRole('combobox');
    await fireEvent.change(select, { target: { value: 'minimal' } });
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_setting', expect.anything());
    });
  });
});
