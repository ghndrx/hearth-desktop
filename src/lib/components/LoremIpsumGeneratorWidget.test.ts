import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LoremIpsumGeneratorWidget from './LoremIpsumGeneratorWidget.svelte';

describe('LoremIpsumGeneratorWidget', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default state', () => {
    render(LoremIpsumGeneratorWidget);
    
    expect(screen.getByText('📝 Lorem Ipsum Generator')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate')).toBeInTheDocument();
    expect(screen.getByLabelText('Count')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('generates text on mount', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toContain('Lorem ipsum');
    });
  });

  it('starts with "Lorem ipsum" when checkbox is checked', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value.startsWith('Lorem ipsum')).toBe(true);
    });
  });

  it('changes generation type', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const select = screen.getByLabelText('Generate') as HTMLSelectElement;
    
    // Change to sentences
    await fireEvent.change(select, { target: { value: 'sentences' } });
    expect(select.value).toBe('sentences');
    
    // Change to words
    await fireEvent.change(select, { target: { value: 'words' } });
    expect(select.value).toBe('words');
  });

  it('changes count value', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const countInput = screen.getByLabelText('Count') as HTMLInputElement;
    await fireEvent.input(countInput, { target: { value: '5' } });
    
    expect(countInput.value).toBe('5');
  });

  it('copies text to clipboard', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Wait for initial generation
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    const copyButton = screen.getByText('📋 Copy');
    await fireEvent.click(copyButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(screen.getByText('✓ Copied!')).toBeInTheDocument();
    });
  });

  it('clears text when clear button is clicked', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Wait for initial generation
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    const clearButton = screen.getByText('🗑️ Clear');
    await fireEvent.click(clearButton);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('regenerates text when regenerate button is clicked', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Wait for initial generation
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    const initialText = textarea.value;
    
    const regenerateButton = screen.getByText('🔄 Regenerate');
    await fireEvent.click(regenerateButton);
    
    // Text should be regenerated (might be same due to random, but function should be called)
    // We just verify the button works
    expect(textarea.value.length).toBeGreaterThan(0);
  });

  it('toggles lorem ipsum start checkbox', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const checkbox = screen.getByLabelText(/Start with "Lorem ipsum/);
    expect(checkbox).toBeChecked();
    
    await fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('displays word and character counts', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Wait for initial generation
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    // Check for stats display
    expect(screen.getByText(/\d+ words/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ characters/)).toBeInTheDocument();
  });

  it('updates counts when text is manually edited', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'hello world' } });
    
    expect(screen.getByText('2 words')).toBeInTheDocument();
    expect(screen.getByText('11 characters')).toBeInTheDocument();
  });

  it('generates correct number of paragraphs', async () => {
    render(LoremIpsumGeneratorWidget);
    
    const countInput = screen.getByLabelText('Count') as HTMLInputElement;
    await fireEvent.input(countInput, { target: { value: '2' } });
    await fireEvent.change(countInput);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    await waitFor(() => {
      // Two paragraphs are separated by double newline
      const paragraphs = textarea.value.split('\n\n').filter(p => p.trim());
      expect(paragraphs.length).toBe(2);
    });
  });

  it('generates words without lorem start when unchecked', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Uncheck the lorem start checkbox
    const checkbox = screen.getByLabelText(/Start with "Lorem ipsum/);
    await fireEvent.click(checkbox);
    
    // Change to words
    const select = screen.getByLabelText('Generate') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'words' } });
    
    const countInput = screen.getByLabelText('Count') as HTMLInputElement;
    await fireEvent.input(countInput, { target: { value: '3' } });
    await fireEvent.change(countInput);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    await waitFor(() => {
      const words = textarea.value.split(/\s+/);
      expect(words.length).toBe(3);
      // Since lorem is unchecked, it might or might not start with lorem (random)
    });
  });

  it('disables copy and clear buttons when textarea is empty', async () => {
    render(LoremIpsumGeneratorWidget);
    
    // Clear the text first
    const clearButton = screen.getByText('🗑️ Clear');
    
    // Wait for initial content
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    await fireEvent.click(clearButton);
    
    // Now buttons should be disabled
    const copyButton = screen.getByText('📋 Copy');
    expect(copyButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
  });

  it('handles clipboard error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
      },
    });
    
    render(LoremIpsumGeneratorWidget);
    
    // Wait for initial generation
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value.length).toBeGreaterThan(0);
    });
    
    const copyButton = screen.getByText('📋 Copy');
    await fireEvent.click(copyButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
