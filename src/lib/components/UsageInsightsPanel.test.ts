import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import UsageInsightsPanel from './UsageInsightsPanel.svelte';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((cmd: string) => {
		switch (cmd) {
			case 'analytics_get_today':
				return Promise.resolve({
					date: '2026-03-05',
					messages_sent: 42,
					messages_received: 87,
					reactions_sent: 15,
					voice_minutes: 23.5,
					active_minutes: 180,
					servers_visited: 3,
					channels_visited: 8,
				});
			case 'analytics_get_weekly_report':
				return Promise.resolve({
					week_start: '2026-02-27',
					week_end: '2026-03-05',
					total_messages: 340,
					total_voice_minutes: 120.5,
					total_active_minutes: 890,
					most_active_day: '2026-03-03',
					most_active_hour: 14,
					top_servers: [],
					top_channels: [],
					daily_breakdown: [
						{ date: '2026-02-27', messages_sent: 20, messages_received: 30, reactions_sent: 5, voice_minutes: 10, active_minutes: 90, servers_visited: 2, channels_visited: 5 },
						{ date: '2026-02-28', messages_sent: 35, messages_received: 45, reactions_sent: 8, voice_minutes: 15, active_minutes: 120, servers_visited: 3, channels_visited: 7 },
						{ date: '2026-03-01', messages_sent: 25, messages_received: 40, reactions_sent: 6, voice_minutes: 20, active_minutes: 150, servers_visited: 2, channels_visited: 6 },
						{ date: '2026-03-02', messages_sent: 10, messages_received: 15, reactions_sent: 2, voice_minutes: 5, active_minutes: 60, servers_visited: 1, channels_visited: 3 },
						{ date: '2026-03-03', messages_sent: 50, messages_received: 60, reactions_sent: 12, voice_minutes: 30, active_minutes: 200, servers_visited: 4, channels_visited: 10 },
						{ date: '2026-03-04', messages_sent: 30, messages_received: 48, reactions_sent: 7, voice_minutes: 18, active_minutes: 130, servers_visited: 3, channels_visited: 8 },
						{ date: '2026-03-05', messages_sent: 42, messages_received: 87, reactions_sent: 15, voice_minutes: 23.5, active_minutes: 180, servers_visited: 3, channels_visited: 8 },
					],
				});
			case 'analytics_get_summary':
				return Promise.resolve({
					total_messages_sent: 1250,
					total_messages_received: 3400,
					total_reactions: 420,
					total_voice_minutes: 890.5,
					total_active_hours: 156.3,
					member_since: '2025-06-15',
					current_streak_days: 12,
					longest_streak_days: 45,
					hourly_activity: Array.from({ length: 24 }, (_, i) => ({
						hour: i,
						count: Math.floor(Math.random() * 100),
					})),
					favorite_time: '14:00 - 15:00',
				});
			case 'analytics_get_range':
				return Promise.resolve([]);
			default:
				return Promise.resolve(null);
		}
	}),
}));

describe('UsageInsightsPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the panel with header', () => {
		render(UsageInsightsPanel);
		expect(screen.getByText('Usage Insights')).toBeInTheDocument();
	});

	it('shows three tabs', () => {
		render(UsageInsightsPanel);
		expect(screen.getByText('Today')).toBeInTheDocument();
		expect(screen.getByText('This Week')).toBeInTheDocument();
		expect(screen.getByText('All Time')).toBeInTheDocument();
	});

	it('defaults to Today tab', () => {
		render(UsageInsightsPanel);
		const todayTab = screen.getByText('Today');
		expect(todayTab.getAttribute('aria-selected')).toBe('true');
	});

	it('shows today stats after loading', async () => {
		render(UsageInsightsPanel);
		await vi.waitFor(() => {
			expect(screen.getByText('42')).toBeInTheDocument();
			expect(screen.getByText('87')).toBeInTheDocument();
			expect(screen.getByText('15')).toBeInTheDocument();
		});
	});

	it('switches to week tab', async () => {
		render(UsageInsightsPanel);
		const weekTab = screen.getByText('This Week');
		await fireEvent.click(weekTab);
		await vi.waitFor(() => {
			expect(screen.getByText('340')).toBeInTheDocument();
		});
	});

	it('switches to lifetime tab', async () => {
		render(UsageInsightsPanel);
		const allTimeTab = screen.getByText('All Time');
		await fireEvent.click(allTimeTab);
		await vi.waitFor(() => {
			expect(screen.getByText('1,250')).toBeInTheDocument();
			expect(screen.getByText('3,400')).toBeInTheDocument();
		});
	});

	it('calls onClose when close button clicked', async () => {
		const onClose = vi.fn();
		render(UsageInsightsPanel, { props: { onClose } });
		const closeBtn = screen.getByLabelText('Close');
		await fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('has refresh button', () => {
		render(UsageInsightsPanel);
		expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
	});
});
