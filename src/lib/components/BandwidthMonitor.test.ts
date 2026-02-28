import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BandwidthMonitor from './BandwidthMonitor.svelte';

vi.mock('$lib/tauri', () => ({
	invoke: vi.fn().mockResolvedValue({
		bytes_sent: 1024000,
		bytes_received: 5120000,
		session_start: Math.floor(Date.now() / 1000) - 3600,
		peak_download_rate: 102400,
		peak_upload_rate: 51200,
		current_download_rate: 25600,
		current_upload_rate: 12800
	})
}));

describe('BandwidthMonitor', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the toggle button', () => {
		render(BandwidthMonitor);
		const toggle = screen.getByTitle('Network bandwidth');
		expect(toggle).toBeTruthy();
	});

	it('shows bandwidth summary in collapsed state', () => {
		render(BandwidthMonitor);
		const summary = document.querySelector('.bandwidth-summary');
		expect(summary).toBeTruthy();
	});

	it('expands panel on click', async () => {
		render(BandwidthMonitor);
		const toggle = screen.getByTitle('Network bandwidth');
		await fireEvent.click(toggle);
		expect(screen.getByText('Network Usage')).toBeTruthy();
	});

	it('shows reset button in expanded state', async () => {
		render(BandwidthMonitor);
		const toggle = screen.getByTitle('Network bandwidth');
		await fireEvent.click(toggle);
		expect(screen.getByText('Reset Counters')).toBeTruthy();
	});
});
