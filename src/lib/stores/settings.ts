import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light' | 'midnight';
export type MessageDisplay = 'cozy' | 'compact';

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
}

export interface SettingsState {
	isOpen: boolean;
	isServerSettingsOpen: boolean;
	activeSection: string;
	app: AppSettings;
}

const defaultSettings: AppSettings = {
	theme: 'dark',
	messageDisplay: 'cozy',
	compactMode: false,
	showSendButton: false,
	enableAnimations: true,
	enableSounds: true,
	notificationsEnabled: true,
	fontSize: 16,
	developerMode: false
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
