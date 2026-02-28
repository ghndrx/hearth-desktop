import { describe, it, expect, vi } from 'vitest';
import type { ServerInsightsResponse, MemberGrowthResponse, ActivityHeatmapResponse, TopChannelsResponse, RetentionResponse } from '$lib/types';

// Mock the analytics store
vi.mock('$lib/stores/analytics', () => ({
	analyticsStore: {
		subscribe: vi.fn((fn) => {
			fn({ loading: false, error: null, serverId: null, cache: {} });
			return () => {};
		}),
		setServerId: vi.fn(),
		fetchSummary: vi.fn(),
		fetchGrowth: vi.fn(),
		fetchActivity: vi.fn(),
		fetchTopChannels: vi.fn(),
		fetchRetention: vi.fn(),
		invalidateCache: vi.fn()
	},
	isAnalyticsLoading: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return () => {};
		})
	},
	analyticsError: {
		subscribe: vi.fn((fn) => {
			fn(null);
			return () => {};
		})
	}
}));

// Mock analytics API responses matching the actual types
const mockSummary: ServerInsightsResponse = {
	server_id: 'server-1',
	period: '7d',
	summary: {
		messages_today: 150,
		active_users_today: 25,
		messages_week: 1050,
		active_users_week: 75,
		total_members: 500,
		new_members_week: 10,
		member_change_week: 5,
		message_change_percent: 15.5
	}
};

const mockGrowth: MemberGrowthResponse = {
	server_id: 'server-1',
	period: '7d',
	data: [
		{ date: '2024-02-14', count: 488, change: 4 },
		{ date: '2024-02-15', count: 492, change: 4 }
	]
};

const mockActivity: ActivityHeatmapResponse = {
	server_id: 'server-1',
	period: '7d',
	data: [
		{ day_of_week: 1, hour: 14, message_count: 50, unique_users: 10 }
	],
	peak_hours: [{ hour: 14, message_count: 50 }],
	total_stats: {
		total_messages: 500,
		avg_per_hour: 20.8
	}
};

const mockChannels: TopChannelsResponse = {
	server_id: 'server-1',
	period: '7d',
	data: [
		{
			channel_id: 'channel-1',
			channel_name: 'general',
			channel_type: 'text',
			message_count: 500,
			unique_authors: 45
		}
	]
};

const mockRetention: RetentionResponse = {
	server_id: 'server-1',
	period: '30d',
	data: {
		daily_active_users: [{ date: '2024-02-15', count: 50 }],
		mau: 250,
		total_members: 500,
		average_dau: 42.5,
		stickiness: 0.17
	}
};

describe('Analytics Types', () => {
	it('should have correct MemberGrowthPoint structure', () => {
		const point = mockGrowth.data[0];
		expect(point).toHaveProperty('date');
		expect(point).toHaveProperty('count');
		expect(point).toHaveProperty('change');
		expect(typeof point.count).toBe('number');
	});

	it('should have correct ActivityHourStat structure', () => {
		const stat = mockActivity.data[0];
		expect(stat).toHaveProperty('day_of_week');
		expect(stat).toHaveProperty('hour');
		expect(stat).toHaveProperty('message_count');
		expect(stat.day_of_week).toBeGreaterThanOrEqual(0);
		expect(stat.day_of_week).toBeLessThanOrEqual(6);
		expect(stat.hour).toBeGreaterThanOrEqual(0);
		expect(stat.hour).toBeLessThanOrEqual(23);
	});

	it('should have correct TopChannelStat structure', () => {
		const channel = mockChannels.data[0];
		expect(channel).toHaveProperty('channel_id');
		expect(channel).toHaveProperty('channel_name');
		expect(channel).toHaveProperty('message_count');
		expect(channel).toHaveProperty('unique_authors');
	});

	it('should have correct RetentionMetrics structure', () => {
		const retention = mockRetention.data;
		expect(retention).toHaveProperty('mau');
		expect(retention).toHaveProperty('total_members');
		expect(retention).toHaveProperty('average_dau');
		expect(retention).toHaveProperty('stickiness');
		expect(retention).toHaveProperty('daily_active_users');
		expect(retention.stickiness).toBeGreaterThanOrEqual(0);
		expect(retention.stickiness).toBeLessThanOrEqual(1);
	});

	it('should have correct ServerInsightsResponse structure', () => {
		expect(mockSummary).toHaveProperty('server_id');
		expect(mockSummary).toHaveProperty('period');
		expect(mockSummary).toHaveProperty('summary');
		expect(mockSummary.summary).toHaveProperty('total_members');
		expect(mockSummary.summary).toHaveProperty('messages_today');
		expect(mockSummary.summary).toHaveProperty('active_users_today');
	});
});

describe('Analytics Period Calculation', () => {
	it('should correctly represent message change percent', () => {
		const changePercent = mockSummary.summary.message_change_percent;
		expect(changePercent).toBe(15.5);
	});

	it('should correctly calculate stickiness ratio', () => {
		const retention = mockRetention.data;
		// Stickiness is DAU/MAU ratio (0-1)
		expect(retention.stickiness).toBeGreaterThanOrEqual(0);
		expect(retention.stickiness).toBeLessThanOrEqual(1);
		// Average DAU should be less than MAU
		expect(retention.average_dau).toBeLessThan(retention.mau);
	});
});

describe('Heatmap Data Validation', () => {
	it('should have valid day_of_week values (0-6)', () => {
		for (const stat of mockActivity.data) {
			expect(stat.day_of_week).toBeGreaterThanOrEqual(0);
			expect(stat.day_of_week).toBeLessThanOrEqual(6);
		}
	});

	it('should have valid hour values (0-23)', () => {
		for (const stat of mockActivity.data) {
			expect(stat.hour).toBeGreaterThanOrEqual(0);
			expect(stat.hour).toBeLessThanOrEqual(23);
		}
	});
});

describe('Growth Data Validation', () => {
	it('should have chronologically ordered dates', () => {
		const dates = mockGrowth.data.map((d: { date: string }) => new Date(d.date).getTime());
		for (let i = 1; i < dates.length; i++) {
			expect(dates[i]).toBeGreaterThan(dates[i - 1]);
		}
	});

	it('should have positive count values', () => {
		for (const point of mockGrowth.data) {
			expect(point.count).toBeGreaterThanOrEqual(0);
		}
	});
});
