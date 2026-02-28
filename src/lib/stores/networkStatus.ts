/**
 * Network status store for the Hearth desktop app.
 *
 * Tracks online/offline state and network type from the native
 * network monitor, making it available to all components.
 */
import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface NetworkStatus {
	isOnline: boolean;
	networkType: string;
}

const { subscribe, set, update } = writable<NetworkStatus>({
	isOnline: true,
	networkType: 'unknown'
});

let initialized = false;

async function init() {
	if (initialized) return;
	initialized = true;

	try {
		const status = await invoke<{
			is_online: boolean;
			network_type: string;
		}>('get_network_status');
		set({
			isOnline: status.is_online,
			networkType: status.network_type
		});
	} catch {
		// Assume online
	}

	await listen<{ is_online: boolean; network_type: string }>('network:status-changed', (event) => {
		set({
			isOnline: event.payload.is_online,
			networkType: event.payload.network_type
		});
	});
}

export const networkStatus = {
	subscribe,
	init
};
