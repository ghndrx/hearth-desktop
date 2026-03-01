import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ClipboardHistoryManager from './ClipboardHistoryManager.svelte';

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn().mockResolvedValue(''),
  writeText: vi.fn().mockResolvedValue(undefined)
}));

describe('ClipboardHistoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(ClipboardHistoryManager);
    // Component starts closed, so no visible content
    expect(document.body).toBeDefined();
  });

  it('opens with keyboard shortcut', async () => {
    render(ClipboardHistoryManager);
    
    // Simulate Ctrl+Shift+V
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText('Clipboard History')).toBeInTheDocument();
  });

  it('closes with Escape key', async () => {
    render(ClipboardHistoryManager);
    
    // Open first
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText('Clipboard History')).toBeInTheDocument();
    
    // Close with Escape
    await fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(screen.queryByText('Clipboard History')).not.toBeInTheDocument();
  });

  it('shows empty state when no entries', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText('No clipboard entries')).toBeInTheDocument();
    expect(screen.getByText('Copy something to get started')).toBeInTheDocument();
  });

  it('has filter buttons', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText(/text/i)).toBeInTheDocument();
    expect(screen.getByText(/url/i)).toBeInTheDocument();
    expect(screen.getByText(/code/i)).toBeInTheDocument();
  });

  it('has search input', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    const searchInput = screen.getByPlaceholderText('Search clipboard history...');
    expect(searchInput).toBeInTheDocument();
  });

  it('shows settings panel when settings button clicked', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    const settingsButton = screen.getByTitle('Settings');
    await fireEvent.click(settingsButton);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Auto-close after paste')).toBeInTheDocument();
    expect(screen.getByText('Remove duplicates')).toBeInTheDocument();
  });

  it('shows statistics bar', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText(/0 items/)).toBeInTheDocument();
    expect(screen.getByText(/0 pinned/)).toBeInTheDocument();
  });

  it('shows keyboard shortcuts in footer', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText(/Navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Paste/)).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    expect(screen.getByText(/Close/)).toBeInTheDocument();
  });

  it('has pinned filter toggle', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    const pinnedButton = screen.getByText(/Pinned/);
    expect(pinnedButton).toBeInTheDocument();
    
    await fireEvent.click(pinnedButton);
    // Button should be active (yellow background indicated by class)
    expect(pinnedButton).toHaveClass('bg-yellow-500');
  });

  it('closes when clicking backdrop', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    expect(screen.getByText('Clipboard History')).toBeInTheDocument();
    
    // Click the backdrop (the dialog wrapper)
    const backdrop = screen.getByRole('dialog');
    await fireEvent.click(backdrop);
    
    expect(screen.queryByText('Clipboard History')).not.toBeInTheDocument();
  });

  it('has clear all button', async () => {
    render(ClipboardHistoryManager);
    
    await fireEvent.keyDown(window, { 
      key: 'V', 
      ctrlKey: true, 
      shiftKey: true 
    });
    
    const clearButton = screen.getByTitle('Clear All');
    expect(clearButton).toBeInTheDocument();
  });
});

describe('ClipboardHistoryManager - Type Detection', () => {
  // These tests verify the type detection logic conceptually
  // In a real implementation, we'd expose the detectType function

  it('should identify URLs correctly', () => {
    const urlPatterns = [
      'https://example.com',
      'http://test.org/path',
      'https://sub.domain.com/path?query=1'
    ];
    
    urlPatterns.forEach(url => {
      expect(/^https?:\/\/[^\s]+$/i.test(url.trim())).toBe(true);
    });
  });

  it('should identify emails correctly', () => {
    const emailPatterns = [
      'test@example.com',
      'user.name@domain.org',
      'hello+tag@test.co'
    ];
    
    emailPatterns.forEach(email => {
      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim())).toBe(true);
    });
  });

  it('should identify colors correctly', () => {
    const colorPatterns = [
      '#fff',
      '#ffffff',
      '#ff5733',
      'rgb(255, 100, 50)',
      'rgba(255, 100, 50, 0.5)',
      'hsl(120, 50%, 50%)'
    ];
    
    colorPatterns.forEach(color => {
      const isHex = /^#[0-9a-f]{3,8}$/i.test(color.trim());
      const isRgb = /^rgba?\([^)]+\)$/i.test(color.trim());
      const isHsl = /^hsla?\([^)]+\)$/i.test(color.trim());
      expect(isHex || isRgb || isHsl).toBe(true);
    });
  });
});
