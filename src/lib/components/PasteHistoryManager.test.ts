import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PasteHistoryManager from './PasteHistoryManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockListen = listen as ReturnType<typeof vi.fn>;

describe('PasteHistoryManager', () => {
  const mockHistoryItems = [
    {
      id: 'clip_1',
      type: 'text' as const,
      content: 'Hello World',
      preview: 'Hello World',
      timestamp: Date.now() - 60000,
      pinned: false,
      size: 11,
    },
    {
      id: 'clip_2',
      type: 'text' as const,
      content: 'Important note',
      preview: 'Important note',
      timestamp: Date.now() - 120000,
      pinned: true,
      size: 14,
    },
    {
      id: 'clip_3',
      type: 'image' as const,
      content: 'data:image/png;base64,abc123',
      preview: 'Image data',
      timestamp: Date.now() - 180000,
      pinned: false,
      size: 1024,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_clipboard_history') {
        return Promise.resolve(mockHistoryItems);
      }
      if (cmd === 'save_clipboard_history') {
        return Promise.resolve();
      }
      if (cmd === 'write_clipboard') {
        return Promise.resolve();
      }
      if (cmd === 'start_clipboard_monitor') {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    mockListen.mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when showPanel is false', () => {
      render(PasteHistoryManager, { showPanel: false });
      expect(screen.queryByText('📋 Clipboard History')).not.toBeInTheDocument();
    });

    it('renders the panel when showPanel is true', async () => {
      render(PasteHistoryManager, { showPanel: true });
      await waitFor(() => {
        expect(screen.getByText('📋 Clipboard History')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', async () => {
      mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Loading history...')).toBeInTheDocument();
      });
    });

    it('displays empty state when no history', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_clipboard_history') {
          return Promise.resolve([]);
        }
        return Promise.resolve();
      });

      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('No clipboard history yet')).toBeInTheDocument();
      });
    });

    it('displays history items', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
        expect(screen.getByText('Important note')).toBeInTheDocument();
      });
    });

    it('applies compact class when compact prop is true', async () => {
      render(PasteHistoryManager, { showPanel: true, compact: true });
      
      await waitFor(() => {
        const panel = screen.getByRole('dialog');
        expect(panel).toHaveClass('compact');
      });
    });
  });

  describe('Search and Filter', () => {
    it('renders search bar when searchEnabled is true', async () => {
      render(PasteHistoryManager, { showPanel: true, searchEnabled: true });
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search clipboard history...')).toBeInTheDocument();
      });
    });

    it('does not render search bar when searchEnabled is false', async () => {
      render(PasteHistoryManager, { showPanel: true, searchEnabled: false });
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search clipboard history...')).not.toBeInTheDocument();
      });
    });

    it('filters items by search query', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search clipboard history...');
      await fireEvent.input(searchInput, { target: { value: 'Important' } });

      await waitFor(() => {
        expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
        expect(screen.getByText('Important note')).toBeInTheDocument();
      });
    });

    it('filters items by type', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const typeFilter = screen.getByRole('combobox');
      await fireEvent.change(typeFilter, { target: { value: 'image' } });

      await waitFor(() => {
        expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
        expect(screen.getByText('Image data')).toBeInTheDocument();
      });
    });
  });

  describe('Item Actions', () => {
    it('pastes item when clicked', async () => {
      const { component } = render(PasteHistoryManager, { showPanel: true });
      
      let pastedItem: any = null;
      component.$on('paste', (e) => {
        pastedItem = e.detail.item;
      });

      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const item = screen.getByText('Hello World').closest('[role="listitem"]');
      await fireEvent.click(item!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('write_clipboard', {
          content: 'Hello World',
          contentType: 'text',
        });
        expect(pastedItem?.content).toBe('Hello World');
      });
    });

    it('toggles pin status', async () => {
      const { component } = render(PasteHistoryManager, { showPanel: true });
      
      let pinEvent: any = null;
      component.$on('pin', (e) => {
        pinEvent = e.detail;
      });

      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const item = screen.getByText('Hello World').closest('[role="listitem"]');
      const pinButton = item!.querySelector('button[title="Pin"]');
      await fireEvent.click(pinButton!);

      await waitFor(() => {
        expect(pinEvent).toBeTruthy();
        expect(pinEvent.id).toBe('clip_1');
      });
    });

    it('deletes item when delete button clicked', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const item = screen.getByText('Hello World').closest('[role="listitem"]');
      const deleteButton = item!.querySelector('button[title="Delete"]');
      await fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear History', () => {
    it('clears non-pinned items', async () => {
      const { component } = render(PasteHistoryManager, { showPanel: true });
      
      let clearFired = false;
      component.$on('clear', () => {
        clearFired = true;
      });

      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      const clearButton = screen.getByTitle('Clear History');
      await fireEvent.click(clearButton);

      await waitFor(() => {
        expect(clearFired).toBe(true);
        // Pinned item should remain
        expect(screen.getByText('Important note')).toBeInTheDocument();
        // Non-pinned items should be gone
        expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes panel on Escape', async () => {
      const { component } = render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await fireEvent.keyDown(window, { key: 'Escape' });

      // Panel visibility is controlled by prop, so check component state
      expect(component.$$.ctx[component.$$.props['showPanel']]).toBe(false);
    });

    it('pastes item with keyboard shortcut', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Important note')).toBeInTheDocument();
      });

      // Ctrl+1 should paste first item (pinned "Important note" is first due to sort)
      await fireEvent.keyDown(window, { key: '1', ctrlKey: true });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('write_clipboard', {
          content: 'Important note',
          contentType: 'text',
        });
      });
    });
  });

  describe('Statistics', () => {
    it('displays correct statistics', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('3 items')).toBeInTheDocument();
        expect(screen.getByText('1 pinned')).toBeInTheDocument();
      });
    });
  });

  describe('Export', () => {
    it('exports history as JSON', async () => {
      const createObjectURLMock = vi.fn(() => 'blob:test');
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      const createElementOriginal = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const element = createElementOriginal(tag);
        if (tag === 'a') {
          element.click = clickMock;
        }
        return element;
      });

      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByTitle('Export History')).toBeInTheDocument();
      });

      const exportButton = screen.getByTitle('Export History');
      await fireEvent.click(exportButton);

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalled();
        expect(clickMock).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalled();
      });

      vi.restoreAllMocks();
    });
  });

  describe('Persistence', () => {
    it('loads history from Tauri invoke', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_clipboard_history');
      });
    });

    it('falls back to localStorage when Tauri unavailable', async () => {
      mockInvoke.mockRejectedValue(new Error('Not available'));
      localStorage.setItem('hearth_clipboard_history', JSON.stringify([
        {
          id: 'local_1',
          type: 'text',
          content: 'Local item',
          preview: 'Local item',
          timestamp: Date.now(),
          pinned: false,
        },
      ]));

      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Local item')).toBeInTheDocument();
      });
    });

    it('saves history after changes', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
      });

      // Delete an item to trigger save
      const item = screen.getByText('Hello World').closest('[role="listitem"]');
      const deleteButton = item!.querySelector('button[title="Delete"]');
      await fireEvent.click(deleteButton!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_clipboard_history', expect.any(Object));
      });
    });
  });

  describe('Clipboard Listener', () => {
    it('sets up clipboard listener on mount', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('clipboard-change', expect.any(Function));
        expect(mockInvoke).toHaveBeenCalledWith('start_clipboard_monitor');
      });
    });

    it('adds new items from clipboard events', async () => {
      let clipboardCallback: (event: any) => void;
      mockListen.mockImplementation((event: string, callback: (event: any) => void) => {
        if (event === 'clipboard-change') {
          clipboardCallback = callback;
        }
        return Promise.resolve(() => {});
      });

      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      // Simulate clipboard change
      clipboardCallback!({
        payload: {
          content: 'New clipboard content',
          type: 'text',
          source: 'Chrome',
        },
      });

      await waitFor(() => {
        expect(screen.getByText('New clipboard content')).toBeInTheDocument();
      });
    });
  });

  describe('Deduplication', () => {
    it('ignores duplicate content within 5 seconds', async () => {
      let clipboardCallback: (event: any) => void;
      mockListen.mockImplementation((event: string, callback: (event: any) => void) => {
        if (event === 'clipboard-change') {
          clipboardCallback = callback;
        }
        return Promise.resolve(() => {});
      });

      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      // First clipboard event
      clipboardCallback!({
        payload: { content: 'Duplicate test', type: 'text' },
      });

      // Immediate duplicate
      clipboardCallback!({
        payload: { content: 'Duplicate test', type: 'text' },
      });

      await waitFor(() => {
        const items = screen.getAllByText('Duplicate test');
        expect(items).toHaveLength(1);
      });
    });
  });

  describe('Sorting', () => {
    it('sorts pinned items first', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        // Pinned "Important note" should be first
        expect(items[0]).toHaveTextContent('Important note');
      });
    });

    it('sorts by timestamp within pinned/unpinned groups', async () => {
      render(PasteHistoryManager, { showPanel: true });
      
      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        // After pinned, newest unpinned first
        expect(items[1]).toHaveTextContent('Hello World');
      });
    });
  });
});
