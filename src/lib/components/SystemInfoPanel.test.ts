import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import SystemInfoPanel from './SystemInfoPanel.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, ...args: any[]) => mockInvoke(cmd, ...args),
}));

const mockSystemInfo = {
  os: {
    name: 'Ubuntu',
    version: '22.04',
    kernelVersion: '5.15.0-generic',
    hostname: 'test-host',
    arch: 'x86_64',
    uptimeSeconds: 90061, // 1d 1h 1m
  },
  cpu: {
    name: 'Intel Core i7-10700K',
    physicalCores: 8,
    logicalCores: 16,
    frequencyMhz: 3800,
    usagePercent: 42.5,
  },
  memory: {
    totalBytes: 17179869184, // 16 GB
    usedBytes: 8589934592, // 8 GB
    availableBytes: 8589934592,
    usagePercent: 50.0,
    swapTotalBytes: 4294967296, // 4 GB
    swapUsedBytes: 1073741824, // 1 GB
  },
  runtime: {
    tauriVersion: '2.0.0',
    appVersion: '0.1.0',
    targetTriple: 'x86_64-unknown-linux-gnu',
    buildType: 'release',
  },
};

describe('SystemInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockSystemInfo);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render loading state initially', async () => {
    // Delay the response to see loading state
    mockInvoke.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSystemInfo), 100))
    );

    render(SystemInfoPanel);

    expect(screen.getByText('Loading system information...')).toBeInTheDocument();
  });

  it('should display system information after loading', async () => {
    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('System Information')).toBeInTheDocument();
    });

    // Check OS info
    expect(screen.getByText('Ubuntu 22.04')).toBeInTheDocument();
    expect(screen.getByText('5.15.0-generic')).toBeInTheDocument();
    expect(screen.getByText('test-host')).toBeInTheDocument();
    expect(screen.getByText('x86_64')).toBeInTheDocument();
    expect(screen.getByText('1d 1h 1m')).toBeInTheDocument();

    // Check CPU info
    expect(screen.getByText('Intel Core i7-10700K')).toBeInTheDocument();
    expect(screen.getByText('8 physical / 16 logical')).toBeInTheDocument();
    expect(screen.getByText('3.80 GHz')).toBeInTheDocument();
    expect(screen.getByText('42.5%')).toBeInTheDocument();

    // Check Memory info
    expect(screen.getByText('16.00 GB')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    // Check Runtime info
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
    expect(screen.getByText('release')).toBeInTheDocument();
  });

  it('should call get_system_info on mount', async () => {
    render(SystemInfoPanel);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_system_info');
    });
  });

  it('should refresh data when refresh button is clicked', async () => {
    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('System Information')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Refresh');
    await fireEvent.click(refreshButton);

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('should hide refresh button when showRefreshButton is false', async () => {
    render(SystemInfoPanel, { props: { showRefreshButton: false } });

    await waitFor(() => {
      expect(screen.getByText('System Information')).toBeInTheDocument();
    });

    expect(screen.queryByTitle('Refresh')).not.toBeInTheDocument();
  });

  it('should display error state on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to get system info'));

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load system info/)).toBeInTheDocument();
    });
  });

  it('should format bytes correctly', async () => {
    // Modify memory to test different byte formats
    const modifiedInfo = {
      ...mockSystemInfo,
      memory: {
        ...mockSystemInfo.memory,
        totalBytes: 1099511627776, // 1 TB
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('1.00 TB')).toBeInTheDocument();
    });
  });

  it('should format uptime correctly for short durations', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      os: {
        ...mockSystemInfo.os,
        uptimeSeconds: 3660, // 1h 1m
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('1h 1m')).toBeInTheDocument();
    });
  });

  it('should format frequency in MHz when under 1000', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      cpu: {
        ...mockSystemInfo.cpu,
        frequencyMhz: 800,
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('800 MHz')).toBeInTheDocument();
    });
  });

  it('should apply compact styling when compact prop is true', async () => {
    const { container } = render(SystemInfoPanel, { props: { compact: true } });

    await waitFor(() => {
      expect(screen.getByText('System Information')).toBeInTheDocument();
    });

    const panel = container.querySelector('.system-info-panel');
    expect(panel).toHaveClass('compact');
  });

  it('should show warning color for high memory usage', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      memory: {
        ...mockSystemInfo.memory,
        usagePercent: 75.0,
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    const { container } = render(SystemInfoPanel);

    await waitFor(() => {
      const progressBars = container.querySelectorAll('.progress-bar');
      const memoryBar = Array.from(progressBars).find((bar) =>
        bar.classList.contains('warning')
      );
      expect(memoryBar).toBeTruthy();
    });
  });

  it('should show critical color for very high memory usage', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      memory: {
        ...mockSystemInfo.memory,
        usagePercent: 95.0,
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    const { container } = render(SystemInfoPanel);

    await waitFor(() => {
      const progressBars = container.querySelectorAll('.progress-bar');
      const memoryBar = Array.from(progressBars).find((bar) =>
        bar.classList.contains('critical')
      );
      expect(memoryBar).toBeTruthy();
    });
  });

  it('should show debug badge for debug builds', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      runtime: {
        ...mockSystemInfo.runtime,
        buildType: 'debug',
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.getByText('debug')).toBeInTheDocument();
    });

    const badge = screen.getByText('debug');
    expect(badge).not.toHaveClass('release');
  });

  it('should hide swap info when no swap is configured', async () => {
    const modifiedInfo = {
      ...mockSystemInfo,
      memory: {
        ...mockSystemInfo.memory,
        swapTotalBytes: 0,
        swapUsedBytes: 0,
      },
    };
    mockInvoke.mockResolvedValue(modifiedInfo);

    render(SystemInfoPanel);

    await waitFor(() => {
      expect(screen.queryByText('Swap Total')).not.toBeInTheDocument();
    });
  });

  it('should auto-refresh when autoRefresh is enabled', async () => {
    vi.useFakeTimers();

    render(SystemInfoPanel, {
      props: { autoRefresh: true, autoRefreshInterval: 1000 },
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockInvoke).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});
