<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface NetworkInterface {
		name: string;
		is_up: boolean;
		ip_addresses: string[];
	}

	interface NetworkStatus {
		is_online: boolean;
		network_type: string;
		interfaces: NetworkInterface[];
	}

	let isOnline = $state(true);
	let networkType = $state('unknown');
	let showBanner = $state(false);
	let bannerTimeout: ReturnType<typeof setTimeout> | null = null;
	let unlisten: UnlistenFn | null = null;

	onMount(async () => {
		// Get initial status
		try {
			const status = await invoke<NetworkStatus>('get_network_status');
			isOnline = status.is_online;
			networkType = status.network_type;
		} catch {
			// Assume online if check fails
		}

		// Listen for status changes
		unlisten = await listen<NetworkStatus>('network:status-changed', (event) => {
			const wasOnline = isOnline;
			isOnline = event.payload.is_online;
			networkType = event.payload.network_type;

			// Show banner on status change
			showBanner = true;
			if (bannerTimeout) clearTimeout(bannerTimeout);
			bannerTimeout = setTimeout(() => {
				if (isOnline) showBanner = false;
			}, 5000);
		});
	});

	onDestroy(() => {
		unlisten?.();
		if (bannerTimeout) clearTimeout(bannerTimeout);
	});
</script>

{#if showBanner || !isOnline}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2 text-sm font-medium transition-all duration-300"
		class:bg-red-600={!isOnline}
		class:bg-green-600={isOnline}
		class:text-white={true}
	>
		{#if !isOnline}
			<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01" />
			</svg>
			No internet connection — messages will be queued
		{:else}
			<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M1.394 9.393a11 11 0 0115.212 0" />
			</svg>
			Back online via {networkType}
		{/if}
	</div>
{/if}
