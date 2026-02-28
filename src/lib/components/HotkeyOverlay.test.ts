import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import HotkeyOverlay from './HotkeyOverlay.svelte';

describe('HotkeyOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not be visible initially', () => {
    render(HotkeyOverlay);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show overlay after holding Control key', async () => {
    render(HotkeyOverlay);

    // Press Control
    fireEvent.keyDown(window, { key: 'Control' });
    
    // Should not be visible immediately
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Advance past hold duration
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should hide overlay when Control is released', async () => {
    render(HotkeyOverlay);

    // Press and hold Control
    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Release Control
    fireEvent.keyUp(window, { key: 'Control' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not show if Control released before hold duration', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(200); // Less than 500ms default
    fireEvent.keyUp(window, { key: 'Control' });
    vi.advanceTimersByTime(400);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close on Escape key', async () => {
    render(HotkeyOverlay);

    // Show overlay
    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should display all hotkey categories by default', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check for category titles
    expect(screen.getByText(/Navigation/i)).toBeInTheDocument();
    expect(screen.getByText(/Messaging/i)).toBeInTheDocument();
    expect(screen.getByText(/Media & Voice/i)).toBeInTheDocument();
    expect(screen.getByText(/General/i)).toBeInTheDocument();
  });

  it('should filter hotkeys by category when tab clicked', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click Navigation tab
    const navTab = screen.getByRole('tab', { name: /Navigation/i });
    await fireEvent.click(navTab);

    // Should show navigation hotkeys
    expect(screen.getByText('Quick Switcher')).toBeInTheDocument();
    
    // Should not show messaging-only hotkeys (when filtered)
    // Note: Since 'Edit Last Message' is only in messaging, it shouldn't appear
  });

  it('should respect enabled prop', async () => {
    render(HotkeyOverlay, { props: { enabled: false } });

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should use custom trigger key', async () => {
    render(HotkeyOverlay, { props: { triggerKey: 'Alt' } });

    // Control should not work
    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Alt should work
    fireEvent.keyDown(window, { key: 'Alt' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should use custom hold duration', async () => {
    render(HotkeyOverlay, { props: { holdDuration: 1000 } });

    fireEvent.keyDown(window, { key: 'Control' });
    
    // Should not show after 500ms
    vi.advanceTimersByTime(500);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Should show after 1000ms
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should display keyboard shortcuts with modifiers', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check that hotkeys with modifiers are displayed
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('Quick Switcher')).toBeInTheDocument();
  });

  it('should have accessible dialog role', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Keyboard shortcuts');
    });
  });

  it('should have proper tab roles for category filters', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
    
    // All tab should be selected by default
    const allTab = screen.getByRole('tab', { name: 'All' });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should clean up event listeners on destroy', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const { unmount } = render(HotkeyOverlay);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });

  it('should clear hold timer on destroy', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    const { unmount } = render(HotkeyOverlay);
    
    // Start holding
    fireEvent.keyDown(window, { key: 'Control' });
    
    // Unmount before timer completes
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('should show release hint in header', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText(/Release Control to close/i)).toBeInTheDocument();
    });
  });

  it('should show footer tip', async () => {
    render(HotkeyOverlay);

    fireEvent.keyDown(window, { key: 'Control' });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText(/Tip:/i)).toBeInTheDocument();
    });
  });
});
