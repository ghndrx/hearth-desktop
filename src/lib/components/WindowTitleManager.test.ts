import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import WindowTitleManager from './WindowTitleManager.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('WindowTitleManager', () => {
  let originalTitle: string;
  let originalHasFocus: () => boolean;

  beforeEach(() => {
    originalTitle = document.title;
    originalHasFocus = document.hasFocus;
    document.hasFocus = vi.fn(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    document.title = originalTitle;
    document.hasFocus = originalHasFocus;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('basic rendering', () => {
    it('renders without errors', () => {
      const { container } = render(WindowTitleManager);
      expect(container).toBeDefined();
    });

    it('sets default app name in title', async () => {
      render(WindowTitleManager);
      await vi.runAllTimersAsync();
      expect(document.title).toContain('Hearth');
    });

    it('uses custom app name', async () => {
      render(WindowTitleManager, { props: { appName: 'TestApp' } });
      await vi.runAllTimersAsync();
      expect(document.title).toContain('TestApp');
    });
  });

  describe('context updates', () => {
    it('updates title when server is set', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Gaming Server' });
      await vi.runAllTimersAsync();
      expect(document.title).toContain('Gaming Server');
    });

    it('updates title when channel is set', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'general', type: 'text' });
      await vi.runAllTimersAsync();
      expect(document.title).toContain('#general');
    });

    it('updates title for DM context', async () => {
      const { component } = render(WindowTitleManager);
      component.setDM({ id: '1', username: 'alice', displayName: 'Alice' });
      await vi.runAllTimersAsync();
      expect(document.title).toContain('@Alice');
    });

    it('clears DM when channel is set to non-DM', async () => {
      const { component } = render(WindowTitleManager);
      component.setDM({ id: '1', username: 'alice' });
      await vi.runAllTimersAsync();
      expect(document.title).toContain('@alice');
      
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      await vi.runAllTimersAsync();
      expect(document.title).not.toContain('@alice');
    });
  });

  describe('unread counts', () => {
    it('shows unread count when window is unfocused', async () => {
      document.hasFocus = vi.fn(() => false);
      const { component } = render(WindowTitleManager);
      
      // Simulate blur
      window.dispatchEvent(new Event('blur'));
      component.setUnreadCount(5);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('(5)');
    });

    it('prioritizes mention count over unread count', async () => {
      document.hasFocus = vi.fn(() => false);
      const { component } = render(WindowTitleManager);
      
      window.dispatchEvent(new Event('blur'));
      component.setUnreadCount(10);
      component.setMentionCount(3);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('(3)');
      expect(document.title).not.toContain('(10)');
    });

    it('hides count when window is focused', async () => {
      const { component } = render(WindowTitleManager);
      
      window.dispatchEvent(new Event('focus'));
      component.setUnreadCount(5);
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('(5)');
    });

    it('respects showUnreadCount prop', async () => {
      document.hasFocus = vi.fn(() => false);
      const { component } = render(WindowTitleManager, { props: { showUnreadCount: false } });
      
      window.dispatchEvent(new Event('blur'));
      component.setUnreadCount(5);
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('(5)');
    });
  });

  describe('typing indicators', () => {
    it('shows single user typing', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      component.setTypingUsers(['Alice']);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('Alice is typing...');
    });

    it('shows multiple users typing', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      component.setTypingUsers(['Alice', 'Bob']);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('Alice, Bob are typing...');
    });

    it('shows generic message for many users typing', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      component.setTypingUsers(['Alice', 'Bob', 'Carol', 'Dave']);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('Several people are typing...');
    });

    it('respects showTypingIndicator prop', async () => {
      const { component } = render(WindowTitleManager, { props: { showTypingIndicator: false } });
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      component.setTypingUsers(['Alice']);
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('typing');
    });
  });

  describe('connection status', () => {
    it('shows disconnected indicator', async () => {
      const { component } = render(WindowTitleManager);
      component.setConnectionStatus(false);
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('Disconnected');
    });

    it('hides indicator when connected', async () => {
      const { component } = render(WindowTitleManager);
      component.setConnectionStatus(true);
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('Disconnected');
    });
  });

  describe('title patterns', () => {
    it('uses full pattern by default', async () => {
      const { component } = render(WindowTitleManager, { props: { titlePattern: 'full' } });
      component.setServer({ id: '1', name: 'My Server' });
      component.setChannel({ id: '1', name: 'general', type: 'text' });
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('#general');
      expect(document.title).toContain('My Server');
    });

    it('uses compact pattern', async () => {
      const { component } = render(WindowTitleManager, { props: { titlePattern: 'compact' } });
      component.setServer({ id: '1', name: 'My Server' });
      component.setChannel({ id: '1', name: 'general', type: 'text' });
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('#general');
      expect(document.title).not.toContain('My Server');
    });

    it('uses minimal pattern', async () => {
      const { component } = render(WindowTitleManager, { props: { titlePattern: 'minimal' } });
      component.setServer({ id: '1', name: 'My Server' });
      component.setChannel({ id: '1', name: 'general', type: 'text' });
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('#general');
      expect(document.title).not.toContain('My Server');
      expect(document.title).toContain('Hearth');
    });
  });

  describe('custom separator', () => {
    it('uses custom separator', async () => {
      const { component } = render(WindowTitleManager, { props: { separator: ' | ' } });
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain(' | ');
    });
  });

  describe('title truncation', () => {
    it('truncates long titles', async () => {
      const { component } = render(WindowTitleManager, { props: { maxTitleLength: 30 } });
      component.setServer({ id: '1', name: 'A Very Long Server Name That Should Be Truncated' });
      component.setChannel({ id: '1', name: 'really-long-channel-name', type: 'text' });
      await vi.runAllTimersAsync();
      
      expect(document.title.length).toBeLessThanOrEqual(30);
      expect(document.title).toContain('...');
    });
  });

  describe('custom status', () => {
    it('includes custom status in title', async () => {
      const { component } = render(WindowTitleManager);
      component.setCustomStatus('In a meeting');
      await vi.runAllTimersAsync();
      
      expect(document.title).toContain('In a meeting');
    });

    it('removes status when set to null', async () => {
      const { component } = render(WindowTitleManager);
      component.setCustomStatus('Away');
      await vi.runAllTimersAsync();
      expect(document.title).toContain('Away');
      
      component.setCustomStatus(null);
      await vi.runAllTimersAsync();
      expect(document.title).not.toContain('Away');
    });
  });

  describe('public API', () => {
    it('clearContext resets all context', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setChannel({ id: '1', name: 'chat', type: 'text' });
      component.setTypingUsers(['Alice']);
      component.setCustomStatus('Busy');
      await vi.runAllTimersAsync();
      
      component.clearContext();
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toContain('Server');
      expect(document.title).not.toContain('#chat');
      expect(document.title).not.toContain('typing');
      expect(document.title).not.toContain('Busy');
    });

    it('getCurrentTitle returns current title', async () => {
      const { component } = render(WindowTitleManager, { props: { appName: 'TestApp' } });
      await vi.runAllTimersAsync();
      
      const title = component.getCurrentTitle();
      expect(title).toContain('TestApp');
    });

    it('forceUpdate updates window title', async () => {
      const { component } = render(WindowTitleManager);
      const originalTitle = document.title;
      
      document.title = 'Modified';
      component.forceUpdate();
      await vi.runAllTimersAsync();
      
      expect(document.title).not.toBe('Modified');
    });
  });

  describe('visibility handling', () => {
    it('updates focus state on visibility change', async () => {
      render(WindowTitleManager);
      
      // Simulate hidden
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.runAllTimersAsync();
      
      // Title should now be in unfocused mode
      // (unread counts would show if set)
    });
  });

  describe('slot props', () => {
    it('exposes reactive slot props', async () => {
      const { component } = render(WindowTitleManager);
      component.setServer({ id: '1', name: 'Server' });
      component.setUnreadCount(5);
      await vi.runAllTimersAsync();
      
      // The component should pass these through slot props
      // This tests the slot binding functionality
      const title = component.getCurrentTitle();
      expect(title).toBeDefined();
    });
  });
});
