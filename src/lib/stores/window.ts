import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface WindowState {
	isPiPActive: boolean;
	isPiPVisible: boolean;
	pipPosition: { x: number; y: number } | null;
	pipSize: { width: number; height: number };
	snapCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
	alwaysOnTop: boolean;
	transparency: number; // 0.5 to 1.0
}

export interface PiPConfig {
	width: number;
	height: number;
	minWidth: number;
	minHeight: number;
	defaultCorner: WindowState['snapCorner'];
	defaultTransparency: number;
}

const defaultPiPConfig: PiPConfig = {
	width: 300,
	height: 200,
	minWidth: 250,
	minHeight: 150,
	defaultCorner: 'top-right',
	defaultTransparency: 0.9
};

const initialWindowState: WindowState = {
	isPiPActive: false,
	isPiPVisible: false,
	pipPosition: null,
	pipSize: { width: defaultPiPConfig.width, height: defaultPiPConfig.height },
	snapCorner: defaultPiPConfig.defaultCorner,
	alwaysOnTop: true,
	transparency: defaultPiPConfig.defaultTransparency
};

function createWindowStore() {
	const { subscribe, set, update } = writable<WindowState>(initialWindowState);

	return {
		subscribe,

		// PiP Window Management
		enablePiP: () => update(state => ({
			...state,
			isPiPActive: true,
			isPiPVisible: true
		})),

		disablePiP: () => update(state => ({
			...state,
			isPiPActive: false,
			isPiPVisible: false,
			pipPosition: null
		})),

		togglePiP: () => update(state => ({
			...state,
			isPiPActive: !state.isPiPActive,
			isPiPVisible: !state.isPiPActive
		})),

		showPiP: () => update(state => ({
			...state,
			isPiPVisible: true
		})),

		hidePiP: () => update(state => ({
			...state,
			isPiPVisible: false
		})),

		// Position Management
		setPiPPosition: (x: number, y: number) => update(state => ({
			...state,
			pipPosition: { x, y },
			snapCorner: null // Clear snap when manually positioned
		})),

		setPiPSize: (width: number, height: number) => update(state => ({
			...state,
			pipSize: {
				width: Math.max(width, defaultPiPConfig.minWidth),
				height: Math.max(height, defaultPiPConfig.minHeight)
			}
		})),

		snapToCorner: (corner: WindowState['snapCorner']) => update(state => {
			if (!browser) return state;

			let position: { x: number; y: number } | null = null;

			if (corner) {
				const screenWidth = window.screen.availWidth;
				const screenHeight = window.screen.availHeight;
				const padding = 20;

				switch (corner) {
					case 'top-left':
						position = { x: padding, y: padding };
						break;
					case 'top-right':
						position = { x: screenWidth - state.pipSize.width - padding, y: padding };
						break;
					case 'bottom-left':
						position = { x: padding, y: screenHeight - state.pipSize.height - padding };
						break;
					case 'bottom-right':
						position = { x: screenWidth - state.pipSize.width - padding, y: screenHeight - state.pipSize.height - padding };
						break;
				}
			}

			return {
				...state,
				snapCorner: corner,
				pipPosition: position
			};
		}),

		// Window Properties
		setAlwaysOnTop: (enabled: boolean) => update(state => ({
			...state,
			alwaysOnTop: enabled
		})),

		setTransparency: (transparency: number) => update(state => ({
			...state,
			transparency: Math.max(0.5, Math.min(1.0, transparency))
		})),

		// Load saved settings
		init: () => {
			if (!browser) return;

			const saved = localStorage.getItem('hearth_window_settings');
			if (saved) {
				try {
					const settings = JSON.parse(saved);
					update(state => ({
						...state,
						...settings,
						isPiPActive: false, // Always start with PiP disabled
						isPiPVisible: false
					}));
				} catch (e) {
					console.warn('[Window] Failed to load window settings:', e);
				}
			}
		},

		// Save settings to localStorage
		saveSettings: () => {
			if (!browser) return;

			// Get current state and save relevant settings
			const currentState = get(windowState);
			const settingsToSave = {
				pipSize: currentState.pipSize,
				snapCorner: currentState.snapCorner,
				alwaysOnTop: currentState.alwaysOnTop,
				transparency: currentState.transparency
			};

			localStorage.setItem('hearth_window_settings', JSON.stringify(settingsToSave));
		}
	};
}

// Store instance
export const windowState = createWindowStore();

// Action helpers
export const windowActions = {
	enablePiP: windowState.enablePiP,
	disablePiP: windowState.disablePiP,
	togglePiP: windowState.togglePiP,
	showPiP: windowState.showPiP,
	hidePiP: windowState.hidePiP,
	setPiPPosition: windowState.setPiPPosition,
	setPiPSize: windowState.setPiPSize,
	snapToCorner: windowState.snapToCorner,
	setAlwaysOnTop: windowState.setAlwaysOnTop,
	setTransparency: windowState.setTransparency,
	init: windowState.init,
	saveSettings: windowState.saveSettings
};

// Derived stores for convenience
export const isPiPActive = derived(windowState, $state => $state.isPiPActive);
export const isPiPVisible = derived(windowState, $state => $state.isPiPVisible);
export const pipPosition = derived(windowState, $state => $state.pipPosition);
export const pipSize = derived(windowState, $state => $state.pipSize);
export const pipSnapCorner = derived(windowState, $state => $state.snapCorner);
export const isAlwaysOnTop = derived(windowState, $state => $state.alwaysOnTop);
export const windowTransparency = derived(windowState, $state => $state.transparency);

// Helper to get snap zone positions for drag and drop
export function getSnapZones() {
	if (!browser) return [];

	const screenWidth = window.screen.availWidth;
	const screenHeight = window.screen.availHeight;
	const padding = 20;
	const snapSize = 100; // Size of snap zone detection area

	return [
		{ corner: 'top-left', x: 0, y: 0, width: snapSize, height: snapSize },
		{ corner: 'top-right', x: screenWidth - snapSize, y: 0, width: snapSize, height: snapSize },
		{ corner: 'bottom-left', x: 0, y: screenHeight - snapSize, width: snapSize, height: snapSize },
		{ corner: 'bottom-right', x: screenWidth - snapSize, y: screenHeight - snapSize, width: snapSize, height: snapSize }
	] as const;
}

export { defaultPiPConfig };

// Get the current window state (helper function)
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
	let value: T;
	const unsubscribe = store.subscribe(v => value = v);
	unsubscribe();
	return value!;
}