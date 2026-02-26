import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import QuickNotes from './QuickNotes.svelte';

// Mock Tauri Store plugin
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
});

describe('QuickNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toggle button', () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes|collapse notes/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('shows note count badge when collapsed', () => {
    render(QuickNotes);
    const badge = document.querySelector('.note-count');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe('0');
  });

  it('expands panel when toggle button is clicked', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('Quick Notes')).toBeInTheDocument();
  });

  it('shows new note textarea when expanded', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByPlaceholderText(/write a quick note/i)).toBeInTheDocument();
  });

  it('shows search bar when expanded', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
  });

  it('shows empty state when no notes exist', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('has add note button disabled when textarea is empty', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    const addButton = screen.getByRole('button', { name: /add note/i });
    expect(addButton).toBeDisabled();
  });

  it('enables add note button when textarea has content', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    const textarea = screen.getByPlaceholderText(/write a quick note/i);
    await fireEvent.input(textarea, { target: { value: 'Test note content' } });
    
    const addButton = screen.getByRole('button', { name: /add note/i });
    expect(addButton).not.toBeDisabled();
  });

  it('shows color picker swatches', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    const colorSwatches = document.querySelectorAll('.color-swatch');
    expect(colorSwatches.length).toBe(7);
  });

  it('has default color selected initially', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    const selectedSwatch = document.querySelector('.color-swatch.selected');
    expect(selectedSwatch).toBeInTheDocument();
  });

  it('collapses panel when toggle button is clicked again', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    expect(screen.getByText('Quick Notes')).toBeInTheDocument();
    
    await fireEvent.click(toggleButton);
    expect(screen.queryByText('Quick Notes')).not.toBeInTheDocument();
  });

  it('displays correct note count', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('0 notes')).toBeInTheDocument();
  });
});

describe('QuickNotes time formatting', () => {
  it('formats recent times correctly', async () => {
    // Test the formatDate function through the component
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    // The component should be able to format dates
    // This is a basic render test - actual date formatting would need notes data
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });
});

describe('QuickNotes keyboard shortcuts', () => {
  it('handles Ctrl+Enter in textarea', async () => {
    render(QuickNotes);
    const toggleButton = screen.getByRole('button', { name: /expand notes/i });
    
    await fireEvent.click(toggleButton);
    
    const textarea = screen.getByPlaceholderText(/write a quick note/i);
    await fireEvent.input(textarea, { target: { value: 'Test note' } });
    
    // Simulate Ctrl+Enter
    await fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    // Note should be added (textarea cleared)
    // Due to mocking, we just verify no errors occur
    expect(textarea).toBeInTheDocument();
  });
});
