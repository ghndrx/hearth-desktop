/**
 * SystemMonitorWidget.test.ts
 * 
 * Tests for the SystemMonitorWidget component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import SystemMonitorWidget from './SystemMonitorWidget.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string) => mockInvoke(cmd),
}));

// Mock system data
const mockCpuInfo = {
  name: 'Intel Core i7-9700K',
  physicalCores: 8,
  logicalCores: 8,
  frequencyMhz: 3600,
  usagePercent: 45.5,
};

const mockMemoryInfo = {
  totalBytes: 17179869184, // 16 GB
  usedBytes: 8589934592, // 8 GB
  availableBytes: 8589934592, // 8 GB
  usagePercent: 50.0,
  swapTotalBytes: 4294967296, // 4 GB
  swapUsedBytes: 1073741824, // 1 GB
};

const mockOsInfo = {
  name: 'Ubuntu',
  version: '22.04',
  kernelVersion: '5.15.0',
  hostname: 'test-host',
  arch: 'x86_64',
  uptimeSeconds: 86400, // 1 day
};

describe('SystemMonitorWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_cpu_info':
          return Promise.resolve(mockCpuInfo);
        case 'get_memory_info':
          return Promise.resolve(mockMemoryInfo);
        case 'get_os_info':
          return Promise.resolve(mockOsInfo);
        default:
          return Promise.reject(new Error(`Unknown command: ${cmd}`));
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    render(SystemMonitorWidget);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches and displays system info', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_cpu_info');
      expect(mockInvoke).toHaveBeenCalledWith('get_memory_info');
      expect(mockInvoke).toHaveBeenCalledWith('get_os_info');
    });
  });

  it('displays CPU usage in compact mode', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => {
      const cpuValue = screen.getByTitle(/CPU Usage/);
      expect(cpuValue).toBeInTheDocument();
    });
  });

  it('displays memory usage in compact mode', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => {
      const memValue = screen.getByTitle(/Memory Usage/);
      expect(memValue).toBeInTheDocument();
    });
  });

  it('displays uptime in compact mode', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => {
      const uptimeValue = screen.getByTitle(/System Uptime/);
      expect(uptimeValue).toBeInTheDocument();
    });
  });

  it('toggles between compact and expanded view on click', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    const widget = screen.getByRole('region', { name: 'System Monitor' });
    await fireEvent.click(widget);
    
    await waitFor(() => {
      expect(screen.getByText('System Monitor')).toBeInTheDocument();
    });
  });

  it('shows detailed CPU info in expanded view', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    const widget = screen.getByRole('region', { name: 'System Monitor' });
    await fireEvent.click(widget);
    
    await waitFor(() => {
      expect(screen.getByText(/Intel Core i7-9700K/)).toBeInTheDocument();
      expect(screen.getByText(/8 cores @ 3600 MHz/)).toBeInTheDocument();
    });
  });

  it('shows detailed memory info in expanded view', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    const widget = screen.getByRole('region', { name: 'System Monitor' });
    await fireEvent.click(widget);
    
    await waitFor(() => {
      expect(screen.getByText(/8\.0 GB \/ 16\.0 GB/)).toBeInTheDocument();
    });
  });

  it('shows system info in expanded view', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    const widget = screen.getByRole('region', { name: 'System Monitor' });
    await fireEvent.click(widget);
    
    await waitFor(() => {
      expect(screen.getByText(/Ubuntu 22.04/)).toBeInTheDocument();
      expect(screen.getByText(/Host: test-host/)).toBeInTheDocument();
    });
  });

  it('respects showCpu prop', async () => {
    render(SystemMonitorWidget, { props: { showCpu: false } });
    
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalledWith('get_cpu_info');
    });
  });

  it('respects showMemory prop', async () => {
    render(SystemMonitorWidget, { props: { showMemory: false } });
    
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalledWith('get_memory_info');
    });
  });

  it('respects showUptime prop', async () => {
    render(SystemMonitorWidget, { props: { showUptime: false } });
    
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalledWith('get_os_info');
    });
  });

  it('refreshes data at specified interval', async () => {
    render(SystemMonitorWidget, { props: { refreshIntervalMs: 1000 } });
    
    await vi.runOnlyPendingTimersAsync();
    
    const initialCallCount = mockInvoke.mock.calls.length;
    
    await vi.advanceTimersByTimeAsync(1000);
    
    expect(mockInvoke.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('handles fetch errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to fetch'));
    
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
    });
  });

  it('toggles on Enter key press', async () => {
    render(SystemMonitorWidget);
    
    await vi.runOnlyPendingTimersAsync();
    
    const widget = screen.getByRole('region', { name: 'System Monitor' });
    await fireEvent.keyPress(widget, { key: 'Enter' });
    
    await waitFor(() => {
      expect(screen.getByText('System Monitor')).toBeInTheDocument();
    });
  });

  it('applies correct color for low usage', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_cpu_info') {
        return Promise.resolve({ ...mockCpuInfo, usagePercent: 25 });
      }
      if (cmd === 'get_memory_info') {
        return Promise.resolve({ ...mockMemoryInfo, usagePercent: 30 });
      }
      return Promise.resolve(mockOsInfo);
    });
    
    render(SystemMonitorWidget);
    await vi.runOnlyPendingTimersAsync();
    
    // Low usage should show green bars (class 'low')
    await waitFor(() => {
      const bars = document.querySelectorAll('.mini-bar-fill.low');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  it('applies correct color for high usage', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_cpu_info') {
        return Promise.resolve({ ...mockCpuInfo, usagePercent: 85 });
      }
      if (cmd === 'get_memory_info') {
        return Promise.resolve({ ...mockMemoryInfo, usagePercent: 90 });
      }
      return Promise.resolve(mockOsInfo);
    });
    
    render(SystemMonitorWidget);
    await vi.runOnlyPendingTimersAsync();
    
    // High usage should show red bars (class 'high')
    await waitFor(() => {
      const bars = document.querySelectorAll('.mini-bar-fill.high');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  it('formats uptime correctly for days', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_os_info') {
        return Promise.resolve({ ...mockOsInfo, uptimeSeconds: 172800 }); // 2 days
      }
      return Promise.resolve(cmd === 'get_cpu_info' ? mockCpuInfo : mockMemoryInfo);
    });
    
    render(SystemMonitorWidget);
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(screen.getByText('2d 0h')).toBeInTheDocument();
    });
  });

  it('formats uptime correctly for hours', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_os_info') {
        return Promise.resolve({ ...mockOsInfo, uptimeSeconds: 7200 }); // 2 hours
      }
      return Promise.resolve(cmd === 'get_cpu_info' ? mockCpuInfo : mockMemoryInfo);
    });
    
    render(SystemMonitorWidget);
    await vi.runOnlyPendingTimersAsync();
    
    await waitFor(() => {
      expect(screen.getByText('2h 0m')).toBeInTheDocument();
    });
  });

  it('cleans up interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    const { unmount } = render(SystemMonitorWidget);
    await vi.runOnlyPendingTimersAsync();
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
