import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { userStatus, type UserStatus } from './app.js';

export interface VoiceState {
	isConnected: boolean;
	channelId: string | null;
	serverId: string | null;
	selfMuted: boolean;
	selfDeafened: boolean;
	connecting: boolean;
	error: string | null;
	speaking: { [userId: string]: boolean };
}

export interface TranscriptionEntry {
	id: string;
	userId: string;
	username: string;
	text: string;
	timestamp: number;
	confidence: number;
	language: string;
	isFinal: boolean;
}

export interface TranscriptionState {
	isEnabled: boolean;
	isInitializing: boolean;
	isReady: boolean;
	language: string;
	autoDetectLanguage: boolean;
	entries: TranscriptionEntry[];
	error: string | null;
	settings: {
		showConfidence: boolean;
		showTimestamps: boolean;
		maxEntries: number;
		minConfidence: number;
	};
}

const initialVoiceState: VoiceState = {
	isConnected: false,
	channelId: null,
	serverId: null,
	selfMuted: false,
	selfDeafened: false,
	connecting: false,
	error: null,
	speaking: {},
};

const initialTranscriptionState: TranscriptionState = {
	isEnabled: false,
	isInitializing: false,
	isReady: false,
	language: 'en',
	autoDetectLanguage: true,
	entries: [],
	error: null,
	settings: {
		showConfidence: false,
		showTimestamps: true,
		maxEntries: 100,
		minConfidence: 0.3,
	},
};

function createVoiceStore() {
	const { subscribe, set, update } = writable<VoiceState>(initialVoiceState);

	return {
		subscribe,

		setConnecting: () => update(state => ({ ...state, connecting: true, error: null })),

		setConnected: () => update(state => ({
			...state,
			isConnected: true,
			connecting: false,
			error: null
		})),

		setDisconnected: () => update(state => ({
			...initialVoiceState
		})),

		setChannelInfo: (channelId: string, serverId: string) =>
			update(state => ({ ...state, channelId, serverId })),

		setMuted: (muted: boolean) => {
			update(state => ({ ...state, selfMuted: muted }));
			syncTrayMenuState('mute', muted);
		},

		setDeafened: (deafened: boolean) => {
			update(state => ({ ...state, selfDeafened: deafened }));
			syncTrayMenuState('deafen', deafened);
		},

		toggleMuted: () => {
			update(state => {
				const newMuted = !state.selfMuted;
				syncTrayMenuState('mute', newMuted);
				return { ...state, selfMuted: newMuted };
			});
		},

		toggleDeafened: () => {
			update(state => {
				const newDeafened = !state.selfDeafened;
				syncTrayMenuState('deafen', newDeafened);
				return { ...state, selfDeafened: newDeafened };
			});
		},

		setSpeaking: (userId: string, speaking: boolean) =>
			update(state => ({
				...state,
				speaking: { ...state.speaking, [userId]: speaking }
			})),

		removeSpeaker: (userId: string) =>
			update(state => {
				const { [userId]: _, ...speaking } = state.speaking;
				return { ...state, speaking };
			}),

		setError: (error: string) =>
			update(state => ({ ...state, error, connecting: false })),

		clearError: () =>
			update(state => ({ ...state, error: null })),
	};
}

function createTranscriptionStore() {
	const { subscribe, set, update } = writable<TranscriptionState>(initialTranscriptionState);

	return {
		subscribe,

		init: () => {
			if (!browser) return;

			// Load saved settings
			const saved = localStorage.getItem('hearth_transcription_settings');
			if (saved) {
				try {
					const settings = JSON.parse(saved);
					update(state => ({ ...state, settings: { ...state.settings, ...settings } }));
				} catch (e) {
					console.warn('[Transcription] Failed to load settings:', e);
				}
			}
		},

		setEnabled: (enabled: boolean) => {
			update(state => ({ ...state, isEnabled: enabled }));
			syncTrayMenuState('transcription', enabled);
		},

		toggleEnabled: () => {
			update(state => {
				const newEnabled = !state.isEnabled;
				syncTrayMenuState('transcription', newEnabled);
				return { ...state, isEnabled: newEnabled };
			});
		},

		setInitializing: (initializing: boolean) =>
			update(state => ({ ...state, isInitializing: initializing })),

		setReady: (ready: boolean) =>
			update(state => ({ ...state, isReady: ready, isInitializing: false })),

		setLanguage: (language: string) =>
			update(state => ({ ...state, language })),

		setAutoDetectLanguage: (autoDetect: boolean) =>
			update(state => ({ ...state, autoDetectLanguage: autoDetect })),

		addEntry: (entry: Omit<TranscriptionEntry, 'id' | 'timestamp'>) => {
			const newEntry: TranscriptionEntry = {
				...entry,
				id: crypto.randomUUID(),
				timestamp: Date.now(),
			};

			update(state => {
				const entries = [...state.entries, newEntry].slice(-state.settings.maxEntries);
				return { ...state, entries };
			});
		},

		updateEntry: (id: string, updates: Partial<TranscriptionEntry>) =>
			update(state => ({
				...state,
				entries: state.entries.map(entry =>
					entry.id === id ? { ...entry, ...updates } : entry
				),
			})),

		clearEntries: () =>
			update(state => ({ ...state, entries: [] })),

		updateSettings: (settings: Partial<TranscriptionState['settings']>) =>
			update(state => {
				const newSettings = { ...state.settings, ...settings };

				// Save to localStorage
				if (browser) {
					localStorage.setItem('hearth_transcription_settings', JSON.stringify(newSettings));
				}

				// Trim entries if maxEntries changed
				const entries = state.entries.slice(-newSettings.maxEntries);

				return { ...state, settings: newSettings, entries };
			}),

		setError: (error: string) =>
			update(state => ({ ...state, error, isInitializing: false })),

		clearError: () =>
			update(state => ({ ...state, error: null })),
	};
}

