<!--
  ShortcutListener - Headless component that listens for keyboard shortcuts
  and dispatches the corresponding actions.

  Mount once at the app root (+layout.svelte). Renders nothing.
  Handles both in-app shortcuts (via keydown) and global Tauri shortcuts.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { isShortcutPressed } from '$lib/stores/shortcuts';
	import { globalShortcutsStore } from '$lib/stores/globalShortcuts';
	import { voiceActions, isInVoice } from '$lib/stores/voice';
	import { ui } from '$lib/stores/ui';
	import { goto } from '$app/navigation';

	/** Whether the shortcut listener is active (disable when modals with own key handling are open) */
	export let enabled = true;

	function isInputFocused(): boolean {
		const el = document.activeElement;
		if (!el) return false;
		const tag = el.tagName.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
		if ((el as HTMLElement).isContentEditable) return true;
		return false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!enabled) return;

		// Allow Escape through even when input is focused
		const inputFocused = isInputFocused();

		// Navigation shortcuts
		if (!inputFocused) {
			if (isShortcutPressed(event, 'quick-switcher')) {
				event.preventDefault();
				ui.toggleSearch();
				return;
			}

			if (isShortcutPressed(event, 'search')) {
				event.preventDefault();
				ui.setSearchOpen(true);
				return;
			}

			if (isShortcutPressed(event, 'toggle-sidebar')) {
				event.preventDefault();
				ui.toggleSidebar();
				return;
			}

			if (isShortcutPressed(event, 'toggle-member-list')) {
				event.preventDefault();
				ui.toggleMemberList();
				return;
			}

			if (isShortcutPressed(event, 'open-settings')) {
				event.preventDefault();
				goto('/settings');
				return;
			}
		}

		// Voice shortcuts (work even when input is focused)
		if (isShortcutPressed(event, 'toggle-mute')) {
			event.preventDefault();
			voiceActions.toggleMute();
			return;
		}

		if (isShortcutPressed(event, 'toggle-deafen')) {
			event.preventDefault();
			voiceActions.toggleDeafen();
			return;
		}

		if (isShortcutPressed(event, 'disconnect-voice')) {
			event.preventDefault();
			if (get(isInVoice)) {
				voiceActions.leave();
			}
			return;
		}

		// Window shortcuts
		if (!inputFocused) {
			if (isShortcutPressed(event, 'zoom-in')) {
				event.preventDefault();
				document.body.style.zoom = String(
					Math.min(2, parseFloat(document.body.style.zoom || '1') + 0.1)
				);
				return;
			}

			if (isShortcutPressed(event, 'zoom-out')) {
				event.preventDefault();
				document.body.style.zoom = String(
					Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1)
				);
				return;
			}

			if (isShortcutPressed(event, 'zoom-reset')) {
				event.preventDefault();
				document.body.style.zoom = '1';
				return;
			}
		}
	}

	// Set up global (Tauri) shortcut handlers
	function setupGlobalHandlers() {
		globalShortcutsStore.onShortcut('global-toggle-mute', () => {
			voiceActions.toggleMute();
		});

		globalShortcutsStore.onShortcut('global-toggle-deafen', () => {
			voiceActions.toggleDeafen();
		});

		globalShortcutsStore.onShortcut('global-toggle-window', async () => {
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window');
				const win = getCurrentWindow();
				const visible = await win.isVisible();
				if (visible) {
					await win.hide();
				} else {
					await win.show();
					await win.setFocus();
				}
			} catch {
				// Not running in Tauri
			}
		});

		globalShortcutsStore.onShortcut('global-toggle-dnd', async () => {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				await invoke('toggle_mute');
			} catch {
				// Command not available
			}
		});
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		// Initialize global shortcuts (Tauri)
		setupGlobalHandlers();
		globalShortcutsStore.init().catch(() => {
			// Not running in Tauri environment
		});
		globalShortcutsStore.registerAll().catch(() => {
			// Registration may fail outside Tauri
		});
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
		globalShortcutsStore.destroy();
	});
</script>
