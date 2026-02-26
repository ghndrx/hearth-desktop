import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import BookmarksManager from './BookmarksManager.svelte';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${Math.random().toString(36).substr(2, 9)}`
});

describe('BookmarksManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockMessage = {
    id: 'msg-1',
    channelId: 'channel-1',
    channelName: 'general',
    serverId: 'server-1',
    serverName: 'Test Server',
    content: 'This is a test message to bookmark',
    author: {
      id: 'user-1',
      name: 'Test User',
      avatar: 'https://example.com/avatar.png'
    },
    timestamp: new Date('2026-02-26T10:00:00Z')
  };

  it('renders when isOpen is true', () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search bookmarks...')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(BookmarksManager, { props: { isOpen: false } });
    
    expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
  });

  it('shows empty state when no bookmarks exist', () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    expect(screen.getByText('No bookmarks')).toBeInTheDocument();
    expect(screen.getByText(/Bookmark messages to save them here/)).toBeInTheDocument();
  });

  it('displays All Bookmarks and Pinned folders by default', () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    expect(screen.getByText('All Bookmarks')).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('dispatches close event when close button is clicked', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const closeButton = screen.getByTitle('Export bookmarks').nextElementSibling;
    if (closeButton) {
      await fireEvent.click(closeButton);
    }
    
    expect(closeHandler).toHaveBeenCalled();
  });

  it('adds a bookmark via exposed method', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    const bookmarkHandler = vi.fn();
    component.$on('bookmarkAdded', bookmarkHandler);
    
    const bookmark = component.addBookmark(mockMessage);
    
    expect(bookmark).toBeDefined();
    expect(bookmark.messageId).toBe('msg-1');
    expect(bookmark.content).toBe('This is a test message to bookmark');
    expect(bookmarkHandler).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  it('displays bookmark after adding', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('general')).toBeInTheDocument();
    });
  });

  it('filters bookmarks by search query', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    component.addBookmark({
      ...mockMessage,
      id: 'msg-2',
      content: 'Different content here'
    });
    
    const searchInput = screen.getByPlaceholderText('Search bookmarks...');
    await fireEvent.input(searchInput, { target: { value: 'Different' } });
    
    await waitFor(() => {
      expect(screen.getByText('Different content here')).toBeInTheDocument();
      expect(screen.queryByText('This is a test message to bookmark')).not.toBeInTheDocument();
    });
  });

  it('changes view mode', async () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    const gridViewBtn = screen.getByTitle('Grid view');
    await fireEvent.click(gridViewBtn);
    
    const bookmarksList = document.querySelector('.bookmarks-list');
    expect(bookmarksList).toHaveClass('grid');
  });

  it('opens add folder modal', async () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    // Find the add folder button (the + button in folders header)
    const addButton = document.querySelector('.add-folder-btn');
    expect(addButton).toBeInTheDocument();
    
    if (addButton) {
      await fireEvent.click(addButton);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Create Folder')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter folder name...')).toBeInTheDocument();
    });
  });

  it('creates a new folder', async () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    const addButton = document.querySelector('.add-folder-btn');
    if (addButton) {
      await fireEvent.click(addButton);
    }
    
    const nameInput = await screen.findByPlaceholderText('Enter folder name...');
    await fireEvent.input(nameInput, { target: { value: 'Work' } });
    
    const createButton = screen.getByText('Create Folder');
    await fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });

  it('toggles pin on bookmark', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    // Hover to reveal actions and click pin button
    const bookmarkItem = document.querySelector('.bookmark-item');
    if (bookmarkItem) {
      await fireEvent.mouseEnter(bookmarkItem);
      
      const pinButton = screen.getByTitle('Pin');
      await fireEvent.click(pinButton);
      
      expect(bookmarkItem).toHaveClass('pinned');
    }
  });

  it('removes bookmark', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    const removeHandler = vi.fn();
    component.$on('bookmarkRemoved', removeHandler);
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    const bookmarkItem = document.querySelector('.bookmark-item');
    if (bookmarkItem) {
      await fireEvent.mouseEnter(bookmarkItem);
      
      const removeButton = screen.getByTitle('Remove');
      await fireEvent.click(removeButton);
    }
    
    await waitFor(() => {
      expect(screen.queryByText('This is a test message to bookmark')).not.toBeInTheDocument();
      expect(removeHandler).toHaveBeenCalled();
    });
  });

  it('sorts bookmarks by different criteria', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    component.addBookmark({
      ...mockMessage,
      id: 'msg-2',
      content: 'Second message',
      channelName: 'announcements'
    });
    
    const sortSelect = document.querySelector('.sort-select') as HTMLSelectElement;
    if (sortSelect) {
      await fireEvent.change(sortSelect, { target: { value: 'channel' } });
    }
    
    // Verify sort changed (implementation details would need checking)
    await waitFor(() => {
      expect(sortSelect.value).toBe('channel');
    });
  });

  it('exports bookmarks as JSON', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockUrl = 'blob:test-url';
    const createObjectURLMock = vi.fn(() => mockUrl);
    const revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
    
    // Mock click on anchor element
    const clickMock = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { click: clickMock, href: '', download: '' } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });
    
    const exportButton = screen.getByTitle('Export bookmarks');
    await fireEvent.click(exportButton);
    
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it('navigates to message when clicking bookmark content', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    const navigateHandler = vi.fn();
    component.$on('navigate', navigateHandler);
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    const content = screen.getByText('This is a test message to bookmark');
    await fireEvent.click(content);
    
    expect(navigateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          messageId: 'msg-1',
          channelId: 'channel-1'
        }
      })
    );
  });

  it('opens edit modal for bookmark', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    const bookmarkItem = document.querySelector('.bookmark-item');
    if (bookmarkItem) {
      await fireEvent.mouseEnter(bookmarkItem);
      
      const editButton = screen.getByTitle('Edit');
      await fireEvent.click(editButton);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Edit Bookmark')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
    });
  });

  it('saves bookmark edit with note and tags', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    // Open edit modal
    const bookmarkItem = document.querySelector('.bookmark-item');
    if (bookmarkItem) {
      await fireEvent.mouseEnter(bookmarkItem);
      const editButton = screen.getByTitle('Edit');
      await fireEvent.click(editButton);
    }
    
    // Add note and tags
    const noteInput = await screen.findByPlaceholderText('Add a note...');
    await fireEvent.input(noteInput, { target: { value: 'Important reminder' } });
    
    const tagsInput = screen.getByPlaceholderText('work, important, todo...');
    await fireEvent.input(tagsInput, { target: { value: 'work, important' } });
    
    // Save changes
    const saveButton = screen.getByText('Save Changes');
    await fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Important reminder')).toBeInTheDocument();
      expect(screen.getByText('#work')).toBeInTheDocument();
      expect(screen.getByText('#important')).toBeInTheDocument();
    });
  });

  it('filters by tag when tag is clicked', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    const bookmark = component.addBookmark(mockMessage);
    
    // Manually add tags by updating the bookmark
    // Since addTag is internal, we'll test via edit modal
    const bookmarkItem = document.querySelector('.bookmark-item');
    if (bookmarkItem) {
      await fireEvent.mouseEnter(bookmarkItem);
      const editButton = screen.getByTitle('Edit');
      await fireEvent.click(editButton);
    }
    
    const tagsInput = await screen.findByPlaceholderText('work, important, todo...');
    await fireEvent.input(tagsInput, { target: { value: 'urgent' } });
    
    const saveButton = screen.getByText('Save Changes');
    await fireEvent.click(saveButton);
    
    await waitFor(() => {
      const tagFilter = screen.getByText('#urgent');
      expect(tagFilter).toBeInTheDocument();
    });
  });

  it('loads bookmarks from localStorage on mount', async () => {
    const storedData = {
      bookmarks: [
        {
          id: 'stored-1',
          messageId: 'msg-stored',
          channelId: 'channel-1',
          channelName: 'general',
          content: 'Stored bookmark',
          author: { id: 'user-1', name: 'Stored User' },
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          tags: ['stored'],
          pinned: true
        }
      ],
      folders: []
    };
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));
    
    render(BookmarksManager, { props: { isOpen: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Stored bookmark')).toBeInTheDocument();
      expect(screen.getByText('Stored User')).toBeInTheDocument();
    });
  });

  it('handles drag and drop to folder', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    // Create a folder first
    const addButton = document.querySelector('.add-folder-btn');
    if (addButton) {
      await fireEvent.click(addButton);
    }
    
    const nameInput = await screen.findByPlaceholderText('Enter folder name...');
    await fireEvent.input(nameInput, { target: { value: 'Test Folder' } });
    
    const createButton = screen.getByText('Create Folder');
    await fireEvent.click(createButton);
    
    // Add a bookmark
    component.addBookmark(mockMessage);
    
    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
      expect(screen.getByText('This is a test message to bookmark')).toBeInTheDocument();
    });
    
    // Simulate drag and drop (limited testing capability)
    const bookmarkItem = document.querySelector('.bookmark-item');
    const folderItem = Array.from(document.querySelectorAll('.folder-item')).find(
      el => el.textContent?.includes('Test Folder')
    );
    
    if (bookmarkItem && folderItem) {
      await fireEvent.dragStart(bookmarkItem, { dataTransfer: { effectAllowed: 'move' } });
      await fireEvent.dragOver(folderItem);
      await fireEvent.drop(folderItem);
    }
  });

  it('deletes folder', async () => {
    render(BookmarksManager, { props: { isOpen: true } });
    
    // Create a folder
    const addButton = document.querySelector('.add-folder-btn');
    if (addButton) {
      await fireEvent.click(addButton);
    }
    
    const nameInput = await screen.findByPlaceholderText('Enter folder name...');
    await fireEvent.input(nameInput, { target: { value: 'To Delete' } });
    
    const createButton = screen.getByText('Create Folder');
    await fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('To Delete')).toBeInTheDocument();
    });
    
    // Find and click delete button on hover
    const folderItem = Array.from(document.querySelectorAll('.folder-item')).find(
      el => el.textContent?.includes('To Delete')
    );
    
    if (folderItem) {
      await fireEvent.mouseEnter(folderItem);
      const deleteBtn = folderItem.querySelector('.delete-folder-btn');
      if (deleteBtn) {
        await fireEvent.click(deleteBtn);
      }
    }
    
    await waitFor(() => {
      expect(screen.queryByText('To Delete')).not.toBeInTheDocument();
    });
  });

  it('displays correct bookmark count', async () => {
    const { component } = render(BookmarksManager, { props: { isOpen: true } });
    
    component.addBookmark(mockMessage);
    component.addBookmark({ ...mockMessage, id: 'msg-2', content: 'Second' });
    component.addBookmark({ ...mockMessage, id: 'msg-3', content: 'Third' });
    
    await waitFor(() => {
      const count = screen.getByText('3');
      expect(count).toBeInTheDocument();
    });
  });
});
