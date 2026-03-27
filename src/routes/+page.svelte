<script lang="ts">
	import { Sidebar } from '$lib';
	import HotkeyDemo from '$lib/components/HotkeyDemo.svelte';
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-gray-100 mb-6">Welcome to Hearth</h1>
				<p class="text-gray-400 mb-8">Select a server or start a conversation</p>

				<!-- Hotkey demo component -->
				<div class="mt-8">
					<HotkeyDemo />
				</div>
			</div>
		</div>
	</main>
</div>
