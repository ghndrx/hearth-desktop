<script lang="ts">
	import { Sidebar } from '$lib';
	import VoiceChannelControls from '$lib/components/VoiceChannelControls.svelte';
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
				<p class="text-gray-400 mb-8">Select a server or start a conversation</p>

				<!-- Voice Channel Controls Demo -->
				<div class="max-w-sm mx-auto">
					<VoiceChannelControls />
				</div>
			</div>
		</div>
	</main>
</div>
