import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MessageReminderManager from './MessageReminderManager.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue('granted'),
}));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('MessageReminderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders when open', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test message content',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'TestUser',
      },
    });

    expect(screen.getByText('⏰ Message Reminders')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: false,
        messageId: 'msg-1',
        messageContent: 'Test message',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'TestUser',
      },
    });

    expect(screen.queryByText('⏰ Message Reminders')).not.toBeInTheDocument();
  });

  it('displays message preview when message content provided', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Important discussion about project',
        channelId: 'channel-1',
        channelName: 'dev-chat',
        authorName: 'Alice',
      },
    });

    expect(screen.getByText('Important discussion about project')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('#dev-chat')).toBeInTheDocument();
  });

  it('shows quick time options', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    expect(screen.getByText('In 20 min')).toBeInTheDocument();
    expect(screen.getByText('In 1 hour')).toBeInTheDocument();
    expect(screen.getByText('In 3 hours')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow 9 AM')).toBeInTheDocument();
    expect(screen.getByText('Custom...')).toBeInTheDocument();
  });

  it('allows selecting a quick time option', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    const quickTimeBtn = screen.getByText('In 1 hour');
    await fireEvent.click(quickTimeBtn);

    expect(quickTimeBtn.closest('button')).toHaveClass('selected');
  });

  it('enables create button when quick time selected', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    const createBtn = screen.getByText('⏰ Set Reminder');
    expect(createBtn).toBeDisabled();

    await fireEvent.click(screen.getByText('In 20 min'));
    expect(createBtn).not.toBeDisabled();
  });

  it('shows tab navigation', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    expect(screen.getByRole('tab', { name: /Create/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Active/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /History/i })).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    const activeTab = screen.getByRole('tab', { name: /Active/i });
    await fireEvent.click(activeTab);

    expect(screen.getByText('No active reminders')).toBeInTheDocument();
  });

  it('shows empty state in list tab', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Active/i }));

    expect(screen.getByText('No active reminders')).toBeInTheDocument();
    expect(screen.getByText('Create one')).toBeInTheDocument();
  });

  it('shows recurring options', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    const recurringSelect = screen.getByLabelText('Recurring');
    expect(recurringSelect).toBeInTheDocument();
    expect(screen.getByText('One-time')).toBeInTheDocument();
  });

  it('allows adding a note', () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    const noteInput = screen.getByPlaceholderText('Why do you need to remember this?');
    expect(noteInput).toBeInTheDocument();
  });

  it('creates a reminder when clicking Set Reminder', async () => {
    const { component } = render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Remember this!',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    let eventFired = false;
    component.$on('reminderCreated', () => {
      eventFired = true;
    });

    await fireEvent.click(screen.getByText('In 1 hour'));
    await fireEvent.click(screen.getByText('⏰ Set Reminder'));

    expect(eventFired).toBe(true);
  });

  it('closes when clicking close button', async () => {
    const { component } = render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    let closed = false;
    component.$on('close', () => {
      closed = true;
    });

    await fireEvent.click(screen.getByLabelText('Close'));

    expect(closed).toBe(true);
  });

  it('shows custom datetime input when Custom selected', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    await fireEvent.click(screen.getByText('Custom...'));

    expect(screen.getByLabelText('Custom date & time')).toBeInTheDocument();
  });

  it('shows history tab with empty state', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    await fireEvent.click(screen.getByRole('tab', { name: /History/i }));

    expect(screen.getByText('No reminder history')).toBeInTheDocument();
  });

  it('has search input in list tab', async () => {
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: 'Test',
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Active/i }));

    expect(screen.getByPlaceholderText('Search reminders...')).toBeInTheDocument();
  });

  it('loads reminders from localStorage on mount', async () => {
    const mockReminders = [
      {
        id: 'rem-1',
        messageId: 'msg-1',
        messageContent: 'Test message',
        channelId: 'ch-1',
        channelName: 'general',
        authorName: 'Bob',
        reminderTime: Date.now() + 60000,
        createdAt: Date.now(),
        status: 'pending',
        snoozedCount: 0,
      },
    ];
    localStorageMock.setItem('hearth_message_reminders', JSON.stringify(mockReminders));

    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-2',
        messageContent: 'New message',
        channelId: 'ch-1',
        channelName: 'general',
        authorName: 'Alice',
      },
    });

    await fireEvent.click(screen.getByRole('tab', { name: /Active/i }));

    // Should show the loaded reminder
    expect(screen.getByText(/Test message/)).toBeInTheDocument();
  });

  it('truncates long message content in preview', () => {
    const longMessage = 'A'.repeat(250);
    render(MessageReminderManager, {
      props: {
        isOpen: true,
        messageId: 'msg-1',
        messageContent: longMessage,
        channelId: 'channel-1',
        channelName: 'general',
        authorName: 'User',
      },
    });

    // Should truncate at 200 chars with ellipsis
    const truncated = 'A'.repeat(200) + '...';
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });
});
