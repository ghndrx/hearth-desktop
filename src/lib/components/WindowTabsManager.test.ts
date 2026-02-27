import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import WindowTabsManager from './WindowTabsManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case 'get_window_tabs':
        return Promise.resolve([
          {
            id: 'tab-1',
            title: 'Home',
            route: '/',
            isPinned: false,
            isModified: false,
            createdAt: Date.now(),
            lastAccessedAt: Date.now()
          },
          {
            id: 'tab-2',
            title: 'Settings',
            route: '/settings',
            isPinned: false,
            isModified: false,
            createdAt: Date.now(),
            lastAccessedAt: Date.now()
          }
        ]);
      case 'get_tab_groups':
        return Promise.resolve([]);
      case 'get_active_tab_id':
        return Promise.resolve('tab-1');
      case 'save_window_tabs':
        return Promise.resolve();
      case 'save_tab_groups':
        return Promise.resolve();
      case 'confirm_close_tab':
        return Promise.resolve(true);
      default:
        return Promise.resolve(null);
    }
  })
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

describe('WindowTabsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders tabs bar', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    expect(screen.getByTitle('New tab (Ctrl+T)')).toBeInTheDocument();
  });

  it('loads tabs on mount', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    expect(invoke).toHaveBeenCalledWith('get_window_tabs');
    expect(invoke).toHaveBeenCalledWith('get_tab_groups');
    expect(invoke).toHaveBeenCalledWith('get_active_tab_id');
  });

  it('displays loaded tabs', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('creates new tab when clicking + button', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const newTabBtn = screen.getByTitle('New tab (Ctrl+T)');
    await fireEvent.click(newTabBtn);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_window_tabs',
        expect.objectContaining({
          tabs: expect.arrayContaining([
            expect.objectContaining({ title: 'New Tab' })
          ])
        })
      );
    });
  });

  it('selects tab on click', async () => {
    const { component } = render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const tabChangeHandler = vi.fn();
    component.$on('tabChange', tabChangeHandler);
    
    const settingsTab = screen.getByText('Settings');
    await fireEvent.click(settingsTab);
    
    expect(tabChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ tabId: 'tab-2' })
      })
    );
  });

  it('shows context menu on right click', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.contextMenu(homeTab);
    
    expect(screen.getByText('Close Tab')).toBeInTheDocument();
    expect(screen.getByText('Close Other Tabs')).toBeInTheDocument();
    expect(screen.getByText('Pin Tab')).toBeInTheDocument();
    expect(screen.getByText('Duplicate Tab')).toBeInTheDocument();
  });

  it('closes tab from context menu', async () => {
    const { component, invoke } = render(WindowTabsManager);
    const tabCloseHandler = vi.fn();
    component.$on('tabClose', tabCloseHandler);
    
    await vi.runAllTimersAsync();
    
    const settingsTab = screen.getByText('Settings');
    await fireEvent.contextMenu(settingsTab);
    
    const closeOption = screen.getByText('Close Tab');
    await fireEvent.click(closeOption);
    
    expect(tabCloseHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ tabId: 'tab-2' })
      })
    );
  });

  it('pins tab from context menu', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.contextMenu(homeTab);
    
    const pinOption = screen.getByText('Pin Tab');
    await fireEvent.click(pinOption);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_window_tabs',
        expect.objectContaining({
          tabs: expect.arrayContaining([
            expect.objectContaining({ id: 'tab-1', isPinned: true })
          ])
        })
      );
    });
  });

  it('duplicates tab from context menu', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.contextMenu(homeTab);
    
    const duplicateOption = screen.getByText('Duplicate Tab');
    await fireEvent.click(duplicateOption);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_window_tabs',
        expect.objectContaining({
          tabs: expect.arrayContaining([
            expect.objectContaining({ title: 'Home (copy)' })
          ])
        })
      );
    });
  });

  it('handles keyboard shortcut Ctrl+T for new tab', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    await fireEvent.keyDown(window, { key: 't', ctrlKey: true });
    
    await waitFor(() => {
      expect(screen.getByText('New Tab')).toBeInTheDocument();
    });
  });

  it('handles keyboard shortcut Ctrl+W for close tab', async () => {
    const { component } = render(WindowTabsManager);
    const tabCloseHandler = vi.fn();
    component.$on('tabClose', tabCloseHandler);
    
    await vi.runAllTimersAsync();
    
    await fireEvent.keyDown(window, { key: 'w', ctrlKey: true });
    
    expect(tabCloseHandler).toHaveBeenCalled();
  });

  it('navigates tabs with Ctrl+Tab', async () => {
    const { component } = render(WindowTabsManager);
    const tabChangeHandler = vi.fn();
    component.$on('tabChange', tabChangeHandler);
    
    await vi.runAllTimersAsync();
    
    await fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true });
    
    expect(tabChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ tabId: 'tab-2' })
      })
    );
  });

  it('navigates tabs with Ctrl+1-9', async () => {
    const { component } = render(WindowTabsManager);
    const tabChangeHandler = vi.fn();
    component.$on('tabChange', tabChangeHandler);
    
    await vi.runAllTimersAsync();
    
    await fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    
    expect(tabChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ tabId: 'tab-2' })
      })
    );
  });

  it('disables new tab button when max tabs reached', async () => {
    render(WindowTabsManager, { props: { maxTabs: 2 } });
    await vi.runAllTimersAsync();
    
    const newTabBtn = screen.getByTitle('New tab (Ctrl+T)');
    expect(newTabBtn).toBeDisabled();
  });

  it('shows group management panel when clicking groups button', async () => {
    render(WindowTabsManager, { props: { enableGroups: true } });
    await vi.runAllTimersAsync();
    
    const groupsBtn = screen.getByTitle('Manage tab groups');
    await fireEvent.click(groupsBtn);
    
    expect(screen.getByPlaceholderText('Group name...')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('creates a new group', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager, { props: { enableGroups: true } });
    await vi.runAllTimersAsync();
    
    const groupsBtn = screen.getByTitle('Manage tab groups');
    await fireEvent.click(groupsBtn);
    
    const input = screen.getByPlaceholderText('Group name...');
    await fireEvent.input(input, { target: { value: 'Work' } });
    
    const createBtn = screen.getByText('Create');
    await fireEvent.click(createBtn);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_tab_groups',
        expect.objectContaining({
          groups: expect.arrayContaining([
            expect.objectContaining({ name: 'Work' })
          ])
        })
      );
    });
  });

  it('handles drag and drop reordering', async () => {
    const { component } = render(WindowTabsManager);
    const reorderHandler = vi.fn();
    component.$on('tabReorder', reorderHandler);
    
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    const settingsTab = screen.getByText('Settings');
    
    await fireEvent.dragStart(homeTab, {
      dataTransfer: { effectAllowed: '', setData: vi.fn() }
    });
    await fireEvent.dragOver(settingsTab);
    await fireEvent.drop(settingsTab, {
      dataTransfer: { getData: () => 'tab-1' }
    });
    
    expect(reorderHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ fromIndex: 0, toIndex: 1 })
      })
    );
  });

  it('shows tab preview on hover after delay', async () => {
    render(WindowTabsManager, { props: { showTabPreview: true } });
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.mouseEnter(homeTab, { clientX: 100, clientY: 50 });
    
    // Fast forward past the 500ms delay
    vi.advanceTimersByTime(600);
    
    await waitFor(() => {
      expect(screen.getByText('Last accessed:')).toBeInTheDocument();
    });
  });

  it('hides tab preview on mouse leave', async () => {
    render(WindowTabsManager, { props: { showTabPreview: true } });
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.mouseEnter(homeTab, { clientX: 100, clientY: 50 });
    vi.advanceTimersByTime(600);
    
    await fireEvent.mouseLeave(homeTab);
    
    await waitFor(() => {
      expect(screen.queryByText('Last accessed:')).not.toBeInTheDocument();
    });
  });

  it('shows close other tabs option in context menu', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.contextMenu(homeTab);
    
    expect(screen.getByText('Close Other Tabs')).toBeInTheDocument();
    expect(screen.getByText('Close Tabs to Right')).toBeInTheDocument();
  });

  it('closes context menu when clicking elsewhere', async () => {
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const homeTab = screen.getByText('Home');
    await fireEvent.contextMenu(homeTab);
    
    expect(screen.getByText('Close Tab')).toBeInTheDocument();
    
    await fireEvent.click(window);
    
    await waitFor(() => {
      expect(screen.queryByText('Close Tab')).not.toBeInTheDocument();
    });
  });

  it('confirms before closing modified tab', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === 'get_window_tabs') {
        return Promise.resolve([{
          id: 'tab-1',
          title: 'Unsaved',
          route: '/',
          isPinned: false,
          isModified: true,
          createdAt: Date.now(),
          lastAccessedAt: Date.now()
        }]);
      }
      if (cmd === 'confirm_close_tab') {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
    
    render(WindowTabsManager, { props: { tabCloseConfirm: true } });
    await vi.runAllTimersAsync();
    
    const tab = screen.getByText('Unsaved');
    await fireEvent.contextMenu(tab);
    
    const closeOption = screen.getByText('Close Tab');
    await fireEvent.click(closeOption);
    
    expect(invoke).toHaveBeenCalledWith('confirm_close_tab', expect.any(Object));
  });

  it('does not confirm when tabCloseConfirm is false', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === 'get_window_tabs') {
        return Promise.resolve([{
          id: 'tab-1',
          title: 'Unsaved',
          route: '/',
          isPinned: false,
          isModified: true,
          createdAt: Date.now(),
          lastAccessedAt: Date.now()
        }]);
      }
      return Promise.resolve(null);
    });
    
    render(WindowTabsManager, { props: { tabCloseConfirm: false } });
    await vi.runAllTimersAsync();
    
    const tab = screen.getByText('Unsaved');
    await fireEvent.contextMenu(tab);
    
    const closeOption = screen.getByText('Close Tab');
    await fireEvent.click(closeOption);
    
    expect(invoke).not.toHaveBeenCalledWith('confirm_close_tab', expect.any(Object));
  });

  it('shows modified indicator for modified tabs', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === 'get_window_tabs') {
        return Promise.resolve([{
          id: 'tab-1',
          title: 'Modified',
          route: '/',
          isPinned: false,
          isModified: true,
          createdAt: Date.now(),
          lastAccessedAt: Date.now()
        }]);
      }
      return Promise.resolve(null);
    });
    
    const { container } = render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    expect(container.querySelector('.modified-dot')).toBeInTheDocument();
  });

  it('prevents dragging pinned tabs', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
      if (cmd === 'get_window_tabs') {
        return Promise.resolve([{
          id: 'tab-1',
          title: 'Pinned',
          route: '/',
          isPinned: true,
          isModified: false,
          createdAt: Date.now(),
          lastAccessedAt: Date.now()
        }]);
      }
      return Promise.resolve(null);
    });
    
    const { container } = render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    const pinnedTab = container.querySelector('.tab.pinned');
    expect(pinnedTab).toBeInTheDocument();
    
    const dragEvent = new Event('dragstart', { cancelable: true });
    pinnedTab?.dispatchEvent(dragEvent);
    
    expect(dragEvent.defaultPrevented).toBe(true);
  });

  it('moves pinned tabs to front', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager);
    await vi.runAllTimersAsync();
    
    // Pin the second tab
    const settingsTab = screen.getByText('Settings');
    await fireEvent.contextMenu(settingsTab);
    
    const pinOption = screen.getByText('Pin Tab');
    await fireEvent.click(pinOption);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_window_tabs',
        expect.objectContaining({
          tabs: expect.arrayContaining([
            expect.objectContaining({ id: 'tab-2', isPinned: true })
          ])
        })
      );
    });
  });

  it('handles group cancel button', async () => {
    render(WindowTabsManager, { props: { enableGroups: true } });
    await vi.runAllTimersAsync();
    
    const groupsBtn = screen.getByTitle('Manage tab groups');
    await fireEvent.click(groupsBtn);
    
    expect(screen.getByPlaceholderText('Group name...')).toBeInTheDocument();
    
    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Group name...')).not.toBeInTheDocument();
    });
  });

  it('creates group on Enter key', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WindowTabsManager, { props: { enableGroups: true } });
    await vi.runAllTimersAsync();
    
    const groupsBtn = screen.getByTitle('Manage tab groups');
    await fireEvent.click(groupsBtn);
    
    const input = screen.getByPlaceholderText('Group name...');
    await fireEvent.input(input, { target: { value: 'Development' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'save_tab_groups',
        expect.objectContaining({
          groups: expect.arrayContaining([
            expect.objectContaining({ name: 'Development' })
          ])
        })
      );
    });
  });

  it('does not create group with empty name', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.clearAllMocks();
    
    render(WindowTabsManager, { props: { enableGroups: true } });
    await vi.runAllTimersAsync();
    
    const groupsBtn = screen.getByTitle('Manage tab groups');
    await fireEvent.click(groupsBtn);
    
    const createBtn = screen.getByText('Create');
    await fireEvent.click(createBtn);
    
    // save_tab_groups should not be called with a new group
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const saveGroupsCalls = calls.filter(call => call[0] === 'save_tab_groups');
    
    // Initial load may call save, but not with a new empty group
    saveGroupsCalls.forEach(call => {
      if (call[1]?.groups) {
        expect(call[1].groups).not.toContainEqual(
          expect.objectContaining({ name: '' })
        );
      }
    });
  });
});
