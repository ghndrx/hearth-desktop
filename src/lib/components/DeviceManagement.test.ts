import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DeviceManagement from './DeviceManagement.svelte';

// Mock the api module
vi.mock('$lib/api', () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  }
}));

import { api } from '$lib/api';

describe('DeviceManagement', () => {
  const mockSessions = [
    {
      id: 'session-1',
      device_name: 'Chrome on Windows',
      device_type: 'desktop',
      browser: 'Chrome',
      browser_version: '120.0.0.0',
      os: 'Windows',
      os_version: '10',
      location_city: 'San Francisco',
      location_country: 'US',
      is_current: true,
      last_used: new Date().toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'session-2',
      device_name: 'Safari on iOS',
      device_type: 'mobile',
      browser: 'Safari',
      browser_version: '17.0',
      os: 'iOS',
      os_version: '17.1',
      location_city: 'New York',
      location_country: 'US',
      is_current: false,
      last_used: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    // Mock a slow API response
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    render(DeviceManagement);

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  it('renders session list after loading', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    });

    expect(screen.getByText('Safari on iOS')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows device icons based on device type', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    });

    // Should have desktop and mobile icons
    const icons = screen.getAllByRole('img', { hidden: true });
    expect(icons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Log Out All Other Devices" button when multiple sessions exist', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Log Out All Other Devices')).toBeInTheDocument();
    });
  });

  it('does not show "Log Out" button on current session', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    });

    // The "Log Out" buttons should only be for non-current sessions
    const logoutButtons = screen.getAllByText('Log Out');
    expect(logoutButtons.length).toBe(1); // Only one for the non-current session
  });

  it('revokes a session when Log Out is clicked', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });
    vi.mocked(api.delete).mockResolvedValue(undefined);

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Safari on iOS')).toBeInTheDocument();
    });

    const logoutButton = screen.getByText('Log Out');
    await fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/auth/sessions/session-2');
    });

    // Session should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Safari on iOS')).not.toBeInTheDocument();
    });
  });

  it('revokes all sessions when confirmed', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Log Out All Other Devices')).toBeInTheDocument();
    });

    const revokeAllButton = screen.getByText('Log Out All Other Devices');
    await fireEvent.click(revokeAllButton);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/auth/sessions');
    });
  });

  it('does not revoke all sessions when cancelled', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Log Out All Other Devices')).toBeInTheDocument();
    });

    const revokeAllButton = screen.getByText('Log Out All Other Devices');
    await fireEvent.click(revokeAllButton);

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('shows error message on API failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Failed to load active sessions')).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retries loading when retry button is clicked', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Failed to load active sessions')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    await fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    });
  });

  it('formats last used time correctly', async () => {
    const recentSession = {
      ...mockSessions[0],
      last_used: new Date().toISOString(), // Just now
    };
    vi.mocked(api.get).mockResolvedValue({ sessions: [recentSession] });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText(/Just now/i)).toBeInTheDocument();
    });
  });

  it('shows security tips section', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: mockSessions });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('Security Tips')).toBeInTheDocument();
    });

    expect(screen.getByText(/Enable Two-Factor Authentication/i)).toBeInTheDocument();
  });

  it('handles empty session list', async () => {
    vi.mocked(api.get).mockResolvedValue({ sessions: [] });

    render(DeviceManagement);

    await waitFor(() => {
      expect(screen.getByText('No active sessions found')).toBeInTheDocument();
    });
  });
});
