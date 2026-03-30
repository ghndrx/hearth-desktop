<script lang="ts">
	import { Sidebar } from '$lib';
	import AudioDeviceSelector from '$lib/components/AudioDeviceSelector.svelte';
	import type { AudioDevice } from '$lib/voice';

	function handleDeviceSelected(device: AudioDevice) {
		console.log(`Selected ${device.deviceType} device:`, device);
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center max-w-md">
				<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
				<p class="text-gray-400 mb-8">Select a server or start a conversation</p>

				<!-- Audio Device Enumeration Demo -->
				<div class="bg-dark-700 p-6 rounded-lg shadow-lg space-y-4">
					<h2 class="text-lg font-semibold text-gray-200 mb-4">Audio Devices</h2>

					<AudioDeviceSelector
						deviceType="input"
						onDeviceSelected={handleDeviceSelected}
					/>

					<AudioDeviceSelector
						deviceType="output"
						onDeviceSelected={handleDeviceSelected}
					/>
				</div>
			</div>
		</div>
	</main>
</div>
