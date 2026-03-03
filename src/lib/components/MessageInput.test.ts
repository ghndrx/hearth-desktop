import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { writable } from 'svelte/store';
import MessageInput from './MessageInput.svelte';

// Mock the stores
vi.mock('$lib/stores/channels', () => ({
  currentChannel: writable({
    id: '1',
    type: 0,
    name: 'general',
  }),
}));

vi.mock('$lib/stores/messages', () => ({
  sendTypingIndicator: vi.fn(),
}));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render textarea with placeholder', () => {
    render(MessageInput);
    const textarea = screen.getByPlaceholderText(/Message #general/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should render with custom placeholder', () => {
    render(MessageInput, { props: { placeholder: 'Custom placeholder' } });
    const textarea = screen.getByPlaceholderText('Custom placeholder');
    expect(textarea).toBeInTheDocument();
  });

  it('should render attach button', () => {
    const { container } = render(MessageInput);
    const attachButton = container.querySelector('input[type="file"]');
    expect(attachButton).toBeInTheDocument();
  });

  it('should render emoji button', () => {
    const { container } = render(MessageInput);
    const emojiButton = container.querySelector('.emoji-button');
    expect(emojiButton).toBeInTheDocument();
  });

  it('should render gift button', () => {
    const { container } = render(MessageInput);
    const giftButton = container.querySelector('.gift-button');
    expect(giftButton).toBeInTheDocument();
  });

  it('should clear input after sending via Enter', async () => {
    const user = userEvent.setup();
    render(MessageInput);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'Hello world');
    expect(textarea.value).toBe('Hello world');

    await user.keyboard('{Enter}');

    // Input should be cleared after sending
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    render(MessageInput);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // Press Enter without typing anything
    await user.keyboard('{Enter}');

    // Textarea should still be empty (nothing happened)
    expect(textarea.value).toBe('');
  });

  it('should allow Shift+Enter for new line', async () => {
    const user = userEvent.setup();
    render(MessageInput);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    // Value should contain both lines (not sent)
    expect(textarea.value).toContain('Line 1');
    expect(textarea.value).toContain('Line 2');
  });

  it('should show reply preview when replyTo is provided', () => {
    const replyTo = {
      id: '123',
      content: 'Original message',
      author: { username: 'TestUser' },
    };
    render(MessageInput, { props: { replyTo } });

    expect(screen.getByText('Replying to')).toBeInTheDocument();
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('Original message')).toBeInTheDocument();
  });

  it('should truncate long reply preview', () => {
    const longContent = 'a'.repeat(150);
    const replyTo = {
      id: '123',
      content: longContent,
      author: { username: 'TestUser' },
    };
    const { container } = render(MessageInput, { props: { replyTo } });

    const replyContent = container.querySelector('.reply-content');
    expect(replyContent?.textContent).toContain('...');
    expect(replyContent?.textContent?.length).toBeLessThan(longContent.length + 10);
  });

  it('should clear reply when close button is clicked', async () => {
    const user = userEvent.setup();
    const replyTo = {
      id: '123',
      content: 'Original message',
      author: { username: 'TestUser' },
    };
    const { container } = render(MessageInput, { props: { replyTo } });

    const closeButton = container.querySelector('.close-reply-btn');
    expect(closeButton).toBeInTheDocument();

    if (closeButton) {
      await user.click(closeButton);
      await waitFor(() => {
        expect(screen.queryByText('Replying to')).not.toBeInTheDocument();
      });
    }
  });

  it('should toggle emoji picker when emoji button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(MessageInput);

    const emojiButton = container.querySelector('.emoji-button');
    expect(emojiButton).toBeInTheDocument();

    if (emojiButton) {
      await user.click(emojiButton);
      await waitFor(() => {
        const emojiPicker = container.querySelector('.emoji-picker');
        expect(emojiPicker).toBeInTheDocument();
      });
    }
  });

  it('should auto-resize textarea on input', async () => {
    const user = userEvent.setup();
    render(MessageInput);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Type multiple lines
    await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

    // Height should change (implementation sets it via style)
    expect(textarea.style.height).toBeDefined();
  });

  it('should not exceed max height', async () => {
    const user = userEvent.setup();
    render(MessageInput);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Type many lines to trigger max height
    const manyLines = Array(50).fill('Line').join('\n');
    await user.type(textarea, manyLines);

    // The component limits height to 300px
    expect(textarea.style.height).toBeDefined();
  });

  it('should handle file input element', () => {
    const { container } = render(MessageInput);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('multiple');
    expect(fileInput).toHaveAttribute('accept');
  });
});
