import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import QuickActionsWheel from './QuickActionsWheel.svelte';

describe('QuickActionsWheel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const defaultActions = [
    { id: 'action1', label: 'Action 1', icon: '📝', shortcut: 'A' },
    { id: 'action2', label: 'Action 2', icon: '🔍', shortcut: 'B' },
    { id: 'action3', label: 'Action 3', icon: '⚙️', shortcut: 'C' },
  ];

  it('renders nothing when closed', () => {
    const { container } = render(QuickActionsWheel, {
      props: { isOpen: false, actions: defaultActions },
    });

    expect(container.querySelector('.quick-actions-wheel-backdrop')).toBeNull();
  });

  it('renders wheel when open', () => {
    render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4); // 3 actions + center
  });

  it('renders action items with icons', () => {
    render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    expect(screen.getByLabelText('Action 1 (A)')).toBeInTheDocument();
    expect(screen.getByLabelText('Action 2 (B)')).toBeInTheDocument();
    expect(screen.getByLabelText('Action 3 (C)')).toBeInTheDocument();
  });

  it('dispatches action event on item click', async () => {
    const mockHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    component.$on('action', mockHandler);

    const actionButton = screen.getByLabelText('Action 1 (A)');
    await fireEvent.click(actionButton);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { id: 'action1', action: defaultActions[0] },
      })
    );
  });

  it('closes on backdrop click', async () => {
    const mockCloseHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    component.$on('close', mockCloseHandler);

    const backdrop = screen.getByRole('dialog');
    await fireEvent.click(backdrop);

    vi.advanceTimersByTime(300);
    expect(mockCloseHandler).toHaveBeenCalled();
  });

  it('navigates with arrow keys', async () => {
    render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    const firstItem = screen.getByLabelText('Action 1 (A)');
    expect(firstItem.classList.contains('hovered')).toBe(true);

    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    const secondItem = screen.getByLabelText('Action 2 (B)');
    expect(secondItem.classList.contains('hovered')).toBe(true);
  });

  it('closes on Escape key', async () => {
    const mockCloseHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    component.$on('close', mockCloseHandler);

    await fireEvent.keyDown(window, { key: 'Escape' });

    vi.advanceTimersByTime(300);
    expect(mockCloseHandler).toHaveBeenCalled();
  });

  it('triggers action with shortcut key', async () => {
    const mockHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    component.$on('action', mockHandler);

    await fireEvent.keyDown(window, { key: 'B' });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { id: 'action2', action: defaultActions[1] },
      })
    );
  });

  it('respects disabled state on actions', async () => {
    const disabledActions = [
      { id: 'action1', label: 'Action 1', icon: '📝', disabled: true },
    ];

    render(QuickActionsWheel, {
      props: { isOpen: true, actions: disabledActions, position: { x: 200, y: 200 } },
    });

    const disabledButton = screen.getByLabelText('Action 1');
    expect(disabledButton).toBeDisabled();
  });

  it('renders center action when provided', () => {
    const centerAction = { id: 'center', label: 'Center', icon: '🎯' };

    render(QuickActionsWheel, {
      props: {
        isOpen: true,
        actions: defaultActions,
        centerAction,
        position: { x: 200, y: 200 },
      },
    });

    expect(screen.getByLabelText('Center')).toBeInTheDocument();
  });

  it('triggers center action on click', async () => {
    const centerAction = { id: 'center', label: 'Center', icon: '🎯' };
    const mockHandler = vi.fn();

    const { component } = render(QuickActionsWheel, {
      props: {
        isOpen: true,
        actions: defaultActions,
        centerAction,
        position: { x: 200, y: 200 },
      },
    });

    component.$on('action', mockHandler);

    const centerButton = screen.getByLabelText('Center');
    await fireEvent.click(centerButton);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { id: 'center', action: centerAction },
      })
    );
  });

  it('positions wheel at specified coordinates', () => {
    render(QuickActionsWheel, {
      props: {
        isOpen: true,
        actions: defaultActions,
        position: { x: 300, y: 400 },
      },
    });

    const wheel = document.querySelector('.quick-actions-wheel') as HTMLElement;
    expect(wheel.style.left).toBe('300px');
    expect(wheel.style.top).toBe('400px');
  });

  it('handles custom radius', () => {
    const { container } = render(QuickActionsWheel, {
      props: {
        isOpen: true,
        actions: defaultActions,
        position: { x: 200, y: 200 },
        radius: 200,
      },
    });

    // Wheel ring should have the custom radius
    const ring = container.querySelector('.wheel-ring');
    expect(ring?.getAttribute('r')).toBe('200');
  });

  it('dispatches open event when opening', async () => {
    const mockOpenHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: false, actions: defaultActions },
    });

    component.$on('open', mockOpenHandler);

    // Trigger the hotkey
    await fireEvent.keyDown(window, { key: ' ', altKey: true });

    expect(mockOpenHandler).toHaveBeenCalled();
  });

  it('toggles with custom hotkey', async () => {
    const mockOpenHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: {
        isOpen: false,
        actions: defaultActions,
        hotkey: 'Ctrl+K',
      },
    });

    component.$on('open', mockOpenHandler);

    // Default hotkey shouldn't work
    await fireEvent.keyDown(window, { key: ' ', altKey: true });
    expect(mockOpenHandler).not.toHaveBeenCalled();

    // Custom hotkey should work
    await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(mockOpenHandler).toHaveBeenCalled();
  });

  it('selects item with Enter key after navigation', async () => {
    const mockHandler = vi.fn();
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    component.$on('action', mockHandler);

    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    await fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockHandler).toHaveBeenCalled();
  });

  it('wraps navigation at boundaries', async () => {
    render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    // Navigate to first item
    await fireEvent.keyDown(window, { key: 'ArrowRight' });

    // Navigate backwards (should wrap to last)
    await fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await fireEvent.keyDown(window, { key: 'ArrowLeft' });

    const lastItem = screen.getByLabelText('Action 3 (C)');
    expect(lastItem.classList.contains('hovered')).toBe(true);
  });

  it('applies custom item colors', () => {
    const coloredActions = [
      { id: 'action1', label: 'Action 1', icon: '📝', color: '#ff0000' },
    ];

    const { container } = render(QuickActionsWheel, {
      props: { isOpen: true, actions: coloredActions, position: { x: 200, y: 200 } },
    });

    const item = container.querySelector('.wheel-item') as HTMLElement;
    expect(item.style.getPropertyValue('--item-color')).toBe('#ff0000');
  });

  it('shows tooltip on hover', async () => {
    render(QuickActionsWheel, {
      props: { isOpen: true, actions: defaultActions, position: { x: 200, y: 200 } },
    });

    const actionButton = screen.getByLabelText('Action 1 (A)');
    await fireEvent.mouseEnter(actionButton);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Press A')).toBeInTheDocument();
  });

  it('handles actions without shortcuts', () => {
    const noShortcutActions = [
      { id: 'action1', label: 'No Shortcut', icon: '📝' },
    ];

    render(QuickActionsWheel, {
      props: { isOpen: true, actions: noShortcutActions, position: { x: 200, y: 200 } },
    });

    expect(screen.getByLabelText('No Shortcut')).toBeInTheDocument();
    expect(screen.queryByText('Press')).toBeNull();
  });

  it('exposes open/close/toggle methods', async () => {
    const { component } = render(QuickActionsWheel, {
      props: { isOpen: false, actions: defaultActions },
    });

    // Open
    (component as any).open();
    vi.advanceTimersByTime(300);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close
    (component as any).close();
    vi.advanceTimersByTime(300);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Toggle open
    (component as any).toggle();
    vi.advanceTimersByTime(300);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Toggle closed
    (component as any).toggle();
    vi.advanceTimersByTime(300);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
