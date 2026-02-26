import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import RecentFilesManager from './RecentFilesManager.svelte';

describe('RecentFilesManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders in test mode with sample data', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.getByTestId('recent-files-manager')).toBeTruthy();
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Should show test files
    expect(screen.getByText('screenshot.png')).toBeTruthy();
    expect(screen.getByText('meeting-notes.pdf')).toBeTruthy();
    expect(screen.getByText('video-clip.mp4')).toBeTruthy();
  });

  it('displays file stats correctly', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const stats = screen.getByTestId('file-stats');
    expect(stats.textContent).toContain('3 files');
  });

  it('filters files by search query', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const searchInput = screen.getByTestId('search-input');
    await fireEvent.input(searchInput, { target: { value: 'screenshot' } });

    await waitFor(() => {
      expect(screen.getByText('screenshot.png')).toBeTruthy();
      expect(screen.queryByText('meeting-notes.pdf')).toBeNull();
      expect(screen.queryByText('video-clip.mp4')).toBeNull();
    });
  });

  it('filters files by type', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const typeFilter = screen.getByTestId('type-filter');
    await fireEvent.change(typeFilter, { target: { value: 'document' } });

    await waitFor(() => {
      expect(screen.queryByText('screenshot.png')).toBeNull();
      expect(screen.getByText('meeting-notes.pdf')).toBeTruthy();
      expect(screen.queryByText('video-clip.mp4')).toBeNull();
    });
  });

  it('shows empty state when no files match filter', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const searchInput = screen.getByTestId('search-input');
    await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.getByText('No files match your filters')).toBeTruthy();
    });
  });

  it('removes individual files', async () => {
    const onFileRemove = vi.fn();
    render(RecentFilesManager, { 
      props: { testMode: true, onFileRemove } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const removeBtn = screen.getByTestId('remove-1');
    await fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('screenshot.png')).toBeNull();
      expect(onFileRemove).toHaveBeenCalledWith('1');
    });
  });

  it('clears all files', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const clearBtn = screen.getByTestId('clear-all-btn');
    await fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.getByText('No recent files')).toBeTruthy();
    });
  });

  it('calls onFileSelect when clicking a file', async () => {
    const onFileSelect = vi.fn();
    render(RecentFilesManager, { 
      props: { testMode: true, onFileSelect } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const fileItem = screen.getByTestId('file-item-1');
    await fireEvent.click(fileItem);

    expect(onFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        name: 'screenshot.png',
        type: 'image'
      })
    );
  });

  it('supports keyboard navigation', async () => {
    const onFileSelect = vi.fn();
    render(RecentFilesManager, { 
      props: { testMode: true, onFileSelect } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const fileItem = screen.getByTestId('file-item-1');
    await fireEvent.keyDown(fileItem, { key: 'Enter' });

    expect(onFileSelect).toHaveBeenCalled();
  });

  it('displays correct file type icons', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Check that type icons are rendered (emoji-based)
    const fileList = screen.getByTestId('file-list');
    expect(fileList.textContent).toContain('🖼️'); // image
    expect(fileList.textContent).toContain('📄'); // document
    expect(fileList.textContent).toContain('🎬'); // video
  });

  it('formats file sizes correctly', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Test files have sizes: 245KB, 1.2MB, 52.4MB
    const fileList = screen.getByTestId('file-list');
    expect(fileList.textContent).toContain('239.3 KB'); // 245000 bytes
    expect(fileList.textContent).toContain('1.2 MB'); // 1250000 bytes
    expect(fileList.textContent).toContain('50 MB'); // 52400000 bytes
  });

  it('formats relative times correctly', async () => {
    vi.setSystemTime(new Date('2026-02-26T15:00:00Z'));
    
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    const fileList = screen.getByTestId('file-list');
    expect(fileList.textContent).toContain('1h ago');
    expect(fileList.textContent).toContain('1d ago');
    expect(fileList.textContent).toContain('2d ago');
  });

  it('disables clear button when no files', async () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Clear all files first
    const clearBtn = screen.getByTestId('clear-all-btn');
    await fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(clearBtn).toBeDisabled();
    });
  });

  it('groups files by server when enabled', async () => {
    render(RecentFilesManager, { 
      props: { testMode: true, groupByServer: true } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Should show server group headers
    expect(screen.getByText('server-1')).toBeTruthy();
    expect(screen.getByText('server-2')).toBeTruthy();
    expect(screen.getByText('Direct Messages')).toBeTruthy();
  });

  it('handles maxFiles prop', async () => {
    render(RecentFilesManager, { 
      props: { testMode: true, maxFiles: 2 } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Component should still render, maxFiles affects new additions
    expect(screen.getByTestId('recent-files-manager')).toBeTruthy();
  });

  it('persists to localStorage in test mode', async () => {
    const { component } = render(RecentFilesManager, { 
      props: { testMode: true } 
    });
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });

    // Add a new file via exported method
    await (component as any).addRecentFile({
      path: '/new/file.txt',
      name: 'file.txt',
      size: 1000
    });

    // Check localStorage was updated
    const stored = localStorage.getItem('hearth_recent_files');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toContainEqual(
      expect.objectContaining({ name: 'file.txt' })
    );
  });

  it('shows loading state initially', () => {
    render(RecentFilesManager, { props: { testMode: true } });
    
    // Should briefly show loading
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