// Store instances
export const voiceState = createVoiceStore();
export const transcriptionState = createTranscriptionStore();

// Voice action helpers
export const voiceActions = {
	setConnecting: voiceState.setConnecting,
	setConnected: voiceState.setConnected,
	setDisconnected: voiceState.setDisconnected,
	setChannelInfo: voiceState.setChannelInfo,
	setMuted: voiceState.setMuted,
	setDeafened: voiceState.setDeafened,
	toggleMuted: voiceState.toggleMuted,
	toggleDeafened: voiceState.toggleDeafened,
	setSpeaking: voiceState.setSpeaking,
	removeSpeaker: voiceState.removeSpeaker,
	setError: voiceState.setError,
	clearError: voiceState.clearError,
};

// Transcription action helpers
export const transcriptionActions = {
	init: transcriptionState.init,
	setEnabled: transcriptionState.setEnabled,
	toggleEnabled: transcriptionState.toggleEnabled,
	setInitializing: transcriptionState.setInitializing,
	setReady: transcriptionState.setReady,
	setLanguage: transcriptionState.setLanguage,
	setAutoDetectLanguage: transcriptionState.setAutoDetectLanguage,
	addEntry: transcriptionState.addEntry,
	updateEntry: transcriptionState.updateEntry,
	clearEntries: transcriptionState.clearEntries,
	updateSettings: transcriptionState.updateSettings,
	setError: transcriptionState.setError,
	clearError: transcriptionState.clearError,
};

// Derived stores for convenience
export const isVoiceConnected = derived(voiceState, $state => $state.isConnected);
export const currentVoiceChannel = derived(voiceState, $state => $state.channelId);
export const isSelfMuted = derived(voiceState, $state => $state.selfMuted);
export const isSelfDeafened = derived(voiceState, $state => $state.selfDeafened);
export const voiceError = derived(voiceState, $state => $state.error);

export const isTranscriptionEnabled = derived(transcriptionState, $state => $state.isEnabled);
export const isTranscriptionReady = derived(transcriptionState, $state => $state.isReady);
export const transcriptionEntries = derived(transcriptionState, $state => $state.entries);
export const transcriptionLanguage = derived(transcriptionState, $state => $state.language);
export const transcriptionError = derived(transcriptionState, $state => $state.error);

// Filtered transcription entries (based on confidence threshold)
export const visibleTranscriptionEntries = derived(
	transcriptionState,
	$state => $state.entries.filter(entry => entry.confidence >= $state.settings.minConfidence)
);

// Tray synchronization functions
async function syncTrayMenuState(itemId: string, checked: boolean) {
	if (!browser) return;

	try {
		await invoke('update_tray_menu_item_checked', { itemId, checked });
	} catch (error) {
		console.warn(`[Tray] Failed to sync menu state for ${itemId}:`, error);
	}
}

async function updateTrayTooltip(status: string) {
	if (!browser) return;

	try {
		await invoke('update_tray_tooltip', { tooltip: `Hearth - ${status}` });
	} catch (error) {
		console.warn('[Tray] Failed to update tooltip:', error);
	}
}

async function updateStatusMenuItems(selectedStatus: UserStatus) {
	if (!browser) return;

	const statusItems = ['status_online', 'status_away', 'status_dnd', 'status_invisible'];
	const selectedItem = `status_${selectedStatus}`;

	for (const item of statusItems) {
		try {
			await invoke('update_tray_menu_item_checked', {
				itemId: item,
				checked: item === selectedItem
			});
		} catch (error) {
			console.warn(`[Tray] Failed to update status menu item ${item}:`, error);
		}
	}
}

// Initialize tray menu event listener
if (browser) {
	// Listen for tray menu actions
	listen<any>('tray_menu_action', (event) => {
		const { action } = event.payload;

		switch (action) {
			case 'toggle_mute':
				voiceState.toggleMuted();
				break;
			case 'toggle_deafen':
				voiceState.toggleDeafened();
				break;
			case 'toggle_transcription':
				transcriptionState.toggleEnabled();
				break;
			case 'clear_transcription':
				transcriptionState.clearEntries();
				break;
			case 'set_status':
				const newStatus = event.payload.status as UserStatus;
				userStatus.setStatus(newStatus);
				// Update status radio buttons in tray menu
				updateStatusMenuItems(newStatus);
				break;
			case 'open_settings':
				// Handle settings opening - could emit a custom event or use a settings store
				console.log('Settings requested from tray');
				break;
			case 'show_about':
				// Handle about dialog
				console.log('About dialog requested from tray');
				break;
		}
	}).catch(error => {
		console.warn('[Tray] Failed to set up event listener:', error);
	});
}

// Update tray tooltip based on voice connection state
if (browser) {
	isVoiceConnected.subscribe(connected => {
		if (connected) {
			updateTrayTooltip('Connected to voice');
		} else {
			updateTrayTooltip('Voice Chat');
		}
	});

	// Initialize status menu items on load
	userStatus.subscribe(status => {
		updateStatusMenuItems(status);
	});
}