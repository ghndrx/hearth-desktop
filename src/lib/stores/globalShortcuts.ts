import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ShortcutBinding {
	id: string;
	keys: string[];
	label: string;
	action: string;
}

export interface RegisteredShortcut {
	id: string;
	accelerator: string;
	label: string;
	active: boolean;
}

export interface GlobalShortcutsState {
	registered: RegisteredShortcut[];
	bindings: ShortcutBinding[];
	loading: boolean;
	error: string | null;
}

export const DEFAULT_GLOBAL_BINDINGS: ShortcutBinding[] = [
	{
		id: 'global-toggle-mute',
		keys: ['Ctrl', 'Shift', 'M'],
		label: 'Toggle Mute',
		action: 'toggleMute',
	},
	{
		id: 'global-toggle-deafen',
		keys: ['Ctrl', 'Shift', 'D'],
		label: 'Toggle Deafen',
		action: 'toggleDeafen',
	},
	{
		id: 'global-push-to-talk',
		keys: ['Ctrl', '`'],
		label: 'Push to Talk',
		action: 'pushToTalk',
	},
];

const STORAGE_KEY = 'hearth_global_shortcuts';

function loadSavedBindings(): ShortcutBinding[] {
	if (!browser) return DEFAULT_GLOBAL_BINDINGS;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved) as ShortcutBinding[];
			// Merge with defaults to pick up any new shortcuts
			return DEFAULT_GLOBAL_BINDINGS.map(
				(def) => parsed.find((s) => s.id === def.id) ?? def
			);
		}
	} catch {
		// ignore
	}
	return DEFAULT_GLOBAL_BINDINGS;
}

function createGlobalShortcutsStore() {
	const { subscribe, set, update } = writable<GlobalShortcutsState>({
		registered: [],
		bindings: loadSavedBindings(),
		loading: false,
		error: null,
	});

	return {
		subscribe,

		setLoading: (loading: boolean) => update((s) => ({ ...s, loading })),
		setError: (error: string | null) => update((s) => ({ ...s, error })),

		registerShortcut: async (binding: ShortcutBinding): Promise<RegisteredShortcut | null> => {
			try {
				const result = await invoke<RegisteredShortcut>('register_global_shortcut', {
					id: binding.id,
					keys: binding.keys,
					label: binding.label,
				});
				update((s) => ({
					...s,
					registered: [...s.registered.filter((r) => r.id !== binding.id), result],
				}));
				return result;
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				console.error(`[GlobalShortcuts] Failed to register ${binding.id}:`, msg);
				update((s) => ({ ...s, error: msg }));
				return null;
			}
		},

		unregisterShortcut: async (id: string): Promise<void> => {
			try {
				await invoke('unregister_global_shortcut', { id });
				update((s) => ({
					...s,
					registered: s.registered.filter((r) => r.id !== id),
				}));
			} catch (e) {
				console.error(`[GlobalShortcuts] Failed to unregister ${id}:`, e);
			}
		},

		unregisterAll: async (): Promise<void> => {
			const state = get(globalShortcuts);
			for (const shortcut of state.registered) {
				try {
					await invoke('unregister_global_shortcut', { id: shortcut.id });
				} catch {
					// best effort
				}
			}
			update((s) => ({ ...s, registered: [] }));
		},

		isRegistered: async (keys: string[]): Promise<boolean> => {
			try {
				return await invoke<boolean>('is_shortcut_registered', { keys });
			} catch {
				return false;
			}
		},

		updateBinding: (id: string, keys: string[]) => {
			update((s) => {
				const bindings = s.bindings.map((b) => (b.id === id ? { ...b, keys } : b));
				if (browser) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
				}
				return { ...s, bindings };
			});
		},

		resetToDefaults: () => {
			update((s) => ({ ...s, bindings: DEFAULT_GLOBAL_BINDINGS }));
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		},
	};
}

export const globalShortcuts = createGlobalShortcutsStore();

// Derived convenience stores
export const registeredShortcuts = derived(globalShortcuts, ($s) => $s.registered);
export const shortcutBindings = derived(globalShortcuts, ($s) => $s.bindings);
export const shortcutsLoading = derived(globalShortcuts, ($s) => $s.loading);
export const shortcutsError = derived(globalShortcuts, ($s) => $s.error);

// Event listener management
let shortcutUnlisten: UnlistenFn | null = null;
let pttStartUnlisten: UnlistenFn | null = null;
let pttStopUnlisten: UnlistenFn | null = null;

export type ShortcutHandler = (id: string) => void;
export type PTTHandler = () => void;

export async function setupShortcutListeners(
	onTriggered: ShortcutHandler,
	onPTTStart: PTTHandler,
	onPTTStop: PTTHandler
): Promise<void> {
	await cleanupShortcutListeners();

	shortcutUnlisten = await listen<string>('global-shortcut:triggered', (event) => {
		onTriggered(event.payload);
	});

	pttStartUnlisten = await listen<string>('ptt:start', () => {
		onPTTStart();
	});

	pttStopUnlisten = await listen<string>('ptt:stop', () => {
		onPTTStop();
	});
}

export async function cleanupShortcutListeners(): Promise<void> {
	shortcutUnlisten?.();
	pttStartUnlisten?.();
	pttStopUnlisten?.();
	shortcutUnlisten = null;
	pttStartUnlisten = null;
	pttStopUnlisten = null;
}
