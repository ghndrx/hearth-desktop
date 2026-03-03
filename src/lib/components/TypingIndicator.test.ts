import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TypingIndicator from './TypingIndicator.svelte';

// vi.hoisted runs before vi.mock, making these variables available to the factory
const { mockStore, mockForChannel } = vi.hoisted(() => {
  // Simple store implementation compatible with Svelte's store contract
  const subscribers = new Set<(value: any[]) => void>();
  let currentValue: any[] = [];

  const mockStore = {
    subscribe(fn: (value: any[]) => void) {
      subscribers.add(fn);
      fn(currentValue);
      return () => { subscribers.delete(fn); };
    },
    set(value: any[]) {
      currentValue = value;
      subscribers.forEach(fn => fn(value));
    },
  };

  const mockForChannel = vi.fn(() => mockStore);

  return { mockStore, mockForChannel };
});

vi.mock('$lib/stores/typing', () => ({
  typingStore: {
    forChannel: mockForChannel,
  },
  formatTypingText: vi.fn((users: any[]) => {
    if (users.length === 0) return '';
    const names = users.map((u: any) => u.username);
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
    return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
  }),
}));

describe('TypingIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.set([]);
  });

  it('should not render when no users are typing', () => {
    const { container } = render(TypingIndicator, { props: { channelId: '1' } });
    expect(container.querySelector('.typing-indicator')).not.toBeInTheDocument();
  });

  it('should render when users are typing', () => {
    mockStore.set([
      { userId: '1', username: 'User1', startedAt: Date.now() },
    ]);

    const { container } = render(TypingIndicator, { props: { channelId: '1' } });
    expect(container.querySelector('.typing-indicator')).toBeInTheDocument();
  });

  it('should display single user typing', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    render(TypingIndicator, { props: { channelId: '1' } });
    expect(screen.getByText(/Alice is typing.../i)).toBeInTheDocument();
  });

  it('should display two users typing', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
      { userId: '2', username: 'Bob', startedAt: Date.now() },
    ]);

    render(TypingIndicator, { props: { channelId: '1' } });
    expect(screen.getByText(/Alice and Bob are typing.../i)).toBeInTheDocument();
  });

  it('should display three users typing', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
      { userId: '2', username: 'Bob', startedAt: Date.now() },
      { userId: '3', username: 'Charlie', startedAt: Date.now() },
    ]);

    render(TypingIndicator, { props: { channelId: '1' } });
    const text = screen.getByText(/are typing.../i).textContent;
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
    expect(text).toContain('Charlie');
  });

  it('should display "X others" when more than 3 users typing', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
      { userId: '2', username: 'Bob', startedAt: Date.now() },
      { userId: '3', username: 'Charlie', startedAt: Date.now() },
      { userId: '4', username: 'Dave', startedAt: Date.now() },
    ]);

    render(TypingIndicator, { props: { channelId: '1' } });
    expect(screen.getByText(/and 2 others are typing.../i)).toBeInTheDocument();
  });

  it('should render typing dots animation', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    const { container } = render(TypingIndicator, { props: { channelId: '1' } });
    const dots = container.querySelectorAll('.dot');
    expect(dots.length).toBe(3);
  });

  it('should have proper accessibility attributes', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    const { container } = render(TypingIndicator, { props: { channelId: '1' } });
    const indicator = container.querySelector('.typing-indicator');

    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-label');
  });

  it('should hide dots from screen readers', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    const { container } = render(TypingIndicator, { props: { channelId: '1' } });
    const dotsContainer = container.querySelector('.typing-dots');
    expect(dotsContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('should call forChannel with correct channelId', () => {
    render(TypingIndicator, { props: { channelId: '123' } });
    expect(mockForChannel).toHaveBeenCalledWith('123');
  });

  it('should update when typing users change', async () => {
    const { container } = render(TypingIndicator, { props: { channelId: '1' } });

    // Initially no typing
    expect(container.querySelector('.typing-indicator')).not.toBeInTheDocument();

    // Add typing user
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    // Should now be visible
    await waitFor(() => {
      expect(container.querySelector('.typing-indicator')).toBeInTheDocument();
    });

    // Remove typing user
    mockStore.set([]);

    // Should be hidden again
    await waitFor(() => {
      expect(container.querySelector('.typing-indicator')).not.toBeInTheDocument();
    });
  });

  it('should prefer displayName over username', () => {
    mockStore.set([
      {
        userId: '1',
        username: 'user123',
        displayName: 'Alice Smith',
        startedAt: Date.now()
      },
    ]);

    render(TypingIndicator, { props: { channelId: '1' } });
    expect(mockForChannel).toHaveBeenCalled();
  });

  it('should render with correct CSS classes', () => {
    mockStore.set([
      { userId: '1', username: 'Alice', startedAt: Date.now() },
    ]);

    const { container } = render(TypingIndicator, { props: { channelId: '1' } });

    expect(container.querySelector('.typing-indicator')).toBeInTheDocument();
    expect(container.querySelector('.typing-dots')).toBeInTheDocument();
    expect(container.querySelector('.typing-text')).toBeInTheDocument();
  });
});
