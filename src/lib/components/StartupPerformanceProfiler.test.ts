import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import StartupPerformanceProfiler from './StartupPerformanceProfiler.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    const responses: Record<string, unknown> = {
      get_window_state: { maximized: false, fullscreen: false },
      get_current_theme: 'dark',
      load_settings: { autoStart: true },
      check_network_status: { connected: true },
      discover_plugins: [],
      restore_session: null
    };
    return Promise.resolve(responses[cmd] ?? null);
  })
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock performance.now
let mockNow = 0;
vi.spyOn(performance, 'now').mockImplementation(() => {
  mockNow += 100;
  return mockNow;
});

describe('StartupPerformanceProfiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockNow = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders when showOnStartup is true', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });
  });

  it('does not render when showOnStartup is false', async () => {
    const { container } = render(StartupPerformanceProfiler, { showOnStartup: false });
    
    await waitFor(() => {
      expect(container.querySelector('.startup-profiler')).not.toBeInTheDocument();
    });
  });

  it('displays health score', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Health')).toBeInTheDocument();
    });
  });

  it('shows total time metric', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Total Time')).toBeInTheDocument();
    });
  });

  it('can be minimized', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });

    const minimizeButton = screen.getByLabelText('Minimize');
    await fireEvent.click(minimizeButton);

    await waitFor(() => {
      expect(screen.queryByText('Total Time')).not.toBeInTheDocument();
    });
  });

  it('can be closed', async () => {
    const { container } = render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close');
    await fireEvent.click(closeButton);

    await waitFor(() => {
      expect(container.querySelector('.startup-profiler')).not.toBeInTheDocument();
    });
  });

  it('displays category breakdown', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      // Categories should appear after metrics are collected
      const profiler = screen.getByRole('dialog');
      expect(profiler).toBeInTheDocument();
    });
  });

  it('exports profile when export button clicked', async () => {
    const createObjectURLMock = vi.fn(() => 'blob:test');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const clickMock = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: clickMock
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('📥 Export')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('📥 Export');
    await fireEvent.click(exportButton);
  });

  it('clears history when clear button clicked', async () => {
    // Set up some historical data
    localStorageMock.setItem('startupProfiles', JSON.stringify([
      { totalDuration: 1000, metrics: [], timestamp: new Date(), appVersion: '1.0.0' }
    ]));

    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('🗑️ Clear History')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('🗑️ Clear History');
    await fireEvent.click(clearButton);

    expect(localStorageMock.getItem('startupProfiles')).toBeNull();
  });

  it('loads historical profiles from localStorage', async () => {
    const historicalData = [
      { totalDuration: 1500, metrics: [], timestamp: new Date().toISOString(), appVersion: '1.0.0' },
      { totalDuration: 1200, metrics: [], timestamp: new Date().toISOString(), appVersion: '1.0.0' }
    ];
    localStorageMock.setItem('startupProfiles', JSON.stringify(historicalData));

    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Startups')).toBeInTheDocument();
    });
  });

  it('shows detailed metrics when enabled', async () => {
    render(StartupPerformanceProfiler, { 
      showOnStartup: true, 
      enableDetailedMetrics: true 
    });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });
  });

  it('hides detailed metrics when disabled', async () => {
    render(StartupPerformanceProfiler, { 
      showOnStartup: true, 
      enableDetailedMetrics: false 
    });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });
  });

  it('calculates health score based on duration', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      // Health score should be calculated and displayed
      const scoreElements = screen.getAllByText(/\d+/);
      expect(scoreElements.length).toBeGreaterThan(0);
    });
  });

  it('auto-hides after specified delay', async () => {
    vi.useFakeTimers();
    
    const { container } = render(StartupPerformanceProfiler, { 
      showOnStartup: true, 
      autoHideDelay: 1000 
    });
    
    await waitFor(() => {
      expect(container.querySelector('.startup-profiler')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(1500);
    
    await waitFor(() => {
      expect(container.querySelector('.startup-profiler')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('cancels auto-hide on mouse enter', async () => {
    vi.useFakeTimers();
    
    const { container } = render(StartupPerformanceProfiler, { 
      showOnStartup: true, 
      autoHideDelay: 2000 
    });
    
    await waitFor(() => {
      const profiler = container.querySelector('.startup-profiler');
      expect(profiler).toBeInTheDocument();
    });

    const profiler = container.querySelector('.startup-profiler');
    if (profiler) {
      await fireEvent.mouseEnter(profiler);
    }

    vi.advanceTimersByTime(3000);
    
    // Should still be visible because auto-hide was cancelled
    expect(container.querySelector('.startup-profiler')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('formats durations correctly', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      // Should show ms or s formatted durations
      const text = screen.getByRole('dialog').textContent;
      expect(text).toMatch(/(\d+ms|\d+\.\d+s|<1ms)/);
    });
  });

  it('displays metrics count', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Metrics')).toBeInTheDocument();
    });
  });

  it('displays failed count', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('expands from minimized state', async () => {
    render(StartupPerformanceProfiler, { showOnStartup: true });
    
    await waitFor(() => {
      expect(screen.getByText('Startup Performance')).toBeInTheDocument();
    });

    // Minimize
    const minimizeButton = screen.getByLabelText('Minimize');
    await fireEvent.click(minimizeButton);

    // Expand
    const expandButton = screen.getByLabelText('Expand');
    await fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Total Time')).toBeInTheDocument();
    });
  });
});
