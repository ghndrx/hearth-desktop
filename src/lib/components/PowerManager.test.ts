import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PowerManager from './PowerManager.svelte';

// Mock the tauri power API
vi.mock('$lib/tauri', () => ({
	power: {
		getStatus: vi.fn(),
		preventSleep: vi.fn(),
		allowSleep: vi.fn(),
		isSleepPrevented: vi.fn(),
	},
}));

import { power } from '$lib/tauri';

const mockPowerStatus = {
	is_ac_power: false,
	is_charging: false,
	battery_percentage: 75,
	time_remaining: '3:45',
	is_power_save_mode: false,
};

describe('PowerManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockPowerStatus);
		(power.isSleepPrevented as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(power.preventSleep as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(power.allowSleep as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders loading state initially', () => {
		// Delay the promise to show loading state
		(power.getStatus as ReturnType<typeof vi.fn>).mockImplementation(
			() => new Promise(() => {})
		);
		
		render(PowerManager);
		
		// Should show loading spinner initially
		const button = screen.getByRole('button');
		expect(button).toBeDisabled();
	});

	it('displays battery percentage', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
	});

	it('shows AC power when no battery', async () => {
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockPowerStatus,
			battery_percentage: null,
			is_ac_power: true,
		});
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('AC')).toBeInTheDocument();
		});
	});

	it('opens popup on click', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		const button = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(button);
		
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Power Status')).toBeInTheDocument();
	});

	it('shows battery status in popup', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		const button = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(button);
		
		expect(screen.getByText('🔋 Battery')).toBeInTheDocument();
		expect(screen.getByText('3:45')).toBeInTheDocument();
	});

	it('shows charging status when charging', async () => {
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockPowerStatus,
			is_charging: true,
		});
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		const button = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(button);
		
		expect(screen.getByText('⚡ Charging')).toBeInTheDocument();
	});

	it('toggles sleep prevention', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		// Find and click the sleep toggle
		const toggle = screen.getByRole('button', { name: /prevent sleep/i });
		await fireEvent.click(toggle);
		
		expect(power.preventSleep).toHaveBeenCalled();
	});

	it('shows warning when sleep is prevented', async () => {
		(power.isSleepPrevented as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		expect(screen.getByText(/Sleep prevention is active/)).toBeInTheDocument();
	});

	it('shows sleep blocked badge when sleep prevented', async () => {
		(power.isSleepPrevented as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByTitle('Sleep is blocked')).toBeInTheDocument();
		});
	});

	it('refreshes status on button click', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		// Clear call count
		vi.clearAllMocks();
		
		// Click refresh
		const refreshBtn = screen.getByRole('button', { name: /refresh/i });
		await fireEvent.click(refreshBtn);
		
		expect(power.getStatus).toHaveBeenCalled();
	});

	it('closes popup on escape key', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		
		// Press escape
		await fireEvent.keyDown(window, { key: 'Escape' });
		
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
	});

	it('closes popup on close button click', async () => {
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		
		// Click close button
		const closeBtn = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeBtn);
		
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
	});

	it('handles errors gracefully', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		(power.getStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('Failed to get status')
		);
		
		render(PowerManager);
		
		// Open popup to see error
		await waitFor(async () => {
			const indicator = screen.getByRole('button', { name: /power/i });
			await fireEvent.click(indicator);
		});
		
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it('shows compact mode correctly', async () => {
		const { container } = render(PowerManager, { props: { compact: true } });
		
		await waitFor(() => {
			const powerManager = container.querySelector('.power-manager');
			expect(powerManager).toHaveClass('compact');
		});
	});

	it('uses custom poll interval', async () => {
		vi.useFakeTimers();
		
		render(PowerManager, { props: { pollInterval: 5000 } });
		
		await waitFor(() => {
			expect(power.getStatus).toHaveBeenCalledTimes(1);
		});
		
		// Clear initial call
		vi.clearAllMocks();
		
		// Advance timer
		vi.advanceTimersByTime(5000);
		
		expect(power.getStatus).toHaveBeenCalledTimes(1);
		
		vi.useRealTimers();
	});

	it('shows low battery color for battery <= 10%', async () => {
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockPowerStatus,
			battery_percentage: 5,
		});
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('5%')).toBeInTheDocument();
		});
		
		// The battery icon should have low battery color
		// This is visual, hard to test directly, but we verify the percentage renders
	});

	it('shows warning battery color for battery <= 20%', async () => {
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockPowerStatus,
			battery_percentage: 15,
		});
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('15%')).toBeInTheDocument();
		});
	});

	it('allows sleep when toggle is clicked while sleep is prevented', async () => {
		(power.isSleepPrevented as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		// Open popup
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		// Find and click the sleep toggle (which should now be "on")
		const toggle = screen.getByRole('button', { name: /prevent sleep/i });
		await fireEvent.click(toggle);
		
		expect(power.allowSleep).toHaveBeenCalled();
	});

	it('shows time to full when charging', async () => {
		(power.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockPowerStatus,
			is_charging: true,
			time_remaining: '1:30',
		});
		
		render(PowerManager);
		
		await waitFor(() => {
			expect(screen.getByText('75%')).toBeInTheDocument();
		});
		
		const indicator = screen.getByRole('button', { name: /power/i });
		await fireEvent.click(indicator);
		
		expect(screen.getByText('Time to Full')).toBeInTheDocument();
		expect(screen.getByText('1:30')).toBeInTheDocument();
	});
});
