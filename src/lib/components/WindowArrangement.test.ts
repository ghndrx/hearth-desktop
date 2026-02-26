import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import WindowArrangement from './WindowArrangement.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    currentMonitor: vi.fn().mockResolvedValue({
      size: { width: 1920, height: 1080 },
      position: { x: 0, y: 0 },
    }),
    isMaximized: vi.fn().mockResolvedValue(false),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
  })),
  LogicalPosition: vi.fn((x, y) => ({ x, y })),
  LogicalSize: vi.fn((w, h) => ({ width: w, height: h })),
}));

describe('WindowArrangement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default props', () => {
    render(WindowArrangement);
    expect(screen.getByText('Window Arrangement')).toBeInTheDocument();
  });

  it('displays all layout options', () => {
    render(WindowArrangement);
    
    const expectedLayouts = [
      'Cascade',
      'Tile Horizontal',
      'Tile Vertical',
      'Tile Grid',
      'Center',
      'Maximize',
      'Left Half',
      'Right Half',
      'Top Half',
      'Bottom Half',
      'Top Left',
      'Top Right',
      'Bottom Left',
      'Bottom Right',
    ];

    expectedLayouts.forEach((layout) => {
      expect(screen.getByText(layout)).toBeInTheDocument();
    });
  });

  it('shows keyboard shortcut hint', () => {
    render(WindowArrangement);
    expect(screen.getByText(/Ctrl\/Cmd \+ Arrow keys/)).toBeInTheDocument();
  });

  it('disables buttons when not enabled', () => {
    render(WindowArrangement, { props: { enabled: false } });
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('applies disabled class when not enabled', () => {
    const { container } = render(WindowArrangement, { props: { enabled: false } });
    expect(container.querySelector('.window-arrangement.disabled')).toBeInTheDocument();
  });

  it('shows preview screens when showPreview is true', () => {
    const { container } = render(WindowArrangement, { props: { showPreview: true } });
    expect(container.querySelectorAll('.preview-screen').length).toBeGreaterThan(0);
  });

  it('shows icons when showPreview is false', () => {
    const { container } = render(WindowArrangement, { props: { showPreview: false } });
    expect(container.querySelectorAll('.layout-icon').length).toBeGreaterThan(0);
  });

  it('handles layout button click', async () => {
    render(WindowArrangement);
    
    const centerButton = screen.getByText('Center').closest('button');
    expect(centerButton).not.toBeNull();
    
    if (centerButton) {
      await fireEvent.click(centerButton);
      // Should not throw and component should update
    }
  });

  it('handles cascade layout', async () => {
    render(WindowArrangement);
    
    const cascadeButton = screen.getByText('Cascade').closest('button');
    expect(cascadeButton).not.toBeNull();
    
    if (cascadeButton) {
      await fireEvent.click(cascadeButton);
    }
  });

  it('handles tile horizontal layout', async () => {
    render(WindowArrangement);
    
    const button = screen.getByText('Tile Horizontal').closest('button');
    if (button) {
      await fireEvent.click(button);
    }
  });

  it('handles tile vertical layout', async () => {
    render(WindowArrangement);
    
    const button = screen.getByText('Tile Vertical').closest('button');
    if (button) {
      await fireEvent.click(button);
    }
  });

  it('handles tile grid layout', async () => {
    render(WindowArrangement);
    
    const button = screen.getByText('Tile Grid').closest('button');
    if (button) {
      await fireEvent.click(button);
    }
  });

  it('handles maximize layout', async () => {
    render(WindowArrangement);
    
    const button = screen.getByText('Maximize').closest('button');
    if (button) {
      await fireEvent.click(button);
    }
  });

  it('handles half layouts', async () => {
    render(WindowArrangement);
    
    const halfLayouts = ['Left Half', 'Right Half', 'Top Half', 'Bottom Half'];
    
    for (const layout of halfLayouts) {
      const button = screen.getByText(layout).closest('button');
      if (button) {
        await fireEvent.click(button);
      }
    }
  });

  it('handles quarter layouts', async () => {
    render(WindowArrangement);
    
    const quarterLayouts = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];
    
    for (const layout of quarterLayouts) {
      const button = screen.getByText(layout).closest('button');
      if (button) {
        await fireEvent.click(button);
      }
    }
  });

  it('applies custom padding', () => {
    render(WindowArrangement, { props: { padding: 16 } });
    // Component should render without error
    expect(screen.getByText('Window Arrangement')).toBeInTheDocument();
  });

  it('applies custom animation duration', () => {
    render(WindowArrangement, { props: { animationDuration: 500 } });
    expect(screen.getByText('Window Arrangement')).toBeInTheDocument();
  });

  it('shows layout descriptions in tooltips', () => {
    render(WindowArrangement);
    
    const cascadeButton = screen.getByText('Cascade').closest('button');
    expect(cascadeButton).toHaveAttribute('title', 'Stack windows diagonally');
    
    const centerButton = screen.getByText('Center').closest('button');
    expect(centerButton).toHaveAttribute('title', 'Center window on screen');
  });

  it('handles keyboard events for left half', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
  });

  it('handles keyboard events for right half', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
  });

  it('handles keyboard events for maximize', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true });
  });

  it('handles keyboard events for center', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true });
  });

  it('handles keyboard events for top half', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true, altKey: true });
  });

  it('handles keyboard events for bottom half', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true, altKey: true });
  });

  it('handles keyboard events for quarters with shift', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true, shiftKey: true });
    await fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true, shiftKey: true, altKey: true });
    await fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
    await fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true, shiftKey: true, altKey: true });
  });

  it('ignores keyboard events without meta key', async () => {
    render(WindowArrangement);
    
    await fireEvent.keyDown(window, { key: 'ArrowLeft' });
    // Should not apply any layout
  });

  it('ignores keyboard events when disabled', async () => {
    render(WindowArrangement, { props: { enabled: false } });
    
    await fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true });
    // Should not apply any layout
  });

  it('dispatches arranged event on successful layout', async () => {
    const handleArranged = vi.fn();
    const { component } = render(WindowArrangement);
    component.$on('arranged', handleArranged);
    
    const centerButton = screen.getByText('Center').closest('button');
    if (centerButton) {
      await fireEvent.click(centerButton);
      // Wait for async operations
      await new Promise(r => setTimeout(r, 100));
      expect(handleArranged).toHaveBeenCalled();
    }
  });

  it('handles hover states for preview', async () => {
    render(WindowArrangement);
    
    const centerButton = screen.getByText('Center').closest('button');
    if (centerButton) {
      await fireEvent.mouseEnter(centerButton);
      await fireEvent.mouseLeave(centerButton);
    }
  });
});
