import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light' | 'midnight';
export type MessageDisplay = 'cozy' | 'compact';
export type NotificationLevel = 'all' | 'mentions' | 'none';

export type ThreadNotificationLevel = 'all' | 'mentions' | 'none';

export interface NotificationSettings {
	desktopEnabled: boolean;
	soundsEnabled: boolean;
	soundVolume: number;
	mentionSound: boolean;
	messageSound: boolean;
	flashTaskbar: boolean;
	showPreviews: boolean;
	muteDMs: boolean;
	muteGroupDMs: boolean;
	mentionEveryone: boolean;
	mentionRoles: boolean;
	mentionHighlight: boolean;
	suppressDND: boolean;
	// FEAT-001: Thread notification preferences
	threadNotifications: ThreadNotificationLevel;
	threadAutoFollow: boolean;
	threadFollowOnReply: boolean;
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
	notifications: NotificationSettings;
}

export interface SettingsState {
	isOpen: boolean;
	isServerSettingsOpen: boolean;
	activeSection: string;
	app: AppSettings;
}

const defaultNotificationSettings: NotificationSettings = {
	desktopEnabled: true,
	soundsEnabled: true,
	soundVolume: 80,
	mentionSound: true,
	messageSound: true,
	flashTaskbar: true,
	showPreviews: true,
	muteDMs: false,
	muteGroupDMs: false,
	mentionEveryone: true,
	mentionRoles: true,
	mentionHighlight: true,
	suppressDND: false,
	// FEAT-001: Thread notification defaults
	threadNotifications: 'all',
	threadAutoFollow: true,
	threadFollowOnReply: true
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
	notifications: defaultNotificationSettings
};

function isValidTheme(value: unknown): value is Theme {
	return typeof value === 'string' && ['dark', 'light', 'midnight'].includes(value);
}

function isValidMessageDisplay(value: unknown): value is MessageDisplay {
	return typeof value === 'string' && ['cozy', 'compact'].includes(value);
}

function isValidFontSize(value: unknown): value is number {
	return typeof value === 'number' && value >= 12 && value <= 24;
}

function isValidVolume(value: unknown): value is number {
	return typeof value === 'number' && value >= 0 && value <= 100;
}

function isValidThreadNotificationLevel(value: unknown): value is ThreadNotificationLevel {
	return typeof value === 'string' && ['all', 'mentions', 'none'].includes(value);
}

function loadNotificationSettings(parsed: Record<string, unknown>): NotificationSettings {
	const n = typeof parsed.notifications === 'object' && parsed.notifications !== null 
		? parsed.notifications as Record<string, unknown>
		: {};
	
	return {
		desktopEnabled: typeof n.desktopEnabled === 'boolean' ? n.desktopEnabled : defaultNotificationSettings.desktopEnabled,
		soundsEnabled: typeof n.soundsEnabled === 'boolean' ? n.soundsEnabled : defaultNotificationSettings.soundsEnabled,
		soundVolume: isValidVolume(n.soundVolume) ? n.soundVolume : defaultNotificationSettings.soundVolume,
		mentionSound: typeof n.mentionSound === 'boolean' ? n.mentionSound : defaultNotificationSettings.mentionSound,
		messageSound: typeof n.messageSound === 'boolean' ? n.messageSound : defaultNotificationSettings.messageSound,
		flashTaskbar: typeof n.flashTaskbar === 'boolean' ? n.flashTaskbar : defaultNotificationSettings.flashTaskbar,
		showPreviews: typeof n.showPreviews === 'boolean' ? n.showPreviews : defaultNotificationSettings.showPreviews,
		muteDMs: typeof n.muteDMs === 'boolean' ? n.muteDMs : defaultNotificationSettings.muteDMs,
		muteGroupDMs: typeof n.muteGroupDMs === 'boolean' ? n.muteGroupDMs : defaultNotificationSettings.muteGroupDMs,
		mentionEveryone: typeof n.mentionEveryone === 'boolean' ? n.mentionEveryone : defaultNotificationSettings.mentionEveryone,
		mentionRoles: typeof n.mentionRoles === 'boolean' ? n.mentionRoles : defaultNotificationSettings.mentionRoles,
		mentionHighlight: typeof n.mentionHighlight === 'boolean' ? n.mentionHighlight : defaultNotificationSettings.mentionHighlight,
		suppressDND: typeof n.suppressDND === 'boolean' ? n.suppressDND : defaultNotificationSettings.suppressDND,
		// FEAT-001: Thread notification settings
		threadNotifications: isValidThreadNotificationLevel(n.threadNotifications) ? n.threadNotifications : defaultNotificationSettings.threadNotifications,
		threadAutoFollow: typeof n.threadAutoFollow === 'boolean' ? n.threadAutoFollow : defaultNotificationSettings.threadAutoFollow,
		threadFollowOnReply: typeof n.threadFollowOnReply === 'boolean' ? n.threadFollowOnReply : defaultNotificationSettings.threadFollowOnReply
	};
}

function loadSettings(): AppSettings {
	if (!browser) return defaultSettings;
	
	try {
		const stored = localStorage.getItem('hearth_settings');
		if (stored) {
			const parsed = JSON.parse(stored);
			
			// Validate parsed data is an object
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				console.warn('Invalid settings format, using defaults');
				return defaultSettings;
			}
			
			// Merge with defaults, validating each property
			return {
				theme: isValidTheme(parsed.theme) ? parsed.theme : defaultSettings.theme,
				messageDisplay: isValidMessageDisplay(parsed.messageDisplay) ? parsed.messageDisplay : defaultSettings.messageDisplay,
				compactMode: typeof parsed.compactMode === 'boolean' ? parsed.compactMode : defaultSettings.compactMode,
				showSendButton: typeof parsed.showSendButton === 'boolean' ? parsed.showSendButton : defaultSettings.showSendButton,
				enableAnimations: typeof parsed.enableAnimations === 'boolean' ? parsed.enableAnimations : defaultSettings.enableAnimations,
				enableSounds: typeof parsed.enableSounds === 'boolean' ? parsed.enableSounds : defaultSettings.enableSounds,
				notificationsEnabled: typeof parsed.notificationsEnabled === 'boolean' ? parsed.notificationsEnabled : defaultSettings.notificationsEnabled,
				fontSize: isValidFontSize(parsed.fontSize) ? parsed.fontSize : defaultSettings.fontSize,
				developerMode: typeof parsed.developerMode === 'boolean' ? parsed.developerMode : defaultSettings.developerMode,
				notifications: loadNotificationSettings(parsed)
			};
		}
	} catch (error) {
		console.error('Failed to load settings:', error);
	}
	return defaultSettings;
}

function saveSettings(settings: AppSettings) {
	if (!browser) return;
	
	try {
		localStorage.setItem('hearth_settings', JSON.stringify(settings));
	} catch (error) {
		if (error instanceof Error && error.name === 'QuotaExceededError') {
			console.error('Failed to save settings: localStorage quota exceeded');
		} else {
			console.error('Failed to save settings:', error);
		}
	}
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
		
		updateNotifications(updates: Partial<NotificationSettings>) {
			update(s => {
				const newNotifications = { ...s.app.notifications, ...updates };
				const newApp = { ...s.app, notifications: newNotifications };
				saveSettings(newApp);
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
export const notificationSettings = derived(settings, $s => $s.app.notifications);
