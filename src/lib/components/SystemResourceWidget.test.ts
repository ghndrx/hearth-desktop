import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import SystemResourceWidget from './SystemResourceWidget.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    cpu_usage: 45.2,
    memory_percent: 62.5,
    memory_used: 8589934592,
    memory_total: 17179869184,
    disk_percent: 55.0,
    disk_available: 107374182400,
    disk_total: 214748364800,
    system_uptime: 86400
  })
}));

// Mock the store
vi.mock('$lib/stores/systemResources', () => {
  const mockResources = {
    cpuPercent: 45.2,
    memoryPercent: 62.5,
    memoryUsedGB: 8,
    memoryTotalGB: 16,
    diskPercent: 55.0,
    diskUsedGB: 100,
    diskTotalGB: 200,
    uptimeSeconds: 86400
  };

  return {
    systemResources: {
      resources: {
        subscribe: (cb: (val: any) => void) => {
          cb(mockResources);
          return () => {};
        }
      },
      init: vi.fn(),
      cleanup: vi.fn(),
      refresh: vi.fn().mockResolvedValue(undefined)
    }
  };
});

describe('SystemResourceWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the panel header', () => {
    render(SystemResourceWidget);
    expect(screen.getByText('System Resources')).toBeInTheDocument();
  });

  it('initializes the store on mount', async () => {
    const { systemResources } = await import('$lib/stores/systemResources');
    render(SystemResourceWidget);
    expect(systemResources.init).toHaveBeenCalled();
  });

  it('cleans up the store on destroy', async () => {
    const { systemResources } = await import('$lib/stores/systemResources');
    const { unmount } = render(SystemResourceWidget);
    unmount();
    expect(systemResources.cleanup).toHaveBeenCalled();
  });

  it('displays CPU percentage', () => {
    render(SystemResourceWidget);
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();
  });

  it('displays RAM percentage and details', () => {
    render(SystemResourceWidget);
    expect(screen.getByText('RAM')).toBeInTheDocument();
    expect(screen.getByText('62.5%')).toBeInTheDocument();
    expect(screen.getByText('8 / 16 GB')).toBeInTheDocument();
  });

  it('displays Disk percentage and details', () => {
    render(SystemResourceWidget);
    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('100 / 200 GB')).toBeInTheDocument();
  });

  it('displays uptime', () => {
    render(SystemResourceWidget);
    expect(screen.getByText('Uptime:')).toBeInTheDocument();
    expect(screen.getByText('1d 0h 0m')).toBeInTheDocument();
  });

  it('has a refresh button', () => {
    render(SystemResourceWidget);
    const refreshBtn = screen.getByTitle('Refresh');
    expect(refreshBtn).toBeInTheDocument();
  });

  it('calls refresh when refresh button is clicked', async () => {
    const { systemResources } = await import('$lib/stores/systemResources');
    render(SystemResourceWidget);

    const refreshBtn = screen.getByTitle('Refresh');
    await fireEvent.click(refreshBtn);

    expect(systemResources.refresh).toHaveBeenCalled();
  });

  it('renders progress bars for each resource', () => {
    const { container } = render(SystemResourceWidget);
    const progressBars = container.querySelectorAll('.progress-bar');
    expect(progressBars).toHaveLength(3);
  });

  it('applies green color for low usage', () => {
    const { container } = render(SystemResourceWidget);
    const progressBars = container.querySelectorAll('.progress-bar');
    // CPU at 45.2% and Disk at 55% should be green
    const cpuBar = progressBars[0] as HTMLElement;
    expect(cpuBar.style.background).toContain('#57f287');
  });

  it('applies yellow color for medium usage', () => {
    const { container } = render(SystemResourceWidget);
    const progressBars = container.querySelectorAll('.progress-bar');
    // RAM at 62.5% should be yellow
    const ramBar = progressBars[1] as HTMLElement;
    expect(ramBar.style.background).toContain('#fee75c');
  });

  it('renders three resource items', () => {
    const { container } = render(SystemResourceWidget);
    const items = container.querySelectorAll('.resource-item');
    expect(items).toHaveLength(3);
  });

  it('formats uptime with hours only when less than a day', async () => {
    const { systemResources } = await import('$lib/stores/systemResources');
    (systemResources.resources as any).subscribe = (cb: (val: any) => void) => {
      cb({
        cpuPercent: 10,
        memoryPercent: 20,
        memoryUsedGB: 4,
        memoryTotalGB: 16,
        diskPercent: 30,
        diskUsedGB: 50,
        diskTotalGB: 200,
        uptimeSeconds: 7260 // 2h 1m
      });
      return () => {};
    };

    render(SystemResourceWidget);

    await waitFor(() => {
      expect(screen.getByText('2h 1m')).toBeInTheDocument();
    });
  });

  it('formats uptime with minutes only when less than an hour', async () => {
    const { systemResources } = await import('$lib/stores/systemResources');
    (systemResources.resources as any).subscribe = (cb: (val: any) => void) => {
      cb({
        cpuPercent: 10,
        memoryPercent: 20,
        memoryUsedGB: 4,
        memoryTotalGB: 16,
        diskPercent: 30,
        diskUsedGB: 50,
        diskTotalGB: 200,
        uptimeSeconds: 300 // 5m
      });
      return () => {};
    };

    render(SystemResourceWidget);

    await waitFor(() => {
      expect(screen.getByText('5m')).toBeInTheDocument();
    });
  });
});
