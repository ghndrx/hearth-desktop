import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';

export interface WindowState {
	visible: boolean;
	minimized: boolean;
	focused: boolean;
}

export type AppStatus = 'online' | 'away' | 'busy' | 'offline';

const initialWindowState: WindowState = {
	visible: true,
	minimized: false,
	focused: true
};

function createWindowStore() {
	const { subscribe, set, update } = writable<WindowState>(initialWindowState);

	return {
		subscribe,

		async init() {
			if (!browser) return;

			try {
				const visible = await invoke<boolean>('get_window_visibility');
				update((state) => ({ ...state, visible }));
			} catch (error) {
				console.warn('Failed to get window visibility:', error);
			}
		},

		async toggleVisibility(): Promise<boolean> {
			if (!browser) return false;

			try {
				const newVisibility = await invoke<boolean>('toggle_window_visibility');
				update((state) => ({ ...state, visible: newVisibility }));
				return newVisibility;
			} catch (error) {
				console.error('Failed to toggle window visibility:', error);
				return false;
			}
		},

		async show(): Promise<void> {
			if (!browser) return;

			try {
				await invoke('toggle_window_visibility');
				update((state) => ({ ...state, visible: true }));
			} catch (error) {
				console.error('Failed to show window:', error);
			}
		},

		async hide(): Promise<void> {
			if (!browser) return;

			try {
				await invoke('toggle_window_visibility');
				update((state) => ({ ...state, visible: false }));
			} catch (error) {
				console.error('Failed to hide window:', error);
			}
		},

		setMinimized(minimized: boolean) {
			update((state) => ({ ...state, minimized }));
		},

		setFocused(focused: boolean) {
			update((state) => ({ ...state, focused }));
		}
	};
}

function createTrayStatusStore() {
	const { subscribe, set, update } = writable<AppStatus>('online');

	return {
		subscribe,

		async setStatus(status: AppStatus) {
			if (!browser) return;

			try {
				await invoke('update_tray_status', { status });
				set(status);
			} catch (error) {
				console.error('Failed to update tray status:', error);
			}
		},

		// Auto-update status based on app state
		async updateFromAppState(isAuthenticated: boolean, hasConnections: boolean) {
			let newStatus: AppStatus;

			if (!isAuthenticated) {
				newStatus = 'offline';
			} else if (hasConnections) {
				newStatus = 'online';
			} else {
				newStatus = 'away';
			}

			await this.setStatus(newStatus);
		}
	};
}

export const windowState = createWindowStore();
export const trayStatus = createTrayStatusStore();

// Derived stores for convenience
export const isWindowVisible = derived(windowState, ($state) => $state.visible);
export const isWindowMinimized = derived(windowState, ($state) => $state.minimized);
export const isWindowFocused = derived(windowState, ($state) => $state.focused);

// Window event handlers for better integration
export function setupWindowEventHandlers() {
	if (!browser) return;

	// Listen for window focus/blur events
	window.addEventListener('focus', () => {
		windowState.setFocused(true);
	});

	window.addEventListener('blur', () => {
		windowState.setFocused(false);
	});

	// Listen for visibility change events
	document.addEventListener('visibilitychange', () => {
		const visible = !document.hidden;
		windowState.setMinimized(!visible);
	});

	// Listen for tray status updates from backend
	if (typeof window !== 'undefined' && (window as any).__TAURI__) {
		import('@tauri-apps/api/event').then(({ listen }) => {
			listen('tray-status-update', (event) => {
				console.log('Tray status updated:', event.payload);
			});
		});
	}
}