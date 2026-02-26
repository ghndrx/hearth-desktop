import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import FocusTimer from './FocusTimer.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockImplementation((cmd: string) => {
		switch (cmd) {
			case 'store_get':
				return Promise.resolve(null);
			case 'store_set':
				return Promise.resolve();
			case 'show_notification':
				return Promise.resolve();
			case 'set_focus_mode':
				return Promise.resolve();
			case 'set_tray_title':
				return Promise.resolve();
			default:
				return Promise.resolve();
		}
	})
}));

describe('FocusTimer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders in idle state by default', () => {
		render(FocusTimer);
		
		expect(screen.getByText('Focus Timer')).toBeInTheDocument();
		expect(screen.getByText('Ready to Focus')).toBeInTheDocument();
		expect(screen.getByText('25:00')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /start focus/i })).toBeInTheDocument();
	});

	it('renders with custom focus duration', () => {
		render(FocusTimer, { props: { focusDuration: 45 } });
		
		expect(screen.getByText('45:00')).toBeInTheDocument();
	});

	it('starts focus session when start button clicked', async () => {
		render(FocusTimer);
		
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		expect(screen.getByText('Focus Time')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
	});

	it('counts down time during focus session', async () => {
		render(FocusTimer, { props: { focusDuration: 1 } }); // 1 minute
		
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		expect(screen.getByText('01:00')).toBeInTheDocument();
		
		// Advance time by 10 seconds
		vi.advanceTimersByTime(10000);
		
		expect(screen.getByText('00:50')).toBeInTheDocument();
	});

	it('pauses and resumes timer', async () => {
		render(FocusTimer);
		
		// Start timer
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		// Advance some time
		vi.advanceTimersByTime(5000);
		
		// Pause
		const pauseButton = screen.getByRole('button', { name: /pause/i });
		await fireEvent.click(pauseButton);
		
		expect(screen.getByText('Paused')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
		
		const timeAfterPause = screen.getByText(/\d{2}:\d{2}/).textContent;
		
		// Advance time while paused
		vi.advanceTimersByTime(5000);
		
		// Time should not have changed
		expect(screen.getByText(/\d{2}:\d{2}/).textContent).toBe(timeAfterPause);
		
		// Resume
		const resumeButton = screen.getByRole('button', { name: /resume/i });
		await fireEvent.click(resumeButton);
		
		expect(screen.getByText('Focus Time')).toBeInTheDocument();
	});

	it('resets timer when reset button clicked', async () => {
		render(FocusTimer, { props: { focusDuration: 25 } });
		
		// Start timer
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		// Advance some time
		vi.advanceTimersByTime(60000);
		
		// Pause first to see reset button
		const pauseButton = screen.getByRole('button', { name: /pause/i });
		await fireEvent.click(pauseButton);
		
		// Reset
		const resetButton = screen.getByRole('button', { name: /reset/i });
		await fireEvent.click(resetButton);
		
		expect(screen.getByText('Ready to Focus')).toBeInTheDocument();
		expect(screen.getByText('25:00')).toBeInTheDocument();
	});

	it('opens settings modal', async () => {
		render(FocusTimer);
		
		const settingsButton = screen.getByTitle('Settings');
		await fireEvent.click(settingsButton);
		
		expect(screen.getByText('Timer Settings')).toBeInTheDocument();
		expect(screen.getByText('Focus Duration (minutes)')).toBeInTheDocument();
		expect(screen.getByText('Short Break (minutes)')).toBeInTheDocument();
		expect(screen.getByText('Long Break (minutes)')).toBeInTheDocument();
	});

	it('opens stats modal', async () => {
		render(FocusTimer);
		
		const statsButton = screen.getByTitle('Statistics');
		await fireEvent.click(statsButton);
		
		expect(screen.getByText('Focus Statistics')).toBeInTheDocument();
		expect(screen.getByText('Sessions Today')).toBeInTheDocument();
		expect(screen.getByText('Focus Time Today')).toBeInTheDocument();
	});

	it('minimizes and expands timer', async () => {
		render(FocusTimer);
		
		// Minimize
		const minimizeButton = screen.getByTitle('Minimize');
		await fireEvent.click(minimizeButton);
		
		// Check minimized view
		expect(screen.queryByText('Focus Timer')).not.toBeInTheDocument();
		
		// Click to expand
		const minimizedTimer = screen.getByRole('button', { name: /\d{2}:\d{2}/ });
		await fireEvent.click(minimizedTimer);
		
		expect(screen.getByText('Focus Timer')).toBeInTheDocument();
	});

	it('renders in compact mode', () => {
		render(FocusTimer, { props: { compact: true } });
		
		const timer = document.querySelector('.focus-timer');
		expect(timer?.classList.contains('compact')).toBe(true);
	});

	it('shows session indicators', () => {
		render(FocusTimer, { props: { sessionsBeforeLongBreak: 4 } });
		
		const dots = document.querySelectorAll('.session-dot');
		expect(dots.length).toBe(4);
	});

	it('skips to break when skip button clicked during focus', async () => {
		render(FocusTimer, { props: { shortBreakDuration: 5 } });
		
		// Start focus
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		// Skip to break
		const skipButton = screen.getByRole('button', { name: /skip/i });
		await fireEvent.click(skipButton);
		
		expect(screen.getByText('Short Break')).toBeInTheDocument();
		expect(screen.getByText('05:00')).toBeInTheDocument();
	});

	it('dispatches session-start event when focus starts', async () => {
		const { component } = render(FocusTimer);
		
		const sessionStartHandler = vi.fn();
		component.$on('session-start', sessionStartHandler);
		
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		expect(sessionStartHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { type: 'focus', duration: 25 }
			})
		);
	});

	it('closes settings modal when cancel clicked', async () => {
		render(FocusTimer);
		
		// Open settings
		const settingsButton = screen.getByTitle('Settings');
		await fireEvent.click(settingsButton);
		
		expect(screen.getByText('Timer Settings')).toBeInTheDocument();
		
		// Cancel
		const cancelButton = screen.getByRole('button', { name: /cancel/i });
		await fireEvent.click(cancelButton);
		
		expect(screen.queryByText('Timer Settings')).not.toBeInTheDocument();
	});

	it('applies new settings when save clicked', async () => {
		render(FocusTimer);
		
		// Open settings
		const settingsButton = screen.getByTitle('Settings');
		await fireEvent.click(settingsButton);
		
		// Change focus duration
		const focusInput = screen.getAllByRole('spinbutton')[0];
		await fireEvent.input(focusInput, { target: { value: '30' } });
		
		// Save
		const saveButton = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveButton);
		
		// Check new time displayed
		expect(screen.getByText('30:00')).toBeInTheDocument();
	});

	it('stops timer when stop button clicked during focus', async () => {
		render(FocusTimer);
		
		// Start focus
		const startButton = screen.getByRole('button', { name: /start focus/i });
		await fireEvent.click(startButton);
		
		// Advance some time
		vi.advanceTimersByTime(60000);
		
		// Stop
		const stopButton = screen.getByRole('button', { name: /stop/i });
		await fireEvent.click(stopButton);
		
		expect(screen.getByText('Ready to Focus')).toBeInTheDocument();
	});

	it('displays formatted time correctly', () => {
		render(FocusTimer, { props: { focusDuration: 90 } }); // 90 minutes = 1h 30m
		
		// Should show 90:00 in timer
		expect(screen.getByText('90:00')).toBeInTheDocument();
	});

	it('closes stats modal on close button', async () => {
		render(FocusTimer);
		
		// Open stats
		const statsButton = screen.getByTitle('Statistics');
		await fireEvent.click(statsButton);
		
		expect(screen.getByText('Focus Statistics')).toBeInTheDocument();
		
		// Close
		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeButton);
		
		expect(screen.queryByText('Focus Statistics')).not.toBeInTheDocument();
	});

	it('shows quick stats when not in compact mode', () => {
		render(FocusTimer, { props: { compact: false } });
		
		expect(screen.getByText('Sessions')).toBeInTheDocument();
		expect(screen.getByText('Total Focus')).toBeInTheDocument();
	});

	it('hides quick stats in compact mode', () => {
		render(FocusTimer, { props: { compact: true } });
		
		expect(screen.queryByText('Sessions')).not.toBeInTheDocument();
		expect(screen.queryByText('Total Focus')).not.toBeInTheDocument();
	});
});
