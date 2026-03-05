import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface DailyStats {
	date: string;
	messages_sent: number;
	messages_received: number;
	reactions_sent: number;
	voice_minutes: number;
	active_minutes: number;
	servers_visited: number;
	channels_visited: number;
}

export interface HourlyActivity {
	hour: number;
	count: number;
}

export interface UsageSummary {
	total_messages_sent: number;
	total_messages_received: number;
	total_reactions: number;
	total_voice_minutes: number;
	total_active_hours: number;
	member_since: string | null;
	current_streak_days: number;
	longest_streak_days: number;
	hourly_activity: HourlyActivity[];
	favorite_time: string;
}

export interface WeeklyReport {
	week_start: string;
	week_end: string;
	total_messages: number;
	total_voice_minutes: number;
	total_active_minutes: number;
	most_active_day: string;
	most_active_hour: number;
	top_servers: [string, number][];
	top_channels: [string, number][];
	daily_breakdown: DailyStats[];
}

export interface UsageInsightsState {
	today: DailyStats | null;
	weekly: WeeklyReport | null;
	summary: UsageSummary | null;
	range: DailyStats[];
	loading: boolean;
	error: string | null;
}

function createUsageInsightsStore() {
	const { subscribe, update } = writable<UsageInsightsState>({
		today: null,
		weekly: null,
		summary: null,
		range: [],
		loading: false,
		error: null,
	});

	async function fetchToday() {
		try {
			const data = await invoke<DailyStats>('analytics_get_today');
			update(s => ({ ...s, today: data }));
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			update(s => ({ ...s, error: msg }));
			return null;
		}
	}

	async function fetchWeekly() {
		try {
			const data = await invoke<WeeklyReport>('analytics_get_weekly_report');
			update(s => ({ ...s, weekly: data }));
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			update(s => ({ ...s, error: msg }));
			return null;
		}
	}

	async function fetchSummary() {
		try {
			const data = await invoke<UsageSummary>('analytics_get_summary');
			update(s => ({ ...s, summary: data }));
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			update(s => ({ ...s, error: msg }));
			return null;
		}
	}

	async function fetchRange(days: number) {
		try {
			const data = await invoke<DailyStats[]>('analytics_get_range', { days });
			update(s => ({ ...s, range: data }));
			return data;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			update(s => ({ ...s, error: msg }));
			return [];
		}
	}

	async function loadAll() {
		update(s => ({ ...s, loading: true, error: null }));
		await Promise.all([fetchToday(), fetchWeekly(), fetchSummary(), fetchRange(7)]);
		update(s => ({ ...s, loading: false }));
	}

	async function refresh() {
		await loadAll();
	}

	return {
		subscribe,
		fetchToday,
		fetchWeekly,
		fetchSummary,
		fetchRange,
		loadAll,
		refresh,
	};
}

export const usageInsights = createUsageInsightsStore();

export const todayStats = derived(usageInsights, $s => $s.today);
export const weeklySummary = derived(usageInsights, $s => $s.weekly);
export const lifetimeSummary = derived(usageInsights, $s => $s.summary);
export const isInsightsLoading = derived(usageInsights, $s => $s.loading);
