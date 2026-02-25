<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	/**
	 * WindowStateManager - Automatically saves and restores window position/size
	 * 
	 * Usage: Simply include <WindowStateManager /> in your root layout.
	 * The component will:
	 * - Restore window state on app start
	 * - Auto-save state when window moves, resizes, or closes
	 * - Debounce saves to prevent excessive disk writes
	 */

	interface WindowState {
		x: number;
		y: number;
		width: number;
		height: number;
		is_maximized: boolean;
		is_fullscreen: boolean;
	}

	// Configuration
	export let saveDebounceMs: number = 500;
	export let autoRestore: boolean = true;
	export let autoSave: boolean = true;

	// State
	let isInitialized = false;
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let currentState: WindowState | null = null;
	let unlisteners: UnlistenFn[] = [];

	// Debounced save function
	function scheduleSave() {
		if (!autoSave) return;
		
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		saveTimeout = setTimeout(async () => {
			try {
				await invoke('save_window_state');
			} catch (err) {
				console.warn('[WindowStateManager] Failed to save state:', err);
			}
		}, saveDebounceMs);
	}

	// Force immediate save (e.g., on window close)
	async function saveNow() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		
		try {
			await invoke('save_window_state');
		} catch (err) {
			console.warn('[WindowStateManager] Failed to save state on close:', err);
		}
	}

	// Restore window state on mount
	async function restoreState() {
		if (!autoRestore) {
			isInitialized = true;
			return;
		}

		try {
			const restored = await invoke<boolean>('restore_window_state');
			if (restored) {
				console.log('[WindowStateManager] Window state restored');
			}
		} catch (err) {
			console.warn('[WindowStateManager] Failed to restore state:', err);
		}
		
		isInitialized = true;
	}

	// Get current state for external use
	export async function getState(): Promise<WindowState> {
		return invoke<WindowState>('get_window_state');
	}

	// Manually trigger a save
	export async function save(): Promise<void> {
		await saveNow();
	}

	// Clear saved state
	export async function clear(): Promise<void> {
		try {
			await invoke('clear_window_state');
			console.log('[WindowStateManager] Window state cleared');
		} catch (err) {
			console.warn('[WindowStateManager] Failed to clear state:', err);
		}
	}

	onMount(async () => {
		// Restore state first
		await restoreState();

		// Listen for window events to trigger auto-save
		try {
			// Window move events
			const unlistenMove = await listen('tauri://move', () => {
				scheduleSave();
			});
			unlisteners.push(unlistenMove);

			// Window resize events
			const unlistenResize = await listen('tauri://resize', () => {
				scheduleSave();
			});
			unlisteners.push(unlistenResize);

			// Window close - save immediately
			const unlistenClose = await listen('tauri://close-requested', async () => {
				await saveNow();
			});
			unlisteners.push(unlistenClose);

			// Focus gained - refresh state (window might have been moved externally)
			const unlistenFocus = await listen('tauri://focus', () => {
				scheduleSave();
			});
			unlisteners.push(unlistenFocus);

		} catch (err) {
			console.warn('[WindowStateManager] Failed to set up event listeners:', err);
		}
	});

	onDestroy(() => {
		// Clean up timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Clean up listeners
		unlisteners.forEach(unlisten => unlisten());
		unlisteners = [];
	});
</script>

<!-- This is a headless component - no visible UI -->
