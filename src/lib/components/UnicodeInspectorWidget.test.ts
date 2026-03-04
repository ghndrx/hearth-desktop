import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import UnicodeInspectorWidget from './UnicodeInspectorWidget.svelte';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('UnicodeInspectorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render with title', () => {
    render(UnicodeInspectorWidget);
    expect(screen.getByText('Unicode Inspector')).toBeInTheDocument();
  });

  it('should render inspect and search tabs', () => {
    render(UnicodeInspectorWidget);
    expect(screen.getByRole('tab', { name: /inspect/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /search/i })).toBeInTheDocument();
  });

  it('should show inspect tab as active by default', () => {
    render(UnicodeInspectorWidget);
    const inspectTab = screen.getByRole('tab', { name: /inspect/i });
    expect(inspectTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should render textarea for character input', () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');
    expect(textarea).toBeInTheDocument();
  });

  it('should display character details when text is entered', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'A' } });

    await waitFor(() => {
      expect(screen.getByText('U+0041')).toBeInTheDocument();
      expect(screen.getByText('LATIN CAPITAL LETTER A')).toBeInTheDocument();
    });
  });

  it('should show character count', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'ABC' } });

    await waitFor(() => {
      expect(screen.getByText('3 characters')).toBeInTheDocument();
    });
  });

  it('should show singular character count for single char', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'X' } });

    await waitFor(() => {
      expect(screen.getByText('1 character')).toBeInTheDocument();
    });
  });

  it('should display decimal code point', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: '!' } });

    await waitFor(() => {
      expect(screen.getByText('33')).toBeInTheDocument(); // decimal for '!'
    });
  });

  it('should display HTML entity', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    // Use a non-ASCII character to get HTML entity format
    await fireEvent.input(textarea, { target: { value: '\u00A9' } }); // copyright sign

    await waitFor(() => {
      expect(screen.getByText('&#169;')).toBeInTheDocument();
    });
  });

  it('should clear input when clear button is clicked', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'test' } });

    const clearBtn = screen.getByTitle('Clear');
    await fireEvent.click(clearBtn);

    expect(textarea).toHaveValue('');
  });

  it('should switch to search tab', async () => {
    render(UnicodeInspectorWidget);

    const searchTab = screen.getByRole('tab', { name: /search/i });
    await fireEvent.click(searchTab);

    expect(searchTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText(/arrow/i)).toBeInTheDocument();
  });

  it('should search by codepoint', async () => {
    render(UnicodeInspectorWidget);

    // Switch to search tab
    await fireEvent.click(screen.getByRole('tab', { name: /search/i }));

    const searchInput = screen.getByPlaceholderText(/arrow/i);
    await fireEvent.input(searchInput, { target: { value: 'U+0041' } });

    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('should search by decimal number', async () => {
    render(UnicodeInspectorWidget);
    await fireEvent.click(screen.getByRole('tab', { name: /search/i }));

    const searchInput = screen.getByPlaceholderText(/arrow/i);
    await fireEvent.input(searchInput, { target: { value: '65' } });

    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
  });

  it('should search by name', async () => {
    render(UnicodeInspectorWidget);
    await fireEvent.click(screen.getByRole('tab', { name: /search/i }));

    const searchInput = screen.getByPlaceholderText(/arrow/i);
    await fireEvent.input(searchInput, { target: { value: 'dollar' } });

    await waitFor(() => {
      expect(screen.getByText(/result/)).toBeInTheDocument();
    });
  });

  it('should show no results message for unmatched search', async () => {
    render(UnicodeInspectorWidget);
    await fireEvent.click(screen.getByRole('tab', { name: /search/i }));

    const searchInput = screen.getByPlaceholderText(/arrow/i);
    await fireEvent.input(searchInput, { target: { value: 'xyznonexistent12345' } });

    await waitFor(() => {
      expect(screen.getByText(/No characters found/)).toBeInTheDocument();
    });
  });

  it('should render quick insert palette groups', () => {
    render(UnicodeInspectorWidget);
    expect(screen.getByText('Arrows')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Symbols')).toBeInTheDocument();
  });

  it('should copy character to clipboard on click', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'A' } });

    await waitFor(() => {
      expect(screen.getByText('U+0041')).toBeInTheDocument();
    });

    // Click the codepoint copy button
    const codePointBtn = screen.getByText('U+0041');
    await fireEvent.click(codePointBtn);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('U+0041');
  });

  it('should show copy feedback after copying', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'A' } });

    await waitFor(() => {
      expect(screen.getByText('U+0041')).toBeInTheDocument();
    });

    const codePointBtn = screen.getByText('U+0041');
    await fireEvent.click(codePointBtn);

    expect(screen.getByText('Code point copied!')).toBeInTheDocument();
  });

  it('should have proper aria attributes', () => {
    render(UnicodeInspectorWidget);
    expect(screen.getByRole('application', { name: /unicode character inspector/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('should display multiple characters when multi-char string entered', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'AB' } });

    await waitFor(() => {
      expect(screen.getByText('U+0041')).toBeInTheDocument();
      expect(screen.getByText('U+0042')).toBeInTheDocument();
      expect(screen.getByText('2 characters')).toBeInTheDocument();
    });
  });

  it('should display CSS escape for characters', async () => {
    render(UnicodeInspectorWidget);
    const textarea = screen.getByPlaceholderText('Type or paste characters here...');

    await fireEvent.input(textarea, { target: { value: 'A' } });

    await waitFor(() => {
      expect(screen.getByText('\\41')).toBeInTheDocument();
    });
  });
});
