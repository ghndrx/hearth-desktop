<script lang="ts">
	/**
	 * SessionLockManager.svelte
	 *
	 * Manages user presence based on screen lock/unlock events.
	 * Automatically sets status to "away" when the screen is locked
	 * and restores the previous status on unlock.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface SessionLockEvent {
		locked: boolean;
		lock_duration_secs: number | null;
		timestamp: number;
	}

	interface SessionLockStatus {
		is_locked: boolean;
		locked_since: number;
		locked_duration_secs: number;
	}

	interface Props {
		/** Whether to auto-manage presence status */
		autoManageStatus?: boolean;
		/** Callback when session locks */
		onlock?: () => void;
		/** Callback when session unlocks with duration info */
		onunlock?: (durationSecs: number | null) => void;
	}

	let { autoManageStatus = true, onlock, onunlock }: Props = $props();

	let isLocked = $state(false);
	let lockDuration = $state(0);
	let previousStatus = $state<string | null>(null);
	let unlisten: UnlistenFn | null = null;
	let durationInterval: ReturnType<typeof setInterval> | null = null;

	function formatDuration(secs: number): string {
		if (secs < 60) return `${secs}s`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m`;
		const hours = Math.floor(secs / 3600);
		const mins = Math.floor((secs % 3600) / 60);
		return `${hours}h ${mins}m`;
	}

	onMount(async () => {
		// Check initial status
		try {
			const status = await invoke<SessionLockStatus>('get_session_lock_status');
			isLocked = status.is_locked;
			lockDuration = status.locked_duration_secs;
		} catch {
			// Monitor may not be running yet
		}

		// Listen for lock/unlock events
		unlisten = await listen<SessionLockEvent>('session:lock-changed', (event) => {
			const { locked, lock_duration_secs } = event.payload;
			isLocked = locked;

			if (locked) {
				lockDuration = 0;
				// Start tracking lock duration
				durationInterval = setInterval(() => {
					lockDuration++;
				}, 1000);

				onlock?.();
			} else {
				// Stop duration tracking
				if (durationInterval) {
					clearInterval(durationInterval);
					durationInterval = null;
				}
				lockDuration = 0;

				onunlock?.(lock_duration_secs);
			}
		});
	});

	onDestroy(() => {
		unlisten?.();
		if (durationInterval) clearInterval(durationInterval);
	});
</script>

<!-- This component is headless — it manages session lock state without rendering UI -->
<!-- Parent components can bind to isLocked state or use the callback props -->
