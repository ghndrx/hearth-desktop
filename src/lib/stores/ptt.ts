import { writable, derived, get } from 'svelte/store';
import { voiceState, voiceActions } from './voice';

export interface PTTState {
	isPTTMode: boolean;
	isPTTActive: boolean;
	pttKey: string[];
}

const initialPTTState: PTTState = {
	isPTTMode: false,
	isPTTActive: false,
	pttKey: ['Ctrl', '`'],
};

function createPTTStore() {
	const { subscribe, update } = writable<PTTState>(initialPTTState);

	return {
		subscribe,

		setPTTMode: (enabled: boolean) =>
			update((s) => {
				if (enabled) {
					// When entering PTT mode, mute by default
					voiceActions.setMuted(true);
				}
				return { ...s, isPTTMode: enabled };
			}),

		setPTTKey: (keys: string[]) => update((s) => ({ ...s, pttKey: keys })),

		startTransmission: () => {
			const voice = get(voiceState);
			if (!voice.isConnected) return;

			update((s) => {
				if (!s.isPTTMode) return s;
				// Unmute while PTT is held
				voiceActions.setMuted(false);
				return { ...s, isPTTActive: true };
			});
		},

		stopTransmission: () => {
			update((s) => {
				if (!s.isPTTMode) return s;
				// Re-mute when PTT is released
				voiceActions.setMuted(true);
				return { ...s, isPTTActive: false };
			});
		},
	};
}

export const pttState = createPTTStore();

// Derived convenience stores
export const isPTTMode = derived(pttState, ($s) => $s.isPTTMode);
export const isPTTActive = derived(pttState, ($s) => $s.isPTTActive);
export const pttKey = derived(pttState, ($s) => $s.pttKey);

// Action helpers
export const pttActions = {
	setPTTMode: pttState.setPTTMode,
	setPTTKey: pttState.setPTTKey,
	startTransmission: pttState.startTransmission,
	stopTransmission: pttState.stopTransmission,
};
