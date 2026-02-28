<!--
  AutoAwayManager - Monitors system idle time and updates presence status.

  This headless component listens for auto-away tier change events from the
  Rust backend and updates the gateway presence accordingly. When the user
  goes idle or away, it sends a presence update; when they return, it
  restores their previous status.

  Mount once at the app level (e.g. channels layout). Renders nothing.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { autoAway, type PresenceTier } from '$lib/stores/autoAway';
	import { toasts } from '$lib/stores/toasts';

	/** Whether to show toast notifications on status changes */
	export let showToasts = true;

	const unlisteners: UnlistenFn[] = [];
	let previousManualStatus: string | null = null;

	interface AutoAwayPayload {
		tier: PresenceTier;
		idle_seconds: number;
		idle_threshold: number;
		away_threshold: number;
		monitor_active: boolean;
		screen_locked: boolean;
	}

	async function init() {
		// Get initial state
		try {
			const state = await invoke<AutoAwayPayload>('get_auto_away_state');
			autoAway.setTier(state.tier, state.idle_seconds, state.screen_locked);
			autoAway.setConfig(state.idle_threshold, state.away_threshold);
			autoAway.setMonitorActive(state.monitor_active);
		} catch {
			// Command may not be available
		}

		// Listen for tier changes
		const unlisten = await listen<AutoAwayPayload>('auto-away:tier-changed', (e) => {
			const payload = e.payload;
			const previousTier = getCurrentTier();

			autoAway.setTier(payload.tier, payload.idle_seconds, payload.screen_locked);

			// Show toast on transitions
			if (showToasts && previousTier !== payload.tier) {
				if (payload.tier === 'idle') {
					toasts.add('Status changed to idle', { type: 'info', duration: 3000 });
				} else if (payload.tier === 'away') {
					toasts.add('Status changed to away', { type: 'warning', duration: 3000 });
				} else if (payload.tier === 'active' && previousTier !== 'active') {
					toasts.add('Welcome back', { type: 'success', duration: 2000 });
				}
			}
		});
		unlisteners.push(unlisten);
	}

	function getCurrentTier(): PresenceTier {
		let current: PresenceTier = 'active';
		const unsub = autoAway.subscribe((s) => (current = s.tier));
		unsub();
		return current;
	}

	onMount(() => {
		init();
	});

	onDestroy(() => {
		for (const unlisten of unlisteners) {
			unlisten();
		}
	});
</script>
