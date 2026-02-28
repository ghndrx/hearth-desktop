import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/svelte';
import FloatingToolbar from './FloatingToolbar.svelte';

// Mock window.getSelection
const mockSelection = {
  isCollapsed: false,
  toString: vi.fn(() => 'selected text'),
  getRangeAt: vi.fn(() => ({
    startOffset: 0,
    endOffset: 13,
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 120,
      left: 50,
      right: 150,
      width: 100,
      height: 20,
    }),
  })),
};

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve('')),
};

describe('FloatingToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'getSelection', {
      value: () => mockSelection,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });
    mockSelection.toString.mockReturnValue('selected text');
    mockSelection.isCollapsed = false;
    mockClipboard.writeText.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders hidden by default', () => {
      const { container } = render(FloatingToolbar);
      expect(container.querySelector('.floating-toolbar')).toBeNull();
    });

    it('shows toolbar on text selection and mouseup', async () => {
      const { container } = render(FloatingToolbar, {
        props: { showOnSelection: true, enabled: true },
      });

      // Simulate mouseup with selection
      fireEvent.mouseUp(document);
      
      vi.advanceTimersByTime(20);
      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });
    });

    it('does not show when disabled', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: false, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      expect(container.querySelector('.floating-toolbar')).toBeNull();
    });

    it('shows default actions when none provided', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const buttons = container.querySelectorAll('.toolbar-button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('custom actions', () => {
    it('renders custom actions', async () => {
      const customActions = [
        { id: 'custom1', icon: '★', label: 'Star' },
        { id: 'custom2', icon: '♥', label: 'Heart' },
      ];

      const { container } = render(FloatingToolbar, {
        props: { actions: customActions, enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const buttons = container.querySelectorAll('.toolbar-button');
        expect(buttons.length).toBe(2);
      });
    });

    it('groups actions by group property', async () => {
      const groupedActions = [
        { id: 'a1', icon: '1', label: 'One', group: 'numbers' },
        { id: 'a2', icon: '2', label: 'Two', group: 'numbers' },
        { id: 'b1', icon: 'A', label: 'Letter A', group: 'letters' },
      ];

      const { container } = render(FloatingToolbar, {
        props: { actions: groupedActions, enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const groups = container.querySelectorAll('.toolbar-group');
        expect(groups.length).toBe(2);
        const dividers = container.querySelectorAll('.toolbar-divider');
        expect(dividers.length).toBe(1);
      });
    });

    it('handles disabled actions', async () => {
      const actions = [
        { id: 'enabled', icon: '✓', label: 'Enabled' },
        { id: 'disabled', icon: '✗', label: 'Disabled', disabled: true },
      ];

      const { container } = render(FloatingToolbar, {
        props: { actions, enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const buttons = container.querySelectorAll('.toolbar-button');
        expect(buttons[1]).toHaveClass('disabled');
      });
    });
  });

  describe('positioning', () => {
    it('positions above selection when space available', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const toolbar = container.querySelector('.floating-toolbar');
        expect(toolbar).toHaveClass('above');
      });
    });

    it('positions below selection when no space above', async () => {
      // Mock selection near top of viewport
      mockSelection.getRangeAt.mockReturnValue({
        startOffset: 0,
        endOffset: 5,
        getBoundingClientRect: () => ({
          top: 10,
          bottom: 30,
          left: 50,
          right: 150,
          width: 100,
          height: 20,
        }),
      });

      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const toolbar = container.querySelector('.floating-toolbar');
        expect(toolbar).toHaveClass('below');
      });
    });
  });

  describe('interactions', () => {
    it('dispatches action event on button click', async () => {
      const handleAction = vi.fn();
      const actions = [{ id: 'test', icon: 'T', label: 'Test' }];

      const { container, component } = render(FloatingToolbar, {
        props: { actions, enabled: true, showOnSelection: true },
      });

      component.$on('action', handleAction);

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const button = container.querySelector('.toolbar-button');
        expect(button).not.toBeNull();
      });

      const button = container.querySelector('.toolbar-button')!;
      await fireEvent.click(button);

      expect(handleAction).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            actionId: 'test',
            selection: expect.objectContaining({
              text: 'selected text',
            }),
          }),
        })
      );
    });

    it('copies text to clipboard on copy action', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const copyButton = container.querySelector('[title^="Copy"]');
        expect(copyButton).not.toBeNull();
      });

      const copyButton = container.querySelector('[title^="Copy"]')!;
      await fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith('selected text');
    });

    it('hides on Escape key', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });

    it('hides on scroll', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      fireEvent.scroll(document);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });
  });

  describe('auto-hide behavior', () => {
    it('auto-hides after delay', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true, autoHideDelay: 1000 },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });

    it('does not auto-hide when hovering', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true, autoHideDelay: 500 },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      const toolbar = container.querySelector('.floating-toolbar')!;
      fireEvent.mouseEnter(toolbar);

      vi.advanceTimersByTime(1000);

      expect(container.querySelector('.floating-toolbar')).not.toBeNull();
    });

    it('resumes auto-hide timer on mouse leave', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true, autoHideDelay: 500 },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      const toolbar = container.querySelector('.floating-toolbar')!;
      fireEvent.mouseEnter(toolbar);
      vi.advanceTimersByTime(1000);

      fireEvent.mouseLeave(toolbar);
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });
  });

  describe('selection preview', () => {
    it('shows selection text preview', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const preview = container.querySelector('.selection-preview');
        expect(preview).not.toBeNull();
        expect(preview?.textContent).toContain('selected text');
      });
    });

    it('truncates long selection text', async () => {
      const longText = 'a'.repeat(100);
      mockSelection.toString.mockReturnValue(longText);

      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const previewText = container.querySelector('.preview-text');
        expect(previewText?.textContent).toContain('...');
        expect(previewText?.textContent?.length).toBeLessThan(60);
      });
    });

    it('shows character count', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const countBadge = container.querySelector('.preview-count');
        expect(countBadge?.textContent).toContain('13 chars');
      });
    });
  });

  describe('context menu', () => {
    it('shows on right-click with selection', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnRightClick: true },
      });

      const contextEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(contextEvent, 'preventDefault', {
        value: vi.fn(),
      });

      document.body.dispatchEvent(contextEvent);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });
    });
  });

  describe('public API', () => {
    it('exposes show method', async () => {
      const { container, component } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: false },
      });

      const rect = new DOMRect(100, 100, 50, 20);
      component.show(rect, 'API text');

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });
    });

    it('exposes hide method', async () => {
      const { container, component } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      component.hide();

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });

    it('exposes isVisible method', async () => {
      const { component } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      expect(component.isVisible()).toBe(false);

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(component.isVisible()).toBe(true);
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const toolbar = container.querySelector('.floating-toolbar');
        expect(toolbar).toHaveAttribute('role', 'toolbar');
        expect(toolbar).toHaveAttribute('aria-label', 'Text formatting toolbar');
      });
    });

    it('buttons have aria-label', async () => {
      const actions = [{ id: 'test', icon: 'T', label: 'Test Action' }];

      const { container } = render(FloatingToolbar, {
        props: { actions, enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const button = container.querySelector('.toolbar-button');
        expect(button).toHaveAttribute('aria-label', 'Test Action');
      });
    });

    it('disabled buttons have aria-disabled', async () => {
      const actions = [{ id: 'test', icon: 'T', label: 'Test', disabled: true }];

      const { container } = render(FloatingToolbar, {
        props: { actions, enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        const button = container.querySelector('.toolbar-button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
      });
    });
  });

  describe('empty selection handling', () => {
    it('hides when selection is cleared', async () => {
      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).not.toBeNull();
      });

      // Clear selection
      mockSelection.isCollapsed = true;
      mockSelection.toString.mockReturnValue('');

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      await waitFor(() => {
        expect(container.querySelector('.floating-toolbar')).toBeNull();
      });
    });

    it('ignores whitespace-only selection', async () => {
      mockSelection.toString.mockReturnValue('   ');

      const { container } = render(FloatingToolbar, {
        props: { enabled: true, showOnSelection: true },
      });

      fireEvent.mouseUp(document);
      vi.advanceTimersByTime(20);

      expect(container.querySelector('.floating-toolbar')).toBeNull();
    });
  });
});
