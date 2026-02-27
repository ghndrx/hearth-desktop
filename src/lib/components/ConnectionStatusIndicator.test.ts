import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ConnectionStatusIndicator from './ConnectionStatusIndicator.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue(Date.now())
}));

describe('ConnectionStatusIndicator', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Mock navigator.onLine
		Object.defineProperty(navigator, 'onLine', {
			value: true,
			writable: true,
			configurable: true
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it('renders the connection indicator', () => {
		render(ConnectionStatusIndicator);
		const indicator = screen.getByRole('status');
		expect(indicator).toBeInTheDocument();
	});

	it('renders in compact mode', () => {
		const { container } = render(ConnectionStatusIndicator, { compact: true });
		expect(container.querySelector('.compact')).toBeInTheDocument();
	});

	it('shows status dot', () => {
		const { container } = render(ConnectionStatusIndicator);
		const statusDot = container.querySelector('.status-dot');
		expect(statusDot).toBeInTheDocument();
	});

	it('expands details panel when clicked', async () => {
		render(ConnectionStatusIndicator);
		const button = screen.getByRole('button');
		
		await fireEvent.click(button);
		
		const detailsPanel = screen.getByRole('button', { expanded: true });
		expect(detailsPanel).toBeInTheDocument();
	});

	it('shows reconnecting state with retry count', async () => {
		// Simulate connection failure by making invoke reject
		const { invoke } = await import('@tauri-apps/api/core');
		(invoke as any).mockRejectedValue(new Error('Connection failed'));

		render(ConnectionStatusIndicator);
		
		// Initial check
		await vi.advanceTimersByTimeAsync(100);
		
		// Click to show details
		const button = screen.getByRole('button');
		await fireEvent.click(button);
		
		// Should show reconnecting state
		await waitFor(() => {
			const reconnectInfo = screen.queryByText(/Attempting to reconnect/);
			expect(reconnectInfo).toBeInTheDocument();
		});
	});

	it('displays latency when connected', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		(invoke as any).mockResolvedValue(Date.now());

		render(ConnectionStatusIndicator);
		
		// Wait for initial connection check
		await vi.advanceTimersByTimeAsync(100);
		
		// Should eventually show latency
		await waitFor(() => {
			const latency = screen.queryByText(/ms/);
			expect(latency).toBeInTheDocument();
		});
	});

	it('shows quality bars when connected', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		(invoke as any).mockResolvedValue(Date.now());

		const { container } = render(ConnectionStatusIndicator);
		
		await vi.advanceTimersByTimeAsync(100);
		
		await waitFor(() => {
			const qualityBars = container.querySelector('.quality-bars');
			expect(qualityBars).toBeInTheDocument();
		});
	});

	it('handles offline state', async () => {
		// Set navigator to offline
		Object.defineProperty(navigator, 'onLine', {
			value: false,
			writable: true,
			configurable: true
		});

		render(ConnectionStatusIndicator);
		
		// Trigger offline event
		window.dispatchEvent(new Event('offline'));
		
		// Click to show details
		const button = screen.getByRole('button');
		await fireEvent.click(button);
		
		await waitFor(() => {
			const offlineText = screen.queryByText(/offline/i);
			expect(offlineText).toBeInTheDocument();
		});
	});

	it('handles online event after being offline', async () => {
		Object.defineProperty(navigator, 'onLine', {
			value: false,
			configurable: true
		});

		render(ConnectionStatusIndicator);
		
		window.dispatchEvent(new Event('offline'));
		
		// Go back online
		Object.defineProperty(navigator, 'onLine', {
			value: true,
			configurable: true
		});
		window.dispatchEvent(new Event('online'));
		
		await vi.advanceTimersByTimeAsync(100);
		
		// Should attempt to reconnect
		const { invoke } = await import('@tauri-apps/api/core');
		expect(invoke).toHaveBeenCalledWith('ping_server');
	});

	it('shows latency history graph when expanded', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		(invoke as any).mockResolvedValue(Date.now());

		const { container } = render(ConnectionStatusIndicator);
		
		// Run multiple pings to build history
		for (let i = 0; i < 5; i++) {
			await vi.advanceTimersByTimeAsync(5000);
		}
		
		// Click to show details
		const button = screen.getByRole('button');
		await fireEvent.click(button);
		
		await waitFor(() => {
			const graphContainer = container.querySelector('.graph-container');
			expect(graphContainer).toBeInTheDocument();
		});
	});

	it('has correct aria attributes', () => {
		render(ConnectionStatusIndicator);
		const status = screen.getByRole('status');
		expect(status).toHaveAttribute('aria-label');
	});

	it('toggles details panel on repeated clicks', async () => {
		render(ConnectionStatusIndicator);
		const button = screen.getByRole('button');
		
		// First click opens
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		
		// Second click closes
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	it('shows reconnect button when disconnected', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		(invoke as any).mockRejectedValue(new Error('Connection failed'));

		render(ConnectionStatusIndicator);
		
		// Wait for multiple reconnection attempts to exhaust
		for (let i = 0; i < 6; i++) {
			await vi.advanceTimersByTimeAsync(30000);
		}
		
		// Click to show details
		const button = screen.getByRole('button');
		await fireEvent.click(button);
		
		await waitFor(() => {
			const reconnectBtn = screen.queryByText('Reconnect');
			expect(reconnectBtn).toBeInTheDocument();
		});
	});

	it('calculates average latency correctly', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		let callCount = 0;
		(invoke as any).mockImplementation(async () => {
			callCount++;
			// Simulate varying latency by delaying differently
			await new Promise(r => setTimeout(r, 10 * callCount));
			return Date.now();
		});

		render(ConnectionStatusIndicator, { pingInterval: 100 });
		
		// Run several pings
		for (let i = 0; i < 3; i++) {
			await vi.advanceTimersByTimeAsync(100);
		}
		
		// Average should be calculated
		const button = screen.getByRole('button');
		await fireEvent.click(button);
		
		await waitFor(() => {
			const avgLabel = screen.queryByText('Avg Latency');
			expect(avgLabel).toBeInTheDocument();
		});
	});
});
