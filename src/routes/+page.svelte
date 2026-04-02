<script lang="ts">
	import { Sidebar } from '$lib';
	import PTTSettings from '$lib/components/voice/PTTSettings.svelte';

	let showSettings = false;
	let statusMessage = '';
	let statusType: 'success' | 'error' | '' = '';

	function handleSuccess(event: CustomEvent<string>) {
		statusMessage = event.detail;
		statusType = 'success';
		setTimeout(() => { statusMessage = ''; statusType = ''; }, 3000);
	}

	function handleError(event: CustomEvent<string>) {
		statusMessage = event.detail;
		statusType = 'error';
		setTimeout(() => { statusMessage = ''; statusType = ''; }, 5000);
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center max-w-lg">
				<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
				<p class="text-gray-400 mb-6">Select a server or start a conversation</p>

				<!-- PTT Settings Demo -->
				<button
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
					on:click={() => showSettings = !showSettings}
				>
					{showSettings ? 'Hide' : 'Show'} PTT Settings (T-VOICE-01 Demo)
				</button>

				{#if statusMessage}
					<div
						class="mt-4 p-3 rounded-md text-sm"
						class:bg-green-900={statusType === 'success'}
						class:text-green-300={statusType === 'success'}
						class:bg-red-900={statusType === 'error'}
						class:text-red-300={statusType === 'error'}
					>
						{statusMessage}
					</div>
				{/if}

				{#if showSettings}
					<div class="mt-6 p-6 bg-dark-700 rounded-lg text-left">
						<h2 class="text-lg font-semibold text-gray-100 mb-4">Push-to-Talk Settings</h2>
						<PTTSettings on:success={handleSuccess} on:error={handleError} />
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
