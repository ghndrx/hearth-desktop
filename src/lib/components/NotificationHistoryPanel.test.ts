import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NotificationHistoryPanel from './NotificationHistoryPanel.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

describe('NotificationHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the notification panel', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValue(new Error('Not available'));
    
    render(NotificationHistoryPanel);
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValue(new Error('Not available'));
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('loads notifications from Tauri backend', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Test Notification',
        body: 'This is a test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
    });
  });

  it('falls back to localStorage when Tauri unavailable', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValue(new Error('Not available'));
    
    const mockNotifications = [
      {
        id: '2',
        title: 'Stored Notification',
        body: 'From localStorage',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    localStorage.setItem('notification_history', JSON.stringify(mockNotifications));
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Stored Notification')).toBeInTheDocument();
    });
  });

  it('displays unread count badge', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Unread 1',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      },
      {
        id: '2',
        title: 'Unread 2',
        body: 'Test',
        category: 'mention',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('2 new')).toBeInTheDocument();
    });
  });

  it('filters notifications by category', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Message Notification',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      },
      {
        id: '2',
        title: 'System Notification',
        body: 'Test',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Message Notification')).toBeInTheDocument();
      expect(screen.getByText('System Notification')).toBeInTheDocument();
    });
    
    // Click on Messages filter
    const messagesFilter = screen.getByText(/Messages/);
    await fireEvent.click(messagesFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Message Notification')).toBeInTheDocument();
      expect(screen.queryByText('System Notification')).not.toBeInTheDocument();
    });
  });

  it('searches notifications', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Hello World',
        body: 'Test message',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      },
      {
        id: '2',
        title: 'Goodbye',
        body: 'Another message',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search notifications...');
    await fireEvent.input(searchInput, { target: { value: 'Hello' } });
    
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.queryByText('Goodbye')).not.toBeInTheDocument();
    });
  });

  it('marks notification as read on click', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Unread Notification',
        body: 'Click me',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    const { component } = render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('1 new')).toBeInTheDocument();
    });
    
    const notification = screen.getByText('Unread Notification');
    await fireEvent.click(notification.closest('button')!);
    
    await waitFor(() => {
      expect(screen.queryByText('1 new')).not.toBeInTheDocument();
    });
  });

  it('marks all notifications as read', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Unread 1',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      },
      {
        id: '2',
        title: 'Unread 2',
        body: 'Test',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('2 new')).toBeInTheDocument();
    });
    
    const markAllReadBtn = screen.getByText('Mark all read');
    await fireEvent.click(markAllReadBtn);
    
    await waitFor(() => {
      expect(screen.queryByText('2 new')).not.toBeInTheDocument();
    });
  });

  it('dismisses all notifications', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Notification 1',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Notification 1')).toBeInTheDocument();
    });
    
    const dismissAllBtn = screen.getByLabelText('Dismiss all notifications');
    await fireEvent.click(dismissAllBtn);
    
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('clears notification history', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Notification 1',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: true,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Notification 1')).toBeInTheDocument();
    });
    
    const clearHistoryBtn = screen.getByText('Clear history');
    await fireEvent.click(clearHistoryBtn);
    
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('sorts notifications by different criteria', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const now = Date.now();
    const mockNotifications = [
      {
        id: '1',
        title: 'Older Notification',
        body: 'Test',
        category: 'message',
        timestamp: new Date(now - 10000).toISOString(),
        read: true,
        dismissed: false
      },
      {
        id: '2',
        title: 'Newer Notification',
        body: 'Test',
        category: 'message',
        timestamp: new Date(now).toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      const notifications = screen.getAllByRole('button');
      // First should be newer
      expect(notifications[0]).toHaveTextContent('Newer Notification');
    });
    
    const sortSelect = screen.getByRole('combobox');
    await fireEvent.change(sortSelect, { target: { value: 'oldest' } });
    
    await waitFor(() => {
      const notifications = screen.getAllByRole('button');
      // First should now be older
      expect(notifications[0]).toHaveTextContent('Older Notification');
    });
  });

  it('displays relative time by default', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Recent Notification',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel);
    
    await waitFor(() => {
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });
  });

  it('hides panel when visible is false', () => {
    render(NotificationHistoryPanel, { props: { visible: false } });
    
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  it('dispatches notificationClick event', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Clickable Notification',
        body: 'Click me',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    const handleClick = vi.fn();
    const { component } = render(NotificationHistoryPanel);
    component.$on('notificationClick', handleClick);
    
    await waitFor(() => {
      expect(screen.getByText('Clickable Notification')).toBeInTheDocument();
    });
    
    const notification = screen.getByText('Clickable Notification');
    await fireEvent.click(notification.closest('button')!);
    
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          notification: expect.objectContaining({
            id: '1',
            title: 'Clickable Notification'
          })
        })
      })
    );
  });

  it('groups notifications by category when enabled', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockNotifications = [
      {
        id: '1',
        title: 'Message 1',
        body: 'Test',
        category: 'message',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      },
      {
        id: '2',
        title: 'System Alert',
        body: 'Test',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        dismissed: false
      }
    ];
    
    vi.mocked(invoke).mockResolvedValueOnce(mockNotifications);
    
    render(NotificationHistoryPanel, { props: { groupByCategory: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('limits history to maxHistory prop', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValue(new Error('Not available'));
    
    const { component } = render(NotificationHistoryPanel, { 
      props: { maxHistory: 3 } 
    });
    
    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
    
    // Add 5 notifications
    for (let i = 0; i < 5; i++) {
      component.addNotification({
        title: `Notification ${i}`,
        body: 'Test',
        category: 'message'
      });
    }
    
    // Should only keep last 3
    const stored = JSON.parse(localStorage.getItem('notification_history') || '[]');
    expect(stored.length).toBe(3);
  });
});
