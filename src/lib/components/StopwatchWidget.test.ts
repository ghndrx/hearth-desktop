import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StopwatchWidget from './StopwatchWidget.svelte';

describe('StopwatchWidget', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders with initial state', () => {
		render(StopwatchWidget);
		
		expect(screen.getByText('⏱️')).toBeInTheDocument();
		expect(screen.getByText('00:00.00')).toBeInTheDocument();
		expect(screen.getByTitle('Start')).toBeInTheDocument();
	});

	it('renders compact mode', () => {
		render(StopwatchWidget, { props: { compact: true } });
		
		expect(screen.getByText('⏱️')).toBeInTheDocument();
		expect(screen.queryByText('Stopwatch')).not.toBeInTheDocument();
	});

	it('renders full mode with title', () => {
		render(StopwatchWidget, { props: { compact: false } });
		
		expect(screen.getByText('Stopwatch')).toBeInTheDocument();
	});

	it('starts the stopwatch', async () => {
		render(StopwatchWidget);
		
		const startBtn = screen.getByTitle('Start');
		await fireEvent.click(startBtn);
		
		expect(screen.getByTitle('Pause')).toBeInTheDocument();
		expect(screen.getByTitle('Lap')).toBeInTheDocument();
	});

	it('pauses the stopwatch', async () => {
		render(StopwatchWidget);
		
		// Start
		await fireEvent.click(screen.getByTitle('Start'));
		
		// Advance time
		vi.advanceTimersByTime(1000);
		
		// Pause
		await fireEvent.click(screen.getByTitle('Pause'));
		
		expect(screen.getByTitle('Start')).toBeInTheDocument();
		expect(screen.getByTitle('Reset')).toBeInTheDocument();
	});

	it('resets the stopwatch', async () => {
		render(StopwatchWidget);
		
		// Start and run
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(5000);
		
		// Pause
		await fireEvent.click(screen.getByTitle('Pause'));
		
		// Reset
		await fireEvent.click(screen.getByTitle('Reset'));
		
		expect(screen.getByText('00:00.00')).toBeInTheDocument();
	});

	it('records laps', async () => {
		render(StopwatchWidget, { props: { compact: false } });
		
		// Start
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(2000);
		
		// Record lap
		await fireEvent.click(screen.getByTitle('Lap'));
		
		expect(screen.getByText('Laps (1)')).toBeInTheDocument();
		expect(screen.getByText('#1')).toBeInTheDocument();
	});

	it('records multiple laps', async () => {
		render(StopwatchWidget, { props: { compact: false } });
		
		await fireEvent.click(screen.getByTitle('Start'));
		
		// Record first lap
		vi.advanceTimersByTime(1000);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		// Record second lap
		vi.advanceTimersByTime(2000);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		// Record third lap
		vi.advanceTimersByTime(1500);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		expect(screen.getByText('Laps (3)')).toBeInTheDocument();
	});

	it('clears laps', async () => {
		render(StopwatchWidget, { props: { compact: false } });
		
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(1000);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		expect(screen.getByText('Laps (1)')).toBeInTheDocument();
		
		// Clear laps
		await fireEvent.click(screen.getByTitle('Clear laps'));
		
		expect(screen.queryByText('Laps (1)')).not.toBeInTheDocument();
	});

	it('shows lap count in compact mode', async () => {
		render(StopwatchWidget, { props: { compact: true } });
		
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(1000);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		expect(screen.getByText('1 lap')).toBeInTheDocument();
		
		vi.advanceTimersByTime(1000);
		await fireEvent.click(screen.getByTitle('Lap'));
		
		expect(screen.getByText('2 laps')).toBeInTheDocument();
	});

	it('persists state to localStorage', async () => {
		render(StopwatchWidget);
		
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(5000);
		await fireEvent.click(screen.getByTitle('Pause'));
		
		const stored = localStorage.getItem('hearth-stopwatch');
		expect(stored).toBeTruthy();
		
		const data = JSON.parse(stored!);
		expect(data.elapsed).toBeGreaterThan(0);
		expect(data.isRunning).toBe(false);
	});

	it('restores state from localStorage', async () => {
		// Set up saved state
		localStorage.setItem('hearth-stopwatch', JSON.stringify({
			elapsed: 65000, // 1:05.00
			laps: [30000, 65000],
			isRunning: false,
			startTime: 0,
			lastUpdate: Date.now()
		}));
		
		render(StopwatchWidget, { props: { compact: false } });
		
		expect(screen.getByText('01:05.00')).toBeInTheDocument();
		expect(screen.getByText('Laps (2)')).toBeInTheDocument();
	});

	it('formats hours correctly', async () => {
		localStorage.setItem('hearth-stopwatch', JSON.stringify({
			elapsed: 3661000, // 1:01:01
			laps: [],
			isRunning: false,
			startTime: 0,
			lastUpdate: Date.now()
		}));
		
		render(StopwatchWidget);
		
		expect(screen.getByText('1:01:01')).toBeInTheDocument();
	});

	it('disables lap button when not running', () => {
		render(StopwatchWidget);
		
		// Not running - no lap button
		expect(screen.queryByTitle('Lap')).not.toBeInTheDocument();
	});

	it('displays running indicator', async () => {
		const { container } = render(StopwatchWidget);
		
		await fireEvent.click(screen.getByTitle('Start'));
		
		const display = container.querySelector('.display');
		expect(display?.classList.contains('running')).toBe(true);
	});

	it('hides reset button when elapsed is zero', () => {
		render(StopwatchWidget);
		
		expect(screen.queryByTitle('Reset')).not.toBeInTheDocument();
	});

	it('shows reset button after pausing with elapsed time', async () => {
		render(StopwatchWidget);
		
		await fireEvent.click(screen.getByTitle('Start'));
		vi.advanceTimersByTime(1000);
		await fireEvent.click(screen.getByTitle('Pause'));
		
		expect(screen.getByTitle('Reset')).toBeInTheDocument();
	});
});
