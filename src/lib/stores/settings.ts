import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light' | 'midnight';
export type MessageDisplay = 'cozy' | 'compact';
export type VoiceInputMode = 'voice_activity' | 'push_to_talk';

export interface VoiceSettings {
	inputMode: VoiceInputMode;
	pushToTalkKey: string;
	pushToTalkKeyDisplay: string;
	voiceActivitySensitivity: number; // 0-100
	automaticallyDetermineInputSensitivity: boolean;
	inputDevice: string;
	outputDevice: string;
	inputVolume: number; // 0-200
	outputVolume: number; // 0-200
	echoCancellation: boolean;
	noiseSuppression: boolean;
	automaticGainControl: boolean;
}

export interface AppSettings {
	theme: Theme;
	messageDisplay: MessageDisplay;
	compactMode: boolean;
	showSendButton: boolean;
	enableAnimations: boolean;
	enableSounds: boolean;
	notificationsEnabled: boolean;
	fontSize: number;
	developerMode: boolean;
	voice: VoiceSettings;
}

export interface SettingsState {
	isOpen: boolean;
	isServerSettingsOpen: boolean;
	activeSection: string;
	app: AppSettings;
}

const defaultVoiceSettings: VoiceSettings = {
	inputMode: 'voice_activity',
	pushToTalkKey: 'KeyV',
	pushToTalkKeyDisplay: 'V',
	voiceActivitySensitivity: 50,
	automaticallyDetermineInputSensitivity: true,
	inputDevice: 'default',
	outputDevice: 'default',
	inputVolume: 100,
	outputVolume: 100,
	echoCancellation: true,
	noiseSuppression: true,
	automaticGainControl: true
};

const defaultSettings: AppSettings = {
	theme: 'dark',
	messageDisplay: 'cozy',
	compactMode: false,
	showSendButton: false,
	enableAnimations: true,
	enableSounds: true,
	notificationsEnabled: true,
	fontSize: 16,
	developerMode: false,
	voice: defaultVoiceSettings
};

function loadSettings(): AppSettings {
	if (!browser) return defaultSettings;
	
	try {
		const stored = localStorage.getItem('hearth_settings');
		if (stored) {
			return { ...defaultSettings, ...JSON.parse(stored) };
		}
	} catch {
		// Ignore parse errors
	}
	return defaultSettings;
}

function saveSettings(settings: AppSettings) {
	if (!browser) return;
	localStorage.setItem('hearth_settings', JSON.stringify(settings));
}

function applyTheme(theme: Theme) {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', theme === 'dark' ? '' : theme);
}

const initialState: SettingsState = {
	isOpen: false,
	isServerSettingsOpen: false,
	activeSection: 'account',
	app: loadSettings()
};

function createSettingsStore() {
	const { subscribe, update } = writable<SettingsState>(initialState);
	
	// Apply theme on init
	if (browser) {
		applyTheme(initialState.app.theme);
	}
	
	return {
		subscribe,
		
		open(section = 'account') {
			update(s => ({ ...s, isOpen: true, activeSection: section }));
		},
		
		close() {
			update(s => ({ ...s, isOpen: false }));
		},
		
		openServerSettings() {
			update(s => ({ ...s, isServerSettingsOpen: true }));
		},
		
		closeServerSettings() {
			update(s => ({ ...s, isServerSettingsOpen: false }));
		},
		
		setSection(section: string) {
			update(s => ({ ...s, activeSection: section }));
		},
		
		updateApp(updates: Partial<AppSettings>) {
			update(s => {
				const newApp = { ...s.app, ...updates };
				saveSettings(newApp);
				
				// Apply theme change immediately
				if (updates.theme !== undefined) {
					applyTheme(updates.theme);
				}
				
				// Apply font size
				if (updates.fontSize !== undefined && browser) {
					document.documentElement.style.setProperty('--message-font-size', `${updates.fontSize}px`);
				}
				
				return { ...s, app: newApp };
			});
		},
		
		reset() {
			update(s => {
				saveSettings(defaultSettings);
				applyTheme(defaultSettings.theme);
				return { ...s, app: defaultSettings };
			});
		},
		
		updateVoice(updates: Partial<VoiceSettings>) {
			update(s => {
				const newVoice = { ...s.app.voice, ...updates };
				const newApp = { ...s.app, voice: newVoice };
				saveSettings(newApp);
				return { ...s, app: newApp };
			});
		},
		
		resetVoice() {
			update(s => {
				const newApp = { ...s.app, voice: defaultVoiceSettings };
				saveSettings(newApp);
				return { ...s, app: newApp };
			});
		}
	};
}

export const settings = createSettingsStore();

// Convenience derived stores
export const isSettingsOpen = derived(settings, $s => $s.isOpen);
export const isServerSettingsOpen = derived(settings, $s => $s.isServerSettingsOpen);
export const activeSection = derived(settings, $s => $s.activeSection);
export const appSettings = derived(settings, $s => $s.app);
export const currentTheme = derived(settings, $s => $s.app.theme);
export const voiceSettings = derived(settings, $s => $s.app.voice);
