<!--
  NativeEventBridge - Headless component that listens for Tauri backend
  events and bridges them into the Svelte toast system + nativeState store.

  Mount this once at the app root (e.g., +layout.svelte). It renders nothing.
  All native events (focus mode, mute, privacy, network, session lock,
  snooze, file drops, window visibility) are centralized here so individual
  components don't need to set up their own listeners.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { toasts } from '$lib/stores/toasts';
	import { nativeState } from '$lib/stores/nativeState';
	import { autoAway, type PresenceTier } from '$lib/stores/autoAway';

	const unlisteners: UnlistenFn[] = [];

	/** Track previous network state to detect transitions */
	let wasOnline = true;
	/** Track previous session lock state */
	let wasLocked = false;

	async function register<T>(event: string, handler: (payload: T) => void) {
		const unlisten = await listen<T>(event, (e) => handler(e.payload));
		unlisteners.push(unlisten);
	}

	async function initBridge() {
		// ── Focus Mode ──────────────────────────────────────────────
		try {
			const active = await invoke<boolean>('is_focus_mode_active');
			nativeState.setFocusMode(active);
		} catch {
			// Command may not be available
		}

		await register<{ active: boolean; message: string }>('focus-mode-changed', (payload) => {
			nativeState.setFocusMode(payload.active);
			toasts.add(payload.message, {
				type: payload.active ? 'warning' : 'info',
				duration: 3000
			});
		});

		// ── Mute State ──────────────────────────────────────────────
		try {
			const muted = await invoke<boolean>('is_muted');
			nativeState.setMuted(muted);
		} catch {
			// Command may not be available
		}

		await register<{ muted: boolean; message: string }>('mute-state-changed', (payload) => {
			nativeState.setMuted(payload.muted);
			toasts.add(payload.message, {
				type: 'info',
				duration: 2500
			});
		});

		// ── Privacy Mode ────────────────────────────────────────────
		await register<{ active: boolean }>('privacy-mode-changed', (payload) => {
			nativeState.setPrivacyMode(payload.active);
			if (payload.active) {
				toasts.add('Privacy mode enabled', { type: 'warning', duration: 2000 });
			}
			// Don't toast on disable since the screen itself reveals it
		});

		// Also handle the toggle event from tray (fires without payload)
		await register<void>('privacy-mode-toggle', () => {
			// Toggle is handled by PrivacyScreen; we just track state
		});

		// ── Notification Snooze ─────────────────────────────────────
		try {
			const snoozed = await invoke<boolean>('are_notifications_snoozed');
			if (snoozed) {
				const status = await invoke<{
					active: boolean;
					until_formatted: string | null;
					label: string | null;
				}>('get_notification_snooze_status');
				nativeState.setSnooze(status.active, status.until_formatted);
			}
		} catch {
			// Command may not be available
		}

		await register<{
			active: boolean;
			until_formatted: string | null;
			label: string | null;
		}>('snooze-started', (payload) => {
			nativeState.setSnooze(true, payload.until_formatted);
			const msg = payload.label
				? `Notifications snoozed: ${payload.label}`
				: 'Notifications snoozed';
			toasts.add(msg, { type: 'info', duration: 3000 });
		});

		await register<void>('snooze-ended', () => {
			nativeState.setSnooze(false, null);
			toasts.add('Snooze ended - notifications resumed', {
				type: 'success',
				duration: 3000
			});
		});

		// ── Network Status ──────────────────────────────────────────
		try {
			const status = await invoke<{ is_online: boolean; network_type: string }>(
				'get_network_status'
			);
			nativeState.setNetwork(status.is_online, status.network_type);
			wasOnline = status.is_online;
		} catch {
			// Command may not be available
		}

		await register<{ is_online: boolean; network_type: string }>(
			'network:status-changed',
			(payload) => {
				const nowOnline = payload.is_online;
				nativeState.setNetwork(nowOnline, payload.network_type);

				// Only toast on transitions, not initial state
				if (wasOnline && !nowOnline) {
					toasts.add('Connection lost - working offline', {
						type: 'error',
						duration: 0, // Persist until dismissed
						dismissible: true
					});
				} else if (!wasOnline && nowOnline) {
					toasts.add('Back online', { type: 'success', duration: 3000 });
				}
				wasOnline = nowOnline;
			}
		);

		// ── Session Lock/Unlock ─────────────────────────────────────
		try {
			const locked = await invoke<boolean>('is_session_locked');
			nativeState.setSessionLocked(locked);
			wasLocked = locked;
		} catch {
			// Command may not be available
		}

		await register<{ locked: boolean }>('session-lock-changed', (payload) => {
			nativeState.setSessionLocked(payload.locked);

			if (!wasLocked && payload.locked) {
				// Session locked - no toast needed since user can't see it
			} else if (wasLocked && !payload.locked) {
				// Session unlocked - welcome back
				toasts.add('Welcome back', { type: 'info', duration: 2000 });
			}
			wasLocked = payload.locked;
		});

		// ── Window Visibility ───────────────────────────────────────
		await register<{ visible: boolean }>('window-visibility-changed', (payload) => {
			nativeState.setWindowVisible(payload.visible);
		});

		// ── Mini Mode ───────────────────────────────────────────────
		await register<{ active: boolean; message: string; corner?: string }>(
			'mini-mode-changed',
			(payload) => {
				toasts.add(payload.message, { type: 'info', duration: 2000 });
			}
		);

		// ── Update Available ────────────────────────────────────────
		await register<{ version: string; current_version: string; body: string | null }>(
			'update:available',
			(payload) => {
				toasts.add(`Update v${payload.version} available! Current: v${payload.current_version}`, {
					type: 'info',
					duration: 8000,
					dismissible: true
				});
			}
		);

		// ── Auto-Away ──────────────────────────────────────────────
		try {
			const awayState = await invoke<{
				tier: PresenceTier;
				idle_seconds: number;
				idle_threshold: number;
				away_threshold: number;
				monitor_active: boolean;
				screen_locked: boolean;
			}>('get_auto_away_state');
			autoAway.setTier(awayState.tier, awayState.idle_seconds, awayState.screen_locked);
			autoAway.setConfig(awayState.idle_threshold, awayState.away_threshold);
			autoAway.setMonitorActive(awayState.monitor_active);
		} catch {
			// Command may not be available
		}

		let lastAwayTier: PresenceTier = 'active';
		await register<{
			tier: PresenceTier;
			idle_seconds: number;
			screen_locked: boolean;
		}>('auto-away:tier-changed', (payload) => {
			autoAway.setTier(payload.tier, payload.idle_seconds, payload.screen_locked);

			if (payload.tier === 'idle' && lastAwayTier === 'active') {
				toasts.add('Status changed to idle', { type: 'info', duration: 3000 });
			} else if (payload.tier === 'away') {
				toasts.add('Status changed to away', { type: 'warning', duration: 3000 });
			} else if (payload.tier === 'active' && lastAwayTier !== 'active') {
				toasts.add('Welcome back', { type: 'success', duration: 2000 });
			}
			lastAwayTier = payload.tier;
		});
	}

	onMount(() => {
		initBridge();
	});

	onDestroy(() => {
		for (const unlisten of unlisteners) {
			unlisten();
		}
		unlisteners.length = 0;
	});
</script>
