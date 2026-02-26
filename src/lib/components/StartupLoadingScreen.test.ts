import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import StartupLoadingScreen from './StartupLoadingScreen.svelte';

describe('StartupLoadingScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default message', async () => {
    render(StartupLoadingScreen);
    
    // Wait for content to appear (staggered animation)
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText(/Initializing/)).toBeInTheDocument();
    });
  });

  it('displays custom message', async () => {
    render(StartupLoadingScreen, {
      props: { message: 'Loading modules...' }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText(/Loading modules/)).toBeInTheDocument();
    });
  });

  it('shows app name', async () => {
    render(StartupLoadingScreen);
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hearth' })).toBeInTheDocument();
    });
  });

  it('displays version when provided', async () => {
    render(StartupLoadingScreen, {
      props: { version: '1.2.3' }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });
  });

  it('shows progress bar when showProgress is true', async () => {
    const { container } = render(StartupLoadingScreen, {
      props: { 
        showProgress: true,
        progress: 50
      }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      const progressBar = container.querySelector('.progress-bar-fill');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  it('shows spinner when showProgress is false', async () => {
    const { container } = render(StartupLoadingScreen, {
      props: { showProgress: false }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  it('progresses through stages based on progress value', async () => {
    const stages = [
      'Stage 1',
      'Stage 2',
      'Stage 3',
      'Stage 4'
    ];
    
    const { rerender } = render(StartupLoadingScreen, {
      props: {
        showProgress: true,
        progress: 0,
        stages
      }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText(/Stage 1/)).toBeInTheDocument();
    });
    
    // Progress to 50% should show Stage 3
    await rerender({
      showProgress: true,
      progress: 50,
      stages
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Stage 3/)).toBeInTheDocument();
    });
  });

  it('displays progress percentage when showing progress', async () => {
    render(StartupLoadingScreen, {
      props: {
        showProgress: true,
        progress: 75
      }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  it('calls onComplete callback when complete', async () => {
    const onComplete = vi.fn();
    
    render(StartupLoadingScreen, {
      props: {
        complete: true,
        onComplete
      }
    });
    
    vi.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('adds complete class when loading is done', async () => {
    const { container } = render(StartupLoadingScreen, {
      props: { complete: true }
    });
    
    vi.advanceTimersByTime(100);
    
    await waitFor(() => {
      expect(container.querySelector('.startup-screen.complete')).toBeInTheDocument();
    });
  });

  it('animates dots in status message', async () => {
    render(StartupLoadingScreen, {
      props: { message: 'Loading' }
    });
    
    vi.advanceTimersByTime(500);
    
    const getMessage = () => screen.getByText(/Loading/).textContent;
    
    await waitFor(() => {
      expect(getMessage()).toMatch(/Loading\.{0,3}$/);
    });
    
    // Advance to see dots animate
    vi.advanceTimersByTime(400);
    const afterOneDot = getMessage();
    
    vi.advanceTimersByTime(400);
    const afterTwoDots = getMessage();
    
    // Dots should be changing
    expect(afterOneDot?.length !== afterTwoDots?.length || 
           afterOneDot !== afterTwoDots).toBe(true);
  });

  it('renders logo SVG', async () => {
    const { container } = render(StartupLoadingScreen);
    
    vi.advanceTimersByTime(200);
    
    await waitFor(() => {
      expect(container.querySelector('.logo svg')).toBeInTheDocument();
    });
  });

  it('applies custom stages', async () => {
    const customStages = [
      'Custom step 1',
      'Custom step 2'
    ];
    
    render(StartupLoadingScreen, {
      props: {
        showProgress: true,
        progress: 0,
        stages: customStages
      }
    });
    
    vi.advanceTimersByTime(500);
    
    await waitFor(() => {
      expect(screen.getByText(/Custom step 1/)).toBeInTheDocument();
    });
  });

  it('has proper z-index for overlay', async () => {
    const { container } = render(StartupLoadingScreen);
    
    const screen = container.querySelector('.startup-screen');
    expect(screen).toHaveStyle({ zIndex: '9999' });
  });
});
