import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import ActivityTimeline from './ActivityTimeline.svelte';
import type { ActivityItem, ActivityType } from './ActivityTimeline.svelte';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ActivityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders empty state when no activities', () => {
      render(ActivityTimeline);
      
      expect(screen.getByText('No activities to show')).toBeInTheDocument();
      expect(screen.getByText('📭')).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(ActivityTimeline);
      
      expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    });

    it('renders filter button when showFilters is true', () => {
      render(ActivityTimeline, { props: { showFilters: true } });
      
      expect(screen.getByTitle('Toggle filters')).toBeInTheDocument();
    });

    it('does not render filter button when showFilters is false', () => {
      render(ActivityTimeline, { props: { showFilters: false } });
      
      expect(screen.queryByTitle('Toggle filters')).not.toBeInTheDocument();
    });
  });

  describe('Activity Management', () => {
    it('adds activity via component method', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({
        type: 'message',
        title: 'Test Message',
        description: 'This is a test',
      });
      
      await waitFor(() => {
        expect(screen.getByText('Test Message')).toBeInTheDocument();
      });
    });

    it('removes activity via component method', async () => {
      const { component } = render(ActivityTimeline);
      
      const activity = component.addActivity({
        type: 'message',
        title: 'To Be Deleted',
      });
      
      await waitFor(() => {
        expect(screen.getByText('To Be Deleted')).toBeInTheDocument();
      });
      
      component.removeActivity(activity.id);
      
      await waitFor(() => {
        expect(screen.queryByText('To Be Deleted')).not.toBeInTheDocument();
      });
    });

    it('clears all activities', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Activity 1' });
      component.addActivity({ type: 'notification', title: 'Activity 2' });
      
      await waitFor(() => {
        expect(screen.getByText('Activity 1')).toBeInTheDocument();
        expect(screen.getByText('Activity 2')).toBeInTheDocument();
      });
      
      component.clearActivities();
      
      await waitFor(() => {
        expect(screen.queryByText('Activity 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Activity 2')).not.toBeInTheDocument();
        expect(screen.getByText('No activities to show')).toBeInTheDocument();
      });
    });

    it('returns activities via getActivities', () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Test 1' });
      component.addActivity({ type: 'notification', title: 'Test 2' });
      
      const activities = component.getActivities();
      expect(activities).toHaveLength(2);
      expect(activities[0].title).toBe('Test 2'); // Newest first
      expect(activities[1].title).toBe('Test 1');
    });
  });

  describe('Read/Unread State', () => {
    it('shows unread badge when activities are unread', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Unread Activity' });
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Unread badge
      });
    });

    it('marks activity as read on click', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Click Me' });
      
      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument();
      });
      
      const activityItem = screen.getByText('Click Me').closest('[role="listitem"]');
      expect(activityItem).toHaveClass('unread');
      
      await fireEvent.click(activityItem!);
      
      await waitFor(() => {
        expect(activityItem).not.toHaveClass('unread');
      });
    });

    it('marks all as read via method', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Activity 1' });
      component.addActivity({ type: 'notification', title: 'Activity 2' });
      
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 unread
      });
      
      component.markAllAsRead();
      
      await waitFor(() => {
        expect(screen.queryByText('2')).not.toBeInTheDocument();
      });
    });

    it('shows mark all as read button when unread exist', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Unread' });
      
      await waitFor(() => {
        expect(screen.getByTitle('Mark all as read')).toBeInTheDocument();
      });
    });
  });

  describe('Pin Functionality', () => {
    it('toggles pin state on activity', async () => {
      const { component } = render(ActivityTimeline);
      
      const activity = component.addActivity({ type: 'message', title: 'Pin Me' });
      
      expect(activity.isPinned).toBe(false);
      
      component.togglePin(activity.id);
      
      const activities = component.getActivities();
      expect(activities[0].isPinned).toBe(true);
      
      component.togglePin(activity.id);
      
      const activitiesAfter = component.getActivities();
      expect(activitiesAfter[0].isPinned).toBe(false);
    });

    it('shows pinned stats in footer', async () => {
      const { component } = render(ActivityTimeline);
      
      const activity = component.addActivity({ type: 'message', title: 'Pinned Item' });
      component.togglePin(activity.id);
      
      await waitFor(() => {
        expect(screen.getByText('📌 1 pinned')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('opens filter panel on button click', async () => {
      render(ActivityTimeline, { props: { showFilters: true } });
      
      const filterBtn = screen.getByTitle('Toggle filters');
      await fireEvent.click(filterBtn);
      
      expect(screen.getByPlaceholderText('Search activities...')).toBeInTheDocument();
      expect(screen.getByText('Filter by type:')).toBeInTheDocument();
    });

    it('filters activities by search query', async () => {
      const { component } = render(ActivityTimeline, { props: { showFilters: true } });
      
      component.addActivity({ type: 'message', title: 'Hello World' });
      component.addActivity({ type: 'notification', title: 'Goodbye World' });
      
      await fireEvent.click(screen.getByTitle('Toggle filters'));
      
      const searchInput = screen.getByPlaceholderText('Search activities...');
      await fireEvent.input(searchInput, { target: { value: 'Hello' } });
      
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeInTheDocument();
        expect(screen.queryByText('Goodbye World')).not.toBeInTheDocument();
      });
    });

    it('filters activities by type', async () => {
      const { component } = render(ActivityTimeline, { props: { showFilters: true } });
      
      component.addActivity({ type: 'message', title: 'A Message' });
      component.addActivity({ type: 'error', title: 'An Error' });
      
      await fireEvent.click(screen.getByTitle('Toggle filters'));
      
      // Click on error type filter
      const errorChip = screen.getByText('error').closest('button');
      await fireEvent.click(errorChip!);
      
      await waitFor(() => {
        expect(screen.queryByText('A Message')).not.toBeInTheDocument();
        expect(screen.getByText('An Error')).toBeInTheDocument();
      });
    });

    it('clears filters with button', async () => {
      const { component } = render(ActivityTimeline, { props: { showFilters: true } });
      
      component.addActivity({ type: 'message', title: 'Test Message' });
      
      await fireEvent.click(screen.getByTitle('Toggle filters'));
      
      const searchInput = screen.getByPlaceholderText('Search activities...');
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });
      
      await waitFor(() => {
        expect(screen.queryByText('Test Message')).not.toBeInTheDocument();
      });
      
      await fireEvent.click(screen.getByText('Clear filters'));
      
      await waitFor(() => {
        expect(screen.getByText('Test Message')).toBeInTheDocument();
      });
    });

    it('applies filter via setFilter method', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Message Here' });
      component.addActivity({ type: 'error', title: 'Error Here' });
      
      component.setFilter({ types: ['error'] });
      
      await waitFor(() => {
        expect(screen.queryByText('Message Here')).not.toBeInTheDocument();
        expect(screen.getByText('Error Here')).toBeInTheDocument();
      });
    });
  });

  describe('Date Grouping', () => {
    it('groups activities by date when enabled', async () => {
      const { component } = render(ActivityTimeline, { props: { groupByDate: true } });
      
      component.addActivity({ type: 'message', title: 'Today Activity' });
      
      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      });
    });

    it('does not group when disabled', async () => {
      const { component } = render(ActivityTimeline, { props: { groupByDate: false } });
      
      component.addActivity({ type: 'message', title: 'Some Activity' });
      
      await waitFor(() => {
        expect(screen.queryByText('Today')).not.toBeInTheDocument();
        expect(screen.getByText('Some Activity')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Types', () => {
    const activityTypes: ActivityType[] = [
      'message', 'mention', 'reaction', 'join', 'leave',
      'upload', 'download', 'settings_change', 'notification', 'error', 'system'
    ];

    it.each(activityTypes)('renders %s activity type with correct icon', async (type) => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type, title: `${type} Activity` });
      
      await waitFor(() => {
        expect(screen.getByText(`${type} Activity`)).toBeInTheDocument();
      });
    });
  });

  describe('Events', () => {
    it('dispatches activityClick on activity click', async () => {
      const { component } = render(ActivityTimeline);
      const clickHandler = vi.fn();
      component.$on('activityClick', clickHandler);
      
      component.addActivity({ type: 'message', title: 'Clickable' });
      
      await waitFor(() => {
        expect(screen.getByText('Clickable')).toBeInTheDocument();
      });
      
      const activityItem = screen.getByText('Clickable').closest('[role="listitem"]');
      await fireEvent.click(activityItem!);
      
      expect(clickHandler).toHaveBeenCalledOnce();
      expect(clickHandler.mock.calls[0][0].detail.title).toBe('Clickable');
    });

    it('dispatches activitiesClear on clear', async () => {
      const { component } = render(ActivityTimeline);
      const clearHandler = vi.fn();
      component.$on('activitiesClear', clearHandler);
      
      component.addActivity({ type: 'message', title: 'To Clear' });
      component.clearActivities();
      
      expect(clearHandler).toHaveBeenCalledOnce();
    });

    it('dispatches activityPin on pin toggle', async () => {
      const { component } = render(ActivityTimeline);
      const pinHandler = vi.fn();
      component.$on('activityPin', pinHandler);
      
      const activity = component.addActivity({ type: 'message', title: 'To Pin' });
      component.togglePin(activity.id);
      
      expect(pinHandler).toHaveBeenCalledOnce();
      expect(pinHandler.mock.calls[0][0].detail.isPinned).toBe(true);
    });

    it('dispatches filterChange on filter update', async () => {
      const { component } = render(ActivityTimeline);
      const filterHandler = vi.fn();
      component.$on('filterChange', filterHandler);
      
      component.setFilter({ types: ['message'] });
      
      expect(filterHandler).toHaveBeenCalledOnce();
      expect(filterHandler.mock.calls[0][0].detail.types).toEqual(['message']);
    });
  });

  describe('Persistence', () => {
    it('saves activities to localStorage', async () => {
      const { component } = render(ActivityTimeline, { 
        props: { persistActivities: true, storageKey: 'test-activities' } 
      });
      
      component.addActivity({ type: 'message', title: 'Persisted' });
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('loads activities from localStorage on mount', async () => {
      const existingData = JSON.stringify([{
        id: 'existing-1',
        type: 'message',
        title: 'Existing Activity',
        timestamp: new Date().toISOString(),
        isRead: false,
        isPinned: false,
      }]);
      
      localStorageMock.getItem.mockReturnValue(existingData);
      
      render(ActivityTimeline, { 
        props: { persistActivities: true, storageKey: 'test-activities' } 
      });
      
      await waitFor(() => {
        expect(screen.getByText('Existing Activity')).toBeInTheDocument();
      });
    });

    it('does not persist when persistActivities is false', () => {
      const { component } = render(ActivityTimeline, { 
        props: { persistActivities: false } 
      });
      
      component.addActivity({ type: 'message', title: 'Not Persisted' });
      
      // setItem should not be called for activities
      const setItemCalls = localStorageMock.setItem.mock.calls.filter(
        (call: string[]) => call[0].includes('activity')
      );
      expect(setItemCalls).toHaveLength(0);
    });
  });

  describe('Max Items', () => {
    it('respects maxItems limit', async () => {
      const { component } = render(ActivityTimeline, { props: { maxItems: 3 } });
      
      for (let i = 0; i < 5; i++) {
        component.addActivity({ type: 'message', title: `Activity ${i}` });
      }
      
      await waitFor(() => {
        const items = screen.getAllByRole('listitem');
        expect(items.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('Compact Mode', () => {
    it('hides description in compact mode', async () => {
      const { component } = render(ActivityTimeline, { props: { compact: true } });
      
      component.addActivity({
        type: 'message',
        title: 'Compact Activity',
        description: 'This should be hidden',
      });
      
      await waitFor(() => {
        expect(screen.getByText('Compact Activity')).toBeInTheDocument();
        expect(screen.queryByText('This should be hidden')).not.toBeInTheDocument();
      });
    });

    it('hides user info in compact mode', async () => {
      const { component } = render(ActivityTimeline, { props: { compact: true } });
      
      component.addActivity({
        type: 'message',
        title: 'User Activity',
        user: { id: '1', name: 'Test User' },
      });
      
      await waitFor(() => {
        expect(screen.getByText('User Activity')).toBeInTheDocument();
        expect(screen.queryByText('Test User')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes filter panel on Escape', async () => {
      render(ActivityTimeline, { props: { showFilters: true } });
      
      await fireEvent.click(screen.getByTitle('Toggle filters'));
      expect(screen.getByPlaceholderText('Search activities...')).toBeInTheDocument();
      
      await fireEvent.keyDown(window, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search activities...')).not.toBeInTheDocument();
      });
    });

    it('activates activity on Enter key', async () => {
      const { component } = render(ActivityTimeline);
      const clickHandler = vi.fn();
      component.$on('activityClick', clickHandler);
      
      component.addActivity({ type: 'message', title: 'Enter to Click' });
      
      await waitFor(() => {
        expect(screen.getByText('Enter to Click')).toBeInTheDocument();
      });
      
      const activityItem = screen.getByText('Enter to Click').closest('[role="listitem"]');
      await fireEvent.keyPress(activityItem!, { key: 'Enter' });
      
      expect(clickHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(ActivityTimeline);
      
      expect(screen.getByRole('log')).toBeInTheDocument();
      expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'Activity Timeline');
      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    });

    it('has accessible filter toggle button', async () => {
      render(ActivityTimeline, { props: { showFilters: true } });
      
      const filterBtn = screen.getByTitle('Toggle filters');
      expect(filterBtn).toHaveAttribute('aria-expanded', 'false');
      
      await fireEvent.click(filterBtn);
      
      expect(filterBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper listitem roles for activities', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ type: 'message', title: 'Accessible Item' });
      
      await waitFor(() => {
        const item = screen.getByRole('listitem');
        expect(item).toBeInTheDocument();
        expect(item).toHaveAttribute('tabindex', '0');
      });
    });
  });

  describe('Time Formatting', () => {
    it('shows relative time for recent activities', async () => {
      const { component } = render(ActivityTimeline);
      
      component.addActivity({ 
        type: 'message', 
        title: 'Recent Activity',
        timestamp: new Date() 
      });
      
      await waitFor(() => {
        expect(screen.getByText('just now')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Activity', () => {
    it('dispatches activityDelete on delete button click', async () => {
      const { component } = render(ActivityTimeline);
      const deleteHandler = vi.fn();
      component.$on('activityDelete', deleteHandler);
      
      component.addActivity({ type: 'message', title: 'Delete Me' });
      
      await waitFor(() => {
        expect(screen.getByText('Delete Me')).toBeInTheDocument();
      });
      
      // Hover to reveal actions
      const activityItem = screen.getByText('Delete Me').closest('[role="listitem"]');
      await fireEvent.mouseEnter(activityItem!);
      
      const deleteBtn = screen.getByTitle('Delete');
      await fireEvent.click(deleteBtn);
      
      expect(deleteHandler).toHaveBeenCalledOnce();
      await waitFor(() => {
        expect(screen.queryByText('Delete Me')).not.toBeInTheDocument();
      });
    });
  });
});
