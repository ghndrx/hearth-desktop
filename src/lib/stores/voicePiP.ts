import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { miniMode } from '$lib/tauri';
import { isInVoice, voiceState } from './voice';

export interface VoicePiPState {
	isActive: boolean;
	isTransitioning: boolean;
	position: { x: number; y: number };
	error: string | null;
}

const initialState: VoicePiPState = {
	isActive: false,
	isTransitioning: false,
	position: { x: 100, y: 100 },
	error: null
};

function createVoicePiPStore() {
	const { subscribe, set, update } = writable<VoicePiPState>(initialState);

	return {
		subscribe,
		set,
		update,

		// Enter PiP mode
		async enter(corner: string = 'bottom-right') {
			if (!browser) return false;

			update(state => ({ ...state, isTransitioning: true, error: null }));

			try {
				// Only enter PiP if we're in voice
				const $isInVoice = get(isInVoice);
				if (!$isInVoice) {
					throw new Error('Cannot enter PiP mode without active voice connection');
				}

				await miniMode.enter(corner);

				update(state => ({
					...state,
					isActive: true,
					isTransitioning: false,
					error: null
				}));

				return true;
			} catch (error) {
				console.error('Failed to enter voice PiP mode:', error);
				update(state => ({
					...state,
					isTransitioning: false,
					error: error instanceof Error ? error.message : 'Failed to enter PiP mode'
				}));
				return false;
			}
		},

		// Exit PiP mode
		async exit() {
			if (!browser) return false;

			update(state => ({ ...state, isTransitioning: true, error: null }));

			try {
				await miniMode.exit();

				update(state => ({
					...state,
					isActive: false,
					isTransitioning: false,
					error: null
				}));

				return true;
			} catch (error) {
				console.error('Failed to exit voice PiP mode:', error);
				update(state => ({
					...state,
					isTransitioning: false,
					error: error instanceof Error ? error.message : 'Failed to exit PiP mode'
				}));
				return false;
			}
		},

		// Toggle PiP mode
		async toggle(corner: string = 'bottom-right') {
			const state = get({ subscribe });
			if (state.isActive) {
				return await this.exit();
			} else {
				return await this.enter(corner);
			}
		},

		// Update position (for dragging)
		updatePosition(x: number, y: number) {
			update(state => ({
				...state,
				position: { x, y }
			}));
		},

		// Auto-exit when voice disconnects
		autoExitOnDisconnect() {
			if (!browser) return;

			const unsubscribe = isInVoice.subscribe($isInVoice => {
				if (!$isInVoice) {
					const state = get({ subscribe });
					if (state.isActive) {
						this.exit();
					}
				}
			});

			return unsubscribe;
		},

		// Reset state
		reset() {
			set(initialState);
		}
	};
}

export const voicePiPState = createVoicePiPStore();

// Derived stores
export const isPiPActive = derived(voicePiPState, $state => $state.isActive);
export const isPiPTransitioning = derived(voicePiPState, $state => $state.isTransitioning);
export const canEnterPiP = derived(
	[isInVoice, isPiPActive, isPiPTransitioning],
	([$isInVoice, $isPiPActive, $isPiPTransitioning]) =>
		$isInVoice && !$isPiPActive && !$isPiPTransitioning
);

// Voice PiP actions
export const voicePiPActions = {
	enter: (corner?: string) => voicePiPState.enter(corner),
	exit: () => voicePiPState.exit(),
	toggle: (corner?: string) => voicePiPState.toggle(corner),
	updatePosition: (x: number, y: number) => voicePiPState.updatePosition(x, y)
};

// Auto-setup: exit PiP when voice disconnects
if (browser) {
	voicePiPState.autoExitOnDisconnect();
}