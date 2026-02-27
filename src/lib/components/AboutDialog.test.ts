import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AboutDialog from './AboutDialog.svelte';

// Mock Tauri APIs
const mockTauri = {
  app: {
    getName: vi.fn().mockResolvedValue('Hearth Desktop'),
    getVersion: vi.fn().mockResolvedValue('1.2.3'),
    getTauriVersion: vi.fn().mockResolvedValue('2.0.0'),
  },
  os: {
    type: vi.fn().mockResolvedValue('Darwin'),
    version: vi.fn().mockResolvedValue('14.0.0'),
    arch: vi.fn().mockResolvedValue('aarch64'),
  },
  shell: {
    open: vi.fn().mockResolvedValue(undefined),
  },
};

describe('AboutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__TAURI__ = mockTauri;
  });

  afterEach(() => {
    delete (globalThis as any).__TAURI__;
  });

  it('renders nothing when closed', () => {
    const { container } = render(AboutDialog, { isOpen: false });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when open', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('displays app name and version', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Hearth Desktop')).toBeInTheDocument();
      expect(screen.getByText('Version 1.2.3')).toBeInTheDocument();
    });
  });

  it('displays system information', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('v2.0.0')).toBeInTheDocument();
      expect(screen.getByText('macOS 14.0.0')).toBeInTheDocument();
      expect(screen.getByText('aarch64')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching info', () => {
    // Delay the mock responses
    mockTauri.app.getName.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('Hearth Desktop'), 100))
    );

    render(AboutDialog, { isOpen: true });
    
    // Should show skeleton loading
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('closes on Escape key', async () => {
    const { component } = render(AboutDialog, { isOpen: true });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);

    await fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(closeHandler).toHaveBeenCalled();
  });

  it('closes on backdrop click', async () => {
    const { component } = render(AboutDialog, { isOpen: true });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const backdrop = screen.getByRole('dialog').parentElement;
    if (backdrop) {
      await fireEvent.click(backdrop);
      expect(closeHandler).toHaveBeenCalled();
    }
  });

  it('closes on close button click', async () => {
    const { component } = render(AboutDialog, { isOpen: true });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close about dialog');
    await fireEvent.click(closeButton);
    
    expect(closeHandler).toHaveBeenCalled();
  });

  it('displays built with credits', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Built with Tauri')).toBeInTheDocument();
      expect(screen.getByText('Powered by Svelte')).toBeInTheDocument();
      expect(screen.getByText('UI by TailwindCSS')).toBeInTheDocument();
    });
  });

  it('opens external links via Tauri shell', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Built with Tauri')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Built with Tauri'));
    
    expect(mockTauri.shell.open).toHaveBeenCalledWith('https://tauri.app');
  });

  it('displays social links', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
      expect(screen.getByLabelText('Discord')).toBeInTheDocument();
      expect(screen.getByLabelText('Documentation')).toBeInTheDocument();
    });
  });

  it('opens social links on click', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByLabelText('GitHub'));
    
    expect(mockTauri.shell.open).toHaveBeenCalledWith('https://github.com/clawdbot/hearth');
  });

  it('copies system info to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Copy'));
    
    expect(writeText).toHaveBeenCalled();
    const clipboardContent = writeText.mock.calls[0][0];
    expect(clipboardContent).toContain('Hearth Desktop v1.2.3');
    expect(clipboardContent).toContain('Tauri v2.0.0');
  });

  it('shows copy feedback after copying', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Copy'));
    
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('formats OS names correctly', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      // Darwin should be formatted as macOS
      expect(screen.getByText('macOS 14.0.0')).toBeInTheDocument();
    });
  });

  it('handles Windows OS name formatting', async () => {
    mockTauri.os.type.mockResolvedValue('Windows_NT');
    mockTauri.os.version.mockResolvedValue('10.0.19045');
    
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Windows 10.0.19045')).toBeInTheDocument();
    });
  });

  it('handles Linux OS name formatting', async () => {
    mockTauri.os.type.mockResolvedValue('Linux');
    mockTauri.os.version.mockResolvedValue('6.5.0');
    
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Linux 6.5.0')).toBeInTheDocument();
    });
  });

  it('displays current year in copyright', async () => {
    render(AboutDialog, { isOpen: true });
    
    const currentYear = new Date().getFullYear();
    
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`© ${currentYear}`))).toBeInTheDocument();
    });
  });

  it('handles missing Tauri API gracefully', async () => {
    delete (globalThis as any).__TAURI__;
    
    render(AboutDialog, { isOpen: true });
    
    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('falls back to window.open when Tauri shell is unavailable', async () => {
    delete (globalThis as any).__TAURI__;
    
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Built with Tauri')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Built with Tauri'));
    
    expect(windowOpen).toHaveBeenCalledWith('https://tauri.app', '_blank');
    
    windowOpen.mockRestore();
  });

  it('handles clipboard copy failure gracefully', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Copy'));
    
    await waitFor(() => {
      expect(screen.getByText('Failed to copy')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('has proper ARIA attributes', async () => {
    render(AboutDialog, { isOpen: true });
    
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'about-dialog-title');
    });
  });
});
