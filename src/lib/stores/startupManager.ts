import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface StartupTask {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
	priority: number;
	deferMs: number;
	category: string;
	averageDurationMs: number;
	lastDurationMs: number | null;
	runCount: number;
}

export interface StartupProfile {
	id: string;
	name: string;
	description: string;
	taskIds: string[];
	isActive: boolean;
}

export interface TaskTiming {
	taskId: string;
	taskName: string;
	durationMs: number;
	percentage: number;
}

export interface StartupMetrics {
	totalStartupTimeMs: number;
	fastestStartupMs: number;
	slowestStartupMs: number;
	averageStartupMs: number;
	startupCount: number;
	lastStartupTime: string | null;
	taskTimings: TaskTiming[];
}

export interface StartupState {
	tasks: StartupTask[];
	profiles: StartupProfile[];
	activeProfileId: string | null;
	metrics: StartupMetrics;
	startupOptimizationEnabled: boolean;
	lazyLoadEnabled: boolean;
	preloadRecentChannels: boolean;
	preloadUserData: boolean;
}

export const startupState = writable<StartupState>({
	tasks: [],
	profiles: [],
	activeProfileId: null,
	metrics: {
		totalStartupTimeMs: 0,
		fastestStartupMs: 0,
		slowestStartupMs: 0,
		averageStartupMs: 0,
		startupCount: 0,
		lastStartupTime: null,
		taskTimings: []
	},
	startupOptimizationEnabled: true,
	lazyLoadEnabled: true,
	preloadRecentChannels: true,
	preloadUserData: true
});

export const startupTasks = derived(startupState, ($s) => $s.tasks);
export const startupProfiles = derived(startupState, ($s) => $s.profiles);
export const startupMetrics = derived(startupState, ($s) => $s.metrics);
export const enabledTasks = derived(startupState, ($s) => $s.tasks.filter((t) => t.enabled));

export async function loadStartupState(): Promise<void> {
	const state = await invoke<StartupState>('startup_get_state');
	startupState.set(state);
}

export async function toggleStartupTask(taskId: string): Promise<boolean> {
	const enabled = await invoke<boolean>('startup_toggle_task', { taskId });
	await loadStartupState();
	return enabled;
}

export async function setTaskDefer(taskId: string, deferMs: number): Promise<void> {
	await invoke('startup_set_task_defer', { taskId, deferMs });
	await loadStartupState();
}

export async function setTaskPriority(taskId: string, priority: number): Promise<void> {
	await invoke('startup_set_task_priority', { taskId, priority });
	await loadStartupState();
}

export async function recordTaskTiming(taskId: string, durationMs: number): Promise<void> {
	await invoke('startup_record_timing', { taskId, durationMs });
}

export async function recordBootTime(
	totalMs: number,
	taskTimings: TaskTiming[]
): Promise<StartupMetrics> {
	const metrics = await invoke<StartupMetrics>('startup_record_boot', { totalMs, taskTimings });
	await loadStartupState();
	return metrics;
}

export async function getStartupMetrics(): Promise<StartupMetrics> {
	return invoke<StartupMetrics>('startup_get_metrics');
}

export async function setActiveProfile(profileId: string): Promise<void> {
	await invoke('startup_set_active_profile', { profileId });
	await loadStartupState();
}

export async function createStartupProfile(
	name: string,
	description: string,
	taskIds: string[]
): Promise<StartupProfile> {
	const profile = await invoke<StartupProfile>('startup_create_profile', {
		name,
		description,
		taskIds
	});
	await loadStartupState();
	return profile;
}

export async function deleteStartupProfile(profileId: string): Promise<boolean> {
	const result = await invoke<boolean>('startup_delete_profile', { profileId });
	await loadStartupState();
	return result;
}

export async function setLazyLoad(enabled: boolean): Promise<void> {
	await invoke('startup_set_lazy_load', { enabled });
	startupState.update((s) => ({ ...s, lazyLoadEnabled: enabled }));
}

export async function setStartupOptimization(enabled: boolean): Promise<void> {
	await invoke('startup_set_optimization', { enabled });
	startupState.update((s) => ({ ...s, startupOptimizationEnabled: enabled }));
}

export async function resetStartupMetrics(): Promise<void> {
	await invoke('startup_reset_metrics');
	await loadStartupState();
}
