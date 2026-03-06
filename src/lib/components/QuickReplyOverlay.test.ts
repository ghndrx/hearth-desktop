import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import QuickReplyOverlay from './QuickReplyOverlay.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn())
}));

// Mock the store
const mockSubscribe = (initial: any) => {
  return (cb: (val: any) => void) => {
    cb(initial);
    return () => {};
  };
};

vi.mock('$lib/stores/quickReply', () => {
  let isOpen = false;
  let context: any = null;

  return {
    quickReply: {
      isQuickReplyOpen: {
        subscribe: (cb: (val: boolean) => void) => {
          cb(isOpen);
          return () => {};
        }
      },
      quickReplyContext: {
        subscribe: (cb: (val: any) => void) => {
          cb(context);
          return () => {};
        }
      },
      init: vi.fn(),
      cleanup: vi.fn(),
      openQuickReply: vi.fn((ctx: any) => {
        isOpen = true;
        context = ctx;
      }),
      closeQuickReply: vi.fn(() => {
        isOpen = false;
        context = null;
      }),
      sendQuickReply: vi.fn().mockResolvedValue(undefined)
    }
  };
});

describe('QuickReplyOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when not open', () => {
    const { container } = render(QuickReplyOverlay);
    expect(container.querySelector('.quickreply-overlay')).toBeNull();
  });

  it('initializes the quick reply store on mount', async () => {
    const { quickReply } = await import('$lib/stores/quickReply');
    render(QuickReplyOverlay);
    expect(quickReply.init).toHaveBeenCalled();
  });

  it('cleans up the quick reply store on destroy', async () => {
    const { quickReply } = await import('$lib/stores/quickReply');
    const { unmount } = render(QuickReplyOverlay);
    unmount();
    expect(quickReply.cleanup).toHaveBeenCalled();
  });

  it('shows overlay when store is open with context', async () => {
    // Re-mock with open state
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: 'Hello, how are you?',
      serverName: 'Test Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      expect(screen.getByText('Quick Reply')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
      expect(screen.getByText('Test Server')).toBeInTheDocument();
      expect(screen.getByText('#general')).toBeInTheDocument();
    });
  });

  it('has a textarea for typing replies', async () => {
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: 'Hello',
      serverName: 'Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Type your reply...');
      expect(textarea).toBeInTheDocument();
    });
  });

  it('has a send button that is disabled when input is empty', async () => {
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: 'Hello',
      serverName: 'Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      const sendButton = screen.getByText('Send');
      expect(sendButton).toBeDisabled();
    });
  });

  it('shows close button with Esc title', async () => {
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: 'Hello',
      serverName: 'Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      const closeBtn = screen.getByTitle('Close (Esc)');
      expect(closeBtn).toBeInTheDocument();
    });
  });

  it('truncates long message content', async () => {
    const longContent = 'A'.repeat(150);
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: longContent,
      serverName: 'Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      const truncated = screen.getByText('A'.repeat(120) + '...');
      expect(truncated).toBeInTheDocument();
    });
  });

  it('shows keyboard shortcut hints', async () => {
    const mockContext = {
      channelId: 'ch1',
      channelName: 'general',
      messageId: 'msg1',
      messageAuthor: 'Alice',
      messageContent: 'Hello',
      serverName: 'Server'
    };

    const { quickReply } = await import('$lib/stores/quickReply');
    (quickReply.isQuickReplyOpen as any).subscribe = (cb: (val: boolean) => void) => {
      cb(true);
      return () => {};
    };
    (quickReply.quickReplyContext as any).subscribe = (cb: (val: any) => void) => {
      cb(mockContext);
      return () => {};
    };

    render(QuickReplyOverlay);

    await waitFor(() => {
      expect(screen.getByText('Enter to send, Shift+Enter for new line, Esc to close')).toBeInTheDocument();
    });
  });
});
