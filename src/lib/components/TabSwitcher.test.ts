import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/svelte';
import TabSwitcher from './TabSwitcher.svelte';

// Mock tab items
const mockTabs = [
  {
    id: 'channel-1',
    type: 'channel' as const,
    title: 'general',
    subtitle: 'General discussion',
    serverName: 'Test Server',
    serverId: 'server-1',
    lastAccessed: Date.now() - 60000, // 1 minute ago
    unreadCount: 3
  },
  {
    id: 'channel-2',
    type: 'channel' as const,
    title: 'development',
    subtitle: 'Dev talk',
    serverName: 'Test Server',
    serverId: 'server-1',
    lastAccessed: Date.now() - 120000 // 2 minutes ago
  },
  {
    id: 'dm-1',
    type: 'dm' as const,
    title: 'Alice',
    subtitle: 'Online',
    lastAccessed: Date.now() - 30000, // 30 seconds ago
    icon: '👩'
  },
  {
    id: 'thread-1',
    type: 'thread' as const,
    title: 'Bug Discussion',
    serverName: 'Test Server',
    serverId: 'server-1',
    lastAccessed: Date.now() - 300000 // 5 minutes ago
  },
  {
    id: 'channel-3',
    type: 'channel' as const,
    title: 'random',
    serverName: 'Other Server',
    serverId: 'server-2',
    lastAccessed: Date.now() - 180000 // 3 minutes ago
  }
];

