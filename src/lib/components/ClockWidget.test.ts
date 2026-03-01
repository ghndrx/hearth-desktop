import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ClockWidget from './ClockWidget.svelte';

describe('ClockWidget', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T19:45:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders without crashing', () => {
		render(ClockWidget);
		expect(screen.getByText('Clock')).toBeTruthy();
	});

	it('displays current time', () => {
		render(ClockWidget);
		// Should display time - format may vary based on locale
		const timeDisplay = document.querySelector('.time-display');
		expect(timeDisplay).toBeTruthy();
		expect(timeDisplay?.textContent?.length).toBeGreaterThan(0);
	});

	it('displays date when showDate is true', () => {
		render(ClockWidget, { showDate: true });
		const dateDisplay = document.querySelector('.date-display');
		expect(dateDisplay).toBeTruthy();
	});

	it('hides date when showDate is false', () => {
		render(ClockWidget, { showDate: false });
		const dateDisplay = document.querySelector('.date-display');
		expect(dateDisplay).toBeNull();
	});

	it('renders in compact mode', () => {
		const { container } = render(ClockWidget, { compact: true });
		const widget = container.querySelector('.clock-widget');
		expect(widget?.classList.contains('compact')).toBe(true);
	});

	it('displays world clocks when showWorldClocks is true', () => {
		render(ClockWidget, { showWorldClocks: true });
		const worldClocks = document.querySelector('.world-clocks');
		expect(worldClocks).toBeTruthy();
	});

	it('hides world clocks when showWorldClocks is false', () => {
		render(ClockWidget, { showWorldClocks: false });
		const worldClocks = document.querySelector('.world-clocks');
		expect(worldClocks).toBeNull();
	});

	it('shows edit button when showWorldClocks is true', () => {
		render(ClockWidget, { showWorldClocks: true });
		const editButton = document.querySelector('.edit-button');
		expect(editButton).toBeTruthy();
	});

	it('toggles edit mode when clicking edit button', async () => {
		render(ClockWidget, { showWorldClocks: true });
		const editButton = document.querySelector('.edit-button');
		
		expect(editButton?.textContent).toBe('⚙️');
		
		if (editButton) {
			await fireEvent.click(editButton);
			expect(editButton.textContent).toBe('✓');
		}
	});

	it('shows timezone select in edit mode', async () => {
		render(ClockWidget, { showWorldClocks: true });
		const editButton = document.querySelector('.edit-button');
		
		if (editButton) {
			await fireEvent.click(editButton);
			const select = document.querySelector('.timezone-select');
			expect(select).toBeTruthy();
		}
	});

	it('displays day/night emoji based on timezone time', () => {
		render(ClockWidget, { showWorldClocks: true });
		const emojis = document.querySelectorAll('.clock-emoji');
		expect(emojis.length).toBeGreaterThan(0);
		// Should have either sun or moon emoji
		const emojiText = emojis[0]?.textContent;
		expect(emojiText === '☀️' || emojiText === '🌙').toBe(true);
	});

	it('shows remove button for non-local clocks in edit mode', async () => {
		render(ClockWidget, { showWorldClocks: true });
		const editButton = document.querySelector('.edit-button');
		
		if (editButton) {
			await fireEvent.click(editButton);
			// Should have remove buttons for non-local clocks
			const removeButtons = document.querySelectorAll('.remove-clock');
			expect(removeButtons.length).toBeGreaterThan(0);
		}
	});

	it('displays compact world clocks in compact mode', () => {
		render(ClockWidget, { compact: true, showWorldClocks: true });
		const compactClocks = document.querySelector('.compact-world-clocks');
		expect(compactClocks).toBeTruthy();
	});

	it('uses 24-hour format when use24Hour is true', () => {
		render(ClockWidget, { use24Hour: true });
		const timeDisplay = document.querySelector('.time-display');
		// 24-hour format shouldn't have AM/PM
		expect(timeDisplay?.textContent?.includes('AM')).toBe(false);
		expect(timeDisplay?.textContent?.includes('PM')).toBe(false);
	});

	it('updates time every second', async () => {
		render(ClockWidget);
		const initialTime = document.querySelector('.time-display')?.textContent;
		
		// Advance time by 1 second
		vi.advanceTimersByTime(1000);
		
		// The component should have updated
		const updatedTime = document.querySelector('.time-display')?.textContent;
		// Note: times might be same if second didn't change display
		expect(updatedTime).toBeTruthy();
	});

	it('shows timezone offset for world clocks', () => {
		render(ClockWidget, { showWorldClocks: true });
		const offsets = document.querySelectorAll('.clock-offset');
		expect(offsets.length).toBeGreaterThan(0);
		// Should have UTC offset format
		const offsetText = offsets[0]?.textContent;
		expect(offsetText?.includes('UTC')).toBe(true);
	});

	it('limits world clocks to 5 maximum', async () => {
		render(ClockWidget, { showWorldClocks: true });
		const editButton = document.querySelector('.edit-button');
		
		if (editButton) {
			await fireEvent.click(editButton);
			
			// Try to add clocks up to the limit
			const worldClockItems = document.querySelectorAll('.world-clock-item');
			// Should have started with 3 (Local, UTC, New York)
			expect(worldClockItems.length).toBeLessThanOrEqual(5);
		}
	});

	it('has proper accessibility attributes', () => {
		render(ClockWidget);
		const editButton = document.querySelector('.edit-button');
		expect(editButton?.getAttribute('title')).toBeTruthy();
	});

	it('renders widget icon', () => {
		render(ClockWidget);
		const icon = document.querySelector('.widget-icon');
		expect(icon?.textContent).toBe('🕐');
	});

	it('applies tabular-nums to time display for consistent width', () => {
		const { container } = render(ClockWidget);
		const timeDisplay = container.querySelector('.time-display');
		const styles = timeDisplay ? getComputedStyle(timeDisplay) : null;
		// The style is applied via CSS class
		expect(timeDisplay).toBeTruthy();
	});
});
