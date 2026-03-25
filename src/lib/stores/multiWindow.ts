import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// -- Types --

export type WindowKind = 'main' | 'settings' | 'floating-panel' | 'popout' | 'custom';

export interface WindowConfig {
	label: string;
	title: string;
	url: string;
	width: number;
	height: number;
	minWidth?: number;
	minHeight?: number;
	x?: number;
	y?: number;
	resizable: boolean;
	decorations: boolean;
	transparent: boolean;
	alwaysOnTop: boolean;
	skipTaskbar: boolean;
	center: boolean;
	kind: WindowKind;
}

export interface WindowState {
	label: string;
	title: string;
	kind: WindowKind;
	visible: boolean;
	focused: boolean;
	width: number;
	height: number;
	x: number;
	y: number;
}

export interface WindowMessage {
	from: string;
	to: string;
	channel: string;
	payload: unknown;
}

export interface WindowEvent {
	label: string;
	eventType: string;
	data?: unknown;
}

// -- Default configs for common window types --

const SETTINGS_DEFAULTS: Partial<WindowConfig> = {
	title: 'Hearth Settings',
	url: '/settings',
	width: 900,
	height: 700,
	minWidth: 600,
	minHeight: 500,
	resizable: true,
	decorations: true,
	transparent: false,
	alwaysOnTop: false,
	skipTaskbar: false,
	center: true,
	kind: 'settings'
};

const POPOUT_DEFAULTS: Partial<WindowConfig> = {
	width: 480,
	height: 640,
	minWidth: 320,
	minHeight: 400,
	resizable: true,
	decorations: true,
	transparent: false,
	alwaysOnTop: false,
	skipTaskbar: false,
	center: true,
	kind: 'popout'
};

// -- Store --

export const windows = writable<Map<string, WindowState>>(new Map());

export const windowList = derived(windows, ($windows) => Array.from($windows.values()));

export const focusedWindow = derived(windows, ($windows) => {
	for (const state of $windows.values()) {
		if (state.focused) return state;
	}
	return null;
});

// -- Core API functions --

export async function createWindow(config: Partial<WindowConfig> & { label: string }): Promise<WindowState> {
	const fullConfig: WindowConfig = {
		title: 'Hearth',
		url: '/',
		width: 800,
		height: 600,
		resizable: true,
		decorations: true,
		transparent: false,
		alwaysOnTop: false,
		skipTaskbar: false,
		center: true,
		kind: 'custom',
		...config
	};

	const state = await invoke<WindowState>('mw_create_window', { config: fullConfig });
	windows.update((map) => {
		map.set(state.label, state);
		return new Map(map);
	});
	return state;
}

export async function closeWindow(label: string): Promise<void> {
	await invoke('mw_close_window', { label });
	windows.update((map) => {
		map.delete(label);
		return new Map(map);
	});
}

export async function focusWindow(label: string): Promise<void> {
	await invoke('mw_focus_window', { label });
	windows.update((map) => {
		for (const [key, state] of map) {
			map.set(key, { ...state, focused: key === label, visible: key === label ? true : state.visible });
		}
		return new Map(map);
	});
}

export async function showWindow(label: string): Promise<void> {
	await invoke('mw_show_window', { label });
	windows.update((map) => {
		const state = map.get(label);
		if (state) map.set(label, { ...state, visible: true });
		return new Map(map);
	});
}

export async function hideWindow(label: string): Promise<void> {
	await invoke('mw_hide_window', { label });
	windows.update((map) => {
		const state = map.get(label);
		if (state) map.set(label, { ...state, visible: false, focused: false });
		return new Map(map);
	});
}

export async function resizeWindow(label: string, width: number, height: number): Promise<void> {
	await invoke('mw_resize_window', { label, width, height });
	windows.update((map) => {
		const state = map.get(label);
		if (state) map.set(label, { ...state, width, height });
		return new Map(map);
	});
}

export async function moveWindow(label: string, x: number, y: number): Promise<void> {
	await invoke('mw_move_window', { label, x, y });
	windows.update((map) => {
		const state = map.get(label);
		if (state) map.set(label, { ...state, x, y });
		return new Map(map);
	});
}

export async function setWindowAlwaysOnTop(label: string, alwaysOnTop: boolean): Promise<void> {
	await invoke('mw_set_always_on_top', { label, alwaysOnTop });
}

