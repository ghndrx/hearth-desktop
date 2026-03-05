<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface PopoutWindow {
		channelId: string;
		channelName: string;
	}

	export let onPopoutCreated: (channelId: string) => void = () => {};
	export let onPopoutClosed: (channelId: string) => void = () => {};

	let popoutWindows: string[] = [];
	let pollInterval: number | null = null;

	export async function openPopout(channelId: string, channelName: string) {
		try {
			await invoke('create_popout_window', { channelId, channelName });
			await refreshPopouts();
			onPopoutCreated(channelId);
		} catch (e) {
			console.error('Failed to create popout window:', e);
		}
	}

	export async function closePopout(channelId: string) {
		try {
			await invoke('close_popout_window', { channelId });
			await refreshPopouts();
			onPopoutClosed(channelId);
		} catch (e) {
			console.error('Failed to close popout window:', e);
		}
	}

	export function isPopoutOpen(channelId: string): boolean {
		return popoutWindows.includes(`channel-${channelId}`);
	}

	async function refreshPopouts() {
		try {
			popoutWindows = await invoke<string[]>('list_popout_windows');
		} catch {
			popoutWindows = [];
		}
	}

	onMount(() => {
		refreshPopouts();
		pollInterval = window.setInterval(refreshPopouts, 5000);
	});

	onDestroy(() => {
		if (pollInterval !== null) {
			clearInterval(pollInterval);
		}
	});
</script>

<slot {popoutWindows} {openPopout} {closePopout} {isPopoutOpen} />
