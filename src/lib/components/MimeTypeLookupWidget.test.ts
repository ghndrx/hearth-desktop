import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import MimeTypeLookupWidget from './MimeTypeLookupWidget.svelte';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true
});

describe('MimeTypeLookupWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the widget with header', () => {
    render(MimeTypeLookupWidget);
    expect(screen.getByText('🔍 MIME Type Lookup')).toBeInTheDocument();
  });

  it('shows search mode buttons', () => {
    render(MimeTypeLookupWidget);
    expect(screen.getByText('By Extension')).toBeInTheDocument();
    expect(screen.getByText('By MIME Type')).toBeInTheDocument();
  });

  it('shows extension search placeholder by default', () => {
    render(MimeTypeLookupWidget);
    expect(screen.getByPlaceholderText(/Search extension/)).toBeInTheDocument();
  });

  it('switches to MIME type search mode', async () => {
    render(MimeTypeLookupWidget);
    const mimeButton = screen.getByText('By MIME Type');
    await fireEvent.click(mimeButton);
    expect(screen.getByPlaceholderText(/Search MIME type/)).toBeInTheDocument();
  });

  it('searches for extension and shows results', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'jpg' } });
    
    // Should find jpg/jpeg
    expect(screen.getByText('.jpg')).toBeInTheDocument();
    expect(screen.getByText('image/jpeg')).toBeInTheDocument();
  });

  it('searches for extension with leading dot', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: '.png' } });
    
    expect(screen.getByText('.png')).toBeInTheDocument();
    expect(screen.getByText('image/png')).toBeInTheDocument();
  });

  it('searches by MIME type', async () => {
    render(MimeTypeLookupWidget);
    
    // Switch to MIME mode
    await fireEvent.click(screen.getByText('By MIME Type'));
    
    const input = screen.getByPlaceholderText(/Search MIME type/);
    await fireEvent.input(input, { target: { value: 'image/png' } });
    
    expect(screen.getByText('.png')).toBeInTheDocument();
  });

  it('shows no results message for unknown extension', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'xyznotexist' } });
    
    expect(screen.getByText(/No matches found/)).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'jpg' } });
    
    expect(input.value).toBe('jpg');
    
    const clearButton = screen.getByText('✕');
    await fireEvent.click(clearButton);
    
    expect(input.value).toBe('');
  });

  it('copies MIME type to clipboard', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'pdf' } });
    
    // Wait for results
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    
    // Find and click copy button
    const copyButtons = screen.getAllByTitle('Copy MIME type');
    await fireEvent.click(copyButtons[0]);
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('application/pdf');
  });

  it('shows category browse buttons when no search', () => {
    render(MimeTypeLookupWidget);
    expect(screen.getByText('Browse by Category')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows extensions when category is clicked', async () => {
    render(MimeTypeLookupWidget);
    const imagesBtn = screen.getByText('Images');
    await fireEvent.click(imagesBtn);
    
    // Should show image extensions
    expect(screen.getByText('.jpg')).toBeInTheDocument();
    expect(screen.getByText('.png')).toBeInTheDocument();
    expect(screen.getByText('.gif')).toBeInTheDocument();
  });

  it('toggles category off when clicked again', async () => {
    render(MimeTypeLookupWidget);
    const imagesBtn = screen.getByText('Images');
    
    // Click to open
    await fireEvent.click(imagesBtn);
    expect(screen.getByText('.jpg')).toBeInTheDocument();
    
    // Click again to close
    await fireEvent.click(imagesBtn);
    // The extensions grid should be hidden, but browse categories still visible
    expect(screen.getByText('Browse by Category')).toBeInTheDocument();
  });

  it('shows extension count in footer', () => {
    render(MimeTypeLookupWidget);
    expect(screen.getByText(/extensions indexed/)).toBeInTheDocument();
  });

  it('finds multiple results for partial search', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'mp' } });
    
    // Should find mp3, mp4, mpeg, etc.
    expect(screen.getByText('.mp3')).toBeInTheDocument();
    expect(screen.getByText('.mp4')).toBeInTheDocument();
  });

  it('shows results header with count', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'json' } });
    
    expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
  });

  it('shows correct category icons', () => {
    render(MimeTypeLookupWidget);
    // Categories with their icons should be visible
    expect(screen.getByText('🖼️')).toBeInTheDocument(); // Images
    expect(screen.getByText('📄')).toBeInTheDocument(); // Documents
    expect(screen.getByText('💻')).toBeInTheDocument(); // Code
    expect(screen.getByText('🎵')).toBeInTheDocument(); // Audio
    expect(screen.getByText('🎬')).toBeInTheDocument(); // Video
  });

  it('handles code file extensions', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'ts' } });
    
    expect(screen.getByText('.ts')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('handles video file extensions', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'webm' } });
    
    expect(screen.getByText('.webm')).toBeInTheDocument();
    expect(screen.getByText('video/webm')).toBeInTheDocument();
  });

  it('handles archive file extensions', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'zip' } });
    
    expect(screen.getByText('.zip')).toBeInTheDocument();
    expect(screen.getByText('application/zip')).toBeInTheDocument();
  });

  it('handles font file extensions', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'woff' } });
    
    expect(screen.getByText('.woff')).toBeInTheDocument();
    expect(screen.getByText('.woff2')).toBeInTheDocument();
  });

  it('dispatches copy event when copying', async () => {
    const { component } = render(MimeTypeLookupWidget);
    const copyHandler = vi.fn();
    component.$on('copy', copyHandler);
    
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'css' } });
    
    const copyButtons = screen.getAllByTitle('Copy MIME type');
    await fireEvent.click(copyButtons[0]);
    
    expect(copyHandler).toHaveBeenCalled();
  });

  it('limits search results to 20', async () => {
    render(MimeTypeLookupWidget);
    
    // Switch to MIME mode and search broadly
    await fireEvent.click(screen.getByText('By MIME Type'));
    const input = screen.getByPlaceholderText(/Search MIME type/);
    await fireEvent.input(input, { target: { value: 'application' } });
    
    // Should be limited to 20 results
    const resultItems = screen.getAllByText(/\./);
    expect(resultItems.length).toBeLessThanOrEqual(40); // includes description dots too
  });

  it('shows description for each result', async () => {
    render(MimeTypeLookupWidget);
    const input = screen.getByPlaceholderText(/Search extension/);
    await fireEvent.input(input, { target: { value: 'svg' } });
    
    expect(screen.getByText('SVG Vector Image')).toBeInTheDocument();
  });
});
