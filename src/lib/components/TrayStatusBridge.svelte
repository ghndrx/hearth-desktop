<script lang="ts">
	/**
	 * TrayStatusBridge Component
	 *
	 * Invisible bridge that syncs user presence status between the system tray
	 * and the frontend presence store. Listens for tray status change events
	 * and pushes frontend status changes back to the tray.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { trayGetUserStatus, traySetUserStatus } from '$lib/tauri';
	import { presenceStore, type PresenceStatus } from '$lib/stores/presence';
	import { gateway } from '$lib/stores/gateway';

	let unlisten: UnlistenFn | null = null;
	let isTauriAvailable = false;

	// Track the last status we set to avoid echo loops
	let lastSetStatus: string | null = null;

	async function checkTauri(): Promise<boolean> {
		try {
			return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
		} catch {
			return false;
		}
	}

	async function syncInitialStatus() {
		if (!isTauriAvailable) return;

		try {
			const trayStatus = await trayGetUserStatus();
			// If tray has a non-default status, don't override it
			// The tray starts as 'online' which matches the default presence
		} catch {
			// Tauri not available or command not registered
		}
	}

	async function handleTrayStatusChange(event: { payload: { status: string; label: string } }) {
		const { status } = event.payload;
		lastSetStatus = status;

		// Push the tray-selected status to the gateway as a presence update
		const validStatuses: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible'];
		if (validStatuses.includes(status as PresenceStatus)) {
			gateway.updatePresence(status);
		}
	}

	/** Called by parent components when user changes status via the UI */
	export async function updateTrayFromFrontend(status: PresenceStatus) {
		if (!isTauriAvailable) return;
		if (lastSetStatus === status) {
			lastSetStatus = null;
			return; // Avoid echo loop
		}
		try {
			await traySetUserStatus(status);
		} catch {
			// Silently fail if tray command unavailable
		}
	}

	onMount(async () => {
		isTauriAvailable = await checkTauri();
		if (!isTauriAvailable) return;

		await syncInitialStatus();

		try {
			unlisten = await listen<{ status: string; label: string }>(
				'tray:status-changed',
				handleTrayStatusChange
			);
		} catch {
			// Event listener setup failed
		}
	});

	onDestroy(() => {
		if (unlisten) {
			unlisten();
			unlisten = null;
		}
	});
</script>

<!-- Invisible bridge component - no UI rendered -->
