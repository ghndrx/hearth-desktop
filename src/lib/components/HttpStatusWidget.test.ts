import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import HttpStatusWidget from './HttpStatusWidget.svelte';

describe('HttpStatusWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the widget header', () => {
		render(HttpStatusWidget);
		expect(screen.getByText('HTTP Status Codes')).toBeInTheDocument();
	});

	it('displays all status codes by default', () => {
		render(HttpStatusWidget);
		// Check for some common codes
		expect(screen.getByText('200')).toBeInTheDocument();
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.getByText('500')).toBeInTheDocument();
	});

	it('shows status code names', () => {
		render(HttpStatusWidget);
		expect(screen.getByText('OK')).toBeInTheDocument();
		expect(screen.getByText('Not Found')).toBeInTheDocument();
		expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
	});

	it('filters by search query', async () => {
		render(HttpStatusWidget);
		const searchInput = screen.getByPlaceholderText('Search by code, name, or description...');
		
		await fireEvent.input(searchInput, { target: { value: '404' } });
		
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.getByText('Not Found')).toBeInTheDocument();
		// Other codes should be filtered out
		expect(screen.queryByText('200')).not.toBeInTheDocument();
	});

	it('filters by category', async () => {
		render(HttpStatusWidget);
		
		// Click on 2xx Success category
		const successButton = screen.getByText('2xx Success');
		await fireEvent.click(successButton);
		
		// Should show 200 OK
		expect(screen.getByText('200')).toBeInTheDocument();
		expect(screen.getByText('OK')).toBeInTheDocument();
		// Should not show 404
		expect(screen.queryByText('404')).not.toBeInTheDocument();
	});

	it('filters by 4xx client errors', async () => {
		render(HttpStatusWidget);
		
		const clientButton = screen.getByText('4xx Client');
		await fireEvent.click(clientButton);
		
		expect(screen.getByText('400')).toBeInTheDocument();
		expect(screen.getByText('401')).toBeInTheDocument();
		expect(screen.getByText('404')).toBeInTheDocument();
		// Should not show 2xx codes
		expect(screen.queryByText('200')).not.toBeInTheDocument();
	});

	it('filters by 5xx server errors', async () => {
		render(HttpStatusWidget);
		
		const serverButton = screen.getByText('5xx Server');
		await fireEvent.click(serverButton);
		
		expect(screen.getByText('500')).toBeInTheDocument();
		expect(screen.getByText('502')).toBeInTheDocument();
		expect(screen.getByText('503')).toBeInTheDocument();
	});

	it('shows code count', () => {
		render(HttpStatusWidget);
		// Should show a count in the header
		const countElement = screen.getByText(/\d+ codes/);
		expect(countElement).toBeInTheDocument();
	});

	it('expands status code details on click', async () => {
		render(HttpStatusWidget);
		
		// Find and click the 200 status code row
		const okStatus = screen.getByText('OK');
		const statusRow = okStatus.closest('[role="button"]');
		
		if (statusRow) {
			await fireEvent.click(statusRow);
			
			// Should show expanded details
			expect(screen.getByText('Category:')).toBeInTheDocument();
		}
	});

	it('copies code to clipboard', async () => {
		const mockWriteText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: {
				writeText: mockWriteText
			}
		});

		render(HttpStatusWidget);
		
		// Find copy buttons
		const copyButtons = screen.getAllByTitle('Copy code');
		expect(copyButtons.length).toBeGreaterThan(0);
		
		await fireEvent.click(copyButtons[0]);
		
		expect(mockWriteText).toHaveBeenCalled();
	});

	it('shows search results message when no codes found', async () => {
		render(HttpStatusWidget);
		
		const searchInput = screen.getByPlaceholderText('Search by code, name, or description...');
		await fireEvent.input(searchInput, { target: { value: 'xyznonexistent' } });
		
		expect(screen.getByText('No status codes found')).toBeInTheDocument();
	});

	it('filters by search term in description', async () => {
		render(HttpStatusWidget);
		
		const searchInput = screen.getByPlaceholderText('Search by code, name, or description...');
		await fireEvent.input(searchInput, { target: { value: 'authentication' } });
		
		// 401 has "Authentication" in its description
		expect(screen.getByText('401')).toBeInTheDocument();
		expect(screen.getByText('Unauthorized')).toBeInTheDocument();
	});

	it('includes the teapot easter egg', () => {
		render(HttpStatusWidget);
		expect(screen.getByText("I'm a Teapot")).toBeInTheDocument();
	});

	it('shows all category button', () => {
		render(HttpStatusWidget);
		expect(screen.getByText('All')).toBeInTheDocument();
	});

	it('shows 1xx Info category button', () => {
		render(HttpStatusWidget);
		expect(screen.getByText('1xx Info')).toBeInTheDocument();
	});

	it('shows 3xx Redirect category button', () => {
		render(HttpStatusWidget);
		expect(screen.getByText('3xx Redirect')).toBeInTheDocument();
	});

	it('allows keyboard navigation for expansion', async () => {
		render(HttpStatusWidget);
		
		const okStatus = screen.getByText('OK');
		const statusRow = okStatus.closest('[role="button"]');
		
		if (statusRow) {
			await fireEvent.keyDown(statusRow, { key: 'Enter' });
			
			// Should show expanded details
			expect(screen.getByText('Category:')).toBeInTheDocument();
		}
	});

	it('collapses details when clicking again', async () => {
		render(HttpStatusWidget);
		
		const okStatus = screen.getByText('OK');
		const statusRow = okStatus.closest('[role="button"]');
		
		if (statusRow) {
			// First click - expand
			await fireEvent.click(statusRow);
			expect(screen.getByText('Category:')).toBeInTheDocument();
			
			// Second click - collapse
			await fireEvent.click(statusRow);
			// Category should no longer be visible as expanded
			const categories = screen.queryAllByText('Category:');
			expect(categories.length).toBe(0);
		}
	});

	it('displays footer help text', () => {
		render(HttpStatusWidget);
		expect(
			screen.getByText('Click a status code to expand details • Click copy icon to copy code')
		).toBeInTheDocument();
	});

	it('combines category filter with search', async () => {
		render(HttpStatusWidget);
		
		// First filter by 4xx
		const clientButton = screen.getByText('4xx Client');
		await fireEvent.click(clientButton);
		
		// Then search for "auth"
		const searchInput = screen.getByPlaceholderText('Search by code, name, or description...');
		await fireEvent.input(searchInput, { target: { value: 'auth' } });
		
		// Should show 401 and 407 (both 4xx with auth in name/description)
		expect(screen.getByText('401')).toBeInTheDocument();
		expect(screen.getByText('407')).toBeInTheDocument();
		// Should not show 200 (not 4xx)
		expect(screen.queryByText('200')).not.toBeInTheDocument();
	});
});
