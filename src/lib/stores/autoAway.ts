/**
 * Auto-away state store.
 *
 * Tracks the user's detected presence tier (active / idle / away) based
 * on system idle time. The Rust backend monitors idle time and emits
 * tier-change events; this store holds the current state so components
 * can react (e.g. update gateway presence).
 */
import { writable, derived } from 'svelte/store';

export type PresenceTier = 'active' | 'idle' | 'away';

export interface AutoAwayState {
	tier: PresenceTier;
	idleSeconds: number;
	idleThreshold: number;
	awayThreshold: number;
	monitorActive: boolean;
	screenLocked: boolean;
}

const initialState: AutoAwayState = {
	tier: 'active',
	idleSeconds: 0,
	idleThreshold: 300,
	awayThreshold: 900,
	monitorActive: false,
	screenLocked: false
};

function createAutoAwayStore() {
	const { subscribe, update, set } = writable<AutoAwayState>(initialState);

	return {
		subscribe,

		setTier(tier: PresenceTier, idleSeconds: number, screenLocked: boolean) {
			update((s) => ({ ...s, tier, idleSeconds, screenLocked }));
		},

		setConfig(idleThreshold: number, awayThreshold: number) {
			update((s) => ({ ...s, idleThreshold, awayThreshold }));
		},

		setMonitorActive(active: boolean) {
			update((s) => ({ ...s, monitorActive: active }));
		},

		reset() {
			set(initialState);
		}
	};
}

export const autoAway = createAutoAwayStore();

/** True when the user is detected as not actively using the computer */
export const isUserIdle = derived(autoAway, ($state) => $state.tier !== 'active');

/** True when the user has been away long enough to be marked away */
export const isUserAway = derived(autoAway, ($state) => $state.tier === 'away');
