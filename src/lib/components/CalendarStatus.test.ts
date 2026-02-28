import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CalendarStatus from './CalendarStatus.svelte';

vi.mock('$lib/tauri', () => ({
	invoke: vi.fn().mockResolvedValue(false)
}));

describe('CalendarStatus', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders without errors when not in meeting', () => {
		const { container } = render(CalendarStatus);
		// Should not show meeting status when not in a meeting
		expect(container.querySelector('.in-meeting')).toBeNull();
	});

	it('does not show upcoming event when none exist', () => {
		const { container } = render(CalendarStatus);
		expect(container.querySelector('.upcoming')).toBeNull();
	});
});
