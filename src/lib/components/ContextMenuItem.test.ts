import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ContextMenuItem from './ContextMenuItem.svelte';

describe('ContextMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with label', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Test Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Test Item');
      expect(button).toHaveAttribute('role', 'menuitem');
    });

    it('renders with icon', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Copy',
          icon: '📋'
        }
      });

      const icon = container.querySelector('.icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('📋');
    });

    it('renders without icon when not provided', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Simple Item'
        }
      });

      const icon = container.querySelector('.icon');
      expect(icon).not.toBeInTheDocument();
    });

    it('renders with shortcut', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Copy',
          shortcut: 'Ctrl+C'
        }
      });

      const shortcut = container.querySelector('.shortcut');
      expect(shortcut).toBeInTheDocument();
      expect(shortcut).toHaveTextContent('Ctrl+C');
    });

    it('does not render shortcut when not provided', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Simple Item'
        }
      });

      const shortcut = container.querySelector('.shortcut');
      expect(shortcut).not.toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('renders in normal state', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Normal Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('disabled');
      expect(button).not.toHaveClass('danger');
    });

    it('renders in disabled state', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Disabled Item',
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled');
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('renders in danger state', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Delete',
          danger: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('danger');
    });

    it('can be both disabled and danger', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Delete',
          danger: true,
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('danger');
      expect(button).toHaveClass('disabled');
    });
  });

  describe('interactions', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn();
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Clickable Item'
        }
      });

      const button = container.querySelector('button');
      button?.addEventListener('click', handleClick);

      await fireEvent.click(button!);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disabled state is reflected in classes', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Disabled Item',
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled');
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('is focusable when enabled', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Focusable Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('is not focusable when disabled', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Non-focusable Item',
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('styling', () => {
    it('has correct base classes', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Styled Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('context-menu-item');
    });

    it('applies disabled styling', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Disabled Item',
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled');
    });

    it('applies danger styling', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Danger Item',
          danger: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveClass('danger');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA role', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Accessible Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('role', 'menuitem');
    });

    it('is keyboard accessible when enabled', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Keyboard Item'
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('respects disabled state for accessibility', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Disabled Item',
          disabled: true
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('edge cases', () => {
    it('handles empty label', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: ''
        }
      });

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });

    it('handles special characters in label', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Item <special> & "test"'
        }
      });

      const button = container.querySelector('button');
      expect(button).toHaveTextContent('Item <special> & "test"');
    });

    it('handles emoji icons', () => {
      const { container } = render(ContextMenuItem, {
        props: {
          label: 'Emoji Item',
          icon: '🎉'
        }
      });

      const icon = container.querySelector('.icon');
      expect(icon).toHaveTextContent('🎉');
    });

    it('handles long labels gracefully', () => {
      const longLabel = 'A'.repeat(100);
      const { container } = render(ContextMenuItem, {
        props: {
          label: longLabel
        }
      });

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(longLabel);
    });
  });
});
