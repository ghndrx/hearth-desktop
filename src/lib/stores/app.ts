import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
	id: string;
	username: string;
	display_name: string | null;
	email: string;
	avatar: string | null;
	banner: string | null;
	bio: string | null;
	pronouns: string | null;
	bot: boolean;
	created_at: string;
}

export interface Server {
	id: string;
	name: string;
	icon: string | null;
	owner_id: string;
	created_at: string;
}

export interface Channel {
	id: string;
	server_id: string;
	name: string;
	topic: string | null;
	type: 'text' | 'voice';
	position: number;
	created_at: string;
}

export interface AppState {
	user: User | null;
	token: string | null;
	loading: boolean;
	initialized: boolean;
	theme: 'dark' | 'light' | 'midnight';
}

const initialState: AppState = {
	user: null,
	token: null,
	loading: true,
	initialized: false,
	theme: 'dark'
};

function createAppStore() {
	const { subscribe, set, update } = writable<AppState>(initialState);

	return {
		subscribe,

		async init() {
			if (!browser) return;

			// Load theme preference
			const savedTheme = localStorage.getItem('hearth_theme') as AppState['theme'] | null;
			if (savedTheme) {
				document.documentElement.setAttribute('data-theme', savedTheme);
			}

			// Initialize settings
			settings.init();

			// Load auth token
			const token = localStorage.getItem('hearth_token');
			if (!token) {
				update((s) => ({ ...s, loading: false, initialized: true, theme: savedTheme || 'dark' }));
				return;
			}

			// TODO: Validate token and fetch user
			update((s) => ({
				...s,
				token,
				loading: false,
				initialized: true,
				theme: savedTheme || 'dark'
			}));
		},

		setTheme(theme: AppState['theme']) {
			if (browser) {
				localStorage.setItem('hearth_theme', theme);
				document.documentElement.setAttribute('data-theme', theme);
			}
			update((s) => ({ ...s, theme }));
		},

		setUser(user: User | null) {
			update((s) => ({ ...s, user }));
		},

		setToken(token: string | null) {
			if (browser) {
				if (token) {
					localStorage.setItem('hearth_token', token);
				} else {
					localStorage.removeItem('hearth_token');
				}
			}
			update((s) => ({ ...s, token }));
		},

		logout() {
			if (browser) {
				localStorage.removeItem('hearth_token');
				localStorage.removeItem('hearth_refresh_token');
			}
			set({ ...initialState, loading: false, initialized: true });
		}
	};
}

export const app = createAppStore();

// Derived stores for convenience
export const user = derived(app, ($app) => $app.user);
export const isAuthenticated = derived(app, ($app) => !!$app.user);
export const isLoading = derived(app, ($app) => $app.loading);
export const currentTheme = derived(app, ($app) => $app.theme);

// Server store
function createServerStore() {
	const { subscribe, set, update } = writable<Server[]>([]);

	return {
		subscribe,
		set,
		add(server: Server) {
			update((servers) => [...servers, server]);
		},
		remove(serverId: string) {
			update((servers) => servers.filter((s) => s.id !== serverId));
		},
		updateServer(serverId: string, updates: Partial<Server>) {
			update((servers) => servers.map((s) => (s.id === serverId ? { ...s, ...updates } : s)));
		}
	};
}

export const servers = createServerStore();
export const currentServer = writable<Server | null>(null);

// Channel store
function createChannelStore() {
	const { subscribe, set, update } = writable<Channel[]>([]);

	return {
		subscribe,
		set,
		add(channel: Channel) {
			update((channels) => [...channels, channel]);
		},
		remove(channelId: string) {
			update((channels) => channels.filter((c) => c.id !== channelId));
		},
		updateChannel(channelId: string, updates: Partial<Channel>) {
			update((channels) => channels.map((c) => (c.id === channelId ? { ...c, ...updates } : c)));
		}
	};
}

export const channels = createChannelStore();
export const currentChannel = writable<Channel | null>(null);

// Hotkey configuration interface
export interface HotkeyConfig {
	id: string;
	description: string;
	modifiers: string[];
	key: string;
	action: string;
	enabled: boolean;
}

// Settings store
export interface Settings {
	notifications: boolean;
	sounds: boolean;
	compactMode: boolean;
	fontSize: 'small' | 'medium' | 'large';
	hotkeys: HotkeyConfig[];
}

const defaultSettings: Settings = {
	notifications: true,
	sounds: true,
	compactMode: false,
	fontSize: 'medium',
	hotkeys: [
		{
			id: 'toggle_main_window',
			description: 'Toggle main window visibility',
			modifiers: ['ctrl', 'shift'],
			key: 'h',
			action: 'toggle_main_window',
			enabled: true
		},
		{
			id: 'show_main_window',
			description: 'Show main window',
			modifiers: ['ctrl', 'shift'],
			key: 's',
			action: 'show_main_window',
			enabled: false
		},
		{
			id: 'hide_main_window',
			description: 'Hide main window',
			modifiers: ['ctrl', 'shift'],
			key: 'd',
			action: 'hide_main_window',
			enabled: false
		}
	]
};

function createSettingsStore() {
	const { subscribe, set, update } = writable<Settings>(defaultSettings);

	return {
		subscribe,
		init() {
			if (!browser) return;
			const saved = localStorage.getItem('hearth_settings');
			if (saved) {
				try {
					set(JSON.parse(saved));
				} catch {
					// Invalid JSON, use defaults
				}
			}
		},
		update(updates: Partial<Settings>) {
			update((s) => {
				const newSettings = { ...s, ...updates };
				if (browser) {
					localStorage.setItem('hearth_settings', JSON.stringify(newSettings));
				}
				return newSettings;
			});
		},
		reset() {
			set(defaultSettings);
			if (browser) {
				localStorage.removeItem('hearth_settings');
			}
		},

		updateHotkey(hotkeyId: string, updates: Partial<HotkeyConfig>) {
			update((s) => {
				const newSettings = {
					...s,
					hotkeys: s.hotkeys.map((hotkey) =>
						hotkey.id === hotkeyId ? { ...hotkey, ...updates } : hotkey
					)
				};
				if (browser) {
					localStorage.setItem('hearth_settings', JSON.stringify(newSettings));
				}
				return newSettings;
			});
		},

		addHotkey(hotkey: HotkeyConfig) {
			update((s) => {
				const newSettings = {
					...s,
					hotkeys: [...s.hotkeys, hotkey]
				};
				if (browser) {
					localStorage.setItem('hearth_settings', JSON.stringify(newSettings));
				}
				return newSettings;
			});
		},

		removeHotkey(hotkeyId: string) {
			update((s) => {
				const newSettings = {
					...s,
					hotkeys: s.hotkeys.filter((hotkey) => hotkey.id !== hotkeyId)
				};
				if (browser) {
					localStorage.setItem('hearth_settings', JSON.stringify(newSettings));
				}
				return newSettings;
			});
		}
	};
}

export const settings = createSettingsStore();
export const isSettingsOpen = writable(false);
