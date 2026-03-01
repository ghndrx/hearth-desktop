/**
 * NetworkStatusWidget.test.ts
 * Tests for the NetworkStatusWidget component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NetworkStatusWidget from './NetworkStatusWidget.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';

const mockNetworkStatus = {
  is_online: true,
  network_type: 'wifi',
  interfaces: [
    {
      name: 'wlan0',
      is_up: true,
      ip_addresses: ['192.168.1.100'],
    },
    {
      name: 'eth0',
      is_up: false,
      ip_addresses: [],
    },
  ],
};

const mockLatencyResult = {
  host: 'google.com',
  latency_ms: 45,
  reachable: true,
};

describe('NetworkStatusWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (invoke as any).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_network_status':
          return mockNetworkStatus;
        case 'measure_latency':
          return mockLatencyResult;
        case 'start_network_monitor':
          return null;
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    render(NetworkStatusWidget);
    expect(screen.getByText('Checking network...')).toBeInTheDocument();
  });

  it('renders network status after loading', async () => {
    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_network_status');
    });

    await waitFor(() => {
      expect(screen.getByText('wifi')).toBeInTheDocument();
    });
  });

  it('displays latency when online', async () => {
    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('measure_latency', { host: 'google.com' });
    });

    await waitFor(() => {
      expect(screen.getByText('45ms')).toBeInTheDocument();
    });
  });

  it('shows offline state when not connected', async () => {
    (invoke as any).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_network_status') {
        return { ...mockNetworkStatus, is_online: false };
      }
      return null;
    });

    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('expands on click', async () => {
    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('wifi')).toBeInTheDocument();
    });

    const widget = screen.getByRole('region', { name: 'Network Status' });
    await fireEvent.click(widget);

    await waitFor(() => {
      expect(screen.getByText('Network Status')).toBeInTheDocument();
      expect(screen.getByText('Connection')).toBeInTheDocument();
    });
  });

  it('shows interface list in expanded view', async () => {
    render(NetworkStatusWidget, { props: { compact: false } });

    await waitFor(() => {
      expect(screen.getByText('Interfaces')).toBeInTheDocument();
    });

    // Should show active interface
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
  });

  it('uses custom ping host', async () => {
    render(NetworkStatusWidget, { props: { pingHost: 'cloudflare.com' } });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('measure_latency', { host: 'cloudflare.com' });
    });
  });

  it('respects showPing prop', async () => {
    render(NetworkStatusWidget, { props: { showPing: false } });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_network_status');
    });

    expect(invoke).not.toHaveBeenCalledWith('measure_latency', expect.anything());
  });

  it('displays correct network type icon', async () => {
    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('📶')).toBeInTheDocument();
    });
  });

  it('displays ethernet icon for ethernet connection', async () => {
    (invoke as any).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_network_status') {
        return { ...mockNetworkStatus, network_type: 'ethernet' };
      }
      if (cmd === 'measure_latency') {
        return mockLatencyResult;
      }
      return null;
    });

    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('🔌')).toBeInTheDocument();
    });
  });

  it('handles error state gracefully', async () => {
    (invoke as any).mockRejectedValue(new Error('Network error'));

    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('refreshes data at specified interval', async () => {
    render(NetworkStatusWidget, { props: { refreshIntervalMs: 1000 } });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_network_status');
    });

    // Clear previous calls
    vi.clearAllMocks();

    // Advance time
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_network_status');
    });
  });

  it('shows latency quality indicators', async () => {
    render(NetworkStatusWidget, { props: { compact: false } });

    await waitFor(() => {
      // 45ms should show as "Good" or "Excellent"
      expect(screen.getByText(/Excellent|Good/)).toBeInTheDocument();
    });
  });

  it('handles poor latency indication', async () => {
    (invoke as any).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_network_status') {
        return mockNetworkStatus;
      }
      if (cmd === 'measure_latency') {
        return { ...mockLatencyResult, latency_ms: 300 };
      }
      return null;
    });

    render(NetworkStatusWidget, { props: { compact: false } });

    await waitFor(() => {
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });
  });

  it('is keyboard accessible', async () => {
    render(NetworkStatusWidget);

    await waitFor(() => {
      expect(screen.getByText('wifi')).toBeInTheDocument();
    });

    const widget = screen.getByRole('region', { name: 'Network Status' });
    expect(widget).toHaveAttribute('tabindex', '0');

    // Simulate Enter key press
    await fireEvent.keyPress(widget, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Network Status')).toBeInTheDocument();
    });
  });
});
