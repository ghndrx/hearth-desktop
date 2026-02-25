import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ClipboardManager from './ClipboardManager.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('ClipboardManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when showHistory is false', () => {
      const { container } = render(ClipboardManager, {
        showHistory: false
      });
      
      expect(container.querySelector('.clipboard-manager')).toBeNull();
    });

    it('renders clipboard manager when showHistory is true', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('📋 Clipboard History')).toBeInTheDocument();
      });
    });

    it('shows empty state when no history', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('No clipboard history yet')).toBeInTheDocument();
      });
    });

    it('shows clear button when history exists', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { type: 'Text', data: 'Hello world' },
          timestamp: Date.now(),
          source: 'copy'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
    });
  });

  describe('history display', () => {
    it('displays text entries correctly', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { type: 'Text', data: 'Test content' },
          timestamp: Date.now(),
          source: 'copy'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Test content')).toBeInTheDocument();
        expect(screen.getByText('📝')).toBeInTheDocument();
      });
    });

    it('displays image entries correctly', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { 
            type: 'Image', 
            data: { base64: 'abc123', width: 800, height: 600, format: 'png' } 
          },
          timestamp: Date.now(),
          source: 'copy_image'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Image (800×600)')).toBeInTheDocument();
        expect(screen.getByText('🖼️')).toBeInTheDocument();
      });
    });

    it('truncates long text entries', async () => {
      const longText = 'A'.repeat(150);
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { type: 'Text', data: longText },
          timestamp: Date.now(),
          source: 'copy'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        const preview = screen.getByText(/^A+\.\.\.$/);
        expect(preview.textContent?.length).toBeLessThan(longText.length);
      });
    });

    it('respects maxHistoryDisplay prop', async () => {
      mockInvoke.mockResolvedValueOnce([
        { id: '1', content: { type: 'Text', data: 'Item 1' }, timestamp: Date.now() },
        { id: '2', content: { type: 'Text', data: 'Item 2' }, timestamp: Date.now() },
        { id: '3', content: { type: 'Text', data: 'Item 3' }, timestamp: Date.now() },
        { id: '4', content: { type: 'Text', data: 'Item 4' }, timestamp: Date.now() },
        { id: '5', content: { type: 'Text', data: 'Item 5' }, timestamp: Date.now() },
      ]);
      
      render(ClipboardManager, {
        showHistory: true,
        maxHistoryDisplay: 3
      });
      
      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getByText('Item 3')).toBeInTheDocument();
        expect(screen.queryByText('Item 4')).toBeNull();
        expect(screen.getByText('+2 more entries')).toBeInTheDocument();
      });
    });
  });

  describe('time formatting', () => {
    it('shows "Just now" for recent entries', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { type: 'Text', data: 'Recent' },
          timestamp: Date.now() - 30000, // 30 seconds ago
          source: 'copy'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('shows minutes for older entries', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          id: '1',
          content: { type: 'Text', data: 'Older' },
          timestamp: Date.now() - 5 * 60000, // 5 minutes ago
          source: 'copy'
        }
      ]);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('5m ago')).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls pasteEntry when clicking an entry', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            content: { type: 'Text', data: 'Click me' },
            timestamp: Date.now()
          }
        ])
        .mockResolvedValueOnce({ type: 'Text', data: 'Click me' });
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Click me')).toBeInTheDocument();
      });
      
      await fireEvent.click(screen.getByText('Click me'));
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_paste_entry', { id: '1' });
    });

    it('calls removeEntry when clicking remove button', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            content: { type: 'Text', data: 'Remove me' },
            timestamp: Date.now()
          }
        ])
        .mockResolvedValueOnce(true);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Remove me')).toBeInTheDocument();
      });
      
      await fireEvent.click(screen.getByText('✕'));
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_remove_entry', { id: '1' });
    });

    it('clears history when clicking Clear All', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          {
            id: '1',
            content: { type: 'Text', data: 'Clear me' },
            timestamp: Date.now()
          }
        ])
        .mockResolvedValueOnce(undefined);
      
      render(ClipboardManager, {
        showHistory: true
      });
      
      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
      
      await fireEvent.click(screen.getByText('Clear All'));
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_clear_history');
    });
  });

  describe('component methods', () => {
    it('copyText invokes clipboard_copy_text', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'new',
        content: { type: 'Text', data: 'Copied text' },
        timestamp: Date.now()
      });
      
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      await component.copyText('Copied text');
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_copy_text', {
        text: 'Copied text',
        trackHistory: true
      });
    });

    it('copyHtml invokes clipboard_copy_html', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'new',
        content: { type: 'Html', data: { html: '<b>Bold</b>', plain: 'Bold' } },
        timestamp: Date.now()
      });
      
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      await component.copyHtml('<b>Bold</b>', 'Bold');
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_copy_html', {
        html: '<b>Bold</b>',
        plainText: 'Bold',
        trackHistory: true
      });
    });

    it('copyImage invokes clipboard_copy_image', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'new',
        content: { 
          type: 'Image', 
          data: { base64: 'abc', width: 100, height: 100, format: 'png' } 
        },
        timestamp: Date.now()
      });
      
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      await component.copyImage('abc');
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_copy_image', {
        base64Data: 'abc',
        trackHistory: true
      });
    });

    it('read invokes clipboard_read', async () => {
      mockInvoke.mockResolvedValueOnce({ type: 'Text', data: 'Current content' });
      
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      const content = await component.read();
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_read');
      expect(content).toEqual({ type: 'Text', data: 'Current content' });
    });
  });

  describe('events', () => {
    it('dispatches copy event on successful copy', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'new',
        content: { type: 'Text', data: 'Event test' },
        timestamp: Date.now()
      });
      
      const handler = vi.fn();
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      component.$on('copy', handler);
      await component.copyText('Event test');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            type: 'text'
          })
        })
      );
    });

    it('dispatches error event on failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Copy failed'));
      
      const handler = vi.fn();
      const { component } = render(ClipboardManager, {
        showHistory: false
      });
      
      component.$on('error', handler);
      await component.copyText('Will fail');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            action: 'copy',
            error: 'Copy failed'
          })
        })
      );
    });
  });

  describe('autoTrackCopies', () => {
    it('respects autoTrackCopies=false', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'temp',
        content: { type: 'Text', data: '' },
        timestamp: Date.now()
      });
      
      const { component } = render(ClipboardManager, {
        showHistory: false,
        autoTrackCopies: false
      });
      
      await component.copyText('No track');
      
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_copy_text', {
        text: 'No track',
        trackHistory: false
      });
    });
  });
});
