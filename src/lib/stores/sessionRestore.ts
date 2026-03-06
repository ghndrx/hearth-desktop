import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface WindowState {
	x: number;
	y: number;
	width: number;
	height: number;
	maximized: boolean;
	fullscreen: boolean;
	monitor: string | null;
}

export interface ChannelState {
	channel_id: string;
	server_id: string | null;
	scroll_position: number;
	draft_content: string | null;
	pinned: boolean;
}

export interface SidebarState {
	collapsed_categories: string[];
	collapsed_servers: string[];
	width: number;
}

export interface SessionState {
	version: number;
	timestamp: number;
	active_channel_id: string | null;
	active_server_id: string | null;
	open_channels: ChannelState[];
	window_state: WindowState;
	sidebar_state: SidebarState;
	split_view_enabled: boolean;
	split_view_channels: string[];
	theme: string | null;
	zoom_level: number;
	custom_data: Record<string, string>;
}

export interface SessionInfo {
	has_session: boolean;
	has_backup: boolean;
	last_saved?: number;
	size_bytes?: number;
}

interface SessionRestoreState {
	currentSession: SessionState | null;
	info: SessionInfo | null;
	loading: boolean;
	saving: boolean;
	error: string | null;
	autoSaveEnabled: boolean;
	lastAction: string | null;
}

const initialState: SessionRestoreState = {
	currentSession: null,
	info: null,
	loading: false,
	saving: false,
	error: null,
	autoSaveEnabled: true,
	lastAction: null
};

const state = writable<SessionRestoreState>(initialState);

export const sessionRestoreState = { subscribe: state.subscribe };
export const sessionInfo = derived(state, ($s) => $s.info);
export const sessionLoading = derived(state, ($s) => $s.loading || $s.saving);
export const sessionError = derived(state, ($s) => $s.error);
export const currentSession = derived(state, ($s) => $s.currentSession);
export const autoSaveEnabled = derived(state, ($s) => $s.autoSaveEnabled);
export const lastAction = derived(state, ($s) => $s.lastAction);

let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

export async function loadSessionInfo() {
	state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		const info = await invoke<Record<string, unknown>>('get_session_info');
		state.update((s) => ({
			...s,
			info: info as unknown as SessionInfo,
			loading: false
		}));
	} catch (e) {
		state.update((s) => ({ ...s, loading: false, error: String(e) }));
	}
}

export async function loadSession() {
	state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		const session = await invoke<SessionState | null>('load_session_state');
		state.update((s) => ({
			...s,
			currentSession: session,
			loading: false,
			lastAction: session ? 'Loaded session' : 'No session found'
		}));
	} catch (e) {
		state.update((s) => ({ ...s, loading: false, error: String(e) }));
	}
}

export async function saveSession() {
	state.update((s) => ({ ...s, saving: true, error: null }));
	try {
		const windowState = await invoke<WindowState>('capture_window_state');
		const session: SessionState = {
			version: 1,
			timestamp: Math.floor(Date.now() / 1000),
			active_channel_id: null,
			active_server_id: null,
			open_channels: [],
			window_state: windowState,
			sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
			split_view_enabled: false,
			split_view_channels: [],
			theme: null,
			zoom_level: 1.0,
			custom_data: {}
		};
		await invoke('save_session_state', { state: session });
		await loadSessionInfo();
		state.update((s) => ({
			...s,
			currentSession: session,
			saving: false,
			lastAction: 'Session saved'
		}));
	} catch (e) {
		state.update((s) => ({ ...s, saving: false, error: String(e) }));
	}
}

export async function clearSession() {
	state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		await invoke('clear_session_state');
		await loadSessionInfo();
		state.update((s) => ({
			...s,
			currentSession: null,
			loading: false,
			lastAction: 'Session cleared'
		}));
	} catch (e) {
		state.update((s) => ({ ...s, loading: false, error: String(e) }));
	}
}

export async function restoreFromBackup() {
	state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		const session = await invoke<SessionState | null>('restore_from_backup');
		state.update((s) => ({
			...s,
			currentSession: session,
			loading: false,
			lastAction: session ? 'Restored from backup' : 'No backup found'
		}));
	} catch (e) {
		state.update((s) => ({ ...s, loading: false, error: String(e) }));
	}
}

export async function restoreWindowState() {
	let session: SessionState | null = null;
	state.subscribe((s) => (session = s.currentSession))();
	if (!session) return;
	try {
		await invoke('restore_window_state', { state: (session as SessionState).window_state });
		state.update((s) => ({ ...s, lastAction: 'Window state restored' }));
	} catch (e) {
		state.update((s) => ({ ...s, error: String(e) }));
	}
}

export function toggleAutoSave() {
	state.update((s) => {
		const enabled = !s.autoSaveEnabled;
		if (enabled) {
			startAutoSave();
		} else {
			stopAutoSave();
		}
		return { ...s, autoSaveEnabled: enabled };
	});
}

function startAutoSave() {
	if (autoSaveInterval) return;
	autoSaveInterval = setInterval(() => {
		saveSession();
	}, 5 * 60 * 1000);
}

function stopAutoSave() {
	if (autoSaveInterval) {
		clearInterval(autoSaveInterval);
		autoSaveInterval = null;
	}
}

export function initSessionRestore() {
	loadSessionInfo();
	startAutoSave();
}

export function cleanupSessionRestore() {
	stopAutoSave();
}
