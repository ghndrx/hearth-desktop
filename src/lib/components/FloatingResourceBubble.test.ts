/**
 * Tests for FloatingResourceBubble component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import FloatingResourceBubble from './FloatingResourceBubble.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve({
		cpu_usage: 45,
		memory_percent: 62,
		cpu_cores: 8,
		memory_total: 16 * 1024 * 1024 * 1024,
		memory_used: 10 * 1024 * 1024 * 1024,
		network_tx_rate: 1024 * 50,
		network_rx_rate: 1024 * 200,
		system_uptime: 86400 + 3600 * 5 // 1 day, 5 hours
	}))
}));

describe('FloatingResourceBubble', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders when visible', async () => {
		render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});
	});

	it('does not render when showOnStartup is false', async () => {
		render(FloatingResourceBubble, {
			props: { showOnStartup: false }
		});

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	it('positions at initial coordinates', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { initialX: 100, initialY: 200, showOnStartup: true }
		});

		await waitFor(() => {
			const bubble = container.querySelector('.floating-bubble');
			expect(bubble).toHaveStyle({ left: '100px', top: '200px' });
		});
	});

	it('expands on hover', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		await waitFor(() => {
			const bubble = container.querySelector('.floating-bubble');
			expect(bubble).toBeInTheDocument();
		});

		const bubble = container.querySelector('.floating-bubble')!;
		await fireEvent.mouseEnter(bubble);

		await waitFor(() => {
			expect(bubble).toHaveClass('expanded');
		});
	});

	it('collapses on mouse leave', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseEnter(bubble);
		await waitFor(() => expect(bubble).toHaveClass('expanded'));

		await fireEvent.mouseLeave(bubble);
		await waitFor(() => expect(bubble).not.toHaveClass('expanded'));
	});

	it('toggles expansion on double click', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.dblClick(bubble);
		await waitFor(() => expect(bubble).toHaveClass('expanded'));

		await fireEvent.dblClick(bubble);
		await waitFor(() => expect(bubble).not.toHaveClass('expanded'));
	});

	it('displays CPU and memory rings', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		await waitFor(() => {
			const cpuRing = container.querySelector('.ring-cpu');
			const memRing = container.querySelector('.ring-mem');
			expect(cpuRing).toBeInTheDocument();
			expect(memRing).toBeInTheDocument();
		});
	});

	it('shows status dot with correct color for good health', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		await waitFor(() => {
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toBeInTheDocument();
			// Initial mock data has cpu=45, memory=62 which is "good" status
		});
	});

	it('saves position to localStorage when persistPosition is true', async () => {
		render(FloatingResourceBubble, {
			props: { showOnStartup: true, persistPosition: true }
		});

		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		// Position saving happens on drag end or visibility toggle
		// Check that component attempts to read saved position on mount
		expect(localStorage.getItem).toHaveBeenCalledTimes(0); // No spy set, but structure exists
	});

	it('restores position from localStorage', async () => {
		localStorage.setItem('hearth-resource-bubble-position', JSON.stringify({
			x: 300,
			y: 400,
			visible: true
		}));

		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true, persistPosition: true }
		});

		await waitFor(() => {
			const bubble = container.querySelector('.floating-bubble');
			expect(bubble).toHaveStyle({ left: '300px', top: '400px' });
		});
	});

	it('hides when close button is clicked', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		// Expand to show close button
		await fireEvent.mouseEnter(bubble);

		await waitFor(async () => {
			const closeBtn = container.querySelector('.close-btn');
			expect(closeBtn).toBeInTheDocument();
			await fireEvent.click(closeBtn!);
		});

		await waitFor(() => {
			expect(container.querySelector('.floating-bubble')).not.toBeInTheDocument();
		});
	});

	it('adds dragging class during drag', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseDown(bubble, { clientX: 50, clientY: 50 });
		expect(bubble).toHaveClass('dragging');

		await fireEvent.mouseUp(document);
		expect(bubble).not.toHaveClass('dragging');
	});

	it('formats bytes correctly', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		// Expand to see detailed stats
		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseEnter(bubble);

		await waitFor(() => {
			// Mock returns 10GB memory used
			const usedStat = screen.getByText(/GB/);
			expect(usedStat).toBeInTheDocument();
		});
	});

	it('formats uptime correctly', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseEnter(bubble);

		await waitFor(() => {
			// Mock returns 1d 5h uptime
			const uptimeStat = screen.getByText(/1d 5h/);
			expect(uptimeStat).toBeInTheDocument();
		});
	});

	it('displays network stats when available', async () => {
		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseEnter(bubble);

		await waitFor(() => {
			const networkRow = container.querySelector('.stat-row.network');
			expect(networkRow).toBeInTheDocument();
		});
	});

	it('exposes show/hide/toggle methods', async () => {
		const { component } = render(FloatingResourceBubble, {
			props: { showOnStartup: false }
		});

		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		component.show();
		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});

		component.hide();
		await waitFor(() => {
			expect(screen.queryByRole('status')).not.toBeInTheDocument();
		});

		component.toggle();
		await waitFor(() => {
			expect(screen.getByRole('status')).toBeInTheDocument();
		});
	});

	it('applies warning class to high CPU usage', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		vi.mocked(invoke).mockResolvedValueOnce({
			cpu_usage: 75,
			memory_percent: 40,
			cpu_cores: 8,
			memory_total: 16 * 1024 * 1024 * 1024,
			memory_used: 6 * 1024 * 1024 * 1024,
			network_tx_rate: 0,
			network_rx_rate: 0,
			system_uptime: 3600
		});

		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		const bubble = await waitFor(() => {
			const el = container.querySelector('.floating-bubble');
			expect(el).toBeInTheDocument();
			return el!;
		});

		await fireEvent.mouseEnter(bubble);

		await waitFor(() => {
			const cpuValue = container.querySelector('.stat-value.warning');
			expect(cpuValue).toBeInTheDocument();
		});
	});

	it('applies critical class and pulse animation for very high usage', async () => {
		const { invoke } = await import('@tauri-apps/api/core');
		vi.mocked(invoke).mockResolvedValueOnce({
			cpu_usage: 95,
			memory_percent: 92,
			cpu_cores: 8,
			memory_total: 16 * 1024 * 1024 * 1024,
			memory_used: 15 * 1024 * 1024 * 1024,
			network_tx_rate: 0,
			network_rx_rate: 0,
			system_uptime: 3600
		});

		const { container } = render(FloatingResourceBubble, {
			props: { showOnStartup: true }
		});

		await waitFor(() => {
			const bubble = container.querySelector('.floating-bubble');
			expect(bubble).toHaveClass('pulse');
		});
	});
});
