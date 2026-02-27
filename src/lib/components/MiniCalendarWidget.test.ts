import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MiniCalendarWidget from './MiniCalendarWidget.svelte';

describe('MiniCalendarWidget', () => {
	const mockDate = new Date(2026, 1, 27); // Feb 27, 2026

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(mockDate);
	});

	it('renders the calendar with current month', () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });
		expect(screen.getByText('February 2026')).toBeTruthy();
	});

	it('displays all weekday headers', () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		days.forEach((day) => {
			expect(screen.getByText(day)).toBeTruthy();
		});
	});

	it('renders compact mode with short day names', () => {
		render(MiniCalendarWidget, { selectedDate: mockDate, compact: true });
		// Compact mode uses single letters; check for 'S' (Sun/Sat)
		const sElements = screen.getAllByText('S');
		expect(sElements.length).toBeGreaterThanOrEqual(2);
	});

	it('highlights today', () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });
		const todayButton = screen.getByRole('gridcell', { name: /27/ });
		expect(todayButton.classList.contains('today')).toBe(true);
	});

	it('navigates to previous month', async () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });
		const prevButton = screen.getByLabelText('Previous month');
		await fireEvent.click(prevButton);
		expect(screen.getByText('January 2026')).toBeTruthy();
	});

	it('navigates to next month', async () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });
		const nextButton = screen.getByLabelText('Next month');
		await fireEvent.click(nextButton);
		expect(screen.getByText('March 2026')).toBeTruthy();
	});

	it('selects a date when clicked', async () => {
		const { component } = render(MiniCalendarWidget, { selectedDate: mockDate });

		let selectedDate: Date | null = null;
		component.$on('dateSelect', (e) => {
			selectedDate = e.detail.date;
		});

		const day15 = screen.getByRole('gridcell', { name: /15/ });
		await fireEvent.click(day15);

		expect(selectedDate).not.toBeNull();
		expect(selectedDate!.getDate()).toBe(15);
	});

	it('displays events on dates', () => {
		const events = [
			{
				id: '1',
				title: 'Team Meeting',
				date: new Date(2026, 1, 27),
				color: '#ff0000'
			}
		];

		render(MiniCalendarWidget, {
			selectedDate: mockDate,
			events,
			showEvents: true
		});

		// The day should have the has-events class
		const day27 = screen.getByRole('gridcell', { name: /February 27/ });
		expect(day27.classList.contains('has-events')).toBe(true);
	});

	it('shows events list for selected date', () => {
		const events = [
			{
				id: '1',
				title: 'Team Meeting',
				date: new Date(2026, 1, 27),
				color: '#ff0000'
			}
		];

		render(MiniCalendarWidget, {
			selectedDate: mockDate,
			events,
			showEvents: true
		});

		expect(screen.getByText('Team Meeting')).toBeTruthy();
	});

	it('returns to today when clicking month/year', async () => {
		const pastDate = new Date(2025, 5, 15);
		const { component } = render(MiniCalendarWidget, { selectedDate: pastDate });

		let selectedDate: Date | null = null;
		component.$on('dateSelect', (e) => {
			selectedDate = e.detail.date;
		});

		// Navigate away first
		const nextButton = screen.getByLabelText('Next month');
		await fireEvent.click(nextButton);

		// Click month/year to return to today
		const monthYear = screen.getByText(/2025/);
		await fireEvent.click(monthYear);

		expect(selectedDate).not.toBeNull();
		expect(selectedDate!.toDateString()).toBe(mockDate.toDateString());
	});

	it('fires monthChange event when navigating', async () => {
		const { component } = render(MiniCalendarWidget, { selectedDate: mockDate });

		let monthChangeData: { year: number; month: number } | null = null;
		component.$on('monthChange', (e) => {
			monthChangeData = e.detail;
		});

		const prevButton = screen.getByLabelText('Previous month');
		await fireEvent.click(prevButton);

		expect(monthChangeData).toEqual({ year: 2026, month: 0 }); // January 2026
	});

	it('handles year rollover when navigating backward', async () => {
		const janDate = new Date(2026, 0, 15); // January 2026
		render(MiniCalendarWidget, { selectedDate: janDate });

		const prevButton = screen.getByLabelText('Previous month');
		await fireEvent.click(prevButton);

		expect(screen.getByText('December 2025')).toBeTruthy();
	});

	it('handles year rollover when navigating forward', async () => {
		const decDate = new Date(2026, 11, 15); // December 2026
		render(MiniCalendarWidget, { selectedDate: decDate });

		const nextButton = screen.getByLabelText('Next month');
		await fireEvent.click(nextButton);

		expect(screen.getByText('January 2027')).toBeTruthy();
	});

	it('limits event dots to 3', () => {
		const events = [
			{ id: '1', title: 'Event 1', date: new Date(2026, 1, 20), color: '#ff0000' },
			{ id: '2', title: 'Event 2', date: new Date(2026, 1, 20), color: '#00ff00' },
			{ id: '3', title: 'Event 3', date: new Date(2026, 1, 20), color: '#0000ff' },
			{ id: '4', title: 'Event 4', date: new Date(2026, 1, 20), color: '#ffff00' }
		];

		render(MiniCalendarWidget, {
			selectedDate: mockDate,
			events,
			showEvents: true
		});

		// Should only show 3 dots max
		const day20 = screen.getByRole('gridcell', { name: /20/ });
		const dots = day20.querySelectorAll('.event-dot');
		expect(dots.length).toBe(3);
	});

	it('has proper accessibility attributes', () => {
		render(MiniCalendarWidget, { selectedDate: mockDate });

		const calendar = screen.getByRole('application');
		expect(calendar.getAttribute('aria-label')).toBe('Calendar');

		const grid = screen.getByRole('grid');
		expect(grid).toBeTruthy();
	});
});
