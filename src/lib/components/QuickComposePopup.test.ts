import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import QuickComposePopup from './QuickComposePopup.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setFocus: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    currentMonitor: vi.fn().mockResolvedValue({ size: { width: 1920, height: 1080 } })
  })),
  Window: vi.fn()
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined)
}));

const mockChannels = [
  { id: 'ch1', name: 'general', serverName: 'Test Server' },
  { id: 'ch2', name: 'random', serverName: 'Test Server' },
  { id: 'ch3', name: 'development', serverName: 'Work' },
  { id: 'ch4', name: 'announcements', serverName: 'Test Server' },
  { id: 'ch5', name: 'support', serverName: 'Work' }
];

describe('QuickComposePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('should not render when isOpen is false', () => {
      render(QuickComposePopup, {
        isOpen: false,
        recentChannels: mockChannels
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display placeholder text', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        placeholder: 'Type a quick message...'
      });

      expect(screen.getByPlaceholderText('Type a quick message...')).toBeInTheDocument();
    });
  });

  describe('channel selection', () => {
    it('should display the first channel by default', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      expect(screen.getByText('#general')).toBeInTheDocument();
    });

    it('should use defaultChannelId when provided', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        defaultChannelId: 'ch3'
      });

      expect(screen.getByText('#development')).toBeInTheDocument();
    });

    it('should open channel dropdown on button click', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const channelButton = screen.getByRole('button', { name: /💬/ });
      await fireEvent.click(channelButton);

      expect(screen.getByPlaceholderText('Search channels...')).toBeInTheDocument();
    });

    it('should filter channels when searching', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const channelButton = screen.getByRole('button', { name: /💬/ });
      await fireEvent.click(channelButton);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await fireEvent.input(searchInput, { target: { value: 'dev' } });

      await waitFor(() => {
        expect(screen.getByText('development')).toBeInTheDocument();
        expect(screen.queryByText('random')).not.toBeInTheDocument();
      });
    });

    it('should show no channels message when filter returns empty', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const channelButton = screen.getByRole('button', { name: /💬/ });
      await fireEvent.click(channelButton);

      const searchInput = screen.getByPlaceholderText('Search channels...');
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No channels found')).toBeInTheDocument();
      });
    });

    it('should select channel and close dropdown', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const channelChangeHandler = vi.fn();
      component.$on('channelChange', channelChangeHandler);

      const channelButton = screen.getByRole('button', { name: /💬/ });
      await fireEvent.click(channelButton);

      const randomOption = screen.getByRole('option', { name: /#random/ });
      await fireEvent.click(randomOption);

      expect(channelChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { channelId: 'ch2' }
        })
      );
    });
  });

  describe('message input', () => {
    it('should allow typing messages', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Hello world!' } });

      expect(textarea).toHaveValue('Hello world!');
    });

    it('should show character count', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        maxLength: 100
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Test message' } });

      expect(screen.getByText('12/100')).toBeInTheDocument();
    });

    it('should show error state when over character limit', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        maxLength: 10
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'This is too long' } });

      const charCount = screen.getByText('16/10');
      expect(charCount).toHaveClass('error');
    });

    it('should disable send button when empty', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button with valid message', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Hello!' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('sending messages', () => {
    it('should emit send event on button click', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const sendHandler = vi.fn();
      component.$on('send', sendHandler);

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Test message' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      await fireEvent.click(sendButton);

      expect(sendHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            channelId: 'ch1',
            message: 'Test message',
            attachments: []
          }
        })
      );
    });

    it('should send on Enter when sendOnEnter is true', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        sendOnEnter: true
      });

      const sendHandler = vi.fn();
      component.$on('send', sendHandler);

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Test' } });
      await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(sendHandler).toHaveBeenCalled();
    });

    it('should not send on Shift+Enter', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        sendOnEnter: true
      });

      const sendHandler = vi.fn();
      component.$on('send', sendHandler);

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Test' } });
      await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(sendHandler).not.toHaveBeenCalled();
    });

    it('should clear message after send', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        closeOnSend: false
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Test message' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      await fireEvent.click(sendButton);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  describe('closing', () => {
    it('should emit close event on close button click', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);

      expect(closeHandler).toHaveBeenCalled();
    });

    it('should close on overlay click', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      const overlay = screen.getByRole('dialog');
      await fireEvent.click(overlay);

      expect(closeHandler).toHaveBeenCalled();
    });

    it('should close on Escape when closeOnEscape is true', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        closeOnEscape: true
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      await fireEvent.keyDown(document, { key: 'Escape' });

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('emoji picker', () => {
    it('should show emoji picker on button click', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        enableEmoji: true
      });

      const emojiButton = screen.getByRole('button', { name: /insert emoji/i });
      await fireEvent.click(emojiButton);

      // Quick emoji picker should be visible
      expect(screen.getByRole('button', { name: /insert 👍/i })).toBeInTheDocument();
    });

    it('should insert emoji into message', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        enableEmoji: true
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.input(textarea, { target: { value: 'Hello ' } });

      const emojiButton = screen.getByRole('button', { name: /insert emoji/i });
      await fireEvent.click(emojiButton);

      const thumbsUp = screen.getByRole('button', { name: /insert 👍/i });
      await fireEvent.click(thumbsUp);

      expect(textarea).toHaveValue('Hello 👍');
    });
  });

  describe('attachments', () => {
    it('should show attachment when file is dropped', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const popup = screen.getByRole('dialog').querySelector('.quick-compose-popup');
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'text/plain', getAsFile: () => file }],
        types: ['Files']
      };

      await fireEvent.drop(popup!, { dataTransfer });

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });
    });

    it('should remove attachment on click', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const popup = screen.getByRole('dialog').querySelector('.quick-compose-popup');
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      await fireEvent.drop(popup!, {
        dataTransfer: { files: [file] }
      });

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove test.txt/i });
      await fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
      });
    });

    it('should show drag overlay when dragging files', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const popup = screen.getByRole('dialog').querySelector('.quick-compose-popup');
      
      await fireEvent.dragEnter(popup!, {
        dataTransfer: { types: ['Files'] }
      });

      expect(screen.getByText('Drop files to attach')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('should toggle channel dropdown on Tab', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.keyDown(textarea, { key: 'Tab' });

      expect(screen.getByPlaceholderText('Search channels...')).toBeInTheDocument();
    });

    it('should cycle channels with Ctrl+Arrow keys', async () => {
      const { component } = render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const channelChangeHandler = vi.fn();
      component.$on('channelChange', channelChangeHandler);

      const textarea = screen.getByRole('textbox', { name: /message content/i });
      await fireEvent.keyDown(textarea, { key: 'ArrowDown', ctrlKey: true });

      expect(channelChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { channelId: 'ch2' }
        })
      );
    });

    it('should show keyboard hints', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      expect(screen.getByText('Tab: channels')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+↑↓: switch')).toBeInTheDocument();
      expect(screen.getByText('Esc: close')).toBeInTheDocument();
    });
  });

  describe('themes', () => {
    it('should apply dark theme class', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        theme: 'dark'
      });

      const overlay = screen.getByRole('dialog');
      expect(overlay).toHaveClass('dark');
    });
  });

  describe('send hints', () => {
    it('should show Enter to send hint when sendOnEnter is true', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        sendOnEnter: true
      });

      expect(screen.getByText('Enter to send')).toBeInTheDocument();
    });

    it('should show Ctrl+Enter hint when sendOnEnter is false', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        sendOnEnter: false
      });

      expect(screen.getByText('Ctrl+Enter to send')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Quick compose message');
    });

    it('should have accessible send button', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels
      });

      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  describe('maxRecentChannels', () => {
    it('should limit displayed channels', async () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        maxRecentChannels: 2
      });

      const channelButton = screen.getByRole('button', { name: /💬/ });
      await fireEvent.click(channelButton);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(2);
    });
  });

  describe('hidden channel selector', () => {
    it('should show static channel name when showChannelSelector is false', () => {
      render(QuickComposePopup, {
        isOpen: true,
        recentChannels: mockChannels,
        showChannelSelector: false
      });

      expect(screen.queryByRole('button', { name: /💬/ })).not.toBeInTheDocument();
      expect(screen.getByText('#general')).toBeInTheDocument();
    });
  });
});
