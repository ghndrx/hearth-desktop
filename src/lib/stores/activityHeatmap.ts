import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface EventTypeCount {
	event_type: string;
	count: number;
}

export interface DailyActivity {
	date: string;
	count: number;
	level: string;
	events: EventTypeCount[];
}

export interface DayCell {
	date: string;
	count: number;
	level: string;
	day_of_week: number;
}

export interface MonthLabel {
	name: string;
	week_index: number;
}

export interface HeatmapData {
	year: number;
	weeks: DayCell[][];
	months: MonthLabel[];
	total_count: number;
	active_days: number;
	max_daily: number;
}

export interface StreakInfo {
	current_streak: number;
	longest_streak: number;
	last_active_date: string | null;
}

export interface ActivityStats {
	total_events: number;
	active_days: number;
	average_per_day: number;
	most_active_day: string | null;
	most_active_count: number;
	event_type_breakdown: EventTypeCount[];
}

export interface HourlyActivity {
	hour: number;
	count: number;
}

export interface ServerActivity {
	server_id: string;
	count: number;
	days_active: number;
}

export const heatmapData = writable<HeatmapData | null>(null);
export const activityStats = writable<ActivityStats | null>(null);
export const todayActivity = writable<DailyActivity | null>(null);

export async function loadHeatmapYear(year: number): Promise<HeatmapData> {
	const data = await invoke<HeatmapData>('heatmap_get_year', { year });
	heatmapData.set(data);
	return data;
}

export async function recordActivity(
	eventType: string,
	serverId?: string,
	channelId?: string
): Promise<DailyActivity> {
	const result = await invoke<DailyActivity>('heatmap_record_activity', {
		eventType,
		serverId: serverId ?? null,
		channelId: channelId ?? null
	});
	todayActivity.set(result);
	return result;
}

export async function getActivityStats(
	startDate: string,
	endDate: string
): Promise<ActivityStats> {
	const stats = await invoke<ActivityStats>('heatmap_get_stats', { startDate, endDate });
	activityStats.set(stats);
	return stats;
}

export async function getStreak(): Promise<StreakInfo> {
	return invoke<StreakInfo>('heatmap_get_streak');
}

export async function getToday(): Promise<DailyActivity> {
	const result = await invoke<DailyActivity>('heatmap_get_today');
	todayActivity.set(result);
	return result;
}

export async function getRange(startDate: string, endDate: string): Promise<DailyActivity[]> {
	return invoke<DailyActivity[]>('heatmap_get_range', { startDate, endDate });
}

export async function getPeakHours(): Promise<HourlyActivity[]> {
	return invoke<HourlyActivity[]>('heatmap_get_peak_hours');
}

export async function getServerBreakdown(
	startDate: string,
	endDate: string
): Promise<ServerActivity[]> {
	return invoke<ServerActivity[]>('heatmap_get_server_breakdown', { startDate, endDate });
}

export async function clearHeatmap(): Promise<boolean> {
	const result = await invoke<boolean>('heatmap_clear');
	heatmapData.set(null);
	activityStats.set(null);
	todayActivity.set(null);
	return result;
}
