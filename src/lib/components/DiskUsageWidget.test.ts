import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DiskUsageWidget from './DiskUsageWidget.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

const mockDiskData = [
  {
    name: 'System',
    mountPoint: '/',
    totalSpace: 500 * 1024 * 1024 * 1024,
    freeSpace: 150 * 1024 * 1024 * 1024,
    usedSpace: 350 * 1024 * 1024 * 1024,
    usedPercent: 70,
    fileSystem: 'APFS'
  },
  {
    name: 'Data',
    mountPoint: '/data',
    totalSpace: 1024 * 1024 * 1024 * 1024,
    freeSpace: 100 * 1024 * 1024 * 1024,
    usedSpace: 924 * 1024 * 1024 * 1024,
    usedPercent: 90.2,
    fileSystem: 'ext4'
  }
];

describe('DiskUsageWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(mockDiskData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    render(DiskUsageWidget);
    expect(screen.getByText(/loading disk information/i)).toBeInTheDocument();
  });

  it('displays disk usage after loading', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Data')).toBeInTheDocument();
    });
  });

  it('shows correct usage percentages', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      expect(screen.getByText('70.0%')).toBeInTheDocument();
      expect(screen.getByText('90.2%')).toBeInTheDocument();
    });
  });

  it('displays warning for disks above threshold', async () => {
    render(DiskUsageWidget, { props: { warningThreshold: 80 } });
    
    await waitFor(() => {
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });
  });

  it('shows file system when showFileSystem is true', async () => {
    render(DiskUsageWidget, { props: { showFileSystem: true } });
    
    await waitFor(() => {
      expect(screen.getByText('APFS')).toBeInTheDocument();
      expect(screen.getByText('ext4')).toBeInTheDocument();
    });
  });

  it('hides detailed info in compact mode', async () => {
    render(DiskUsageWidget, { props: { compact: true } });
    
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
    
    // In compact mode, the detailed byte info should not be shown
    expect(screen.queryByText(/free$/)).not.toBeInTheDocument();
  });

  it('refreshes data on button click', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
    
    const refreshButton = screen.getByLabelText('Refresh disk usage');
    await fireEvent.click(refreshButton);
    
    // Should call invoke again
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('displays total and free space summary', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      expect(screen.getByText(/Total:/)).toBeInTheDocument();
      expect(screen.getByText(/Free:/)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (invoke as any).mockRejectedValue(new Error('API not available'));
    
    render(DiskUsageWidget);
    
    // Should fall back to mock data
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('uses correct progress bar colors based on usage', async () => {
    const criticalDisk = [{
      name: 'Critical',
      mountPoint: '/critical',
      totalSpace: 100 * 1024 * 1024 * 1024,
      freeSpace: 5 * 1024 * 1024 * 1024,
      usedSpace: 95 * 1024 * 1024 * 1024,
      usedPercent: 95,
      fileSystem: 'ext4'
    }];
    
    (invoke as any).mockResolvedValue(criticalDisk);
    
    render(DiskUsageWidget, { props: { criticalThreshold: 90 } });
    
    await waitFor(() => {
      expect(screen.getByText('95.0%')).toBeInTheDocument();
    });
    
    // Check for critical warning
    expect(screen.getByText(/critical: consider freeing up space/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
    
    const region = screen.getByRole('region', { name: /disk usage monitor/i });
    expect(region).toBeInTheDocument();
    
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
    progressBars.forEach(bar => {
      expect(bar).toHaveAttribute('aria-valuenow');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('formats bytes correctly', async () => {
    render(DiskUsageWidget);
    
    await waitFor(() => {
      // Check for GB formatting
      expect(screen.getByText(/GB/)).toBeInTheDocument();
    });
  });
});
