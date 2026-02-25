import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import UpdateManager from './UpdateManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

describe('UpdateManager', () => {
  const mockUpdateInfo = {
    version: '2.0.0',
    current_version: '1.0.0',
    body: '## What\'s New\n- Feature 1\n- Feature 2',
    date: '2026-02-25'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when no update is available', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const { container } = render(UpdateManager);
    
    await waitFor(() => {
      expect(container.querySelector('.update-manager')).toBeNull();
    });
  });

  it('shows update banner when update is available', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.getByText(/v1\.0\.0 → v2\.0\.0/)).toBeInTheDocument();
    });
  });

  it('shows Update Now button when update is available', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
  });

  it('shows Later button to dismiss update', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Later')).toBeInTheDocument();
    });
  });

  it('dismisses update banner when Later is clicked', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    const { container } = render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Later')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Later'));
    
    await waitFor(() => {
      expect(container.querySelector('.update-manager')).toBeNull();
    });
  });

  it('shows changelog toggle when body is available', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('View Changelog')).toBeInTheDocument();
    });
  });

  it('toggles changelog visibility', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('View Changelog')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('View Changelog'));
    
    await waitFor(() => {
      expect(screen.getByText('Hide Changelog')).toBeInTheDocument();
    });
  });

  it('starts update download when Update Now is clicked', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockUpdateInfo) // check_for_updates
      .mockResolvedValueOnce(undefined); // download_and_install_update
    
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Update Now'));
    
    expect(invoke).toHaveBeenCalledWith('download_and_install_update');
  });

  it('shows downloading state with progress', async () => {
    let progressCallback: ((event: { payload: object }) => void) | null = null;
    
    vi.mocked(listen).mockImplementation(async (event, callback) => {
      if (event === 'update:progress') {
        progressCallback = callback as (event: { payload: object }) => void;
      }
      return () => {};
    });
    
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockUpdateInfo)
      .mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Update Now'));
    
    await waitFor(() => {
      expect(screen.getByText('Downloading Update...')).toBeInTheDocument();
    });
  });

  it('shows error state on update failure', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockUpdateInfo)
      .mockRejectedValueOnce(new Error('Download failed'));
    
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Update Now'));
    
    await waitFor(() => {
      expect(screen.getByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Download failed')).toBeInTheDocument();
    });
  });

  it('allows retry after error', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockUpdateInfo)
      .mockRejectedValueOnce(new Error('Download failed'));
    
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Update Now'));
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Retry'));
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
  });

  it('respects autoCheck=false prop', async () => {
    render(UpdateManager, { props: { autoCheck: false } });
    
    // Wait a bit and verify invoke was not called
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(invoke).not.toHaveBeenCalledWith('check_for_updates');
  });

  it('positions at top by default', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    const { container } = render(UpdateManager);
    
    await waitFor(() => {
      const manager = container.querySelector('.update-manager');
      expect(manager).toHaveClass('position-top');
    });
  });

  it('positions at bottom when prop is set', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    const { container } = render(UpdateManager, { props: { position: 'bottom' } });
    
    await waitFor(() => {
      const manager = container.querySelector('.update-manager');
      expect(manager).toHaveClass('position-bottom');
    });
  });

  it('applies correct state classes', async () => {
    vi.mocked(invoke).mockResolvedValue(mockUpdateInfo);
    const { container } = render(UpdateManager);
    
    await waitFor(() => {
      const manager = container.querySelector('.update-manager');
      expect(manager).toHaveClass('state-available');
    });
  });

  it('formats bytes correctly', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockUpdateInfo)
      .mockImplementation(() => new Promise(() => {}));
    
    render(UpdateManager);
    
    await waitFor(() => {
      expect(screen.getByText('Update Now')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('Update Now'));
    
    // Should show 0 B initially
    await waitFor(() => {
      expect(screen.getByText(/0 B/)).toBeInTheDocument();
    });
  });

  it('handles event listeners for update:available', async () => {
    let availableCallback: ((event: { payload: object }) => void) | null = null;
    
    vi.mocked(listen).mockImplementation(async (event, callback) => {
      if (event === 'update:available') {
        availableCallback = callback as (event: { payload: object }) => void;
      }
      return () => {};
    });
    
    vi.mocked(invoke).mockResolvedValue(null);
    
    render(UpdateManager);
    
    // Simulate receiving update:available event
    if (availableCallback) {
      availableCallback({ payload: mockUpdateInfo });
    }
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
  });

  it('handles event listeners for update:installing', async () => {
    let installingCallback: ((event: { payload: object }) => void) | null = null;
    let availableCallback: ((event: { payload: object }) => void) | null = null;
    
    vi.mocked(listen).mockImplementation(async (event, callback) => {
      if (event === 'update:installing') {
        installingCallback = callback as (event: { payload: object }) => void;
      }
      if (event === 'update:available') {
        availableCallback = callback as (event: { payload: object }) => void;
      }
      return () => {};
    });
    
    vi.mocked(invoke).mockResolvedValue(null);
    
    render(UpdateManager);
    
    // First trigger available
    if (availableCallback) {
      availableCallback({ payload: mockUpdateInfo });
    }
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
    
    // Then trigger installing
    if (installingCallback) {
      installingCallback({ payload: {} });
    }
    
    await waitFor(() => {
      expect(screen.getByText('Installing Update...')).toBeInTheDocument();
      expect(screen.getByText('The app will restart automatically')).toBeInTheDocument();
    });
  });
});
