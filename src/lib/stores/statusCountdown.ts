import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface StatusCountdown {
	id: string;
	label: string;
	emoji: string | null;
	durationMs: number;
	startedAt: number;
	expiresAt: number;
	paused: boolean;
	remainingMs: number;
}

export interface StatusPreset {
	label: string;
	emoji: string | null;
	duration_ms: number;
}

interface CountdownState {
	active: StatusCountdown | null;
	presets: StatusPreset[];
	loading: boolean;
}

const EMOJI_MAP: Record<string, string> = {
	calendar: '\uD83D\uDCC5',
	coffee: '\u2615',
	headphones: '\uD83C\uDFA7',
	clock: '\u23F0',
	no_entry: '\u26D4',
	lunch: '\uD83C\uDF5C',
	gym: '\uD83C\uDFCB\uFE0F',
	sleep: '\uD83D\uDE34'
};

export function emojiFromKey(key: string | null): string {
	if (!key) return '';
	return EMOJI_MAP[key] ?? key;
}

function createCountdownStore() {
	const { subscribe, set, update } = writable<CountdownState>({
		active: null,
		presets: [],
		loading: false
	});

	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null =
		null;
	let tauriListen: ((event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;
	const unlisten: (() => void)[] = [];

	function startTicking() {
		stopTicking();
		tickInterval = setInterval(() => {
			update((s) => {
				if (!s.active || s.active.paused) return s;
				const now = Date.now();
				const remaining = Math.max(0, s.active.expiresAt - now);
				if (remaining === 0) {
					stopTicking();
					return { ...s, active: null };
				}
				return {
					...s,
					active: { ...s.active, remainingMs: remaining }
				};
			});
		}, 1000);
	}

	function stopTicking() {
		if (tickInterval) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
	}

	async function init() {
		if (!browser) return;

		try {
			const tauri = await import('@tauri-apps/api/core');
			const events = await import('@tauri-apps/api/event');
			tauriInvoke = tauri.invoke;
			tauriListen = events.listen;

			// Load current state
			const [active, presets] = await Promise.all([
				tauri.invoke('countdown_get') as Promise<StatusCountdown | null>,
				tauri.invoke('countdown_get_presets') as Promise<StatusPreset[]>
			]);

			set({ active, presets, loading: false });
			if (active && !active.paused) startTicking();

			// Listen for Tauri events
			const u1 = await events.listen('countdown:expired', () => {
				stopTicking();
				update((s) => ({ ...s, active: null }));
			});
			const u2 = await events.listen('countdown:stopped', () => {
				stopTicking();
				update((s) => ({ ...s, active: null }));
			});
			unlisten.push(u1, u2);
		} catch {
			// Not in Tauri environment - use local-only mode
			set({
				active: null,
				presets: [
					{ label: 'In a meeting', emoji: 'calendar', duration_ms: 30 * 60 * 1000 },
					{ label: 'Taking a break', emoji: 'coffee', duration_ms: 15 * 60 * 1000 },
					{ label: 'Focusing', emoji: 'headphones', duration_ms: 60 * 60 * 1000 },
					{ label: 'Be right back', emoji: 'clock', duration_ms: 5 * 60 * 1000 },
					{ label: 'Do not disturb', emoji: 'no_entry', duration_ms: 120 * 60 * 1000 }
				],
				loading: false
			});
		}
	}

	async function start(label: string, emoji: string | null, durationMs: number) {
		if (tauriInvoke) {
			try {
				const result = (await tauriInvoke('countdown_start', {
					label,
					emoji,
					durationMs
				})) as StatusCountdown;
				update((s) => ({ ...s, active: result }));
				startTicking();
				return;
			} catch {
				// Fall through to local mode
			}
		}

		// Local-only fallback
		const now = Date.now();
		const countdown: StatusCountdown = {
			id: crypto.randomUUID(),
			label,
			emoji,
			durationMs,
			startedAt: now,
			expiresAt: now + durationMs,
			paused: false,
			remainingMs: durationMs
		};
		update((s) => ({ ...s, active: countdown }));
		startTicking();
	}

	async function stop() {
		stopTicking();
		if (tauriInvoke) {
			try {
				await tauriInvoke('countdown_stop');
			} catch {
				// ignore
			}
		}
		update((s) => ({ ...s, active: null }));
	}

	async function pause() {
		if (tauriInvoke) {
			try {
				const result = (await tauriInvoke('countdown_pause')) as StatusCountdown | null;
				if (result) {
					stopTicking();
					update((s) => ({ ...s, active: result }));
					return;
				}
			} catch {
				// Fall through
			}
		}
		stopTicking();
		update((s) => {
			if (!s.active) return s;
			const now = Date.now();
			return {
				...s,
				active: {
					...s.active,
					paused: true,
					remainingMs: Math.max(0, s.active.expiresAt - now)
				}
			};
		});
	}

	async function resume() {
		if (tauriInvoke) {
			try {
				const result = (await tauriInvoke('countdown_resume')) as StatusCountdown | null;
				if (result) {
					update((s) => ({ ...s, active: result }));
					startTicking();
					return;
				}
			} catch {
				// Fall through
			}
		}
		update((s) => {
			if (!s.active) return s;
			const now = Date.now();
			return {
				...s,
				active: {
					...s.active,
					paused: false,
					expiresAt: now + s.active.remainingMs
				}
			};
		});
		startTicking();
	}

	async function extend(additionalMs: number) {
		if (tauriInvoke) {
			try {
				const result = (await tauriInvoke('countdown_extend', {
					additionalMs
				})) as StatusCountdown | null;
				if (result) {
					update((s) => ({ ...s, active: result }));
					return;
				}
			} catch {
				// Fall through
			}
		}
		update((s) => {
			if (!s.active) return s;
			return {
				...s,
				active: {
					...s.active,
					expiresAt: s.active.expiresAt + additionalMs,
					durationMs: s.active.durationMs + additionalMs,
					remainingMs: s.active.remainingMs + additionalMs
				}
			};
		});
	}

	function cleanup() {
		stopTicking();
		for (const u of unlisten) u();
		unlisten.length = 0;
	}

	return {
		subscribe,
		init,
		start,
		stop,
		pause,
		resume,
		extend,
		cleanup
	};
}

export const statusCountdown = createCountdownStore();

export const activeCountdown = derived(statusCountdown, ($s) => $s.active);
export const countdownPresets = derived(statusCountdown, ($s) => $s.presets);
export const isCountdownActive = derived(statusCountdown, ($s) => $s.active !== null);

export const countdownProgress = derived(statusCountdown, ($s) => {
	if (!$s.active) return 0;
	return Math.max(0, Math.min(100, ($s.active.remainingMs / $s.active.durationMs) * 100));
});

export const countdownFormatted = derived(statusCountdown, ($s) => {
	if (!$s.active) return '00:00';
	const totalSec = Math.ceil($s.active.remainingMs / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const sec = totalSec % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
	return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
});
