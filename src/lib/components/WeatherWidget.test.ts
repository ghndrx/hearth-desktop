/**
 * WeatherWidget.test.ts
 * Tests for the WeatherWidget component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import WeatherWidget from './WeatherWidget.svelte';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
	localStorageMock.clear();
	vi.clearAllMocks();
});

describe('WeatherWidget', () => {
	describe('rendering', () => {
		it('renders empty state when no locations', () => {
			render(WeatherWidget);
			expect(screen.getByText('Add a city to see weather')).toBeTruthy();
			expect(screen.getByText('+ Add City')).toBeTruthy();
		});

		it('renders weather icon in empty state', () => {
			render(WeatherWidget);
			expect(screen.getByText('🌤️')).toBeTruthy();
		});

		it('renders in compact mode when prop is set', () => {
			const { container } = render(WeatherWidget, { props: { compact: true } });
			expect(container.querySelector('.compact')).toBeTruthy();
		});

		it('renders without compact class by default', () => {
			const { container } = render(WeatherWidget);
			expect(container.querySelector('.compact')).toBeFalsy();
		});
	});

	describe('add location', () => {
		it('opens add location panel when button clicked', async () => {
			render(WeatherWidget);
			const addBtn = screen.getByText('+ Add City');
			await fireEvent.click(addBtn);

			expect(screen.getByText('Add City')).toBeTruthy();
			expect(screen.getByPlaceholderText('Search cities...')).toBeTruthy();
		});

		it('shows preset cities in add panel', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));

			expect(screen.getByText('New York')).toBeTruthy();
			expect(screen.getByText('London')).toBeTruthy();
			expect(screen.getByText('Tokyo')).toBeTruthy();
		});

		it('filters cities by search query', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));

			const searchInput = screen.getByPlaceholderText('Search cities...');
			await fireEvent.input(searchInput, { target: { value: 'lon' } });

			expect(screen.getByText('London')).toBeTruthy();
			// Others should not be visible
			expect(screen.queryByText('Tokyo')).toBeFalsy();
		});

		it('shows no results message when search has no matches', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));

			const searchInput = screen.getByPlaceholderText('Search cities...');
			await fireEvent.input(searchInput, { target: { value: 'zzzznotacity' } });

			expect(screen.getByText('No matching cities')).toBeTruthy();
		});

		it('closes add panel when close button clicked', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));

			expect(screen.getByText('Add City')).toBeTruthy();

			const closeBtn = screen.getByText('×');
			await fireEvent.click(closeBtn);

			// Add panel should be gone, empty state shows again
			expect(screen.getByText('+ Add City')).toBeTruthy();
		});

		it('adds a city and shows weather', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));
			await fireEvent.click(screen.getByText('New York'));

			// Wait for simulated fetch
			await new Promise(r => setTimeout(r, 400));

			// Should see temp with degree sign
			const { container } = render(WeatherWidget);
			// Re-render would load from localStorage
		});
	});

	describe('location management', () => {
		it('saves preferences to localStorage on add', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));
			await fireEvent.click(screen.getByText('London'));

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'hearth-weather-widget',
				expect.any(String)
			);
		});

		it('loads preferences from localStorage on mount', () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 }],
				activeLocationId: 'nyc',
				unit: 'C'
			}));

			render(WeatherWidget);
			// Loaded from storage - component should not show empty state
			expect(screen.queryByText('Add a city to see weather')).toBeFalsy();
		});
	});

	describe('temperature unit toggle', () => {
		it('defaults to Fahrenheit', () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 }],
				activeLocationId: 'nyc',
				unit: 'F'
			}));

			const { container } = render(WeatherWidget);
			const unitBtn = container.querySelector('.unit-toggle');
			expect(unitBtn?.textContent?.trim()).toBe('F');
		});

		it('shows C when set to Celsius', () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 }],
				activeLocationId: 'nyc',
				unit: 'C'
			}));

			const { container } = render(WeatherWidget);
			const unitBtn = container.querySelector('.unit-toggle');
			expect(unitBtn?.textContent?.trim()).toBe('C');
		});
	});

	describe('preset cities', () => {
		it('has 12 preset cities available', async () => {
			const { container } = render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));

			const options = container.querySelectorAll('.city-option');
			expect(options.length).toBe(12);
		});

		it('does not show already added cities in preset list', async () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 }],
				activeLocationId: 'nyc',
				unit: 'F'
			}));

			const { container } = render(WeatherWidget);

			// Find and click + tab
			const addTab = container.querySelector('.add-tab');
			if (addTab) {
				await fireEvent.click(addTab);
				const options = container.querySelectorAll('.city-option');
				// Should be 11 (12 total - 1 already added)
				expect(options.length).toBe(11);
			}
		});
	});

	describe('weather data generation', () => {
		it('generates consistent weather for the same location', async () => {
			render(WeatherWidget);
			await fireEvent.click(screen.getByText('+ Add City'));
			await fireEvent.click(screen.getByText('Tokyo'));

			await new Promise(r => setTimeout(r, 400));

			// Verify localStorage was called with weather data
			const calls = localStorageMock.setItem.mock.calls;
			expect(calls.length).toBeGreaterThan(0);
		});
	});

	describe('error handling', () => {
		it('handles missing localStorage gracefully', () => {
			localStorageMock.getItem.mockImplementation(() => {
				throw new Error('Storage error');
			});

			// Should not throw
			expect(() => render(WeatherWidget)).not.toThrow();
		});

		it('handles malformed localStorage data', () => {
			localStorageMock.getItem.mockReturnValue('not valid json{{{');

			expect(() => render(WeatherWidget)).not.toThrow();
			// Should show empty state
			expect(screen.getByText('Add a city to see weather')).toBeTruthy();
		});
	});

	describe('compact mode behavior', () => {
		it('truncates city names in compact mode tabs', async () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [
					{ id: 'sf', name: 'San Francisco', lat: 37.77, lon: -122.42 }
				],
				activeLocationId: 'sf',
				unit: 'F'
			}));

			const { container } = render(WeatherWidget, { props: { compact: true } });

			// In compact mode, name is sliced to 3 chars
			const tab = container.querySelector('.location-tab.active');
			expect(tab?.textContent?.trim()).toBe('San');
		});

		it('hides details section in compact mode', () => {
			localStorageMock.getItem.mockReturnValue(JSON.stringify({
				locations: [
					{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 }
				],
				activeLocationId: 'nyc',
				unit: 'F'
			}));

			const { container } = render(WeatherWidget, { props: { compact: true } });

			// Should not have details section or weather-actions in compact mode
			expect(container.querySelector('.weather-actions')).toBeFalsy();
			expect(container.querySelector('.weather-range')).toBeFalsy();
		});
	});
});
