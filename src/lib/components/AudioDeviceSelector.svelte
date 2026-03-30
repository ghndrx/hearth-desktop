<script lang="ts">
	import { onMount } from 'svelte';
	import { enumerateAudioDevices, type AudioDevice } from '$lib/voice';

	// Props
	export let deviceType: 'input' | 'output' = 'input';
	export let selectedDeviceId: string | null = null;
	export let onDeviceSelected: ((device: AudioDevice) => void) | null = null;

	// State
	let devices: AudioDevice[] = [];
	let loading = true;
	let error: string | null = null;

	// Reactive filtering
	$: filteredDevices = devices.filter(device => device.deviceType === deviceType);

	async function loadDevices() {
		try {
			loading = true;
			error = null;
			devices = await enumerateAudioDevices();

			// Auto-select default device if no selection
			if (!selectedDeviceId) {
				const defaultDevice = filteredDevices.find(device => device.isDefault);
				if (defaultDevice) {
					selectedDeviceId = defaultDevice.deviceId;
					if (onDeviceSelected) {
						onDeviceSelected(defaultDevice);
					}
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load audio devices';
			console.error('Audio device enumeration error:', err);
		} finally {
			loading = false;
		}
	}

	function handleDeviceChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const deviceId = target.value;
		selectedDeviceId = deviceId;

		const device = filteredDevices.find(d => d.deviceId === deviceId);
		if (device && onDeviceSelected) {
			onDeviceSelected(device);
		}
	}

	onMount(() => {
		loadDevices();
	});
</script>

<div class="audio-device-selector">
	<label for="audio-device-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
		{deviceType === 'input' ? 'Microphone' : 'Speaker'} Device
	</label>

	{#if loading}
		<div class="flex items-center space-x-2">
			<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
			<span class="text-sm text-gray-500">Loading devices...</span>
		</div>
	{:else if error}
		<div class="text-red-600 dark:text-red-400 text-sm">
			{error}
			<button
				onclick={loadDevices}
				class="ml-2 text-blue-500 hover:text-blue-600 underline"
			>
				Retry
			</button>
		</div>
	{:else if filteredDevices.length === 0}
		<div class="text-gray-500 text-sm">
			No {deviceType} devices found
		</div>
	{:else}
		<select
			id="audio-device-select"
			value={selectedDeviceId || ''}
			onchange={handleDeviceChange}
			class="
				block w-full px-3 py-2 border border-gray-300 dark:border-gray-600
				rounded-md shadow-sm bg-white dark:bg-gray-700
				text-gray-900 dark:text-gray-100
				focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
			"
		>
			<option value="">Select a device...</option>
			{#each filteredDevices as device (device.deviceId)}
				<option value={device.deviceId}>
					{device.name}
					{device.isDefault ? ' (Default)' : ''}
					{#if deviceType === 'input' && device.inputChannels > 0}
						- {device.inputChannels}ch
					{/if}
					{#if deviceType === 'output' && device.outputChannels > 0}
						- {device.outputChannels}ch
					{/if}
				</option>
			{/each}
		</select>
	{/if}

	<button
		onclick={loadDevices}
		class="
			mt-2 text-xs text-blue-500 hover:text-blue-600
			focus:outline-none focus:underline
		"
		disabled={loading}
	>
		Refresh Devices
	</button>
</div>

<style>
	.audio-device-selector {
		/* Component-specific styles if needed */
	}
</style>