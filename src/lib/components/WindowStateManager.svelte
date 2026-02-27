<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { windowState, type WindowState } from '$lib/tauri';
	import { rememberWindowState } from '$lib/stores/windowBehavior';
	
	/** Debounce delay for saving window state (ms) */
	export let saveDebounceMs: number = 500;
	
	/** Whether to restore window state on mount */
	export let restoreOnMount: boolean = true;
	
	/** Callback when window state is restored */
	export let onRestored: ((state: WindowState | null) => void) | undefined = undefined;
	
	/** Callback when window state is saved */
	export let onSaved: ((state: WindowState) => void) | undefined = undefined;
	
	let mounted = false;
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let unlistenMove: (() => void) | null = null;
	let unlistenResize: (() => void) | null = null;
	let enabled = true;
	
	// Subscribe to the remember window state setting
	const unsubscribe = rememberWindowState.subscribe((value) => {
		enabled = value;
	});
	
	function debouncedSave() {
		if (!enabled || !mounted) return;
		
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		saveTimeout = setTimeout(async () => {
			try {
				await windowState.save();
				if (onSaved) {
					const state = await windowState.get();
					onSaved(state);
				}
			} catch (error) {
				console.error('Failed to save window state:', error);
			}
		}, saveDebounceMs);
	}
	
	async function setupListeners() {
		if (!browser) return;
		
		try {
			unlistenMove = await windowState.onMove(() => {
				debouncedSave();
			});
			
			unlistenResize = await windowState.onResize(() => {
				debouncedSave();
			});
		} catch (error) {
			console.error('Failed to setup window state listeners:', error);
		}
	}
	
	async function restoreState() {
		if (!browser || !enabled || !restoreOnMount) return;
		
		try {
			const restored = await windowState.restore();
			if (onRestored) {
				const state = restored ? windowState.load() : null;
				onRestored(state);
			}
		} catch (error) {
			console.error('Failed to restore window state:', error);
			if (onRestored) {
				onRestored(null);
			}
		}
	}
	
	onMount(async () => {
		mounted = true;
		
		// First restore state, then setup listeners
		await restoreState();
		await setupListeners();
		
		// Save state before window unload
		if (browser) {
			window.addEventListener('beforeunload', () => {
				if (enabled) {
					// Synchronous save before unload
					const state = windowState.load();
					if (state) {
						localStorage.setItem('hearth_window_state', JSON.stringify(state));
					}
				}
			});
		}
	});
	
	onDestroy(() => {
		mounted = false;
		unsubscribe();
		
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		if (unlistenMove) {
			unlistenMove();
		}
		
		if (unlistenResize) {
			unlistenResize();
		}
	});
	
	// Public methods exposed via bind:this
	export function saveNow(): Promise<void> {
		return windowState.save();
	}
	
	export function clear(): void {
		windowState.clear();
	}
	
	export function getState(): Promise<WindowState> {
		return windowState.get();
	}
</script>

<!-- WindowStateManager is a headless component, no DOM output -->
