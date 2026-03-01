import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NativeShareSheet from './NativeShareSheet.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('NativeShareSheet', () => {
  const mockTargets = [
    { id: 'clipboard', name: 'Copy to Clipboard', icon: 'clipboard' },
    { id: 'mail', name: 'Mail', icon: 'envelope' },
    { id: 'messages', name: 'Messages', icon: 'message' },
    { id: 'save', name: 'Save to Files', icon: 'folder' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_share_targets') {
        return mockTargets;
      }
      if (cmd === 'share_content') {
        return { success: true, error: null, sharedTo: 'Clipboard' };
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should not render when closed', () => {
      render(NativeShareSheet, {
        props: {
          isOpen: false,
          item: { text: 'Test content' },
        },
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('should show share targets after loading', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
        expect(screen.getByText('Mail')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
      });
    });

    it('should show content preview', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { 
            title: 'Test Title',
            text: 'Test content body',
          },
          showPreview: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test content body')).toBeInTheDocument();
      });
    });

    it('should truncate long preview text', async () => {
      const longText = 'A'.repeat(150);
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: longText },
          showPreview: true,
        },
      });

      await waitFor(() => {
        const preview = screen.getByText(/A{100}\.\.\./);
        expect(preview).toBeInTheDocument();
      });
    });

    it('should show URL in preview', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { 
            text: 'Check out this link',
            url: 'https://example.com',
          },
          showPreview: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('https://example.com')).toBeInTheDocument();
      });
    });

    it('should show file count in preview', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { 
            text: 'Files attached',
            filePaths: ['/path/to/file1.txt', '/path/to/file2.txt'],
          },
          showPreview: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/2 files/)).toBeInTheDocument();
      });
    });
  });

  describe('sharing', () => {
    it('should share to selected target', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Copy to Clipboard'));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('share_content', {
          item: {
            title: undefined,
            text: 'Test content',
            url: undefined,
            file_paths: undefined,
          },
          targetId: 'clipboard',
        });
      });
    });

    it('should show success state after sharing', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Copy to Clipboard'));

      await waitFor(() => {
        expect(screen.getByText(/Shared to Clipboard/)).toBeInTheDocument();
      });
    });

    it('should emit share event on successful share', async () => {
      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const shareHandler = vi.fn();
      component.$on('share', shareHandler);

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Copy to Clipboard'));

      // Wait for success animation
      await waitFor(() => {
        expect(shareHandler).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should emit error event on failed share', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_share_targets') {
          return mockTargets;
        }
        if (cmd === 'share_content') {
          return { success: false, error: 'Share failed', sharedTo: null };
        }
        return null;
      });

      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const errorHandler = vi.fn();
      component.$on('error', errorHandler);

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Copy to Clipboard'));

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { message: 'Share failed' },
          })
        );
      });
    });

    it('should copy to clipboard with quick action button', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByText('Copy'));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('share_content', 
          expect.objectContaining({
            targetId: 'clipboard',
          })
        );
      });
    });
  });

  describe('search', () => {
    it('should filter targets by search query', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search share options...');
      await fireEvent.input(searchInput, { target: { value: 'mail' } });

      await waitFor(() => {
        expect(screen.getByText('Mail')).toBeInTheDocument();
        expect(screen.queryByText('Copy to Clipboard')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no matches', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search share options...');
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No share options found')).toBeInTheDocument();
      });
    });
  });

  describe('recent targets', () => {
    it('should sort recent targets first', async () => {
      localStorage.setItem('hearth:recent-share-targets', JSON.stringify(['messages']));

      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /Share to/ });
        expect(buttons[0]).toHaveAttribute('aria-label', 'Share to Messages');
      });
    });

    it('should save recent target after sharing', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Mail')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Mail'));

      await waitFor(() => {
        const stored = localStorage.getItem('hearth:recent-share-targets');
        expect(stored).toBeDefined();
        expect(JSON.parse(stored!)).toContain('mail');
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should close on Escape key', async () => {
      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('should copy with Cmd+C', async () => {
      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await fireEvent.keyDown(window, { key: 'c', metaKey: true });

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('share_content',
          expect.objectContaining({
            targetId: 'clipboard',
          })
        );
      });
    });
  });

  describe('close behavior', () => {
    it('should close when clicking backdrop', async () => {
      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const backdrop = screen.getByRole('dialog');
      await fireEvent.click(backdrop);

      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('should close when clicking close button', async () => {
      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const closeHandler = vi.fn();
      component.$on('close', closeHandler);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Close'));

      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('should clear search on close', async () => {
      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search share options...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search share options...');
      await fireEvent.input(searchInput, { target: { value: 'test' } });
      
      expect(searchInput).toHaveValue('test');

      await fireEvent.click(screen.getByLabelText('Close'));
      
      // Re-open
      await component.$set({ isOpen: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search share options...')).toHaveValue('');
      });
    });
  });

  describe('loading states', () => {
    it('should show loading state while fetching targets', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_share_targets') {
          await new Promise(resolve => setTimeout(resolve, 100));
          return mockTargets;
        }
        return null;
      });

      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      expect(screen.getByText('Loading share options...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading share options...')).not.toBeInTheDocument();
      });
    });

    it('should show loading indicator on target button during share', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_share_targets') {
          return mockTargets;
        }
        if (cmd === 'share_content') {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, sharedTo: 'Mail' };
        }
        return null;
      });

      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Mail')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Mail'));

      await waitFor(() => {
        const mailButton = screen.getByLabelText('Share to Mail');
        expect(mailButton.querySelector('.target-loading')).toBeInTheDocument();
      });
    });

    it('should disable all targets while sharing', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_share_targets') {
          return mockTargets;
        }
        if (cmd === 'share_content') {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, sharedTo: 'Mail' };
        }
        return null;
      });

      render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Mail')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Mail'));

      await waitFor(() => {
        const clipboardButton = screen.getByLabelText('Share to Copy to Clipboard');
        expect(clipboardButton).toBeDisabled();
      });
    });
  });

  describe('error handling', () => {
    it('should emit error when invoke throws', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_share_targets') {
          return mockTargets;
        }
        if (cmd === 'share_content') {
          throw new Error('Network error');
        }
        return null;
      });

      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const errorHandler = vi.fn();
      component.$on('error', errorHandler);

      await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Share to Copy to Clipboard'));

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { message: 'Network error' },
          })
        );
      });
    });

    it('should emit error when loading targets fails', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Failed to load'));

      const { component } = render(NativeShareSheet, {
        props: {
          isOpen: true,
          item: { text: 'Test content' },
        },
      });

      const errorHandler = vi.fn();
      component.$on('error', errorHandler);

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { message: 'Failed to load share options' },
          })
        );
      });
    });
  });
});
