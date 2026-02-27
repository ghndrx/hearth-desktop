import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FileQuickPreview from './FileQuickPreview.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('FileQuickPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should not render when show is false', () => {
      render(FileQuickPreview, { props: { show: false, filePath: '/test/file.txt' } });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when show is true', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Not implemented'));
      mockInvoke.mockResolvedValueOnce({
        name: 'file.txt',
        size: 1024,
        modified: '2024-01-01',
        extension: 'txt',
        mimeType: 'text/plain',
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/file.txt' } });
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should display loading state initially', async () => {
      mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolve

      render(FileQuickPreview, { props: { show: true, filePath: '/test/file.txt' } });
      
      expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });
  });

  describe('file type detection', () => {
    it('should detect image files correctly', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'image',
        fileName: 'photo.jpg',
        fileSize: 2048,
        fileSizeFormatted: '2 KB',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        modifiedDate: '2024-01-01',
        previewUrl: 'data:image/jpeg;base64,test',
        dimensions: { width: 1920, height: 1080 },
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/photo.jpg' } });

      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
      });
    });

    it('should detect code files correctly', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Not implemented'));
      mockInvoke.mockResolvedValueOnce({
        name: 'script.ts',
        size: 512,
        modified: '2024-01-01',
        extension: 'ts',
        mimeType: 'text/typescript',
      });
      mockInvoke.mockResolvedValueOnce('const x = 1;\nconst y = 2;');

      render(FileQuickPreview, { props: { show: true, filePath: '/test/script.ts' } });

      await waitFor(() => {
        expect(screen.getByText('script.ts')).toBeInTheDocument();
      });
    });

    it('should detect archive files correctly', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'archive',
        fileName: 'files.zip',
        fileSize: 4096,
        fileSizeFormatted: '4 KB',
        mimeType: 'application/zip',
        extension: 'zip',
        modifiedDate: '2024-01-01',
        archiveContents: ['file1.txt', 'file2.txt', 'folder/'],
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/files.zip' } });

      await waitFor(() => {
        expect(screen.getByText('files.zip')).toBeInTheDocument();
        expect(screen.getByText('file1.txt')).toBeInTheDocument();
        expect(screen.getByText('file2.txt')).toBeInTheDocument();
      });
    });
  });

  describe('file info display', () => {
    it('should display file size correctly', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'unknown',
        fileName: 'document.pdf',
        fileSize: 1048576,
        fileSizeFormatted: '1 MB',
        mimeType: 'application/pdf',
        extension: 'pdf',
        modifiedDate: '2024-01-15',
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/document.pdf' } });

      await waitFor(() => {
        expect(screen.getByText('1 MB')).toBeInTheDocument();
      });
    });

    it('should display modified date', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'unknown',
        fileName: 'file.bin',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'application/octet-stream',
        extension: 'bin',
        modifiedDate: '2024-02-20',
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/file.bin' } });

      await waitFor(() => {
        expect(screen.getByText('2024-02-20')).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });
    });

    it('should have Open button', async () => {
      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Open')).toBeInTheDocument();
      });
    });

    it('should have Reveal button', async () => {
      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Reveal')).toBeInTheDocument();
      });
    });

    it('should have Share button', async () => {
      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Share')).toBeInTheDocument();
      });
    });

    it('should have Copy Path button', async () => {
      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Copy Path')).toBeInTheDocument();
      });
    });

    it('should call open_file_default when Open is clicked', async () => {
      mockInvoke.mockResolvedValueOnce(undefined); // For open action

      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Open')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByText('Open'));

      expect(mockInvoke).toHaveBeenCalledWith('open_file_default', { path: '/test/test.txt' });
    });

    it('should call reveal_in_file_manager when Reveal is clicked', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Reveal')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByText('Reveal'));

      expect(mockInvoke).toHaveBeenCalledWith('reveal_in_file_manager', { path: '/test/test.txt' });
    });
  });

  describe('close behavior', () => {
    it('should close when close button is clicked', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      const { component } = render(FileQuickPreview, {
        props: { show: true, filePath: '/test/test.txt' },
      });

      let closeCalled = false;
      component.$on('close', () => {
        closeCalled = true;
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Close preview')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByLabelText('Close preview'));

      expect(closeCalled).toBe(true);
    });

    it('should close on Escape key', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      const { component } = render(FileQuickPreview, {
        props: { show: true, filePath: '/test/test.txt' },
      });

      let closeCalled = false;
      component.$on('close', () => {
        closeCalled = true;
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await fireEvent.keyDown(document, { key: 'Escape' });

      expect(closeCalled).toBe(true);
    });

    it('should auto-close after delay if autoClose is true', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      const { component } = render(FileQuickPreview, {
        props: {
          show: true,
          filePath: '/test/test.txt',
          autoClose: true,
          autoCloseDelay: 3000,
        },
      });

      let closeCalled = false;
      component.$on('close', () => {
        closeCalled = true;
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(closeCalled).toBe(false);

      vi.advanceTimersByTime(3000);

      expect(closeCalled).toBe(true);
    });

    it('should not auto-close if mouse enters preview', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      const { component } = render(FileQuickPreview, {
        props: {
          show: true,
          filePath: '/test/test.txt',
          autoClose: true,
          autoCloseDelay: 3000,
        },
      });

      let closeCalled = false;
      component.$on('close', () => {
        closeCalled = true;
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await fireEvent.mouseEnter(screen.getByRole('dialog'));

      vi.advanceTimersByTime(5000);

      expect(closeCalled).toBe(false);
    });
  });

  describe('positioning', () => {
    it('should use centered position when position prop is null', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      render(FileQuickPreview, {
        props: { show: true, filePath: '/test/test.txt', position: null },
      });

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog.style.cssText).toContain('top: 50%');
        expect(dialog.style.cssText).toContain('left: 50%');
      });
    });

    it('should use custom position when provided', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      render(FileQuickPreview, {
        props: {
          show: true,
          filePath: '/test/test.txt',
          position: { x: 100, y: 200 },
        },
      });

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog.style.cssText).toContain('top: 200px');
        expect(dialog.style.cssText).toContain('left: 100px');
      });
    });
  });

  describe('error handling', () => {
    it('should display error state when file cannot be loaded', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'));
      mockInvoke.mockRejectedValueOnce(new Error('File not found'));

      render(FileQuickPreview, { props: { show: true, filePath: '/test/missing.txt' } });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load preview/)).toBeInTheDocument();
      });
    });
  });

  describe('showActions prop', () => {
    it('should hide actions when showActions is false', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      render(FileQuickPreview, {
        props: { show: true, filePath: '/test/test.txt', showActions: false },
      });

      await waitFor(() => {
        expect(screen.getByText('test.txt')).toBeInTheDocument();
      });

      expect(screen.queryByText('Open')).not.toBeInTheDocument();
      expect(screen.queryByText('Share')).not.toBeInTheDocument();
    });
  });

  describe('video preview', () => {
    it('should display video duration', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'video',
        fileName: 'video.mp4',
        fileSize: 10485760,
        fileSizeFormatted: '10 MB',
        mimeType: 'video/mp4',
        extension: 'mp4',
        modifiedDate: '2024-01-01',
        duration: 125,
        thumbnailUrl: 'data:image/jpeg;base64,test',
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/video.mp4' } });

      await waitFor(() => {
        expect(screen.getByText('2:05')).toBeInTheDocument();
      });
    });
  });

  describe('audio preview', () => {
    it('should display audio metadata', async () => {
      mockInvoke.mockResolvedValueOnce({
        type: 'audio',
        fileName: 'song.mp3',
        fileSize: 5242880,
        fileSizeFormatted: '5 MB',
        mimeType: 'audio/mpeg',
        extension: 'mp3',
        modifiedDate: '2024-01-01',
        duration: 240,
        metadata: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
        },
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/song.mp3' } });

      await waitFor(() => {
        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Test Artist')).toBeInTheDocument();
        expect(screen.getByText('Test Album')).toBeInTheDocument();
        expect(screen.getByText('4:00')).toBeInTheDocument();
      });
    });
  });

  describe('clipboard', () => {
    it('should copy path to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      mockInvoke.mockResolvedValueOnce({
        type: 'text',
        fileName: 'test.txt',
        fileSize: 100,
        fileSizeFormatted: '100 B',
        mimeType: 'text/plain',
        extension: 'txt',
        modifiedDate: '2024-01-01',
      });

      render(FileQuickPreview, { props: { show: true, filePath: '/test/test.txt' } });

      await waitFor(() => {
        expect(screen.getByText('Copy Path')).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByText('Copy Path'));

      expect(mockWriteText).toHaveBeenCalledWith('/test/test.txt');
    });
  });
});
