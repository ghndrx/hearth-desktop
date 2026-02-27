import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import SystemUsageMonitor from './SystemUsageMonitor.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    switch (cmd) {
      case 'get_system_stats':
        return Promise.resolve({
          cpuUsage: 25.5,
          memoryUsed: 8 * 1024 * 1024 * 1024,
          memoryTotal: 16 * 1024 * 1024 * 1024,
          memoryPercent: 50,
          diskUsed: 256 * 1024 * 1024 * 1024,
          diskTotal: 512 * 1024 * 1024 * 1024,
          diskPercent: 50,
          uptime: 86400
        });
      default:
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
    }
  })
}));

describe('SystemUsageMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(SystemUsageMonitor);
    expect(screen.getByText('Loading system info...')).toBeInTheDocument();
  });

  it('displays CPU stats when showCpu is true', async () => {
    render(SystemUsageMonitor, { props: { showCpu: true, showMemory: false } });
    
    await waitFor(() => {
      expect(screen.getByText('CPU')).toBeInTheDocument();
    });
  });

  it('displays memory stats when showMemory is true', async () => {
    render(SystemUsageMonitor, { props: { showCpu: false, showMemory: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Memory')).toBeInTheDocument();
    });
  });

  it('displays disk stats when showDisk is true', async () => {
    render(SystemUsageMonitor, { props: { showCpu: false, showMemory: false, showDisk: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Disk')).toBeInTheDocument();
    });
  });

  it('displays uptime when showUptime is true', async () => {
    render(SystemUsageMonitor, { props: { showCpu: false, showMemory: false, showUptime: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Uptime')).toBeInTheDocument();
    });
  });

  it('applies compact class when compact prop is true', async () => {
    const { container } = render(SystemUsageMonitor, { props: { compact: true } });
    
    await waitFor(() => {
      const monitor = container.querySelector('.system-usage-monitor');
      expect(monitor).toHaveClass('compact');
    });
  });
});
