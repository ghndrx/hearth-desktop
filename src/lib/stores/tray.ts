import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export const unreadCount = writable(0);

let trayInitialized = false;

export async function initTray() {
	if (!browser || trayInitialized) return;
	trayInitialized = true;

	const { invoke } = await import('@tauri-apps/api/core');
	const { listen } = await import('@tauri-apps/api/event');

	// Sync minimize-to-tray setting from localStorage
	const saved = localStorage.getItem('hearth_settings');
	if (saved) {
		try {
			const settings = JSON.parse(saved);
			if (typeof settings.minimizeToTray === 'boolean') {
				await invoke('set_minimize_to_tray', { enabled: settings.minimizeToTray });
			}
		} catch {
			// ignore
		}
	}

	// Listen for mute/deafen toggles from tray menu
	listen<boolean>('tray-mute-toggle', (event) => {
		document.dispatchEvent(new CustomEvent('hearth:mute-toggle', { detail: event.payload }));
	});

	listen<boolean>('tray-deafen-toggle', (event) => {
		document.dispatchEvent(new CustomEvent('hearth:deafen-toggle', { detail: event.payload }));
	});
}

export async function setUnreadCount(count: number) {
	unreadCount.set(count);
	if (!browser) return;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('set_badge_count', { count });
	} catch {
		// Not running in Tauri
	}
}

export async function syncMinimizeToTray(enabled: boolean) {
	if (!browser) return;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('set_minimize_to_tray', { enabled });
	} catch {
		// Not running in Tauri
	}
}
