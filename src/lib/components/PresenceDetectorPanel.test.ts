import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PresenceDetectorPanel from './PresenceDetectorPanel.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, ...args: any[]) => mockInvoke(cmd, ...args),
}));

// Mock Tauri listen
const mockUnlisten = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(mockUnlisten),
}));

const mockPresenceState = {
  activityState: 'active',
  presenceStatus: 'online',
  idleSeconds: 0,
  windowFocused: true,
  inMeeting: false,
  manualOverride: false,
  idleThreshold: 300,
  awayThreshold: 900,
  detectorActive: true,
  screenLocked: false,
};

describe('PresenceDetectorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'get_presence_state':
          return Promise.resolve({ ...mockPresenceState });
        case 'start_presence_detector':
          return Promise.resolve(null);
        case 'stop_presence_detector':
          return Promise.resolve(null);
        case 'set_manual_status':
          return Promise.resolve({
            ...mockPresenceState,
            presenceStatus: args?.status ?? 'online',
            manualOverride: args?.status != null,
          });
        case 'set_presence_config':
          return Promise.resolve({
            idleThreshold: args?.idleThreshold ?? 300,
            awayThreshold: args?.awayThreshold ?? 900,
          });
        default:
          return Promise.resolve(null);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders with default state', async () => {
    render(PresenceDetectorPanel);
    expect(screen.getByText('Presence Detector')).toBeInTheDocument();
  });

  it('displays online status indicator', async () => {
    render(PresenceDetectorPanel);

    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  it('shows activity and idle time details', async () => {
    render(PresenceDetectorPanel);

    await waitFor(() => {
      expect(screen.getByText('Activity: Active')).toBeInTheDocument();
      expect(screen.getByText('Idle: 0s')).toBeInTheDocument();
    });
  });

  it('shows window focus state', async () => {
    render(PresenceDetectorPanel);

    await waitFor(() => {
      expect(screen.getByText('Window: Focused')).toBeInTheDocument();
    });
  });

  it('renders manual status buttons', async () => {
    render(PresenceDetectorPanel);

    expect(screen.getByText('Online', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText('Idle', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText('DND')).toBeInTheDocument();
    expect(screen.getByText('Invisible')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('calls set_manual_status when status button clicked', async () => {
    render(PresenceDetectorPanel);

    const dndButton = screen.getByText('DND');
    await fireEvent.click(dndButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_manual_status', { status: 'dnd' });
    });
  });

  it('calls set_manual_status with null for Auto button', async () => {
    render(PresenceDetectorPanel);

    const autoButton = screen.getByText('Auto');
    await fireEvent.click(autoButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_manual_status', { status: null });
    });
  });

  it('shows settings panel when settings button clicked', async () => {
    render(PresenceDetectorPanel);

    const settingsButton = screen.getByTitle('Settings');
    await fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Idle threshold (min)')).toBeInTheDocument();
      expect(screen.getByText('Away threshold (min)')).toBeInTheDocument();
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
  });

  it('calls set_presence_config when settings saved', async () => {
    render(PresenceDetectorPanel);

    const settingsButton = screen.getByTitle('Settings');
    await fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Settings');
    await fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_presence_config', {
        idleThreshold: 300,
        awayThreshold: 900,
      });
    });
  });

  it('starts presence detector on mount', async () => {
    render(PresenceDetectorPanel);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('start_presence_detector');
    });
  });
});
