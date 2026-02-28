/**
 * Native desktop state store.
 *
 * Centralizes all native Tauri event state (focus mode, mute, privacy,
 * network, session lock, snooze) into a single reactive store so any
 * component can read the current native state without setting up its
 * own listeners.
 */
import { writable, derived } from 'svelte/store';

export interface NativeDesktopState {
	/** Whether focus mode (mentions/DMs only) is active */
	focusModeActive: boolean;
	/** Whether notifications are muted */
	muted: boolean;
	/** Whether privacy/boss-key mode is active */
	privacyMode: boolean;
	/** Whether notifications are snoozed */
	snoozed: boolean;
	/** Human-readable snooze remaining text */
	snoozeUntil: string | null;
	/** Whether the OS session is locked */
	sessionLocked: boolean;
	/** Whether the network is online */
	online: boolean;
	/** Network connection type */
	networkType: string;
	/** Whether the main window is currently visible */
	windowVisible: boolean;
}

const initialState: NativeDesktopState = {
	focusModeActive: false,
	muted: false,
	privacyMode: false,
	snoozed: false,
	snoozeUntil: null,
	sessionLocked: false,
	online: true,
	networkType: 'unknown',
	windowVisible: true
};

function createNativeStateStore() {
	const { subscribe, update, set } = writable<NativeDesktopState>(initialState);

	return {
		subscribe,

		setFocusMode(active: boolean) {
			update((s) => ({ ...s, focusModeActive: active }));
		},

		setMuted(muted: boolean) {
			update((s) => ({ ...s, muted }));
		},

		setPrivacyMode(active: boolean) {
			update((s) => ({ ...s, privacyMode: active }));
		},

		setSnooze(active: boolean, until: string | null = null) {
			update((s) => ({ ...s, snoozed: active, snoozeUntil: until }));
		},

		setSessionLocked(locked: boolean) {
			update((s) => ({ ...s, sessionLocked: locked }));
		},

		setNetwork(online: boolean, networkType: string) {
			update((s) => ({ ...s, online, networkType }));
		},

		setWindowVisible(visible: boolean) {
			update((s) => ({ ...s, windowVisible: visible }));
		},

		reset() {
			set(initialState);
		}
	};
}

export const nativeState = createNativeStateStore();

/** True when any notification suppression is active (muted, snoozed, focus, or DND) */
export const notificationsSuppressed = derived(nativeState, ($state) =>
	$state.muted || $state.snoozed || $state.focusModeActive
);

/** True when the app is in a "reduced" mode (privacy or session locked) */
export const appReduced = derived(nativeState, ($state) =>
	$state.privacyMode || $state.sessionLocked
);
