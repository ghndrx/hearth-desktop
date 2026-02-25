import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import OpacityControl from './OpacityControl.svelte';

// Mock tauri
vi.mock('$lib/tauri', () => ({
  setWindowOpacity: vi.fn().mockResolvedValue(undefined),
  getWindowOpacity: vi.fn().mockResolvedValue(1.0),
}));

// Mock settings store
vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => {
      fn({ windowOpacity: 1.0 });
      return () => {};
    }),
    update: vi.fn(),
  },
}));

import { setWindowOpacity, getWindowOpacity } from '$lib/tauri';

describe('OpacityControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders opacity toggle button', async () => {
    render(OpacityControl);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /window opacity/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('displays current opacity percentage', async () => {
    render(OpacityControl);
    
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('loads initial opacity from tauri on mount', async () => {
    (getWindowOpacity as ReturnType<typeof vi.fn>).mockResolvedValue(0.8);
    
    render(OpacityControl);
    
    await waitFor(() => {
      expect(getWindowOpacity).toHaveBeenCalled();
    });
  });

  it('expands panel when toggle is clicked', async () => {
    render(OpacityControl);
    
    await waitFor(() => {
      const toggle = screen.getByRole('button', { name: /window opacity/i });
      fireEvent.click(toggle);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Window Opacity')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });

  it('shows preset buttons when expanded', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '90%' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '80%' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '70%' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '60%' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument();
    });
  });

  it('calls setWindowOpacity when preset is clicked', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      const preset80 = screen.getByRole('button', { name: '80%' });
      fireEvent.click(preset80);
    });
    
    await waitFor(() => {
      expect(setWindowOpacity).toHaveBeenCalledWith(0.8);
    });
  });

  it('updates slider when preset is selected', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      const preset70 = screen.getByRole('button', { name: '70%' });
      fireEvent.click(preset70);
    });
    
    await waitFor(() => {
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('0.7');
    });
  });

  it('marks active preset button', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      // 100% should be active by default
      const preset100 = screen.getByRole('button', { name: '100%' });
      expect(preset100).toHaveClass('active');
    });
  });

  it('shows hint text explaining the feature', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(screen.getByText(/adjust window transparency/i)).toBeInTheDocument();
    });
  });

  it('collapses panel when toggle is clicked again', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    
    // Expand
    await fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
    
    // Collapse
    await fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  it('handles slider input with debounce', async () => {
    vi.useFakeTimers();
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      const slider = screen.getByRole('slider');
      fireEvent.input(slider, { target: { value: '0.75' } });
    });
    
    // Should not immediately call setWindowOpacity
    expect(setWindowOpacity).not.toHaveBeenCalledWith(0.75);
    
    // After debounce
    vi.advanceTimersByTime(100);
    await waitFor(() => {
      expect(setWindowOpacity).toHaveBeenCalledWith(0.75);
    });
    
    vi.useRealTimers();
  });

  it('handles error gracefully when getting opacity fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (getWindowOpacity as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'));
    
    render(OpacityControl);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get window opacity:', expect.any(Error));
    });
    
    // Should default to 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('has proper accessibility attributes', async () => {
    render(OpacityControl);
    
    const toggle = screen.getByRole('button', { name: /window opacity/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    
    await fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Opacity settings');
      expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Opacity slider');
    });
  });
});
