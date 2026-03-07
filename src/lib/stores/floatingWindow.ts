import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface FloatingWindowState {
	visible: boolean;
	width: number;
	height: number;
	x: number;
	y: number;
	opacity: number;
	corner: string;
}

const defaultState: FloatingWindowState = {
	visible: false,
	width: 380,
	height: 520,
	x: 0,
	y: 0,
	opacity: 1.0,
	corner: 'bottom-right'
};

export const floatingWindow = writable<FloatingWindowState>(defaultState);

export const isFloatingVisible = derived(floatingWindow, ($fw) => $fw.visible);

export async function showFloating(corner?: string) {
	try {
		const state = await invoke<FloatingWindowState>('floating_show', { corner });
		floatingWindow.set(state);
	} catch (e) {
		console.error('Failed to show floating window:', e);
	}
}

export async function hideFloating() {
	try {
		await invoke('floating_hide');
		floatingWindow.update((s) => ({ ...s, visible: false }));
	} catch (e) {
		console.error('Failed to hide floating window:', e);
	}
}

export async function toggleFloating(corner?: string) {
	try {
		const state = await invoke<FloatingWindowState>('floating_toggle', { corner });
		floatingWindow.set(state);
	} catch (e) {
		console.error('Failed to toggle floating window:', e);
	}
}

export async function moveFloatingCorner(corner: string) {
	try {
		const state = await invoke<FloatingWindowState>('floating_move_corner', { corner });
		floatingWindow.set(state);
	} catch (e) {
		console.error('Failed to move floating window:', e);
	}
}

export async function setFloatingOpacity(opacity: number) {
	try {
		await invoke('floating_set_opacity', { opacity });
		floatingWindow.update((s) => ({ ...s, opacity }));
	} catch (e) {
		console.error('Failed to set floating opacity:', e);
	}
}

export async function resizeFloating(width: number, height: number) {
	try {
		await invoke('floating_resize', { width, height });
		floatingWindow.update((s) => ({ ...s, width, height }));
	} catch (e) {
		console.error('Failed to resize floating window:', e);
	}
}

export async function refreshFloatingState() {
	try {
		const state = await invoke<FloatingWindowState>('floating_get_state');
		floatingWindow.set(state);
	} catch (e) {
		console.error('Failed to get floating window state:', e);
	}
}