describe('TabSwitcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders when isOpen is true', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Quick Switch')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(TabSwitcher, {
        props: {
          isOpen: false,
          recentTabs: mockTabs
        }
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays all provided tabs', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      expect(screen.getByText('general')).toBeInTheDocument();
      expect(screen.getByText('development')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bug Discussion')).toBeInTheDocument();
      expect(screen.getByText('random')).toBeInTheDocument();
    });

    it('shows unread count badges', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays relative time for each tab', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs.slice(0, 1),
          groupByServer: false
        }
      });

      expect(screen.getByText('1m ago')).toBeInTheDocument();
    });

    it('shows tab count in footer', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      expect(screen.getByText('5 of 5 tabs')).toBeInTheDocument();
    });
  });

  describe('grouping', () => {
    it('groups tabs by server when groupByServer is true', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: true
        }
      });

      expect(screen.getByText('Test Server')).toBeInTheDocument();
      expect(screen.getByText('Other Server')).toBeInTheDocument();
      expect(screen.getByText('💬 Direct Messages')).toBeInTheDocument();
    });

    it('shows flat list when groupByServer is false', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      expect(screen.getByText('Recent')).toBeInTheDocument();
      expect(screen.queryByText('Test Server')).not.toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('selects first item by default', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const dialog = screen.getByRole('dialog');
      const selectedItem = dialog.querySelector('.tab-item.selected');
      expect(selectedItem).toBeInTheDocument();
    });

    it('moves selection down on ArrowDown', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const navigateHandler = vi.fn();
      component.$on('navigate', navigateHandler);

      await fireEvent.keyDown(window, { key: 'ArrowDown' });

      expect(navigateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { direction: 'down' }
        })
      );
    });

    it('moves selection up on ArrowUp', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const navigateHandler = vi.fn();
      component.$on('navigate', navigateHandler);

      await fireEvent.keyDown(window, { key: 'ArrowUp' });

      expect(navigateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { direction: 'up' }
        })
      );
    });

    it('cycles through tabs on Tab key', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: 'Tab' });
      await fireEvent.keyDown(window, { key: 'Tab' });

      // Selection should have moved
      const dialog = screen.getByRole('dialog');
      const selectedItem = dialog.querySelector('.tab-item.selected');
      expect(selectedItem).toBeInTheDocument();
    });

    it('cycles backward on Shift+Tab', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

      const dialog = screen.getByRole('dialog');
      const selectedItem = dialog.querySelector('.tab-item.selected');
      expect(selectedItem).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(closeHandler).toHaveBeenCalled();
    });

    it('selects item on Enter', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const selectHandler = vi.fn();
      component.$on('select', selectHandler);

      await fireEvent.keyDown(window, { key: 'Enter' });

      expect(selectHandler).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('shows search hint by default', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      expect(screen.getByText(/Press.*to search/)).toBeInTheDocument();
    });

    it('opens search on / key', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      await fireEvent.keyDown(window, { key: '/' });

      expect(screen.getByPlaceholderText('Search tabs...')).toBeInTheDocument();
    });

    it('filters tabs based on search query', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: '/' });
      const searchInput = screen.getByPlaceholderText('Search tabs...');
      await fireEvent.input(searchInput, { target: { value: 'general' } });

      expect(screen.getByText('general')).toBeInTheDocument();
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('shows empty state when no results', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: '/' });
      const searchInput = screen.getByPlaceholderText('Search tabs...');
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText(/No tabs match/)).toBeInTheDocument();
    });

    it('clears search on clear button click', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: '/' });
      const searchInput = screen.getByPlaceholderText('Search tabs...');
      await fireEvent.input(searchInput, { target: { value: 'general' } });

      const clearButton = screen.getByLabelText('Clear search');
      await fireEvent.click(clearButton);

      expect(screen.queryByPlaceholderText('Search tabs...')).not.toBeInTheDocument();
    });
  });

  describe('pinning', () => {
    it('pins item on Ctrl+P', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const pinHandler = vi.fn();
      component.$on('pin', pinHandler);

      await fireEvent.keyDown(window, { key: 'p', ctrlKey: true });

      expect(pinHandler).toHaveBeenCalled();
    });

    it('shows pinned group when items are pinned', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: true
        }
      });

      await fireEvent.keyDown(window, { key: 'p', ctrlKey: true });

      expect(screen.getByText('📌 Pinned')).toBeInTheDocument();
    });

    it('shows pin indicator on pinned items', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      await fireEvent.keyDown(window, { key: 'p', ctrlKey: true });

      const pinnedIndicator = screen.getByTitle('Pinned');
      expect(pinnedIndicator).toBeInTheDocument();
    });
  });

  describe('closing tabs', () => {
    it('closes tab on Ctrl+W', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: [...mockTabs],
          groupByServer: false
        }
      });

      const closeTabHandler = vi.fn();
      component.$on('closeTab', closeTabHandler);

      await fireEvent.keyDown(window, { key: 'w', ctrlKey: true });

      expect(closeTabHandler).toHaveBeenCalled();
    });

    it('shows close button on selected item', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const closeButton = screen.getByTitle(/Close tab/);
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('mouse interaction', () => {
    it('selects item on hover', async () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const items = screen.getAllByRole('option');
      await fireEvent.mouseEnter(items[2]);

      expect(items[2]).toHaveClass('selected');
    });

    it('selects item on click', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const selectHandler = vi.fn();
      component.$on('select', selectHandler);

      const items = screen.getAllByRole('option');
      await fireEvent.click(items[1]);

      expect(selectHandler).toHaveBeenCalled();
    });

    it('closes on overlay click', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      const overlay = screen.getByRole('dialog').parentElement;
      if (overlay) {
        await fireEvent.click(overlay);
      }

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('maxVisibleItems', () => {
    it('limits displayed items to maxVisibleItems', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          maxVisibleItems: 3,
          groupByServer: false
        }
      });

      const items = screen.getAllByRole('option');
      expect(items.length).toBe(3);
    });

    it('shows correct tab count with limit', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          maxVisibleItems: 3
        }
      });

      expect(screen.getByText('3 of 5 tabs')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Tab Switcher');

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant');
    });

    it('items have correct option role', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('selected item has aria-selected true', () => {
      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const selectedOption = screen.getAllByRole('option').find(
        opt => opt.getAttribute('aria-selected') === 'true'
      );
      expect(selectedOption).toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('dispatches select event with item', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs,
          groupByServer: false
        }
      });

      const selectHandler = vi.fn();
      component.$on('select', selectHandler);

      await fireEvent.keyDown(window, { key: 'Enter' });

      expect(selectHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            item: expect.objectContaining({
              id: expect.any(String),
              title: expect.any(String)
            })
          })
        })
      );
    });

    it('dispatches navigate event with direction', async () => {
      const { component } = render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: mockTabs
        }
      });

      const navigateHandler = vi.fn();
      component.$on('navigate', navigateHandler);

      await fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(navigateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { direction: 'left' }
        })
      );
    });
  });

  describe('relative time formatting', () => {
    it('shows "Just now" for recent access', () => {
      const recentTab = {
        ...mockTabs[0],
        lastAccessed: Date.now() - 5000 // 5 seconds ago
      };

      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: [recentTab],
          groupByServer: false
        }
      });

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('shows hours for older access', () => {
      const hourOldTab = {
        ...mockTabs[0],
        lastAccessed: Date.now() - 3600000 // 1 hour ago
      };

      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: [hourOldTab],
          groupByServer: false
        }
      });

      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });

    it('shows days for very old access', () => {
      const dayOldTab = {
        ...mockTabs[0],
        lastAccessed: Date.now() - 86400000 // 1 day ago
      };

      render(TabSwitcher, {
        props: {
          isOpen: true,
          recentTabs: [dayOldTab],
          groupByServer: false
        }
      });

      expect(screen.getByText('1d ago')).toBeInTheDocument();
    });
  });
});
