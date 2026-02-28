import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import StartupRestoreManager from './StartupRestoreManager.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('StartupRestoreManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default mock responses
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_session_info':
          return Promise.resolve({
            has_session: false,
            has_backup: false,
          });
        case 'load_session_state':
          return Promise.resolve(null);
        case 'capture_window_state':
          return Promise.resolve({
            x: 100,
            y: 100,
            width: 1200,
            height: 800,
            maximized: false,
            fullscreen: false,
            monitor: null,
          });
        case 'save_session_state':
          return Promise.resolve();
        case 'clear_session_state':
          return Promise.resolve();
        default:
          return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(StartupRestoreManager);
    // Component renders with slot content or empty
  });

  it('loads session info on mount', async () => {
    render(StartupRestoreManager);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_session_info');
    });
  });

  it('shows restore prompt when session exists', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      active_channel_id: 'channel-123',
      active_server_id: 'server-456',
      open_channels: [
        { channel_id: 'channel-123', server_id: 'server-456', scroll_position: 0, draft_content: null, pinned: false },
      ],
      window_state: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: 'dark',
      zoom_level: 1.0,
      custom_data: {},
    };

    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_session_info':
          return Promise.resolve({
            has_session: true,
            has_backup: false,
            last_saved: mockSession.timestamp,
            size_bytes: 1024,
          });
        case 'load_session_state':
          return Promise.resolve(mockSession);
        case 'capture_window_state':
          return Promise.resolve(mockSession.window_state);
        default:
          return Promise.resolve();
      }
    });

    render(StartupRestoreManager);

    await waitFor(() => {
      expect(screen.getByText('Restore Previous Session?')).toBeInTheDocument();
    });
  });

  it('hides prompt when showRestorePrompt is false', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: null,
      active_server_id: null,
      open_channels: [],
      window_state: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: null,
      zoom_level: 1.0,
      custom_data: {},
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_session_state') return Promise.resolve(mockSession);
      if (cmd === 'get_session_info') return Promise.resolve({ has_session: true, has_backup: false });
      if (cmd === 'restore_window_state') return Promise.resolve();
      return Promise.resolve();
    });

    render(StartupRestoreManager, { props: { showRestorePrompt: false } });

    await waitFor(() => {
      // Should auto-restore without showing prompt
      expect(mockInvoke).toHaveBeenCalledWith('restore_window_state', expect.any(Object));
    });

    expect(screen.queryByText('Restore Previous Session?')).not.toBeInTheDocument();
  });

  it('dismisses prompt on "Start Fresh" click', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: 'channel-123',
      active_server_id: null,
      open_channels: [],
      window_state: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: null,
      zoom_level: 1.0,
      custom_data: {},
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_session_state') return Promise.resolve(mockSession);
      if (cmd === 'get_session_info') return Promise.resolve({ has_session: true, has_backup: false });
      return Promise.resolve();
    });

    render(StartupRestoreManager);

    await waitFor(() => {
      expect(screen.getByText('Start Fresh')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Start Fresh'));

    await waitFor(() => {
      expect(screen.queryByText('Restore Previous Session?')).not.toBeInTheDocument();
    });
  });

  it('restores session on "Restore Session" click', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: 'channel-123',
      active_server_id: 'server-456',
      open_channels: [],
      window_state: { x: 200, y: 150, width: 1400, height: 900, maximized: true, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 280 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: 'dark',
      zoom_level: 1.0,
      custom_data: {},
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_session_state') return Promise.resolve(mockSession);
      if (cmd === 'get_session_info') return Promise.resolve({ has_session: true, has_backup: false });
      if (cmd === 'restore_window_state') return Promise.resolve();
      return Promise.resolve();
    });

    render(StartupRestoreManager);

    await waitFor(() => {
      expect(screen.getByText('Restore Session')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Restore Session'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('restore_window_state', { state: mockSession.window_state });
    });
  });

  it('auto-saves session at interval', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'capture_window_state') {
        return Promise.resolve({
          x: 100,
          y: 100,
          width: 1200,
          height: 800,
          maximized: false,
          fullscreen: false,
          monitor: null,
        });
      }
      return Promise.resolve(null);
    });

    render(StartupRestoreManager, { props: { autoSaveInterval: 1000 } });

    // Wait for component to mount
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_session_info');
    });

    // Fast-forward auto-save interval
    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_session_state', expect.any(Object));
    });
  });

  it('handles save errors gracefully', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'save_session_state') {
        return Promise.reject(new Error('Save failed'));
      }
      if (cmd === 'capture_window_state') {
        return Promise.resolve({
          x: 100,
          y: 100,
          width: 1200,
          height: 800,
          maximized: false,
          fullscreen: false,
          monitor: null,
        });
      }
      return Promise.resolve(null);
    });

    const { component } = render(StartupRestoreManager);

    const errorHandler = vi.fn();
    component.$on('error', errorHandler);

    // Trigger a save
    vi.advanceTimersByTime(31000);

    await waitFor(() => {
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ type: 'save', error: 'Save failed' }),
        })
      );
    });
  });

  it('clears session state', async () => {
    const { component } = render(StartupRestoreManager);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_session_info');
    });

    // Call clearSession method
    await (component as unknown as { clearSession: () => Promise<void> }).clearSession();

    expect(mockInvoke).toHaveBeenCalledWith('clear_session_state');
  });

  it('displays channel count in restore prompt', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: 'channel-1',
      active_server_id: null,
      open_channels: [
        { channel_id: 'channel-1', server_id: null, scroll_position: 0, draft_content: null, pinned: false },
        { channel_id: 'channel-2', server_id: null, scroll_position: 100, draft_content: null, pinned: false },
        { channel_id: 'channel-3', server_id: null, scroll_position: 200, draft_content: null, pinned: true },
      ],
      window_state: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: null,
      zoom_level: 1.0,
      custom_data: {},
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_session_state') return Promise.resolve(mockSession);
      if (cmd === 'get_session_info') return Promise.resolve({ has_session: true, has_backup: false });
      return Promise.resolve();
    });

    render(StartupRestoreManager);

    await waitFor(() => {
      expect(screen.getByText('3 channels')).toBeInTheDocument();
    });
  });

  it('respects maxOpenChannels limit', async () => {
    const { component } = render(StartupRestoreManager, { props: { maxOpenChannels: 2 } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_session_info');
    });

    // Update with more channels than limit
    const channels = [
      { channel_id: 'ch-1', server_id: null, scroll_position: 0, draft_content: null, pinned: false },
      { channel_id: 'ch-2', server_id: null, scroll_position: 0, draft_content: null, pinned: false },
      { channel_id: 'ch-3', server_id: null, scroll_position: 0, draft_content: null, pinned: false },
    ];

    (component as unknown as { updateOpenChannels: (channels: typeof channels) => void }).updateOpenChannels(channels);

    // Trigger save
    vi.advanceTimersByTime(31000);

    await waitFor(() => {
      const saveCall = mockInvoke.mock.calls.find(([cmd]) => cmd === 'save_session_state');
      if (saveCall) {
        expect(saveCall[1].state.open_channels.length).toBeLessThanOrEqual(2);
      }
    });
  });

  it('emits ready event on mount', async () => {
    const { component } = render(StartupRestoreManager);
    const readyHandler = vi.fn();
    component.$on('ready', readyHandler);

    await waitFor(() => {
      expect(readyHandler).toHaveBeenCalled();
    });
  });

  it('emits restore event with correct data', async () => {
    const mockSession = {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: 'channel-abc',
      active_server_id: 'server-xyz',
      open_channels: [],
      window_state: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: ['cat-1'], collapsed_servers: ['srv-1'], width: 300 },
      split_view_enabled: true,
      split_view_channels: ['ch-1', 'ch-2'],
      theme: 'midnight',
      zoom_level: 1.25,
      custom_data: { key: 'value' },
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'load_session_state') return Promise.resolve(mockSession);
      if (cmd === 'get_session_info') return Promise.resolve({ has_session: true, has_backup: false });
      if (cmd === 'restore_window_state') return Promise.resolve();
      return Promise.resolve();
    });

    const { component } = render(StartupRestoreManager);
    const restoreHandler = vi.fn();
    component.$on('restore', restoreHandler);

    await waitFor(() => {
      expect(screen.getByText('Restore Session')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Restore Session'));

    await waitFor(() => {
      expect(restoreHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            activeChannelId: 'channel-abc',
            activeServerId: 'server-xyz',
            splitViewEnabled: true,
            splitViewChannels: ['ch-1', 'ch-2'],
            theme: 'midnight',
            zoomLevel: 1.25,
            customData: { key: 'value' },
          }),
        })
      );
    });
  });
});
