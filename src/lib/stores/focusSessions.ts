import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface FocusSessionState {
	phase: 'work' | 'shortBreak' | 'longBreak' | 'idle';
	isRunning: boolean;
	isPaused: boolean;
	currentSessionNumber: number;
	totalSessionsToday: number;
	totalFocusMinutesToday: number;
	startedAt: string | null;
	remainingSeconds: number;
	elapsedSeconds: number;
	currentLabel: string | null;
	interruptions: number;
	streakDays: number;
}

export interface FocusSessionSettings {
	workDuration: number;
	shortBreakDuration: number;
	longBreakDuration: number;
	sessionsBeforeLongBreak: number;
	autoDnd: boolean;
	breakNotifications: boolean;
	autoStartBreaks: boolean;
	autoStartWork: boolean;
	dailyGoalMinutes: number;
	soundEnabled: boolean;
}

export interface FocusStats {
	totalSessions: number;
	totalFocusMinutes: number;
	averageSessionMinutes: number;
	completionRate: number;
	todaySessions: number;
	todayFocusMinutes: number;
	dailyGoalMinutes: number;
	dailyGoalProgress: number;
	currentStreak: number;
	longestStreak: number;
	mostProductiveHour: number | null;
	weeklyMinutes: number[];
}

export interface SessionRecord {
	id: string;
	startedAt: string;
	endedAt: string;
	durationMinutes: number;
	phase: string;
	completed: boolean;
	label: string | null;
	interruptions: number;
}

const defaultState: FocusSessionState = {
	phase: 'idle',
	isRunning: false,
	isPaused: false,
	currentSessionNumber: 0,
	totalSessionsToday: 0,
	totalFocusMinutesToday: 0,
	startedAt: null,
	remainingSeconds: 0,
	elapsedSeconds: 0,
	currentLabel: null,
	interruptions: 0,
	streakDays: 0
};

const defaultSettings: FocusSessionSettings = {
	workDuration: 25,
	shortBreakDuration: 5,
	longBreakDuration: 15,
	sessionsBeforeLongBreak: 4,
	autoDnd: true,
	breakNotifications: true,
	autoStartBreaks: false,
	autoStartWork: false,
	dailyGoalMinutes: 120,
	soundEnabled: true
};

export const focusSessionState = writable<FocusSessionState>(defaultState);
export const focusSessionSettings = writable<FocusSessionSettings>(defaultSettings);
export const focusSessionStats = writable<FocusStats | null>(null);
export const focusSessionHistory = writable<SessionRecord[]>([]);

let tickInterval: ReturnType<typeof setInterval> | null = null;

export const focusTimeDisplay = derived(focusSessionState, ($state) => {
	const minutes = Math.floor($state.remainingSeconds / 60);
	const seconds = $state.remainingSeconds % 60;
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

export const focusProgress = derived(
	[focusSessionState, focusSessionSettings],
	([$state, $settings]) => {
		if (!$state.isRunning) return 0;
		const totalSeconds =
			$state.phase === 'work'
				? $settings.workDuration * 60
				: $state.phase === 'shortBreak'
					? $settings.shortBreakDuration * 60
					: $settings.longBreakDuration * 60;
		return totalSeconds > 0 ? (($state.elapsedSeconds / totalSeconds) * 100) : 0;
	}
);

export const dailyGoalProgress = derived(
	[focusSessionState, focusSessionSettings],
	([$state, $settings]) => {
		if ($settings.dailyGoalMinutes === 0) return 0;
		return Math.min(($state.totalFocusMinutesToday / $settings.dailyGoalMinutes) * 100, 100);
	}
);

function startTicking() {
	if (tickInterval) return;
	tickInterval = setInterval(async () => {
		try {
			const state = await invoke<FocusSessionState>('focus_session_tick');
			focusSessionState.set(state);
			if (state.remainingSeconds === 0 && state.isRunning) {
				stopTicking();
			}
		} catch {
			// Tick failed, will retry
		}
	}, 1000);
}

function stopTicking() {
	if (tickInterval) {
		clearInterval(tickInterval);
		tickInterval = null;
	}
}

export async function startFocusSession(label?: string): Promise<void> {
	const state = await invoke<FocusSessionState>('focus_session_start', { label: label ?? null });
	focusSessionState.set(state);
	startTicking();
}

export async function pauseFocusSession(): Promise<void> {
	const state = await invoke<FocusSessionState>('focus_session_pause');
	focusSessionState.set(state);
	if (state.isPaused) {
		stopTicking();
	} else {
		startTicking();
	}
}

export async function stopFocusSession(): Promise<void> {
	stopTicking();
	const state = await invoke<FocusSessionState>('focus_session_stop');
	focusSessionState.set(state);
	await loadFocusStats();
}

export async function skipFocusPhase(): Promise<void> {
	const state = await invoke<FocusSessionState>('focus_session_skip');
	focusSessionState.set(state);
}

export async function loadFocusState(): Promise<void> {
	const state = await invoke<FocusSessionState>('focus_session_get_state');
	focusSessionState.set(state);
	if (state.isRunning && !state.isPaused) {
		startTicking();
	}
}

export async function loadFocusSettings(): Promise<void> {
	const settings = await invoke<FocusSessionSettings>('focus_session_get_settings');
	focusSessionSettings.set(settings);
}

export async function updateFocusSettings(settings: FocusSessionSettings): Promise<void> {
	const updated = await invoke<FocusSessionSettings>('focus_session_update_settings', { settings });
	focusSessionSettings.set(updated);
}

export async function loadFocusStats(): Promise<void> {
	const stats = await invoke<FocusStats>('focus_session_get_stats');
	focusSessionStats.set(stats);
}

export async function loadFocusHistory(limit?: number): Promise<void> {
	const history = await invoke<SessionRecord[]>('focus_session_get_history', { limit: limit ?? null });
	focusSessionHistory.set(history);
}

export async function clearFocusHistory(): Promise<void> {
	await invoke('focus_session_clear_history');
	focusSessionHistory.set([]);
}
