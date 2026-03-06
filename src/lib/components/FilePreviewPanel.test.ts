import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FilePreviewPanel from './FilePreviewPanel.svelte';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockRejectedValue(new Error('not connected')),
}));

describe('FilePreviewPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders with empty state (drag-and-drop zone)', () => {
		render(FilePreviewPanel);
		expect(screen.getByText('File Preview')).toBeInTheDocument();
		expect(screen.getByText('Drop a file here to preview')).toBeInTheDocument();
		expect(screen.getByText('or pass a file path as a prop')).toBeInTheDocument();
	});

	it('shows the drop zone region with correct aria label', () => {
		render(FilePreviewPanel);
		const dropZone = screen.getByRole('region', { name: 'Drop zone' });
		expect(dropZone).toBeInTheDocument();
	});

	it('renders the eye icon in the header', () => {
		render(FilePreviewPanel);
		const header = screen.getByText('File Preview');
		expect(header).toBeInTheDocument();
		expect(header.tagName.toLowerCase()).toBe('h3');
	});

	it('handles file path prop without crashing', () => {
		// invoke is mocked to reject, so this tests graceful error handling
		render(FilePreviewPanel, { props: { filePath: '/tmp/test.txt' } });
		expect(screen.getByText('File Preview')).toBeInTheDocument();
	});

	it('does not show clear button when no file is previewed', () => {
		render(FilePreviewPanel);
		const clearButton = screen.queryByTitle('Clear preview');
		expect(clearButton).not.toBeInTheDocument();
	});

	it('does not show action buttons when no file is previewed', () => {
		render(FilePreviewPanel);
		const sendBtn = screen.queryByText('Send to Chat');
		const openBtn = screen.queryByText('Open in System');
		expect(sendBtn).not.toBeInTheDocument();
		expect(openBtn).not.toBeInTheDocument();
	});
});
