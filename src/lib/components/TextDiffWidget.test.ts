import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TextDiffWidget from './TextDiffWidget.svelte';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('TextDiffWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with empty state', () => {
    render(TextDiffWidget);
    
    expect(screen.getByText('Text Diff')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste original text here...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste modified text here...')).toBeInTheDocument();
  });

  it('displays initial stats as zero', () => {
    render(TextDiffWidget);
    
    expect(screen.getByText('+0')).toBeInTheDocument();
    expect(screen.getByText('-0')).toBeInTheDocument();
    expect(screen.getByText('=0')).toBeInTheDocument();
  });

  it('renders toolbar options', () => {
    render(TextDiffWidget);
    
    expect(screen.getByText('Ignore whitespace')).toBeInTheDocument();
    expect(screen.getByText('Ignore case')).toBeInTheDocument();
    expect(screen.getByText('Line numbers')).toBeInTheDocument();
    expect(screen.getByText('Split')).toBeInTheDocument();
    expect(screen.getByText('Unified')).toBeInTheDocument();
  });

  it('computes diff when text is entered', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...');
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...');
    
    await fireEvent.input(leftTextarea, { target: { value: 'line1\nline2' } });
    await fireEvent.input(rightTextarea, { target: { value: 'line1\nline3' } });
    
    await waitFor(() => {
      expect(screen.getByText('Diff Output')).toBeInTheDocument();
    });
  });

  it('shows line counts for each input', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...');
    await fireEvent.input(leftTextarea, { target: { value: 'line1\nline2\nline3' } });
    
    await waitFor(() => {
      expect(screen.getByText('3 lines')).toBeInTheDocument();
    });
  });

  it('can toggle between split and unified view', async () => {
    render(TextDiffWidget);
    
    const splitBtn = screen.getByText('Split');
    const unifiedBtn = screen.getByText('Unified');
    
    expect(splitBtn.classList.contains('active')).toBe(true);
    
    await fireEvent.click(unifiedBtn);
    expect(unifiedBtn.classList.contains('active')).toBe(true);
  });

  it('clears all text when clear button is clicked', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...') as HTMLTextAreaElement;
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...') as HTMLTextAreaElement;
    
    await fireEvent.input(leftTextarea, { target: { value: 'test text' } });
    await fireEvent.input(rightTextarea, { target: { value: 'other text' } });
    
    const clearBtn = screen.getByTitle('Clear all');
    await fireEvent.click(clearBtn);
    
    await waitFor(() => {
      expect(leftTextarea.value).toBe('');
      expect(rightTextarea.value).toBe('');
    });
  });

  it('swaps text between inputs', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...') as HTMLTextAreaElement;
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...') as HTMLTextAreaElement;
    
    await fireEvent.input(leftTextarea, { target: { value: 'original' } });
    await fireEvent.input(rightTextarea, { target: { value: 'modified' } });
    
    const swapBtn = screen.getByTitle('Swap texts');
    await fireEvent.click(swapBtn);
    
    await waitFor(() => {
      expect(leftTextarea.value).toBe('modified');
      expect(rightTextarea.value).toBe('original');
    });
  });

  it('copies diff output to clipboard', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...');
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...');
    
    await fireEvent.input(leftTextarea, { target: { value: 'same\nold' } });
    await fireEvent.input(rightTextarea, { target: { value: 'same\nnew' } });
    
    await waitFor(() => {
      expect(screen.getByText('Diff Output')).toBeInTheDocument();
    });
    
    const copyBtn = screen.getByTitle('Copy diff');
    await fireEvent.click(copyBtn);
    
    expect(mockClipboard.writeText).toHaveBeenCalled();
  });

  it('shows additions and deletions in stats', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...');
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...');
    
    await fireEvent.input(leftTextarea, { target: { value: 'keep\nremove' } });
    await fireEvent.input(rightTextarea, { target: { value: 'keep\nadd' } });
    
    await waitFor(() => {
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByText('-1')).toBeInTheDocument();
      expect(screen.getByText('=1')).toBeInTheDocument();
    });
  });

  it('can toggle ignore whitespace option', async () => {
    render(TextDiffWidget);
    
    const checkbox = screen.getByText('Ignore whitespace').previousElementSibling as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    
    await fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('can toggle ignore case option', async () => {
    render(TextDiffWidget);
    
    const checkbox = screen.getByText('Ignore case').previousElementSibling as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    
    await fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('can toggle line numbers option', async () => {
    render(TextDiffWidget);
    
    const checkbox = screen.getByText('Line numbers').previousElementSibling as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    
    await fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('handles empty inputs gracefully', () => {
    render(TextDiffWidget);
    
    // Should render without errors
    expect(screen.getByText('Text Diff')).toBeInTheDocument();
    expect(screen.queryByText('Diff Output')).not.toBeInTheDocument();
  });

  it('handles identical texts', async () => {
    render(TextDiffWidget);
    
    const leftTextarea = screen.getByPlaceholderText('Paste original text here...');
    const rightTextarea = screen.getByPlaceholderText('Paste modified text here...');
    
    await fireEvent.input(leftTextarea, { target: { value: 'same\ncontent' } });
    await fireEvent.input(rightTextarea, { target: { value: 'same\ncontent' } });
    
    await waitFor(() => {
      expect(screen.getByText('=2')).toBeInTheDocument();
      expect(screen.getByText('+0')).toBeInTheDocument();
      expect(screen.getByText('-0')).toBeInTheDocument();
    });
  });
});
