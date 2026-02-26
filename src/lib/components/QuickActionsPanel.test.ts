import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import QuickActionsPanel from './QuickActionsPanel.svelte';

describe('QuickActionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should not render panel when closed', () => {
      render(QuickActionsPanel);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render panel when opened via method', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should display search input when open', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      await vi.waitFor(() => {
        expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
      });
    });

    it('should display all action categories', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      await vi.waitFor(() => {
        expect(screen.getByText('Navigation')).toBeInTheDocument();
        expect(screen.getByText('Window')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Tools')).toBeInTheDocument();
        expect(screen.getByText('Help')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should filter actions based on search query', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command/i);
        fireEvent.input(input, { target: { value: 'settings' } });
      });

      await vi.waitFor(() => {
        expect(screen.getByText('Open Settings')).toBeInTheDocument();
      });
    });

    it('should show no results message for invalid search', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command/i);
        fireEvent.input(input, { target: { value: 'xyznonexistent123' } });
      });

      await vi.waitFor(() => {
        expect(screen.getByText(/no actions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should open panel with Ctrl+K', async () => {
      render(QuickActionsPanel);
      
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should close panel with Escape', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });
      
      await vi.waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should navigate down with ArrowDown', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const firstItem = screen.getAllByRole('option')[0];
        expect(firstItem).toHaveClass('selected');
      });

      fireEvent.keyDown(window, { key: 'ArrowDown' });
      
      await vi.waitFor(() => {
        const secondItem = screen.getAllByRole('option')[1];
        expect(secondItem).toHaveClass('selected');
      });
    });

    it('should navigate up with ArrowUp', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      // First navigate down
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      
      // Then navigate up
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      
      await vi.waitFor(() => {
        const secondItem = screen.getAllByRole('option')[1];
        expect(secondItem).toHaveClass('selected');
      });
    });
  });

  describe('action execution', () => {
    it('should dispatch action event when item is clicked', async () => {
      const mockHandler = vi.fn();
      const { component } = render(QuickActionsPanel);
      component.$on('action', mockHandler);
      component.open();
      
      await vi.waitFor(() => {
        const settingsAction = screen.getByText('Open Settings');
        fireEvent.click(settingsAction.closest('button')!);
      });

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should dispatch action event when Enter is pressed', async () => {
      const mockHandler = vi.fn();
      const { component } = render(QuickActionsPanel);
      component.$on('action', mockHandler);
      component.open();
      
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should close panel after action execution', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const firstAction = screen.getAllByRole('option')[0];
        fireEvent.click(firstAction);
      });

      await vi.waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('panel controls', () => {
    it('should toggle panel state', async () => {
      const { component } = render(QuickActionsPanel);
      
      // Open
      component.toggle();
      await vi.waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close
      component.toggle();
      await vi.waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should focus input when opened', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command/i);
        expect(document.activeElement).toBe(input);
      }, { timeout: 100 });
    });

    it('should clear search when closed and reopened', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command/i) as HTMLInputElement;
        fireEvent.input(input, { target: { value: 'test search' } });
        expect(input.value).toBe('test search');
      });

      component.close();
      component.open();

      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText(/type a command/i) as HTMLInputElement;
        expect(input.value).toBe('');
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', 'Quick Actions');
      });
    });

    it('should have listbox role for actions', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should have option role for action items', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should mark selected option with aria-selected', async () => {
      const { component } = render(QuickActionsPanel);
      component.open();
      
      await vi.waitFor(() => {
        const selectedOption = screen.getAllByRole('option').find(
          opt => opt.getAttribute('aria-selected') === 'true'
        );
        expect(selectedOption).toBeInTheDocument();
      });
    });
  });
});
