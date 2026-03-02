import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import ClipboardHistoryWidget from './ClipboardHistoryWidget.svelte';

// Mock the tauri module
vi.mock('$lib/tauri', () => ({
	clipboardHistory: {
		getHistory: vi.fn(),
		pasteEntry: vi.fn(),
		removeEntry: vi.fn(),
		clearHistory: vi.fn(),
	},
}));

import { clipboardHistory } from '$lib/tauri';

const mockEntries = [
	{
		id: '1',
		content: { type: 'Text' as const, data: 'Hello, World!' },
		timestamp: Date.now() - 30000, // 30 seconds ago
		source: 'copy',
	},
	{
		id: '2',
		content: { type: 'Text' as const, data: 'Lorem ipsum dolor sit amet' },
		timestamp: Date.now() - 3600000, // 1 hour ago
		source: 'copy',
	},
	{
		id: '3',
		content: { type: 'Image' as const, data: { base64: 'abc123', width: 100, height: 50, format: 'png' } },
		timestamp: Date.now() - 7200000, // 2 hours ago
		source: 'copy_image',
	},
];

describe('ClipboardHistoryWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		(clipboardHistory.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntries);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders loading state initially', () => {
		render(ClipboardHistoryWidget);
		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	it('renders clipboard entries after loading', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		expect(screen.getByText('Lorem ipsum dolor sit amet')).toBeInTheDocument();
		expect(screen.getByText('Image (100×50)')).toBeInTheDocument();
	});

	it('shows correct icons for different content types', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getAllByText('📝')).toHaveLength(2); // Two text entries
			expect(screen.getByText('🖼️')).toBeInTheDocument(); // One image entry
		});
	});

	it('shows empty state when no history', async () => {
		(clipboardHistory.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('No clipboard history')).toBeInTheDocument();
		});
	});

	it('handles paste entry on click', async () => {
		(clipboardHistory.pasteEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'Text', data: 'Hello, World!' });
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const entry = screen.getByText('Hello, World!').closest('button');
		await fireEvent.click(entry!);
		
		expect(clipboardHistory.pasteEntry).toHaveBeenCalledWith('1');
	});

	it('shows copied badge after pasting', async () => {
		(clipboardHistory.pasteEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'Text', data: 'Hello, World!' });
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const entry = screen.getByText('Hello, World!').closest('button');
		await fireEvent.click(entry!);
		
		await waitFor(() => {
			expect(screen.getByText('✓')).toBeInTheDocument();
		});
	});

	it('handles clear history', async () => {
		(clipboardHistory.clearHistory as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const clearBtn = screen.getByTitle('Clear history');
		await fireEvent.click(clearBtn);
		
		expect(clipboardHistory.clearHistory).toHaveBeenCalled();
	});

	it('handles remove entry', async () => {
		(clipboardHistory.removeEntry as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		// Hover to show remove button (in reality this is CSS-based)
		const removeBtn = screen.getAllByTitle('Remove')[0];
		await fireEvent.click(removeBtn);
		
		expect(clipboardHistory.removeEntry).toHaveBeenCalledWith('1');
	});

	it('displays relative timestamps correctly', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Just now')).toBeInTheDocument();
			expect(screen.getByText('1h ago')).toBeInTheDocument();
			expect(screen.getByText('2h ago')).toBeInTheDocument();
		});
	});

	it('renders in compact mode', async () => {
		render(ClipboardHistoryWidget, { props: { compact: true } });
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		// In compact mode, title and timestamps should not be visible
		expect(screen.queryByText('Clipboard History')).not.toBeInTheDocument();
	});

	it('filters entries by search query', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const searchInput = screen.getByPlaceholderText('Search...');
		await fireEvent.input(searchInput, { target: { value: 'Lorem' } });
		
		await waitFor(() => {
			expect(screen.queryByText('Hello, World!')).not.toBeInTheDocument();
			expect(screen.getByText('Lorem ipsum dolor sit amet')).toBeInTheDocument();
		});
	});

	it('shows no matches message when search has no results', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const searchInput = screen.getByPlaceholderText('Search...');
		await fireEvent.input(searchInput, { target: { value: 'xyz123notfound' } });
		
		await waitFor(() => {
			expect(screen.getByText('No matches found')).toBeInTheDocument();
		});
	});

	it('shows item count in footer', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('3 items')).toBeInTheDocument();
		});
	});

	it('handles error state', async () => {
		(clipboardHistory.getHistory as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Network error')).toBeInTheDocument();
		});
	});

	it('refreshes history on button click', async () => {
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
		
		const refreshBtn = screen.getByTitle('Refresh');
		await fireEvent.click(refreshBtn);
		
		expect(clipboardHistory.getHistory).toHaveBeenCalledTimes(2);
	});

	it('respects maxItems prop', async () => {
		render(ClipboardHistoryWidget, { props: { maxItems: 5 } });
		
		await waitFor(() => {
			expect(clipboardHistory.getHistory).toHaveBeenCalledWith(5);
		});
	});

	it('truncates long text content', async () => {
		const longText = 'A'.repeat(150);
		(clipboardHistory.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'long',
				content: { type: 'Text' as const, data: longText },
				timestamp: Date.now(),
				source: 'copy',
			},
		]);
		
		render(ClipboardHistoryWidget);
		
		await waitFor(() => {
			const preview = screen.getByText(/^A+\.\.\.$/);
			expect(preview.textContent?.length).toBeLessThan(150);
		});
	});
});
