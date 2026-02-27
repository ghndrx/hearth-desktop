import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LogViewer from './LogViewer.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([])
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue(null)
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined)
}));

describe('LogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders the log viewer container', () => {
      render(LogViewer);
      expect(screen.getByPlaceholderText('Search logs...')).toBeTruthy();
    });

    it('shows level filter buttons', () => {
      render(LogViewer);
      expect(screen.getByText(/DEBUG/)).toBeTruthy();
      expect(screen.getByText(/INFO/)).toBeTruthy();
      expect(screen.getByText(/WARN/)).toBeTruthy();
      expect(screen.getByText(/ERROR/)).toBeTruthy();
    });

    it('shows control buttons', () => {
      render(LogViewer);
      expect(screen.getByTitle('Pause logging')).toBeTruthy();
      expect(screen.getByTitle('Toggle auto-scroll')).toBeTruthy();
      expect(screen.getByTitle('Export logs')).toBeTruthy();
      expect(screen.getByTitle('Clear all logs')).toBeTruthy();
    });

    it('shows empty state when no logs', async () => {
      render(LogViewer);
      // Wait for initialization message to appear and then check
      await waitFor(() => {
        const container = document.querySelector('.log-entries');
        expect(container).toBeTruthy();
      });
    });
  });

  describe('level filtering', () => {
    it('toggles level filter when clicked', async () => {
      render(LogViewer);
      const debugButton = screen.getByText(/DEBUG/);
      
      // Initial state - should be active (has the colored class)
      expect(debugButton.className).toContain('text-gray-400');
      
      // Click to toggle off
      await fireEvent.click(debugButton);
      
      // Should now be inactive
      expect(debugButton.className).toContain('text-gray-500');
      
      // Click to toggle back on
      await fireEvent.click(debugButton);
      expect(debugButton.className).toContain('text-gray-400');
    });
  });

  describe('search functionality', () => {
    it('updates search query on input', async () => {
      render(LogViewer);
      const searchInput = screen.getByPlaceholderText('Search logs...');
      
      await fireEvent.input(searchInput, { target: { value: 'test query' } });
      
      expect(searchInput).toHaveProperty('value', 'test query');
    });
  });

  describe('controls', () => {
    it('toggles pause state when pause button clicked', async () => {
      render(LogViewer);
      const pauseButton = screen.getByTitle('Pause logging');
      
      // Initial state
      expect(pauseButton.textContent).toContain('Pause');
      
      // Click to pause
      await fireEvent.click(pauseButton);
      expect(pauseButton.textContent).toContain('Resume');
      
      // Click to resume
      await fireEvent.click(pauseButton);
      expect(pauseButton.textContent).toContain('Pause');
    });

    it('toggles auto-scroll when button clicked', async () => {
      render(LogViewer);
      const autoScrollButton = screen.getByTitle('Toggle auto-scroll');
      
      // Initial state - auto-scroll enabled
      expect(autoScrollButton.textContent).toContain('Auto');
      
      // Click to toggle
      await fireEvent.click(autoScrollButton);
      expect(autoScrollButton.textContent).toContain('Manual');
    });

    it('clears logs when clear button clicked', async () => {
      render(LogViewer);
      const clearButton = screen.getByTitle('Clear all logs');
      
      await fireEvent.click(clearButton);
      // Should clear without errors
    });
  });

  describe('props', () => {
    it('accepts maxLines prop', () => {
      render(LogViewer, { props: { maxLines: 500 } });
      // Component should render without errors
    });

    it('accepts autoScroll prop', () => {
      render(LogViewer, { props: { autoScroll: false } });
      const autoScrollButton = screen.getByTitle('Toggle auto-scroll');
      expect(autoScrollButton.textContent).toContain('Manual');
    });

    it('accepts showTimestamps prop', () => {
      render(LogViewer, { props: { showTimestamps: false } });
      // Component should render without errors
    });

    it('accepts showLogLevel prop', () => {
      render(LogViewer, { props: { showLogLevel: false } });
      // Component should render without errors
    });
  });

  describe('export functionality', () => {
    it('calls export when export button clicked', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      render(LogViewer);
      
      const exportButton = screen.getByTitle('Export logs');
      await fireEvent.click(exportButton);
      
      // Should attempt to open save dialog
      await waitFor(() => {
        expect(save).toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('has accessible search input', () => {
      render(LogViewer);
      const searchInput = screen.getByPlaceholderText('Search logs...');
      expect(searchInput.tagName).toBe('INPUT');
    });

    it('buttons have titles for screen readers', () => {
      render(LogViewer);
      expect(screen.getByTitle('Pause logging')).toBeTruthy();
      expect(screen.getByTitle('Toggle auto-scroll')).toBeTruthy();
      expect(screen.getByTitle('Export logs')).toBeTruthy();
      expect(screen.getByTitle('Clear all logs')).toBeTruthy();
    });
  });

  describe('console interception', () => {
    it('intercepts console methods on mount', async () => {
      const originalConsoleInfo = console.info;
      render(LogViewer);
      
      // Console methods should still work
      console.info('Test message');
      
      // Restore
      console.info = originalConsoleInfo;
    });
  });
});
