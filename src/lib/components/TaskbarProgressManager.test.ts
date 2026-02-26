import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import TaskbarProgressManager from './TaskbarProgressManager.svelte';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockUnlisten = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

describe('TaskbarProgressManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default mock implementations
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_taskbar_progress':
          return Promise.resolve({
            active: false,
            progress: 0,
            mode: 'none',
            label: null,
          });
        case 'get_operations':
          return Promise.resolve([]);
        default:
          return Promise.resolve(null);
      }
    });
    
    mockListen.mockImplementation(() => {
      return Promise.resolve(mockUnlisten);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no operations active', async () => {
    const { container } = render(TaskbarProgressManager);
    await tick();
    
    expect(container.querySelector('.taskbar-progress-indicator')).toBeNull();
  });

  it('shows indicator when operations are active', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_taskbar_progress':
          return Promise.resolve({
            active: true,
            progress: 0.5,
            mode: 'normal',
            label: 'Uploading...',
          });
        case 'get_operations':
          return Promise.resolve([
            {
              id: 'op-1',
              label: 'Uploading file.zip',
              total: 100,
              completed: 50,
              started_at: Date.now() - 5000,
            },
          ]);
        default:
          return Promise.resolve(null);
      }
    });

    render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    expect(screen.getByText('1 operation')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Uploading file.zip')).toBeInTheDocument();
  });

  it('shows multiple operations', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'get_taskbar_progress':
          return Promise.resolve({
            active: true,
            progress: 0.35,
            mode: 'normal',
            label: null,
          });
        case 'get_operations':
          return Promise.resolve([
            {
              id: 'op-1',
              label: 'Uploading file1.zip',
              total: 100,
              completed: 50,
              started_at: Date.now() - 10000,
            },
            {
              id: 'op-2',
              label: 'Downloading update',
              total: 200,
              completed: 40,
              started_at: Date.now() - 5000,
            },
          ]);
        default:
          return Promise.resolve(null);
      }
    });

    render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('2 operations')).toBeInTheDocument();
    });

    expect(screen.getByText('Uploading file1.zip')).toBeInTheDocument();
    expect(screen.getByText('Downloading update')).toBeInTheDocument();
  });

  it('hides indicator when showIndicator is false', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          {
            id: 'op-1',
            label: 'Test',
            total: 100,
            completed: 50,
            started_at: Date.now(),
          },
        ]);
      }
      return Promise.resolve({ active: true, progress: 0.5, mode: 'normal', label: null });
    });

    const { container } = render(TaskbarProgressManager, { showIndicator: false });
    await tick();
    
    expect(container.querySelector('.taskbar-progress-indicator')).toBeNull();
  });

  it('positions indicator correctly', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          { id: 'op-1', label: 'Test', total: 100, completed: 50, started_at: Date.now() },
        ]);
      }
      return Promise.resolve({ active: true, progress: 0.5, mode: 'normal', label: null });
    });

    const { container, rerender } = render(TaskbarProgressManager, { position: 'top-left' });
    await tick();
    await waitFor(() => {
      const indicator = container.querySelector('.taskbar-progress-indicator') as HTMLElement;
      expect(indicator?.style.cssText).toContain('top');
      expect(indicator?.style.cssText).toContain('left');
    });
  });

  it('calls setProgress correctly', async () => {
    mockInvoke.mockResolvedValue({
      active: true,
      progress: 0.75,
      mode: 'normal',
      label: 'Processing...',
    });

    const { component } = render(TaskbarProgressManager);
    await tick();

    await component.setProgress(0.75, 'normal', 'Processing...');

    expect(mockInvoke).toHaveBeenCalledWith('set_taskbar_progress', {
      options: {
        progress: 0.75,
        mode: 'normal',
        label: 'Processing...',
      },
    });
  });

  it('calls clearProgress correctly', async () => {
    mockInvoke.mockResolvedValue(undefined);

    const { component } = render(TaskbarProgressManager);
    await tick();

    await component.clearProgress();

    expect(mockInvoke).toHaveBeenCalledWith('clear_taskbar_progress');
  });

  it('calls startOperation correctly', async () => {
    const mockOperation = {
      id: 'test-op',
      label: 'Test Operation',
      total: 100,
      completed: 0,
      started_at: Date.now(),
    };
    
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'start_operation') {
        return Promise.resolve(mockOperation);
      }
      if (cmd === 'get_operations') {
        return Promise.resolve([mockOperation]);
      }
      return Promise.resolve({ active: false, progress: 0, mode: 'none', label: null });
    });

    const { component } = render(TaskbarProgressManager);
    await tick();

    const result = await component.startOperation('test-op', 'Test Operation', 100);

    expect(mockInvoke).toHaveBeenCalledWith('start_operation', {
      id: 'test-op',
      label: 'Test Operation',
      total: 100,
    });
    expect(result).toEqual(mockOperation);
  });

  it('calls updateOperation correctly', async () => {
    const mockOperation = {
      id: 'test-op',
      label: 'Test Operation',
      total: 100,
      completed: 50,
      started_at: Date.now(),
    };
    
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'update_operation') {
        return Promise.resolve(mockOperation);
      }
      if (cmd === 'get_operations') {
        return Promise.resolve([mockOperation]);
      }
      return Promise.resolve({ active: false, progress: 0, mode: 'none', label: null });
    });

    const { component } = render(TaskbarProgressManager);
    await tick();

    await component.updateOperation('test-op', 50);

    expect(mockInvoke).toHaveBeenCalledWith('update_operation', {
      id: 'test-op',
      completed: 50,
    });
  });

  it('calls completeOperation correctly', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'complete_operation') {
        return Promise.resolve(undefined);
      }
      if (cmd === 'get_operations') {
        return Promise.resolve([]);
      }
      return Promise.resolve({ active: false, progress: 0, mode: 'none', label: null });
    });

    const { component } = render(TaskbarProgressManager);
    await tick();

    await component.completeOperation('test-op');

    expect(mockInvoke).toHaveBeenCalledWith('complete_operation', {
      id: 'test-op',
    });
  });

  it('shows progress bar with correct width', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          { id: 'op-1', label: 'Test', total: 100, completed: 75, started_at: Date.now() },
        ]);
      }
      return Promise.resolve({ active: true, progress: 0.75, mode: 'normal', label: null });
    });

    const { container } = render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      const progressBar = container.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar?.style.width).toBe('75%');
    });
  });

  it('applies indeterminate class when mode is indeterminate', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          { id: 'op-1', label: 'Test', total: 100, completed: 0, started_at: Date.now() },
        ]);
      }
      return Promise.resolve({ active: true, progress: 0, mode: 'indeterminate', label: null });
    });

    const { container } = render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar?.classList.contains('indeterminate')).toBe(true);
    });
  });

  it('applies error class when mode is error', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          { id: 'op-1', label: 'Test', total: 100, completed: 50, started_at: Date.now() },
        ]);
      }
      return Promise.resolve({ active: true, progress: 0.5, mode: 'error', label: null });
    });

    const { container } = render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar?.classList.contains('error')).toBe(true);
    });
  });

  it('listens for progress updates', async () => {
    render(TaskbarProgressManager);
    await tick();

    expect(mockListen).toHaveBeenCalledWith(
      'taskbar-progress-update',
      expect.any(Function)
    );
  });

  it('cleans up on destroy', async () => {
    const { unmount } = render(TaskbarProgressManager);
    await tick();

    unmount();

    expect(mockUnlisten).toHaveBeenCalled();
  });

  it('formats elapsed time correctly', async () => {
    const now = Date.now();
    
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_operations') {
        return Promise.resolve([
          { id: 'op-1', label: 'Test', total: 100, completed: 50, started_at: now - 65000 }, // 1m 5s
        ]);
      }
      return Promise.resolve({ active: true, progress: 0.5, mode: 'normal', label: null });
    });

    render(TaskbarProgressManager);
    await tick();
    await waitFor(() => {
      expect(screen.getByText('1m 5s')).toBeInTheDocument();
    });
  });

  it('polls for updates at regular intervals', async () => {
    render(TaskbarProgressManager);
    await tick();

    // Initial calls
    const initialCallCount = mockInvoke.mock.calls.filter(
      (call) => call[0] === 'get_operations'
    ).length;

    // Advance timers
    vi.advanceTimersByTime(4000);
    await tick();

    const laterCallCount = mockInvoke.mock.calls.filter(
      (call) => call[0] === 'get_operations'
    ).length;

    expect(laterCallCount).toBeGreaterThan(initialCallCount);
  });
});