export async function setWindowTitle(label: string, title: string): Promise<void> {
	await invoke('mw_set_title', { label, title });
	windows.update((map) => {
		const state = map.get(label);
		if (state) map.set(label, { ...state, title });
		return new Map(map);
	});
}

export async function centerWindow(label: string): Promise<void> {
	await invoke('mw_center_window', { label });
}

export async function getWindowState(label: string): Promise<WindowState> {
	return invoke<WindowState>('mw_get_window_state', { label });
}

export async function listWindows(): Promise<WindowState[]> {
	const list = await invoke<WindowState[]>('mw_list_windows');
	const map = new Map(list.map((s) => [s.label, s]));
	windows.set(map);
	return list;
}

// -- IPC messaging between windows --

export async function sendMessage(to: string, channel: string, payload: unknown): Promise<void> {
	const currentLabel = getCurrentWindowLabel();
	await invoke('mw_send_message', {
		message: { from: currentLabel, to, channel, payload }
	});
}

export async function broadcastMessage(channel: string, payload: unknown): Promise<void> {
	const currentLabel = getCurrentWindowLabel();
	await invoke('mw_send_message', {
		message: { from: currentLabel, to: '*', channel, payload }
	});
}

type MessageHandler = (message: WindowMessage) => void;

export async function onMessage(handler: MessageHandler): Promise<UnlistenFn> {
	return listen<WindowMessage>('mw:message', (event) => {
		handler(event.payload);
	});
}

export async function onMessageChannel(channel: string, handler: MessageHandler): Promise<UnlistenFn> {
	return listen<WindowMessage>('mw:message', (event) => {
		if (event.payload.channel === channel) {
			handler(event.payload);
		}
	});
}

// -- Window event listener --

type WindowEventHandler = (event: WindowEvent) => void;

export async function onWindowEvent(handler: WindowEventHandler): Promise<UnlistenFn> {
	return listen<WindowEvent>('mw:event', (event) => {
		handler(event.payload);
	});
}

// -- Convenience helpers for common window types --

export async function openSettingsWindow(): Promise<WindowState> {
	try {
		return await createWindow({
			label: 'settings',
			...SETTINGS_DEFAULTS
		} as WindowConfig);
	} catch {
		// Window likely already exists, just focus it
		await focusWindow('settings');
		return getWindowState('settings');
	}
}

export async function openPopoutWindow(
	label: string,
	title: string,
	url: string,
	overrides?: Partial<WindowConfig>
): Promise<WindowState> {
	const popoutLabel = `popout-${label}`;
	try {
		return await createWindow({
			label: popoutLabel,
			title,
			url,
			...POPOUT_DEFAULTS,
			...overrides
		} as WindowConfig);
	} catch {
		await focusWindow(popoutLabel);
		return getWindowState(popoutLabel);
	}
}

// -- Initialization --

let eventUnlisten: UnlistenFn | null = null;

export async function initMultiWindow(): Promise<void> {
	// Load initial window list from backend
	await listWindows();

	// Listen for window events to keep the store in sync
	eventUnlisten = await onWindowEvent((event) => {
		switch (event.eventType) {
			case 'created': {
				// Refresh the full list on create
				listWindows();
				break;
			}
			case 'closed': {
				windows.update((map) => {
					map.delete(event.label);
					return new Map(map);
				});
				break;
			}
			case 'focused': {
				windows.update((map) => {
					for (const [key, state] of map) {
						map.set(key, { ...state, focused: key === event.label });
					}
					return new Map(map);
				});
				break;
			}
			case 'hidden': {
				windows.update((map) => {
					const state = map.get(event.label);
					if (state) map.set(event.label, { ...state, visible: false, focused: false });
					return new Map(map);
				});
				break;
			}
			case 'shown': {
				windows.update((map) => {
					const state = map.get(event.label);
					if (state) map.set(event.label, { ...state, visible: true });
					return new Map(map);
				});
				break;
			}
		}
	});
}

export function destroyMultiWindow(): void {
	if (eventUnlisten) {
		eventUnlisten();
		eventUnlisten = null;
	}
}

// Utility to determine the current window's label.
// In Tauri 2, each webview window has a label accessible via __TAURI_INTERNALS__.
function getCurrentWindowLabel(): string {
	try {
		// Tauri 2 injects this into each webview
		const internals = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } }).__TAURI_INTERNALS__;
		return internals?.metadata?.currentWindow?.label ?? 'main';
	} catch {
		return 'main';
	}
}
