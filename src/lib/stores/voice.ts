import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface VoiceState {
	isConnected: boolean;
	channelId: string | null;
	serverId: string | null;
	selfMuted: boolean;
	selfDeafened: boolean;
	connecting: boolean;
	error: string | null;
	speaking: { [userId: string]: boolean };
	ptt: {
		enabled: boolean;
		isPressed: boolean;
		hotkey: string;
		mutedBeforePtt: boolean;
	};
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
	ptt: {
		enabled: false,
		isPressed: false,
		hotkey: 'F4', // Default PTT hotkey
		mutedBeforePtt: false,
	},
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

		setMuted: (muted: boolean) =>
			update(state => ({ ...state, selfMuted: muted })),

		setDeafened: (deafened: boolean) =>
			update(state => ({ ...state, selfDeafened: deafened })),

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

		// PTT (Push-to-Talk) methods
		setPttEnabled: (enabled: boolean) =>
			update(state => ({ ...state, ptt: { ...state.ptt, enabled } })),

		setPttHotkey: (hotkey: string) =>
			update(state => ({ ...state, ptt: { ...state.ptt, hotkey } })),

		setPttPressed: (pressed: boolean) =>
			update(state => {
				if (!state.ptt.enabled) return state;

				// When PTT is pressed and we're connected
				if (pressed && state.isConnected) {
					// Store current muted state if we're pressing PTT for first time
					const mutedBeforePtt = state.ptt.isPressed ? state.ptt.mutedBeforePtt : state.selfMuted;
					// Unmute when PTT is pressed
					return {
						...state,
						selfMuted: false,
						ptt: {
							...state.ptt,
							isPressed: true,
							mutedBeforePtt,
						},
					};
				}
				// When PTT is released
				else if (!pressed && state.ptt.isPressed) {
					// Restore muted state from before PTT was used
					return {
						...state,
						selfMuted: state.ptt.mutedBeforePtt,
						ptt: {
							...state.ptt,
							isPressed: false,
							mutedBeforePtt: false,
						},
					};
				}

				return state;
			}),

		// Load PTT settings from localStorage
		loadPttSettings: () => {
			if (!browser) return;

			const saved = localStorage.getItem('hearth_ptt_settings');
			if (saved) {
				try {
					const settings = JSON.parse(saved);
					update(state => ({
						...state,
						ptt: { ...state.ptt, ...settings }
					}));
				} catch (e) {
					console.warn('[PTT] Failed to load settings:', e);
				}
			}
		},

		// Save PTT settings to localStorage
		savePttSettings: () => {
			if (!browser) return;

			update(state => {
				const pttSettings = {
					enabled: state.ptt.enabled,
					hotkey: state.ptt.hotkey,
				};
				localStorage.setItem('hearth_ptt_settings', JSON.stringify(pttSettings));
				return state;
			});
		},
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

		setEnabled: (enabled: boolean) =>
			update(state => ({ ...state, isEnabled: enabled })),

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
	setSpeaking: voiceState.setSpeaking,
	removeSpeaker: voiceState.removeSpeaker,
	setError: voiceState.setError,
	clearError: voiceState.clearError,
	setPttEnabled: voiceState.setPttEnabled,
	setPttHotkey: voiceState.setPttHotkey,
	setPttPressed: voiceState.setPttPressed,
	loadPttSettings: voiceState.loadPttSettings,
	savePttSettings: voiceState.savePttSettings,
};

// Transcription action helpers
export const transcriptionActions = {
	init: transcriptionState.init,
	setEnabled: transcriptionState.setEnabled,
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

// PTT derived stores
export const isPttEnabled = derived(voiceState, $state => $state.ptt.enabled);
export const isPttPressed = derived(voiceState, $state => $state.ptt.isPressed);
export const pttHotkey = derived(voiceState, $state => $state.ptt.hotkey);
export const isPttActive = derived(voiceState, $state => $state.ptt.enabled && $state.ptt.isPressed);

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