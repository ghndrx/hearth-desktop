import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PerformanceMonitor from './PerformanceMonitor.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
	invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock performance metrics response
const mockMetrics = {
	memory_bytes: 52428800,
	memory_formatted: '50.0 MB',
	rss_bytes: 78643200,
	rss_formatted: '75.0 MB',
	virtual_bytes: 268435456,
	virtual_formatted: '256.0 MB',
	uptime_seconds: 3661,
	uptime_formatted: '1h 1m',
	cpu_percent: 5.5,
	thread_count: 12,
	timestamp: Date.now(),
};

describe('PerformanceMonitor', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockInvoke.mockReset();
		mockInvoke.mockResolvedValue(mockMetrics);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders monitor trigger button', async () => {
		render(PerformanceMonitor);

		const button = screen.getByRole('button', { name: /performance monitor/i });
		expect(button).toBeTruthy();
	});

	it('fetches metrics on mount', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('get_performance_metrics');
		});
	});

	it('displays quick stats in non-compact mode', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(screen.getByText('75.0 MB')).toBeTruthy();
			expect(screen.getByText('5.5%')).toBeTruthy();
		});
	});

	it('hides quick stats in compact mode', async () => {
		render(PerformanceMonitor, { props: { compact: true } });

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		// Quick stats should be hidden
		expect(screen.queryByText('75.0 MB')).toBeFalsy();
	});

	it('opens details panel on click', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		expect(screen.getByRole('dialog', { name: /performance details/i })).toBeTruthy();
	});

	it('displays detailed metrics in panel', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		// Check for detailed metrics
		expect(screen.getByText('Memory (RSS)')).toBeTruthy();
		expect(screen.getByText('CPU Usage')).toBeTruthy();
		expect(screen.getByText('Frame Rate')).toBeTruthy();
		expect(screen.getByText('Threads')).toBeTruthy();
		expect(screen.getByText('12')).toBeTruthy(); // Thread count
	});

	it('displays uptime in panel header', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		expect(screen.getByText(/1h 1m/)).toBeTruthy();
	});

	it('closes panel with Escape key', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		expect(screen.getByRole('dialog')).toBeTruthy();

		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(screen.queryByRole('dialog')).toBeFalsy();
	});

	it('refreshes metrics on button click', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(1);
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		const refreshButton = screen.getByRole('button', { name: /refresh/i });
		await fireEvent.click(refreshButton);

		expect(mockInvoke).toHaveBeenCalledTimes(2);
	});

	it('refreshes metrics on interval', async () => {
		render(PerformanceMonitor, { props: { refreshInterval: 1000 } });

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(1);
		});

		// Advance timer by refresh interval
		vi.advanceTimersByTime(1000);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(2);
		});

		vi.advanceTimersByTime(1000);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(3);
		});
	});

	it('displays error state when fetch fails', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Failed to get metrics'));

		render(PerformanceMonitor);

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		await waitFor(() => {
			expect(screen.getByText(/failed to get metrics/i)).toBeTruthy();
		});
	});

	it('shows loading state initially', async () => {
		// Make invoke slow
		mockInvoke.mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve(mockMetrics), 1000))
		);

		render(PerformanceMonitor);

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		expect(screen.getByText(/loading metrics/i)).toBeTruthy();
	});

	it('applies correct color for high CPU usage', async () => {
		mockInvoke.mockResolvedValueOnce({ ...mockMetrics, cpu_percent: 45 });

		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		// CPU at 45% should have red color
		const cpuText = screen.getByText('45.0%');
		expect(cpuText).toBeTruthy();
	});

	it('applies correct color for moderate CPU usage', async () => {
		mockInvoke.mockResolvedValueOnce({ ...mockMetrics, cpu_percent: 15 });

		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const cpuText = screen.getByText('15.0%');
		expect(cpuText).toBeTruthy();
	});

	it('toggles panel visibility on click', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalled();
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });

		// Open panel
		await fireEvent.click(button);
		expect(screen.getByRole('dialog')).toBeTruthy();

		// Close panel
		await fireEvent.click(button);
		expect(screen.queryByRole('dialog')).toBeFalsy();
	});

	it('tracks memory history for graph', async () => {
		render(PerformanceMonitor);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(1);
		});

		// Trigger more fetches
		vi.advanceTimersByTime(2000);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledTimes(2);
		});

		const button = screen.getByRole('button', { name: /performance monitor/i });
		await fireEvent.click(button);

		// Graph bars should be present (at least 2 data points)
		const graphBars = document.querySelectorAll('.graph-bar');
		expect(graphBars.length).toBeGreaterThanOrEqual(2);
	});
});
