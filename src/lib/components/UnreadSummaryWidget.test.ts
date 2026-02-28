import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import UnreadSummaryWidget from './UnreadSummaryWidget.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const mockSummary = {
  totalUnread: 15,
  totalMentions: 3,
  items: [
    {
      id: 'server-1',
      name: 'Gaming Server',
      type: 'server' as const,
      unreadCount: 10,
      mentionCount: 2,
      lastMessagePreview: 'Hey, anyone up for a game?',
      lastMessageTime: new Date(Date.now() - 60000).toISOString(),
      priority: 'high' as const
    },
    {
      id: 'dm-1',
      name: 'Alice',
      type: 'dm' as const,
      unreadCount: 3,
      mentionCount: 1,
      iconUrl: 'https://example.com/avatar.png',
      lastMessagePreview: 'Check out this link!',
      lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
      priority: 'normal' as const
    },
    {
      id: 'channel-1',
      name: '#general',
      type: 'channel' as const,
      unreadCount: 2,
      mentionCount: 0,
      lastMessagePreview: 'Welcome to the channel',
      lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
      priority: 'normal' as const
    }
  ],
  lastUpdated: new Date().toISOString()
};

describe('UnreadSummaryWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(UnreadSummaryWidget);
    
    expect(screen.getByText('0 unread')).toBeInTheDocument();
  });

  it('fetches and displays unread summary', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_unread_summary', { maxItems: 10 });
    });
  });

  it('expands panel on header click', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    // Panel should be expanded
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('displays unread items when expanded', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    await waitFor(() => {
      expect(screen.getByText('Gaming Server')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('#general')).toBeInTheDocument();
    });
  });

  it('shows type groupings when groupByType is enabled', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget, { props: { groupByType: true } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    await waitFor(() => {
      expect(screen.getByText('Servers')).toBeInTheDocument();
      expect(screen.getByText('Direct Messages')).toBeInTheDocument();
      expect(screen.getByText('Channels')).toBeInTheDocument();
    });
  });

  it('handles mark all read action', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    mockInvoke.mockResolvedValueOnce(undefined); // mark_all_as_read
    
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    const markReadBtn = screen.getByText('Mark all read');
    await fireEvent.click(markReadBtn);
    
    expect(mockInvoke).toHaveBeenCalledWith('mark_all_as_read');
  });

  it('handles refresh action', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    mockInvoke.mockResolvedValueOnce(mockSummary); // second fetch
    
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    const refreshBtn = screen.getByText('Refresh');
    await fireEvent.click(refreshBtn);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  it('handles item click and dispatches event', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    mockInvoke.mockResolvedValueOnce(undefined); // navigate_to_unread
    
    const { component } = render(UnreadSummaryWidget);
    
    const mockHandler = vi.fn();
    component.$on('itemClick', mockHandler);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    const item = screen.getByText('Gaming Server');
    await fireEvent.click(item);
    
    expect(mockHandler).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith('navigate_to_unread', {
      itemId: 'server-1',
      itemType: 'server'
    });
  });

  it('auto-refreshes at specified interval', async () => {
    mockInvoke.mockResolvedValue(mockSummary);
    
    render(UnreadSummaryWidget, { props: { autoRefreshInterval: 5000 } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
    
    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  it('shows empty state when no unreads', async () => {
    mockInvoke.mockResolvedValueOnce({
      totalUnread: 0,
      totalMentions: 0,
      items: [],
      lastUpdated: new Date().toISOString()
    });
    
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    await waitFor(() => {
      expect(screen.getByText('All caught up!')).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));
    
    const { component } = render(UnreadSummaryWidget);
    
    const mockErrorHandler = vi.fn();
    component.$on('error', mockErrorHandler);
    
    await waitFor(() => {
      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });

  it('displays mention count badge', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    expect(screen.getByText('@3')).toBeInTheDocument();
  });

  it('shows message preview when showPreview is true', async () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    render(UnreadSummaryWidget, { props: { showPreview: true } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    await waitFor(() => {
      expect(screen.getByText(/Hey, anyone up for a game/)).toBeInTheDocument();
    });
  });

  it('applies compact class when compact prop is true', () => {
    mockInvoke.mockResolvedValueOnce(mockSummary);
    const { container } = render(UnreadSummaryWidget, { props: { compact: true } });
    
    expect(container.querySelector('.unread-summary-widget.compact')).toBeInTheDocument();
  });

  it('limits items to maxItems', async () => {
    const manyItems = {
      ...mockSummary,
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        type: 'dm' as const,
        unreadCount: 1,
        mentionCount: 0,
        priority: 'normal' as const
      }))
    };
    
    mockInvoke.mockResolvedValueOnce(manyItems);
    render(UnreadSummaryWidget, { props: { maxItems: 5 } });
    
    expect(mockInvoke).toHaveBeenCalledWith('get_unread_summary', { maxItems: 5 });
  });

  it('shows urgent styling for urgent priority items', async () => {
    const urgentSummary = {
      ...mockSummary,
      items: [{
        ...mockSummary.items[0],
        priority: 'urgent' as const
      }]
    };
    
    mockInvoke.mockResolvedValueOnce(urgentSummary);
    const { container } = render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    expect(container.querySelector('.has-urgent')).toBeInTheDocument();
  });

  it('formats time correctly', async () => {
    const recentSummary = {
      ...mockSummary,
      items: [{
        ...mockSummary.items[0],
        lastMessageTime: new Date(Date.now() - 30000).toISOString() // 30 seconds ago
      }]
    };
    
    mockInvoke.mockResolvedValueOnce(recentSummary);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    await waitFor(() => {
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });
  });

  it('disables mark all read when no unreads', async () => {
    const emptyState = {
      totalUnread: 0,
      totalMentions: 0,
      items: [],
      lastUpdated: new Date().toISOString()
    };
    
    mockInvoke.mockResolvedValueOnce(emptyState);
    render(UnreadSummaryWidget);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    const header = screen.getByRole('button', { name: /unread messages summary/i });
    await fireEvent.click(header);
    
    const markReadBtn = screen.getByText('Mark all read');
    expect(markReadBtn.closest('button')).toBeDisabled();
  });
});
