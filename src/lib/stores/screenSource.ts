/**
 * Screen source selection store for native screen sharing
 * Manages the screen/window picker UI and selected source
 */

import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface ScreenSource {
	id: string;
	name: string;
	sourceType: 'screen' | 'window';
	thumbnail?: string;
	appIcon?: string;
	isPrimary: boolean;
}

interface ScreenSourceState {
	sources: ScreenSource[];
	selectedSource: ScreenSource | null;
	isPickerOpen: boolean;
	isLoading: boolean;
	error: string | null;
}

const initialState: ScreenSourceState = {
	sources: [],
	selectedSource: null,
	isPickerOpen: false,
	isLoading: false,
	error: null
};

// Create the main store
function createScreenSourceStore() {
	const { subscribe, update, set } = writable<ScreenSourceState>(initialState);

	return {
		subscribe,

		/**
		 * Open the screen source picker modal
		 */
		openPicker: async () => {
			update(state => ({ ...state, isPickerOpen: true, isLoading: true, error: null }));
			
			try {
				const sources = await invoke<ScreenSource[]>('get_screen_sources');
				update(state => ({
					...state,
					sources,
					isLoading: false,
					// Auto-select primary screen if nothing selected
					selectedSource: state.selectedSource || sources.find(s => s.isPrimary) || null
				}));
			} catch (err) {
				update(state => ({
					...state,
					isLoading: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		},

		/**
		 * Close the picker modal
		 */
		closePicker: () => {
			update(state => ({ ...state, isPickerOpen: false }));
		},

		/**
		 * Select a screen source
		 */
		selectSource: (sourceId: string) => {
			update(state => {
				const source = state.sources.find(s => s.id === sourceId);
				return {
					...state,
					selectedSource: source || null
				};
			});
		},

		/**
		 * Get the currently selected source
		 */
		getSelectedSource: () => {
			const state = get({ subscribe });
			return state.selectedSource;
		},

		/**
		 * Confirm selection and close picker
		 */
		confirmSelection: () => {
			update(state => ({ ...state, isPickerOpen: false }));
		},

		/**
		 * Cancel selection and close picker
		 */
		cancel: () => {
			update(state => ({
				...state,
				isPickerOpen: false,
				selectedSource: null,
				sources: []
			}));
		},

		/**
		 * Refresh the list of available sources
		 */
		refresh: async () => {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				const sources = await invoke<ScreenSource[]>('get_screen_sources');
				update(state => ({
					...state,
					sources,
					isLoading: false
				}));
			} catch (err) {
				update(state => ({
					...state,
					isLoading: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		},

		/**
		 * Reset the store to initial state
		 */
		reset: () => {
			set(initialState);
		}
	};
}

export const screenSource = createScreenSourceStore();

// Derived stores for convenience
export const isScreenSourcePickerOpen = derived(
	screenSource,
	$state => $state.isPickerOpen
);

export const selectedScreenSource = derived(
	screenSource,
	$state => $state.selectedSource
);

export const screenSources = derived(
	screenSource,
	$state => $state.sources
);

export const isLoadingScreenSources = derived(
	screenSource,
	$state => $state.isLoading
);

export const screenSourceError = derived(
	screenSource,
	$state => $state.error
);
