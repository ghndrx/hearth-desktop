import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';

export interface GlobalShortcut {
	id: string;
	accelerator: string;
	description: string;
	enabled: boolean;
}

export interface GlobalShortcutSettings {
	enabled: boolean;
	shortcuts: GlobalShortcut[];
}

const defaultShortcuts: GlobalShortcut[] = [
	{
		id: 'toggle_window',
		accelerator: 'CmdOrCtrl+Shift+Space',
		description: 'Toggle Hearth window visibility',
		enabled: true
	},
	{
		id: 'quick_capture',
		accelerator: 'CmdOrCtrl+Shift+C',
		description: 'Quick capture/screenshot',
		enabled: false
	},
	{
		id: 'start_voice_chat',
		accelerator: 'CmdOrCtrl+Shift+V',
		description: 'Start/stop voice chat',
		enabled: false
	}
];

const defaultSettings: GlobalShortcutSettings = {
	enabled: true,
	shortcuts: defaultShortcuts
};

function createGlobalShortcutStore() {
	const { subscribe, set, update } = writable<GlobalShortcutSettings>(defaultSettings);

	return {
		subscribe,

		async init() {
			if (!browser) return;

			// Load saved settings
			const saved = localStorage.getItem('hearth_global_shortcuts');
			let settings = defaultSettings;

			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					// Merge with defaults to ensure new shortcuts are included
					settings = {
						...defaultSettings,
						...parsed,
						shortcuts: defaultShortcuts.map(defaultShortcut => {
							const savedShortcut = parsed.shortcuts?.find((s: GlobalShortcut) => s.id === defaultShortcut.id);
							return savedShortcut ? { ...defaultShortcut, ...savedShortcut } : defaultShortcut;
						})
					};
				} catch {
					// Invalid JSON, use defaults
				}
			}

			set(settings);

			// Register enabled shortcuts
			if (settings.enabled) {
				for (const shortcut of settings.shortcuts) {
					if (shortcut.enabled) {
						await this.registerShortcut(shortcut);
					}
				}
			}
		},

		async updateSettings(updates: Partial<GlobalShortcutSettings>) {
			const currentSettings = await new Promise<GlobalShortcutSettings>(resolve => {
				const unsubscribe = subscribe(value => {
					resolve(value);
					unsubscribe();
				});
			});

			const newSettings = { ...currentSettings, ...updates };

			// If global shortcuts were disabled, unregister all
			if (currentSettings.enabled && !newSettings.enabled) {
				await this.unregisterAllShortcuts();
			}
			// If global shortcuts were enabled, register enabled shortcuts
			else if (!currentSettings.enabled && newSettings.enabled) {
				for (const shortcut of newSettings.shortcuts) {
					if (shortcut.enabled) {
						await this.registerShortcut(shortcut);
					}
				}
			}

			if (browser) {
				localStorage.setItem('hearth_global_shortcuts', JSON.stringify(newSettings));
			}

			set(newSettings);
		},

		async updateShortcut(id: string, updates: Partial<GlobalShortcut>) {
			const currentSettings = await new Promise<GlobalShortcutSettings>(resolve => {
				const unsubscribe = subscribe(value => {
					resolve(value);
					unsubscribe();
				});
			});

			const shortcutIndex = currentSettings.shortcuts.findIndex(s => s.id === id);
			if (shortcutIndex === -1) return;

			const oldShortcut = currentSettings.shortcuts[shortcutIndex];
			const newShortcut = { ...oldShortcut, ...updates };

			// Handle shortcut changes
			if (currentSettings.enabled) {
				// If accelerator changed, unregister old and register new
				if (updates.accelerator && oldShortcut.accelerator !== updates.accelerator) {
					if (oldShortcut.enabled) {
						await this.unregisterShortcut(oldShortcut.accelerator);
					}
					if (newShortcut.enabled) {
						await this.registerShortcut(newShortcut);
					}
				}
				// If enabled status changed
				else if (typeof updates.enabled === 'boolean') {
					if (updates.enabled) {
						await this.registerShortcut(newShortcut);
					} else {
						await this.unregisterShortcut(newShortcut.accelerator);
					}
				}
			}

			const newSettings = {
				...currentSettings,
				shortcuts: currentSettings.shortcuts.map((s, i) =>
					i === shortcutIndex ? newShortcut : s
				)
			};

			if (browser) {
				localStorage.setItem('hearth_global_shortcuts', JSON.stringify(newSettings));
			}

			set(newSettings);
		},

		async registerShortcut(shortcut: GlobalShortcut) {
			try {
				await invoke('register_global_shortcut', {
					accelerator: shortcut.accelerator,
					id: shortcut.id
				});
				console.log(`Registered global shortcut: ${shortcut.accelerator} (${shortcut.id})`);
			} catch (error) {
				console.error(`Failed to register global shortcut ${shortcut.accelerator}:`, error);
				throw error;
			}
		},

		async unregisterShortcut(accelerator: string) {
			try {
				await invoke('unregister_global_shortcut', { accelerator });
				console.log(`Unregistered global shortcut: ${accelerator}`);
			} catch (error) {
				console.error(`Failed to unregister global shortcut ${accelerator}:`, error);
				throw error;
			}
		},

		async unregisterAllShortcuts() {
			try {
				await invoke('unregister_all_global_shortcuts');
				console.log('Unregistered all global shortcuts');
			} catch (error) {
				console.error('Failed to unregister all global shortcuts:', error);
				throw error;
			}
		},

		async isShortcutRegistered(accelerator: string): Promise<boolean> {
			try {
				return await invoke<boolean>('is_global_shortcut_registered', { accelerator });
			} catch (error) {
				console.error(`Failed to check if shortcut ${accelerator} is registered:`, error);
				return false;
			}
		},

		reset() {
			set(defaultSettings);
			if (browser) {
				localStorage.removeItem('hearth_global_shortcuts');
			}
		}
	};
}

export const globalShortcuts = createGlobalShortcutStore();

// Derived stores for convenience
export const globalShortcutsEnabled = derived(
	globalShortcuts,
	($shortcuts) => $shortcuts.enabled
);

export const enabledShortcuts = derived(
	globalShortcuts,
	($shortcuts) => $shortcuts.shortcuts.filter(s => s.enabled)
);