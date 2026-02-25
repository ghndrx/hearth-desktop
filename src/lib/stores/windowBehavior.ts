import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface WindowBehaviorSettings {
	/** Minimize to system tray instead of taskbar */
	minimizeToTray: boolean;
	/** Hide to tray on close instead of quitting */
	closeToTray: boolean;
	/** Start application minimized to tray */
	startMinimized: boolean;
	/** Keep window always on top of other windows */
	alwaysOnTop: boolean;
	/** Remember window position and size */
	rememberWindowState: boolean;
	/** Show in taskbar when minimized to tray */
	showInTaskbar: boolean;
	/** Single click on tray icon to show/hide */
	singleClickTrayToggle: boolean;
}

const defaultSettings: WindowBehaviorSettings = {
	minimizeToTray: false,
	closeToTray: true,
	startMinimized: false,
	alwaysOnTop: false,
	rememberWindowState: true,
	showInTaskbar: true,
	singleClickTrayToggle: true
};

const STORAGE_KEY = 'hearth_window_behavior';

function loadSettings(): WindowBehaviorSettings {
	if (!browser) return defaultSettings;
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				console.warn('Invalid window behavior settings format, using defaults');
				return defaultSettings;
			}
			
			return {
				minimizeToTray: typeof parsed.minimizeToTray === 'boolean' 
					? parsed.minimizeToTray 
					: defaultSettings.minimizeToTray,
				closeToTray: typeof parsed.closeToTray === 'boolean' 
					? parsed.closeToTray 
					: defaultSettings.closeToTray,
				startMinimized: typeof parsed.startMinimized === 'boolean' 
					? parsed.startMinimized 
					: defaultSettings.startMinimized,
				alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' 
					? parsed.alwaysOnTop 
					: defaultSettings.alwaysOnTop,
				rememberWindowState: typeof parsed.rememberWindowState === 'boolean' 
					? parsed.rememberWindowState 
					: defaultSettings.rememberWindowState,
				showInTaskbar: typeof parsed.showInTaskbar === 'boolean' 
					? parsed.showInTaskbar 
					: defaultSettings.showInTaskbar,
				singleClickTrayToggle: typeof parsed.singleClickTrayToggle === 'boolean' 
					? parsed.singleClickTrayToggle 
					: defaultSettings.singleClickTrayToggle
			};
		}
	} catch (error) {
		console.error('Failed to load window behavior settings:', error);
	}
	return defaultSettings;
}

function saveSettings(settings: WindowBehaviorSettings) {
	if (!browser) return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (error) {
		if (error instanceof Error && error.name === 'QuotaExceededError') {
			console.error('Failed to save window behavior settings: localStorage quota exceeded');
		} else {
			console.error('Failed to save window behavior settings:', error);
		}
	}
}

function createWindowBehaviorStore() {
	const { subscribe, update, set } = writable<WindowBehaviorSettings>(loadSettings());
	
	return {
		subscribe,
		
		/** Update one or more settings */
		update(updates: Partial<WindowBehaviorSettings>) {
			update(state => {
				const newState = { ...state, ...updates };
				saveSettings(newState);
				return newState;
			});
		},
		
		/** Set a specific setting */
		setSetting<K extends keyof WindowBehaviorSettings>(
			key: K, 
			value: WindowBehaviorSettings[K]
		) {
			update(state => {
				const newState = { ...state, [key]: value };
				saveSettings(newState);
				return newState;
			});
		},
		
		/** Reset all settings to defaults */
		reset() {
			set(defaultSettings);
			saveSettings(defaultSettings);
		},
		
		/** Get current settings synchronously */
		getSettings(): WindowBehaviorSettings {
			let current = defaultSettings;
			const unsubscribe = subscribe(value => {
				current = value;
			});
			unsubscribe();
			return current;
		}
	};
}

export const windowBehavior = createWindowBehaviorStore();

// Derived stores for individual settings
export const minimizeToTray = derived(windowBehavior, $wb => $wb.minimizeToTray);
export const closeToTray = derived(windowBehavior, $wb => $wb.closeToTray);
export const startMinimized = derived(windowBehavior, $wb => $wb.startMinimized);
export const alwaysOnTop = derived(windowBehavior, $wb => $wb.alwaysOnTop);
export const rememberWindowState = derived(windowBehavior, $wb => $wb.rememberWindowState);
export const showInTaskbar = derived(windowBehavior, $wb => $wb.showInTaskbar);
export const singleClickTrayToggle = derived(windowBehavior, $wb => $wb.singleClickTrayToggle);
