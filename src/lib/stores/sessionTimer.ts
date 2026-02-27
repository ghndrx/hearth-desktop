import { writable, derived, get } from 'svelte/store';
import { toasts } from './toasts';

export interface SessionTimerState {
	/** Session start timestamp (ms) */
	startedAt: number;
	/** Total accumulated time (ms) - accounts for pauses */
	accumulatedMs: number;
	/** Whether the timer is currently running */
	isRunning: boolean;
	/** Whether break reminders are enabled */
	remindersEnabled: boolean;
	/** Break reminder interval (ms) - default 1 hour */
	reminderIntervalMs: number;
	/** Last reminder timestamp */
	lastReminderAt: number;
	/** Total breaks taken this session */
	breaksTaken: number;
}

const DEFAULT_REMINDER_INTERVAL = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = 'hearth:session-timer';

function loadState(): Partial<SessionTimerState> {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Ignore parse errors
	}
	return {};
}

function saveState(state: SessionTimerState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			remindersEnabled: state.remindersEnabled,
			reminderIntervalMs: state.reminderIntervalMs
		}));
	} catch {
		// Ignore storage errors
	}
}

function createSessionTimerStore() {
	const stored = loadState();
	const now = Date.now();

	const initialState: SessionTimerState = {
		startedAt: now,
		accumulatedMs: 0,
		isRunning: true,
		remindersEnabled: stored.remindersEnabled ?? true,
		reminderIntervalMs: stored.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL,
		lastReminderAt: now,
		breaksTaken: 0
	};

	const { subscribe, update, set } = writable<SessionTimerState>(initialState);

	let intervalId: ReturnType<typeof setInterval> | null = null;
	let reminderCheckId: ReturnType<typeof setInterval> | null = null;

	function startIntervals() {
		// Check for break reminders every minute
		if (reminderCheckId) clearInterval(reminderCheckId);
		reminderCheckId = setInterval(() => {
			const state = get({ subscribe });
			if (!state.isRunning || !state.remindersEnabled) return;

			const elapsed = getElapsedMs(state);
			const timeSinceReminder = Date.now() - state.lastReminderAt;

			if (timeSinceReminder >= state.reminderIntervalMs) {
				const hours = Math.floor(elapsed / (60 * 60 * 1000));
				const mins = Math.floor((elapsed % (60 * 60 * 1000)) / 60000);

				toasts.info(
					`You've been active for ${hours}h ${mins}m. Consider taking a break! 🧘`,
					{ duration: 10000 }
				);

				update((s) => ({ ...s, lastReminderAt: Date.now() }));
			}
		}, 60000);
	}

	function getElapsedMs(state: SessionTimerState): number {
		if (!state.isRunning) {
			return state.accumulatedMs;
		}
		return state.accumulatedMs + (Date.now() - state.startedAt);
	}

	// Start tracking on init
	startIntervals();

	return {
		subscribe,

		/** Pause the session timer */
		pause() {
			update((state) => {
				if (!state.isRunning) return state;
				return {
					...state,
					accumulatedMs: state.accumulatedMs + (Date.now() - state.startedAt),
					isRunning: false
				};
			});
		},

		/** Resume the session timer */
		resume() {
			update((state) => {
				if (state.isRunning) return state;
				return {
					...state,
					startedAt: Date.now(),
					isRunning: true
				};
			});
		},

		/** Toggle pause/resume */
		toggle() {
			const state = get({ subscribe });
			if (state.isRunning) {
				this.pause();
			} else {
				this.resume();
			}
		},

		/** Reset the timer and log a break */
		takeBreak() {
			const state = get({ subscribe });
			const elapsed = getElapsedMs(state);

			update((s) => ({
				...s,
				startedAt: Date.now(),
				accumulatedMs: 0,
				isRunning: true,
				lastReminderAt: Date.now(),
				breaksTaken: s.breaksTaken + 1
			}));

			const mins = Math.floor(elapsed / 60000);
			toasts.success(`Break logged! Previous session: ${mins} minutes. Enjoy your rest! ☕`);
		},

		/** Enable or disable break reminders */
		setRemindersEnabled(enabled: boolean) {
			update((state) => {
				const newState = { ...state, remindersEnabled: enabled };
				saveState(newState);
				return newState;
			});
		},

		/** Set the reminder interval in minutes */
		setReminderIntervalMinutes(minutes: number) {
			update((state) => {
				const newState = {
					...state,
					reminderIntervalMs: minutes * 60 * 1000
				};
				saveState(newState);
				return newState;
			});
		},

		/** Get current elapsed time in ms */
		getElapsed(): number {
			return getElapsedMs(get({ subscribe }));
		},

		/** Cleanup intervals */
		destroy() {
			if (intervalId) clearInterval(intervalId);
			if (reminderCheckId) clearInterval(reminderCheckId);
		}
	};
}

export const sessionTimer = createSessionTimerStore();

/** Derived store for formatted elapsed time (HH:MM:SS) */
export const elapsedFormatted = derived(
	sessionTimer,
	($timer, set) => {
		function format() {
			const elapsed = $timer.isRunning
				? $timer.accumulatedMs + (Date.now() - $timer.startedAt)
				: $timer.accumulatedMs;

			const totalSeconds = Math.floor(elapsed / 1000);
			const hours = Math.floor(totalSeconds / 3600);
			const minutes = Math.floor((totalSeconds % 3600) / 60);
			const seconds = totalSeconds % 60;

			return `${hours.toString().padStart(2, '0')}:${minutes
				.toString()
				.padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}

		set(format());

		// Update every second when running
		const intervalId = setInterval(() => {
			if ($timer.isRunning) {
				set(format());
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}
);

/** Derived store for human-readable elapsed time */
export const elapsedHuman = derived(sessionTimer, ($timer) => {
	const elapsed = $timer.isRunning
		? $timer.accumulatedMs + (Date.now() - $timer.startedAt)
		: $timer.accumulatedMs;

	const totalMinutes = Math.floor(elapsed / 60000);

	if (totalMinutes < 1) return 'Just started';
	if (totalMinutes < 60) return `${totalMinutes}m`;

	const hours = Math.floor(totalMinutes / 60);
	const mins = totalMinutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
});
