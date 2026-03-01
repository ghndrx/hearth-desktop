import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DesktopIntegrationDiagnostics from './DesktopIntegrationDiagnostics.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

const mockReport = {
  timestamp: '2026-03-01T12:00:00Z',
  platform: 'linux',
  app_version: '0.1.0',
  results: [
    {
      name: 'Operating System',
      category: 'System',
      status: 'pass',
      message: 'Ubuntu 24.04',
      details: 'Architecture: x86_64',
      latency_ms: 5,
    },
    {
      name: 'Memory',
      category: 'System',
      status: 'pass',
      message: '8.0 GB available of 16.0 GB total (50% used)',
      latency_ms: 3,
    },
    {
      name: 'Disk Space',
      category: 'System',
      status: 'warn',
      message: '3.5 GB available of 100 GB total',
      fix_suggestion: 'Consider freeing up some disk space',
      latency_ms: 10,
    },
    {
      name: 'Notifications',
      category: 'Features',
      status: 'pass',
      message: 'Available via tauri-plugin-notification',
      latency_ms: 1,
    },
    {
      name: 'Network',
      category: 'Connectivity',
      status: 'fail',
      message: 'Limited: Connection timeout',
      fix_suggestion: 'Check your internet connection',
      latency_ms: 3000,
    },
  ],
  summary: {
    total: 5,
    passed: 3,
    warnings: 1,
    failed: 1,
    skipped: 0,
    overall_health: 'degraded',
  },
};

describe('DesktopIntegrationDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(mockReport);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render when isOpen is true', () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: false },
    });

    expect(screen.getByText('Desktop Integration Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Check the health of native desktop features')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: false },
    });

    expect(screen.queryByText('Desktop Integration Diagnostics')).not.toBeInTheDocument();
  });

  it('should auto-run diagnostics on open when autoRunOnOpen is true', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('run_diagnostics');
    });
  });

  it('should display diagnostic results after running', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Operating System')).toBeInTheDocument();
      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(screen.getByText('Disk Space')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Network')).toBeInTheDocument();
    });
  });

  it('should display summary information', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('degraded')).toBeInTheDocument();
      expect(screen.getByText('✓ 3')).toBeInTheDocument();
      expect(screen.getByText('⚠ 1')).toBeInTheDocument();
      expect(screen.getByText('✗ 1')).toBeInTheDocument();
    });
  });

  it('should filter results by category', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    // Click on System category filter
    const systemButton = screen.getByRole('button', { name: /System/ });
    await fireEvent.click(systemButton);

    // Should show only System category items
    expect(screen.getByText('Operating System')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Disk Space')).toBeInTheDocument();
  });

  it('should show details when clicking on a result', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Operating System')).toBeInTheDocument();
    });

    // Click on the Operating System result
    const osResult = screen.getByText('Operating System');
    await fireEvent.click(osResult.closest('button')!);

    // Should show details
    await waitFor(() => {
      expect(screen.getByText('Architecture: x86_64')).toBeInTheDocument();
    });
  });

  it('should show fix suggestion for warnings/failures', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Disk Space')).toBeInTheDocument();
    });

    // Click on the Disk Space result (which has a warning)
    const diskResult = screen.getByText('Disk Space');
    await fireEvent.click(diskResult.closest('button')!);

    // Should show fix suggestion
    await waitFor(() => {
      expect(screen.getByText('Consider freeing up some disk space')).toBeInTheDocument();
    });
  });

  it('should call run_single_diagnostic when re-running a check', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Operating System')).toBeInTheDocument();
    });

    // Click to expand the OS result
    const osResult = screen.getByText('Operating System');
    await fireEvent.click(osResult.closest('button')!);

    // Find and click the re-run button
    await waitFor(() => {
      const rerunButton = screen.getByRole('button', { name: /Re-run/ });
      expect(rerunButton).toBeInTheDocument();
    });
  });

  it('should run all diagnostics when clicking Run All button', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: false },
    });

    const runAllButton = screen.getByRole('button', { name: /Run All/ });
    await fireEvent.click(runAllButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('run_diagnostics');
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: false, onClose },
    });

    const closeButton = screen.getByRole('button', { name: 'Close diagnostics' });
    await fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when pressing Escape', async () => {
    const onClose = vi.fn();
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: false, onClose },
    });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('should handle export report', async () => {
    (save as any).mockResolvedValue('/tmp/report.json');

    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('💾 Export')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('💾 Export');
    await fireEvent.click(exportButton);

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith('export_diagnostic_report', expect.any(Object));
    });
  });

  it('should display loading state', async () => {
    (invoke as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Running diagnostics...')).toBeInTheDocument();
    });
  });

  it('should display error state', async () => {
    (invoke as any).mockRejectedValue(new Error('Diagnostic failed'));

    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Error running diagnostics')).toBeInTheDocument();
      expect(screen.getByText('Diagnostic failed')).toBeInTheDocument();
    });
  });

  it('should display empty state when no diagnostics run', () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: false },
    });

    expect(screen.getByText('No diagnostics run yet')).toBeInTheDocument();
    expect(screen.getByText('Click "Run All" to check your desktop integration health')).toBeInTheDocument();
  });

  it('should display latency for each check', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('5ms')).toBeInTheDocument();
      expect(screen.getByText('3ms')).toBeInTheDocument();
      expect(screen.getByText('10ms')).toBeInTheDocument();
    });
  });

  it('should show version and platform in summary', async () => {
    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
      expect(screen.getByText(/linux/)).toBeInTheDocument();
    });
  });

  it('should copy report to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(DesktopIntegrationDiagnostics, {
      props: { isOpen: true, autoRunOnOpen: true },
    });

    await waitFor(() => {
      expect(screen.getByText('📋 Copy')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('📋 Copy');
    await fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalled();
  });
});
