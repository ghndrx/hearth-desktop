<script lang="ts">
	import { Sidebar } from '$lib';
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
				<p class="text-gray-400">Select a server or start a conversation</p>
			</div>
		</div>
	</main>
</div>
