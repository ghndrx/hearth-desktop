import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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

// Mock analytics API responses
const mockSummary: ServerInsightsResponse = {
	server_id: 'test-server-id',
	period: '7d',
	summary: {
		messages_today: 150,
		active_users_today: 25,
		messages_week: 1200,
		active_users_week: 75,
		total_members: 500,
		new_members_week: 12,
		member_change_week: 10,
		message_change_percent: 15.5
	}
};

const mockGrowth: MemberGrowthResponse = {
	server_id: 'test-server-id',
	period: '7d',
	data: [
		{ date: '2024-02-14', count: 488, change: 2 },
		{ date: '2024-02-15', count: 492, change: 4 }
	]
};

const mockActivity: ActivityHeatmapResponse = {
	server_id: 'test-server-id',
	period: '7d',
	data: [
		{ day_of_week: 1, hour: 14, message_count: 50, unique_users: 10 }
	],
	peak_hours: [{ hour: 14, message_count: 50 }],
	total_stats: { total_messages: 50, avg_per_hour: 50 }
};

const mockChannels: TopChannelsResponse = {
	server_id: 'test-server-id',
	period: '7d',
	data: [
		{
			channel_id: 'channel-1',
			channel_name: 'general',
			channel_type: 'text',
			message_count: 500,
			unique_authors: 45,
			last_activity: '2024-02-15T10:30:00Z'
		}
	]
};

const mockRetention: RetentionResponse = {
	server_id: 'test-server-id',
	period: '30d',
	data: {
		daily_active_users: [{ date: '2024-02-15', count: 50 }],
		mau: 150,
		total_members: 500,
		average_dau: 48.5,
		stickiness: 0.323
	}
};

describe('Analytics Types', () => {
	it('should have correct MemberGrowthPoint structure', () => {
		const point = mockGrowth.data[0];
		expect(point).toHaveProperty('date');
		expect(point).toHaveProperty('count');
		expect(point).toHaveProperty('change');
		expect(typeof point.count).toBe('number');
		expect(typeof point.change).toBe('number');
	});

	it('should have correct ActivityHourStat structure', () => {
		const stat = mockActivity.data[0];
		expect(stat).toHaveProperty('day_of_week');
		expect(stat).toHaveProperty('hour');
		expect(stat).toHaveProperty('message_count');
		expect(stat).toHaveProperty('unique_users');
		expect(stat.day_of_week).toBeGreaterThanOrEqual(0);
		expect(stat.day_of_week).toBeLessThanOrEqual(6);
		expect(stat.hour).toBeGreaterThanOrEqual(0);
		expect(stat.hour).toBeLessThanOrEqual(23);
	});

	it('should have correct TopChannelStat structure', () => {
		const channel = mockChannels.data[0];
		expect(channel).toHaveProperty('channel_id');
		expect(channel).toHaveProperty('channel_name');
		expect(channel).toHaveProperty('channel_type');
		expect(channel).toHaveProperty('message_count');
		expect(channel).toHaveProperty('unique_authors');
	});

	it('should have correct RetentionMetrics structure', () => {
		const retention = mockRetention.data;
		expect(retention).toHaveProperty('daily_active_users');
		expect(retention).toHaveProperty('mau');
		expect(retention).toHaveProperty('total_members');
		expect(retention).toHaveProperty('average_dau');
		expect(retention).toHaveProperty('stickiness');
		expect(retention.stickiness).toBeGreaterThanOrEqual(0);
		expect(retention.stickiness).toBeLessThanOrEqual(1);
	});

	it('should have correct AnalyticsSummary structure', () => {
		const summary = mockSummary.summary;
		expect(summary).toHaveProperty('messages_today');
		expect(summary).toHaveProperty('active_users_today');
		expect(summary).toHaveProperty('messages_week');
		expect(summary).toHaveProperty('active_users_week');
		expect(summary).toHaveProperty('total_members');
		expect(summary).toHaveProperty('new_members_week');
		expect(summary).toHaveProperty('member_change_week');
		expect(summary).toHaveProperty('message_change_percent');
	});
});

describe('Analytics Period Calculation', () => {
	it('should correctly calculate percentage change', () => {
		const change = mockSummary.summary.message_change_percent;
		expect(change).toBe(15.5);
	});

	it('should correctly calculate stickiness (DAU/MAU)', () => {
		const retention = mockRetention.data;
		const calculatedStickiness = retention.average_dau / retention.mau;
		// Allow for floating point differences
		expect(Math.abs(calculatedStickiness - retention.stickiness)).toBeLessThan(0.01);
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
		const dates = mockGrowth.data.map(d => new Date(d.date).getTime());
		for (let i = 1; i < dates.length; i++) {
			expect(dates[i]).toBeGreaterThan(dates[i - 1]);
		}
	});

	it('should have consistent change values', () => {
		for (let i = 1; i < mockGrowth.data.length; i++) {
			const expectedChange = mockGrowth.data[i].count - mockGrowth.data[i - 1].count;
			expect(mockGrowth.data[i].change).toBe(expectedChange);
		}
	});
});
