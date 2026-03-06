import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Habit {
	id: string;
	name: string;
	description: string;
	category: string;
	color: string;
	frequency: string;
	createdAt: string;
	updatedAt: string;
	archived: boolean;
}

export interface HabitCompletion {
	id: string;
	habitId: string;
	date: string;
	completedAt: string;
}

export interface HabitStats {
	habitId: string;
	habitName: string;
	habitColor: string;
	habitCategory: string;
	totalCompletions: number;
	currentStreak: number;
	longestStreak: number;
	completionRate7d: number;
	completionRate30d: number;
	completionsThisWeek: number;
	completionsThisMonth: number;
}

export interface StreakInfo {
	habitId: string;
	currentStreak: number;
	longestStreak: number;
	lastCompleted: string | null;
}

export const habits = writable<Habit[]>([]);
export const habitStats = writable<HabitStats[]>([]);
export const habitCompletions = writable<Record<string, Set<string>>>({});

export const habitCount = derived(habits, ($habits) => $habits.length);

export const habitsByCategory = derived(habits, ($habits) => {
	const map: Record<string, Habit[]> = {};
	for (const h of $habits) {
		if (!map[h.category]) map[h.category] = [];
		map[h.category].push(h);
	}
	return map;
});

export async function loadHabits(): Promise<void> {
	const items = await invoke<Habit[]>('habit_get_all');
	habits.set(items);
}

export async function loadAllStats(): Promise<void> {
	const stats = await invoke<HabitStats[]>('habit_get_all_stats');
	habitStats.set(stats);
}

export async function createHabit(
	name: string,
	description?: string,
	category?: string,
	color?: string,
	frequency?: string
): Promise<Habit> {
	const habit = await invoke<Habit>('habit_create', {
		name,
		description,
		category,
		color,
		frequency
	});
	habits.update((items) => [...items, habit]);
	return habit;
}

export async function updateHabit(
	id: string,
	updates: {
		name?: string;
		description?: string;
		category?: string;
		color?: string;
		frequency?: string;
	}
): Promise<Habit> {
	const habit = await invoke<Habit>('habit_update', { id, ...updates });
	habits.update((items) => items.map((h) => (h.id === id ? habit : h)));
	return habit;
}

export async function deleteHabit(id: string): Promise<void> {
	await invoke<boolean>('habit_delete', { id });
	habits.update((items) => items.filter((h) => h.id !== id));
	habitStats.update((stats) => stats.filter((s) => s.habitId !== id));
}

export async function completeHabit(habitId: string, date?: string): Promise<HabitCompletion> {
	const completion = await invoke<HabitCompletion>('habit_complete', { habitId, date });
	habitCompletions.update((map) => {
		const updated = { ...map };
		if (!updated[habitId]) updated[habitId] = new Set();
		else updated[habitId] = new Set(updated[habitId]);
		updated[habitId].add(completion.date);
		return updated;
	});
	return completion;
}

export async function uncompleteHabit(habitId: string, date?: string): Promise<void> {
	const targetDate = date || new Date().toISOString().split('T')[0];
	await invoke<boolean>('habit_uncomplete', { habitId, date });
	habitCompletions.update((map) => {
		const updated = { ...map };
		if (updated[habitId]) {
			updated[habitId] = new Set(updated[habitId]);
			updated[habitId].delete(targetDate);
		}
		return updated;
	});
}

export async function getHabitCompletions(
	habitId: string,
	startDate: string,
	endDate: string
): Promise<HabitCompletion[]> {
	return invoke<HabitCompletion[]>('habit_get_completions', {
		habitId,
		startDate,
		endDate
	});
}

export async function getHabitStats(habitId: string): Promise<HabitStats> {
	return invoke<HabitStats>('habit_get_stats', { habitId });
}

export async function getHabitStreak(habitId: string): Promise<StreakInfo> {
	return invoke<StreakInfo>('habit_get_streak', { habitId });
}

export async function resetHabit(habitId: string): Promise<void> {
	await invoke<boolean>('habit_reset', { habitId });
	habitCompletions.update((map) => {
		const updated = { ...map };
		delete updated[habitId];
		return updated;
	});
}

export async function loadCompletionsForWeek(habitIds: string[]): Promise<void> {
	const today = new Date();
	const dayOfWeek = today.getDay();
	const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(today);
	monday.setDate(today.getDate() + mondayOffset);
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);

	const startDate = monday.toISOString().split('T')[0];
	const endDate = sunday.toISOString().split('T')[0];

	const allCompletions: Record<string, Set<string>> = {};

	for (const habitId of habitIds) {
		const completions = await getHabitCompletions(habitId, startDate, endDate);
		allCompletions[habitId] = new Set(completions.map((c) => c.date));
	}

	habitCompletions.set(allCompletions);
}
