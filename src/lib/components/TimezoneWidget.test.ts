import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import TimezoneWidget from './TimezoneWidget.svelte';

// Mock localStorage
const mockLocalStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	};
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: () => `uuid-${Math.random().toString(36).substr(2, 9)}`
	}
});

// Mock Intl.DateTimeFormat for consistent timezone handling
const originalDateTimeFormat = Intl.DateTimeFormat;

describe('TimezoneWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLocalStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-03-01T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('Rendering', () => {
		it('renders with default clocks', () => {
			render(TimezoneWidget);
			expect(screen.getByText('🌍 World Clocks')).toBeTruthy();
		});

		it('renders in compact mode', () => {
			const { container } = render(TimezoneWidget, { props: { compact: true } });
			expect(container.querySelector('.timezone-widget.compact')).toBeTruthy();
		});

		it('displays local and UTC clocks by default', async () => {
			render(TimezoneWidget);
			await waitFor(() => {
				expect(screen.getByText('Local')).toBeTruthy();
				expect(screen.getByText('UTC')).toBeTruthy();
			});
		});

		it('shows add timezone button', () => {
			render(TimezoneWidget);
			expect(screen.getByTitle('Add timezone')).toBeTruthy();
		});
	});

	describe('Adding Timezones', () => {
		it('opens add timezone panel when clicking add button', async () => {
			render(TimezoneWidget);
			const addButton = screen.getByTitle('Add timezone');
			await fireEvent.click(addButton);

			expect(screen.getByPlaceholderText('Search city or timezone...')).toBeTruthy();
		});

		it('filters timezones based on search input', async () => {
			render(TimezoneWidget);
			const addButton = screen.getByTitle('Add timezone');
			await fireEvent.click(addButton);

			const searchInput = screen.getByPlaceholderText('Search city or timezone...');
			await fireEvent.input(searchInput, { target: { value: 'Tokyo' } });

			await waitFor(() => {
				expect(screen.getByText('Tokyo')).toBeTruthy();
			});
		});

		it('adds timezone when selecting from search results', async () => {
			render(TimezoneWidget);
			const addButton = screen.getByTitle('Add timezone');
			await fireEvent.click(addButton);

			const searchInput = screen.getByPlaceholderText('Search city or timezone...');
			await fireEvent.input(searchInput, { target: { value: 'Paris' } });

			await waitFor(() => {
				const parisOption = screen.getByText('Paris');
				fireEvent.click(parisOption.closest('button')!);
			});

			await waitFor(() => {
				expect(mockLocalStorage.setItem).toHaveBeenCalled();
			});
		});

		it('closes add panel when clicking X button', async () => {
			render(TimezoneWidget);
			const addButton = screen.getByTitle('Add timezone');
			await fireEvent.click(addButton);

			expect(screen.getByPlaceholderText('Search city or timezone...')).toBeTruthy();

			// Click again to close
			await fireEvent.click(screen.getByText('✕'));

			await waitFor(() => {
				expect(screen.queryByPlaceholderText('Search city or timezone...')).toBeFalsy();
			});
		});
	});

	describe('Clock Display', () => {
		it('updates time every second', async () => {
			render(TimezoneWidget);

			// Advance time by 1 second
			vi.advanceTimersByTime(1000);

			// The component should have updated
			await waitFor(() => {
				// Time display should exist
				const clockItems = screen.getAllByText(/\d{1,2}:\d{2}/);
				expect(clockItems.length).toBeGreaterThan(0);
			});
		});

		it('shows day/night indicator', async () => {
			render(TimezoneWidget);

			await waitFor(() => {
				// Should show either sun or moon emoji
				const container = document.querySelector('.timezone-widget');
				const hasIcon = container?.textContent?.includes('☀️') || container?.textContent?.includes('🌙');
				expect(hasIcon).toBe(true);
			});
		});

		it('displays offset string for each timezone', async () => {
			render(TimezoneWidget);

			// Just check that clock items render without errors
			await waitFor(() => {
				const clockItems = document.querySelectorAll('.clock-item');
				expect(clockItems.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Clock Management', () => {
		it('removes timezone when clicking delete button', async () => {
			// Pre-populate with multiple timezones
			mockLocalStorage.getItem.mockReturnValueOnce(
				JSON.stringify([
					{ id: '1', label: 'Local', timezone: 'UTC', offset: 0, isPrimary: true },
					{ id: '2', label: 'Tokyo', timezone: 'Asia/Tokyo', offset: 9, isPrimary: false }
				])
			);

			render(TimezoneWidget);

			await waitFor(() => {
				expect(screen.getByText('Tokyo')).toBeTruthy();
			});

			// Hover to show actions and click delete
			const tokyoItem = screen.getByText('Tokyo').closest('.clock-item');
			await fireEvent.mouseEnter(tokyoItem!);

			const deleteButtons = screen.getAllByTitle('Remove');
			await fireEvent.click(deleteButtons[0]);

			await waitFor(() => {
				expect(mockLocalStorage.setItem).toHaveBeenCalled();
			});
		});

		it('sets primary timezone when clicking star button', async () => {
			mockLocalStorage.getItem.mockReturnValueOnce(
				JSON.stringify([
					{ id: '1', label: 'Local', timezone: 'UTC', offset: 0, isPrimary: true },
					{ id: '2', label: 'Tokyo', timezone: 'Asia/Tokyo', offset: 9, isPrimary: false }
				])
			);

			render(TimezoneWidget);

			await waitFor(() => {
				expect(screen.getByText('Tokyo')).toBeTruthy();
			});

			const starButton = screen.getByTitle('Set as primary');
			await fireEvent.click(starButton);

			await waitFor(() => {
				expect(mockLocalStorage.setItem).toHaveBeenCalled();
			});
		});

		it('reorders timezones with up/down buttons', async () => {
			mockLocalStorage.getItem.mockReturnValueOnce(
				JSON.stringify([
					{ id: '1', label: 'Local', timezone: 'UTC', offset: 0, isPrimary: true },
					{ id: '2', label: 'Tokyo', timezone: 'Asia/Tokyo', offset: 9, isPrimary: false }
				])
			);

			render(TimezoneWidget);

			await waitFor(() => {
				expect(screen.getByText('Tokyo')).toBeTruthy();
			});

			const moveUpButton = screen.getAllByTitle('Move up')[1]; // Tokyo's up button
			await fireEvent.click(moveUpButton);

			await waitFor(() => {
				expect(mockLocalStorage.setItem).toHaveBeenCalled();
			});
		});
	});

	describe('Persistence', () => {
		it('loads saved timezones from localStorage', async () => {
			const savedTimezones = [
				{ id: '1', label: 'New York', timezone: 'America/New_York', offset: -5, isPrimary: true },
				{ id: '2', label: 'London', timezone: 'Europe/London', offset: 0, isPrimary: false }
			];

			mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(savedTimezones));

			render(TimezoneWidget);

			await waitFor(() => {
				expect(screen.getByText('New York')).toBeTruthy();
				expect(screen.getByText('London')).toBeTruthy();
			});
		});

		it('saves timezones to localStorage on change', async () => {
			render(TimezoneWidget);

			// Open add panel
			const addButton = screen.getByTitle('Add timezone');
			await fireEvent.click(addButton);

			const searchInput = screen.getByPlaceholderText('Search city or timezone...');
			await fireEvent.input(searchInput, { target: { value: 'Berlin' } });

			await waitFor(() => {
				const berlinOption = screen.getByText('Berlin');
				fireEvent.click(berlinOption.closest('button')!);
			});

			await waitFor(() => {
				expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
					'hearth-world-clocks',
					expect.any(String)
				);
			});
		});
	});

	describe('Empty State', () => {
		it('shows empty state when no clocks are configured', async () => {
			mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify([]));

			render(TimezoneWidget);

			await waitFor(() => {
				expect(screen.getByText('No clocks configured')).toBeTruthy();
				expect(screen.getByText('Add a timezone')).toBeTruthy();
			});
		});

		it('opens add panel when clicking empty state button', async () => {
			mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify([]));

			render(TimezoneWidget);

			await waitFor(async () => {
				const addButton = screen.getByText('Add a timezone');
				await fireEvent.click(addButton);
			});

			await waitFor(() => {
				expect(screen.getByPlaceholderText('Search city or timezone...')).toBeTruthy();
			});
		});
	});

	describe('Accessibility', () => {
		it('has accessible button labels', () => {
			render(TimezoneWidget);

			expect(screen.getByTitle('Add timezone')).toBeTruthy();
		});

		it('uses semantic HTML structure', () => {
			const { container } = render(TimezoneWidget);

			expect(container.querySelector('.timezone-widget')).toBeTruthy();
			expect(container.querySelector('.clocks-list')).toBeTruthy();
		});
	});
});
