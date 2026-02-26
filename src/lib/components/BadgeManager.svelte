<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	/**
	 * BadgeManager - Application dock/taskbar badge management
	 *
	 * Handles unread message count badges on the application icon.
	 * Supports macOS dock badges, Windows taskbar overlays, and Linux Unity.
	 *
	 * Features:
	 * - Real-time badge updates
	 * - Badge animation for attention
	 * - Muted badge states (dimmed indicator)
	 * - Badge clearing on window focus
	 * - Configurable maximum display count
	 */

	interface BadgeConfig {
		enabled: boolean;
		showOnMuted: boolean;
		clearOnFocus: boolean;
		maxDisplayCount: number;
		bounceOnNew: boolean;
	}

	interface BadgeState {
		count: number;
		isMuted: boolean;
		lastUpdated: number;
	}

	// Props
	export let config: BadgeConfig = {
		enabled: true,
		showOnMuted: true,
		clearOnFocus: true,
		maxDisplayCount: 99,
		bounceOnNew: true
	};

	// State
	let badgeState: BadgeState = {
		count: 0,
		isMuted: false,
		lastUpdated: 0
	};

	let previousCount = 0;
	let isSupported = false;
	let unlistenFns: UnlistenFn[] = [];

	// Update badge count
	async function updateBadge(count: number): Promise<void> {
		if (!config.enabled) return;
		if (!isSupported) return;

		const displayCount = Math.min(count, config.maxDisplayCount);
		const displayText = count > config.maxDisplayCount ? `${config.maxDisplayCount}+` : String(count);

		try {
			await invoke('set_badge_count', {
				count: displayCount,
				text: count > 0 ? displayText : null,
				urgent: config.bounceOnNew && count > previousCount
			});

			badgeState = {
				count,
				isMuted: badgeState.isMuted,
				lastUpdated: Date.now()
			};
			previousCount = count;
		} catch (err) {
			console.error('Failed to update badge:', err);
		}
	}

	// Clear badge
	async function clearBadge(): Promise<void> {
		if (!isSupported) return;

		try {
			await invoke('clear_badge');
			badgeState = {
				count: 0,
				isMuted: badgeState.isMuted,
				lastUpdated: Date.now()
			};
			previousCount = 0;
		} catch (err) {
			console.error('Failed to clear badge:', err);
		}
	}

	// Set muted state (shows dimmed badge indicator)
	async function setMuted(muted: boolean): Promise<void> {
		if (!isSupported) return;

		try {
			await invoke('set_badge_muted', { muted });
			badgeState.isMuted = muted;

			if (!config.showOnMuted && muted && badgeState.count > 0) {
				await clearBadge();
			}
		} catch (err) {
			console.error('Failed to set badge muted state:', err);
		}
	}

	// Request attention (bounce/flash)
	async function requestAttention(critical: boolean = false): Promise<void> {
		if (!isSupported) return;

		try {
			await invoke('request_attention', { critical });
		} catch (err) {
			console.error('Failed to request attention:', err);
		}
	}

	// Check platform support
	async function checkSupport(): Promise<boolean> {
		try {
			const supported = await invoke<boolean>('is_badge_supported');
			return supported;
		} catch {
			return false;
		}
	}

	// Handle window focus
	async function handleWindowFocus(): Promise<void> {
		if (config.clearOnFocus && badgeState.count > 0) {
			await clearBadge();
		}
	}

	onMount(async () => {
		isSupported = await checkSupport();

		if (isSupported) {
			// Listen for unread count changes
			const unlistenUnread = await listen<number>('unread-count-changed', (event) => {
				updateBadge(event.payload);
			});
			unlistenFns.push(unlistenUnread);

			// Listen for mute state changes
			const unlistenMute = await listen<boolean>('mute-state-changed', (event) => {
				setMuted(event.payload);
			});
			unlistenFns.push(unlistenMute);

			// Listen for window focus
			const unlistenFocus = await listen('tauri://focus', () => {
				handleWindowFocus();
			});
			unlistenFns.push(unlistenFocus);

			// Listen for attention requests
			const unlistenAttention = await listen<{ critical: boolean }>('request-attention', (event) => {
				requestAttention(event.payload.critical);
			});
			unlistenFns.push(unlistenAttention);
		}
	});

	onDestroy(() => {
		unlistenFns.forEach((unlisten) => unlisten());
	});

	// Exported functions for parent components
	export { updateBadge, clearBadge, setMuted, requestAttention };
</script>

<!-- BadgeManager is a headless component, no visual output -->
<!-- It manages the native app badge/overlay in the background -->

<slot {badgeState} {isSupported} {updateBadge} {clearBadge} {setMuted} {requestAttention} />
